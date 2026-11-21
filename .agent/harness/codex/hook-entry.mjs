#!/usr/bin/env node
/**
 * OpenAI Codex CLI PreToolUse Hook Entry.
 * Chuẩn hóa shell / apply_patch / file edits / LSP circuit / specialist dispatch qua `agent-lifecycle-core.mjs`
 * rồi kiểm tra qua `evaluateBoundaryChecks` (fail-open tuyệt đối).
 */
import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateBoundaryChecks } from "../../scripts/agent-boundary-guard.mjs";
import {
  checkLspCircuit,
  findRepoRoot,
  inferLspLanguage,
  isLspToolCall,
  normalizeToolChecks,
} from "../../scripts/agent-lifecycle-core.mjs";
import { prepareDispatchAssignment } from "../../scripts/dispatch-contract.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const CODING_SPECIALISTS = new Set(["backend-specialist", "frontend-specialist", "test-author"]);

function deny(reason) {
  process.stdout.write(
    `${JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason,
      },
      systemMessage: `[boundary-guard] ${reason}`,
    })}\n`
  );
  process.exit(0);
}

try {
  const raw = readFileSync(0, "utf8");
  if (!raw.trim()) process.exit(0);

  const payload = JSON.parse(raw);
  const baseCwd = payload.cwd || process.cwd();
  const root = findRepoRoot(baseCwd) ?? findRepoRoot(process.cwd()) ?? findRepoRoot(HERE);
  if (!root) process.exit(0);

  const toolName = payload.tool_name || payload.toolName || "";
  const toolInput = payload.tool_input ?? payload.input ?? {};

  if (toolName === "Task" || toolName === "spawn_agent") {
    const subType = String(toolInput.subagent_type ?? toolInput.agent_type ?? toolInput.role ?? "")
      .trim()
      .toLowerCase();
    if (CODING_SPECIALISTS.has(subType)) {
      const prompt = String(toolInput.prompt ?? toolInput.message ?? "");
      const lines = prompt
        .trim()
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length === 2 && lines.every((line) => /^contract_(?:ref|version):/.test(line))) {
        try {
          const hydrated = prepareDispatchAssignment(root, prompt);
          process.stdout.write(
            `${JSON.stringify({
              hookSpecificOutput: {
                hookEventName: "PreToolUse",
                permissionDecision: "allow",
                updatedInput: { ...toolInput, prompt: hydrated },
              },
            })}\n`
          );
          process.exit(0);
        } catch (err) {
          deny(`[dispatch-gate] ${err.message}`);
        }
      }
      const hasScope = /\ballowed_paths\b|\bcontract_ref:/i.test(prompt);
      const hasAcceptance = /\bacceptance\b|tiêu\s+chí\s+nghiệm\s+thu/i.test(prompt);
      if (!hasScope || !hasAcceptance) {
        deny(
          "Giao việc cho specialist viết code bắt buộc phải ghi rõ phạm vi đường dẫn (`allowed_paths` hoặc `contract_ref:`) VÀ tiêu chí nghiệm thu (`acceptance` hoặc `Tiêu chí nghiệm thu`)."
        );
      }
    }
    process.exit(0);
  }

  if (isLspToolCall(toolName, toolInput)) {
    const circuit = checkLspCircuit(root, inferLspLanguage(toolInput));
    if (!circuit.allowed) deny(circuit.reason);
    process.exit(0);
  }

  const checks = normalizeToolChecks(toolName, toolInput, baseCwd);
  if (checks.length === 0) process.exit(0);

  const agentName = payload.agent_type || payload.subagent_type || undefined;
  const reason = evaluateBoundaryChecks(checks, { root, agentName });
  if (reason) deny(reason);
} catch {
  // Fail-open có chủ đích: lỗi nội bộ không làm kẹt tool call.
}

process.exit(0);
