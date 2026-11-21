#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { evaluateBoundaryPayload } from './agent-boundary-guard.mjs';
import {
  checkLspCircuit,
  inferLspLanguage,
  isLspFailureOrTimeout,
  isLspToolCall,
  LSP_CIRCUIT_TTL_MS,
  recordLspOutcome,
} from './agent-lifecycle-core.mjs';
import { deriveTaskManifest, readLegacyEvidence, readTaskContract, readTaskLifecycle, validateContractSchema } from './task-contract.mjs';

const repoRoot = process.cwd();
const isStandaloneKit = existsSync(join(repoRoot, 'bin', 'install.js')) && existsSync(join(repoRoot, 'core', '.agent-core'));
const skillRoot = join(repoRoot, '.agent', 'skills');
const quarantineSkillRoot = join(repoRoot, '.agent', 'quarantine', 'skills');
const agentRoot = join(repoRoot, '.agent', 'agents');
const workflowRoot = join(repoRoot, '.agent', 'workflows');
const evalRoot = join(repoRoot, '.agent', 'evals', 'cases');
const governancePath = join(repoRoot, '.agent', 'knowledge', 'skill-governance.json');
const contractRoot = join(repoRoot, '.agent', 'contracts');
const registryPath = join(contractRoot, 'agent-registry.json');
const manifestSchemaPath = join(contractRoot, 'task-manifest.schema.json');
const contextBudgetPath = join(contractRoot, 'context-budget.json');
const metricsSchemaPath = join(contractRoot, 'agent-run-metrics.schema.json');
const errors = [];
const warnings = [];
const allowedSkillFrontmatterFields = new Set(['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools']);

function walk(directory, predicate = () => true) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') return [];
      return walk(path, predicate);
    }
    return predicate(path) ? [path] : [];
  });
}

function parseFrontmatter(path) {
  const content = readFileSync(path, 'utf8');
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  if (!match) return { content, metadata: null };
  const metadata = {};
  let continuationKey = null;
  for (const line of match[1].split('\n')) {
    if (continuationKey && /^\s+\S/.test(line)) {
      metadata[continuationKey] = `${metadata[continuationKey]} ${line.trim()}`.trim();
      continue;
    }
    continuationKey = null;
    const field = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!field) continue;
    const value = field[2].trim();
    metadata[field[1]] = value === '>' || value === '|' ? '' : value.replace(/^['"]|['"]$/g, '');
    if (value === '>' || value === '|') continuationKey = field[1];
  }
  return { content, metadata };
}

const skills = new Map();
for (const skillFile of walk(skillRoot, (path) => path.endsWith('/SKILL.md'))) {
  const directoryName = relative(skillRoot, dirname(skillFile)).split('/').at(-1);
  const { content, metadata } = parseFrontmatter(skillFile);
  const label = relative(repoRoot, skillFile);
  if (!metadata) {
    errors.push(`${label}: missing YAML frontmatter`);
    continue;
  }
  if (!metadata.name) errors.push(`${label}: missing name`);
  if (!metadata.description) errors.push(`${label}: missing description`);
  if (metadata.name && metadata.name !== directoryName) {
    errors.push(`${label}: name '${metadata.name}' does not match directory '${directoryName}'`);
  }
  for (const match of content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/)?.[1].matchAll(/^([A-Za-z][A-Za-z0-9_-]*):/gm) ?? []) {
    if (!allowedSkillFrontmatterFields.has(match[1])) {
      warnings.push(`${label}: non-portable top-level frontmatter field '${match[1]}'; move it under metadata`);
    }
  }
  if (metadata.name) skills.set(metadata.name, { file: skillFile, content, metadata });
  const lines = content.split('\n').length;
  if (lines > 500) warnings.push(`${label}: ${lines} lines; move conditional detail to references`);
  if (metadata.description && !/\buse\b|\bwhen\b/i.test(metadata.description)) {
    warnings.push(`${label}: description has no clear activation trigger`);
  }
}

const quarantinedSkills = new Map();
for (const skillFile of walk(quarantineSkillRoot, (path) => path.endsWith('/SKILL.md'))) {
  const directoryName = relative(quarantineSkillRoot, dirname(skillFile)).split('/').at(-1);
  const { metadata } = parseFrontmatter(skillFile);
  const label = relative(repoRoot, skillFile);
  if (!metadata?.name) {
    errors.push(`${label}: quarantined skill missing name`);
    continue;
  }
  if (metadata.name !== directoryName) {
    errors.push(`${label}: name '${metadata.name}' does not match directory '${directoryName}'`);
  }
  quarantinedSkills.set(metadata.name, { file: skillFile, metadata });
}

function checkSkillReferences(path, content) {
  const label = relative(repoRoot, path);
  for (const match of content.matchAll(/\[skill:([a-z0-9-]+)]/g)) {
    if (!skills.has(match[1])) errors.push(`${label}: missing [skill:${match[1]}]`);
  }
  for (const match of content.matchAll(/\.agent\/skills\/([a-z0-9-]+)\/SKILL\.md/g)) {
    if (!skills.has(match[1])) errors.push(`${label}: missing skill path '${match[1]}'`);
  }
  for (const match of content.matchAll(/\[[^\]]*]\(([^)]+)\)/g)) {
    const target = match[1].split('#')[0].trim();
    if (!target || target.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('/')) continue;
    const resolved = resolve(dirname(path), target);
    if (!existsSync(resolved)) errors.push(`${label}: broken relative link '${match[1]}'`);
  }
}

for (const { file, content } of skills.values()) checkSkillReferences(file, content);

const agents = new Map();
for (const agentFile of walk(agentRoot, (path) => path.endsWith('.md'))) {
  const { content, metadata } = parseFrontmatter(agentFile);
  const label = relative(repoRoot, agentFile);
  if (!metadata?.name || !metadata?.description) errors.push(`${label}: invalid agent frontmatter`);
  if (metadata?.name) agents.set(metadata.name, { file: agentFile, metadata });
  const declared = metadata?.skills?.split(',').map((name) => name.trim()).filter(Boolean) ?? [];
  for (const name of declared) {
    if (!skills.has(name)) errors.push(`${label}: declares missing skill '${name}'`);
  }
  checkSkillReferences(agentFile, content);
  const lines = content.split('\n').length;
  if (lines > 220) warnings.push(`${label}: ${lines} lines; specialist profiles should primarily route`);
}

for (const workflowFile of walk(workflowRoot, (path) => path.endsWith('.md'))) {
  checkSkillReferences(workflowFile, readFileSync(workflowFile, 'utf8'));
}

const coveredSkills = new Set();
for (const evalFile of walk(evalRoot, (path) => path.endsWith('.json'))) {
  const label = relative(repoRoot, evalFile);
  let data;
  try {
    data = JSON.parse(readFileSync(evalFile, 'utf8'));
  } catch (error) {
    errors.push(`${label}: invalid JSON (${error.message})`);
    continue;
  }
  if (!Array.isArray(data.cases)) {
    errors.push(`${label}: cases must be an array`);
    continue;
  }
  for (const testCase of data.cases) {
    if (!testCase.id || !testCase.query || !Array.isArray(testCase.skills)) {
      errors.push(`${label}: each case needs id, query, and skills[]`);
      continue;
    }
    if (!Array.isArray(testCase.expected_behavior) || testCase.expected_behavior.length === 0) {
      errors.push(`${label}:${testCase.id}: expected_behavior must be non-empty`);
    }
    for (const name of testCase.skills) {
      coveredSkills.add(name);
      if (!skills.has(name)) errors.push(`${label}:${testCase.id}: missing skill '${name}'`);
    }
  }
}

for (const name of skills.keys()) {
  if (name.startsWith('cogain-') && !coveredSkills.has(name)) {
    errors.push(`.agent/evals: project skill '${name}' has no behavior case`);
  }
}

for (const ruleFile of walk(join(repoRoot, '.agent', 'rules'), (path) => path.endsWith('.md'))) {
  const chars = readFileSync(ruleFile, 'utf8').length;
  if (chars > 12_000) warnings.push(`${relative(repoRoot, ruleFile)}: ${chars} chars; consider progressive disclosure`);
}

const harnessLinks = isStandaloneKit ? [] : ['.agents/skills', '.codex/skills', '.claude/skills'];
for (const link of harnessLinks) {
  const path = join(repoRoot, link);
  if (!existsSync(path)) {
    errors.push(`${link}: missing harness skill link`);
    continue;
  }
  if (!lstatSync(path).isSymbolicLink()) warnings.push(`${link}: expected a symlink to canonical .agent/skills`);
  if (realpathSync(path) !== realpathSync(skillRoot)) errors.push(`${link}: does not resolve to .agent/skills`);
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    errors.push(`${relative(repoRoot, path)}: invalid JSON (${error.message})`);
    return null;
  }
}

function validateAgentRegistry() {
  if (!existsSync(registryPath)) {
    errors.push('.agent/contracts/agent-registry.json: missing runtime agent registry');
    return;
  }

  const registry = readJson(registryPath);
  if (!registry) return;
  const supportedRegistryVersions = [2, 3];
  if (!supportedRegistryVersions.includes(registry.version) || !Array.isArray(registry.agents)) {
    errors.push(`.agent/contracts/agent-registry.json: version ${supportedRegistryVersions.join(' or ')} and agents[] are required`);
    return;
  }

  const registered = new Set();
  for (const entry of registry.agents) {
    if (!entry?.name || !entry.kind || !Array.isArray(entry.write_paths) || !Array.isArray(entry.tools)) {
      errors.push('.agent/contracts/agent-registry.json: each agent needs name, kind, write_paths[], and tools[]');
      continue;
    }
    if (registered.has(entry.name)) errors.push(`.agent/contracts/agent-registry.json: duplicate agent '${entry.name}'`);
    registered.add(entry.name);
    if (entry.profile !== null) {
      if (typeof entry.profile !== 'string' || !existsSync(join(repoRoot, entry.profile))) {
        errors.push(`${entry.name}: registry profile '${entry.profile}' does not exist`);
      } else {
        const profile = agents.get(entry.name);
        if (!profile) errors.push(`${entry.name}: registry entry has no matching agent frontmatter`);
      }
    }
    if (entry.kind === 'gate' && entry.write_paths.length > 0) {
      errors.push(`${entry.name}: gate agents must not declare write paths`);
    }
    if (entry.kind === 'control' && entry.write_paths.length > 0) {
      errors.push(`${entry.name}: control agents must not declare write paths`);
    }
  }

  for (const name of agents.keys()) {
    if (!registered.has(name)) errors.push(`${name}: agent profile is not registered in agent-registry.json`);
  }
}

function validateScriptMappings() {
  const mappingPath = join(skillRoot, 'clean-code', 'sub-skills', 'agent-script-mapping.md');
  if (!existsSync(mappingPath)) return;
  const content = readFileSync(mappingPath, 'utf8');
  for (const match of content.matchAll(/\.agent\/[A-Za-z0-9_./-]+/g)) {
    if (!existsSync(join(repoRoot, match[0]))) {
      errors.push(`${relative(repoRoot, mappingPath)}: missing script/path '${match[0]}'`);
    }
  }
}

function validateTaskManifestSchema() {
  if (!existsSync(manifestSchemaPath)) {
    errors.push('.agent/contracts/task-manifest.schema.json: missing task manifest schema');
    return;
  }
  const schema = readJson(manifestSchemaPath);
  if (!schema) return;
  const required = new Set(schema.required ?? []);
  for (const field of ['manifest_version', 'tier', 'task_id', 'slice_id', 'contract_ref', 'contract_version', 'contract_hash', 'lifecycle_hash', 'goal', 'mode', 'owner', 'independent_verification', 'allowed_paths', 'source_paths', 'acceptance_criteria', 'dependencies', 'validation_commands', 'stop_conditions']) {
    if (!required.has(field)) errors.push(`.agent/contracts/task-manifest.schema.json: required field '${field}' is missing`);
  }
  if (schema.properties?.manifest_version?.const !== 2) {
    errors.push('.agent/contracts/task-manifest.schema.json: manifest_version const must be 2; legacy manifests require migration');
  }
  if (schema.properties?.tier?.const !== 'governed') {
    errors.push('.agent/contracts/task-manifest.schema.json: tier const must be governed');
  }
  if (schema.properties?.independent_verification?.const !== true) {
    errors.push('.agent/contracts/task-manifest.schema.json: independent_verification const must be true');
  }
  const legacyPins = new Map();
  for (const overview of walk(join(repoRoot, '.agent', 'planning'), (file) => file.endsWith('/00-OVERVIEW.md'))) {
    if (!/^```(?:json[ \t]+)?task-lifecycle[ \t]*\r?$/m.test(readFileSync(overview, 'utf8'))) continue;
    const label = relative(repoRoot, overview);
    try {
      const lifecycle = readTaskLifecycle(repoRoot, label);
      for (const pin of readLegacyEvidence(repoRoot, lifecycle)) {
        if (legacyPins.has(pin.resolved_path)) {
          errors.push(`${label}: duplicate/conflicting legacy pin '${pin.path}' also owned by ${legacyPins.get(pin.resolved_path).overview}`);
        } else {
          legacyPins.set(pin.resolved_path, { ...pin, overview: label });
          warnings.push(`${pin.path}: historical-not-dispatchable; pinned by ${label}; ${pin.reason}`);
        }
      }
    } catch (error) {
      if (error.code === 'INACTIVE_CONTRACT') {
        const lifecyclePath = join(dirname(manifest.contract_ref), '00-OVERVIEW.md').replace(/\\/g, '/');
        const lifecycle = readTaskLifecycle(repoRoot, lifecyclePath);
        const canonicalLifecycle = JSON.stringify(lifecycle, (_, entry) =>
          entry && typeof entry === 'object' && !Array.isArray(entry)
            ? Object.fromEntries(Object.keys(entry).sort().map((k) => [k, entry[k]]))
            : entry
        );
        const expectedLifecycleHash = createHash('sha256').update(canonicalLifecycle).digest('hex');
        if (manifest.lifecycle_hash !== expectedLifecycleHash) {
          errors.push(`${label}: derived field 'lifecycle_hash' differs from canonical lifecycle; regenerate when authorized`);
        } else {
          warnings.push(`${label}: ${error.message}`);
        }
      } else {
        errors.push(`${label}: ${error.message}`);
      }
    }
  }
  for (const path of walk(join(repoRoot, '.agent', 'task-manifests'), (file) => file.endsWith('.json'))) {
    const manifest = readJson(path);
    if (!manifest) continue;
    const label = relative(repoRoot, path);
    if (manifest.manifest_version !== 2) {
      if (!legacyPins.has(realpathSync(path))) errors.push(`${label}: legacy/unversioned manifest requires explicit hash-pinned historical-only classification or migration; not task-bound evidence`);
      continue;
    }
    try {
      validateContractSchema(manifest);
      const expected = deriveTaskManifest(readTaskContract(repoRoot, manifest.contract_ref));
      for (const key of Object.keys(expected)) {
        if (JSON.stringify(manifest[key]) !== JSON.stringify(expected[key])) {
          errors.push(`${label}: derived field '${key}' differs from canonical contract; regenerate when authorized`);
        }
      }
    } catch (error) {
      if (error.code === 'INACTIVE_CONTRACT') {
        const lifecyclePath = join(dirname(manifest.contract_ref), '00-OVERVIEW.md').replace(/\\/g, '/');
        const lifecycle = readTaskLifecycle(repoRoot, lifecyclePath);
        const canonicalLifecycle = JSON.stringify(lifecycle, (_, entry) =>
          entry && typeof entry === 'object' && !Array.isArray(entry)
            ? Object.fromEntries(Object.keys(entry).sort().map((k) => [k, entry[k]]))
            : entry
        );
        const expectedLifecycleHash = createHash('sha256').update(canonicalLifecycle).digest('hex');
        if (manifest.lifecycle_hash !== expectedLifecycleHash) {
          errors.push(`${label}: derived field 'lifecycle_hash' differs from canonical lifecycle; regenerate when authorized`);
        } else {
          warnings.push(`${label}: ${error.message}`);
        }
      } else {
        errors.push(`${label}: ${error.message}`);
      }
    }
  }
}

function validateContextBudget() {
  if (!existsSync(contextBudgetPath)) {
    errors.push('.agent/contracts/context-budget.json: missing context budget');
    return;
  }
  const budget = readJson(contextBudgetPath);
  if (!budget) return;
  if (budget.version !== 1 || !Array.isArray(budget.base_files) || !budget.profiles || !budget.limits) {
    errors.push('.agent/contracts/context-budget.json: version 1, base_files, profiles, and limits are required');
    return;
  }
  if (!Number.isFinite(budget.estimated_chars_per_token) || budget.estimated_chars_per_token <= 0) {
    errors.push('.agent/contracts/context-budget.json: estimated_chars_per_token must be positive');
  }
  const coreCodebaseFiles = isStandaloneKit ? [] : (budget.core_codebase_files ?? []);
  for (const path of [...budget.base_files, ...coreCodebaseFiles]) {
    if (!existsSync(join(repoRoot, path))) errors.push(`.agent/contracts/context-budget.json: missing '${path}'`);
  }
  for (const [name, profile] of Object.entries(budget.profiles)) {
    if (!profile?.file || !existsSync(join(repoRoot, profile.file))) {
      errors.push(`.agent/contracts/context-budget.json: profile '${name}' has no valid file`);
    }
    if (profile?.domain_rule && !existsSync(join(repoRoot, profile.domain_rule))) {
      errors.push(`.agent/contracts/context-budget.json: profile '${name}' has no valid domain_rule`);
    }
  }
  const bytes = (path) => statSync(join(repoRoot, path)).size;
  const sum = (paths) => paths.reduce((total, path) => total + bytes(path), 0);
  const entrypointBytes = sum(budget.base_files);
  if (entrypointBytes > budget.limits.entrypoint_max_bytes) {
    errors.push(`.agent/contracts/context-budget.json: entrypoint budget exceeded (${entrypointBytes} bytes)`);
  }
  for (const [name, profile] of Object.entries(budget.profiles)) {
    if (!existsSync(join(repoRoot, profile.file))) continue;
    const profileBytes = bytes(profile.file);
    if (profileBytes > budget.limits.profile_max_bytes) {
      errors.push(`.agent/contracts/context-budget.json: profile '${name}' budget exceeded (${profileBytes} bytes)`);
    }
    const estimated = (value) => Math.ceil(value / budget.estimated_chars_per_token);
    const fast = entrypointBytes + profileBytes;
    const standard = fast + (profile.domain_rule ? bytes(profile.domain_rule) : 0);
    const governed = standard + sum(coreCodebaseFiles);
    if (estimated(fast) > budget.limits.fast_max_estimated_tokens) {
      errors.push(`.agent/contracts/context-budget.json: fast budget exceeded for '${name}'`);
    }
    if (estimated(standard) > budget.limits.standard_max_estimated_tokens) {
      errors.push(`.agent/contracts/context-budget.json: standard budget exceeded for '${name}'`);
    }
    if (estimated(governed) > budget.limits.governed_core_max_estimated_tokens) {
      errors.push(`.agent/contracts/context-budget.json: governed-core budget exceeded for '${name}'`);
    }
  }
}

function validateMetricsSchema() {
  if (!existsSync(metricsSchemaPath)) {
    errors.push('.agent/contracts/agent-run-metrics.schema.json: missing runtime metrics schema');
    return;
  }
  const schema = readJson(metricsSchemaPath);
  const required = new Set(schema?.required ?? []);
  for (const field of ['task_id', 'tier', 'owner', 'files_read', 'tool_calls', 'validation_status']) {
    if (!required.has(field)) errors.push(`.agent/contracts/agent-run-metrics.schema.json: required field '${field}' is missing`);
  }
}

function validateContextPolicy() {
  const entry = join(repoRoot, 'AGENTS.md');
  const content = readFileSync(entry, 'utf8');
  for (const staleMarker of ['Available Skills (', 'Available commands (', 'four mandatory `.planning/codebase/`']) {
    if (content.includes(staleMarker)) errors.push(`AGENTS.md: stale context policy '${staleMarker}'`);
  }
  for (const profile of agents.values()) {
    const content = readFileSync(profile.file, 'utf8');
    if (content.includes('four mandatory `.planning/codebase/`')) {
      errors.push(`${relative(repoRoot, profile.file)}: must not preload four codebase documents`);
    }
  }
}

validateAgentRegistry();
validateScriptMappings();
validateTaskManifestSchema();
validateContextBudget();
validateMetricsSchema();
validateContextPolicy();

function validateSkillGovernance() {
  if (!existsSync(governancePath)) {
    errors.push('.agent/knowledge/skill-governance.json: missing skill governance manifest');
    return null;
  }

  const governance = readJson(governancePath);
  if (!governance) return null;

  if (governance.schemaVersion !== 1) {
    errors.push('.agent/knowledge/skill-governance.json: schemaVersion must be 1');
  }
  if (!Array.isArray(governance.quarantinedSkills)) {
    errors.push('.agent/knowledge/skill-governance.json: quarantinedSkills must be an array');
    return governance;
  }

  const listed = new Set();
  for (const record of governance.quarantinedSkills) {
    if (!record?.name || !record?.reason || !record?.ownerAfterCleanup) {
      errors.push('.agent/knowledge/skill-governance.json: each quarantined skill needs name, reason, and ownerAfterCleanup');
      continue;
    }
    listed.add(record.name);
    if (skills.has(record.name)) {
      errors.push(`${record.name}: quarantined skill is still active under .agent/skills`);
    }
  }

  for (const name of quarantinedSkills.keys()) {
    if (!listed.has(name)) {
      errors.push(`${name}: quarantined on disk but missing from skill-governance.json`);
    }
  }

  const allowedTrustTiers = new Set(['T0', 'T1', 'T2', 'T3', 'T4']);
  for (const source of governance.sourceTiers ?? []) {
    if (!allowedTrustTiers.has(source.tier) || !source.permission) {
      errors.push('.agent/knowledge/skill-governance.json: each source tier needs tier T0-T4 and permission');
    }
  }

  if (!governance.crawlPolicy?.publishGate) {
    errors.push('.agent/knowledge/skill-governance.json: crawlPolicy.publishGate is required');
  }
  if (!governance.evalCadence?.skillOrModelChange) {
    errors.push('.agent/knowledge/skill-governance.json: evalCadence.skillOrModelChange is required');
  }

  return governance;
}

const governance = validateSkillGovernance();

function validateGuardFixturesAndAllowlist() {
  const fixturesPath = join(repoRoot, '.agent', 'evals', 'guard-fixtures.json');
  if (!existsSync(fixturesPath)) {
    errors.push('.agent/evals/guard-fixtures.json: missing boundary guard regression fixtures');
  } else {
    const data = readJson(fixturesPath);
    if (!data || !Array.isArray(data.cases) || data.cases.length === 0) {
      errors.push('.agent/evals/guard-fixtures.json: cases[] must be a non-empty array');
    } else {
      for (const testCase of data.cases) {
        if (!testCase?.id || !testCase?.payload || !testCase?.expected_decision) {
          errors.push('.agent/evals/guard-fixtures.json: each case needs id, payload, and expected_decision');
          continue;
        }
        if (isStandaloneKit && testCase.options?.checkFs && testCase.expected_decision === 'allow') {
          continue;
        }
        const res = evaluateBoundaryPayload(testCase.payload, {
          root: repoRoot,
          ...(testCase.options || {}),
          sandbox: true,
        });
        if (res.decision !== testCase.expected_decision) {
          errors.push(
            `.agent/evals/guard-fixtures.json:${testCase.id}: expected '${testCase.expected_decision}', got '${res.decision}' (${res.rule || 'none'})`
          );
        } else if (testCase.expected_rule && res.rule !== testCase.expected_rule) {
          errors.push(
            `.agent/evals/guard-fixtures.json:${testCase.id}: expected rule '${testCase.expected_rule}', got '${res.rule || 'none'}'`
          );
        }
      }
    }
  }

  const registry = existsSync(registryPath) ? readJson(registryPath) : null;
  if (registry) {
    const allowlist = registry.enforcement?.allowlist;
    if (!Array.isArray(allowlist)) {
      errors.push('.agent/contracts/agent-registry.json: enforcement.allowlist must be an array');
      return;
    }
    const now = Date.now();
    for (const entry of allowlist) {
      if (
        !entry?.id ||
        !entry?.rule_id ||
        !Array.isArray(entry?.path_globs) ||
        entry.path_globs.length === 0 ||
        !entry?.owner ||
        !entry?.reason ||
        !entry?.expires_at
      ) {
        errors.push('.agent/contracts/agent-registry.json: allowlist entry missing required fields (id, rule_id, path_globs, owner, reason, expires_at)');
        continue;
      }
      const expiresMs = Date.parse(entry.expires_at);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.expires_at) || !Number.isFinite(expiresMs)) {
        errors.push(`.agent/contracts/agent-registry.json: allowlist '${entry.id}' has invalid expires_at '${entry.expires_at}' (expected YYYY-MM-DD)`);
      } else if (expiresMs < now) {
        errors.push(`.agent/contracts/agent-registry.json: allowlist '${entry.id}' (${entry.rule_id}) expired on ${entry.expires_at}`);
      }
    }
  }
}

function validateDocHygieneAndExemplars() {
  const docDirs = [join(repoRoot, '.agent', 'rules'), join(repoRoot, '.planning', 'codebase')];
  for (const dir of docDirs) {
    for (const mdFile of walk(dir, (path) => path.endsWith('.md'))) {
      const content = readFileSync(mdFile, 'utf8');
      const label = relative(repoRoot, mdFile);
      for (const match of content.matchAll(/\[[^\]]*]\(([^)]+)\)/g)) {
        const target = match[1].split('#')[0].trim();
        if (!target || target.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('/')) continue;
        const resolved = resolve(dirname(mdFile), target);
        if (!existsSync(resolved)) errors.push(`${label}: broken relative link '${match[1]}'`);
      }
    }
  }

  const exemplarsPath = join(contractRoot, 'archetype-exemplars.json');
  if (existsSync(exemplarsPath)) {
    const exemplars = readJson(exemplarsPath);
    if (exemplars) {
      if (exemplars.version !== 1) {
        errors.push('.agent/contracts/archetype-exemplars.json: version must be 1');
      }
      const checkList = (owner, list) => {
        if (isStandaloneKit || !Array.isArray(list)) return;
        for (const p of list) {
          if (typeof p !== 'string' || !p.trim() || !existsSync(join(repoRoot, p))) {
            errors.push(`.agent/contracts/archetype-exemplars.json: missing exemplar path '${p}' in ${owner}`);
          }
        }
      };
      checkList('backend_exemplars', exemplars.backend_exemplars);
      checkList('frontend_exemplars', exemplars.frontend_exemplars);
      if (exemplars.archetypes && typeof exemplars.archetypes === 'object') {
        for (const [name, arch] of Object.entries(exemplars.archetypes)) {
          checkList(`${name}.backend_exemplars`, arch?.backend_exemplars);
          checkList(`${name}.frontend_exemplars`, arch?.frontend_exemplars);
        }
      }
    }
  }

  const forbiddenArtifacts = [
    'OPINIONS.md',
    '.agent/.shared',
    '.agent/reports/artifacts',
    '.agent/START_HERE.md',
    '.agent/START_HERE.vi.md',
    '.agent/ARCHITECTURE.vi.md',
    'docs/AGENTS_GUIDE.vi.md',
  ];
  for (const item of forbiddenArtifacts) {
    if (existsSync(join(repoRoot, item))) {
      errors.push(`doc hygiene: forbidden stale artifact '${item}' still exists on disk`);
    }
  }
}

function validateLspCircuitAndSlnf() {
  const tmpDir = mkdtempSync(join(tmpdir(), 'cogain-lsp-circuit-'));
  const circuitFile = join(tmpDir, 'lsp-circuit.json');
  try {
    if (inferLspLanguage({ file_path: 'backend/src/Sample.cs' }) !== 'csharp') {
      errors.push('lsp-circuit: inferLspLanguage failed to detect csharp from .cs');
    }
    if (inferLspLanguage({ Arguments: { path: 'frontend/web/src/App.tsx' } }) !== 'typescript') {
      errors.push('lsp-circuit: inferLspLanguage failed to detect typescript from nested Arguments');
    }
    if (inferLspLanguage({}) !== 'general') {
      errors.push('lsp-circuit: inferLspLanguage should fallback to general');
    }
    if (
      !isLspToolCall('call_mcp_tool', { ServerName: 'lsp', ToolName: 'get_diagnostics' }) ||
      !isLspToolCall('mcp__lsp__get_diagnostics', {}) ||
      isLspToolCall('mcp_filesystem_read_file', {})
    ) {
      errors.push('lsp-circuit: isLspToolCall matching failed');
    }
    if (
      !isLspFailureOrTimeout({ error: 'Request timed out' }) ||
      !isLspFailureOrTimeout({ tool_response: 'deadline exceeded' }) ||
      isLspFailureOrTimeout({ toolResult: 'No diagnostics' })
    ) {
      errors.push('lsp-circuit: isLspFailureOrTimeout detection failed');
    }

    const t0 = 1_700_000_000_000;
    const initial = checkLspCircuit(repoRoot, 'csharp', { circuitFile, now: t0 });
    if (!initial.allowed || initial.state !== 'CLOSED') {
      errors.push(`lsp-circuit: expected initial CLOSED/allowed, got ${JSON.stringify(initial)}`);
    }

    recordLspOutcome(repoRoot, 'csharp', { failed: true, errorText: 'timed out' }, { circuitFile, now: t0, sandbox: true });

    const startMs = performance.now();
    const blocked = checkLspCircuit(repoRoot, 'csharp', { circuitFile, now: t0 + 1000 });
    const elapsedMs = performance.now() - startMs;
    if (blocked.allowed || blocked.state !== 'OPEN' || !blocked.reason?.includes('[lsp-circuit-open]')) {
      errors.push(`lsp-circuit: expected OPEN block for csharp, got ${JSON.stringify(blocked)}`);
    }
    if (elapsedMs >= 50) {
      errors.push(`lsp-circuit: OPEN check too slow (${elapsedMs.toFixed(2)}ms)`);
    }

    const tsCheck = checkLspCircuit(repoRoot, 'typescript', { circuitFile, now: t0 + 1000 });
    if (!tsCheck.allowed || tsCheck.state !== 'CLOSED') {
      errors.push(`lsp-circuit: csharp OPEN must not block typescript, got ${JSON.stringify(tsCheck)}`);
    }

    const halfOpen = checkLspCircuit(repoRoot, 'csharp', { circuitFile, now: t0 + LSP_CIRCUIT_TTL_MS + 1 });
    if (!halfOpen.allowed || halfOpen.state !== 'HALF_OPEN') {
      errors.push(`lsp-circuit: expected HALF_OPEN probe after TTL expiry, got ${JSON.stringify(halfOpen)}`);
    }

    const parallelDuringProbe = checkLspCircuit(repoRoot, 'csharp', { circuitFile, now: t0 + LSP_CIRCUIT_TTL_MS + 10 });
    if (parallelDuringProbe.allowed) {
      errors.push('lsp-circuit: parallel call during HALF_OPEN probe must be blocked');
    }

    recordLspOutcome(repoRoot, 'csharp', { failed: false }, { circuitFile, now: t0 + LSP_CIRCUIT_TTL_MS + 50, sandbox: true });
    const recovered = checkLspCircuit(repoRoot, 'csharp', { circuitFile, now: t0 + LSP_CIRCUIT_TTL_MS + 100 });
    if (!recovered.allowed || recovered.state !== 'CLOSED') {
      errors.push(`lsp-circuit: expected CLOSED after successful probe, got ${JSON.stringify(recovered)}`);
    }
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }

  const slnfPath = join(repoRoot, 'backend', 'Cogain.Lsp.slnf');
  if (existsSync(slnfPath)) {
    const slnf = readJson(slnfPath);
    if (slnf) {
      if (slnf.solution?.path !== 'CogainSolution.sln') {
        errors.push(`backend/Cogain.Lsp.slnf: solution.path must be 'CogainSolution.sln' (got '${slnf.solution?.path}')`);
      }
      if (!Array.isArray(slnf.solution?.projects) || slnf.solution.projects.length === 0) {
        errors.push('backend/Cogain.Lsp.slnf: solution.projects must be a non-empty array');
      } else {
        for (const proj of slnf.solution.projects) {
          if (typeof proj !== 'string' || !proj.trim()) {
            errors.push('backend/Cogain.Lsp.slnf: empty or non-string project entry');
            continue;
          }
          if (/\.Migrations\.csproj$/i.test(proj)) {
            errors.push(`backend/Cogain.Lsp.slnf: must exclude migration project '${proj}'`);
          }
          const normalized = proj.replace(/\\/g, '/');
          if (!existsSync(join(repoRoot, 'backend', normalized))) {
            errors.push(`backend/Cogain.Lsp.slnf: missing project path 'backend/${normalized}'`);
          }
        }
      }
    }
  }
}

validateGuardFixturesAndAllowlist();
validateDocHygieneAndExemplars();
validateLspCircuitAndSlnf();

function writeCatalog() {
  const entries = [...skills.entries()].sort(([a], [b]) => a.localeCompare(b));
  const project = entries.filter(([name]) => name.startsWith('cogain-'));
  const generic = entries.filter(([name]) => !name.startsWith('cogain-'));
  const quarantined = governance?.quarantinedSkills ?? [];
  const row = ([name, skill]) => `- \`${name}\`: ${skill.metadata.description}`;
  const output = [
    `# Skill Catalog (${entries.length} skills)`,
    '',
    '> Generated by `node .agent/scripts/validate-agent-system.mjs --write-catalog`. Do not edit the inventory manually.',
    '',
    '## Routing Policy',
    '',
    '- Project-native skills own Cogain procedures and override generic examples when they conflict.',
    '- Load only skills that change the current decision; a local task normally needs one router plus one or two domain skills.',
    '- Source code and `AI_RULES.md` remain higher-priority truth sources.',
    '- Quarantined skills live under `.agent/quarantine/skills` and are not part of active auto-discovery.',
    '',
    `## Project-Native (${project.length})`,
    '',
    ...project.map(row),
    '',
    `## Generic / Transferable (${generic.length})`,
    '',
    ...generic.map(row),
    '',
    `## Quarantined (${quarantined.length})`,
    '',
    ...quarantined.map((skill) => `- \`${skill.name}\`: ${skill.reason} Owner after cleanup: \`${skill.ownerAfterCleanup}\`.`),
    '',
  ].join('\n');
  writeFileSync(join(repoRoot, '.agent', 'SKILLS.md'), output);
}

if (process.argv.includes('--write-catalog')) writeCatalog();

if (process.argv.includes('--show-warnings')) {
  for (const warning of warnings) console.warn(`WARN ${warning}`);
}
for (const error of errors) console.error(`ERROR ${error}`);
console.log(`Validated ${skills.size} active skills, ${quarantinedSkills.size} quarantined skills, ${walk(agentRoot, (path) => path.endsWith('.md')).length} agents, ${walk(workflowRoot, (path) => path.endsWith('.md')).length} workflows, and ${coveredSkills.size} eval-covered skills.`);
console.log(`${errors.length} error(s), ${warnings.length} warning(s).`);
process.exitCode = errors.length === 0 ? 0 : 1;
