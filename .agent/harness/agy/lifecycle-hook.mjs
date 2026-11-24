#!/usr/bin/env node
/**
 * Antigravity (AGY) Lifecycle Hook: xử lý PostToolUse, PreInvocation và Stop.
 * - PostToolUse: theo dõi dirty code files, codegen (.proto/routes), xóa dirty khi lsp->get_diagnostics chạy, ghi nhận role subagent.
 * - PreInvocation: phát nhịp đồng bộ tiến độ xuyên suốt mỗi 30 lượt (30, 60, 90...); giữ `{}` các lượt khác để bảo toàn prompt cache.
 * - Stop: nhắc 1 lần duy nhất (chỉ khi NO_TOOL_CALL && !continuationActive) nếu còn dirty files chưa kiểm tra tĩnh, đồng thời ghi nhận ma sát tự động.
 * Fail-open có chủ đích: lỗi nội bộ không bao giờ làm kẹt vòng lặp agent.
 */
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, readSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
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
const KNOWN_ROLES = new Set([
  "backend-specialist",
  "frontend-specialist",
  "test-author",
  "verifier",
  "researcher",
  "reviewer",
]);
const SWARM_ROLE_RE = /\.agents?\/agents\/(backend-specialist|frontend-specialist|test-author|verifier|researcher|reviewer)\.md/i;
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
const MCP_FS_WRITE_TOOLS = new Set(["write_file", "append_file", "edit_file", "move_file"]);
const MCP_FS_TOOL_RE = /^mcp_+filesystem_+(write_file|append_file|edit_file|move_file)$/;
const CODEGEN_ROUTE_CREATE_TOOLS = new Set(["write_file", "write_to_file", "create_file", "delete_file", "write"]);
const CODE_FILE_RE = /^(?:backend\/src|frontend)\/.*\.(?:cs|ts|tsx)$/i;
const ROUTE_FILE_RE = /^frontend\/[^/]+\/src\/routes\//;

function out(obj) {
  process.stdout.write(`${JSON.stringify(obj)}\n`);
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

function argPaths(args) {
  const single = ["Path", "TargetFile", "file_path", "filePath", "path", "notebook_path", "destination", "uri"].map(
    (k) => str(args[k])
  );
  const many = Array.isArray(args.paths) ? args.paths.map(str) : [];
  return [...new Set([...single, ...many].filter((p) => p !== null))];
}

function toRepoRelative(rawPath, baseCwd, root) {
  if (!rawPath) return null;
  const cleaned = rawPath.startsWith("file://") ? rawPath.slice(7) : rawPath;
  const abs = isAbsolute(cleaned) ? resolve(cleaned) : resolve(baseCwd, cleaned);
  const rel = relative(resolve(root), abs).replace(/\\/g, "/");
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) return null;
  return rel;
}

function pruneState(state, now) {
  const conversations = {};
  for (const [id, entry] of Object.entries(state.conversations || {})) {
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
  const pendingDispatches = (state.pendingDispatches || [])
    .filter((d) => d && now - (d.createdAt || 0) <= SESSION_TTL_MS)
    .slice(-30);
  const swarmWorkerRoles = {};
  for (const [name, entry] of Object.entries(state.swarmWorkerRoles || {})) {
    if (entry && str(entry.role) && now - (entry.createdAt || 0) <= SESSION_TTL_MS) {
      swarmWorkerRoles[name] = {
        role: entry.role,
        parentConvId: str(entry.parentConvId) ?? "",
        createdAt: entry.createdAt || now,
      };
    }
  }
  const usedSwarmNames = {};
  for (const [cid, entry] of Object.entries(state.usedSwarmNames || {})) {
    if (entry && Array.isArray(entry.names) && now - (entry.updatedAt || 0) <= SESSION_TTL_MS) {
      usedSwarmNames[cid] = {
        names: [...new Set(entry.names.map((n) => String(n).toLowerCase()).filter(Boolean))],
        updatedAt: entry.updatedAt || now,
      };
    }
  }
  return { version: 1, conversations, pendingDispatches, swarmWorkerRoles, usedSwarmNames };
}

function loadSessions(sessionFile, now) {
  try {
    if (!existsSync(sessionFile)) {
      return { version: 1, conversations: {}, pendingDispatches: [], swarmWorkerRoles: {}, usedSwarmNames: {} };
    }
    return pruneState(JSON.parse(readFileSync(sessionFile, "utf8")), now);
  } catch {
    return { version: 1, conversations: {}, pendingDispatches: [], swarmWorkerRoles: {}, usedSwarmNames: {} };
  }
}

function saveSessions(sessionFile, state, now) {
  try {
    mkdirSync(dirname(sessionFile), { recursive: true });
    writeFileSync(sessionFile, JSON.stringify(pruneState(state, now), null, 2));
  } catch {
    /* ignore */
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
          /* ignore non-JSON string */
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
    if (typeof candidate === "object") {
      inspectObj(candidate);
    } else if (typeof candidate === "string") {
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
  }
  return [...new Set(names)];
}

function computeSwarmTargetNames(args, event) {
  const fromResult = extractSwarmResultNames(event);
  if (fromResult.length > 0) return fromResult;
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
            const checked = argPaths(lspArgs).map((p) => toRepoRelative(p, baseCwd, root)).filter(Boolean);
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
  if (WRITE_TOOLS.has(toolName) || MCP_FS_TOOL_RE.test(toolName)) {
    writePaths = argPaths(args);
  } else if (toolName === "call_mcp_tool") {
    const server = str(args.ServerName) ?? str(args.serverName) ?? str(args.server_name);
    const mcpTool = str(args.ToolName) ?? str(args.toolName) ?? str(args.tool_name);
    if (server === "filesystem" && mcpTool && MCP_FS_WRITE_TOOLS.has(mcpTool)) {
      writePaths = argPaths(parseJsonObject(args.Arguments ?? args.arguments));
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

function appendFriction(root, entry) {
  try {
    const file = join(root, FRICTION_REL);
    mkdirSync(dirname(file), { recursive: true });
    appendFileSync(file, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`);
  } catch {
    /* fail-open */
  }
}

function handlePreInvocation(event, root, sessionFile, now) {
  const convId = str(event.conversationId);
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

  if (Number.isInteger(event.invocationNum) && event.invocationNum >= 30 && event.invocationNum % 30 === 0) {
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

let fallback = {};
try {
  const raw = readFileSync(0, "utf8");
  if (!raw.trim()) out({});
  const event = parseJsonObject(raw);
  const hookEventName = str(event.hookEventName) ?? "";
  if (hookEventName === "Stop") fallback = { decision: "allow" };

  const workspaceFirst = Array.isArray(event.workspacePaths) ? str(event.workspacePaths[0]) : null;
  const root = findRepoRoot(str(event.cwd)) ?? findRepoRoot(workspaceFirst) ?? findRepoRoot(HERE);
  if (!root) out(fallback);

  const baseCwd = str(event.cwd) ?? workspaceFirst ?? root;
  const sessionFile = join(root, SESSIONS_REL);
  const now = Date.now();

  if (hookEventName === "PostToolUse") {
    out(handlePostToolUse(event, root, baseCwd, sessionFile, now));
  }
  if (hookEventName === "PreInvocation") {
    out(handlePreInvocation(event, root, sessionFile, now));
  }
  if (hookEventName === "PostInvocation") {
    out(await handlePostInvocation(event, root, sessionFile, now));
  }
  if (hookEventName === "Stop") {
    out(handleStop(event, root, sessionFile, now));
  }
} catch {
  // Fail-open có chủ đích: không làm kẹt agent khi hook lỗi.
}

out(fallback);
