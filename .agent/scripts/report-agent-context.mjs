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

const sizeCache = new Map();
function measure(path) {
  const cached = sizeCache.get(path);
  if (cached) return cached;
  const fullPath = join(repoRoot, path);
  if (!existsSync(fullPath)) throw new Error(`Missing ${path}`);
  const metrics = { bytes: statSync(fullPath).size, chars: readFileSync(fullPath, 'utf8').length };
  sizeCache.set(path, metrics);
  return metrics;
}

const sumBytes = (paths) => paths.reduce((total, path) => total + measure(path).bytes, 0);
const sumChars = (paths) => paths.reduce((total, path) => total + measure(path).chars, 0);
const toTokens = (value) => Math.ceil(value / budget.estimated_chars_per_token);

const entrypointBytes = sumBytes(budget.base_files);
const entrypointChars = sumChars(budget.base_files);
const coreCodebaseBytes = sumBytes(budget.core_codebase_files);
const coreCodebaseChars = sumChars(budget.core_codebase_files);

const results = profiles.map((name) => {
  const profile = budget.profiles[name];
  if (!profile) throw new Error(`Unknown profile '${name}'`);
  const { bytes: profileBytes, chars: profileChars } = measure(profile.file);
  const domainRuleBytes = profile.domain_rule ? measure(profile.domain_rule).bytes : 0;
  const domainRuleChars = profile.domain_rule ? measure(profile.domain_rule).chars : 0;
  const autoGlobRules = [...new Set(profile.auto_glob_rules ?? (profile.domain_rule ? [profile.domain_rule] : []))];
  const autoGlobRulesBytes = sumBytes(autoGlobRules);
  const autoGlobRulesChars = sumChars(autoGlobRules);

  const fastBytes = entrypointBytes + profileBytes;
  const standardBytes = fastBytes + domainRuleBytes;
  const effectiveStandardBytes = fastBytes + autoGlobRulesBytes;
  const governedCoreBytes = standardBytes + coreCodebaseBytes;

  const fastChars = entrypointChars + profileChars;
  const standardChars = fastChars + domainRuleChars;
  const effectiveStandardChars = fastChars + autoGlobRulesChars;
  const governedCoreChars = standardChars + coreCodebaseChars;

  return {
    profile: name,
    entrypoint_bytes: entrypointBytes,
    entrypoint_chars: entrypointChars,
    profile_bytes: profileBytes,
    profile_chars: profileChars,
    auto_glob_rules_bytes: autoGlobRulesBytes,
    auto_glob_rules_chars: autoGlobRulesChars,
    fast_estimated_tokens: toTokens(fastBytes),
    fast_utf8_estimated_tokens: toTokens(fastChars),
    standard_estimated_tokens: toTokens(standardBytes),
    standard_utf8_estimated_tokens: toTokens(standardChars),
    effective_standard_estimated_tokens: toTokens(effectiveStandardBytes),
    effective_standard_utf8_estimated_tokens: toTokens(effectiveStandardChars),
    governed_core_estimated_tokens: toTokens(governedCoreBytes),
    governed_core_utf8_estimated_tokens: toTokens(governedCoreChars),
    within_budget: {
      entrypoint: entrypointBytes <= budget.limits.entrypoint_max_bytes,
      profile: profileBytes <= budget.limits.profile_max_bytes,
      fast: toTokens(fastBytes) <= budget.limits.fast_max_estimated_tokens,
      standard: toTokens(standardBytes) <= budget.limits.standard_max_estimated_tokens,
      governed_core: toTokens(governedCoreBytes) <= budget.limits.governed_core_max_estimated_tokens
    }
  };
});

if (json) {
  console.log(JSON.stringify({ estimator: 'static bytes and utf8 chars / estimated_chars_per_token', results }, null, 2));
} else {
  for (const result of results) {
    console.log(
      `${result.profile}: fast=${result.fast_estimated_tokens} (utf8=${result.fast_utf8_estimated_tokens}), standard=${result.standard_estimated_tokens} (utf8=${result.standard_utf8_estimated_tokens}), effective-standard=${result.effective_standard_estimated_tokens} (utf8=${result.effective_standard_utf8_estimated_tokens}), governed-core=${result.governed_core_estimated_tokens} (utf8=${result.governed_core_utf8_estimated_tokens}) estimated tokens`
    );
  }
  console.log('Note: target source, tests, selected skills, and runtime conversation are intentionally excluded; use runtime usage when the harness exposes it.');
}

if (results.some((result) => Object.values(result.within_budget).some((value) => !value))) process.exitCode = 1;
