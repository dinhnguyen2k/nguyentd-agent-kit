import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import http from "node:http";
import net from "node:net";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { TOOLS } from "./tools-schema.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.AGY_LSP_PORT || 48991);
function resolveDefaultWorktree() {
  if (process.env.AGY_LSP_DEFAULT_WORKTREE) return resolve(process.env.AGY_LSP_DEFAULT_WORKTREE);
  const cogainCandidate = join(homedir(), "cogain", "cogain-core");
  return existsSync(cogainCandidate) ? cogainCandidate : process.cwd();
}
const DEFAULT_WORKTREE = resolveDefaultWorktree();
const TSGO_WRAPPER = join(HERE, "tsgo-wrapper.sh");
const CSHARP_WRAPPER = join(HERE, "csharp-ls-wrapper.sh");
const DAEMON_INFO_FILE = join(HERE, "daemon.json");
const HOOK_SOCKET_FILE = process.env.AGY_LSP_HOOK_SOCK || join(HERE, "hook.sock");

const TS_EXTS = new Set(["ts", "tsx", "js", "jsx", "mjs", "cjs"]);
const CS_EXTS = new Set(["cs"]);

const SECONDARY_WORKTREE_IDLE_MS = 45 * 60 * 1000;
const DAEMON_IDLE_MS = 12 * 60 * 60 * 1000;
const MAX_OPEN_DOCS = 80;

const SYMBOL_KIND_NAMES = {
  1: "file",
  2: "module",
  3: "namespace",
  4: "package",
  5: "class",
  6: "method",
  7: "property",
  8: "field",
  9: "constructor",
  10: "enum",
  11: "interface",
  12: "function",
  13: "variable",
  14: "constant",
  15: "string",
  16: "number",
  17: "boolean",
  18: "array",
  19: "object",
  20: "key",
  21: "null",
  22: "enum_member",
  23: "struct",
  24: "event",
  25: "operator",
  26: "type_parameter",
};

const SYMBOL_KIND_VALUES = Object.fromEntries(
  Object.entries(SYMBOL_KIND_NAMES).map(([k, v]) => [v, Number(k)])
);

function pathToUri(absPath) {
  return pathToFileURL(resolve(absPath)).href;
}

function uriToPath(uri) {
  try {
    return fileURLToPath(uri);
  } catch {
    return uri.replace(/^file:\/\//i, "");
  }
}

function getLangForFile(filePath) {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  if (TS_EXTS.has(ext)) return "typescript";
  if (CS_EXTS.has(ext)) return "csharp";
  return null;
}

function getLanguageId(filePath) {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  const map = {
    ts: "typescript",
    tsx: "typescriptreact",
    js: "javascript",
    jsx: "javascriptreact",
    mjs: "javascript",
    cjs: "javascript",
    cs: "csharp",
  };
  return map[ext] || "plaintext";
}

function findWorktreeRoot(filePath) {
  if (!filePath) return DEFAULT_WORKTREE;
  try {
    let dir = resolve(filePath);
    try {
      if (statSync(dir).isFile()) dir = dirname(dir);
    } catch {
      dir = dirname(dir);
    }
    while (true) {
      if (existsSync(join(dir, ".git"))) return dir;
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  } catch {
    /* ignore */
  }
  return existsSync(DEFAULT_WORKTREE) ? DEFAULT_WORKTREE : process.cwd();
}

function computeLineInfo(text) {
  const lines = text.split("\n");
  const lineCount = lines.length - 1;
  const lastLineLen = lines[lineCount]?.length ?? 0;
  return { lineCount, lastLineLen };
}

class LspInstance {
  constructor(lang, worktreeRoot) {
    this.lang = lang;
    this.worktreeRoot = worktreeRoot;
    this.command = lang === "typescript" ? TSGO_WRAPPER : CSHARP_WRAPPER;
    this.proc = null;
    this.nextId = 1;
    this.pending = new Map();
    this.readBuf = Buffer.alloc(0);
    this.openDocs = new Map(); // absPath -> { uri, version, sha1, lineCount, lastLineLen, text }
    this.diagnosticsByUri = new Map(); // uri -> diagnostics[]
    this.diagEpochByUri = new Map(); // uri -> number
    this.pullCache = new Map(); // uri -> { epoch, items }
    this.diagWaiters = new Map(); // uri -> Set<fn>
    this.workspaceMutationEpoch = 0;
    this.syncKind = 1;
    this.supportsPullDiagnostics = false;
    this.ready = false;
    this.warmupComplete = false;
    this.initPromise = null;
    this.activeProgressTokens = new Set();
    this.lastUsedAt = Date.now();
    this.disposed = false;
  }

  touch() {
    this.lastUsedAt = Date.now();
  }

  start() {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.#boot().catch((err) => {
      this.initPromise = null;
      throw err;
    });
    return this.initPromise;
  }

  async #boot() {
    this.disposed = false;
    const child = spawn(this.command, [], {
      cwd: this.worktreeRoot,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    });
    this.proc = child;
    this.readBuf = Buffer.alloc(0);

    child.stdout.on("data", (chunk) => this.#onStdout(chunk));
    child.stderr.on("data", (chunk) => {
      if (process.env.AGY_LSP_DEBUG === "1") {
        process.stderr.write(`[${this.lang}] ${chunk}`);
      }
    });
    child.on("exit", (code) => {
      for (const [, p] of this.pending) {
        clearTimeout(p.timer);
        p.reject(new Error(`${this.lang} LSP exited (${code})`));
      }
      this.pending.clear();
      this.ready = false;
      this.warmupComplete = false;
      this.proc = null;
      this.initPromise = null;
      this.openDocs.clear();
      this.diagnosticsByUri.clear();
      this.diagEpochByUri.clear();
      this.pullCache.clear();
    });

    const rootUri = pathToUri(this.worktreeRoot);
    const initTimeout = this.lang === "csharp" ? 45000 : 15000;
    const initParams = {
      processId: process.pid,
      clientInfo: { name: "cogain-warm-lsp", version: "1.0.0" },
      rootUri,
      workspaceFolders: [{ uri: rootUri, name: "workspace" }],
      capabilities: {
        window: { workDoneProgress: true },
        workspace: {
          configuration: true,
          workspaceEdit: { documentChanges: true },
          workspaceFolders: true,
          symbol: { dynamicRegistration: false },
        },
        textDocument: {
          synchronization: { dynamicRegistration: false, didSave: true },
          definition: { dynamicRegistration: false, linkSupport: false },
          references: { dynamicRegistration: false },
          implementation: { dynamicRegistration: false, linkSupport: false },
          hover: { dynamicRegistration: false, contentFormat: ["markdown", "plaintext"] },
          rename: { dynamicRegistration: false, prepareSupport: false },
          callHierarchy: { dynamicRegistration: false },
          documentSymbol: {
            dynamicRegistration: false,
            hierarchicalDocumentSymbolSupport: true,
          },
          publishDiagnostics: { relatedInformation: true, versionSupport: true },
          diagnostic: { dynamicRegistration: false, relatedDocumentSupport: false },
        },
      },
    };

    const result = await this.sendRequest("initialize", initParams, initTimeout);
    const caps = result?.capabilities || {};
    const tds = caps.textDocumentSync;
    if (typeof tds === "number") {
      this.syncKind = tds;
    } else if (tds && typeof tds === "object" && typeof tds.change === "number") {
      this.syncKind = tds.change;
    }
    this.supportsPullDiagnostics = Boolean(caps.diagnosticProvider);
    this.sendNotification("initialized", {});
    this.ready = true;
    if (this.lang === "typescript") {
      this.warmupComplete = true;
    }
    return this;
  }

  #onStdout(chunk) {
    this.readBuf = Buffer.concat([this.readBuf, chunk]);
    while (true) {
      const sepIdx = this.readBuf.indexOf("\r\n\r\n");
      if (sepIdx === -1) break;
      const header = this.readBuf.slice(0, sepIdx).toString("ascii");
      const m = header.match(/Content-Length:\s*(\d+)/i);
      if (!m) {
        this.readBuf = this.readBuf.slice(sepIdx + 4);
        continue;
      }
      const len = Number(m[1]);
      const total = sepIdx + 4 + len;
      if (this.readBuf.length < total) break;
      const bodyStr = this.readBuf.slice(sepIdx + 4, total).toString("utf8");
      this.readBuf = this.readBuf.slice(total);
      try {
        const msg = JSON.parse(bodyStr);
        this.#handleMessage(msg);
      } catch {
        /* ignore malformed frame */
      }
    }
  }

  #handleMessage(msg) {
    if (msg.id !== undefined && !msg.method) {
      const req = this.pending.get(msg.id);
      if (!req) return;
      this.pending.delete(msg.id);
      clearTimeout(req.timer);
      if (msg.error) {
        req.reject(new Error(msg.error.message || "LSP Error"));
      } else {
        req.resolve(msg.result);
      }
      return;
    }

    if (msg.id !== undefined && msg.method) {
      let result = null;
      if (msg.method === "workspace/configuration") {
        const items = Array.isArray(msg.params?.items) ? msg.params.items : [];
        result = items.map(() => ({}));
      }
      this.#sendRaw({ jsonrpc: "2.0", id: msg.id, result });
      return;
    }

    if (msg.method === "textDocument/publishDiagnostics") {
      const uri = msg.params?.uri;
      if (uri) {
        const diags = msg.params.diagnostics || [];
        this.diagnosticsByUri.set(uri, diags);
        this.diagEpochByUri.set(uri, this.workspaceMutationEpoch);
        this.warmupComplete = true;
        const waiters = this.diagWaiters.get(uri);
        if (waiters) {
          for (const fn of waiters) fn(diags);
        }
      }
    } else if (msg.method === "$/progress") {
      const token = msg.params?.token;
      const kind = msg.params?.value?.kind;
      if (kind === "begin" && token !== undefined) {
        this.activeProgressTokens.add(token);
      } else if (kind === "end" && token !== undefined) {
        this.activeProgressTokens.delete(token);
        if (this.activeProgressTokens.size === 0) {
          this.warmupComplete = true;
        }
      }
    }
  }

  #sendRaw(msg) {
    if (!this.proc?.stdin?.writable) return;
    const payload = JSON.stringify(msg);
    const frame = `Content-Length: ${Buffer.byteLength(payload, "utf8")}\r\n\r\n${payload}`;
    this.proc.stdin.write(frame);
  }

  sendNotification(method, params) {
    this.#sendRaw({ jsonrpc: "2.0", method, params });
  }

  sendRequest(method, params, timeoutMs = 20000) {
    if (!this.proc?.stdin?.writable) {
      return Promise.reject(new Error(`${this.lang} LSP process is not running`));
    }
    const id = this.nextId++;
    return new Promise((resolveReq, rejectReq) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        rejectReq(new Error(`LSP request timeout: ${method} (${timeoutMs}ms)`));
      }, timeoutMs);
      this.pending.set(id, { resolve: resolveReq, reject: rejectReq, timer });
      this.#sendRaw({ jsonrpc: "2.0", id, method, params });
    });
  }

  async syncFile(absPath) {
    this.touch();
    await this.start();
    const resolved = resolve(absPath);
    const uri = pathToUri(resolved);
    const buf = readFileSync(resolved);
    const sha1 = createHash("sha1").update(buf).digest("hex");
    const text = buf.toString("utf8");
    const { lineCount, lastLineLen } = computeLineInfo(text);

    const existing = this.openDocs.get(resolved);
    if (!existing) {
      this.diagnosticsByUri.delete(uri);
      this.diagEpochByUri.delete(uri);
      this.pullCache.clear();
      this.workspaceMutationEpoch += 1;
      const doc = { uri, version: 1, sha1, lineCount, lastLineLen, text };
      this.openDocs.set(resolved, doc);
      this.sendNotification("textDocument/didOpen", {
        textDocument: {
          uri,
          languageId: getLanguageId(resolved),
          version: 1,
          text,
        },
      });
      while (this.openDocs.size > MAX_OPEN_DOCS) {
        const oldestKey = this.openDocs.keys().next().value;
        if (!oldestKey || oldestKey === resolved) break;
        const oldest = this.openDocs.get(oldestKey);
        this.openDocs.delete(oldestKey);
        if (oldest) {
          this.diagnosticsByUri.delete(oldest.uri);
          this.diagEpochByUri.delete(oldest.uri);
          this.pullCache.delete(oldest.uri);
          this.sendNotification("textDocument/didClose", { textDocument: { uri: oldest.uri } });
        }
      }
      return { uri, changed: true, opened: true, doc };
    }

    // Refresh LRU order on cache hit
    this.openDocs.delete(resolved);
    this.openDocs.set(resolved, existing);

    if (existing.sha1 === sha1) {
      return { uri, changed: false, opened: false, doc: existing };
    }

    existing.version += 1;
    this.diagnosticsByUri.delete(uri);
    this.diagEpochByUri.delete(uri);
    this.pullCache.clear();
    this.workspaceMutationEpoch += 1;

    const changePayload =
      this.syncKind === 2
        ? [
            {
              range: {
                start: { line: 0, character: 0 },
                end: { line: existing.lineCount, character: existing.lastLineLen },
              },
              text,
            },
          ]
        : [{ text }];

    existing.sha1 = sha1;
    existing.lineCount = lineCount;
    existing.lastLineLen = lastLineLen;
    existing.text = text;

    this.sendNotification("textDocument/didChange", {
      textDocument: { uri, version: existing.version },
      contentChanges: changePayload,
    });
    return { uri, changed: true, opened: false, doc: existing };
  }

  async getDiagnostics(absPath, timeoutMs = 8000) {
    const { uri, changed, doc } = await this.syncFile(absPath);

    if (this.supportsPullDiagnostics) {
      const cached = this.pullCache.get(uri);
      if (cached && cached.epoch === this.workspaceMutationEpoch) {
        return cached.items;
      }
      const res = await this.sendRequest(
        "textDocument/diagnostic",
        { textDocument: { uri } },
        timeoutMs
      );
      let items = [];
      if (res && typeof res === "object" && Array.isArray(res.items)) {
        items = res.items;
      }
      this.pullCache.set(uri, { epoch: this.workspaceMutationEpoch, items });
      return items;
    }

    // Push-based LSP (csharp-ls)
    const cachedEpoch = this.diagEpochByUri.get(uri);
    if (!changed && cachedEpoch === this.workspaceMutationEpoch && this.diagnosticsByUri.has(uri)) {
      return this.diagnosticsByUri.get(uri);
    }

    // If another file in workspace changed, nudge csharp-ls to re-publish diagnostics for this file
    if (!changed && cachedEpoch !== this.workspaceMutationEpoch) {
      doc.version += 1;
      this.diagnosticsByUri.delete(uri);
      this.sendNotification("textDocument/didChange", {
        textDocument: { uri, version: doc.version },
        contentChanges: [{ text: doc.text }],
      });
    }

    return await this.#waitForPushDiagnostics(uri, timeoutMs);
  }

  #waitForPushDiagnostics(uri, timeoutMs) {
    const existing = this.diagnosticsByUri.get(uri);
    if (existing !== undefined && this.diagEpochByUri.get(uri) === this.workspaceMutationEpoch) {
      return Promise.resolve(existing);
    }

    return new Promise((resolveWait, rejectWait) => {
      let settleTimer = null;
      let latest = undefined;
      const waiters = this.diagWaiters.get(uri) || new Set();
      this.diagWaiters.set(uri, waiters);

      const cleanup = () => {
        clearTimeout(overallTimer);
        if (settleTimer) clearTimeout(settleTimer);
        waiters.delete(onDiag);
        if (waiters.size === 0) this.diagWaiters.delete(uri);
      };

      const onDiag = (diags) => {
        latest = diags;
        if (settleTimer) clearTimeout(settleTimer);
        settleTimer = setTimeout(() => {
          cleanup();
          resolveWait(latest || []);
        }, 80);
      };

      const overallTimer = setTimeout(() => {
        cleanup();
        if (latest !== undefined) {
          resolveWait(latest);
        } else if (this.diagnosticsByUri.has(uri)) {
          resolveWait(this.diagnosticsByUri.get(uri));
        } else if (!this.warmupComplete) {
          rejectWait(new Error(`LSP timeout waiting for ${this.lang} warmup (${timeoutMs}ms)`));
        } else {
          resolveWait([]);
        }
      }, timeoutMs);

      waiters.add(onDiag);
    });
  }

  dispose() {
    this.disposed = true;
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(new Error("LSP instance disposed"));
    }
    this.pending.clear();
    if (this.proc) {
      try {
        this.proc.kill("SIGTERM");
      } catch {
        /* ignore */
      }
      this.proc = null;
    }
    this.initPromise = null;
    this.ready = false;
  }
}

const worktreePools = new Map(); // worktreeRoot -> { typescript?: LspInstance, csharp?: LspInstance, lastUsedAt }

function getOrCreateInstance(filePath, explicitLang = null) {
  const lang = explicitLang || getLangForFile(filePath);
  if (!lang) {
    throw new Error(`No LSP server configured for file: ${filePath}`);
  }
  const root = findWorktreeRoot(filePath);
  let pool = worktreePools.get(root);
  if (!pool) {
    pool = { lastUsedAt: Date.now() };
    worktreePools.set(root, pool);
  }
  pool.lastUsedAt = Date.now();
  if (!pool[lang] || pool[lang].disposed) {
    pool[lang] = new LspInstance(lang, root);
  }
  return pool[lang];
}

function flattenSymbols(symbols, out = []) {
  for (const s of symbols || []) {
    out.push(s);
    if (Array.isArray(s.children) && s.children.length > 0) {
      flattenSymbols(s.children, out);
    }
  }
  return out;
}

function findTokenInLine(absPath, symbolName, line1Based) {
  try {
    const content = readFileSync(absPath, "utf8");
    const lines = content.split(/\r?\n/);
    const idx0 = line1Based - 1;
    if (idx0 < 0 || idx0 >= lines.length) return null;
    const lineText = lines[idx0];
    const escaped = symbolName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const exactMatch = lineText.match(new RegExp(`\\b${escaped}\\b`));
    const col = exactMatch && exactMatch.index !== undefined ? exactMatch.index : lineText.indexOf(symbolName);
    if (col === -1) return null;
    return { line: idx0, character: col };
  } catch {
    return null;
  }
}

async function resolveSymbolPositions(srv, absPath, symbolName, symbolKind, targetLine1Based) {
  const uri = pathToUri(absPath);
  const raw = await srv.sendRequest("textDocument/documentSymbol", { textDocument: { uri } }, 20000);
  const symbols = Array.isArray(raw) ? raw : [];
  const requestedKindId = symbolKind ? SYMBOL_KIND_VALUES[symbolKind.toLowerCase()] || null : null;
  const matches = [];

  const isDocSymbol = symbols.length > 0 && "selectionRange" in symbols[0];
  const flat = isDocSymbol ? flattenSymbols(symbols) : symbols;

  for (const s of flat) {
    const nameMatch = s.name === symbolName || s.name.includes(symbolName);
    const kindMatch = !requestedKindId || s.kind === requestedKindId;
    if (!nameMatch || !kindMatch) continue;

    const range = isDocSymbol ? s.range : s.location?.range;
    const pos = isDocSymbol ? s.selectionRange?.start : s.location?.range?.start;
    if (!pos) continue;

    if (Number.isInteger(targetLine1Based)) {
      const target0 = targetLine1Based - 1;
      const inRange = range && target0 >= range.start.line && target0 <= range.end.line;
      if (!inRange && pos.line !== target0) continue;
    }
    matches.push({ name: s.name, kind: s.kind, position: pos });
  }

  if (matches.length === 0 && Number.isInteger(targetLine1Based)) {
    const pos = findTokenInLine(absPath, symbolName, targetLine1Based);
    if (pos) {
      matches.push({ name: symbolName, kind: requestedKindId || 13, position: pos });
    }
  }
  return matches;
}

function applyEditsToText(content, edits) {
  const eol = content.includes("\r\n") ? "\r\n" : "\n";
  const lines = content.split(/\r?\n/);
  const sorted = [...edits].sort((a, b) => {
    if (a.range.start.line !== b.range.start.line) {
      return b.range.start.line - a.range.start.line;
    }
    return b.range.start.character - a.range.start.character;
  });
  for (const edit of sorted) {
    const { start, end } = edit.range;
    const startLine = lines[start.line] ?? "";
    const endLine = lines[end.line] ?? "";
    const prefix = startLine.slice(0, start.character);
    const suffix = endLine.slice(end.character);
    const inserted = `${prefix}${edit.newText}${suffix}`.split(/\r?\n/);
    lines.splice(start.line, end.line - start.line + 1, ...inserted);
  }
  return lines.join(eol);
}

function normalizeWorkspaceEdit(result) {
  if (!result || typeof result !== "object") return {};
  if (result.changes && typeof result.changes === "object") return result.changes;
  const changes = {};
  if (Array.isArray(result.documentChanges)) {
    for (const ch of result.documentChanges) {
      if (ch?.textDocument?.uri && Array.isArray(ch.edits)) {
        if (!changes[ch.textDocument.uri]) changes[ch.textDocument.uri] = [];
        changes[ch.textDocument.uri].push(...ch.edits);
      }
    }
  }
  return changes;
}

async function applyWorkspaceRename(changes, dryRun) {
  const entries = Object.entries(changes);
  if (entries.length === 0) {
    return { content: [{ type: "text", text: "No rename edits produced by LSP server." }] };
  }
  if (dryRun) {
    const preview = entries
      .map(([uri, edits]) => `• ${uriToPath(uri)}: ${edits.length} edit(s)`)
      .join("\n");
    return { content: [{ type: "text", text: `Dry-run rename preview:\n${preview}` }] };
  }
  const backups = [];
  const modified = [];
  try {
    for (const [uri, edits] of entries) {
      const origPath = uriToPath(uri);
      const targetPath = lstatSync(origPath).isSymbolicLink() ? realpathSync(origPath) : origPath;
      const origText = readFileSync(targetPath, "utf8");
      backups.push({ targetPath, origText });
      const nextText = applyEditsToText(origText, edits);
      const tmp = `${targetPath}.tmp-${process.pid}-${Date.now()}`;
      writeFileSync(tmp, nextText, "utf8");
      renameSync(tmp, targetPath);
      modified.push(origPath);
      const srv = getOrCreateInstance(origPath);
      await srv.syncFile(origPath);
    }
    return {
      content: [
        {
          type: "text",
          text: `Renamed symbol across ${modified.length} file(s):\n${modified.map((f) => `• ${f}`).join("\n")}`,
        },
      ],
    };
  } catch (err) {
    for (const b of backups) {
      try {
        writeFileSync(b.targetPath, b.origText, "utf8");
      } catch {
        /* ignore */
      }
    }
    throw err;
  }
}

function formatLocations(locs) {
  if (!Array.isArray(locs)) {
    return locs && typeof locs === "object" && locs.uri ? [locs] : [];
  }
  return locs.map((l) => ({ uri: l.targetUri || l.uri, range: l.targetSelectionRange || l.range }));
}

function severityLabel(sev) {
  switch (sev) {
    case 1:
      return "Error";
    case 2:
      return "Warning";
    case 3:
      return "Info";
    case 4:
      return "Hint";
    default:
      return "Unknown";
  }
}

async function executeTool(name, args = {}) {
  switch (name) {
    case "get_diagnostics": {
      const absPath = resolve(args.file_path);
      const srv = getOrCreateInstance(absPath);
      const diags = await srv.getDiagnostics(absPath, 15000);
      if (diags.length === 0) {
        return { content: [{ type: "text", text: `No diagnostics found for ${args.file_path}. The file has no errors, warnings, or hints.` }] };
      }
      const lines = diags.map((d) => {
        const line = (d.range?.start?.line ?? 0) + 1;
        const ch = (d.range?.start?.character ?? 0) + 1;
        const code = d.code !== undefined ? ` (${d.code})` : "";
        const src = d.source ? `[${d.source}] ` : "";
        return `• ${severityLabel(d.severity)}${code} at ${line}:${ch}: ${src}${d.message}`;
      });
      return {
        content: [
          {
            type: "text",
            text: `Diagnostics for ${args.file_path} (${diags.length} issue(s)):\n\n${lines.join("\n")}`,
          },
        ],
      };
    }

    case "find_definition": {
      const absPath = resolve(args.file_path);
      const srv = getOrCreateInstance(absPath);
      await srv.syncFile(absPath);
      const matches = await resolveSymbolPositions(srv, absPath, args.symbol_name, args.symbol_kind, args.line);
      if (matches.length === 0) {
        return {
          content: [{ type: "text", text: `No symbols found with name "${args.symbol_name}" in ${args.file_path}.` }],
        };
      }
      const blocks = [];
      for (const m of matches) {
        const raw = await srv.sendRequest("textDocument/definition", {
          textDocument: { uri: pathToUri(absPath) },
          position: m.position,
        });
        const locs = formatLocations(raw);
        if (locs.length > 0) {
          const lines = locs.map((l) => `${uriToPath(l.uri)}:${l.range.start.line + 1}:${l.range.start.character + 1}`);
          blocks.push(
            `Results for ${m.name} (${SYMBOL_KIND_NAMES[m.kind] || "symbol"}) at ${args.file_path}:${m.position.line + 1}:${m.position.character + 1}:\n${lines.join("\n")}`
          );
        }
      }
      return {
        content: [
          {
            type: "text",
            text: blocks.length > 0 ? blocks.join("\n\n") : `Found ${matches.length} symbol(s) but no definitions returned.`,
          },
        ],
      };
    }

    case "find_references": {
      const absPath = resolve(args.file_path);
      const srv = getOrCreateInstance(absPath);
      await srv.syncFile(absPath);
      const matches = await resolveSymbolPositions(srv, absPath, args.symbol_name, args.symbol_kind, args.line);
      if (matches.length === 0) {
        return {
          content: [{ type: "text", text: `No symbols found with name "${args.symbol_name}" in ${args.file_path}.` }],
        };
      }
      const blocks = [];
      for (const m of matches) {
        const raw = await srv.sendRequest("textDocument/references", {
          textDocument: { uri: pathToUri(absPath) },
          position: m.position,
          context: { includeDeclaration: args.include_declaration !== false },
        });
        const locs = formatLocations(raw);
        if (locs.length > 0) {
          const lines = locs.map((l) => `${uriToPath(l.uri)}:${l.range.start.line + 1}:${l.range.start.character + 1}`);
          blocks.push(
            `Results for ${m.name} (${SYMBOL_KIND_NAMES[m.kind] || "symbol"}) at ${args.file_path}:${m.position.line + 1}:${m.position.character + 1}:\n${lines.join("\n")}`
          );
        }
      }
      return {
        content: [
          {
            type: "text",
            text: blocks.length > 0 ? blocks.join("\n\n") : `Found ${matches.length} symbol(s) but no references returned.`,
          },
        ],
      };
    }

    case "rename_symbol": {
      const absPath = resolve(args.file_path);
      const srv = getOrCreateInstance(absPath);
      await srv.syncFile(absPath);
      const matches = await resolveSymbolPositions(srv, absPath, args.symbol_name, args.symbol_kind, args.line);
      if (matches.length === 0) {
        return { content: [{ type: "text", text: `No symbols found with name "${args.symbol_name}" in ${args.file_path}.` }] };
      }
      if (matches.length > 1) {
        const list = matches
          .map((m) => `• ${m.name} (${SYMBOL_KIND_NAMES[m.kind] || "symbol"}) at ${m.position.line + 1}:${m.position.character + 1}`)
          .join("\n");
        return { content: [{ type: "text", text: `Multiple matches found; use rename_symbol_strict:\n${list}` }] };
      }
      const raw = await srv.sendRequest("textDocument/rename", {
        textDocument: { uri: pathToUri(absPath) },
        position: matches[0].position,
        newName: args.new_name,
      });
      return await applyWorkspaceRename(normalizeWorkspaceEdit(raw), Boolean(args.dry_run));
    }

    case "rename_symbol_strict": {
      const absPath = resolve(args.file_path);
      const srv = getOrCreateInstance(absPath);
      await srv.syncFile(absPath);
      const raw = await srv.sendRequest("textDocument/rename", {
        textDocument: { uri: pathToUri(absPath) },
        position: { line: args.line - 1, character: args.character - 1 },
        newName: args.new_name,
      });
      return await applyWorkspaceRename(normalizeWorkspaceEdit(raw), Boolean(args.dry_run));
    }

    case "get_hover": {
      const absPath = resolve(args.file_path);
      const srv = getOrCreateInstance(absPath);
      await srv.syncFile(absPath);
      const raw = await srv.sendRequest("textDocument/hover", {
        textDocument: { uri: pathToUri(absPath) },
        position: { line: args.line - 1, character: args.character - 1 },
      });
      if (!raw || !raw.contents) {
        return { content: [{ type: "text", text: `No hover information at ${args.file_path}:${args.line}:${args.character}` }] };
      }
      const text =
        typeof raw.contents === "string"
          ? raw.contents
          : Array.isArray(raw.contents)
          ? raw.contents.map((c) => (typeof c === "string" ? c : c.value)).join("\n\n")
          : raw.contents.value || JSON.stringify(raw.contents);
      return { content: [{ type: "text", text }] };
    }

    case "find_workspace_symbols": {
      const pool = worktreePools.get(DEFAULT_WORKTREE) || worktreePools.values().next().value;
      const instances = [];
      if (pool?.typescript) instances.push(pool.typescript);
      else instances.push(getOrCreateInstance(join(DEFAULT_WORKTREE, "frontend/shared/index.ts"), "typescript"));
      if (pool?.csharp) instances.push(pool.csharp);
      else instances.push(getOrCreateInstance(join(DEFAULT_WORKTREE, "backend/CogainSolution.sln"), "csharp"));

      const settled = await Promise.allSettled(
        instances.map(async (srv) => {
          await srv.start();
          const res = await srv.sendRequest("workspace/symbol", { query: args.query }, 15000);
          return Array.isArray(res) ? res : [];
        })
      );
      const all = [];
      for (const s of settled) {
        if (s.status === "fulfilled") all.push(...s.value);
      }
      if (all.length === 0) {
        return { content: [{ type: "text", text: `No symbols found matching "${args.query}".` }] };
      }
      const lines = all.slice(0, 80).map((sym) => {
        const loc = sym.location;
        const p = loc?.uri ? uriToPath(loc.uri) : "";
        const line = (loc?.range?.start?.line ?? 0) + 1;
        const ch = (loc?.range?.start?.character ?? 0) + 1;
        return `• ${sym.name} (${SYMBOL_KIND_NAMES[sym.kind] || "symbol"}) at ${p}:${line}:${ch}`;
      });
      return { content: [{ type: "text", text: `Found ${all.length} symbol(s):\n\n${lines.join("\n")}` }] };
    }

    case "find_implementation": {
      const absPath = resolve(args.file_path);
      const srv = getOrCreateInstance(absPath);
      await srv.syncFile(absPath);
      const raw = await srv.sendRequest("textDocument/implementation", {
        textDocument: { uri: pathToUri(absPath) },
        position: { line: args.line - 1, character: args.character - 1 },
      });
      const locs = formatLocations(raw);
      if (locs.length === 0) {
        return { content: [{ type: "text", text: `No implementations found at ${args.file_path}:${args.line}:${args.character}` }] };
      }
      const lines = locs.map((l) => `• ${uriToPath(l.uri)}:${l.range.start.line + 1}:${l.range.start.character + 1}`);
      return { content: [{ type: "text", text: `Found ${locs.length} implementation(s):\n\n${lines.join("\n")}` }] };
    }

    case "prepare_call_hierarchy": {
      const absPath = resolve(args.file_path);
      const srv = getOrCreateInstance(absPath);
      await srv.syncFile(absPath);
      const items = await srv.sendRequest("textDocument/prepareCallHierarchy", {
        textDocument: { uri: pathToUri(absPath) },
        position: { line: args.line - 1, character: args.character - 1 },
      });
      if (!Array.isArray(items) || items.length === 0) {
        return { content: [{ type: "text", text: `No call hierarchy item at ${args.file_path}:${args.line}:${args.character}` }] };
      }
      const lines = items.map(
        (item) =>
          `• ${item.name} (${SYMBOL_KIND_NAMES[item.kind] || "symbol"}) at ${uriToPath(item.uri)}:${item.selectionRange.start.line + 1}:${item.selectionRange.start.character + 1}`
      );
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }

    case "get_incoming_calls":
    case "get_outgoing_calls": {
      const absPath = resolve(args.file_path);
      const srv = getOrCreateInstance(absPath);
      await srv.syncFile(absPath);
      const items = await srv.sendRequest("textDocument/prepareCallHierarchy", {
        textDocument: { uri: pathToUri(absPath) },
        position: { line: args.line - 1, character: args.character - 1 },
      });
      if (!Array.isArray(items) || items.length === 0) {
        return { content: [{ type: "text", text: `No call hierarchy item at ${args.file_path}:${args.line}:${args.character}` }] };
      }
      const method = name === "get_incoming_calls" ? "callHierarchy/incomingCalls" : "callHierarchy/outgoingCalls";
      const out = [];
      for (const item of items) {
        const calls = await srv.sendRequest(method, { item });
        for (const c of Array.isArray(calls) ? calls : []) {
          const target = c.from || c.to;
          if (target) {
            out.push(
              `• ${target.name} (${SYMBOL_KIND_NAMES[target.kind] || "symbol"}) at ${uriToPath(target.uri)}:${target.selectionRange.start.line + 1}:${target.selectionRange.start.character + 1}`
            );
          }
        }
      }
      return { content: [{ type: "text", text: out.length > 0 ? out.join("\n") : "No calls found." }] };
    }

    case "restart_server": {
      const exts = Array.isArray(args.extensions) ? args.extensions.map((e) => e.toLowerCase()) : null;
      const restarted = [];
      for (const [root, pool] of worktreePools.entries()) {
        for (const lang of ["typescript", "csharp"]) {
          const srv = pool[lang];
          if (!srv) continue;
          const match =
            !exts ||
            exts.some((ext) => (lang === "typescript" ? TS_EXTS.has(ext) : CS_EXTS.has(ext)));
          if (match) {
            srv.dispose();
            pool[lang] = new LspInstance(lang, root);
            await pool[lang].start();
            restarted.push(`${lang}@${root}`);
          }
        }
      }
      return {
        content: [{ type: "text", text: restarted.length > 0 ? `Restarted: ${restarted.join(", ")}` : "No matching servers running." }],
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function checkFiles(files, maxSeverity = 1, timeoutMs = 2500) {
  const results = await Promise.all(
    (files || []).map(async (rawFile) => {
      const absPath = resolve(rawFile);
      const lang = getLangForFile(absPath);
      if (!lang) {
        return { file: absPath, diagnostics: [], timedOut: false, error: null };
      }
      try {
        const srv = getOrCreateInstance(absPath, lang);
        const rawDiags = await srv.getDiagnostics(absPath, timeoutMs);
        const filtered = rawDiags
          .filter((d) => (d.severity ?? 1) <= maxSeverity)
          .map((d) => ({
            line: (d.range?.start?.line ?? 0) + 1,
            character: (d.range?.start?.character ?? 0) + 1,
            severity: d.severity ?? 1,
            code: d.code ?? null,
            source: d.source ?? lang,
            message: d.message,
          }));
        return { file: absPath, diagnostics: filtered, timedOut: false, error: null };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const timedOut = /timeout|timed\s*out/i.test(msg);
        return { file: absPath, diagnostics: [], timedOut, error: timedOut ? null : msg };
      }
    })
  );
  const totalErrors = results.reduce((acc, r) => acc + r.diagnostics.length, 0);
  return { ok: true, totalErrors, results };
}

function readJsonBody(req) {
  return new Promise((resolveBody, rejectBody) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw.trim()) return resolveBody({});
      try {
        resolveBody(JSON.parse(raw));
      } catch (err) {
        rejectBody(err);
      }
    });
    req.on("error", rejectBody);
  });
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body, "utf8"),
  });
  res.end(body);
}

function createMcpServer() {
  const s = new Server(
    { name: "cogain-warm-lsp", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );
  s.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
  s.setRequestHandler(CallToolRequestSchema, async (req) => {
    try {
      return await executeTool(req.params.name, req.params.arguments || {});
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
      };
    }
  });
  return s;
}

let lastActivityAt = Date.now();

const httpServer = http.createServer(async (req, res) => {
  lastActivityAt = Date.now();
  const url = req.url?.split("?")[0] || "/";

  try {
    if (req.method === "GET" && url === "/health") {
      const worktrees = {};
      for (const [root, pool] of worktreePools.entries()) {
        worktrees[root] = {
          typescript: pool.typescript
            ? { ready: pool.typescript.ready, warmupComplete: pool.typescript.warmupComplete, openDocs: pool.typescript.openDocs.size }
            : null,
          csharp: pool.csharp
            ? { ready: pool.csharp.ready, warmupComplete: pool.csharp.warmupComplete, openDocs: pool.csharp.openDocs.size }
            : null,
        };
      }
      return sendJson(res, 200, {
        ok: true,
        pid: process.pid,
        port: PORT,
        hookSocket: existsSync(HOOK_SOCKET_FILE),
        uptimeSec: Math.round(process.uptime()),
        worktrees,
      });
    }

    if (req.method === "POST" && url === "/tool") {
      const body = await readJsonBody(req);
      const result = await executeTool(body.name, body.arguments || {});
      return sendJson(res, 200, { ok: true, result });
    }

    if (req.method === "POST" && url === "/check") {
      const body = await readJsonBody(req);
      const checkRes = await checkFiles(body.files || [], body.maxSeverity ?? 1, body.timeoutMs ?? 2500);
      return sendJson(res, 200, checkRes);
    }

    if (req.method === "POST" && url === "/warmup") {
      const body = await readJsonBody(req);
      const root = body.root ? resolve(body.root) : DEFAULT_WORKTREE;
      const tsSrv = getOrCreateInstance(join(root, "frontend/shared/index.ts"), "typescript");
      const csSrv = getOrCreateInstance(join(root, "backend/CogainSolution.sln"), "csharp");
      await Promise.allSettled([tsSrv.start(), csSrv.start()]);
      // Touch 1 real C# file if exists so csharp-ls completes solution warmup
      const probeCs = join(root, "backend/src/Services/ERP/ERP.API/Program.cs");
      if (existsSync(probeCs) && !csSrv.warmupComplete) {
        await csSrv.getDiagnostics(probeCs, 45000).catch(() => {});
      }
      return sendJson(res, 200, {
        ok: true,
        root,
        typescript: { ready: tsSrv.ready, warmupComplete: tsSrv.warmupComplete },
        csharp: { ready: csSrv.ready, warmupComplete: csSrv.warmupComplete },
      });
    }

    if (url === "/mcp") {
      const parsedBody = req.method === "POST" ? await readJsonBody(req) : undefined;
      const mcpServer = createMcpServer();
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      res.on("close", () => {
        transport.close().catch(() => {});
        mcpServer.close().catch(() => {});
      });
      await mcpServer.connect(transport);
      await transport.handleRequest(req, res, parsedBody);
      return;
    }

    sendJson(res, 404, { ok: false, error: "Not found" });
  } catch (err) {
    if (!res.headersSent) {
      sendJson(res, 500, { ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }
});

// Reap idle secondary worktrees & exit if completely unused
setInterval(() => {
  const now = Date.now();
  for (const [root, pool] of worktreePools.entries()) {
    if (root === DEFAULT_WORKTREE) continue;
    if (now - pool.lastUsedAt > SECONDARY_WORKTREE_IDLE_MS) {
      pool.typescript?.dispose();
      pool.csharp?.dispose();
      worktreePools.delete(root);
    }
  }
  if (now - lastActivityAt > DAEMON_IDLE_MS) {
    for (const pool of worktreePools.values()) {
      pool.typescript?.dispose();
      pool.csharp?.dispose();
    }
    process.exit(0);
  }
}, 60 * 1000).unref();

const evaluatorCache = new Map();

function findAgyRepoRoot(startDir) {
  if (!startDir || typeof startDir !== "string") return null;
  for (let dir = resolve(startDir); ; dir = dirname(dir)) {
    if (existsSync(join(dir, ".agent", "harness", "agy", "hook-evaluator.mjs"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
  }
}

async function loadHookEvaluator(root) {
  const evalPath = join(root, ".agent", "harness", "agy", "hook-evaluator.mjs");
  if (!existsSync(evalPath)) return null;
  const st = statSync(evalPath);
  const cached = evaluatorCache.get(evalPath);
  if (cached && cached.mtimeMs === st.mtimeMs) return cached.mod;
  const mod = await import(`${pathToFileURL(evalPath).href}?v=${Math.round(st.mtimeMs)}`);
  if (evaluatorCache.size >= 32) {
    const oldest = evaluatorCache.keys().next().value;
    if (oldest !== undefined) evaluatorCache.delete(oldest);
  }
  evaluatorCache.set(evalPath, { mtimeMs: st.mtimeMs, mod });
  return mod;
}

const hookServer = net.createServer({ allowHalfOpen: true }, (socket) => {
  lastActivityAt = Date.now();
  const chunks = [];
  let totalBytes = 0;
  let aborted = false;

  socket.on("data", (chunk) => {
    totalBytes += chunk.length;
    if (totalBytes > 8 * 1024 * 1024) {
      aborted = true;
      socket.end('{"decision":"allow"}\n');
      return;
    }
    chunks.push(chunk);
  });

  socket.on("end", async () => {
    if (aborted) return;
    let mode = "pre";
    let callerCwd = "";
    let eventObj = {};
    try {
      const rawBuf = Buffer.concat(chunks, totalBytes);
      const nlIdx = rawBuf.indexOf(10);
      const header = nlIdx >= 0 ? rawBuf.subarray(0, nlIdx).toString("utf8") : "";
      const bodyStr = nlIdx >= 0 ? rawBuf.subarray(nlIdx + 1).toString("utf8") : rawBuf.toString("utf8");
      const tabIdx = header.indexOf("\t");
      mode = tabIdx >= 0 ? header.slice(0, tabIdx) : header || "pre";
      callerCwd = tabIdx >= 0 ? header.slice(tabIdx + 1) : "";
      if (bodyStr.trim()) {
        const parsed = JSON.parse(bodyStr);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) eventObj = parsed;
      }

      const workspaceFirst = Array.isArray(eventObj.workspacePaths) ? eventObj.workspacePaths[0] : null;
      const root =
        findAgyRepoRoot(eventObj.cwd) ||
        findAgyRepoRoot(workspaceFirst) ||
        findAgyRepoRoot(callerCwd) ||
        findAgyRepoRoot(DEFAULT_WORKTREE);

      let result = mode === "pre" ? { decision: "allow" } : eventObj.hookEventName === "Stop" ? { decision: "allow" } : {};
      if (root) {
        const mod = await loadHookEvaluator(root);
        if (mod) {
          result =
            mode === "pre"
              ? await mod.evaluateAgyPreToolUse(eventObj, { callerCwd })
              : await mod.evaluateAgyLifecycle(eventObj, { callerCwd });
        }
      }
      socket.end(`${JSON.stringify(result)}\n`);
    } catch {
      const fallback = mode === "pre" ? '{"decision":"allow"}\n' : eventObj.hookEventName === "Stop" ? '{"decision":"allow"}\n' : "{}\n";
      socket.end(fallback);
    }
  });

  socket.on("error", () => {});
});

function shutdown() {
  for (const pool of worktreePools.values()) {
    pool.typescript?.dispose();
    pool.csharp?.dispose();
  }
  try {
    if (existsSync(HOOK_SOCKET_FILE)) unlinkSync(HOOK_SOCKET_FILE);
  } catch {
    /* ignore */
  }
  hookServer.close(() => {});
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 500).unref();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

httpServer.on("error", (err) => {
  if (err?.code === "EADDRINUSE") process.exit(0);
});

httpServer.listen(PORT, "127.0.0.1", () => {
  mkdirSync(HERE, { recursive: true });
  writeFileSync(
    DAEMON_INFO_FILE,
    JSON.stringify({ pid: process.pid, port: PORT, hookSocket: HOOK_SOCKET_FILE, startedAt: new Date().toISOString() }, null, 2)
  );
  mkdirSync(dirname(HOOK_SOCKET_FILE), { recursive: true });
  try {
    if (existsSync(HOOK_SOCKET_FILE)) unlinkSync(HOOK_SOCKET_FILE);
  } catch {
    /* ignore */
  }
  hookServer.listen(HOOK_SOCKET_FILE, () => {
    try {
      chmodSync(HOOK_SOCKET_FILE, 0o600);
    } catch {
      /* ignore */
    }
  });
  // Pre-warm default workspace in background
  if (existsSync(DEFAULT_WORKTREE)) {
    if (existsSync(join(DEFAULT_WORKTREE, "frontend")) || existsSync(join(DEFAULT_WORKTREE, "tsconfig.json"))) {
      const tsSrv = getOrCreateInstance(join(DEFAULT_WORKTREE, "frontend/shared/index.ts"), "typescript");
      tsSrv.start().catch(() => {});
    }
    if (existsSync(join(DEFAULT_WORKTREE, "backend"))) {
      const csSrv = getOrCreateInstance(join(DEFAULT_WORKTREE, "backend/CogainSolution.sln"), "csharp");
      csSrv.start().then(() => {
        const probeCs = join(DEFAULT_WORKTREE, "backend/src/Services/ERP/ERP.API/Program.cs");
        if (existsSync(probeCs) && !csSrv.warmupComplete) {
          return csSrv.getDiagnostics(probeCs, 45000);
        }
      }).catch(() => {});
    }
  }
});
