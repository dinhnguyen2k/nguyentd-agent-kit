#!/usr/bin/env node

import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, readlinkSync, realpathSync, readdirSync, writeFileSync, mkdirSync, renameSync, unlinkSync, rmdirSync, linkSync } from 'node:fs';
import { dirname, isAbsolute, join, posix, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const schema = JSON.parse(readFileSync(new URL('../contracts/task-manifest.schema.json', import.meta.url), 'utf8'));
const fail = (code, message) => { const error = new Error(`${code}: ${message}`); error.code = code; error.integrity = !['GIT_IDENTITY_FAILED', 'LEAD_GATE_LOCK_BUSY'].includes(code); throw error; };
const canonical = (value) => JSON.stringify(value, (_, entry) => entry && typeof entry === 'object' && !Array.isArray(entry) ? Object.fromEntries(Object.keys(entry).sort().map((key) => [key, entry[key]])) : entry);
const hash = (value) => createHash('sha256').update(value).digest('hex');

export function validateContractSchema(value, definition = schema, label = 'manifest') {
  if (definition.$ref) definition = schema.$defs[definition.$ref.split('/').at(-1)];
  if (definition.const !== undefined && value !== definition.const) fail('INVALID_SCHEMA', `${label} must equal ${definition.const}`);
  if (definition.enum && !definition.enum.includes(value)) fail('INVALID_SCHEMA', `${label} has unsupported value`);
  const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value === 'number' && Number.isInteger(value) ? 'integer' : typeof value;
  if (definition.type && ![definition.type].flat().includes(type)) fail('INVALID_SCHEMA', `${label} must have type ${definition.type}`);
  if (typeof value === 'string' && ((definition.minLength && value.trim().length < definition.minLength) || (definition.pattern && !new RegExp(definition.pattern).test(value)))) fail('INVALID_SCHEMA', `${label} has invalid string`);
  if (typeof value === 'number' && definition.minimum !== undefined && value < definition.minimum) fail('INVALID_SCHEMA', `${label} below minimum`);
  if (Array.isArray(value)) {
    if (definition.minItems && value.length < definition.minItems) fail('INVALID_SCHEMA', `${label} is empty`);
    if (definition.uniqueItems && new Set(value.map(canonical)).size !== value.length) fail('INVALID_SCHEMA', `${label} has duplicates`);
    value.forEach((item, index) => validateContractSchema(item, definition.items, `${label}[${index}]`));
  } else if (value !== null && typeof value === 'object') {
    for (const key of definition.required ?? []) if (!Object.hasOwn(value, key)) fail('INVALID_SCHEMA', `${label}.${key} is missing`);
    for (const [key, item] of Object.entries(value)) {
      const property = definition.properties?.[key];
      if (property) validateContractSchema(item, property, `${label}.${key}`);
      else if (definition.additionalProperties === false) fail('INVALID_SCHEMA', `${label}.${key} is unknown`);
      else if (typeof definition.additionalProperties === 'object') validateContractSchema(item, definition.additionalProperties, `${label}.${key}`);
    }
  }
  return value;
}

export function repoPath(root, path, mustExist = true) {
  if (typeof path !== 'string' || !path || isAbsolute(path) || path.split(/[\\/]/).includes('..') || path.includes('\\') || path.includes('\0')) fail('INVALID_PATH', `invalid repository path ${path}`);
  const absolute = resolve(root, path);
  let ancestor = absolute;
  while (!existsSync(ancestor)) ancestor = dirname(ancestor);
  const actual = realpathSync(ancestor);
  if (actual !== root && !actual.startsWith(`${root}${sep}`)) fail('INVALID_PATH', `${path} escapes repository`);
  if (mustExist && !existsSync(absolute)) fail('MISSING_PATH', `${path} does not exist`);
  return absolute;
}

function readBlock(path, marker) {
  const content = readFileSync(path, 'utf8');
  const blocks = [...content.matchAll(/^```(?:json[ \t]+)?(task-contract|task-lifecycle)[ \t]*\r?\n([\s\S]*?)^```[ \t]*\r?$/gm)].filter((match) => match[1] === marker);
  if (blocks.length !== 1) fail('INVALID_BLOCK', `${path} requires exactly one ${marker} block (found ${blocks.length})`);
  try { return JSON.parse(blocks[0][2]); } catch (error) { fail('INVALID_JSON', `${path}: ${error.message}`); }
}

export function readTaskContract(repoRoot, contractPath) {
  return readCanonicalContract(repoRoot, contractPath, true);
}

function readCanonicalContract(repoRoot, contractPath, dispatch) {
  const root = realpathSync(repoRoot);
  const absolute = repoPath(root, contractPath);
  const metadata = validateContractSchema(readBlock(absolute, 'task-contract'), schema.$defs.contract, 'contract');
  const lifecyclePath = repoPath(root, metadata.lifecycle_ref);
  if (dirname(lifecyclePath) !== dirname(absolute)) fail('INVALID_LIFECYCLE', 'overview must be in the same task root');
  const lifecycle = readTaskLifecycle(root, metadata.lifecycle_ref);
  if (lifecycle.task_id !== metadata.task_id) fail('INVALID_LIFECYCLE', 'task_id mismatch');
  if (lifecycle.contract_versions[metadata.slice_id] !== metadata.contract_version) fail('INVALID_VERSION', 'lifecycle contract_versions entry mismatch');
  if (dispatch && metadata.mode === 'implementation' && (lifecycle.archived || lifecycle.status !== 'active' || lifecycle.superseded_by !== null)) fail('INACTIVE_CONTRACT', `implementation cannot dispatch lifecycle ${lifecycle.status}, archived=${lifecycle.archived}`);
  for (const path of [...metadata.allowed_paths, ...metadata.source_paths]) repoPath(root, path, false);
  for (const path of metadata.allowed_paths) {
    if (!metadata.source_paths.some((input) => matches(path, input))) fail('SOURCE_SCOPE_INCOMPLETE', `allowed path is outside source scope: ${path}`);
  }
  for (const path of [contractPath, metadata.lifecycle_ref]) {
    if (metadata.source_paths.some((input) => matches(path, input))) fail('SOURCE_SCOPE_INCOMPLETE', `contract/lifecycle must be hashed separately: ${path}`);
  }
  const contract = { ...metadata, contract_ref: relative(root, absolute).split(sep).join('/'), contract_hash: hash(canonical(metadata)), lifecycle_hash: hash(canonical(lifecycle)), lifecycle };
  return contract;
}

export function readTaskLifecycle(repoRoot, lifecyclePath) {
  const root = realpathSync(repoRoot);
  return validateContractSchema(readBlock(repoPath(root, lifecyclePath), 'task-lifecycle'), schema.$defs.lifecycle, 'lifecycle');
}

export function readLegacyEvidence(repoRoot, lifecycle) {
  const root = realpathSync(repoRoot);
  validateContractSchema(lifecycle, schema.$defs.lifecycle, 'lifecycle');
  const seen = new Set();
  const evidence = [];
  for (const entry of lifecycle.legacy_evidence ?? []) {
    const absolute = repoPath(root, entry.path);
    const actual = realpathSync(absolute);
    if (seen.has(actual)) fail('INVALID_LEGACY_EVIDENCE', `duplicate legacy pin: ${entry.path}`);
    seen.add(actual);
    const bytes = readFileSync(absolute);
    if (hash(bytes) !== entry.content_hash) fail('INVALID_LEGACY_EVIDENCE', `content hash mismatch: ${entry.path}`);
    let manifest;
    try { manifest = JSON.parse(bytes.toString('utf8')); } catch (error) { fail('INVALID_LEGACY_EVIDENCE', `${entry.path}: ${error.message}`); }
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest) || !manifest.task_id || manifest.tier !== 'governed' || (Object.hasOwn(manifest, 'manifest_version') && manifest.manifest_version !== 1)) fail('INVALID_LEGACY_EVIDENCE', `${entry.path} is not a legacy governed manifest (version 1 or unversioned)`);
    if (entry.replacement_contract !== null) readCanonicalContract(root, entry.replacement_contract, false);
    evidence.push({ ...entry, path: relative(root, absolute).split(sep).join('/'), resolved_path: actual });
  }
  return evidence;
}

export function deriveTaskManifest(contract) {
  const { task_id, slice_id, contract_ref, contract_version, contract_hash, lifecycle_hash, goal, mode, owner, allowed_paths, source_paths, acceptance, dependencies, permitted_checks, stop_conditions } = contract;
  return validateContractSchema({ manifest_version: 2, tier: 'governed', task_id, slice_id, contract_ref, contract_version, contract_hash, lifecycle_hash, goal, mode, owner, independent_verification: true, allowed_paths, source_paths, acceptance_criteria: acceptance, dependencies, validation_commands: permitted_checks, stop_conditions });
}

function git(root, args) {
  try { return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', timeout: 10000, maxBuffer: 32 * 1024 * 1024 }).trimEnd(); }
  catch (error) { fail('GIT_IDENTITY_FAILED', error.message); }
}

export function matches(path, input) {
  if (!/[?*]/.test(input)) return path === input || path.startsWith(`${input.replace(/\/$/, '')}/`);
  const pattern = input.split(/(\*\*\/|\*\*|\*|\?)/).map((part) => part === '**/' ? '(?:.*/)?' : part === '**' ? '.*' : part === '*' ? '[^/]*' : part === '?' ? '[^/]' : part.replace(/[.+^${}()|[\]\\]/g, '\\$&')).join('');
  return new RegExp(`^${pattern}$`).test(path);
}

export function computeSourceSnapshot(repoRoot, sourcePaths, { sourceFiles } = {}) {
  const root = realpathSync(repoRoot);
  validateContractSchema(sourcePaths, schema.$defs.strings, 'source_paths');
  for (const path of sourcePaths) repoPath(root, path, false);
  const evidenceRoots = ['.agent/reports', '.agent/scratch', '.agent/task-manifests'];
  for (const input of sourcePaths) {
    if (evidenceRoots.some((path) => matches(path, input) || input.startsWith(`${path}/`))) fail('SOURCE_SCOPE_INCOMPLETE', `runtime/generated evidence is not source: ${input}`);
  }
  const common = realpathSync(resolve(root, git(root, ['rev-parse', '--git-common-dir'])));
  const worktree = realpathSync(git(root, ['rev-parse', '--show-toplevel']));
  if (worktree !== root) fail('INVALID_PATH', 'repoRoot must be the worktree root');
  let paths;
  if (sourceFiles !== undefined) {
    // Dev build đã liệt kê source sau khi loại output; không truyền danh sách lớn qua argv.
    validateContractSchema(sourceFiles, schema.$defs.strings, 'source_files');
    for (const path of sourceFiles) repoPath(root, path, false);
    paths = new Set(sourceFiles);
  } else {
    paths = new Set(git(root, ['ls-files', '-z', '--cached', '--others', '--exclude-standard']).split('\0').filter(Boolean));
    for (const path of git(root, ['ls-files', '-z', '--others', '--ignored', '--exclude-standard', '--', ...sourcePaths]).split('\0').filter(Boolean)) paths.add(path);
    for (const path of git(root, ['diff', '--name-only', '-z', 'HEAD', '--']).split('\0').filter(Boolean)) paths.add(path);
    const collect = (absolute) => {
      const stat = lstatSync(absolute);
      if (stat.isDirectory()) for (const name of readdirSync(absolute).sort()) collect(join(absolute, name));
      else paths.add(relative(root, absolute).split(sep).join('/'));
    };
    for (const input of sourcePaths) if (!/[?*]/.test(input) && existsSync(join(root, input))) collect(join(root, input));
  }
  const selected = [...paths].filter((path) => sourcePaths.some((input) => matches(path, input))).sort();
  if (selected.some((path) => evidenceRoots.some((rootPath) => path === rootPath || path.startsWith(`${rootPath}/`)))) fail('SOURCE_SCOPE_INCOMPLETE', 'source scope includes runtime/generated evidence');
  for (const input of sourcePaths) if (!selected.some((path) => matches(path, input))) fail('SOURCE_SCOPE_INCOMPLETE', `source input has no tracked, deleted or existing files: ${input}`);
  const entries = selected.map((path) => {
    const absolute = join(root, path);
    let stat;
    try { stat = lstatSync(absolute); } catch (error) { if (error.code === 'ENOENT') return { path, kind: 'deleted' }; throw error; }
    if (stat.isSymbolicLink()) return { path, kind: 'symlink', target: readlinkSync(absolute) };
    repoPath(root, path);
    if (!stat.isFile()) fail('SOURCE_SCOPE_INCOMPLETE', `unsupported source type: ${path}`);
    return { path, kind: 'file', executable: Boolean(stat.mode & 0o111), hash: hash(readFileSync(absolute)) };
  });
  const source_paths = [...sourcePaths].sort();
  return { identity: { repo_id: hash(common), worktree_id: hash(worktree), source_fingerprint: hash(canonical({ source_paths, entries })), source_paths }, entries };
}

export function computeSourceIdentity(repoRoot, sourcePaths, options) {
  return computeSourceSnapshot(repoRoot, sourcePaths, options).identity;
}

export const SUBJECT_FIELDS = ['task_id', 'slice_id', 'contract_ref', 'contract_version', 'contract_hash', 'lifecycle_hash', 'repo_id', 'worktree_id', 'source_fingerprint', 'source_paths'];
const equal = (a, b) => canonical(a) === canonical(b);
const ordered = (subjects) => [...subjects].sort((a, b) => a.slice_id.localeCompare(b.slice_id) || a.contract_ref.localeCompare(b.contract_ref));
const digestPattern = /^[a-f0-9]{64}$/;
const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const runtimePrefix = '.agent/scratch/.runtime/lead-gate';
const completionPrefix = '.agent/reports/merge-gate/checkpoints/';
export const CHECKPOINT_OWNERS = ['orchestrator', 'maintainer'];

function evidenceJSON(path, code) {
  try { return JSON.parse(readFileSync(path, 'utf8')); }
  catch (error) {
    if (error instanceof SyntaxError || error.code === 'ENOENT') fail(code, `missing/malformed evidence: ${path}`);
    throw error;
  }
}

export function taskSubject(repoRoot, contractRef) {
  const contract = readTaskContract(repoRoot, contractRef);
  const source = computeSourceIdentity(repoRoot, contract.source_paths);
  return { ...Object.fromEntries(SUBJECT_FIELDS.slice(0, 6).map(key => [key, contract[key]])), ...source };
}

function validateSubject(subject) {
  if (!subject || typeof subject !== 'object' || Array.isArray(subject) ||
      !equal(Object.keys(subject).sort(), [...SUBJECT_FIELDS].sort())) fail('INVALID_GATE_SUBJECT', 'exact identity fields required');
  for (const key of ['task_id', 'slice_id']) if (typeof subject[key] !== 'string' || !identifierPattern.test(subject[key])) fail('INVALID_GATE_SUBJECT', key);
  for (const key of ['contract_hash', 'lifecycle_hash', 'repo_id', 'worktree_id', 'source_fingerprint']) {
    if (typeof subject[key] !== 'string' || !digestPattern.test(subject[key])) fail('INVALID_GATE_SUBJECT', key);
  }
  if (typeof subject.contract_ref !== 'string' || !subject.contract_ref.startsWith('.agent/planning/') ||
      !Number.isInteger(subject.contract_version) || subject.contract_version < 1) fail('INVALID_GATE_SUBJECT', 'contract');
  validateContractSchema(subject.source_paths, schema.$defs.strings, 'source_paths');
  if (!equal(subject.source_paths, [...subject.source_paths].sort())) fail('INVALID_GATE_SUBJECT', 'source_paths order');
  return subject;
}

export function validateGateState(state, initial = null) {
  if (!state || state.state_version !== 1 || typeof state.task_id !== 'string' || !identifierPattern.test(state.task_id) ||
      !digestPattern.test(state.repo_id) || !digestPattern.test(state.worktree_id) ||
      !state.slices || typeof state.slices !== 'object' || Array.isArray(state.slices)) fail('INVALID_GATE_STATE', 'invalid state envelope');
  if (Object.keys(state).some(key => !['state_version', 'task_id', 'repo_id', 'worktree_id', 'slices', 'snapshot_required', 'freeze_ref', 'freeze_sha256'].includes(key))) fail('INVALID_GATE_STATE', 'unknown state fields');
  if (Object.hasOwn(state, 'freeze_ref') !== Object.hasOwn(state, 'freeze_sha256') ||
      Object.hasOwn(state, 'freeze_ref') && (typeof state.freeze_ref !== 'string' || !state.freeze_ref.startsWith(`${runtimePrefix}/`) ||
      typeof state.freeze_sha256 !== 'string' || !digestPattern.test(state.freeze_sha256))) fail('INVALID_GATE_STATE', 'freeze reference');
  if (Object.hasOwn(state, 'snapshot_required') && state.snapshot_required !== true) fail('INVALID_GATE_STATE', 'snapshot marker cannot be disabled');
  if (initial && ['task_id', 'repo_id', 'worktree_id'].some(key => state[key] !== initial[key])) fail('STATE_IDENTITY_MISMATCH', 'state belongs to another task/worktree');
  for (const [slice, obligation] of Object.entries(state.slices)) {
    if (!obligation || typeof obligation !== 'object' || Array.isArray(obligation)) fail('INVALID_GATE_STATE', 'obligation');
    if (Object.keys(obligation).some(key => !['identity', 'record_ref', 'record_sha256', 'verdict', 'ci_ref', 'ci_sha256'].includes(key))) fail('INVALID_GATE_STATE', 'unknown obligation fields');
    if (Object.hasOwn(obligation, 'ci_ref') !== Object.hasOwn(obligation, 'ci_sha256') ||
        Object.hasOwn(obligation, 'ci_ref') && (typeof obligation.ci_ref !== 'string' || !obligation.ci_ref.endsWith('/summary.json') ||
        typeof obligation.ci_sha256 !== 'string' || !digestPattern.test(obligation.ci_sha256) ||
        !['pass', 'pass-with-debt'].includes(obligation.verdict))) fail('INVALID_GATE_STATE', 'CI reference');
    const subject = validateSubject(obligation.identity);
    if (subject.slice_id !== slice || ['task_id', 'repo_id', 'worktree_id'].some(key => subject[key] !== state[key])) fail('INVALID_GATE_STATE', 'obligation identity');
    if (![null, 'pass', 'pass-with-debt', 'blocked-user', 'waived'].includes(obligation.verdict) ||
        !(obligation.record_ref === null || typeof obligation.record_ref === 'string') ||
        !(obligation.record_sha256 === null || typeof obligation.record_sha256 === 'string' && digestPattern.test(obligation.record_sha256)) ||
        (obligation.record_ref === null) !== (obligation.record_sha256 === null) ||
        (obligation.verdict === null) !== (obligation.record_ref === null)) fail('INVALID_GATE_STATE', 'record fields');
  }
  return state;
}

export function gateStatePath(repoRoot, subject) {
  validateSubject(subject);
  return repoPath(realpathSync(repoRoot), `${runtimePrefix}/${subject.repo_id}-${subject.worktree_id}/${subject.task_id}.json`, false);
}

/** Khoá chung dispatch/freeze/stop, không TTL và không xoá khoá của process khác. */
export async function updateGateState(path, initial, update) {
  mkdirSync(dirname(path), { recursive: true });
  const lock = `${path}.lock`;
  const deadline = Date.now() + 3000;
  for (;;) {
    try { mkdirSync(lock); break; }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (Date.now() >= deadline) fail('LEAD_GATE_LOCK_BUSY', 'bounded state lock is busy');
      await delay(50);
    }
  }
  try {
    const persisted = existsSync(path) ? evidenceJSON(path, 'INVALID_GATE_STATE') : null;
    const state = validateGateState(persisted === null ? initial : persisted, initial);
    const before = canonical(state);
    const result = await update(state);
    validateGateState(state, initial);
    if (persisted === null || canonical(state) !== before) atomicJSON(path, state);
    return result;
  } finally { rmdirSync(lock); }
}

function atomicJSON(path, value, immutable = false) {
  const bytes = `${JSON.stringify(value, null, 2)}\n`;
  if (immutable && existsSync(path)) {
    if (readFileSync(path, 'utf8') !== bytes) fail('IMMUTABLE_EVIDENCE_CONFLICT', path);
    return hash(bytes);
  }
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.${randomUUID()}.tmp`;
  writeFileSync(temp, bytes, { flag: 'wx' });
  try {
    if (immutable) linkSync(temp, path);
    else renameSync(temp, path);
  } finally { if (existsSync(temp)) unlinkSync(temp); }
  return hash(bytes);
}

function evidenceDir(root, path, taskId) { return repoPath(root, reference(root, join(dirname(path), 'checkpoints', taskId)), false); }
function reference(root, path) { return relative(root, path).split(sep).join('/'); }

function snapshotProof(root, path, subject) {
  if (!existsSync(path)) fail('INVALID_DISPATCH_SNAPSHOT', 'required snapshot missing');
  if (lstatSync(repoPath(root, reference(root, path))).isSymbolicLink()) fail('INVALID_DISPATCH_SNAPSHOT', 'snapshot cannot be a symlink');
  const bytes = readFileSync(repoPath(root, reference(root, path)));
  const proof = evidenceJSON(path, 'INVALID_DISPATCH_SNAPSHOT');
  if (proof.snapshot_version !== 1 || !equal(proof.subject, subject) || !Array.isArray(proof.entries) ||
      hash(canonical({ source_paths: subject.source_paths, entries: proof.entries })) !== subject.source_fingerprint) fail('INVALID_DISPATCH_SNAPSHOT', reference(root, path));
  return { slice_id: subject.slice_id, ref: reference(root, path), sha256: hash(bytes) };
}

/** Baseline chỉ tạo ở dispatch mới; redispatch không được thay identity hoặc xoá proof. */
export async function captureTaskDispatch(repoRoot, contractRefs) {
  const root = realpathSync(repoRoot);
  const subjects = ordered(contractRefs.map(ref => taskSubject(root, ref)));
  validateTaskSet(subjects);
  const path = gateStatePath(root, subjects[0]);
  const initial = { state_version: 1, task_id: subjects[0].task_id, repo_id: subjects[0].repo_id, worktree_id: subjects[0].worktree_id, slices: {} };
  return updateGateState(path, initial, state => {
    const dir = evidenceDir(root, path, state.task_id);
    const transitions = supersessionHistory(root, path, state);
    if (Object.hasOwn(state, 'freeze_ref') || existsSync(join(dir, 'freeze.json')) && !transitions.length) fail('FROZEN_DISPATCH_REQUIRES_SUPERSESSION', 'freeze through an explicit checkpoint-approved supersession before any further writer');
    if (transitions.length) {
      exactStateSet(state, subjects);
      if (!equal(ordered(Object.values(state.slices).map(item => item.identity)), subjects)) fail('OUTSTANDING_CONTRACT_CONFLICT', 'redispatch cannot refresh source');
      if (!equal(subjects, transitions.at(-1).value.inspection.proposed_subjects)) fail('INTERRUPTED_SUPERSESSION', 'explicit retry required');
      return subjects;
    }
    if (!existsSync(path) && existsSync(dir)) fail('INVALID_GATE_STATE', 'dispatch evidence exists but state is missing; do not rebaseline');
    const marker = join(dir, 'snapshot-required.json');
    if (Object.keys(state.slices).length && !state.snapshot_required && !existsSync(marker)) fail('LEGACY_REDISPATCH_FORBIDDEN', 'legacy obligations require independently reviewed completion, not a new historical baseline');
    atomicJSON(marker, { snapshot_version: 1, task_id: state.task_id, repo_id: state.repo_id, worktree_id: state.worktree_id }, true);
    state.snapshot_required = true;
    for (const subject of subjects) {
      const previous = state.slices[subject.slice_id];
      if (previous) {
        if (!equal(previous.identity, subject)) fail('OUTSTANDING_CONTRACT_CONFLICT', 'redispatch cannot refresh an outstanding identity');
        snapshotProof(root, join(dir, `dispatch-${subject.slice_id}-${subject.source_fingerprint}.json`), subject);
        continue;
      }
      const snapshot = computeSourceSnapshot(root, subject.source_paths);
      if (!equal(snapshot.identity, Object.fromEntries(Object.keys(snapshot.identity).map(key => [key, subject[key]])))) fail('DISPATCH_SOURCE_CHANGED', subject.slice_id);
      atomicJSON(join(dir, `dispatch-${subject.slice_id}-${subject.source_fingerprint}.json`), { snapshot_version: 1, subject, entries: snapshot.entries }, true);
      state.slices[subject.slice_id] = { identity: subject, record_ref: null, record_sha256: null, verdict: null };
    }
    return subjects;
  });
}

function validateTaskSet(subjects) {
  if (!Array.isArray(subjects) || !subjects.length) fail('INVALID_TASK_SET', 'empty task set');
  subjects.forEach(validateSubject);
  if (new Set(subjects.map(s => s.slice_id)).size !== subjects.length || new Set(subjects.map(s => s.contract_ref)).size !== subjects.length ||
      subjects.some(s => ['task_id', 'repo_id', 'worktree_id'].some(key => s[key] !== subjects[0][key]))) fail('INVALID_TASK_SET', 'duplicate or mixed task set');
}

function exactStateSet(state, current) {
  validateGateState(state, current[0]);
  const dispatch = ordered(Object.values(state.slices).map(o => o.identity));
  validateTaskSet(dispatch);
  if (!equal(dispatch.map(s => s.slice_id), current.map(s => s.slice_id))) fail('OUTSTANDING_SUBJECT_MISMATCH', 'full outstanding task set required');
  for (let i = 0; i < current.length; i++) {
    if (SUBJECT_FIELDS.filter(key => key !== 'source_fingerprint').some(key => !equal(dispatch[i][key], current[i][key]))) fail('OUTSTANDING_SUBJECT_MISMATCH', 'canonical/lifecycle/repo/worktree/source_paths changed');
  }
  return dispatch;
}

const legacyRefs = {
  'agent-context-sizing': [
    '.agent/planning/agent-context-sizing/TASK-01-specialist-context.md',
    '.agent/planning/agent-context-sizing/TASK-02-instruction-alignment.md',
    '.agent/planning/agent-context-sizing/TASK-03-lead-decision-modes.md'
  ],
  'gate-identity-refresh': [
    '.agent/planning/gate-identity-refresh/TASK-04-gate-identity.md',
    '.agent/planning/gate-identity-refresh/TASK-05-gate-regression.md'
  ]
};
const legacyVersions = { 'agent-context-sizing': [1, 1, 2], 'gate-identity-refresh': [1, 1] };

function changedPaths(before, after) {
  const old = new Map(before.map(entry => [entry.path, entry]));
  const now = new Map(after.map(entry => [entry.path, entry]));
  return [...new Set([...old.keys(), ...now.keys()])].filter(path => !equal(old.get(path), now.get(path))).sort();
}

function supersessionHistory(root, path, state) {
  const dir = evidenceDir(root, path, state.task_id);
  if (!existsSync(dir)) return [];
  const proofs = readdirSync(dir).filter(name => /^transition-[a-f0-9]{64}\.json$/.test(name)).map(name => {
    const ref = reference(root, join(dir, name));
    const location = repoPath(root, ref);
    if (lstatSync(location).isSymbolicLink()) fail('INVALID_TRANSITION', 'symlink evidence');
    const bytes = readFileSync(location);
    const value = evidenceJSON(location, 'INVALID_TRANSITION');
    if (!equal(Object.keys(value).sort(), ['transition_version', 'previous_sha256', 'predecessor_bytes', 'inspection', 'approval', 'next_state'].sort()) ||
        value.transition_version !== 1 || !value.inspection || !value.approval ||
        name !== `transition-${value.approval.sha256}.json`) fail('INVALID_TRANSITION', ref);
    validateGateState(value.next_state, state);
    validateGateState(value.inspection.previous_state, state);
    if (typeof value.predecessor_bytes !== 'string' ||
        hash(value.predecessor_bytes) !== value.inspection.predecessor_sha256 ||
        !equal(JSON.parse(value.predecessor_bytes), value.inspection.previous_state)) fail('INVALID_TRANSITION', 'predecessor bytes differ');
    const expectedState = {
      state_version: 1, task_id: state.task_id, repo_id: state.repo_id, worktree_id: state.worktree_id,
      ...(value.inspection.previous_state.snapshot_required ? { snapshot_required: true } : {}),
      slices: Object.fromEntries(value.inspection.proposed_subjects.map(identity => [identity.slice_id,
        { identity, record_ref: null, record_sha256: null, verdict: null }]))
    };
    if (!equal(value.next_state, expectedState)) fail('INVALID_TRANSITION', 'next state envelope differs');
    if (!equal(ordered(Object.values(value.next_state.slices).map(item => item.identity)), value.inspection.proposed_subjects) ||
        Object.values(value.next_state.slices).some(item => !equal(Object.keys(item).sort(), ['identity', 'record_ref', 'record_sha256', 'verdict'].sort()) ||
          item.record_ref !== null || item.record_sha256 !== null || item.verdict !== null) ||
        Object.hasOwn(value.next_state, 'freeze_ref')) fail('INVALID_TRANSITION', 'certification was transferred');
    const approvalPath = repoPath(root, value.approval.ref);
    for (let ancestor = approvalPath; ancestor !== root; ancestor = dirname(ancestor)) {
      if (lstatSync(ancestor).isSymbolicLink()) fail('INVALID_TRANSITION', 'approval symlink');
    }
    const approvalBytes = readFileSync(approvalPath);
    const approvalBlocks = [...approvalBytes.toString('utf8').matchAll(/^```json gate-supersession[ \t]*\r?\n([\s\S]*?)^```[ \t]*\r?$/gm)];
    if (approvalBlocks.length !== 1 || !equal(JSON.parse(approvalBlocks[0][1]), value.approval.value) ||
        !equal(Object.keys(value.approval.value).sort(), [...SUPERSESSION_APPROVAL_FIELDS].sort()) ||
        value.approval.value.approval_version !== 1 ||
        !value.approval.ref.startsWith(completionPrefix) || hash(approvalBytes) !== value.approval.sha256 ||
        !equal(value.approval.value.inspection, value.inspection) ||
        !CHECKPOINT_OWNERS.includes(value.approval.value.owner) || typeof value.approval.value.independent_review !== 'boolean' ||
        value.approval.value.model_degraded !== false) fail('INVALID_TRANSITION', 'approval provenance changed');
    validateTaskSupersessionSourceAuthorization(value.approval.value.source_authorization, value.inspection, 'INVALID_TRANSITION');
    for (const snapshot of value.inspection.dispatch_snapshots) {
      if (hash(readFileSync(repoPath(root, snapshot.ref))) !== snapshot.sha256) fail('INVALID_TRANSITION', 'original dispatch changed');
    }
    if (value.inspection.previous_freeze &&
        hash(readFileSync(repoPath(root, value.inspection.previous_freeze.ref))) !== value.inspection.previous_freeze.sha256) fail('INVALID_TRANSITION', 'original freeze changed');
    return { ref, sha256: hash(bytes), value };
  });
  const chain = [];
  let parent = null;
  for (;;) {
    const next = proofs.filter(item => item.value.previous_sha256 === parent);
    if (next.length > 1) fail('INVALID_TRANSITION_CHAIN', 'fork');
    if (!next.length) break;
    const item = next[0];
    if (chain.some(previous => previous.sha256 === item.sha256)) fail('INVALID_TRANSITION_CHAIN', 'cycle');
    if (chain.length) {
      const prior = chain.at(-1).value.inspection.proposed_subjects;
      const before = item.value.inspection.previous_subjects;
      if (!equal(before, prior) && !(item.value.inspection.previous_freeze &&
          equal(item.value.inspection.previous_freeze.value.dispatch_subjects, prior) &&
          equal(item.value.inspection.previous_freeze.value.subjects, before))) fail('INVALID_TRANSITION_CHAIN', 'subject predecessor mismatch');
    }
    chain.push(item);
    parent = item.sha256;
  }
  if (chain.length !== proofs.length) fail('INVALID_TRANSITION_CHAIN', 'unlinked proof');
  if (chain.length) {
    const tip = chain.at(-1).value;
    const identities = ordered(Object.values(state.slices).map(item => item.identity));
    const frozen = Object.hasOwn(state, 'freeze_ref') ? frozenEvidence(root, path, state) : null;
    const completed = frozen && state.freeze_ref === frozen.ref && state.freeze_sha256 === frozen.sha256 &&
      equal(frozen.value.subjects, identities) && equal(frozen.value.dispatch_subjects, tip.inspection.proposed_subjects);
    if (!equal(identities, tip.inspection.proposed_subjects) &&
        !completed && hash(readFileSync(path)) !== tip.inspection.predecessor_sha256) fail('INVALID_TRANSITION_STATE', 'partial or unrelated publication');
  }
  return chain;
}

/** Chỉ kiểm tra chuỗi đã publish, không sửa runtime. */
export function verifyTaskSupersession(repoRoot, contractRefs) {
  const root = realpathSync(repoRoot);
  const subjects = ordered(contractRefs.map(ref => taskSubject(root, ref)));
  validateTaskSet(subjects);
  const path = gateStatePath(root, subjects[0]);
  const state = validateGateState(evidenceJSON(path, 'INVALID_GATE_STATE'), subjects[0]);
  exactStateSet(state, subjects);
  const chain = supersessionHistory(root, path, state);
  if (chain.length && hash(readFileSync(path)) === chain.at(-1).value.inspection.predecessor_sha256) fail('INTERRUPTED_SUPERSESSION', 'explicit publish retry required');
  return chain;
}

/** Publish tường minh dưới khoá chung, ghi proof trước atomic rename. */
export async function publishTaskSupersession(repoRoot, contractRefs, approvalRef) {
  const root = realpathSync(repoRoot);
  const subjects = ordered(contractRefs.map(ref => taskSubject(root, ref)));
  validateTaskSet(subjects);
  const path = gateStatePath(root, subjects[0]);
  return updateGateState(path, null, state => {
    const chain = supersessionHistory(root, path, state);
    const tip = chain.at(-1);
    if (tip && tip.value.approval.ref === approvalRef) {
      const inspection = tip.value.inspection;
      if (!equal(subjects, inspection.proposed_subjects) ||
          !equal(computeSourceSnapshot(root, inspection.source_union.source_paths).entries, inspection.reviewed_entries)) fail('STALE_SUPERSESSION_APPROVAL', 'retry canonical/source differs');
      if (hash(readFileSync(path)) === inspection.predecessor_sha256) {
        const refreshed = supersessionInspection(root, contractRefs, state, path);
        if (!equal(refreshed, inspection)) fail('STALE_SUPERSESSION_APPROVAL', 'retry predecessor differs');
        readTaskSupersessionApproval(root, approvalRef, refreshed);
        for (const key of Object.keys(state)) delete state[key];
        Object.assign(state, tip.value.next_state);
      } else if (!equal(state, tip.value.next_state)) fail('INVALID_TRANSITION_STATE', 'retry requires exact published state');
      return tip;
    }
    if (tip && hash(readFileSync(path)) === tip.value.inspection.predecessor_sha256) fail('INTERRUPTED_SUPERSESSION', 'retry pending proof first');
    const inspection = supersessionInspection(root, contractRefs, state, path);
    if (equal(inspection.previous_subjects, inspection.proposed_subjects)) fail('INVALID_SUPERSESSION', 'identity transition required; no certification reset alias');
    const approval = readTaskSupersessionApproval(root, approvalRef, inspection);
    const next_state = {
      state_version: 1, task_id: state.task_id, repo_id: state.repo_id, worktree_id: state.worktree_id,
      ...(state.snapshot_required ? { snapshot_required: true } : {}),
      slices: Object.fromEntries(inspection.proposed_subjects.map(identity => [identity.slice_id,
        { identity, record_ref: null, record_sha256: null, verdict: null }]))
    };
    const proof = { transition_version: 1, previous_sha256: tip ? tip.sha256 : null,
      predecessor_bytes: readFileSync(path, 'utf8'), inspection, approval, next_state };
    const proofPath = join(evidenceDir(root, path, state.task_id), `transition-${approval.sha256}.json`);
    const sha256 = atomicJSON(proofPath, proof, true);
    if (!equal(subjects, ordered(contractRefs.map(ref => taskSubject(root, ref)))) ||
        !equal(computeSourceSnapshot(root, inspection.source_union.source_paths).entries, inspection.reviewed_entries) ||
        hash(readFileSync(repoPath(root, approval.ref))) !== approval.sha256 ||
        hash(readFileSync(path)) !== inspection.predecessor_sha256) fail('STALE_SUPERSESSION_APPROVAL', 'source/state/approval changed before publication');
    for (const key of Object.keys(state)) delete state[key];
    Object.assign(state, next_state);
    return { ref: reference(root, proofPath), sha256, value: proof };
  });
}

function supersessionInspection(root, refs, state, path) {
  const predecessor_sha256 = hash(readFileSync(path));
  if (!equal(state, evidenceJSON(path, 'INVALID_GATE_STATE'))) fail('SUPERSESSION_STATE_CHANGED', 'state changed before inspection');
  const contracts = refs.map(ref => readTaskContract(root, ref));
  const subjects = ordered(refs.map(ref => taskSubject(root, ref)));
  validateTaskSet(subjects);
  validateGateState(state, subjects[0]);
  const previous = ordered(Object.values(state.slices).map(obligation => obligation.identity));
  validateTaskSet(previous);
  if (!equal(previous.map(subject => [subject.slice_id, subject.contract_ref]),
      subjects.map(subject => [subject.slice_id, subject.contract_ref]))) fail('OUTSTANDING_SUBJECT_MISMATCH', 'exact full outstanding slice/ref set required');
  for (let index = 0; index < subjects.length; index++) {
    const before = previous[index];
    const after = subjects[index];
    if (after.contract_version < before.contract_version) fail('INVALID_SUPERSESSION_VERSION', 'contract version cannot decrease');
    if (after.contract_version === before.contract_version && after.contract_hash !== before.contract_hash) fail('INVALID_SUPERSESSION_VERSION', 'canonical edit requires an increased version');
  }
  const dir = evidenceDir(root, path, state.task_id);
  const history = supersessionHistory(root, path, state);
  const published = history.filter(item => item.value.inspection.predecessor_sha256 !== predecessor_sha256);
  const previous_freeze = Object.hasOwn(state, 'freeze_ref') ? frozenEvidence(root, path, state) : null;
  if (previous_freeze && (state.freeze_ref !== previous_freeze.ref ||
      state.freeze_sha256 !== previous_freeze.sha256 || !equal(previous_freeze.value.subjects, previous))) {
    fail('FROZEN_STATE_MISMATCH', 'inspection requires a coherently published freeze');
  }
  const original = history.length ? (history[0].value.inspection.previous_freeze ?
    history[0].value.inspection.previous_freeze.value.dispatch_subjects : history[0].value.inspection.previous_subjects) :
    previous_freeze ? previous_freeze.value.dispatch_subjects : previous;
  const baseline = new Map();
  const dispatch_snapshots = [];
  const required = state.snapshot_required === true || existsSync(join(dir, 'snapshot-required.json'));
  if (required) {
    const marker = evidenceJSON(join(dir, 'snapshot-required.json'), 'INVALID_DISPATCH_SNAPSHOT');
    if (state.snapshot_required !== true || !equal(marker, {
      snapshot_version: 1, task_id: state.task_id, repo_id: state.repo_id, worktree_id: state.worktree_id
    })) fail('INVALID_DISPATCH_SNAPSHOT', 'snapshot marker mismatch');
    const expected = original.map(subject => `dispatch-${subject.slice_id}-${subject.source_fingerprint}.json`).sort();
    if (!equal(readdirSync(dir).filter(name => name.startsWith('dispatch-')).sort(), expected)) fail('INVALID_DISPATCH_SNAPSHOT', 'exact original baseline set required');
    for (const subject of original) {
      const snapshotPath = join(dir, `dispatch-${subject.slice_id}-${subject.source_fingerprint}.json`);
      dispatch_snapshots.push(snapshotProof(root, snapshotPath, subject));
      for (const entry of evidenceJSON(snapshotPath, 'INVALID_DISPATCH_SNAPSHOT').entries) {
        if (baseline.has(entry.path) && !equal(baseline.get(entry.path), entry)) fail('DISPATCH_BASELINE_CONFLICT', entry.path);
        baseline.set(entry.path, entry);
      }
    }
  } else if (existsSync(dir) && readdirSync(dir).some(name => name.startsWith('dispatch-'))) {
    fail('INVALID_DISPATCH_SNAPSHOT', 'unmarked dispatch evidence cannot become legacy');
  }
  const sourcePaths = [...new Set([...previous, ...subjects].flatMap(subject => subject.source_paths))].sort();
  const snapshot = computeSourceSnapshot(root, sourcePaths);
  const allowed_paths = [...new Set(contracts.flatMap(contract => contract.allowed_paths))].sort();
  const metadata = contracts.map(contract => {
    const { contract_ref, contract_hash, lifecycle_hash, lifecycle, ...canonical_metadata } = contract;
    return { contract_ref, contract_hash, lifecycle_hash, canonical_metadata, lifecycle };
  }).sort((a, b) => a.contract_ref.localeCompare(b.contract_ref));
  const historical_metadata = previous.map(subject => {
    const pinned = history.flatMap(item => item.value.inspection.proposed_metadata)
      .findLast(item => item.contract_ref === subject.contract_ref && item.contract_hash === subject.contract_hash);
    const current = pinned ? pinned : metadata.find(item => item.contract_ref === subject.contract_ref);
    return {
      slice_id: subject.slice_id,
      canonical_metadata: current.contract_hash === subject.contract_hash ? current.canonical_metadata : null,
      lifecycle: current.lifecycle_hash === subject.lifecycle_hash ? current.lifecycle : null
    };
  });
  for (const item of published) {
    for (const entry of item.value.inspection.reviewed_entries) {
      if (!baseline.has(entry.path)) baseline.set(entry.path, entry);
    }
  }
  const baseline_entries = [...baseline.values()].sort((a, b) => a.path.localeCompare(b.path));
  if (!equal(subjects, ordered(refs.map(ref => taskSubject(root, ref))))) fail('SUPERSESSION_SOURCE_CHANGED', 'canonical/source changed during inspection');
  if (!equal(snapshot, computeSourceSnapshot(root, sourcePaths))) fail('SUPERSESSION_SOURCE_CHANGED', 'old/new source union changed during inspection');
  if (predecessor_sha256 !== hash(readFileSync(path))) fail('SUPERSESSION_STATE_CHANGED', 'state changed during inspection');
  return {
    inspection_version: 1, task_id: state.task_id, repo_id: state.repo_id, worktree_id: state.worktree_id,
    predecessor_sha256, previous_state: JSON.parse(canonical(state)),
    previous_subjects: previous, proposed_subjects: subjects, proposed_metadata: metadata,
    historical_metadata, baseline_kind: required ? 'dispatch-backed' : 'hash-only',
    dispatch_snapshots, baseline_entries, source_union: snapshot.identity, reviewed_entries: snapshot.entries,
    allowed_paths, mutation_paths: required ? changedPaths(baseline_entries,
      snapshot.entries.filter(entry => baseline.has(entry.path))) : [],
    newly_reviewed_paths: snapshot.entries.filter(entry => !baseline.has(entry.path)).map(entry => entry.path),
    previous_freeze
  };
}

/** Chỉ cung cấp dữ liệu review, không refresh hoặc tạo quyền đổi obligation. */
export function inspectTaskSupersession(repoRoot, contractRefs) {
  const root = realpathSync(repoRoot);
  const subjects = ordered(contractRefs.map(ref => taskSubject(root, ref)));
  validateTaskSet(subjects);
  const path = gateStatePath(root, subjects[0]);
  const state = validateGateState(evidenceJSON(path, 'INVALID_GATE_STATE'), subjects[0]);
  return supersessionInspection(root, contractRefs, state, path);
}

export const SUPERSESSION_APPROVAL_FIELDS = ['approval_version', 'owner', 'model_degraded',
  'independent_review', 'inspection', 'reason', 'source_authorization'];
export const SOURCE_AUTHORIZATION_FIELDS = ['authorized_mutations', 'kind', 'user_words'];

export function isNormalizedRepoPath(p) {
  if (typeof p !== 'string' || !p.trim()) return false;
  if (p.includes('\\') || p.includes('\0') || isAbsolute(p)) return false;
  if (p.startsWith('/') || p.startsWith('./') || p.endsWith('/')) return false;
  if (posix.normalize(p) !== p) return false;
  if (p.split('/').some(segment => segment === '.' || segment === '..')) return false;
  return true;
}

export function validateTaskSupersessionSourceAuthorization(authorization, inspection, failCode = null) {
  const raise = (defaultCode, message) => {
    fail(failCode ?? defaultCode, failCode === 'INVALID_TRANSITION' ? 'approval provenance changed' : message);
  };

  if (!authorization || typeof authorization !== 'object' || Array.isArray(authorization) ||
      !equal(Object.keys(authorization).sort(), SOURCE_AUTHORIZATION_FIELDS)) {
    raise('INVALID_SUPERSESSION_APPROVAL', 'strict source authorization keys required');
  }
  if (authorization.kind !== 'user-approved-current-source-review') {
    raise('INVALID_SUPERSESSION_APPROVAL', 'explicit user-approved-current-source-review kind required');
  }
  if (typeof authorization.user_words !== 'string' || !authorization.user_words.trim()) {
    raise('INVALID_SUPERSESSION_APPROVAL', 'explicit user-authorized current source words required');
  }
  if (!Array.isArray(authorization.authorized_mutations)) {
    raise('INVALID_SUPERSESSION_APPROVAL', 'authorized_mutations must be an array');
  }

  const entriesMap = new Map((inspection?.reviewed_entries ?? []).map(entry => [entry.path, entry]));
  const seenPaths = new Set();

  for (const item of authorization.authorized_mutations) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      raise('INVALID_SUPERSESSION_APPROVAL', 'authorized mutation item must be an object');
    }
    const itemKeys = Object.keys(item).sort();
    if (!equal(itemKeys, ['path', 'provenance']) && !equal(itemKeys, ['path', 'provenance', 'sha256'])) {
      raise('INVALID_SUPERSESSION_APPROVAL', 'authorized mutation item has invalid keys');
    }
    if (!isNormalizedRepoPath(item.path)) {
      raise('INVALID_SUPERSESSION_APPROVAL', 'authorized mutation path must be a normalized repo path');
    }
    if (typeof item.provenance !== 'string' || !item.provenance.trim()) {
      raise('INVALID_SUPERSESSION_APPROVAL', 'authorized mutation provenance must be a non-empty string');
    }
    if (item.sha256 !== undefined && (typeof item.sha256 !== 'string' || !digestPattern.test(item.sha256))) {
      raise('INVALID_SUPERSESSION_APPROVAL', 'authorized mutation sha256 must be a 64-character lowercase hex string');
    }
    if (seenPaths.has(item.path)) {
      raise('INVALID_SUPERSESSION_APPROVAL', `duplicate authorized mutation path ${item.path}`);
    }
    seenPaths.add(item.path);

    const entry = entriesMap.get(item.path);
    if (!entry) {
      raise('INVALID_SUPERSESSION_APPROVAL', `authorized mutation path ${item.path} not in reviewed entries`);
    } else if (item.sha256 !== undefined) {
      const entryHash = entry.sha256 ?? entry.hash;
      if (entryHash !== item.sha256) {
        raise('UNAUTHORIZED_SOURCE_MUTATION', `mutation at ${item.path} hash mismatch`);
      }
    }
  }

  if (inspection?.baseline_kind === 'dispatch-backed') {
    for (const path of (inspection.mutation_paths ?? [])) {
      if (!seenPaths.has(path)) {
        raise('UNAUTHORIZED_SOURCE_MUTATION', `unauthorized mutation at ${path}: missing structural provenance`);
      }
    }
    for (const path of (inspection.newly_reviewed_paths ?? [])) {
      if (!seenPaths.has(path)) {
        raise('UNAUTHORIZED_SOURCE_MUTATION', `unauthorized newly introduced path at ${path}: missing structural provenance`);
      }
    }
  }
}

/** Đọc approval từ checkpoint task-contract tường minh (orchestrator/maintainer), không nhận boolean approval từ caller. */
export function readTaskSupersessionApproval(repoRoot, approvalRef, inspection) {
  const root = realpathSync(repoRoot);
  if (!inspection || !Array.isArray(inspection.proposed_subjects)) fail('INVALID_SUPERSESSION_APPROVAL', 'inspection required');
  const current = inspectTaskSupersession(root, inspection.proposed_subjects.map(subject => subject.contract_ref));
  if (!equal(current, inspection)) fail('STALE_SUPERSESSION_APPROVAL', 'state/canonical/source changed since inspection');
  if (typeof approvalRef !== 'string' || !approvalRef.startsWith(completionPrefix) || !approvalRef.endsWith('.md')) fail('INVALID_SUPERSESSION_APPROVAL', 'checkpoint path required');
  const path = repoPath(root, approvalRef);
  for (let current = path; current !== root; current = dirname(current)) {
    if (lstatSync(current).isSymbolicLink()) fail('INVALID_SUPERSESSION_APPROVAL', 'checkpoint ancestors cannot be symlinks');
  }
  const bytes = readFileSync(path);
  const text = bytes.toString('utf8');
  const blocks = [...text.matchAll(/^```json gate-supersession[ \t]*\r?\n([\s\S]*?)^```[ \t]*\r?$/gm)];
  if (blocks.length !== 1 || /^verdict:/m.test(text) || /^```(?:json[ \t]+)?gate-record/m.test(text)) fail('INVALID_SUPERSESSION_APPROVAL', 'exactly one checkpoint approval fence, not a pass record');
  let value;
  try { value = JSON.parse(blocks[0][1]); } catch (error) { fail('INVALID_SUPERSESSION_APPROVAL', error.message); }
  if (!value || !equal(Object.keys(value).sort(), [...SUPERSESSION_APPROVAL_FIELDS].sort()) ||
      value.approval_version !== 1 || !CHECKPOINT_OWNERS.includes(value.owner) || value.model_degraded !== false ||
      typeof value.independent_review !== 'boolean' || typeof value.reason !== 'string' || !value.reason.trim() ||
      !equal(value.inspection, inspection)) fail('INVALID_SUPERSESSION_APPROVAL', 'strict exact inspection checkpoint required');
  const authorization = value.source_authorization;
  validateTaskSupersessionSourceAuthorization(authorization, inspection);
  return { ref: approvalRef, sha256: hash(bytes), value };
}

function completionView(root, refs, state, path) {
  const subjects = ordered(refs.map(ref => taskSubject(root, ref)));
  validateTaskSet(subjects);
  const dispatch = exactStateSet(state, subjects);
  const contracts = refs.map(ref => readTaskContract(root, ref));
  const allowed_paths = [...new Set(contracts.flatMap(c => c.allowed_paths))].sort();
  const sourcePaths = [...new Set(subjects.flatMap(s => s.source_paths))].sort();
  const snapshot = computeSourceSnapshot(root, sourcePaths);
  const dir = evidenceDir(root, path, state.task_id);
  const history = supersessionHistory(root, path, state);
  if (history.length) {
    const transition = history.at(-1).value.inspection;
    if (!equal(dispatch, transition.proposed_subjects)) fail('INVALID_TRANSITION_STATE', 'completion subject set differs from transition');
    const mutations = changedPaths(transition.reviewed_entries.filter(entry =>
      subjects.some(subject => subject.source_paths.some(input => matches(entry.path, input)))), snapshot.entries);
    if (mutations.some(entry => !allowed_paths.some(input => matches(entry, input)))) fail('UNAUTHORIZED_SOURCE_MUTATION', 'dependency changed after explicit source review');
    return {
      completion_version: 1, owner: 'orchestrator', model_degraded: false,
      task_id: state.task_id, repo_id: state.repo_id, worktree_id: state.worktree_id,
      dispatch_subjects: dispatch, completed_subjects: subjects,
      source_union: snapshot.identity, allowed_paths, dispatch_snapshots: transition.dispatch_snapshots,
      reviewed_entries: snapshot.entries,
      reviewed_dependencies: snapshot.entries.filter(entry => !allowed_paths.some(input => matches(entry.path, input))),
      mutation_paths: mutations, authorization: 'baseline-verified'
    };
  }
  const required = state.snapshot_required === true || existsSync(join(dir, 'snapshot-required.json')) ||
    existsSync(dir) && readdirSync(dir).some(name => name.startsWith('dispatch-'));
  const dispatch_snapshots = [];
  const baseline = new Map();
  if (required) {
    if (state.snapshot_required !== true || !existsSync(join(dir, 'snapshot-required.json'))) fail('INVALID_DISPATCH_SNAPSHOT', 'snapshot marker missing');
    const expectedSnapshots = dispatch.map(subject => `dispatch-${subject.slice_id}-${subject.source_fingerprint}.json`).sort();
    if (!equal(readdirSync(dir).filter(name => name.startsWith('dispatch-')).sort(), expectedSnapshots)) fail('INVALID_DISPATCH_SNAPSHOT', 'baseline set differs from the exact outstanding state');
    const marker = evidenceJSON(join(dir, 'snapshot-required.json'), 'INVALID_DISPATCH_SNAPSHOT');
    if (!equal(marker, { snapshot_version: 1, task_id: state.task_id, repo_id: state.repo_id, worktree_id: state.worktree_id })) fail('INVALID_DISPATCH_SNAPSHOT', 'marker mismatch');
    for (const subject of dispatch) {
      const proofPath = join(dir, `dispatch-${subject.slice_id}-${subject.source_fingerprint}.json`);
      dispatch_snapshots.push(snapshotProof(root, proofPath, subject));
      for (const entry of JSON.parse(readFileSync(proofPath, 'utf8')).entries) {
        if (baseline.has(entry.path) && !equal(baseline.get(entry.path), entry)) fail('DISPATCH_BASELINE_CONFLICT', entry.path);
        baseline.set(entry.path, entry);
      }
    }
  } else if (!Object.hasOwn(legacyRefs, state.task_id) ||
      !equal(subjects.map(s => s.contract_ref).sort(), [...legacyRefs[state.task_id]].sort()) ||
      subjects.some(subject => subject.contract_version !== legacyVersions[state.task_id][legacyRefs[state.task_id].indexOf(subject.contract_ref)])) fail('LEGACY_MIGRATION_NOT_AUTHORIZED', 'only the two explicitly approved original task sets/versions can migrate');
  const mutation_paths = required ? changedPaths([...baseline.values()], snapshot.entries) : [];
  if (mutation_paths.some(path => !allowed_paths.some(input => matches(path, input)))) fail('UNAUTHORIZED_SOURCE_MUTATION', 'source-only dependency changed from dispatch');
  return {
    completion_version: 1, owner: 'orchestrator', model_degraded: false,
    task_id: state.task_id, repo_id: state.repo_id, worktree_id: state.worktree_id,
    dispatch_subjects: dispatch, completed_subjects: subjects,
    source_union: snapshot.identity, allowed_paths, dispatch_snapshots,
    reviewed_entries: snapshot.entries,
    reviewed_dependencies: snapshot.entries.filter(entry => !allowed_paths.some(input => matches(entry.path, input))),
    mutation_paths, authorization: required ? 'baseline-verified' : 'legacy-reviewed'
  };
}

/** Chỉ cung cấp identity/evidence để kiểm định; không tạo checkpoint hoặc quyền approval. */
export function inspectTaskCompletion(repoRoot, contractRefs) {
  const root = realpathSync(repoRoot);
  const subject = taskSubject(root, contractRefs[0]);
  const path = gateStatePath(root, subject);
  const state = validateGateState(evidenceJSON(path, 'INVALID_GATE_STATE'), subject);
  const dir = evidenceDir(root, path, state.task_id);
  if (Object.hasOwn(state, 'freeze_ref')) {
    const frozen = frozenEvidence(root, path, state);
    const reviewState = { ...state, slices: Object.fromEntries(frozen.value.dispatch_subjects.map(s => [s.slice_id, { identity: s, record_ref: null, record_sha256: null, verdict: null }])) };
    return completionView(root, contractRefs, reviewState, path);
  }
  return completionView(root, contractRefs, state, path);
}

function readCompletion(root, ref) {
  if (typeof ref !== 'string' || !ref.startsWith(completionPrefix) || !ref.endsWith('.md')) fail('INVALID_COMPLETION_REF', 'checkpoint path required');
  const path = repoPath(root, ref);
  if (lstatSync(path).isSymbolicLink()) fail('INVALID_COMPLETION_REF', 'checkpoint cannot be a symlink');
  const bytes = readFileSync(path);
  const text = bytes.toString('utf8');
  const blocks = [...text.matchAll(/^```json gate-completion[ \t]*\r?\n([\s\S]*?)^```[ \t]*\r?$/gm)];
  if (blocks.length !== 1 || /^verdict:/m.test(text) || /^```(?:json[ \t]+)?gate-record/m.test(text)) fail('INVALID_COMPLETION', 'one completion fence, not a pass record');
  return { value: JSON.parse(blocks[0][1]), ref, sha256: hash(bytes) };
}

function validateCompletion(value, view) {
  const extras = ['user_words', 'supersedes'];
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some(key => !Object.hasOwn(view, key) && !extras.includes(key))) fail('INVALID_COMPLETION', 'unknown completion fields');
  for (const [key, expected] of Object.entries(view)) {
    if (key === 'owner' ? !CHECKPOINT_OWNERS.includes(value.owner) : !equal(value[key], expected)) fail('COMPLETION_IDENTITY_MISMATCH', key);
  }
  if (view.authorization === 'legacy-reviewed' && value.user_words !== 'Review và pin nguồn hiện tại') fail('LEGACY_MIGRATION_NOT_AUTHORIZED', 'exact explicit user approval words required');
  const supersedeKeys = value.supersedes && typeof value.supersedes === 'object' ? Object.keys(value.supersedes).sort() : [];
  const approvalFlag = equal(supersedeKeys, ['checkpoint_approved', 'freeze_sha256', 'reason'])
    ? value.supersedes.checkpoint_approved
    : equal(supersedeKeys, ['freeze_sha256', 'lead_approved', 'reason'])
      ? value.supersedes.lead_approved
      : null;
  if (value.supersedes !== undefined && (!value.supersedes || !digestPattern.test(value.supersedes.freeze_sha256) ||
      approvalFlag !== true || typeof value.supersedes.reason !== 'string' || !value.supersedes.reason.trim())) fail('INVALID_SUPERSESSION', 'explicit linked checkpoint approval required');
}

function frozenEvidence(root, path, state) {
  const dir = evidenceDir(root, path, state.task_id);
  const firstPath = join(dir, 'freeze.json');
  if (!existsSync(firstPath)) fail('TASK_SET_NOT_FROZEN', 'completion checkpoint and freeze required before CI');
  const paths = readdirSync(dir).filter(name => name === 'freeze.json' || /^freeze-[a-f0-9]{64}\.json$/.test(name));
  const all = paths.map(name => {
    const ref = reference(root, join(dir, name));
    const bytes = readFileSync(repoPath(root, ref));
    if (lstatSync(join(dir, name)).isSymbolicLink()) fail('INVALID_FREEZE_EVIDENCE', 'symlink');
    const value = JSON.parse(bytes);
    if (!value || value.freeze_version !== 1 || value.task_id !== state.task_id ||
        !equal(Object.keys(value).sort(), ['freeze_version', 'task_id', 'repo_id', 'worktree_id', 'subjects', 'dispatch_subjects', 'source_union', 'allowed_paths', 'reviewed_entries', 'completion_ref', 'completion_sha256', 'previous_sha256'].sort()) ||
        !Array.isArray(value.subjects) || !Array.isArray(value.reviewed_entries) ||
        typeof value.completion_sha256 !== 'string' || !digestPattern.test(value.completion_sha256) ||
        value.previous_sha256 !== null && (typeof value.previous_sha256 !== 'string' || !digestPattern.test(value.previous_sha256))) fail('INVALID_FREEZE_EVIDENCE', ref);
    validateTaskSet(value.subjects);
    validateTaskSet(value.dispatch_subjects);
    return { ref, sha256: hash(bytes), value };
  });
  let current = all.find(item => item.ref === reference(root, firstPath));
  if (current.value.previous_sha256 !== null) fail('INVALID_FREEZE_CHAIN', 'first proof cannot supersede');
  const seen = new Set([current.sha256]);
  for (;;) {
    const next = all.filter(item => item.value.previous_sha256 === current.sha256);
    if (next.length > 1) fail('INVALID_FREEZE_CHAIN', 'forked supersession');
    if (!next.length) break;
    current = next[0];
    if (seen.has(current.sha256)) fail('INVALID_FREEZE_CHAIN', 'cycle');
    seen.add(current.sha256);
  }
  if (seen.size !== all.length) fail('INVALID_FREEZE_CHAIN', 'unlinked evidence');
  return current;
}

/** Fresh process freeze là lifecycle operation; CI không được gọi thao tác refresh này. */
export async function freezeTaskSet(repoRoot, contractRefs, completionRef) {
  const root = realpathSync(repoRoot);
  const subject = taskSubject(root, contractRefs[0]);
  const path = gateStatePath(root, subject);
  return updateGateState(path, null, state => {
    const completion = readCompletion(root, completionRef);
    const dir = evidenceDir(root, path, state.task_id);
    let previous = null;
    if (existsSync(join(dir, 'freeze.json'))) {
      previous = frozenEvidence(root, path, state);
      const transitions = supersessionHistory(root, path, state);
      const invalidated = !Object.hasOwn(state, 'freeze_ref') && transitions.length &&
        transitions.at(-1).value.inspection.previous_freeze?.sha256 === previous.sha256;
      if (invalidated) {
        if (completion.value.supersedes !== undefined) fail('INVALID_SUPERSESSION', 'transition already supplies explicit approval');
      } else {
      if (previous.value.completion_ref === completion.ref && previous.value.completion_sha256 === completion.sha256) {
        if (state.freeze_ref !== previous.ref || state.freeze_sha256 !== previous.sha256) {
          const transitionRecovery = !Object.hasOwn(state, 'freeze_ref') && transitions.length &&
            transitions.at(-1).value.inspection.previous_freeze?.sha256 === previous.value.previous_sha256 &&
            equal(transitions.at(-1).value.inspection.proposed_subjects, previous.value.dispatch_subjects);
          if (previous.value.previous_sha256 !== null) {
            if (!transitionRecovery) {
            if (state.freeze_sha256 !== previous.value.previous_sha256 || !state.freeze_ref) fail('FROZEN_STATE_MISMATCH', 'supersession publication has no valid predecessor');
            const parentBytes = readFileSync(repoPath(root, state.freeze_ref));
            const parent = JSON.parse(parentBytes);
            if (hash(parentBytes) !== state.freeze_sha256 || !equal(parent.subjects, ordered(Object.values(state.slices).map(o => o.identity)))) fail('FROZEN_STATE_MISMATCH', 'supersession predecessor state differs');
            }
          } else if (state.freeze_ref || state.freeze_sha256) fail('FROZEN_STATE_MISMATCH', 'unexpected freeze pointer');
          const reviewState = { ...state, slices: Object.fromEntries(previous.value.dispatch_subjects.map(s => [s.slice_id, { identity: s, record_ref: null, record_sha256: null, verdict: null }])) };
          exactStateSet(state, ordered(contractRefs.map(ref => taskSubject(root, ref))));
          const view = completionView(root, contractRefs, reviewState, path);
          validateCompletion(completion.value, view);
          if (!equal(previous.value.subjects, view.completed_subjects) || !equal(previous.value.dispatch_subjects, view.dispatch_subjects) ||
              !equal(previous.value.source_union, view.source_union) || !equal(previous.value.reviewed_entries, view.reviewed_entries) ||
              !equal(previous.value.allowed_paths, view.allowed_paths) ||
              previous.value.previous_sha256 !== null && !transitionRecovery && completion.value.supersedes?.freeze_sha256 !== previous.value.previous_sha256) fail('FROZEN_STATE_MISMATCH', 'incomplete publication does not match reviewed evidence');
          const checkpointPin = JSON.parse(readFileSync(join(dir, `completion-${completion.sha256}.json`), 'utf8'));
          if (!equal(checkpointPin, { ref: completion.ref, sha256: completion.sha256, value: completion.value })) fail('INVALID_COMPLETION', 'checkpoint pin differs');
          state.freeze_ref = previous.ref;
          state.freeze_sha256 = previous.sha256;
          for (const current of view.completed_subjects) state.slices[current.slice_id] = { identity: current, record_ref: null, record_sha256: null, verdict: null };
          return { subjects: view.completed_subjects, source_union: view.source_union, freeze_ref: previous.ref, freeze_sha256: previous.sha256 };
        }
        const verified = verifyFrozenTaskSet(root, contractRefs);
        return { subjects: verified.subjects, source_union: verified.source_union, freeze_ref: verified.freeze_ref, freeze_sha256: verified.freeze_sha256 };
      }
      if (!completion.value.supersedes || completion.value.supersedes.freeze_sha256 !== previous.sha256) fail('FROZEN_CHECKPOINT_CONFLICT', 'new checkpoint requires linked checkpoint-approved supersession');
      if (!equal(ordered(Object.values(state.slices).map(o => o.identity)), previous.value.subjects) ||
          state.freeze_ref !== previous.ref || state.freeze_sha256 !== previous.sha256) fail('FROZEN_STATE_MISMATCH', 'cannot supersede forged or partial state');
      // Supersession kiểm diff từ nguồn đã freeze, không diễn giải lại baseline lịch sử.
      const current = ordered(contractRefs.map(ref => taskSubject(root, ref)));
      exactStateSet(state, current);
      const allowed = previous.value.allowed_paths;
      const entries = computeSourceSnapshot(root, previous.value.source_union.source_paths).entries;
      const mutations = changedPaths(previous.value.reviewed_entries, entries);
      if (mutations.some(p => !allowed.some(input => matches(p, input)))) fail('UNAUTHORIZED_SOURCE_MUTATION', 'dependency changed after freeze');
      }
    } else if (completion.value.supersedes !== undefined) fail('INVALID_SUPERSESSION', 'no previous freeze');
    // Giữ dispatch subjects gốc trong immutable proof khi state đã chuyển identity.
    const reviewState = previous && Object.hasOwn(state, 'freeze_ref') ? { ...state, slices: Object.fromEntries(previous.value.dispatch_subjects.map(s => [s.slice_id, { identity: s, record_ref: null, record_sha256: null, verdict: null }])) } : state;
    const view = completionView(root, contractRefs, reviewState, path);
    validateCompletion(completion.value, view);
    const proof = {
      freeze_version: 1, task_id: state.task_id, repo_id: state.repo_id, worktree_id: state.worktree_id,
      subjects: view.completed_subjects, dispatch_subjects: view.dispatch_subjects,
      source_union: view.source_union, allowed_paths: view.allowed_paths, reviewed_entries: view.reviewed_entries,
      completion_ref: completion.ref, completion_sha256: completion.sha256,
      previous_sha256: previous ? previous.sha256 : null
    };
    // Checkpoint bytes pin trong scratch write-once, trước atomic identity publication.
    atomicJSON(join(dir, `completion-${completion.sha256}.json`), { ref: completion.ref, sha256: completion.sha256, value: completion.value }, true);
    const proofPath = join(dir, previous ? `freeze-${completion.sha256}.json` : 'freeze.json');
    const digest = atomicJSON(proofPath, proof, true);
    state.freeze_ref = reference(root, proofPath);
    state.freeze_sha256 = digest;
    for (const current of view.completed_subjects) state.slices[current.slice_id] = { identity: current, record_ref: null, record_sha256: null, verdict: null };
    return { subjects: view.completed_subjects, source_union: view.source_union, freeze_ref: state.freeze_ref, freeze_sha256: digest };
  });
}

/** Integrity-only seam dùng ở preflight/snapshot/publish và hook, không refresh. */
export function verifyFrozenTaskSet(repoRoot, contractRefs, expected = null) {
  const root = realpathSync(repoRoot);
  const current = ordered(contractRefs.map(ref => taskSubject(root, ref)));
  validateTaskSet(current);
  const path = gateStatePath(root, current[0]);
  const state = validateGateState(evidenceJSON(path, 'INVALID_GATE_STATE'), current[0]);
  const dispatch = exactStateSet(state, current);
  const frozen = frozenEvidence(root, path, state);
  const proof = frozen.value;
  if (!equal(dispatch, current) || !equal(proof.subjects, current) ||
      proof.repo_id !== state.repo_id || proof.worktree_id !== state.worktree_id ||
      state.freeze_ref !== frozen.ref || state.freeze_sha256 !== frozen.sha256) fail('FROZEN_STATE_MISMATCH', 'current state/source differs from immutable freeze');
  const completion = readCompletion(root, proof.completion_ref);
  if (completion.sha256 !== proof.completion_sha256) fail('INVALID_COMPLETION', 'checkpoint mutated');
  const dir = evidenceDir(root, path, state.task_id);
  const completionPin = JSON.parse(readFileSync(join(dir, `completion-${completion.sha256}.json`), 'utf8'));
  if (!equal(completionPin, { ref: completion.ref, sha256: completion.sha256, value: completion.value })) fail('INVALID_COMPLETION', 'immutable checkpoint pin differs');
  const reviewState = { ...state, slices: Object.fromEntries(proof.dispatch_subjects.map(s => [s.slice_id, { identity: s, record_ref: null, record_sha256: null, verdict: null }])) };
  const view = completionView(root, contractRefs, reviewState, path);
  validateCompletion(completion.value, view);
  const transitions = supersessionHistory(root, path, state);
  const transitionLink = transitions.length &&
    transitions.at(-1).value.inspection.previous_freeze?.sha256 === proof.previous_sha256 &&
    equal(transitions.at(-1).value.inspection.proposed_subjects, proof.dispatch_subjects);
  if (proof.previous_sha256 === null ? completion.value.supersedes !== undefined :
      !transitionLink && completion.value.supersedes?.freeze_sha256 !== proof.previous_sha256) fail('INVALID_SUPERSESSION', 'checkpoint does not bind the immutable chain');
  if (!equal(proof.allowed_paths, view.allowed_paths) || !equal(proof.reviewed_entries, view.reviewed_entries) ||
      !equal(proof.source_union, view.source_union)) fail('FROZEN_SOURCE_MISMATCH', 'reviewed union/dependencies differ');
  const result = { subjects: current, source_union: view.source_union, freeze_ref: frozen.ref, freeze_sha256: frozen.sha256, state_sha256: hash(readFileSync(path)) };
  if (expected !== null && !equal(result, expected)) fail('FROZEN_STATE_CHANGED_DURING_CI', 'freeze proof changed through the run');
  return result;
}

async function cli() {
  const [command, ...args] = process.argv.slice(2);
  const options = {};
  const refs = [];
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index];
    if (!['--contract', '--output', '--completion', '--approval'].includes(name) || !args[index + 1] ||
        Object.hasOwn(options, name) && !(name === '--contract' && ['freeze', 'inspect-supersession', 'publish-supersession'].includes(command))) fail('INVALID_ARGUMENT', 'expected named path options');
    if (name === '--contract') refs.push(args[index + 1]);
    options[name] = args[index + 1];
  }
  const root = realpathSync(process.cwd());
  if (command === 'publish-supersession') {
    if (!refs.length || !options['--approval'] || options['--completion'] || options['--output']) fail('INVALID_ARGUMENT', 'usage: publish-supersession --approval <checkpoint> --contract <TASK> [--contract <TASK> ...]');
    console.log(JSON.stringify(await publishTaskSupersession(root, refs, options['--approval']), null, 2));
    return;
  }
  if (options['--approval']) fail('INVALID_ARGUMENT', '--approval is only valid for publish-supersession');
  if (command === 'inspect-supersession') {
    if (!refs.length || options['--completion'] || options['--output']) fail('INVALID_ARGUMENT', 'usage: inspect-supersession --contract <TASK> [--contract <TASK> ...]');
    console.log(JSON.stringify(inspectTaskSupersession(root, refs), null, 2));
    return;
  }
  if (command === 'freeze') {
    if (!refs.length || !options['--completion'] || options['--output']) fail('INVALID_ARGUMENT', 'usage: freeze --completion <checkpoint> --contract <TASK> [--contract <TASK> ...]');
    console.log(JSON.stringify(await freezeTaskSet(root, refs, options['--completion'])));
    return;
  }
  if (options['--completion']) fail('INVALID_ARGUMENT', '--completion is only valid for freeze');
  if (!['manifest', 'identity'].includes(command) || !options['--contract'] || (command === 'manifest' && !options['--output']) || (command === 'identity' && options['--output'])) fail('INVALID_ARGUMENT', 'usage: manifest --contract <path> --output <path> | identity --contract <path>');
  const contract = readTaskContract(root, options['--contract']);
  if (command === 'manifest') writeFileSync(repoPath(root, options['--output'], false), `${JSON.stringify(deriveTaskManifest(contract), null, 2)}\n`, { flag: 'w' });
  else {
    const { task_id, slice_id, contract_ref, contract_version, contract_hash, lifecycle_hash } = contract;
    console.log(JSON.stringify({ task_id, slice_id, contract_ref, contract_version, contract_hash, lifecycle_hash, ...computeSourceIdentity(root, contract.source_paths) }));
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await cli(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
