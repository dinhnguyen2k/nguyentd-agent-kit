#!/usr/bin/env node
/**
 * Nối Antigravity (AGY) `PreToolUse` trực tiếp vào `evaluateBoundaryChecks` trong cùng tiến trình Node.
 * Nguồn luật duy nhất nằm ở `.agent/contracts/agent-registry.json`.
 * Fail-open có chủ đích: lỗi của chính hook không được chặn tool.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateBoundaryChecks } from "../../scripts/agent-boundary-guard.mjs";
import { checkLspCircuit, inferLspLanguage, isLspToolCall } from "../../scripts/agent-lifecycle-core.mjs";
import { prepareDispatchAssignment } from "../../scripts/dispatch-contract.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const GUARD_REL = join(".agent", "scripts", "agent-boundary-guard.mjs");
const SESSIONS_REL = join(".agent", "scratch", ".runtime", "agy-sessions.json");
const SESSION_TTL_MS = 16 * 60 * 60 * 1000;
const CODING_SPECIALISTS = new Set(["backend-specialist", "frontend-specialist", "test-author"]);
const KNOWN_ROLES = new Set([
  "backend-specialist",
  "frontend-specialist",
  "test-author",
  "verifier",
  "researcher",
  "reviewer",
]);
const SWARM_ROLE_RE = /\.agents?\/agents\/(backend-specialist|frontend-specialist|test-author|verifier|researcher|reviewer)\.md/i;
const SWARM_SPECIALIST_RE = /\.agents?\/agents\/(backend-specialist|frontend-specialist|test-author)\.md/i;
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
const MCP_FS_TOOL_RE = /^mcp_+filesystem_+(write_file|append_file|edit_file|move_file|create_directory)$/;
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
  const single = ["Path", "TargetFile", "file_path", "path", "notebook_path", "source", "destination"].map((k) =>
    str(args[k])
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

function lookupSessionAgentName(root, conversationId) {
  if (!conversationId) return null;
  try {
    const file = join(root, SESSIONS_REL);
    if (!existsSync(file)) return null;
    const data = JSON.parse(readFileSync(file, "utf8"));
    return str(data?.conversations?.[conversationId]?.role);
  } catch {
    return null;
  }
}

function saveSessionRole(root, conversationId, role) {
  if (!conversationId || !role || !KNOWN_ROLES.has(role)) return;
  try {
    const file = join(root, SESSIONS_REL);
    const now = Date.now();
    const raw = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : { version: 1, conversations: {}, pendingDispatches: [] };
    const conversations = raw.conversations && typeof raw.conversations === "object" ? raw.conversations : {};
    if (!conversations[conversationId]) {
      conversations[conversationId] = { role, dirtyFiles: [], codegenTouched: false, updatedAt: now };
    } else {
      conversations[conversationId].role = role;
      conversations[conversationId].updatedAt = now;
    }
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify({ version: 1, conversations, pendingDispatches: raw.pendingDispatches || [] }, null, 2));
  } catch {
    /* fail-open */
  }
}

function recordPendingDispatch(root, role, promptText) {
  if (!root || !KNOWN_ROLES.has(role)) return;
  const promptSnippet = String(promptText || "").trim().slice(0, 300);
  if (promptSnippet.length < 20) return;
  try {
    const file = join(root, SESSIONS_REL);
    const now = Date.now();
    const raw = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : { version: 1, conversations: {}, pendingDispatches: [] };
    const pending = Array.isArray(raw.pendingDispatches)
      ? raw.pendingDispatches.filter((d) => d && now - (d.createdAt || 0) <= SESSION_TTL_MS)
      : [];
    if (!pending.some((d) => d.role === role && d.promptSnippet === promptSnippet)) {
      pending.push({ role, promptSnippet, createdAt: now });
    }
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(
      file,
      JSON.stringify(
        {
          version: 1,
          conversations: raw.conversations && typeof raw.conversations === "object" ? raw.conversations : {},
          pendingDispatches: pending.slice(-30),
        },
        null,
        2
      )
    );
  } catch {
    /* fail-open */
  }
}

function handleDispatchGate(toolName, args, root) {
  const isSubagent = toolName === "invoke_subagent";
  const isSwarmAdd = toolName === "swarm" && String(args.action || "").toLowerCase() === "add";
  if (!isSubagent && !isSwarmAdd) return null;

  let textKey;
  let text;
  let detectedRole = "";
  if (isSubagent) {
    const typeName = (
      str(args.TypeName) ??
      str(args.typeName) ??
      str(args.subagent_type) ??
      str(args.agent_type) ??
      ""
    ).toLowerCase();
    textKey = str(args.Prompt) !== null ? "Prompt" : "prompt";
    text = str(args[textKey]) ?? "";
    detectedRole = typeName;
    if (KNOWN_ROLES.has(detectedRole)) recordPendingDispatch(root, detectedRole, text);
    if (!CODING_SPECIALISTS.has(typeName)) return null;
  } else {
    textKey = "brief";
    text = str(args.brief) ?? "";
    const swarmName = (str(args.name) ?? "").toLowerCase();
    const roleMatch = text.match(SWARM_ROLE_RE);
    detectedRole = roleMatch ? roleMatch[1].toLowerCase() : KNOWN_ROLES.has(swarmName) ? swarmName : "";
    if (detectedRole) recordPendingDispatch(root, detectedRole, text);
    if (!SWARM_SPECIALIST_RE.test(text) && !CODING_SPECIALISTS.has(swarmName)) return null;
  }

  const lines = text
    .trim()
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 2 && lines.every((line) => /^contract_(?:ref|version):/.test(line))) {
    try {
      const hydrated = prepareDispatchAssignment(root, text);
      return { decision: "allow", overwrite: { [textKey]: hydrated } };
    } catch (err) {
      return { decision: "deny", reason: `[dispatch-gate] ${err.message}` };
    }
  }

  const hasScope = /\ballowed_paths\b|\bcontract_ref:/i.test(text);
  const hasAcceptance = /\bacceptance\b|tiêu\s+chí\s+nghiệm\s+thu/i.test(text);
  if (!hasScope || !hasAcceptance) {
    const reason =
      "Giao việc cho specialist viết code bắt buộc phải ghi rõ phạm vi đường dẫn (`allowed_paths` hoặc `contract_ref:`) VÀ tiêu chí nghiệm thu (`acceptance` hoặc `Tiêu chí nghiệm thu`).";
    try {
      const frictionFile = join(root, ".agent", "reports", "agent-friction.jsonl");
      mkdirSync(dirname(frictionFile), { recursive: true });
      appendFileSync(
        frictionFile,
        `${JSON.stringify({ at: new Date().toISOString(), type: "dispatch-gate-deny", role: detectedRole || "main", summary: reason.slice(0, 200) })}\n`
      );
    } catch {
      /* fail-open */
    }
    return {
      decision: "deny",
      reason,
    };
  }
  return { decision: "allow" };
}

try {
  const raw = readFileSync(0, "utf8");
  if (!raw.trim()) allow();
  const event = parseJsonObject(raw);
  const toolCall = parseJsonObject(event.toolCall);
  const toolName = (str(toolCall.name) ?? "").toLowerCase();
  if (!toolName) allow();

  const workspaceFirst = Array.isArray(event.workspacePaths) ? str(event.workspacePaths[0]) : null;
  const root = findRepoRoot(str(event.cwd)) ?? findRepoRoot(workspaceFirst) ?? findRepoRoot(HERE);
  if (!root) allow();

  const args = parseJsonObject(toolCall.args);

  if (isLspToolCall(toolName, args)) {
    const circuit = checkLspCircuit(root, inferLspLanguage(args));
    if (!circuit.allowed) deny(circuit.reason);
    allow();
  }

  const dispatchResult = handleDispatchGate(toolName, args, root);
  if (dispatchResult) {
    if (dispatchResult.decision === "deny") deny(dispatchResult.reason);
    if (dispatchResult.overwrite) {
      process.stdout.write(`${JSON.stringify(dispatchResult)}\n`);
      process.exit(0);
    }
    allow();
  }

  const baseCwd = str(event.cwd) ?? workspaceFirst ?? root;
  const rawChecks = toChecks(toolName, args, baseCwd);
  if (rawChecks.length === 0) allow();

  const artifactDir = str(event.artifactDirectoryPath);
  const skipArtifactDir = artifactDir && !isInsideDir(artifactDir, root) ? artifactDir : null;

  const checks = rawChecks.flatMap((check) => {
    if (!check.tool_input.file_path) return [check];
    const resolved = isAbsolute(check.tool_input.file_path)
      ? resolve(check.tool_input.file_path)
      : resolve(baseCwd, check.tool_input.file_path);
    if (skipArtifactDir && isInsideDir(resolved, skipArtifactDir)) return [];
    return [{ ...check, tool_input: { ...check.tool_input, file_path: resolved } }];
  });

  if (checks.length === 0) allow();

  const convId = str(event.conversationId);
  let agentName =
    str(event.agentName) ??
    str(event.agentType) ??
    str(event.subagentType) ??
    str(parseJsonObject(event.agent).name);

  if (agentName && convId) {
    saveSessionRole(root, convId, agentName.toLowerCase());
  } else if (!agentName && convId) {
    agentName = lookupSessionAgentName(root, convId);
  }

  const reason = evaluateBoundaryChecks(checks, { root, agentName });
  if (reason) deny(reason);
} catch {
  // Fail-open có chủ đích, khớp `fail_mode: open-on-crash` trong agent-registry.json.
}

allow();
