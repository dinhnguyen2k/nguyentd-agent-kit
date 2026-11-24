#!/usr/bin/env node
import { resolve } from "node:path";
import { DEFAULT_PORT, ensureDaemon } from "./ensure-daemon.mjs";

async function postJson(path, body, timeoutMs = 25000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`http://127.0.0.1:${DEFAULT_PORT}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function getJson(path, timeoutMs = 4000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`http://127.0.0.1:${DEFAULT_PORT}${path}`, { signal: controller.signal });
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function printToolResult(res) {
  if (!res?.ok) {
    console.error(res?.error || "LSP tool call failed");
    process.exit(1);
  }
  const text = (res.result?.content || []).map((c) => c.text).join("\n");
  console.log(text);
}

const args = process.argv.slice(2);
const cmd = args[0];

if (!cmd || cmd === "--help" || cmd === "-h") {
  console.log(`Usage:
  cogain-lsp check [--json] <file1> [file2...]
  cogain-lsp diagnostics <file>
  cogain-lsp def <file> <symbol> [line]
  cogain-lsp refs <file> <symbol> [line]
  cogain-lsp hover <file> <line> <char>
  cogain-lsp impl <file> <line> <char>
  cogain-lsp symbols <query>
  cogain-lsp status | warmup [root] | restart [ext...]`);
  process.exit(0);
}

const ok = await ensureDaemon(DEFAULT_PORT, 6000);
if (!ok) {
  console.error("Failed to connect/start Warm LSP daemon.");
  process.exit(1);
}

switch (cmd) {
  case "status": {
    console.log(JSON.stringify(await getJson("/health"), null, 2));
    break;
  }
  case "warmup": {
    const root = args[1] ? resolve(args[1]) : process.cwd();
    const res = await postJson("/warmup", { root }, 65000);
    console.log(JSON.stringify(res, null, 2));
    break;
  }
  case "restart": {
    const extensions = args.slice(1);
    const res = await postJson("/tool", {
      name: "restart_server",
      arguments: extensions.length > 0 ? { extensions } : {},
    }, 65000);
    printToolResult(res);
    break;
  }
  case "check": {
    const jsonMode = args.includes("--json");
    const files = args.slice(1).filter((a) => !a.startsWith("--")).map((f) => resolve(f));
    if (files.length === 0) {
      console.error("Missing file path(s)");
      process.exit(1);
    }
    const res = await postJson("/check", { files, maxSeverity: 1, timeoutMs: 8000 }, 20000);
    if (jsonMode) {
      console.log(JSON.stringify(res, null, 2));
    } else {
      for (const item of res.results || []) {
        if (item.timedOut) {
          console.log(`${item.file}: TIMEOUT`);
        } else if (item.error) {
          console.log(`${item.file}: ERROR ${item.error}`);
        } else if (item.diagnostics.length === 0) {
          console.log(`${item.file}: 0 errors`);
        } else {
          for (const d of item.diagnostics) {
            console.log(`${item.file}:${d.line}:${d.character} [${d.code ?? d.source ?? "LSP"}] ${d.message}`);
          }
        }
      }
    }
    process.exit(res.totalErrors > 0 ? 2 : 0);
  }
  case "diagnostics": {
    if (!args[1]) process.exit(1);
    const res = await postJson("/tool", { name: "get_diagnostics", arguments: { file_path: resolve(args[1]) } });
    printToolResult(res);
    break;
  }
  case "def": {
    if (!args[1] || !args[2]) process.exit(1);
    const payload = { file_path: resolve(args[1]), symbol_name: args[2] };
    if (args[3] && Number.isFinite(Number(args[3]))) payload.line = Number(args[3]);
    printToolResult(await postJson("/tool", { name: "find_definition", arguments: payload }));
    break;
  }
  case "refs": {
    if (!args[1] || !args[2]) process.exit(1);
    const payload = { file_path: resolve(args[1]), symbol_name: args[2] };
    if (args[3] && Number.isFinite(Number(args[3]))) payload.line = Number(args[3]);
    printToolResult(await postJson("/tool", { name: "find_references", arguments: payload }));
    break;
  }
  case "hover": {
    if (!args[1] || !args[2] || !args[3]) process.exit(1);
    printToolResult(await postJson("/tool", {
      name: "get_hover",
      arguments: { file_path: resolve(args[1]), line: Number(args[2]), character: Number(args[3]) },
    }));
    break;
  }
  case "impl": {
    if (!args[1] || !args[2] || !args[3]) process.exit(1);
    printToolResult(await postJson("/tool", {
      name: "find_implementation",
      arguments: { file_path: resolve(args[1]), line: Number(args[2]), character: Number(args[3]) },
    }));
    break;
  }
  case "symbols": {
    if (!args[1]) process.exit(1);
    printToolResult(await postJson("/tool", { name: "find_workspace_symbols", arguments: { query: args.slice(1).join(" ") } }));
    break;
  }
  default:
    console.error(`Unknown command: ${cmd}`);
    process.exit(1);
}
