#!/usr/bin/env node
/**
 * OpenAI Codex CLI PreToolUse Hook Entry.
 * Chuẩn hóa shell / apply_patch / file edits qua `agent-lifecycle-core.mjs`
 * rồi kiểm tra qua `evaluateBoundaryChecks` (fail-open tuyệt đối).
 */
import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateBoundaryChecks } from "../../scripts/agent-boundary-guard.mjs";
import { findRepoRoot, normalizeToolChecks } from "../../scripts/agent-lifecycle-core.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

try {
  const raw = readFileSync(0, "utf8");
  if (!raw.trim()) process.exit(0);

  const payload = JSON.parse(raw);
  const baseCwd = payload.cwd || process.cwd();
  const root = findRepoRoot(baseCwd) ?? findRepoRoot(process.cwd()) ?? findRepoRoot(HERE);
  if (!root) process.exit(0);

  const toolName = payload.tool_name || payload.toolName || "";
  const toolInput = payload.tool_input ?? payload.input ?? {};
  const checks = normalizeToolChecks(toolName, toolInput, baseCwd);
  if (checks.length === 0) process.exit(0);

  const agentName = payload.agent_type || payload.subagent_type || undefined;
  const reason = evaluateBoundaryChecks(checks, { root, agentName });
  if (reason) {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: reason,
        },
        systemMessage: `[boundary-guard] ${reason}`,
      })
    );
  }
} catch {
  // Fail-open có chủ đích: lỗi nội bộ không làm kẹt tool call.
}

process.exit(0);
