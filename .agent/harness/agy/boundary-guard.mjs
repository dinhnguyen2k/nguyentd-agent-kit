#!/usr/bin/env node
/**
 * Đầu vào CLI mỏng cho Antigravity PreToolUse (dự phòng khi chưa dùng cogain-hook qua Unix Socket).
 * Logic đánh giá giữ ấm nằm tại ./hook-evaluator.mjs.
 */
import { readFileSync } from "node:fs";

function allow() {
  process.stdout.write('{"decision":"allow"}\n');
  process.exit(0);
}

try {
  const raw = readFileSync(0, "utf8");
  if (!raw.trim()) allow();
  const { evaluateAgyPreToolUse } = await import("./hook-evaluator.mjs");
  const result = await evaluateAgyPreToolUse(raw, { callerCwd: process.cwd() });
  process.stdout.write(`${JSON.stringify(result || { decision: "allow" })}\n`);
  process.exit(0);
} catch {
  // Fail-open có chủ đích, khớp agent-registry.json.
}

allow();
