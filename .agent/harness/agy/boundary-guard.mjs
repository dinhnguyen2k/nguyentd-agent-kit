#!/usr/bin/env node
/**
 * Nối Antigravity (AGY) `PreToolUse` vào `.agent/scripts/agent-boundary-guard.mjs`.
 * Nguồn luật duy nhất nằm ở `.agent/contracts/agent-registry.json`.
 * File này dịch payload stdin của AGY (`toolCall.name`, `toolCall.args`) sang
 * định dạng `Bash` / `Write` rồi trả `{"decision": "allow" | "deny"}`.
 * Fail-open có chủ đích: lỗi của chính hook không được chặn tool.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const GUARD_REL = join(".agent", "scripts", "agent-boundary-guard.mjs");
const URL_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;
const WRITE_TOOLS = new Set([
  "write_file",
  "edit_file",
  "write_to_file",
  "replace_file_content",
  "multi_replace_file_content",
  "create_file",
  "delete_file",
  "edit",
  "write",
  "notebook_edit",
]);
const MCP_FS_WRITE_TOOLS = new Set([
  "write_file",
  "append_file",
  "edit_file",
  "move_file",
  "create_directory",
]);
const MCP_FS_TOOL_RE = /^mcp_+filesystem_(write_file|append_file|edit_file|move_file|create_directory)$/;
const EVAL_WRITE_PATTERNS = [
  /\bwrite\(\s*["'`]([^"'`]+)["'`]/g,
  /\bBun\.write\(\s*["'`]([^"'`]+)["'`]/g,
  /\bwriteFileSync\(\s*["'`]([^"'`]+)["'`]/g,
  /\bopen\(\s*["']([^"']+)["']\s*,\s*["'][wax]/g,
  /\bPath\(\s*["']([^"']+)["']\s*\)\.write_(?:text|bytes)\(/g,
];
const EVAL_SPAWNS_PROCESS = /\bsubprocess\b|\bos\.system\b|\bBun\.\$|\$`|\bspawn(?:Sync)?\(|\bexec(?:Sync)?\(|\btool\.bash\b/;

function allow() {
  process.stdout.write('{"decision":"allow"}\n');
  process.exit(0);
}

function deny(reason) {
  process.stdout.write(`${JSON.stringify({ decision: "deny", reason: `[boundary-guard] ${reason}` })}\n`);
  process.exit(0);
}

function str(value) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function parseJsonObject(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function findRepoRoot(start) {
  if (!start || typeof start !== "string") return null;
  for (let dir = resolve(start); ; dir = dirname(dir)) {
    if (existsSync(join(dir, GUARD_REL))) return dir;
    if (dirname(dir) === dir) return null;
  }
}

function isInsideDir(targetPath, dirPath) {
  if (!targetPath || !dirPath) return false;
  const rel = relative(resolve(dirPath), resolve(targetPath));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function argPaths(args) {
  const single = ["Path", "TargetFile", "file_path", "path", "notebook_path", "source", "destination"].map(
    (k) => str(args[k])
  );
  const many = Array.isArray(args.paths) ? args.paths.map(str) : [];
  return [...single, ...many].filter((p) => p !== null);
}

function extractNewContent(args) {
  return (
    str(args.Content) ??
    str(args.Replacement) ??
    str(args.ReplacementContent) ??
    str(args.new_string) ??
    str(args.content) ??
    (Array.isArray(args.ReplacementChunks)
      ? args.ReplacementChunks.map((c) => str(c?.ReplacementContent) ?? "").join("\n") || null
      : null)
  );
}

function toWriteChecks(paths, newContent = null) {
  return [...new Set(paths)]
    .filter((p) => !URL_SCHEME.test(p))
    .map((p) => ({
      tool_name: "Write",
      tool_input: { file_path: p, ...(newContent ? { new_content: newContent } : {}) },
    }));
}

function readWorkflowScript(args, baseCwd) {
  const inline = str(args.Script) ?? str(args.code) ?? "";
  const scriptPath = str(args.ScriptPath);
  if (!scriptPath) return inline;
  try {
    const resolved = isAbsolute(scriptPath) ? scriptPath : resolve(baseCwd, scriptPath);
    if (existsSync(resolved)) return `${inline}\n${readFileSync(resolved, "utf8")}`;
  } catch {
    /* ignore unreadable script path */
  }
  return inline;
}

function toChecks(toolName, args, baseCwd) {
  if (toolName === "run_command" || toolName === "bash") {
    const command = str(args.CommandLine) ?? str(args.command);
    return command ? [{ tool_name: "Bash", tool_input: { command } }] : [];
  }
  if (WRITE_TOOLS.has(toolName)) {
    return toWriteChecks(argPaths(args), extractNewContent(args));
  }
  if (toolName === "call_mcp_tool") {
    const server = str(args.ServerName) ?? str(args.serverName) ?? str(args.server_name);
    const mcpTool = str(args.ToolName) ?? str(args.toolName) ?? str(args.tool_name);
    if (server === "filesystem" && mcpTool && MCP_FS_WRITE_TOOLS.has(mcpTool)) {
      const mcpArgs = parseJsonObject(args.Arguments ?? args.arguments);
      return toWriteChecks(argPaths(mcpArgs), extractNewContent(mcpArgs));
    }
    return [];
  }
  if (MCP_FS_TOOL_RE.test(toolName)) {
    return toWriteChecks(argPaths(args), extractNewContent(args));
  }
  if (toolName === "run_workflow" || toolName === "eval") {
    const code = readWorkflowScript(args, baseCwd);
    if (!code) return [];
    const foundPaths = EVAL_WRITE_PATTERNS.flatMap((p) => [...code.matchAll(p)].map((m) => m[1].trim()));
    const checks = toWriteChecks(foundPaths);
    if (EVAL_SPAWNS_PROCESS.test(code)) {
      checks.push({ tool_name: "Bash", tool_input: { command: code.replace(/["'`]/g, " ") } });
    }
    return checks;
  }
  return [];
}

function denyReason(root, check, agentName) {
  const payload = { ...check, ...(agentName ? { agent_name: agentName } : {}) };
  const run = spawnSync(process.execPath, [join(root, GUARD_REL)], {
    cwd: root,
    input: JSON.stringify(payload),
    encoding: "utf8",
    timeout: 10_000,
  });
  if (run.error || run.status !== 0 || !run.stdout.trim()) return null;
  const out = parseJsonObject(run.stdout).hookSpecificOutput;
  return out && out.permissionDecision === "deny"
    ? String(out.permissionDecisionReason ?? "blocked by boundary-guard")
    : null;
}

try {
  const raw = readFileSync(0, "utf8");
  if (!raw.trim()) allow();
  const event = parseJsonObject(raw);
  const workspaceFirst = Array.isArray(event.workspacePaths) ? str(event.workspacePaths[0]) : null;
  const root = findRepoRoot(str(event.cwd)) ?? findRepoRoot(workspaceFirst) ?? findRepoRoot(HERE);
  if (!root) allow();

  const toolCall = parseJsonObject(event.toolCall);
  const toolName = (str(toolCall.name) ?? "").toLowerCase();
  const args = parseJsonObject(toolCall.args);
  const baseCwd = str(event.cwd) ?? workspaceFirst ?? root;
  const artifactDir = str(event.artifactDirectoryPath);
  const skipArtifactDir = artifactDir && !isInsideDir(artifactDir, root) ? artifactDir : null;

  const checks = toChecks(toolName, args, baseCwd).flatMap((check) => {
    if (!check.tool_input.file_path) return [check];
    const resolved = isAbsolute(check.tool_input.file_path)
      ? resolve(check.tool_input.file_path)
      : resolve(baseCwd, check.tool_input.file_path);
    if (skipArtifactDir && isInsideDir(resolved, skipArtifactDir)) return [];
    return [{ ...check, tool_input: { ...check.tool_input, file_path: resolved } }];
  });

  if (checks.length === 0) allow();

  const agentName =
    str(event.agentName) ??
    str(event.agentType) ??
    str(event.subagentType) ??
    str(parseJsonObject(event.agent).name);

  for (const check of checks) {
    const reason = denyReason(root, check, agentName);
    if (reason) deny(reason);
  }
} catch {
  // Fail-open có chủ đích, khớp `fail_mode: open-on-crash` trong agent-registry.json.
}

allow();
