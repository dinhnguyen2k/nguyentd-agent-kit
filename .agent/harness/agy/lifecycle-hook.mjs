#!/usr/bin/env node
/**
 * Đầu vào CLI mỏng cho Antigravity PostToolUse / PreInvocation / PostInvocation / Stop (dự phòng khi chưa dùng cogain-hook qua Unix Socket).
 * Logic đánh giá giữ ấm nằm tại ./hook-evaluator.mjs.
 */
import { readFileSync } from "node:fs";

function out(obj) {
  process.stdout.write(`${JSON.stringify(obj)}\n`);
  process.exit(0);
}

let fallback = {};
try {
  const raw = readFileSync(0, "utf8");
  if (!raw.trim()) out({});
  const event = JSON.parse(raw);
  if (event?.hookEventName === "Stop") fallback = { decision: "allow" };
  const { evaluateAgyLifecycle } = await import("./hook-evaluator.mjs");
  const result = await evaluateAgyLifecycle(event, { callerCwd: process.cwd() });
  out(result ?? fallback);
} catch {
  // Fail-open có chủ đích: không làm kẹt vòng lặp agent.
}

out(fallback);
