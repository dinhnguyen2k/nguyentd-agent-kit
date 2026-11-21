#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const prefix = `${name}=`;
  const hit = argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
};

const jsonOutput = argv.includes('--json');
const warnDays = Math.max(1, Number(flag('--warn-days', '14')) || 14);
const frictionPath = resolve(process.cwd(), flag('--friction', '.agent/reports/agent-friction.jsonl'));
const guardLogPath = resolve(process.cwd(), flag('--guard-log', '.agent/reports/boundary-guard.log'));
const registryPath = resolve(process.cwd(), flag('--registry', '.agent/contracts/agent-registry.json'));

function summarizeFriction(filePath) {
  if (!existsSync(filePath)) return { total: 0, malformed: 0, topGroups: [] };
  const raw = readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const groups = new Map();
  let malformed = 0;

  for (const line of lines) {
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      malformed += 1;
      continue;
    }
    const key = entry.rule_id || entry.category || entry.type || entry.skill || 'uncategorized';
    const current = groups.get(key) ?? { key, count: 0, samples: [] };
    current.count += Number(entry.count) > 0 ? Number(entry.count) : 1;
    const sample = entry.message || entry.summary || entry.reason || entry.file;
    if (sample && current.samples.length < 3 && !current.samples.includes(sample)) {
      current.samples.push(String(sample).slice(0, 140));
    }
    groups.set(key, current);
  }

  const topGroups = [...groups.values()].sort((a, b) => b.count - a.count).slice(0, 10);
  return { total: lines.length - malformed, malformed, topGroups };
}

function summarizeGuardLog(filePath) {
  if (!existsSync(filePath)) {
    return { totalDenies: 0, roleExpired: 0, guardErrors: 0, topRules: [], suspectFalsePositives: [] };
  }
  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean);
  const rules = new Map();
  const suspectFalsePositives = [];
  let totalDenies = 0;
  let roleExpired = 0;
  let guardErrors = 0;

  for (const line of lines) {
    if (line.includes(' ROLE-EXPIRED ')) {
      roleExpired += 1;
      continue;
    }
    if (line.includes(' GUARD-ERROR ')) {
      guardErrors += 1;
      continue;
    }
    const match = line.match(/^\S+\s+DENY\s+rule=(\S+)\s+role=(\S+)\s+::\s*(.*)$/);
    if (!match) continue;
    totalDenies += 1;
    const [, rule, role, reason] = match;
    const entry = rules.get(rule) ?? { rule, count: 0, roles: {}, sample: '' };
    entry.count += 1;
    entry.roles[role] = (entry.roles[role] || 0) + 1;
    if (!entry.sample) entry.sample = reason.slice(0, 140);
    rules.set(rule, entry);

    const blockedCmdMatch = reason.match(/Lệnh bị chặn:\s*(.*)$/i);
    if (
      rule.startsWith('R8') &&
      blockedCmdMatch &&
      /^(?:git\s+(?:log|diff|show|grep)|rg|grep|echo|cat|head|tail|sed\s+-n)\b/i.test(blockedCmdMatch[1].trim()) &&
      suspectFalsePositives.length < 10
    ) {
      suspectFalsePositives.push({ rule, role, snippet: blockedCmdMatch[1].trim().slice(0, 140) });
    }
  }

  const topRules = [...rules.values()].sort((a, b) => b.count - a.count).slice(0, 10);
  return { totalDenies, roleExpired, guardErrors, topRules, suspectFalsePositives };
}

function summarizeAllowlist(filePath, warnWindowDays) {
  if (!existsSync(filePath)) return { total: 0, expired: [], expiringSoon: [], active: [] };
  let registry;
  try {
    registry = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (error) {
    return { total: 0, error: error.message, expired: [], expiringSoon: [], active: [] };
  }
  const allowlist = Array.isArray(registry?.enforcement?.allowlist) ? registry.enforcement.allowlist : [];
  const now = Date.now();
  const warnMs = warnWindowDays * 86400000;
  const expired = [];
  const expiringSoon = [];
  const active = [];

  for (const item of allowlist) {
    const parsed = Date.parse(item?.expires_at || '');
    const record = {
      id: item?.id || '(no-id)',
      rule_id: item?.rule_id || '(unknown)',
      owner: item?.owner || '(unknown)',
      expires_at: item?.expires_at || '(missing)',
      path_globs: item?.path_globs || [],
      reason: item?.reason || '',
    };
    if (!Number.isFinite(parsed) || parsed < now) {
      expired.push(record);
    } else if (parsed - now <= warnMs) {
      expiringSoon.push(record);
    } else {
      active.push(record);
    }
  }
  return { total: allowlist.length, expired, expiringSoon, active };
}

const report = {
  friction: summarizeFriction(frictionPath),
  guard: summarizeGuardLog(guardLogPath),
  allowlist: summarizeAllowlist(registryPath, warnDays),
};

if (jsonOutput) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

console.log('=== Agent Friction & Guard Summary ===');
console.log(`Friction entries: ${report.friction.total} (malformed: ${report.friction.malformed})`);
for (const g of report.friction.topGroups) {
  console.log(`  - ${g.key}: ${g.count}${g.samples.length ? ` | sample: ${g.samples[0]}` : ''}`);
}

console.log(`\nGuard denies: ${report.guard.totalDenies} | ROLE-EXPIRED: ${report.guard.roleExpired} | GUARD-ERROR: ${report.guard.guardErrors}`);
for (const r of report.guard.topRules) {
  const roleStr = Object.entries(r.roles).map(([k, v]) => `${k}:${v}`).join(', ');
  console.log(`  - ${r.rule}: ${r.count} (${roleStr})`);
}
if (report.guard.suspectFalsePositives.length) {
  console.log('\nSuspect false-positive R8 denies (read-only commands):');
  for (const fp of report.guard.suspectFalsePositives) {
    console.log(`  - [${fp.rule}/${fp.role}] ${fp.snippet}`);
  }
}

console.log(`\nAllowlist entries: ${report.allowlist.total} (expired: ${report.allowlist.expired.length}, expiring <= ${warnDays}d: ${report.allowlist.expiringSoon.length}, active: ${report.allowlist.active.length})`);
for (const item of report.allowlist.expired) {
  console.log(`  - [EXPIRED] ${item.id} (${item.rule_id}) owner=${item.owner} expires=${item.expires_at}`);
}
for (const item of report.allowlist.expiringSoon) {
  console.log(`  - [EXPIRING] ${item.id} (${item.rule_id}) owner=${item.owner} expires=${item.expires_at}`);
}
