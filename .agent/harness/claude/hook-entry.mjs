#!/usr/bin/env node
/**
 * Claude Code Hook Entry (PreToolUse, PostToolUse, PreCompact, Stop, SubagentStop).
 * Có thể chạy trực tiếp qua Node fallback hoặc nạp in-process qua Warm LSP Daemon (`cogain-hook claude`).
 * Fail-open tuyệt đối: lỗi nội bộ không bao giờ làm kẹt tool call.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateBoundaryChecks } from "../../scripts/agent-boundary-guard.mjs";
import { prepareDispatchAssignment } from "../../scripts/dispatch-contract.mjs";
import {
  armSessionContinuation,
  checkLspCircuit,
  checkSubagentStopGate,
  evaluateMainStopGate,
  extractPlanDirFromPath,
  findRepoRoot,
  formatWarmLspErrors,
  getCompactionSummary,
  inferLspCircuitTarget,
  isLspFailureOrTimeout,
  isLspToolCall,
  markSessionFilesChecked,
  normalizeToolChecks,
  queryWarmLspCheck,
  recordAgentFriction,
  recordLspOutcome,
  recordSessionDispatch,
  recordSessionEdit,
  recordSessionToolOutcome,
  updateSessionTodoState,
} from "../../scripts/agent-lifecycle-core.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const CODING_SPECIALISTS = new Set(["backend-specialist", "frontend-specialist", "test-author"]);

function preToolDeny(reason, updatedInput = null) {
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason,
      ...(updatedInput ? { updatedInput } : {}),
    },
    systemMessage: `[boundary-guard] ${reason}`,
  };
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

function extractLspErrorText(payload) {
  if (payload?.error) return typeof payload.error === "string" ? payload.error : JSON.stringify(payload.error);
  for (const candidate of [payload?.tool_response, payload?.toolResult, payload?.output, payload?.result, payload?.response]) {
    if (candidate != null) {
      return typeof candidate === "string" ? candidate : JSON.stringify(candidate);
    }
  }
  return "";
}

function extractCogainLspCheckedPaths(command) {
  const m = /\bcogain-lsp\s+check\b([^;|&`\n]*)/i.exec(String(command || ""));
  if (!m) return [];
  const rawTokens = m[1].match(/(?:"[^"]*"|'[^']*'|[^\s"']+)/g) || [];
  const out = [];
  for (const tok of rawTokens) {
    const cleaned = tok.replace(/^["']|["']$/g, "");
    if (!cleaned || cleaned.startsWith("-")) continue;
    out.push(cleaned);
  }
  return out;
}

function handleDispatchPreToolUse(toolInput, root) {
  const subagentType = (str(toolInput.subagent_type) ?? str(toolInput.agent_type) ?? "").trim().toLowerCase();
  if (!CODING_SPECIALISTS.has(subagentType)) return {};

  const prompt = str(toolInput.prompt) ?? "";
  const lines = prompt
    .trim()
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 2 && lines.every((line) => /^contract_(?:ref|version):/.test(line))) {
    try {
      const hydrated = prepareDispatchAssignment(root, prompt);
      return {
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "allow",
          updatedInput: { ...toolInput, prompt: hydrated },
        },
      };
    } catch (err) {
      return preToolDeny(`[dispatch-gate] ${err.message}`);
    }
  }

  const hasScope = /\ballowed_paths\b|\bcontract_ref:/i.test(prompt);
  const hasAcceptance = /\bacceptance\b|tiêu\s+chí\s+nghiệm\s+thu/i.test(prompt);
  if (!hasScope || !hasAcceptance) {
    return preToolDeny(
      "Giao việc cho specialist viết code bắt buộc phải ghi rõ phạm vi đường dẫn (`allowed_paths` hoặc `contract_ref:`) VÀ tiêu chí nghiệm thu (`acceptance` hoặc `Tiêu chí nghiệm thu`)."
    );
  }
  return {};
}

export async function evaluateClaudeHook(payload, options = {}) {
  try {
    if (!payload || typeof payload !== "object") return {};

    const eventName = str(payload.hook_event_name) ?? "";
    const sessionId = str(payload.session_id) ?? "default";
    const callerCwd = str(options.callerCwd);
    const baseCwd = str(payload.cwd) ?? callerCwd ?? process.cwd();
    const root = findRepoRoot(baseCwd) ?? findRepoRoot(callerCwd) ?? findRepoRoot(HERE);
    if (!root) return {};

    const toolName = str(payload.tool_name) ?? "";
    const toolInput = payload.tool_input && typeof payload.tool_input === "object" ? payload.tool_input : {};

    if (eventName === "PreToolUse") {
      if (toolName === "Task" || toolName === "Agent") {
        return handleDispatchPreToolUse(toolInput, root);
      }
      if (isLspToolCall(toolName, toolInput)) {
        const circuit = checkLspCircuit(root, inferLspCircuitTarget(toolName, toolInput));
        if (!circuit.allowed) return preToolDeny(circuit.reason);
        return {};
      }
      const checks = normalizeToolChecks(toolName, toolInput, baseCwd);
      if (checks.length === 0) return {};
      const agentName = str(payload.agent_type) ?? str(payload.subagent_type) ?? undefined;
      const reason = evaluateBoundaryChecks(checks, { root, agentName });
      if (reason) return preToolDeny(reason);
      return {};
    }

    if (eventName === "PostToolUse") {
      const errText = str(payload.error) ?? (payload.is_error ? extractLspErrorText(payload) : null);
      recordSessionToolOutcome(root, sessionId, { failed: Boolean(errText), errorText: errText ?? "" });
      if (
        errText &&
        (toolName === "Task" || toolName === "Agent" || /^mcp__/i.test(toolName) || toolName === "call_mcp_tool") &&
        !isLspToolCall(toolName, toolInput)
      ) {
        recordAgentFriction(root, {
          type: toolName === "Task" || toolName === "Agent" ? "subagent-dispatch-error" : "mcp-tool-error",
          harness: "claude",
          tool: toolName,
          summary: errText.slice(0, 200),
        });
      }
      if (toolName === "TodoWrite" && Array.isArray(toolInput.todos)) {
        const openTodos = toolInput.todos.filter((t) => t && (t.status === "pending" || t.status === "in_progress"));
        const completedTodos = toolInput.todos.filter((t) => t && t.status === "completed");
        updateSessionTodoState(root, sessionId, {
          openCount: openTodos.length,
          completedCount: completedTodos.length,
          sample: openTodos.map((t) => str(t.content)).filter(Boolean).slice(0, 5),
        });
        return {};
      }
      if (toolName === "Task" || toolName === "Agent") {
        const prompt = str(toolInput.prompt) ?? "";
        const refMatch = prompt.match(/^contract_ref:[ \t]*(\S+)/m);
        const contractRef = refMatch ? refMatch[1] : null;
        recordSessionDispatch(root, sessionId, {
          agentType: str(toolInput.subagent_type) ?? str(toolInput.agent_type),
          contractRef,
          summary: str(toolInput.description) ?? prompt.slice(0, 140),
        });
        const pDir = contractRef ? extractPlanDirFromPath(root, contractRef) : null;
        if (pDir) armSessionContinuation(root, sessionId, { planDir: pDir });
        return {};
      }

      if (isLspToolCall(toolName, toolInput)) {
        const target = inferLspCircuitTarget(toolName, toolInput);
        const failed = isLspFailureOrTimeout(payload);
        const errorText = failed ? extractLspErrorText(payload) : "";
        recordLspOutcome(root, target, { failed, errorText });
        if (!failed) {
          const mcpTool = str(toolInput.ToolName) ?? str(toolInput.toolName) ?? str(toolInput.tool_name);
          const isDiagnostics =
            /get_diagnostics$/i.test(toolName) || (toolName === "call_mcp_tool" && mcpTool === "get_diagnostics");
          if (isDiagnostics) {
            const lspArgs =
              toolName === "call_mcp_tool" ? parseJsonObject(toolInput.Arguments ?? toolInput.arguments) : toolInput;
            const lspPaths = [str(lspArgs.file_path), str(lspArgs.path), str(lspArgs.Path), str(lspArgs.uri)].filter(
              Boolean
            );
            markSessionFilesChecked(root, sessionId, lspPaths.length > 0 ? lspPaths : null);
          }
        }
        return {};
      }

      if (toolName === "Bash" && !errText) {
        const checkedPaths = extractCogainLspCheckedPaths(toolInput.command);
        if (checkedPaths.length > 0) {
          markSessionFilesChecked(
            root,
            sessionId,
            checkedPaths.map((p) => (p.startsWith("/") ? p : resolve(baseCwd, p)))
          );
        }
      }

      const checks = normalizeToolChecks(toolName, toolInput, baseCwd);
      const edited = checks.map((c) => c.tool_input?.file_path).filter(Boolean);
      if (edited.length > 0) {
        recordSessionEdit(root, sessionId, edited);
        for (const p of edited) {
          const pDir = extractPlanDirFromPath(root, p);
          if (pDir) armSessionContinuation(root, sessionId, { planDir: pDir });
        }
        const codeEdited = edited.filter((p) => /\.(?:cs|ts|tsx)$/i.test(p));
        if (codeEdited.length > 0) {
          const checkRes = await queryWarmLspCheck(codeEdited, { timeoutMs: 2200 });
          if (checkRes.ok) {
            const cleanFiles = (checkRes.results || [])
              .filter((r) => !r.timedOut && !r.error && Array.isArray(r.diagnostics) && r.diagnostics.length === 0)
              .map((r) => r.file);
            if (cleanFiles.length > 0) markSessionFilesChecked(root, sessionId, cleanFiles);
            if (checkRes.totalErrors > 0) {
              const msg = formatWarmLspErrors(checkRes, root);
              if (msg) {
                return {
                  hookSpecificOutput: {
                    hookEventName: "PostToolUse",
                    additionalContext: msg,
                  },
                };
              }
            }
          }
        }
      }
      return {};
    }

    if (eventName === "PreCompact") {
      const summary = getCompactionSummary(root, sessionId);
      if (summary) return { systemMessage: summary };
      return {};
    }

    if (eventName === "Stop") {
      const gate = evaluateMainStopGate(root, sessionId, {
        lastAssistantText: str(payload.last_assistant_message) ?? "",
      });
      if (gate.decision === "block" && gate.reason) {
        return { decision: "block", reason: gate.reason };
      }
      return {};
    }

    if (eventName === "SubagentStop") {
      if (payload.stop_hook_active) return {};
      const gate = checkSubagentStopGate(root, sessionId, payload);
      if (gate.decision === "block" && gate.reason) {
        return { decision: "block", reason: gate.reason };
      }
      return {};
    }
  } catch {
    // Fail-open có chủ đích: lỗi nội bộ không làm kẹt vòng lặp agent.
  }
  return {};
}

const isMainEntry = Boolean(process.argv[1]) && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainEntry) {
  try {
    const raw = readFileSync(0, "utf8");
    if (!raw.trim()) process.exit(0);
    const result = await evaluateClaudeHook(JSON.parse(raw));
    if (result && Object.keys(result).length > 0) {
      process.stdout.write(`${JSON.stringify(result)}\n`);
    }
  } catch {
    // Fail-open
  }
  process.exit(0);
}
