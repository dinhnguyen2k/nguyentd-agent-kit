/**
 * Bộ đánh giá giữ ấm cho các hook Antigravity (AGY): PreToolUse, PostToolUse, PreInvocation, PostInvocation, Stop.
 * Tách khỏi entry CLI để Warm Daemon nạp 1 lần vào RAM qua Unix Socket (`hook.sock`), đồng thời vẫn gọi được trực tiếp qua `node`.
 * Fail-open có chủ đích: lỗi nội bộ không được làm kẹt vòng lặp agent.
 */
import {
  appendFileSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateBoundaryChecks } from "../../scripts/agent-boundary-guard.mjs";
import {
  armSessionContinuation,
  checkLspCircuit,
  evaluateMainStopGate,
  extractPlanDirFromPath,
  formatWarmLspErrors,
  inferLspCircuitTarget,
  inferLspLanguage,
  isLspFailureOrTimeout,
  isLspToolCall,
  queryWarmLspCheck,
  recordLspOutcome,
  recordSessionDispatch,
  recordSessionEdit,
  recordSessionToolOutcome,
  resetSessionTurnCounters,
} from "../../scripts/agent-lifecycle-core.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const GUARD_REL = join(".agent", "scripts", "agent-boundary-guard.mjs");
const SESSIONS_REL = join(".agent", "scratch", ".runtime", "agy-sessions.json");
const FRICTION_REL = join(".agent", "reports", "agent-friction.jsonl");
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
const MCP_FS_LIFECYCLE_RE = /^mcp_+filesystem_+(write_file|append_file|edit_file|move_file)$/;
const EVAL_WRITE_PATTERNS = [
  /\bwrite\(\s*["'`]([^"'`]+)["'`]/g,
  /\bBun\.write\(\s*["'`]([^"'`]+)["'`]/g,
  /\bwriteFileSync\(\s*["'`]([^"'`]+)["'`]/g,
  /\bopen\(\s*["']([^"']+)["']\s*,\s*["'][wax]/g,
  /\bPath\(\s*["']([^"']+)["']\s*\)\.write_(?:text|bytes)\(/g,
];
const EVAL_SPAWNS_PROCESS = /\bsubprocess\b|\bos\.system\b|\bBun\.\$|\$`|\bspawn(?:Sync)?\(|\bexec(?:Sync)?\(|\btool\.bash\b/;
const CODEGEN_ROUTE_CREATE_TOOLS = new Set(["write_file", "write_to_file", "create_file", "delete_file", "write"]);
const CODE_FILE_RE = /^(?:backend\/src|frontend)\/.*\.(?:cs|ts|tsx)$/i;
const ROUTE_FILE_RE = /^frontend\/[^/]+\/src\/routes\//;

const repoRootCache = new Map();
const sessionsCache = new Map();
let dispatchModulePromise = null;
let tmpCounter = 0;

function getDispatchModule() {
  if (!dispatchModulePromise) {
    dispatchModulePromise = import("../../scripts/dispatch-contract.mjs");
  }
  return dispatchModulePromise;
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
  const resolvedStart = resolve(start);
  if (repoRootCache.has(resolvedStart)) return repoRootCache.get(resolvedStart);
  let found = null;
  for (let dir = resolvedStart; ; dir = dirname(dir)) {
    if (existsSync(join(dir, GUARD_REL))) {
      found = dir;
      break;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
  }
  if (repoRootCache.size >= 64) {
    const oldest = repoRootCache.keys().next().value;
    if (oldest !== undefined) repoRootCache.delete(oldest);
  }
  repoRootCache.set(resolvedStart, found);
  return found;
}

function isInsideDir(targetPath, dirPath) {
  if (!targetPath || !dirPath) return false;
  const rel = relative(resolve(dirPath), resolve(targetPath));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function pruneState(state, now) {
  const conversations = {};
  for (const [id, entry] of Object.entries(state?.conversations || {})) {
    if (entry && now - (entry.updatedAt || 0) <= SESSION_TTL_MS) {
      conversations[id] = {
        role: str(entry.role),
        dirtyFiles: Array.isArray(entry.dirtyFiles) ? entry.dirtyFiles : [],
        lspAutoStrikes: entry.lspAutoStrikes && typeof entry.lspAutoStrikes === "object" ? entry.lspAutoStrikes : {},
        codegenTouched: Boolean(entry.codegenTouched),
        updatedAt: entry.updatedAt || now,
      };
    }
  }
  const pendingDispatches = Array.isArray(state?.pendingDispatches)
    ? state.pendingDispatches.filter((d) => d && now - (d.createdAt || 0) <= SESSION_TTL_MS).slice(-30)
    : [];
  const swarmWorkerRoles = {};
  for (const [name, entry] of Object.entries(state?.swarmWorkerRoles || {})) {
    if (entry && str(entry.role) && now - (entry.createdAt || 0) <= SESSION_TTL_MS) {
      swarmWorkerRoles[name] = {
        role: entry.role,
        parentConvId: str(entry.parentConvId) ?? "",
        createdAt: entry.createdAt || now,
      };
    }
  }
  const usedSwarmNames = {};
  for (const [cid, entry] of Object.entries(state?.usedSwarmNames || {})) {
    if (entry && Array.isArray(entry.names) && now - (entry.updatedAt || 0) <= SESSION_TTL_MS) {
      usedSwarmNames[cid] = {
        names: [...new Set(entry.names.map((n) => String(n).toLowerCase()).filter(Boolean))],
        updatedAt: entry.updatedAt || now,
      };
    }
  }
  return { version: 1, conversations, pendingDispatches, swarmWorkerRoles, usedSwarmNames };
}

function loadSessions(sessionFile, now = Date.now()) {
  const empty = { version: 1, conversations: {}, pendingDispatches: [], swarmWorkerRoles: {}, usedSwarmNames: {} };
  if (!sessionFile) return empty;
  try {
    if (!existsSync(sessionFile)) return empty;
    const st = statSync(sessionFile);
    const cached = sessionsCache.get(sessionFile);
    if (cached && cached.mtimeMs === st.mtimeMs) {
      return pruneState(cached.state, now);
    }
    const parsed = pruneState(JSON.parse(readFileSync(sessionFile, "utf8")), now);
    sessionsCache.set(sessionFile, { mtimeMs: st.mtimeMs, state: parsed });
    return pruneState(parsed, now);
  } catch {
    return empty;
  }
}

function saveSessions(sessionFile, state, now = Date.now()) {
  if (!sessionFile) return;
  try {
    const pruned = pruneState(state, now);
    mkdirSync(dirname(sessionFile), { recursive: true });
    tmpCounter = (tmpCounter + 1) % 1_000_000;
    const tmpFile = join(dirname(sessionFile), `.${basename(sessionFile)}.${process.pid}.${tmpCounter}.tmp`);
    writeFileSync(tmpFile, JSON.stringify(pruned, null, 2));
    renameSync(tmpFile, sessionFile);
    try {
      const st = statSync(sessionFile);
      sessionsCache.set(sessionFile, { mtimeMs: st.mtimeMs, state: pruned });
    } catch {
      sessionsCache.delete(sessionFile);
    }
  } catch {
    /* fail-open */
  }
}

function ensureConv(state, convId, now) {
  if (!state.conversations[convId]) {
    state.conversations[convId] = { role: null, dirtyFiles: [], lspAutoStrikes: {}, codegenTouched: false, updatedAt: now };
  }
  state.conversations[convId].updatedAt = now;
  return state.conversations[convId];
}

function readTranscriptHead(transcriptPath, maxBytes = 4096) {
  if (!transcriptPath || !existsSync(transcriptPath)) return "";
  let fd = null;
  try {
    fd = openSync(transcriptPath, "r");
    const buf = Buffer.allocUnsafe(maxBytes);
    const bytesRead = readSync(fd, buf, 0, maxBytes, 0);
    return bytesRead > 0 ? buf.toString("utf8", 0, bytesRead) : "";
  } catch {
    return "";
  } finally {
    if (fd !== null) {
      try {
        closeSync(fd);
      } catch {
        /* ignore */
      }
    }
  }
}

function appendFriction(root, entry) {
  try {
    const file = join(root, FRICTION_REL);
    mkdirSync(dirname(file), { recursive: true });
    appendFileSync(file, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`);
  } catch {
    /* fail-open */
  }
}

function argPaths(args, includeExtended = false) {
  const keys = includeExtended
    ? ["Path", "TargetFile", "file_path", "filePath", "path", "notebook_path", "destination", "uri"]
    : ["Path", "TargetFile", "file_path", "path", "notebook_path", "source", "destination"];
  const single = keys.map((k) => str(args[k]));
  const many = Array.isArray(args.paths) ? args.paths.map(str) : [];
  return [...new Set([...single, ...many].filter((p) => p !== null))];
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

function extractSwarmResultNames(event) {
  const names = [];
  const inspectObj = (obj) => {
    if (!obj || typeof obj !== "object") return;
    if (Array.isArray(obj.names)) {
      for (const n of obj.names) {
        const s = str(n);
        if (s) names.push(s.toLowerCase());
      }
    }
    for (const nestedKey of ["output", "text", "result", "response", "content"]) {
      const nested = obj[nestedKey];
      if (typeof nested === "string") {
        try {
          inspectObj(JSON.parse(nested));
        } catch {
          /* ignore */
        }
      } else if (Array.isArray(nested)) {
        for (const el of nested) inspectObj(el);
      } else if (nested && typeof nested === "object") {
        inspectObj(nested);
      }
    }
  };
  for (const candidate of [event?.toolResult, event?.output, event?.result, event?.response, event?.tool_response]) {
    if (!candidate) continue;
    if (typeof candidate === "object") inspectObj(candidate);
    else if (typeof candidate === "string") {
      try {
        inspectObj(JSON.parse(candidate));
      } catch {
        /* ignore */
      }
    }
  }
  return [...new Set(names)];
}

function computeSwarmTargetNames(args, event = null) {
  if (event) {
    const fromResult = extractSwarmResultNames(event);
    if (fromResult.length > 0) return fromResult;
  }
  const baseName = (str(args?.name) ?? "").toLowerCase();
  if (!baseName) return [];
  if (Array.isArray(args.tasks) && args.tasks.length > 0) {
    return args.tasks.map((_, i) => `${baseName}-${i + 1}`);
  }
  if (Number.isInteger(args.n) && args.n > 1) {
    return Array.from({ length: args.n }, (_, i) => `${baseName}-${i + 1}`);
  }
  return [baseName];
}

function saveSwarmWorkerRoles(sessionFile, role, targetNames, parentConvId, now = Date.now()) {
  if (!sessionFile || !KNOWN_ROLES.has(role) || !Array.isArray(targetNames) || targetNames.length === 0) return;
  const state = loadSessions(sessionFile, now);
  for (const wName of targetNames) {
    state.swarmWorkerRoles[wName] = { role, parentConvId: parentConvId || "", createdAt: now };
  }
  saveSessions(sessionFile, state, now);
}

function lookupSessionAgentName(sessionFile, conversationId, transcriptPath = null) {
  if (!conversationId) return null;
  try {
    const now = Date.now();
    const state = loadSessions(sessionFile, now);
    const existing = str(state.conversations?.[conversationId]?.role);
    if (existing) return existing;
    if (transcriptPath) {
      const head = readTranscriptHead(transcriptPath, 4096);
      const match = head.match(/recorded on the board as #\d+ for @([a-z0-9_-]+)\):/i);
      const workerName = match ? match[1].toLowerCase() : null;
      const mappedRole = workerName ? str(state.swarmWorkerRoles?.[workerName]?.role) : null;
      if (mappedRole && KNOWN_ROLES.has(mappedRole)) {
        const conv = ensureConv(state, conversationId, now);
        conv.role = mappedRole;
        saveSessions(sessionFile, state, now);
        return mappedRole;
      }
    }
    return null;
  } catch {
    return null;
  }
}

function saveSessionRole(sessionFile, conversationId, role) {
  if (!conversationId || !role || !KNOWN_ROLES.has(role)) return;
  const now = Date.now();
  const state = loadSessions(sessionFile, now);
  const conv = ensureConv(state, conversationId, now);
  conv.role = role;
  saveSessions(sessionFile, state, now);
}

function recordPendingDispatch(sessionFile, role, promptText) {
  if (!sessionFile || !KNOWN_ROLES.has(role)) return;
  const promptSnippet = String(promptText || "").trim().slice(0, 300);
  if (promptSnippet.length < 20) return;
  const now = Date.now();
  const state = loadSessions(sessionFile, now);
  if (!state.pendingDispatches.some((d) => d.role === role && d.promptSnippet === promptSnippet)) {
    state.pendingDispatches.push({ role, promptSnippet, createdAt: now });
    saveSessions(sessionFile, state, now);
  }
}

async function handleDispatchGate(toolName, args, root, sessionFile, convId = null) {
  const isSubagent = toolName === "invoke_subagent";
  const isSwarmAdd = toolName === "swarm" && String(args.action || "").toLowerCase() === "add";
  if (!isSubagent && !isSwarmAdd) return null;

  let textKey;
  let text;
  let detectedRole = "";
  let targetNames = [];
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
    if (KNOWN_ROLES.has(detectedRole)) recordPendingDispatch(sessionFile, detectedRole, text);
    if (!CODING_SPECIALISTS.has(typeName)) return null;
  } else {
    textKey = "brief";
    text = str(args.brief) ?? "";
    const swarmName = (str(args.name) ?? "").toLowerCase();
    const roleMatch = text.match(SWARM_ROLE_RE);
    detectedRole = roleMatch ? roleMatch[1].toLowerCase() : KNOWN_ROLES.has(swarmName) ? swarmName : "";
    targetNames = computeSwarmTargetNames(args);
    if (convId && targetNames.length > 0) {
      const state = loadSessions(sessionFile);
      const usedSet = new Set(state.usedSwarmNames[convId]?.names || []);
      const dup = targetNames.find((n) => usedSet.has(n));
      if (dup) {
        return {
          decision: "deny",
          reason: `Tên worker swarm '${dup}' đã dùng ở đợt trước trong phiên này. Hãy đổi tiền tố tên theo đợt mới (ví dụ res2, be2).`,
        };
      }
    }
    if (!SWARM_SPECIALIST_RE.test(text) && !CODING_SPECIALISTS.has(swarmName)) {
      if (KNOWN_ROLES.has(detectedRole) && targetNames.length > 0) {
        saveSwarmWorkerRoles(sessionFile, detectedRole, targetNames, convId);
      }
      return null;
    }
  }

  const lines = text
    .trim()
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 2 && lines.every((line) => /^contract_(?:ref|version):/.test(line))) {
    try {
      const { prepareDispatchAssignment } = await getDispatchModule();
      const hydrated = prepareDispatchAssignment(root, text);
      if (isSwarmAdd) {
        const effectiveRole = detectedRole || hydrated.match(SWARM_ROLE_RE)?.[1]?.toLowerCase() || "";
        if (KNOWN_ROLES.has(effectiveRole) && targetNames.length > 0) {
          saveSwarmWorkerRoles(sessionFile, effectiveRole, targetNames, convId);
        }
      }
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
    appendFriction(root, {
      type: "dispatch-gate-deny",
      role: detectedRole || "main",
      summary: reason.slice(0, 200),
    });
    return { decision: "deny", reason };
  }
  if (isSwarmAdd && KNOWN_ROLES.has(detectedRole) && targetNames.length > 0) {
    saveSwarmWorkerRoles(sessionFile, detectedRole, targetNames, convId);
  }
  return { decision: "allow" };
}

export async function evaluateAgyPreToolUse(rawEvent, options = {}) {
  try {
    const event = parseJsonObject(rawEvent);
    const toolCall = parseJsonObject(event.toolCall);
    const toolName = (str(toolCall.name) ?? "").toLowerCase();
    if (!toolName) return { decision: "allow" };

    const callerCwd = str(options.callerCwd);
    const workspaceFirst = Array.isArray(event.workspacePaths) ? str(event.workspacePaths[0]) : null;
    const root = findRepoRoot(str(event.cwd)) ?? findRepoRoot(workspaceFirst) ?? findRepoRoot(callerCwd) ?? findRepoRoot(HERE);
    if (!root) return { decision: "allow" };

    const sessionFile = join(root, SESSIONS_REL);
    const args = parseJsonObject(toolCall.args);
    const convId = str(event.conversationId);

    if (isLspToolCall(toolName, args)) {
      const circuit = checkLspCircuit(root, inferLspCircuitTarget(toolName, args));
      if (!circuit.allowed) return { decision: "deny", reason: `[boundary-guard] ${circuit.reason}` };
      return { decision: "allow" };
    }

    const dispatchResult = await handleDispatchGate(toolName, args, root, sessionFile, convId);
    if (dispatchResult) {
      if (dispatchResult.decision === "deny") {
        return { decision: "deny", reason: `[boundary-guard] ${dispatchResult.reason}` };
      }
      return dispatchResult;
    }

    const baseCwd = str(event.cwd) ?? workspaceFirst ?? callerCwd ?? root;
    const rawChecks = toChecks(toolName, args, baseCwd);
    if (rawChecks.length === 0) return { decision: "allow" };

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

    if (checks.length === 0) return { decision: "allow" };

    let agentName =
      str(event.agentName) ??
      str(event.agentType) ??
      str(event.subagentType) ??
      str(parseJsonObject(event.agent).name);

    if (agentName && convId) {
      saveSessionRole(sessionFile, convId, agentName.toLowerCase());
    } else if (!agentName && convId) {
      agentName = lookupSessionAgentName(sessionFile, convId, str(event.transcriptPath));
    }

    const reason = evaluateBoundaryChecks(checks, { root, agentName });
    if (reason) return { decision: "deny", reason: `[boundary-guard] ${reason}` };
  } catch {
    // Fail-open có chủ đích, khớp `fail_mode: open-on-crash` trong agent-registry.json.
  }
  return { decision: "allow" };
}

function toRepoRelative(rawPath, baseCwd, root) {
  if (!rawPath) return null;
  const cleaned = rawPath.startsWith("file://") ? rawPath.slice(7) : rawPath;
  const abs = isAbsolute(cleaned) ? resolve(cleaned) : resolve(baseCwd, cleaned);
  const rel = relative(resolve(root), abs).replace(/\\/g, "/");
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) return null;
  return rel;
}

function extractChildConversationId(event) {
  for (const candidate of [event.toolResult, event.output, event.result, event.response]) {
    if (!candidate) continue;
    if (typeof candidate === "object") {
      const id = str(candidate.conversationId) ?? str(candidate.conversation_id);
      if (id) return id;
    }
    const text = typeof candidate === "string" ? candidate : JSON.stringify(candidate);
    const m = text.match(/conversation:\/\/([0-9a-f-]{8,})/i) || text.match(/"conversationId"\s*:\s*"([^"]+)"/);
    if (m) return m[1];
  }
  return null;
}

function extractChildConversationIds(event) {
  const ids = new Set();
  const inspectObj = (obj) => {
    if (!obj || typeof obj !== "object") return;
    for (const key of ["conversation_ids", "conversationIds"]) {
      if (Array.isArray(obj[key])) {
        for (const item of obj[key]) {
          const s = str(item);
          if (s) ids.add(s);
        }
      }
    }
    for (const key of ["conversationId", "conversation_id"]) {
      const s = str(obj[key]);
      if (s) ids.add(s);
    }
    for (const nestedKey of ["output", "text", "result", "response", "content"]) {
      const nested = obj[nestedKey];
      if (typeof nested === "string") {
        try {
          inspectObj(JSON.parse(nested));
        } catch {
          /* ignore */
        }
      } else if (Array.isArray(nested)) {
        for (const el of nested) inspectObj(el);
      } else if (nested && typeof nested === "object") {
        inspectObj(nested);
      }
    }
  };
  for (const candidate of [event.toolResult, event.output, event.result, event.response, event.tool_response]) {
    if (!candidate) continue;
    if (typeof candidate === "object") inspectObj(candidate);
    else if (typeof candidate === "string") {
      try {
        inspectObj(JSON.parse(candidate));
      } catch {
        /* ignore */
      }
    }
    const text = typeof candidate === "string" ? candidate : JSON.stringify(candidate);
    const arrMatch = text.match(/\\?"conversation_?ids\\?"\s*:\s*\[([^\]]*)\]/i);
    if (arrMatch) {
      for (const m of arrMatch[1].matchAll(/\\?"([^"\\]+)\\?"/g)) {
        if (m[1]) ids.add(m[1]);
      }
    }
  }
  const singleId = extractChildConversationId(event);
  if (singleId) ids.add(singleId);
  return [...ids];
}

function extractLspErrorText(event) {
  if (event.error) return typeof event.error === "string" ? event.error : JSON.stringify(event.error);
  for (const candidate of [event.toolResult, event.output, event.result, event.response, event.tool_response]) {
    if (candidate != null) {
      return typeof candidate === "string" ? candidate : JSON.stringify(candidate);
    }
  }
  return "";
}

function handlePostToolUse(event, root, baseCwd, sessionFile, now) {
  const convId = str(event.conversationId);
  const toolCall = parseJsonObject(event.toolCall);
  const toolName = (str(toolCall.name) ?? "").toLowerCase();
  if (!toolName) return {};

  const args = parseJsonObject(toolCall.args);

  if (isLspToolCall(toolName, args)) {
    const target = inferLspCircuitTarget(toolName, args);
    const failed = isLspFailureOrTimeout(event);
    const errorText = failed ? extractLspErrorText(event) : "";
    recordLspOutcome(root, target, { failed, errorText }, { now });

    if (convId) {
      const state = loadSessions(sessionFile, now);
      if (state.conversations[convId]) {
        const conv = ensureConv(state, convId, now);
        const before = conv.dirtyFiles.length;
        if (!failed) {
          let lspArgs = null;
          if (toolName === "call_mcp_tool") {
            const mcpTool = str(args.ToolName) ?? str(args.toolName) ?? str(args.tool_name);
            if (mcpTool === "get_diagnostics") lspArgs = parseJsonObject(args.Arguments ?? args.arguments);
          } else if (/^mcp_+.*lsp.*get_diagnostics$/i.test(toolName)) {
            lspArgs = args;
          }
          if (lspArgs) {
            const checked = argPaths(lspArgs, true).map((p) => toRepoRelative(p, baseCwd, root)).filter(Boolean);
            if (checked.length > 0) {
              conv.dirtyFiles = conv.dirtyFiles.filter(
                (f) => !checked.some((c) => f === c || f.startsWith(c.endsWith("/") ? c : `${c}/`))
              );
            }
          }
        }
        if (conv.dirtyFiles.length !== before) saveSessions(sessionFile, state, now);
      }
    }
    return {};
  }

  if (event.error) {
    const errText = extractLspErrorText(event);
    if (convId) recordSessionToolOutcome(root, convId, { failed: true, errorText: errText }, { now });
    appendFriction(root, {
      type:
        toolName === "invoke_subagent" || toolName === "swarm"
          ? "subagent-dispatch-error"
          : isLspToolCall(toolName, args)
          ? "lsp-tool-error"
          : toolName === "call_mcp_tool" || /^mcp_+/i.test(toolName)
          ? "mcp-tool-error"
          : "tool-execution-error",
      harness: "agy",
      tool: toolName,
      summary: errText.slice(0, 200),
    });
    return {};
  }
  if (!convId) return {};
  recordSessionToolOutcome(root, convId, { failed: false }, { now });

  const state = loadSessions(sessionFile, now);
  let dirty = false;

  const eventRole = (str(event.agentName) ?? str(event.agentType) ?? str(event.subagentType) ?? "").toLowerCase();
  if (KNOWN_ROLES.has(eventRole)) {
    const conv = ensureConv(state, convId, now);
    if (conv.role !== eventRole) {
      conv.role = eventRole;
      dirty = true;
    }
  }

  let writePaths = null;
  if (WRITE_TOOLS.has(toolName) || MCP_FS_LIFECYCLE_RE.test(toolName)) {
    writePaths = argPaths(args, true);
  } else if (toolName === "call_mcp_tool") {
    const server = str(args.ServerName) ?? str(args.serverName) ?? str(args.server_name);
    const mcpTool = str(args.ToolName) ?? str(args.toolName) ?? str(args.tool_name);
    if (server === "filesystem" && mcpTool && ["write_file", "append_file", "edit_file", "move_file"].includes(mcpTool)) {
      writePaths = argPaths(parseJsonObject(args.Arguments ?? args.arguments), true);
    }
  } else if (toolName === "invoke_subagent") {
    const typeName = (
      str(args.TypeName) ??
      str(args.typeName) ??
      str(args.subagent_type) ??
      str(args.agent_type) ??
      ""
    ).toLowerCase();
    if (KNOWN_ROLES.has(typeName)) {
      const childConvId = extractChildConversationId(event);
      if (childConvId) {
        const child = ensureConv(state, childConvId, now);
        child.role = typeName;
      } else {
        const promptSnippet = (str(args.Prompt) ?? str(args.prompt) ?? "").trim().slice(0, 300);
        if (promptSnippet.length >= 20) {
          state.pendingDispatches.push({ role: typeName, promptSnippet, createdAt: now });
        }
      }
      dirty = true;
    }
    const promptText = str(args.Prompt) ?? str(args.prompt) ?? "";
    const refMatch = promptText.match(/^contract_ref:[ \t]*(\S+)/m);
    const contractRef = refMatch ? refMatch[1] : null;
    recordSessionDispatch(root, convId, { agentType: typeName, contractRef, summary: promptText.slice(0, 120) });
    const pDir = contractRef ? extractPlanDirFromPath(root, contractRef) : null;
    if (pDir) armSessionContinuation(root, convId, { planDir: pDir }, { now });
  } else if (toolName === "swarm" && String(args.action || "").toLowerCase() === "add") {
    const briefText = str(args.brief) ?? "";
    const refMatch = briefText.match(/^contract_ref:[ \t]*(\S+)/m);
    const contractRef = refMatch ? refMatch[1] : null;
    recordSessionDispatch(root, convId, { agentType: str(args.name) ?? "swarm", contractRef, summary: briefText.slice(0, 120) });
    const pDir = contractRef ? extractPlanDirFromPath(root, contractRef) : null;
    if (pDir) armSessionContinuation(root, convId, { planDir: pDir }, { now });

    const targetNames = computeSwarmTargetNames(args, event);
    if (targetNames.length > 0) {
      const existingUsed = state.usedSwarmNames[convId]?.names || [];
      state.usedSwarmNames[convId] = {
        names: [...new Set([...existingUsed, ...targetNames])],
        updatedAt: now,
      };
      dirty = true;
    }

    const swarmName = (str(args.name) ?? "").toLowerCase();
    const roleMatch = briefText.match(SWARM_ROLE_RE);
    const swarmRole = roleMatch ? roleMatch[1].toLowerCase() : KNOWN_ROLES.has(swarmName) ? swarmName : null;
    if (swarmRole) {
      for (const childId of extractChildConversationIds(event)) {
        const child = ensureConv(state, childId, now);
        child.role = swarmRole;
        dirty = true;
      }
      for (const wName of targetNames) {
        state.swarmWorkerRoles[wName] = { role: swarmRole, parentConvId: convId, createdAt: now };
        dirty = true;
      }
    }
  }

  if (writePaths && writePaths.length > 0) {
    recordSessionEdit(root, convId, writePaths);
    const conv = ensureConv(state, convId, now);
    for (const rawPath of writePaths) {
      const rel = toRepoRelative(rawPath, baseCwd, root);
      if (!rel) continue;
      const pDir = extractPlanDirFromPath(root, rel);
      if (pDir && !conv.role) {
        armSessionContinuation(root, convId, { planDir: pDir }, { now });
      }
      if (CODE_FILE_RE.test(rel)) {
        if (toolName === "delete_file") {
          const next = conv.dirtyFiles.filter((f) => f !== rel);
          if (next.length !== conv.dirtyFiles.length) {
            conv.dirtyFiles = next;
            dirty = true;
          }
        } else if (!conv.dirtyFiles.includes(rel)) {
          conv.dirtyFiles.push(rel);
          dirty = true;
        }
      }
      if (/\.proto$/i.test(rel) || (ROUTE_FILE_RE.test(rel) && CODEGEN_ROUTE_CREATE_TOOLS.has(toolName))) {
        if (!conv.codegenTouched) {
          conv.codegenTouched = true;
          dirty = true;
        }
      }
    }
  }

  if (dirty) saveSessions(sessionFile, state, now);
  return {};
}

function handlePreInvocation(event, root, sessionFile, now) {
  const convId = str(event.conversationId);
  const isMilestone = Number.isInteger(event.invocationNum) && event.invocationNum >= 30 && event.invocationNum % 30 === 0;
  if (convId) {
    const state = loadSessions(sessionFile, now);
    const existing = state.conversations[convId];
    if (!existing?.role) {
      let matchedRole = null;
      const directRole = (str(event.agentName) ?? str(event.agentType) ?? str(event.subagentType) ?? "").toLowerCase();
      if (KNOWN_ROLES.has(directRole)) {
        matchedRole = directRole;
      } else {
        const input = (str(event.lastUserInput) ?? "").trim();
        if (input.length >= 20) {
          const idx = state.pendingDispatches.findIndex(
            (d) =>
              d.promptSnippet.length >= 20 &&
              (input.startsWith(d.promptSnippet) || d.promptSnippet.startsWith(input.slice(0, 120)))
          );
          if (idx >= 0) {
            matchedRole = state.pendingDispatches[idx].role;
            state.pendingDispatches.splice(idx, 1);
          }
        }
        if (!matchedRole) {
          const transcriptPath = str(event.transcriptPath);
          if (transcriptPath) {
            const head = readTranscriptHead(transcriptPath, 4096);
            const assignMatch = head.match(/recorded on the board as #\d+ for @([a-z0-9_-]+)\):/i);
            if (assignMatch) {
              const workerName = assignMatch[1].toLowerCase();
              const mappedRole = str(state.swarmWorkerRoles?.[workerName]?.role);
              if (mappedRole && KNOWN_ROLES.has(mappedRole)) {
                matchedRole = mappedRole;
              } else {
                const after = head.slice(assignMatch.index);
                const endIdx = after.search(/\r?\n|<\/SYSTEM_MESSAGE>/);
                const assignLine = endIdx >= 0 ? after.slice(0, endIdx) : after;
                const roleInAssign = assignLine.match(SWARM_ROLE_RE);
                if (roleInAssign) matchedRole = roleInAssign[1].toLowerCase();
              }
            }
          }
        }
      }
      if (matchedRole) {
        const conv = ensureConv(state, convId, now);
        conv.role = matchedRole;
        saveSessions(sessionFile, state, now);
      } else if (root && event.invocationNum === 1 && str(event.lastUserInput)) {
        resetSessionTurnCounters(root, convId, { userPrompt: str(event.lastUserInput) }, { now });
      }
    }
  }

  if (isMilestone) {
    return {
      injectSteps: [
        {
          systemMessage: {
            systemMessage: `[continuous-checkpoint] Phiên đã qua lượt ${event.invocationNum}. Đồng bộ gọn 5 trường Phase Snapshot, giữ chặt bất biến đã khóa, treo riêng nhánh vướng Vùng Đỏ vào Hộp thư Quyết định (nếu có) và tiếp tục thực thi xuyên suốt các hạng mục độc lập còn mở (không kết thúc non khi acceptance còn khả thi).`,
          },
        },
      ],
    };
  }
  return {};
}

async function handlePostInvocation(event, root, sessionFile, now) {
  const convId = str(event.conversationId);
  if (!convId) return {};
  const state = loadSessions(sessionFile, now);
  const conv = state.conversations[convId];
  if (!conv || !Array.isArray(conv.dirtyFiles) || conv.dirtyFiles.length === 0) return {};

  const absFiles = conv.dirtyFiles.map((f) => join(root, f));
  const checkRes = await queryWarmLspCheck(absFiles, { timeoutMs: 2200 });
  if (!checkRes.ok) return {};

  let changed = false;
  const cleanSet = new Set();
  const errorFiles = [];
  for (const item of checkRes.results || []) {
    const rel = toRepoRelative(item.file, root, root);
    if (!rel) continue;
    if (!item.timedOut && !item.error && Array.isArray(item.diagnostics)) {
      if (item.diagnostics.length === 0) {
        cleanSet.add(rel);
        if (conv.lspAutoStrikes[rel]) {
          delete conv.lspAutoStrikes[rel];
          changed = true;
        }
      } else {
        errorFiles.push(rel);
      }
    }
  }

  if (cleanSet.size > 0) {
    conv.dirtyFiles = conv.dirtyFiles.filter((f) => !cleanSet.has(f));
    changed = true;
  }

  let shouldInject = false;
  for (const rel of errorFiles) {
    const strikes = Number(conv.lspAutoStrikes[rel] || 0);
    if (strikes < 2) {
      conv.lspAutoStrikes[rel] = strikes + 1;
      shouldInject = true;
      changed = true;
    }
  }
  if (changed) saveSessions(sessionFile, state, now);

  if (shouldInject && checkRes.totalErrors > 0) {
    const msg = formatWarmLspErrors(checkRes, root);
    if (msg) {
      return {
        injectSteps: [{ systemMessage: { systemMessage: msg } }],
        terminationBehavior: "force_continue",
      };
    }
  }
  return {};
}

function handleStop(event, root, sessionFile, now) {
  if (event.terminationReason !== "NO_TOOL_CALL" || event.continuationActive) {
    return { decision: "allow" };
  }
  const convId = str(event.conversationId);
  if (!convId) return { decision: "allow" };

  const state = loadSessions(sessionFile, now);
  const conv = state.conversations[convId] || null;

  const remainingDirty = (conv?.dirtyFiles || []).filter(
    (f) => checkLspCircuit(root, inferLspLanguage({ path: f }), { peek: true, now }).allowed
  );
  if (remainingDirty.length > 0) {
    const dirtyList = remainingDirty.join(", ");
    appendFriction(root, {
      type: "pre-handoff-unchecked-lsp",
      role: conv.role || "main",
      summary: `Dừng lượt khi còn file chưa kiểm tra tĩnh LSP: ${dirtyList.slice(0, 140)}`,
    });
    const codegenNote = conv.codegenTouched
      ? " Lưu ý điểm mù codegen: bạn đã chạm *.proto hoặc thêm/xóa route Frontend, nhớ ghi rõ trạng thái codegen trong báo cáo."
      : "";
    return {
      decision: "continue",
      reason: `[pre-handoff-gate] Bạn vừa sửa file code (${dirtyList}) nhưng chưa gọi kiểm tra tĩnh call_mcp_tool (lsp -> get_diagnostics) cho bản sửa cuối cùng (nếu chạy trong swarm không có call_mcp_tool, hãy ghi rõ trong báo cáo và kết thúc lượt).${codegenNote}`,
    };
  }

  if (conv && conv.codegenTouched) {
    conv.codegenTouched = false;
    conv.updatedAt = now;
    saveSessions(sessionFile, state, now);
  }

  if (!conv?.role) {
    const lastText = str(event.lastAssistantMessage) ?? str(event.response) ?? "";
    const lastUser = str(event.lastUserInput) ?? "";
    const gate = evaluateMainStopGate(
      root,
      convId,
      { lastAssistantText: lastText, lastUserText: lastUser },
      { now, maxPerTurn: 15 }
    );
    if (gate.decision === "block" && gate.reason) {
      return { decision: "continue", reason: gate.reason };
    }
  }
  return { decision: "allow" };
}

export async function evaluateAgyLifecycle(rawEvent, options = {}) {
  let fallback = {};
  try {
    const event = parseJsonObject(rawEvent);
    const hookEventName = str(event.hookEventName) ?? "";
    if (hookEventName === "Stop") fallback = { decision: "allow" };
    if (!hookEventName) return fallback;

    const callerCwd = str(options.callerCwd);
    const workspaceFirst = Array.isArray(event.workspacePaths) ? str(event.workspacePaths[0]) : null;
    const root = findRepoRoot(str(event.cwd)) ?? findRepoRoot(workspaceFirst) ?? findRepoRoot(callerCwd) ?? findRepoRoot(HERE);
    if (!root) return fallback;

    const baseCwd = str(event.cwd) ?? workspaceFirst ?? callerCwd ?? root;
    const sessionFile = join(root, SESSIONS_REL);
    const now = Date.now();

    if (hookEventName === "PostToolUse") {
      return handlePostToolUse(event, root, baseCwd, sessionFile, now);
    }
    if (hookEventName === "PreInvocation") {
      return handlePreInvocation(event, root, sessionFile, now);
    }
    if (hookEventName === "PostInvocation") {
      return await handlePostInvocation(event, root, sessionFile, now);
    }
    if (hookEventName === "Stop") {
      return handleStop(event, root, sessionFile, now);
    }
  } catch {
    // Fail-open có chủ đích: không làm kẹt agent khi hook lỗi.
  }
  return fallback;
}
