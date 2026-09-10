#!/usr/bin/env node

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = process.cwd();
const budgetPath = join(repoRoot, '.agent', 'contracts', 'context-budget.json');
const args = process.argv.slice(2);
const json = args.includes('--json');
const selected = args.find((arg) => arg.startsWith('--profile='))?.slice('--profile='.length);

if (!existsSync(budgetPath)) throw new Error('Missing .agent/contracts/context-budget.json');
const budget = JSON.parse(readFileSync(budgetPath, 'utf8'));
const profiles = selected ? [selected] : Object.keys(budget.profiles);

function bytes(path) {
  const fullPath = join(repoRoot, path);
  if (!existsSync(fullPath)) throw new Error(`Missing ${path}`);
  return statSync(fullPath).size;
}

function sum(paths) {
  return paths.reduce((total, path) => total + bytes(path), 0);
}

const entrypointBytes = sum(budget.base_files);
const results = profiles.map((name) => {
  const profile = budget.profiles[name];
  if (!profile) throw new Error(`Unknown profile '${name}'`);
  const profileBytes = bytes(profile.file);
  const fast = entrypointBytes + profileBytes;
  const standard = fast + (profile.domain_rule ? bytes(profile.domain_rule) : 0);
  const governedCore = standard + sum(budget.core_codebase_files);
  const toTokens = (value) => Math.ceil(value / budget.estimated_chars_per_token);
  return {
    profile: name,
    entrypoint_bytes: entrypointBytes,
    profile_bytes: profileBytes,
    fast_estimated_tokens: toTokens(fast),
    standard_estimated_tokens: toTokens(standard),
    governed_core_estimated_tokens: toTokens(governedCore),
    within_budget: {
      entrypoint: entrypointBytes <= budget.limits.entrypoint_max_bytes,
      profile: profileBytes <= budget.limits.profile_max_bytes,
      fast: toTokens(fast) <= budget.limits.fast_max_estimated_tokens,
      standard: toTokens(standard) <= budget.limits.standard_max_estimated_tokens,
      governed_core: toTokens(governedCore) <= budget.limits.governed_core_max_estimated_tokens
    }
  };
});

if (json) {
  console.log(JSON.stringify({ estimator: 'static bytes / estimated_chars_per_token', results }, null, 2));
} else {
  for (const result of results) {
    console.log(`${result.profile}: fast=${result.fast_estimated_tokens}, standard=${result.standard_estimated_tokens}, governed-core=${result.governed_core_estimated_tokens} estimated tokens`);
  }
  console.log('Note: target source, tests, selected skills, and runtime conversation are intentionally excluded; use runtime usage when the harness exposes it.');
}

if (results.some((result) => Object.values(result.within_budget).some((value) => !value))) process.exitCode = 1;
