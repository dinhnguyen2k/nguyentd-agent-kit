#!/usr/bin/env node
/**
 * Claude Code Hook Entry (PreToolUse, PostToolUse, PreCompact, SubagentStop).
 * Dùng chung lõi `agent-lifecycle-core.mjs`, `agent-boundary-guard.mjs` và `dispatch-contract.mjs`.
 * Fail-open tuyệt đối: lỗi nội bộ không bao giờ làm kẹt tool call.
 */
import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateBoundaryChecks } from "../../scripts/agent-boundary-guard.mjs";
import { prepareDispatchAssignment } from "../../scripts/dispatch-contract.mjs";
import {
  checkSubagentStopGate,
  findRepoRoot,
  getCompactionSummary,
  markSessionFilesChecked,
  normalizeToolChecks,
  recordSessionDispatch,
  recordSessionEdit,
} from "../../scripts/agent-lifecycle-core.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const CODING_SPECIALISTS = new Set(["backend-specialist", "frontend-specialist", "test-author"]);

function out(obj) {
  process.stdout.write(`${JSON.stringify(obj)}\n`);
  process.exit(0);
}

function denyPreToolUse(reason, updatedInput = null) {
  out({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason,
      ...(updatedInput ? { updatedInput } : {}),
    },
    systemMessage: `[boundary-guard] ${reason}`,
  });
}

function str(value) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function handleDispatchPreToolUse(toolInput, root) {
  const subagentType = (str(toolInput.subagent_type) ?? str(toolInput.agent_type) ?? "").trim().toLowerCase();
  if (!CODING_SPECIALISTS.has(subagentType)) return;

  const prompt = str(toolInput.prompt) ?? "";
  const lines = prompt
    .trim()
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 2 && lines.every((line) => /^contract_(?:ref|version):/.test(line))) {
    try {
      const hydrated = prepareDispatchAssignment(root, prompt);
      out({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "allow",
          updatedInput: { ...toolInput, prompt: hydrated },
        },
      });
    } catch (err) {
      denyPreToolUse(`[dispatch-gate] ${err.message}`);
    }
  }

  const hasScope = /\ballowed_paths\b|\bcontract_ref:/i.test(prompt);
  const hasAcceptance = /\bacceptance\b|tiêu\s+chí\s+nghiệm\s+thu/i.test(prompt);
  if (!hasScope || !hasAcceptance) {
    denyPreToolUse(
      "Giao việc cho specialist viết code bắt buộc phải ghi rõ phạm vi đường dẫn (`allowed_paths` hoặc `contract_ref:`) VÀ tiêu chí nghiệm thu (`acceptance` hoặc `Tiêu chí nghiệm thu`)."
    );
  }
}

try {
  const raw = readFileSync(0, "utf8");
  if (!raw.trim()) process.exit(0);

  const payload = JSON.parse(raw);
  const eventName = str(payload.hook_event_name) ?? "";
  const sessionId = str(payload.session_id) ?? "default";
  const baseCwd = str(payload.cwd) ?? process.cwd();
  const root = findRepoRoot(baseCwd) ?? findRepoRoot(process.cwd()) ?? findRepoRoot(HERE);
  if (!root) process.exit(0);

  const toolName = str(payload.tool_name) ?? "";
  const toolInput = payload.tool_input && typeof payload.tool_input === "object" ? payload.tool_input : {};

  if (eventName === "PreToolUse") {
    if (toolName === "Task" || toolName === "Agent") {
      handleDispatchPreToolUse(toolInput, root);
      process.exit(0);
    }
    const checks = normalizeToolChecks(toolName, toolInput, baseCwd);
    if (checks.length === 0) process.exit(0);
    const agentName = str(payload.agent_type) ?? str(payload.subagent_type) ?? undefined;
    const reason = evaluateBoundaryChecks(checks, { root, agentName });
    if (reason) denyPreToolUse(reason);
    process.exit(0);
  }

  if (eventName === "PostToolUse") {
    if (toolName === "Task" || toolName === "Agent") {
      const prompt = str(toolInput.prompt) ?? "";
      const refMatch = prompt.match(/^contract_ref:[ \t]*(\S+)/m);
      recordSessionDispatch(root, sessionId, {
        agentType: str(toolInput.subagent_type) ?? str(toolInput.agent_type),
        contractRef: refMatch ? refMatch[1] : null,
        summary: str(toolInput.description) ?? prompt.slice(0, 140),
      });
      process.exit(0);
    }

    if (/^mcp_+.*lsp.*get_diagnostics$/i.test(toolName)) {
      const lspPaths = [str(toolInput.file_path), str(toolInput.path), str(toolInput.Path)].filter(Boolean);
      markSessionFilesChecked(root, sessionId, lspPaths.length > 0 ? lspPaths : null);
      process.exit(0);
    }

    const checks = normalizeToolChecks(toolName, toolInput, baseCwd);
    const edited = checks.map((c) => c.tool_input?.file_path).filter(Boolean);
    if (edited.length > 0) recordSessionEdit(root, sessionId, edited);
    process.exit(0);
  }

  if (eventName === "PreCompact") {
    const summary = getCompactionSummary(root, sessionId);
    if (summary) out({ systemMessage: summary });
    process.exit(0);
  }

  if (eventName === "SubagentStop") {
    if (payload.stop_hook_active) process.exit(0);
    const gate = checkSubagentStopGate(root, sessionId, payload);
    if (gate.decision === "block" && gate.reason) {
      out({ decision: "block", reason: gate.reason });
    }
    process.exit(0);
  }
} catch {
  // Fail-open có chủ đích: lỗi nội bộ không làm kẹt vòng lặp agent.
}

process.exit(0);
