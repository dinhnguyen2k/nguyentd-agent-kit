#!/usr/bin/env node
/**
 * Antigravity (AGY) Lifecycle Hook: xử lý PostToolUse, PreInvocation và Stop.
 * - PostToolUse: theo dõi dirty code files, codegen (.proto/routes), xóa dirty khi lsp->get_diagnostics chạy, ghi nhận role subagent.
 * - PreInvocation: phát nhịp đồng bộ tiến độ xuyên suốt mỗi 30 lượt (30, 60, 90...); giữ `{}` các lượt khác để bảo toàn prompt cache.
 * - Stop: nhắc 1 lần duy nhất (chỉ khi NO_TOOL_CALL && !continuationActive) nếu còn dirty files chưa kiểm tra tĩnh, đồng thời ghi nhận ma sát tự động.
 * Fail-open có chủ đích: lỗi nội bộ không bao giờ làm kẹt vòng lặp agent.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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
        codegenTouched: Boolean(entry.codegenTouched),
        updatedAt: entry.updatedAt || now,
      };
    }
  }
  const pendingDispatches = (state.pendingDispatches || [])
    .filter((d) => d && now - (d.createdAt || 0) <= SESSION_TTL_MS)
    .slice(-20);
  return { version: 1, conversations, pendingDispatches };
}

function loadSessions(sessionFile, now) {
  try {
    if (!existsSync(sessionFile)) return { version: 1, conversations: {}, pendingDispatches: [] };
    return pruneState(JSON.parse(readFileSync(sessionFile, "utf8")), now);
  } catch {
    return { version: 1, conversations: {}, pendingDispatches: [] };
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
    state.conversations[convId] = { role: null, dirtyFiles: [], codegenTouched: false, updatedAt: now };
  }
  state.conversations[convId].updatedAt = now;
  return state.conversations[convId];
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

function handlePostToolUse(event, root, baseCwd, sessionFile, now) {
  if (event.error) return {};
  const convId = str(event.conversationId);
  if (!convId) return {};

  const toolCall = parseJsonObject(event.toolCall);
  const toolName = (str(toolCall.name) ?? "").toLowerCase();
  if (!toolName) return {};

  const args = parseJsonObject(toolCall.args);
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
    } else if (server === "lsp" && mcpTool === "get_diagnostics") {
      const lspArgs = parseJsonObject(args.Arguments ?? args.arguments);
      const checked = argPaths(lspArgs).map((p) => toRepoRelative(p, baseCwd, root)).filter(Boolean);
      if (checked.length > 0 && state.conversations[convId]) {
        const conv = ensureConv(state, convId, now);
        const before = conv.dirtyFiles.length;
        conv.dirtyFiles = conv.dirtyFiles.filter(
          (f) => !checked.some((c) => f === c || f.startsWith(c.endsWith("/") ? c : `${c}/`))
        );
        if (conv.dirtyFiles.length !== before) dirty = true;
      }
    }
  } else if (/^mcp_+lsp_+get_diagnostics$/.test(toolName)) {
    const checked = argPaths(args).map((p) => toRepoRelative(p, baseCwd, root)).filter(Boolean);
    if (checked.length > 0 && state.conversations[convId]) {
      const conv = ensureConv(state, convId, now);
      const before = conv.dirtyFiles.length;
      conv.dirtyFiles = conv.dirtyFiles.filter(
        (f) => !checked.some((c) => f === c || f.startsWith(c.endsWith("/") ? c : `${c}/`))
      );
      if (conv.dirtyFiles.length !== before) dirty = true;
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
  }

  if (writePaths && writePaths.length > 0) {
    const conv = ensureConv(state, convId, now);
    for (const rawPath of writePaths) {
      const rel = toRepoRelative(rawPath, baseCwd, root);
      if (!rel) continue;
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

function handlePreInvocation(event, sessionFile, now) {
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
        const idx = state.pendingDispatches.findIndex(
          (d) =>
            d.promptSnippet.length >= 20 &&
            (input.startsWith(d.promptSnippet) || d.promptSnippet.startsWith(input.slice(0, 120)))
        );
        if (idx >= 0) {
          matchedRole = state.pendingDispatches[idx].role;
          state.pendingDispatches.splice(idx, 1);
        } else {
          const swarmMatch = input.match(
            /You have just started\. Your assignment[\s\S]{0,600}\.agents?\/agents\/(backend-specialist|frontend-specialist|test-author|verifier|researcher|reviewer)\.md/i
          );
          if (swarmMatch) matchedRole = swarmMatch[1].toLowerCase();
        }
      }
      if (matchedRole) {
        const conv = ensureConv(state, convId, now);
        conv.role = matchedRole;
        saveSessions(sessionFile, state, now);
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

function handleStop(event, root, sessionFile, now) {
  if (event.terminationReason !== "NO_TOOL_CALL" || event.continuationActive) {
    return { decision: "allow" };
  }
  const convId = str(event.conversationId);
  if (!convId) return { decision: "allow" };

  const state = loadSessions(sessionFile, now);
  const conv = state.conversations[convId];
  if (!conv) return { decision: "allow" };

  if (conv.dirtyFiles.length > 0) {
    const dirtyList = conv.dirtyFiles.join(", ");
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

  if (conv.codegenTouched) {
    conv.codegenTouched = false;
    conv.updatedAt = now;
    saveSessions(sessionFile, state, now);
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
    out(handlePreInvocation(event, sessionFile, now));
  }
  if (hookEventName === "Stop") {
    out(handleStop(event, root, sessionFile, now));
  }
} catch {
  // Fail-open có chủ đích: không làm kẹt agent khi hook lỗi.
}

out(fallback);
