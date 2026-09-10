#!/usr/bin/env node

import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const repoRoot = process.cwd();
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
    if (entry.isDirectory()) return walk(path, predicate);
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

const harnessLinks = ['.agents/skills', '.codex/skills', '.claude/skills'];
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
  for (const field of ['manifest_version', 'tier', 'task_id', 'goal', 'mode', 'owner', 'independent_verification', 'allowed_paths', 'acceptance_criteria', 'validation_commands', 'stop_conditions']) {
    if (!required.has(field)) errors.push(`.agent/contracts/task-manifest.schema.json: required field '${field}' is missing`);
  }
  if (schema.properties?.manifest_version?.const !== 1) {
    errors.push('.agent/contracts/task-manifest.schema.json: manifest_version const must be 1');
  }
  if (schema.properties?.tier?.const !== 'governed') {
    errors.push('.agent/contracts/task-manifest.schema.json: tier const must be governed');
  }
  if (schema.properties?.independent_verification?.const !== true) {
    errors.push('.agent/contracts/task-manifest.schema.json: independent_verification const must be true');
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
  for (const path of [...budget.base_files, ...(budget.core_codebase_files ?? [])]) {
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
    const governed = standard + sum(budget.core_codebase_files ?? []);
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
    if (!quarantinedSkills.has(record.name)) {
      errors.push(`${record.name}: listed as quarantined but missing under .agent/quarantine/skills`);
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
