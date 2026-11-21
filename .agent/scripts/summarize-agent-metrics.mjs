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
  const group = groups.get(record.tier) ?? {
    runs: 0,
    context_bytes: 0,
    input_tokens: 0,
    output_tokens: 0,
    cache_read_tokens: 0,
    token_samples: 0,
    cache_samples: 0,
    turns: 0,
    turn_samples: 0,
    discovery_turns: 0,
    discovery_samples: 0,
    rework_loops: 0,
    rework_loop_samples: 0,
    tool_calls: 0,
    duration_ms: 0,
    rework: 0,
    pass: 0,
    fail: 0,
    blocked: 0
  };
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
  if (record.cache_read_tokens !== undefined) {
    group.cache_read_tokens += record.cache_read_tokens;
    group.cache_samples += 1;
  }
  if (record.turns !== undefined) {
    group.turns += record.turns;
    group.turn_samples += 1;
  }
  if (record.discovery_turns !== undefined) {
    group.discovery_turns += record.discovery_turns;
    group.discovery_samples += 1;
  }
  if (record.rework_loops !== undefined) {
    group.rework_loops += record.rework_loops;
    group.rework_loop_samples += 1;
  }
  if (record.validation_status in group) group[record.validation_status] += 1;
  groups.set(record.tier, group);
}

for (const [tier, group] of groups) {
  const average = (value) => Math.round(value / group.runs);
  const avgInputTokens = group.token_samples ? Math.round(group.input_tokens / group.token_samples) : 'n/a';
  const avgCacheReadTokens = group.cache_samples ? Math.round(group.cache_read_tokens / group.cache_samples) : 'n/a';
  const totalPromptTokens = group.input_tokens + group.cache_read_tokens;
  const cacheHitRatio = group.cache_samples && totalPromptTokens > 0
    ? `${((group.cache_read_tokens / totalPromptTokens) * 100).toFixed(1)}%`
    : 'n/a';
  const avgTurns = group.turn_samples ? (group.turns / group.turn_samples).toFixed(1) : 'n/a';
  const avgDiscoveryTurns = group.discovery_samples ? (group.discovery_turns / group.discovery_samples).toFixed(1) : 'n/a';
  const avgReworkLoops = group.rework_loop_samples ? (group.rework_loops / group.rework_loop_samples).toFixed(1) : 'n/a';
  console.log(
    `${tier}: runs=${group.runs}, avgContextBytes=${average(group.context_bytes)}, avgToolCalls=${(group.tool_calls / group.runs).toFixed(1)}, avgTurns=${avgTurns}, avgDiscoveryTurns=${avgDiscoveryTurns}, avgReworkLoops=${avgReworkLoops}, avgDurationMs=${average(group.duration_ms)}, pass=${group.pass}, fail=${group.fail}, blocked=${group.blocked}, reworkRate=${((group.rework / group.runs) * 100).toFixed(1)}%, avgInputTokens=${avgInputTokens}, avgCacheReadTokens=${avgCacheReadTokens}, cacheHitRatio=${cacheHitRatio}`
  );
}
