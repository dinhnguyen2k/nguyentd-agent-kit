#!/usr/bin/env node
/**
 * Lõi chuẩn hóa đa-harness & đa-LLM (Node ESM thuần, 0 dependency ngoài).
 * - Tách bản vá `apply_patch` (V4A) và unified diff theo từng tệp độc lập.
 * - Chuẩn hóa tool call của Claude Code, Codex CLI, OMP, AGY sang check của `evaluateBoundaryChecks`.
 * - Quản lý workflow-state nhẹ theo phiên và hỗ trợ CLI `--check-staged`.
 */
import { execFileSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateBoundaryChecks } from "./agent-boundary-guard.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const GUARD_REL = join(".agent", "scripts", "agent-boundary-guard.mjs");
const WORKFLOW_STATE_REL = join(".agent", "scratch", ".runtime", "workflow-state");
const LSP_CIRCUIT_REL = join(".agent", "scratch", ".runtime", "lsp-circuit.json");
const LSP_FRICTION_REL = join(".agent", "reports", "agent-friction.jsonl");
export const LSP_CIRCUIT_TTL_MS = 4 * 60 * 1000;
const LSP_PROBE_TIMEOUT_MS = 30 * 1000;
const STATE_TTL_MS = 24 * 60 * 60 * 1000;
export const CONTINUATION_MAX_NO_PROGRESS = 2;
export const CONTINUATION_MAX_ERROR_STREAK = 3;
export const CONTINUATION_MAX_PER_TURN = 20;
const INFRA_ERROR_STREAK_RE =
  /\b(429|rate[_\s-]?limit|insufficient[_\s-]?quota|quota\s+exceeded|overloaded|503\s+service|502\s+bad\s+gateway|econnreset|socket\s+hang\s+up|upstream\s+connect\s+error)\b/i;
const USER_STOP_INTENT_RE =
  /^\s*(?:dừng|stop|thôi|cancel|pause|nghỉ|abort)\s*[.!?]*\s*$|(?:\b(?:dừng\s+lại|tạm\s+dừng|dừng\s+phiên|nên\s+dừng|hủy\s+phiên|stop\s+now|cancel\s+run|abort\s+run)\b)/i;
const RED_ZONE_ALL_BLOCKED_RE =
  /Hộp\s+thư\s+Quyết\s+định[\s\S]{0,600}(?:không\s+còn\s+nhánh\s+độc\s+lập|toàn\s+bộ\s+nhánh\s+còn\s+lại|mọi\s+nhánh\s+còn\s+lại\s+đều\s+vướng|tất\s+cả\s+hạng\s+mục\s+còn\s+lại\s+đều\s+cần)/i;
const URL_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;
const CODE_FILE_RE = /\.(?:cs|ts|tsx)$/i;
const CSHARP_PATH_RE = /\.(?:cs|sln|csproj)$/i;
const TS_PATH_RE = /\.(?:ts|tsx|js|jsx)$/i;
const LSP_FAILURE_RE =
  /\b(timed?\s*out|timeout|deadline\s*exceeded|connection\s*closed|eof|server\s*not\s*initialized|not\s*ready|transport\s*error|broken\s*pipe)\b/i;
const SHELL_TOOLS = new Set(["Bash", "bash", "run_command", "shell", "exec_command"]);
const FILE_TOOLS = new Set([
  "Edit",
  "Write",
  "MultiEdit",
  "NotebookEdit",
  "edit",
  "write",
  "apply_patch",
  "functions.apply_patch",
  "write_file",
  "edit_file",
  "replace_file_content",
  "multi_replace_file_content",
  "write_to_file",
  "create_file",
  "delete_file",
  "notebook_edit",
  "ast_edit",
]);
const PATCH_TOOLS = new Set(["apply_patch", "functions.apply_patch", "edit", "Edit"]);
const MCP_FS_WRITE_RE = /^mcp_+filesystem_+(write_file|append_file|edit_file|move_file|create_directory)$/;
const MCP_FS_WRITE_METHODS = new Set(["write_file", "append_file", "edit_file", "move_file", "create_directory"]);
const EVAL_WRITE_PATTERNS = [
  /\bwrite\(\s*["'`]([^"'`]+)["'`]/g,
  /\bBun\.write\(\s*["'`]([^"'`]+)["'`]/g,
  /\bwriteFileSync\(\s*["'`]([^"'`]+)["'`]/g,
  /\bopen\(\s*["']([^"']+)["']\s*,\s*["'][wax]/g,
  /\bPath\(\s*["']([^"']+)["']\s*\)\.write_(?:text|bytes)\(/g,
];
const EVAL_SPAWNS_PROCESS = /\bsubprocess\b|\bos\.system\b|\bBun\.\$|\$`|\bspawn(?:Sync)?\(|\bexec(?:Sync)?\(|\btool\.bash\b/;

function str(value) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function cleanPathToken(raw) {
  if (!raw) return null;
  let cleaned = String(raw).trim();
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1);
  }
  cleaned = cleaned.replace(/\t.*$/, "").trim();
  if (!cleaned || cleaned === "/dev/null") return null;
  return cleaned;
}

function stripDiffPrefix(raw, prefix) {
  const cleaned = cleanPathToken(raw);
  if (!cleaned) return null;
  if (cleaned.startsWith(prefix)) return cleaned.slice(prefix.length);
  return cleaned;
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

export function findRepoRoot(start) {
  if (!start || typeof start !== "string") return null;
  try {
    for (let dir = resolve(start); ; dir = dirname(dir)) {
      if (existsSync(join(dir, GUARD_REL))) return dir;
      if (dirname(dir) === dir) return null;
    }
  } catch {
    return null;
  }
}

/**
 * Tách bản vá `apply_patch` V4A (`*** Add/Update/Delete File`, `*** Move to`) hoặc unified diff (`+++ b/<p>`)
 * thành danh sách check độc lập theo từng tệp; mỗi tệp chỉ giữ đúng dòng `+` của chính nó.
 */
export function splitApplyPatchIntoFileChecks(patchText) {
  if (typeof patchText !== "string" || !patchText.trim()) return [];
  const lines = patchText.replace(/\r\n/g, "\n").split("\n");
  const checks = [];

  const hasV4A = lines.some((l) => /^\*\*\* (?:Add|Update|Delete) File:\s*\S/.test(l));
  if (hasV4A) {
    let current = null;
    const flushV4A = () => {
      if (!current) return;
      if (current.moveTo && current.moveTo !== current.path) {
        checks.push({ tool_name: "Write", tool_input: { file_path: current.path, new_content: "" } });
        checks.push({
          tool_name: "Write",
          tool_input: { file_path: current.moveTo, new_content: current.added.join("\n") },
        });
      } else {
        checks.push({
          tool_name: "Write",
          tool_input: { file_path: current.path, new_content: current.added.join("\n") },
        });
      }
      current = null;
    };

    for (const line of lines) {
      const fileMatch = line.match(/^\*\*\* (Add|Update|Delete) File:\s*(.+)$/);
      if (fileMatch) {
        flushV4A();
        const filePath = cleanPathToken(fileMatch[2]);
        if (filePath && !URL_SCHEME.test(filePath)) {
          current = { path: filePath, moveTo: null, added: [] };
        }
        continue;
      }
      const moveMatch = line.match(/^\*\*\* Move to:\s*(.+)$/);
      if (moveMatch && current) {
        const dest = cleanPathToken(moveMatch[1]);
        if (dest && !URL_SCHEME.test(dest)) current.moveTo = dest;
        continue;
      }
      if (line === "*** End Patch") {
        flushV4A();
        continue;
      }
      if (line === "*** End of File" || line === "*** Begin Patch") continue;
      if (current && line.startsWith("+") && !/^\+\+\+\s/.test(line)) {
        current.added.push(line.slice(1));
      }
    }
    flushV4A();
    return checks;
  }

  let current = null;
  let inHunk = false;
  const flushDiff = () => {
    if (!current) return;
    if (current.oldPath && current.oldPath !== current.path) {
      checks.push({ tool_name: "Write", tool_input: { file_path: current.oldPath, new_content: "" } });
    }
    if (current.path) {
      checks.push({
        tool_name: "Write",
        tool_input: { file_path: current.path, new_content: current.added.join("\n") },
      });
    }
    current = null;
    inHunk = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("diff --git ")) {
      flushDiff();
      const gitMatch = line.match(/^diff --git\s+(?:"a\/([^"]+)"|a\/(\S+))\s+(?:"b\/([^"]+)"|b\/(\S+))/);
      if (gitMatch) {
        const oldPath = cleanPathToken(gitMatch[1] ?? gitMatch[2]);
        const newPath = cleanPathToken(gitMatch[3] ?? gitMatch[4]);
        current = {
          path: newPath || oldPath,
          oldPath: oldPath && newPath && oldPath !== newPath ? oldPath : null,
          added: [],
          hasHeaderPair: false,
        };
      }
      inHunk = false;
      continue;
    }
    if (current && !inHunk && line.startsWith("rename from ")) {
      const fromPath = cleanPathToken(line.slice("rename from ".length));
      if (fromPath) current.oldPath = fromPath;
      continue;
    }
    if (current && !inHunk && line.startsWith("rename to ")) {
      const toPath = cleanPathToken(line.slice("rename to ".length));
      if (toPath) current.path = toPath;
      continue;
    }
    if (line.startsWith("--- ") && i + 1 < lines.length && lines[i + 1].startsWith("+++ ")) {
      const oldPath = stripDiffPrefix(line.slice(4), "a/");
      const newPath = stripDiffPrefix(lines[i + 1].slice(4), "b/");
      if (!current || current.hasHeaderPair) {
        flushDiff();
        current = { path: null, oldPath: null, added: [], hasHeaderPair: true };
      } else {
        current.hasHeaderPair = true;
      }
      current.path = newPath ?? oldPath;
      current.oldPath = oldPath && newPath && oldPath !== newPath ? oldPath : current.oldPath;
      inHunk = false;
      i++;
      continue;
    }
    if (!current && /^\+\+\+\s+b\/(.+)$/.test(line)) {
      const p = stripDiffPrefix(line.slice(4), "b/");
      if (p) current = { path: p, oldPath: null, added: [], hasHeaderPair: true };
      inHunk = false;
      continue;
    }
    if (current && line.startsWith("@@ ")) {
      inHunk = true;
      continue;
    }
    if (current) {
      if (inHunk && line.startsWith("+")) {
        current.added.push(line.slice(1));
      } else if (!inHunk && line.startsWith("+") && !/^\+\+\+\s/.test(line)) {
        current.added.push(line.slice(1));
      }
    }
  }
  flushDiff();

  return checks.filter((c) => c.tool_input.file_path && !URL_SCHEME.test(c.tool_input.file_path));
}

function argPaths(args) {
  const single = [
    "file_path",
    "path",
    "notebook_path",
    "Path",
    "TargetFile",
    "filePath",
    "target_file",
    "source",
    "destination",
    "uri",
  ].map((k) => str(args[k]));
  const many = Array.isArray(args.paths) ? args.paths.map(str) : [];
  return [...new Set([...single, ...many].filter((p) => p !== null))];
}

function extractWrittenContent(args) {
  return (
    str(args.new_content) ??
    str(args.new_string) ??
    str(args.newText) ??
    str(args.Content) ??
    str(args.Replacement) ??
    str(args.ReplacementContent) ??
    (Array.isArray(args.edits)
      ? args.edits.map((e) => str(e?.new_string) ?? str(e?.newText) ?? str(e?.new_content) ?? "").join("\n") || null
      : null) ??
    (Array.isArray(args.ReplacementChunks)
      ? args.ReplacementChunks.map((c) => str(c?.ReplacementContent) ?? "").join("\n") || null
      : null) ??
    str(args.content)
  );
}

function extractShellCommand(args) {
  if (typeof args === "string") return args.trim() || null;
  for (const key of ["command", "CommandLine", "cmd"]) {
    const val = args[key];
    if (typeof val === "string" && val.trim()) return val.trim();
    if (Array.isArray(val) && val.length > 0) {
      const joined = val.map((item) => String(item ?? "")).join(" ").trim();
      if (joined) return joined;
    }
  }
  return null;
}

function toWriteChecks(paths, newContent = null) {
  return [...new Set(paths)]
    .filter((p) => !URL_SCHEME.test(p))
    .map((p) => ({
      tool_name: "Write",
      tool_input: { file_path: p, ...(newContent ? { new_content: newContent } : {}) },
    }));
}

function resolveChecksBaseCwd(checks, baseCwd) {
  if (!baseCwd) return checks;
  return checks.map((check) => {
    const p = check.tool_input?.file_path;
    if (!p || isAbsolute(p)) return check;
    const cleaned = p.startsWith("file://") ? p.slice(7) : p;
    const abs = isAbsolute(cleaned) ? resolve(cleaned) : resolve(baseCwd, cleaned);
    return { ...check, tool_input: { ...check.tool_input, file_path: abs } };
  });
}

function readWorkflowScript(args, baseCwd) {
  const inline = str(args.Script) ?? str(args.code) ?? "";
  const scriptPath = str(args.ScriptPath);
  if (!scriptPath) return inline;
  try {
    const resolved = isAbsolute(scriptPath) ? scriptPath : resolve(baseCwd || process.cwd(), scriptPath);
    if (existsSync(resolved)) return `${inline}\n${readFileSync(resolved, "utf8")}`;
  } catch {
    /* bỏ qua nếu không đọc được file script */
  }
  return inline;
}

/**
 * Chuẩn hóa payload tool call của mọi harness/LLM sang check của `evaluateBoundaryChecks`.
 */
export function normalizeToolChecks(toolName, input, baseCwd = null) {
  const name = String(toolName || "").trim();
  if (!name) return [];
  const args = typeof input === "string" ? { patch: input, input } : parseJsonObject(input);

  if (SHELL_TOOLS.has(name)) {
    const command = extractShellCommand(typeof input === "string" ? input : args);
    return command ? [{ tool_name: "Bash", tool_input: { command } }] : [];
  }

  if (PATCH_TOOLS.has(name)) {
    const patchCandidate =
      str(args.patch) ??
      str(args.diff) ??
      str(args.input) ??
      str(args.raw_input) ??
      Object.values(args).filter((v) => typeof v === "string").join("\n");
    const split = splitApplyPatchIntoFileChecks(patchCandidate);
    if (split.length > 0) {
      const covered = new Set(split.map((c) => c.tool_input.file_path));
      const extraPaths = argPaths(args).filter((p) => !covered.has(p));
      return resolveChecksBaseCwd([...split, ...toWriteChecks(extraPaths)], baseCwd);
    }
  }

  if (name === "write" && str(args.path)?.startsWith("xd://")) {
    const device = args.path.match(/^xd:\/\/([\w-]+)/)?.[1] || "";
    if (device === "ast_edit" || MCP_FS_WRITE_RE.test(device)) {
      const mcpArgs = parseJsonObject(args.content);
      return resolveChecksBaseCwd(toWriteChecks(argPaths(mcpArgs), extractWrittenContent(mcpArgs)), baseCwd);
    }
    return [];
  }

  if (FILE_TOOLS.has(name) || MCP_FS_WRITE_RE.test(name)) {
    const checks = toWriteChecks(argPaths(args), extractWrittenContent(args));
    return resolveChecksBaseCwd(checks, baseCwd);
  }

  if (name === "call_mcp_tool") {
    const server = str(args.ServerName) ?? str(args.serverName) ?? str(args.server_name);
    const mcpTool = str(args.ToolName) ?? str(args.toolName) ?? str(args.tool_name);
    if (server === "filesystem" && mcpTool && MCP_FS_WRITE_METHODS.has(mcpTool)) {
      const mcpArgs = parseJsonObject(args.Arguments ?? args.arguments);
      return resolveChecksBaseCwd(toWriteChecks(argPaths(mcpArgs), extractWrittenContent(mcpArgs)), baseCwd);
    }
    return [];
  }

  if (name === "eval" || name === "run_workflow") {
    const code = readWorkflowScript(args, baseCwd);
    if (!code) return [];
    const foundPaths = EVAL_WRITE_PATTERNS.flatMap((p) => [...code.matchAll(p)].map((m) => m[1].trim()));
    const checks = resolveChecksBaseCwd(toWriteChecks(foundPaths), baseCwd);
    if (EVAL_SPAWNS_PROCESS.test(code)) {
      checks.push({ tool_name: "Bash", tool_input: { command: code.replace(/["'`]/g, " ") } });
    }
    return checks;
  }

  return [];
}

function stateFilePath(root, sessionId) {
  const safeId = String(sessionId || "default").replace(/[^a-zA-Z0-9._-]/g, "_") || "default";
  return join(root, WORKFLOW_STATE_REL, `${safeId}.json`);
}

function pruneExpiredStateFiles(stateDir, now) {
  try {
    if (!existsSync(stateDir)) return;
    for (const entry of readdirSync(stateDir)) {
      if (!entry.endsWith(".json")) continue;
      const fullPath = join(stateDir, entry);
      try {
        if (now - statSync(fullPath).mtimeMs > STATE_TTL_MS) unlinkSync(fullPath);
      } catch {
        /* bỏ qua lỗi từng file */
      }
    }
  } catch {
    /* fail-open */
  }
}

function normalizeContinuationState(raw) {
  const obj = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  return {
    armed: Boolean(obj.armed),
    tripped: Boolean(obj.tripped),
    planDir: typeof obj.planDir === "string" && obj.planDir ? obj.planDir : null,
    openTodoCount: Number.isInteger(obj.openTodoCount) && obj.openTodoCount >= 0 ? obj.openTodoCount : 0,
    completedTodoCount:
      Number.isInteger(obj.completedTodoCount) && obj.completedTodoCount >= 0 ? obj.completedTodoCount : 0,
    todoSample: Array.isArray(obj.todoSample) ? obj.todoSample.filter((x) => typeof x === "string").slice(0, 5) : [],
    completedSlices: Array.isArray(obj.completedSlices)
      ? obj.completedSlices.filter((x) => typeof x === "string").slice(-40)
      : [],
    autoContinueCount:
      Number.isInteger(obj.autoContinueCount) && obj.autoContinueCount >= 0 ? obj.autoContinueCount : 0,
    noProgressStreak: Number.isInteger(obj.noProgressStreak) && obj.noProgressStreak >= 0 ? obj.noProgressStreak : 0,
    errorStreak: Number.isInteger(obj.errorStreak) && obj.errorStreak >= 0 ? obj.errorStreak : 0,
    lastProgressHash: typeof obj.lastProgressHash === "string" ? obj.lastProgressHash : "",
  };
}

function loadSessionState(root, sessionId, now = Date.now(), opts = {}) {
  const empty = {
    version: 1,
    sessionId: String(sessionId || "default"),
    updatedAt: now,
    editedFiles: [],
    uncheckedFiles: [],
    dispatches: [],
    stopReminded: false,
    continuation: normalizeContinuationState(null),
  };
  try {
    const file = str(opts?.stateFile) || stateFilePath(root, sessionId);
    if (!existsSync(file)) return empty;
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    if (!parsed || typeof parsed !== "object") return empty;
    if (now - (parsed.updatedAt || 0) > STATE_TTL_MS) return empty;
    return {
      version: 1,
      sessionId: String(parsed.sessionId || sessionId || "default"),
      updatedAt: Number(parsed.updatedAt) || now,
      editedFiles: Array.isArray(parsed.editedFiles) ? parsed.editedFiles.filter((x) => typeof x === "string") : [],
      uncheckedFiles: Array.isArray(parsed.uncheckedFiles) ? parsed.uncheckedFiles.filter((x) => typeof x === "string") : [],
      dispatches: Array.isArray(parsed.dispatches) ? parsed.dispatches : [],
      stopReminded: Boolean(parsed.stopReminded),
      continuation: normalizeContinuationState(parsed.continuation),
    };
  } catch {
    return empty;
  }
}

function saveSessionState(root, sessionId, state, now = Date.now(), opts = {}) {
  try {
    const file = str(opts?.stateFile) || stateFilePath(root, sessionId);
    const dir = dirname(file);
    mkdirSync(dir, { recursive: true });
    if (!opts?.stateFile) pruneExpiredStateFiles(dir, now);
    state.updatedAt = now;
    writeFileSync(file, `${JSON.stringify(state, null, 2)}\n`);
  } catch {
    /* fail-open tuyệt đối */
  }
}

function toRepoRel(root, rawPath) {
  if (!rawPath || typeof rawPath !== "string") return null;
  const cleaned = rawPath.startsWith("file://") ? rawPath.slice(7) : rawPath;
  const abs = isAbsolute(cleaned) ? resolve(cleaned) : resolve(root, cleaned);
  const rel = relative(resolve(root), abs).replace(/\\/g, "/");
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) return null;
  return rel;
}

export function recordSessionEdit(root, sessionId, filePaths) {
  try {
    if (!root || !sessionId) return;
    const list = Array.isArray(filePaths) ? filePaths : [filePaths];
    const codeFiles = list.map((p) => toRepoRel(root, p)).filter((p) => p && CODE_FILE_RE.test(p));
    if (codeFiles.length === 0) return;

    const now = Date.now();
    const state = loadSessionState(root, sessionId, now);
    for (const rel of codeFiles) {
      if (!state.editedFiles.includes(rel)) state.editedFiles.push(rel);
      if (!state.uncheckedFiles.includes(rel)) state.uncheckedFiles.push(rel);
    }
    state.editedFiles = state.editedFiles.slice(-60);
    state.uncheckedFiles = state.uncheckedFiles.slice(-60);
    state.stopReminded = false;
    saveSessionState(root, sessionId, state, now);
  } catch {
    /* fail-open */
  }
}

export function markSessionFilesChecked(root, sessionId, filePaths = null) {
  try {
    if (!root || !sessionId) return;
    const now = Date.now();
    const state = loadSessionState(root, sessionId, now);
    if (state.uncheckedFiles.length === 0) return;
    if (!filePaths) {
      state.uncheckedFiles = [];
    } else {
      const checked = (Array.isArray(filePaths) ? filePaths : [filePaths])
        .map((p) => toRepoRel(root, p))
        .filter(Boolean);
      if (checked.length === 0) return;
      state.uncheckedFiles = state.uncheckedFiles.filter(
        (f) => !checked.some((c) => f === c || f.startsWith(c.endsWith("/") ? c : `${c}/`))
      );
    }
    saveSessionState(root, sessionId, state, now);
  } catch {
    /* fail-open */
  }
}

export function recordSessionDispatch(root, sessionId, dispatchInfo) {
  try {
    if (!root || !sessionId || !dispatchInfo) return;
    const now = Date.now();
    const state = loadSessionState(root, sessionId, now);
    const entry =
      typeof dispatchInfo === "string"
        ? { summary: dispatchInfo.slice(0, 160), at: now }
        : {
            agentType: str(dispatchInfo.agentType),
            contractRef: str(dispatchInfo.contractRef),
            summary: str(dispatchInfo.summary)?.slice(0, 160) ?? null,
            at: now,
          };
    state.dispatches.push(entry);
    state.dispatches = state.dispatches.slice(-20);
    saveSessionState(root, sessionId, state, now);
  } catch {
    /* fail-open */
  }
}

export function getCompactionSummary(root, sessionId) {
  try {
    if (!root || !sessionId) return null;
    const state = loadSessionState(root, sessionId);
    if (state.editedFiles.length === 0 && state.dispatches.length === 0) return null;
    const parts = [];
    if (state.editedFiles.length > 0) {
      parts.push(`Tệp code đã sửa trong phiên: ${state.editedFiles.join(", ")}`);
    }
    if (state.uncheckedFiles.length > 0) {
      parts.push(`Chưa kiểm tra tĩnh: ${state.uncheckedFiles.join(", ")}`);
    }
    if (state.dispatches.length > 0) {
      const latest = state.dispatches
        .slice(-5)
        .map((d) => [d.agentType, d.contractRef || d.summary].filter(Boolean).join(": "))
        .filter(Boolean);
      if (latest.length > 0) parts.push(`Dispatch gần nhất: ${latest.join(" | ")}`);
    }
    return parts.length > 0 ? `[workflow-state] ${parts.join(". ")}.` : null;
  } catch {
    return null;
  }
}

export function extractPlanDirFromPath(root, rawPath) {
  const rel = toRepoRel(root, rawPath) || (typeof rawPath === "string" ? rawPath.replace(/\\/g, "/").replace(/^\.\//, "") : null);
  if (!rel) return null;
  const m = rel.match(/^(\.agent\/planning\/[^/]+)\/(?:00-OVERVIEW|TASK-[^/]+)\.md$/);
  return m ? m[1] : null;
}

export function isUserStopIntent(text) {
  if (typeof text !== "string" || !text.trim()) return false;
  const trimmed = text.trim();
  if (trimmed.length > 260) return false;
  return USER_STOP_INTENT_RE.test(trimmed);
}

export function inspectPlanDirRemaining(root, planDir, { completedRefs = [], dispatchedRefs = [] } = {}) {
  const empty = { active: false, totalSlices: 0, remainingSlices: [], inFlightSlices: [] };
  if (!root || !planDir || typeof planDir !== "string") return empty;
  try {
    const absDir = resolve(root, planDir);
    if (!existsSync(absDir) || !statSync(absDir).isDirectory()) return empty;

    const overviewFile = join(absDir, "00-OVERVIEW.md");
    let overviewText = "";
    if (existsSync(overviewFile)) {
      overviewText = readFileSync(overviewFile, "utf8");
      const lifecycleMatch = overviewText.match(/^```(?:json[ \t]+)?task-lifecycle[ \t]*\r?\n([\s\S]*?)^```[ \t]*\r?$/m);
      if (lifecycleMatch) {
        const lifecycle = JSON.parse(lifecycleMatch[1]);
        if (lifecycle.archived === true || lifecycle.status !== "active" || lifecycle.superseded_by !== null) {
          return empty;
        }
      }
      if (/\b(?:status|trạng\s+thái)\s*:\s*(?:paused|tạm\s+dừng|completed|closed|archived)\b/i.test(overviewText)) {
        return empty;
      }
    }

    const doneSet = new Set(completedRefs.map((r) => String(r).replace(/\\/g, "/")));
    const dispatchedSet = new Set(dispatchedRefs.map((r) => String(r).replace(/\\/g, "/")));
    const taskFiles = readdirSync(absDir)
      .filter((f) => /^TASK-.*\.md$/.test(f))
      .sort();
    if (taskFiles.length === 0) return empty;

    const implSlices = [];
    for (const fileName of taskFiles) {
      const relRef = `${planDir.replace(/\/$/, "")}/${fileName}`;
      const content = readFileSync(join(absDir, fileName), "utf8");
      const contractMatch = content.match(/^```(?:json[ \t]+)?task-contract[ \t]*\r?\n([\s\S]*?)^```[ \t]*\r?$/m);
      if (contractMatch) {
        try {
          const parsed = JSON.parse(contractMatch[1]);
          if (parsed.mode && parsed.mode !== "implementation") continue;
        } catch {
          /* ignore malformed block */
        }
      }
      const checkedInOverview =
        overviewText &&
        new RegExp(`-\\s*\\[[xX]\\][^\\n]*\\b${fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(overviewText);
      implSlices.push({ relRef, fileName, done: doneSet.has(relRef) || doneSet.has(fileName) || Boolean(checkedInOverview) });
    }

    if (implSlices.length === 0) return empty;
    const remaining = implSlices.filter((s) => !s.done && !dispatchedSet.has(s.relRef)).map((s) => s.relRef);
    const inFlight = implSlices.filter((s) => !s.done && dispatchedSet.has(s.relRef)).map((s) => s.relRef);
    return {
      active: true,
      totalSlices: implSlices.length,
      remainingSlices: remaining,
      inFlightSlices: inFlight,
    };
  } catch {
    return empty;
  }
}

export function armSessionContinuation(root, sessionId, info = {}, opts = {}) {
  try {
    if (!root || !sessionId) return;
    const now = Number.isFinite(opts.now) ? opts.now : Date.now();
    const state = loadSessionState(root, sessionId, now, opts);
    state.continuation.armed = true;
    state.continuation.tripped = false;
    if (typeof info.planDir === "string" && info.planDir) {
      state.continuation.planDir = info.planDir;
    }
    saveSessionState(root, sessionId, state, now, opts);
  } catch {
    /* fail-open */
  }
}

export function updateSessionTodoState(root, sessionId, todo = {}, opts = {}) {
  try {
    if (!root || !sessionId) return;
    const now = Number.isFinite(opts.now) ? opts.now : Date.now();
    const state = loadSessionState(root, sessionId, now, opts);
    const openCount = Number.isInteger(todo.openCount) && todo.openCount >= 0 ? todo.openCount : 0;
    const completedCount = Number.isInteger(todo.completedCount) && todo.completedCount >= 0 ? todo.completedCount : 0;
    state.continuation.openTodoCount = openCount;
    state.continuation.completedTodoCount = completedCount;
    state.continuation.todoSample = Array.isArray(todo.sample)
      ? todo.sample.filter((x) => typeof x === "string").slice(0, 5)
      : [];
    if (openCount > 0) {
      state.continuation.armed = true;
      state.continuation.tripped = false;
    } else if (!state.continuation.planDir) {
      state.continuation.armed = false;
    }
    saveSessionState(root, sessionId, state, now, opts);
  } catch {
    /* fail-open */
  }
}

export function recordSessionSliceCompleted(root, sessionId, sliceRef, opts = {}) {
  try {
    if (!root || !sessionId || !sliceRef) return;
    const now = Number.isFinite(opts.now) ? opts.now : Date.now();
    const state = loadSessionState(root, sessionId, now, opts);
    const norm = String(sliceRef).replace(/\\/g, "/");
    if (!state.continuation.completedSlices.includes(norm)) {
      state.continuation.completedSlices.push(norm);
    }
    saveSessionState(root, sessionId, state, now, opts);
  } catch {
    /* fail-open */
  }
}

export function recordSessionToolOutcome(root, sessionId, outcome = {}, opts = {}) {
  try {
    if (!root || !sessionId) return;
    const now = Number.isFinite(opts.now) ? opts.now : Date.now();
    const state = loadSessionState(root, sessionId, now, opts);
    const errText = String(outcome.errorText ?? "");
    if (outcome.failed && INFRA_ERROR_STREAK_RE.test(errText)) {
      state.continuation.errorStreak += 1;
      saveSessionState(root, sessionId, state, now, opts);
    } else if (!outcome.failed && state.continuation.errorStreak > 0) {
      state.continuation.errorStreak = 0;
      saveSessionState(root, sessionId, state, now, opts);
    }
  } catch {
    /* fail-open */
  }
}

export function resetSessionTurnCounters(root, sessionId, { userPrompt = "" } = {}, opts = {}) {
  try {
    if (!root || !sessionId) return;
    const now = Number.isFinite(opts.now) ? opts.now : Date.now();
    const state = loadSessionState(root, sessionId, now, opts);
    state.continuation.autoContinueCount = 0;
    state.continuation.noProgressStreak = 0;
    state.continuation.errorStreak = 0;
    state.continuation.tripped = false;
    if (isUserStopIntent(userPrompt)) {
      state.continuation.armed = false;
      state.continuation.openTodoCount = 0;
      state.continuation.todoSample = [];
      state.continuation.planDir = null;
    }
    saveSessionState(root, sessionId, state, now, opts);
  } catch {
    /* fail-open */
  }
}

/**
 * Đánh giá cổng chống dừng non cho phiên Main (dùng chung OMP `session_stop`, AGY `Stop`, Claude `Stop`).
 * Trả `{ decision: "allow" }` khi phiên hỏi đáp thường / đã xong / vướng toàn bộ Vùng Đỏ / chạm cầu chì chống lặp;
 * trả `{ decision: "block", reason }` khi còn todo/TASK độc lập khả thi mà Main lỡ dừng sau báo cáo trung gian.
 */
export function evaluateMainStopGate(root, sessionId, context = {}, opts = {}) {
  try {
    if (!root || !sessionId) return { decision: "allow" };
    if (context.signalAborted || context.userStopRequested || isUserStopIntent(context.lastUserText || "")) {
      resetSessionTurnCounters(root, sessionId, { userPrompt: "stop" }, opts);
      return { decision: "allow" };
    }

    const now = Number.isFinite(opts.now) ? opts.now : Date.now();
    const state = loadSessionState(root, sessionId, now, opts);
    const cont = state.continuation;
    if (cont.tripped) return { decision: "allow" };

    const openTodoCount = Number.isInteger(context.openTodoCount) ? context.openTodoCount : cont.openTodoCount;
    const completedTodoCount = Number.isInteger(context.completedTodoCount)
      ? context.completedTodoCount
      : cont.completedTodoCount;
    const todoSample = Array.isArray(context.todoSample) ? context.todoSample : cont.todoSample;
    const planDir = str(context.planDir) ?? cont.planDir;
    const armed = Boolean(context.armed ?? cont.armed) || openTodoCount > 0 || Boolean(planDir);

    if (!armed) return { decision: "allow" };

    const dispatchedRefs = Array.isArray(context.dispatchedRefs)
      ? context.dispatchedRefs
      : state.dispatches.map((d) => d.contractRef).filter(Boolean);
    const completedRefs = Array.isArray(context.completedRefs) ? context.completedRefs : cont.completedSlices;
    const planStatus = planDir
      ? inspectPlanDirRemaining(root, planDir, { completedRefs, dispatchedRefs })
      : { active: false, remainingSlices: [], inFlightSlices: [] };

    const remainingSlices = planStatus.remainingSlices;
    if (openTodoCount <= 0 && remainingSlices.length === 0) {
      cont.armed = false;
      saveSessionState(root, sessionId, state, now, opts);
      return { decision: "allow" };
    }

    const lastAssistantText = String(context.lastAssistantText ?? "");
    if (RED_ZONE_ALL_BLOCKED_RE.test(lastAssistantText)) {
      return { decision: "allow" };
    }

    const progressCount = Number.isInteger(context.progressMarker)
      ? context.progressMarker
      : completedTodoCount * 1000 +
        state.dispatches.length * 100 +
        state.editedFiles.length * 10 +
        completedRefs.length;
    const progressHash = `${progressCount}|open:${openTodoCount}|rem:${remainingSlices.join(",")}`;

    if (cont.autoContinueCount > 0 && progressHash === cont.lastProgressHash) {
      cont.noProgressStreak += 1;
    } else {
      cont.noProgressStreak = 0;
    }

    const trip = (tripKind, detail) => {
      cont.tripped = true;
      saveSessionState(root, sessionId, state, now, opts);
      recordAgentFriction(
        root,
        {
          type: "auto-continue-circuit-open",
          reason: tripKind,
          summary: detail.slice(0, 200),
        },
        opts
      );
      return { decision: "allow" };
    };

    if (cont.errorStreak >= CONTINUATION_MAX_ERROR_STREAK) {
      return trip("infra-error-streak", `Dừng auto-continue sau ${cont.errorStreak} lỗi hạ tầng/quota liên tiếp`);
    }
    if (cont.noProgressStreak >= CONTINUATION_MAX_NO_PROGRESS) {
      return trip(
        "no-progress-streak",
        `Dừng auto-continue sau ${cont.noProgressStreak} lượt liên tiếp không có tiến triển tool/dispatch/todo mới`
      );
    }
    const maxPerTurn = Number.isInteger(opts.maxPerTurn) ? opts.maxPerTurn : CONTINUATION_MAX_PER_TURN;
    if (cont.autoContinueCount >= maxPerTurn) {
      return trip("max-continuations", `Chạm trần an toàn ${maxPerTurn} lượt auto-continue trong một yêu cầu`);
    }

    cont.autoContinueCount += 1;
    cont.lastProgressHash = progressHash;
    saveSessionState(root, sessionId, state, now, opts);

    const targets = [];
    if (openTodoCount > 0) {
      const preview = todoSample.slice(0, 3).join("; ");
      targets.push(`còn ${openTodoCount} mục todo chưa đóng${preview ? ` (${preview})` : ""}`);
    }
    if (remainingSlices.length > 0) {
      targets.push(
        `còn ${remainingSlices.length} TASK chưa triển khai (${remainingSlices.slice(0, 3).join(", ")}${
          remainingSlices.length > 3 ? ", ..." : ""
        })`
      );
    }

    return {
      decision: "block",
      reason:
        `[autonomous-continuation ${cont.autoContinueCount}/${maxPerTurn}] Phiên chạy xuyên suốt chưa hoàn tất: ${targets.join(
          " | "
        )}. ` +
        `Cấm dừng lượt sau báo cáo trung gian khi còn hạng mục khả thi. Hãy gọi ngay công cụ thực thi/dispatch cho hạng mục độc lập kế tiếp ` +
        `(nếu 1 nhánh vướng Vùng Đỏ hoặc lỗi công cụ cục bộ, chỉ treo riêng nhánh đó vào Hộp thư Quyết định và làm tiếp các nhánh độc lập còn lại; ` +
        `nếu thực sự đã xong hết thì cập nhật đóng hết todo/overview trước khi kết thúc).`,
    };
  } catch {
    return { decision: "allow" };
  }
}

function collectPathCandidates(input) {
  if (typeof input === "string") return input.trim() ? [input.trim()] : [];
  if (!input || typeof input !== "object") return [];
  const keys = ["file_path", "Path", "path", "uri", "filePath", "TargetFile"];
  const direct = keys.map((k) => str(input[k])).filter(Boolean);
  const many = Array.isArray(input.paths) ? input.paths.map(str).filter(Boolean) : [];
  const nestedRaw = input.Arguments ?? input.arguments;
  const nested = nestedRaw ? collectPathCandidates(parseJsonObject(nestedRaw)) : [];
  return [...direct, ...many, ...nested];
}

const LSP_NAV_TOOLS = new Set([
  "find_definition",
  "find_references",
  "find_implementation",
  "get_hover",
  "find_workspace_symbols",
  "prepare_call_hierarchy",
  "get_incoming_calls",
  "get_outgoing_calls",
]);

function extractLspMethodName(toolName, args = {}) {
  const name = String(toolName || "").trim();
  if (!name) return "";
  if (name.toLowerCase() === "call_mcp_tool") {
    const parsed = parseJsonObject(args);
    return (str(parsed.ToolName) ?? str(parsed.toolName) ?? str(parsed.tool_name) ?? "").toLowerCase();
  }
  const m = name.match(/([^_]+(?:_[^_]+)*)$/);
  const parts = name.split("__");
  return (parts.length > 1 ? parts[parts.length - 1] : m ? m[1] : name).toLowerCase();
}

export function isLspNavigationCall(toolName, args = {}) {
  if (!isLspToolCall(toolName, args)) return false;
  return LSP_NAV_TOOLS.has(extractLspMethodName(toolName, args));
}

export function inferLspCircuitTarget(toolName, args = {}) {
  const lang = inferLspLanguage(args);
  return isLspNavigationCall(toolName, args) ? `${lang}-nav` : lang;
}

export function inferLspLanguage(argsOrPath) {
  for (const raw of collectPathCandidates(argsOrPath)) {
    const clean = raw.replace(/^file:\/\//i, "").split(/[?#]/)[0];
    if (CSHARP_PATH_RE.test(clean)) return "csharp";
    if (TS_PATH_RE.test(clean)) return "typescript";
  }
  return "general";
}

export function isLspToolCall(toolName, args = {}) {
  const name = String(toolName || "").trim();
  if (!name) return false;
  if (name.toLowerCase() === "call_mcp_tool") {
    const parsed = parseJsonObject(args);
    const server = (str(parsed.ServerName) ?? str(parsed.serverName) ?? str(parsed.server_name) ?? "").toLowerCase();
    return server === "lsp";
  }
  return /^mcp_+.*lsp.*__/i.test(name) || /^mcp_+lsp_+/i.test(name);
}

export function isLspFailureOrTimeout(eventOrPayload) {
  if (!eventOrPayload || typeof eventOrPayload !== "object") return false;
  if (eventOrPayload.error) return true;
  for (const key of ["toolResult", "output", "result", "response", "tool_response"]) {
    const candidate = eventOrPayload[key];
    if (candidate == null) continue;
    const text = typeof candidate === "string" ? candidate : JSON.stringify(candidate);
    if (LSP_FAILURE_RE.test(text)) return true;
  }
  return false;
}

function normalizeLspLang(lang) {
  if (
    lang === "csharp" ||
    lang === "typescript" ||
    lang === "general" ||
    lang === "csharp-nav" ||
    lang === "typescript-nav" ||
    lang === "general-nav"
  ) {
    return lang;
  }
  return "general";
}

export async function queryWarmLspCheck(files, { port = Number(process.env.AGY_LSP_PORT || 48991), maxSeverity = 1, timeoutMs = 2000 } = {}) {
  const list = Array.isArray(files) ? files.filter((f) => typeof f === "string" && CODE_FILE_RE.test(f)) : [];
  if (list.length === 0) return { ok: false, totalErrors: 0, results: [] };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs + 500);
  try {
    const res = await fetch(`http://127.0.0.1:${port}/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files: list, maxSeverity, timeoutMs }),
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false, totalErrors: 0, results: [] };
    const json = await res.json();
    return json && typeof json === "object" ? json : { ok: false, totalErrors: 0, results: [] };
  } catch {
    return { ok: false, totalErrors: 0, results: [] };
  } finally {
    clearTimeout(timer);
  }
}

export function formatWarmLspErrors(checkRes, root = null) {
  const lines = [];
  for (const item of checkRes?.results || []) {
    if (!Array.isArray(item.diagnostics) || item.diagnostics.length === 0) continue;
    const label = root ? relative(resolve(root), item.file).replace(/\\/g, "/") : item.file;
    for (const d of item.diagnostics.slice(0, 8)) {
      const code = d.code != null ? ` [${d.code}]` : "";
      lines.push(`- ${label}:${d.line}:${d.character}${code}: ${d.message}`);
    }
    if (item.diagnostics.length > 8) {
      lines.push(`- ${label}: ... và ${item.diagnostics.length - 8} lỗi khác`);
    }
  }
  if (lines.length === 0) return "";
  return (
    `[lsp-tức-thì] Phát hiện ${checkRes.totalErrors} lỗi biên dịch/kiểu trên tệp vừa sửa (sửa dứt điểm ngay tại chỗ, tối đa 2 vòng nếu lỗi đến từ tệp ngoài phạm vi):\n` +
    lines.join("\n")
  );
}

function resolveCircuitFile(root, opts = {}) {
  if (str(opts?.circuitFile)) return opts.circuitFile;
  if (!root) return null;
  return join(root, LSP_CIRCUIT_REL);
}

function loadCircuitState(circuitFile) {
  const empty = { version: 1, circuits: {} };
  if (!circuitFile || !existsSync(circuitFile)) return empty;
  try {
    const parsed = JSON.parse(readFileSync(circuitFile, "utf8"));
    if (!parsed || typeof parsed !== "object") return empty;
    return {
      version: 1,
      circuits:
        parsed.circuits && typeof parsed.circuits === "object" && !Array.isArray(parsed.circuits)
          ? parsed.circuits
          : {},
    };
  } catch {
    return empty;
  }
}

function saveCircuitState(circuitFile, state) {
  if (!circuitFile) return;
  try {
    mkdirSync(dirname(circuitFile), { recursive: true });
    writeFileSync(circuitFile, `${JSON.stringify(state, null, 2)}\n`);
  } catch {
    /* fail-open */
  }
}

function buildCircuitOpenReason(lang, remainingSec) {
  return (
    `[lsp-circuit-open] Máy chủ LSP (${lang}) đang ngắt cầu chì do timeout/quá tải trước đó (còn ${remainingSec}s). ` +
    `CẤM gọi lại hay đứng chờ; chuyển ngay sang kiểm tra tĩnh dự phòng (R10 + đọc đối chiếu chữ ký khai báo gốc/caller) ` +
    `và ghi 'LSP: circuit-open (skipped to prevent session hang)' trong báo cáo.`
  );
}

export function checkLspCircuit(root, lang = "general", opts = {}) {
  try {
    const targetLang = normalizeLspLang(lang);
    const circuitFile = resolveCircuitFile(root, opts);
    if (!circuitFile || !existsSync(circuitFile)) {
      return { allowed: true, state: "CLOSED" };
    }
    const state = loadCircuitState(circuitFile);
    const entry = state.circuits[targetLang];
    if (!entry || entry.state === "CLOSED") {
      return { allowed: true, state: "CLOSED" };
    }
    const now = Number.isFinite(opts.now) ? opts.now : Date.now();
    const ttlMs = Number.isFinite(entry.ttlMs) && entry.ttlMs > 0 ? entry.ttlMs : LSP_CIRCUIT_TTL_MS;

    if (entry.state === "OPEN") {
      const openedAt = Number(entry.openedAt) || 0;
      const elapsed = now - openedAt;
      if (elapsed < ttlMs) {
        const remainingSec = Math.max(1, Math.ceil((ttlMs - elapsed) / 1000));
        return {
          allowed: false,
          state: "OPEN",
          remainingSec,
          reason: buildCircuitOpenReason(targetLang, remainingSec),
        };
      }
      if (!opts.peek) {
        state.circuits[targetLang] = {
          ...entry,
          state: "HALF_OPEN",
          probeStartedAt: now,
        };
        saveCircuitState(circuitFile, state);
      }
      return { allowed: true, state: "HALF_OPEN" };
    }

    if (entry.state === "HALF_OPEN") {
      if (opts.peek) {
        return { allowed: true, state: "HALF_OPEN" };
      }
      const probeStartedAt = Number(entry.probeStartedAt) || 0;
      const probeElapsed = now - probeStartedAt;
      if (probeElapsed < LSP_PROBE_TIMEOUT_MS) {
        const remainingSec = Math.max(1, Math.ceil((LSP_PROBE_TIMEOUT_MS - probeElapsed) / 1000));
        return {
          allowed: false,
          state: "HALF_OPEN",
          remainingSec,
          reason: buildCircuitOpenReason(targetLang, remainingSec),
        };
      }
      state.circuits[targetLang] = {
        ...entry,
        state: "HALF_OPEN",
        probeStartedAt: now,
      };
      saveCircuitState(circuitFile, state);
      return { allowed: true, state: "HALF_OPEN" };
    }

    return { allowed: true, state: "CLOSED" };
  } catch {
    return { allowed: true, state: "CLOSED" };
  }
}

export function recordLspOutcome(root, lang = "general", outcome = {}, opts = {}) {
  try {
    const targetLang = normalizeLspLang(lang);
    const circuitFile = resolveCircuitFile(root, opts);
    if (!circuitFile) return;

    const now = Number.isFinite(opts.now) ? opts.now : Date.now();
    const ttlMs = Number.isFinite(opts.ttlMs) && opts.ttlMs > 0 ? opts.ttlMs : LSP_CIRCUIT_TTL_MS;
    const state = loadCircuitState(circuitFile);
    const prev = state.circuits[targetLang];
    const prevState = prev?.state || "CLOSED";
    const prevStillOpen =
      prevState === "OPEN" && now - (Number(prev?.openedAt) || 0) < (Number(prev?.ttlMs) || ttlMs);

    if (outcome?.failed === true) {
      const errorText = String(outcome.errorText ?? "");
      state.circuits[targetLang] = {
        state: "OPEN",
        openedAt: now,
        ttlMs,
        lastError: errorText.slice(0, 240),
      };
      saveCircuitState(circuitFile, state);

      if (!opts?.sandbox && !prevStillOpen && root) {
        try {
          const frictionFile = join(root, LSP_FRICTION_REL);
          mkdirSync(dirname(frictionFile), { recursive: true });
          appendFileSync(
            frictionFile,
            `${JSON.stringify({
              ts: new Date(now).toISOString(),
              kind: "lsp-circuit-open",
              target: targetLang,
              evidence: errorText.slice(0, 160),
              suggested_fix: "Check csharp-ls/tsserver load or Cogain.Lsp.slnf",
            })}\n`
          );
        } catch {
          /* fail-open */
        }
      }
      return;
    }

    if (outcome?.failed === false && prevState !== "CLOSED") {
      state.circuits[targetLang] = { state: "CLOSED", closedAt: now };
      saveCircuitState(circuitFile, state);
    }
  } catch {
    /* fail-open */
  }
}

export function recordAgentFriction(root, entry = {}, opts = {}) {
  try {
    if (!root || opts?.sandbox) return;
    const frictionFile = join(root, LSP_FRICTION_REL);
    const now = Number.isFinite(opts.now) ? opts.now : Date.now();
    mkdirSync(dirname(frictionFile), { recursive: true });
    appendFileSync(
      frictionFile,
      `${JSON.stringify({
        at: new Date(now).toISOString(),
        ...entry,
      })}\n`
    );
  } catch {
    /* fail-open */
  }
}

export function clearSessionFilesForLanguage(root, sessionId, lang = "general", opts = {}) {
  try {
    if (!root || !sessionId) return;
    const targetLang = normalizeLspLang(lang);
    if (targetLang === "general") {
      markSessionFilesChecked(root, sessionId, null);
      return;
    }
    const now = Number.isFinite(opts.now) ? opts.now : Date.now();
    const state = loadSessionState(root, sessionId, now);
    if (state.uncheckedFiles.length === 0) return;
    const next = state.uncheckedFiles.filter((f) => inferLspLanguage(f) !== targetLang);
    if (next.length !== state.uncheckedFiles.length) {
      state.uncheckedFiles = next;
      saveSessionState(root, sessionId, state, now);
    }
  } catch {
    /* fail-open */
  }
}

export function checkSubagentStopGate(root, sessionId, payload = {}, opts = {}) {
  try {
    if (payload?.stop_hook_active) return { decision: "allow" };
    if (!root || !sessionId) return { decision: "allow" };
    const now = Number.isFinite(opts.now) ? opts.now : Date.now();
    const state = loadSessionState(root, sessionId, now);
    if (state.stopReminded || state.uncheckedFiles.length === 0) {
      return { decision: "allow" };
    }
    const activeUnchecked = state.uncheckedFiles.filter(
      (f) => checkLspCircuit(root, inferLspLanguage(f), { ...opts, peek: true, now }).allowed
    );
    if (activeUnchecked.length === 0) {
      return { decision: "allow" };
    }
    const list = activeUnchecked.join(", ");
    state.stopReminded = true;
    saveSessionState(root, sessionId, state, now);
    return {
      decision: "block",
      reason:
        `[pre-handoff-gate] Bạn vừa sửa tệp code (${list}). ` +
        `Trước khi kết thúc, kiểm tra lỗi cú pháp/type trên các tệp vừa sửa (nếu môi trường có công cụ) ` +
        `và ghi rõ tệp đã đổi, lý do, và trạng thái kiểm tra (` +
        `\`Validation: not run - not requested\` nếu chưa chạy build/test theo yêu cầu).`,
    };
  } catch {
    return { decision: "allow" };
  }
}

export function evaluateStagedDiff(root, options = {}) {
  const resolvedRoot = resolve(root);
  let diff = "";
  try {
    diff = execFileSync("git", ["diff", "--cached", "-U0", "--no-color"], {
      cwd: resolvedRoot,
      encoding: "utf8",
      timeout: 15000,
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch {
    return null;
  }
  if (!diff || !diff.trim()) return null;
  const rawChecks = splitApplyPatchIntoFileChecks(diff);
  if (rawChecks.length === 0) return null;
  const checks = resolveChecksBaseCwd(rawChecks, resolvedRoot);
  return evaluateBoundaryChecks(checks, {
    root: resolvedRoot,
    ...(options.sandbox ? { sandbox: true } : {}),
  });
}

function runMain() {
  const argv = process.argv.slice(2);
  if (!argv.includes("--check-staged")) {
    process.stderr.write("usage: agent-lifecycle-core.mjs --check-staged [--sandbox]\n");
    process.exit(1);
  }
  const sandbox = argv.includes("--sandbox");
  const root = findRepoRoot(process.cwd()) ?? findRepoRoot(HERE);
  if (!root) process.exit(0);

  const reason = evaluateStagedDiff(root, { sandbox });
  if (reason) {
    process.stderr.write(`[lifecycle-core --check-staged] ${reason}\n`);
    process.exit(2);
  }
  process.exit(0);
}

let isMain = false;
if (process.argv[1]) {
  try {
    isMain = realpathSync(resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    isMain = resolve(process.argv[1]) === fileURLToPath(import.meta.url);
  }
}
if (isMain) {
  runMain();
}
