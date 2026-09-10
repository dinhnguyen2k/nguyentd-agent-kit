#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const input = process.argv.find((arg) => arg.startsWith('--input='))?.slice('--input='.length);
if (!input) throw new Error('Usage: node .agent/scripts/summarize-agent-metrics.mjs --input=.agent/reports/agent-runs.jsonl');

const path = resolve(process.cwd(), input);
if (!existsSync(path)) throw new Error(`Metrics file does not exist: ${input}`);
const lines = readFileSync(path, 'utf8').split('\n').filter(Boolean);
const records = lines.map((line, index) => {
  try {
    return JSON.parse(line);
  } catch {
    throw new Error(`Invalid JSON on line ${index + 1}`);
  }
});

const required = ['task_id', 'tier', 'owner', 'files_read', 'tool_calls', 'validation_status'];
for (const [index, record] of records.entries()) {
  for (const field of required) {
    if (!(field in record)) throw new Error(`Line ${index + 1}: missing '${field}'`);
  }
}

const groups = new Map();
for (const record of records) {
  const group = groups.get(record.tier) ?? { runs: 0, context_bytes: 0, input_tokens: 0, output_tokens: 0, tool_calls: 0, duration_ms: 0, rework: 0, pass: 0, fail: 0, blocked: 0, token_samples: 0 };
  group.runs += 1;
  group.context_bytes += record.context_bytes ?? 0;
  group.tool_calls += record.tool_calls;
  group.duration_ms += record.duration_ms ?? 0;
  group.rework += record.rework_required ? 1 : 0;
  if (record.input_tokens !== undefined) {
    group.input_tokens += record.input_tokens;
    group.output_tokens += record.output_tokens ?? 0;
    group.token_samples += 1;
  }
  if (record.validation_status in group) group[record.validation_status] += 1;
  groups.set(record.tier, group);
}

for (const [tier, group] of groups) {
  const average = (value) => Math.round(value / group.runs);
  console.log(`${tier}: runs=${group.runs}, avgContextBytes=${average(group.context_bytes)}, avgToolCalls=${(group.tool_calls / group.runs).toFixed(1)}, avgDurationMs=${average(group.duration_ms)}, pass=${group.pass}, fail=${group.fail}, blocked=${group.blocked}, reworkRate=${(group.rework / group.runs * 100).toFixed(1)}%, avgInputTokens=${group.token_samples ? Math.round(group.input_tokens / group.token_samples) : 'n/a'}`);
}
