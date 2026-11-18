import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync, cpSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  captureTaskDispatch, computeSourceSnapshot, taskSubject, gateStatePath,
  inspectTaskCompletion, freezeTaskSet, verifyFrozenTaskSet, updateGateState,
  inspectTaskSupersession, publishTaskSupersession, verifyTaskSupersession,
  validateTaskSupersessionSourceAuthorization, isNormalizedRepoPath,
} from '../scripts/task-contract.mjs';

const cli = fileURLToPath(new URL('../scripts/task-contract.mjs', import.meta.url));
const hook = new URL('../harness/omp/hooks/post/lead-gate.ts', import.meta.url).href;
const manifestSchema = fileURLToPath(new URL('../contracts/task-manifest.schema.json', import.meta.url));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const json = path => JSON.parse(readFileSync(path, 'utf8'));
const block = (marker, value) => `\`\`\`json ${marker}\n${JSON.stringify(value, null, 2)}\n\`\`\`\n`;
const ordered = subjects => [...subjects].sort((a, b) => a.slice_id.localeCompare(b.slice_id));

function put(root, path, bytes) {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), bytes);
}

function git(root, ...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', timeout: 5000,
    env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_AUTHOR_NAME: 'Fixture', GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
      GIT_COMMITTER_NAME: 'Fixture', GIT_COMMITTER_EMAIL: 'fixture@example.invalid' } }).trim();
}

async function fixture(t, { legacy = false, baseline = false, taskId = 'fixture-gate', hashOnly = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'gate-identity-regression-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  if (legacy) taskId = 'gate-identity-refresh';
  const names = legacy ? ['D-GateIdentity', 'E-GateRegression'] : ['A-Writer', 'B-Writer'];
  const files = legacy ? ['TASK-04-gate-identity.md', 'TASK-05-gate-regression.md'] : ['TASK-A.md', 'TASK-B.md'];
  const planning = `.agent/planning/${taskId}`;
  const refs = files.map(file => `${planning}/${file}`);
  const lifecycleRef = `${planning}/00-OVERVIEW.md`;
  const lifecycle = { task_id: taskId, status: 'active', blocker: null, next_action: 'Review source', owner: 'Main',
    contract_versions: { ...Object.fromEntries(names.map(name => [name, 1])), 'C-Extra': 1 }, source_snapshot: null, superseded_by: null, archived: false };
  const contracts = names.map((name, index) => ({ task_id: taskId, slice_id: name, contract_version: 1,
    lifecycle_ref: lifecycleRef, goal: 'Authorize only reviewed writes', mode: 'implementation', owner: 'test-author',
    allowed_paths: [index === 0 ? 'src/owned.txt' : '.agent/evals/new.test.mjs'],
    source_paths: ['src', '.agent/evals'], acceptance: ['Preserve dependencies'], dependencies: [],
    permitted_checks: ['node --test .agent/evals/new.test.mjs'], stop_conditions: ['Reject unauthorized mutation'] }));
  put(root, lifecycleRef, block('task-lifecycle', lifecycle));
  contracts.forEach((contract, index) => put(root, refs[index], block('task-contract', contract)));
  put(root, 'src/owned.txt', 'dispatch source\n');
  put(root, 'src/dependency.txt', 'dependency\n');
  put(root, '.agent/evals/README.md', 'source-only eval dependency\n');
  put(root, '.gitignore', '.agent/evals/*.test.mjs\n.agent/scratch/\n.agent/reports/\n');
  git(root, 'init', '--quiet');
  git(root, 'add', '.');
  const tree = git(root, 'write-tree');
  const commit = git(root, 'commit-tree', tree, '-m', 'Isolated fixture baseline');
  git(root, 'update-ref', 'HEAD', commit);
  const before = computeSourceSnapshot(root, ['.agent/evals', 'src']);
  const oldState = legacy && !baseline || hashOnly;
  const dispatch = oldState ? ordered(refs.map(ref => taskSubject(root, ref))) : await captureTaskDispatch(root, refs);
  const statePath = gateStatePath(root, dispatch[0]);
  if (oldState) {
    put(root, statePath.slice(root.length + 1), JSON.stringify({ state_version: 1, task_id: taskId,
      repo_id: dispatch[0].repo_id, worktree_id: dispatch[0].worktree_id,
      slices: Object.fromEntries(dispatch.map(subject => [subject.slice_id, {
        identity: subject, record_ref: null, record_sha256: null, verdict: null,
      }])) }));
  }
  const proofDir = join(dirname(statePath), 'checkpoints', taskId);
  const snapshots = oldState ? [] : dispatch.map(subject => {
    const name = readdirSync(proofDir).find(file => file.startsWith(`dispatch-${subject.slice_id}-`));
    assert.ok(name, 'dispatch must persist a baseline for each slice');
    const ref = `${proofDir.slice(root.length + 1)}/${name}`;
    return { slice_id: subject.slice_id, ref, sha256: digest(readFileSync(join(root, ref))) };
  });
  const allowed = ['.agent/evals/new.test.mjs', 'src/owned.txt'];
  function checkpoint(overrides = {}, ref = '.agent/reports/merge-gate/checkpoints/fixture.md') {
    const current = computeSourceSnapshot(root, ['.agent/evals', 'src']);
    const old = new Map(before.entries.map(entry => [entry.path, entry]));
    const now = new Map(current.entries.map(entry => [entry.path, entry]));
    const mutations = [...new Set([...old.keys(), ...now.keys()])]
      .filter(path => JSON.stringify(old.get(path)) !== JSON.stringify(now.get(path))).sort();
    const value = { completion_version: 1, owner: 'tech-lead', model_degraded: false,
      task_id: taskId, repo_id: dispatch[0].repo_id, worktree_id: dispatch[0].worktree_id,
      dispatch_subjects: dispatch, completed_subjects: ordered(refs.map(ref => taskSubject(root, ref))),
      source_union: current.identity, allowed_paths: allowed, dispatch_snapshots: snapshots,
      reviewed_entries: current.entries, reviewed_dependencies: current.entries.filter(entry => !allowed.includes(entry.path)),
      mutation_paths: oldState ? [] : mutations,
      authorization: oldState ? 'legacy-reviewed' : 'baseline-verified',
      ...(legacy && !baseline ? { user_words: 'Review và pin nguồn hiện tại' } : {}), ...overrides };
    put(root, ref, block('gate-completion', value));
    return { ref, value };
  }
  function mutate() {
    put(root, 'src/owned.txt', 'independently reviewed implementation\n');
    put(root, '.agent/evals/new.test.mjs', 'ignored authorized new test\n');
  }
  return { root, refs, dispatch, before, statePath, proofDir, checkpoint, mutate, contracts, lifecycle, lifecycleRef };
}

function runCLI(f, ref, refs = f.refs) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, 'freeze', '--completion', ref,
      ...refs.flatMap(contract => ['--contract', contract])], { cwd: f.root, timeout: 10000 });
    let stdout = '', stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', code => resolve({ code, stdout, stderr }));
  });
}

function evidenceBytes(f) {
  return Object.fromEntries(readdirSync(f.proofDir).sort().map(name => [name, readFileSync(join(f.proofDir, name), 'utf8')]));
}

function rejectCompletion(f, checkpoint) {
  return assert.rejects(() => freezeTaskSet(f.root, f.refs, checkpoint.ref));
}

test('authorized lifecycle freezes exact subjects, includes ignored new test, and retries without rewriting evidence', async t => {
  const f = await fixture(t);
  assert.throws(() => verifyFrozenTaskSet(f.root, f.refs));
  f.mutate();
  assert.throws(() => verifyFrozenTaskSet(f.root, f.refs));
  const checkpoint = f.checkpoint();
  assert.deepEqual(inspectTaskCompletion(f.root, f.refs), checkpoint.value);
  assert.deepEqual(checkpoint.value.mutation_paths, ['.agent/evals/new.test.mjs', 'src/owned.txt']);
  assert.ok(checkpoint.value.reviewed_entries.some(entry => entry.path === '.agent/evals/new.test.mjs'));
  const frozen = await freezeTaskSet(f.root, f.refs, checkpoint.ref);
  const verified = verifyFrozenTaskSet(f.root, f.refs);
  assert.deepEqual(verified.subjects, checkpoint.value.completed_subjects);
  assert.deepEqual(verified.source_union, checkpoint.value.source_union);
  for (const [index, subject] of verified.subjects.entries()) {
    const { source_fingerprint: original, ...canonical } = f.dispatch[index];
    const { source_fingerprint: completed, ...actual } = subject;
    assert.deepEqual(actual, canonical);
    assert.notEqual(completed, original);
  }
  const bytes = evidenceBytes(f);
  const state = readFileSync(f.statePath, 'utf8');
  assert.deepEqual(await freezeTaskSet(f.root, f.refs, checkpoint.ref), frozen);
  assert.deepEqual(evidenceBytes(f), bytes);
  assert.equal(readFileSync(f.statePath, 'utf8'), state);
  assert.deepEqual(verifyFrozenTaskSet(f.root, f.refs, verified), verified);
  await assert.rejects(() => captureTaskDispatch(f.root, f.refs));
});

test('fresh freeze CLI and concurrent identical freezes preserve the full task set and immutable evidence', async t => {
  const f = await fixture(t);
  f.mutate();
  const checkpoint = f.checkpoint();
  const results = await Promise.all([runCLI(f, checkpoint.ref), runCLI(f, checkpoint.ref)]);
  for (const result of results) {
    assert.equal(result.code, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout).subjects, checkpoint.value.completed_subjects);
  }
  const bytes = evidenceBytes(f);
  const retry = await runCLI(f, checkpoint.ref);
  assert.equal(retry.code, 0, retry.stderr);
  assert.deepEqual(evidenceBytes(f), bytes);
  assert.equal(verifyFrozenTaskSet(f.root, f.refs).subjects.length, 2);
  const partial = await runCLI(f, checkpoint.ref, [f.refs[0]]);
  assert.notEqual(partial.code, 0);
});

for (const path of ['src/dependency.txt', '.agent/evals/README.md', 'src/outside-allowed.txt']) {
  test(`rejects source-only dependency or outside allowed_paths mutation: ${path}`, async t => {
    const f = await fixture(t);
    put(f.root, path, 'unauthorized change\n');
    await rejectCompletion(f, f.checkpoint());
    assert.throws(() => verifyFrozenTaskSet(f.root, f.refs));
  });
}

for (const field of ['owner', 'model_degraded', 'dispatch_subjects', 'completed_subjects', 'reviewed_dependencies', 'mutation_paths', 'allowed_paths', 'source_union']) {
  test(`rejects forged completion field: ${field}`, async t => {
    const f = await fixture(t);
    f.mutate();
    const valid = f.checkpoint().value;
    const replacements = { owner: 'worker', model_degraded: true, dispatch_subjects: valid.dispatch_subjects.slice(0, 1),
      completed_subjects: valid.completed_subjects.slice(0, 1), reviewed_dependencies: [], mutation_paths: [],
      allowed_paths: ['src'], source_union: { ...valid.source_union, source_fingerprint: '0'.repeat(64) } };
    await rejectCompletion(f, f.checkpoint({ [field]: replacements[field] }));
  });
}

for (const kind of ['contract', 'lifecycle', 'source_paths', 'repo_id', 'worktree_id']) {
  test(`rejects canonical identity drift: ${kind}`, async t => {
    const f = await fixture(t);
    if (kind === 'contract') put(f.root, f.refs[0], block('task-contract', { ...f.contracts[0], goal: 'Changed goal' }));
    if (kind === 'lifecycle') put(f.root, f.lifecycleRef, block('task-lifecycle', { ...f.lifecycle, next_action: 'Changed action' }));
    if (kind === 'source_paths') put(f.root, f.refs[0], block('task-contract', { ...f.contracts[0], source_paths: ['src', '.agent/evals', 'extra.txt'] }));
    if (kind === 'source_paths') put(f.root, 'extra.txt', 'new scope\n');
    if (kind === 'repo_id' || kind === 'worktree_id') {
      const state = json(f.statePath);
      state[kind] = '0'.repeat(64);
      for (const obligation of Object.values(state.slices)) obligation.identity[kind] = state[kind];
      writeFileSync(f.statePath, JSON.stringify(state));
    }
    await assert.rejects(async () => {
      const checkpoint = f.checkpoint();
      await freezeTaskSet(f.root, f.refs, checkpoint.ref);
    });
  });
}

test('rejects missing, extra and duplicate slice sets without freezing a subset', async t => {
  const f = await fixture(t);
  const checkpoint = f.checkpoint();
  await assert.rejects(() => freezeTaskSet(f.root, [f.refs[0]], checkpoint.ref));
  await assert.rejects(() => freezeTaskSet(f.root, [...f.refs, f.refs[0]], checkpoint.ref));
  const extra = { ...f.contracts[0], slice_id: 'C-Extra' };
  const extraRef = `${dirname(f.refs[0])}/TASK-C.md`;
  put(f.root, extraRef, block('task-contract', extra));
  await assert.rejects(() => freezeTaskSet(f.root, [...f.refs, extraRef], checkpoint.ref));
});

for (const kind of ['malformed-state', 'missing-slice', 'malformed-checkpoint', 'checkpoint-as-pass', 'missing-baseline', 'corrupt-baseline', 'missing-marker']) {
  test(`fails closed on invalid dispatch/checkpoint evidence: ${kind}`, async t => {
    const f = await fixture(t);
    const checkpoint = f.checkpoint();
    if (kind === 'malformed-state') writeFileSync(f.statePath, '{');
    if (kind === 'missing-slice') {
      const state = json(f.statePath);
      delete state.slices[f.dispatch[1].slice_id];
      writeFileSync(f.statePath, JSON.stringify(state));
    }
    if (kind === 'malformed-checkpoint') put(f.root, checkpoint.ref, '```json gate-completion\n{\n```\n');
    if (kind === 'checkpoint-as-pass') put(f.root, checkpoint.ref, `verdict: pass\n${block('gate-completion', checkpoint.value)}`);
    if (kind === 'missing-baseline' || kind === 'corrupt-baseline') {
      const path = join(f.root, checkpoint.value.dispatch_snapshots[0].ref);
      if (kind === 'missing-baseline') rmSync(path);
      else writeFileSync(path, '{}');
    }
    if (kind === 'missing-marker') rmSync(join(f.proofDir, 'snapshot-required.json'));
    await rejectCompletion(f, checkpoint);
  });
}

for (const kind of ['source', 'dependency', 'checkpoint', 'state', 'freeze-proof', 'checkpoint-pin']) {
  test(`rejects post-freeze and CI before/after tampering: ${kind}`, async t => {
    const f = await fixture(t);
    f.mutate();
    const checkpoint = f.checkpoint();
    await freezeTaskSet(f.root, f.refs, checkpoint.ref);
    const before = verifyFrozenTaskSet(f.root, f.refs);
    if (kind === 'source') put(f.root, 'src/owned.txt', 'unreviewed later source\n');
    if (kind === 'dependency') put(f.root, 'src/dependency.txt', 'unreviewed later dependency\n');
    if (kind === 'checkpoint') put(f.root, checkpoint.ref, `${block('gate-completion', checkpoint.value)}changed bytes\n`);
    if (kind === 'state') {
      const state = json(f.statePath);
      state.slices[f.dispatch[0].slice_id].record_ref = '.agent/reports/merge-gate/forged.md';
      state.slices[f.dispatch[0].slice_id].record_sha256 = '0'.repeat(64);
      state.slices[f.dispatch[0].slice_id].verdict = 'pass';
      writeFileSync(f.statePath, JSON.stringify(state));
    }
    if (kind === 'freeze-proof') writeFileSync(join(f.root, before.freeze_ref), '{}');
    if (kind === 'checkpoint-pin') {
      const name = readdirSync(f.proofDir).find(name => name.startsWith('completion-'));
      assert.ok(name);
      writeFileSync(join(f.proofDir, name), '{}');
    }
    assert.throws(() => verifyFrozenTaskSet(f.root, f.refs, before));
    if (kind !== 'state') await rejectCompletion(f, checkpoint);
  });
}

test('changed checkpoint retry cannot overwrite immutable freeze evidence', async t => {
  const f = await fixture(t);
  const checkpoint = f.checkpoint();
  await freezeTaskSet(f.root, f.refs, checkpoint.ref);
  const bytes = evidenceBytes(f);
  const alternate = f.checkpoint({}, '.agent/reports/merge-gate/checkpoints/alternate.md');
  await rejectCompletion(f, alternate);
  assert.deepEqual(evidenceBytes(f), bytes);
});

test('concurrent competing checkpoints publish one winner without overwriting immutable evidence', async t => {
  const f = await fixture(t);
  f.mutate();
  const first = f.checkpoint();
  const second = f.checkpoint({}, '.agent/reports/merge-gate/checkpoints/competing.md');
  const results = await Promise.all([runCLI(f, first.ref), runCLI(f, second.ref)]);
  assert.equal(results.filter(result => result.code === 0).length, 1);
  assert.equal(results.filter(result => result.code !== 0).length, 1);
  const verified = verifyFrozenTaskSet(f.root, f.refs);
  assert.deepEqual(verified.subjects, first.value.completed_subjects);
  const proof = json(join(f.root, verified.freeze_ref));
  assert.ok([first.ref, second.ref].includes(proof.completion_ref));
  assert.equal(proof.completion_sha256, digest(readFileSync(join(f.root, proof.completion_ref))));
  const bytes = evidenceBytes(f);
  const losing = proof.completion_ref === first.ref ? second : first;
  await rejectCompletion(f, losing);
  assert.deepEqual(evidenceBytes(f), bytes);
});

test('explicit legacy-reviewed v1 migration retains canonical identities and survives old session_stop obligation rewrite', async t => {
  const f = await fixture(t, { legacy: true });
  f.mutate();
  put(f.root, 'src/dependency.txt', 'explicitly reviewed current legacy dependency\n');
  const checkpoint = f.checkpoint();
  assert.deepEqual(checkpoint.value.dispatch_snapshots, []);
  assert.deepEqual(checkpoint.value.mutation_paths, []);
  await freezeTaskSet(f.root, f.refs, checkpoint.ref);
  const verified = verifyFrozenTaskSet(f.root, f.refs);
  const state = json(f.statePath);
  assert.equal(state.state_version, 1);
  state.slices = Object.fromEntries(verified.subjects.map(subject => [subject.slice_id, {
    identity: subject, record_ref: null, record_sha256: null, verdict: null,
  }]));
  writeFileSync(f.statePath, JSON.stringify(state));
  assert.deepEqual(verifyFrozenTaskSet(f.root, f.refs).subjects, checkpoint.value.completed_subjects);
  for (const [index, subject] of verified.subjects.entries()) {
    for (const field of ['contract_hash', 'lifecycle_hash', 'contract_version', 'repo_id', 'worktree_id', 'source_paths']) {
      assert.deepEqual(subject[field], f.dispatch[index][field]);
    }
  }
  assert.equal(readdirSync(f.proofDir).some(name => name.startsWith('dispatch-')), false);
  put(f.root, 'src/dependency.txt', 'unapproved dependency after legacy freeze\n');
  assert.throws(() => verifyFrozenTaskSet(f.root, f.refs));
  await rejectCompletion(f, checkpoint);
});

test('legacy migration rejects absent or altered explicit user approval and worker ownership', async t => {
  const f = await fixture(t, { legacy: true });
  for (const overrides of [{ user_words: undefined }, { user_words: 'Approved' }, { owner: 'worker' }, { reviewed_dependencies: [] }]) {
    await rejectCompletion(f, f.checkpoint(overrides));
  }
});

test('future hash-only state cannot use the approved-task legacy bypass', async t => {
  const f = await fixture(t, { hashOnly: true });
  await rejectCompletion(f, f.checkpoint({ user_words: 'Review và pin nguồn hiện tại' }));
});

test('baseline-required approved task cannot downgrade to legacy after evidence deletion', async t => {
  const f = await fixture(t, { legacy: true, baseline: true });
  const checkpoint = f.checkpoint({ authorization: 'legacy-reviewed', dispatch_snapshots: [], user_words: 'Review và pin nguồn hiện tại' });
  for (const name of readdirSync(f.proofDir)) if (name.startsWith('dispatch-')) rmSync(join(f.proofDir, name));
  await rejectCompletion(f, checkpoint);
});

test('copying state into another repository/worktree cannot certify the original identities', async t => {
  const f = await fixture(t);
  const checkpoint = f.checkpoint();
  await freezeTaskSet(f.root, f.refs, checkpoint.ref);
  const other = mkdtempSync(join(tmpdir(), 'gate-identity-copy-'));
  t.after(() => rmSync(other, { recursive: true, force: true }));
  cpSync(f.root, other, { recursive: true });
  assert.throws(() => verifyFrozenTaskSet(other, f.refs));
});

function stopConsumer(f, mode) {
  put(f.root, '.agent/contracts/agent-registry.json', '{}\n');
  put(f.root, '.agent/contracts/task-manifest.schema.json', readFileSync(manifestSchema));
  put(f.root, '.agent/scripts/task-contract.mjs', readFileSync(cli));
  const runner = `
    const { default: register } = await import(process.argv[1]);
    const handlers = new Map();
    register({ on(name, handler) { handlers.set(name, handler); } });
    const stop = handlers.get('session_stop');
    if (!stop) throw new Error('session_stop handler not registered');
    const result = await stop({}, { cwd: process.argv[2], agent: { kind: 'main' } });
    console.log(JSON.stringify(result));
  `;
  return JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', runner, hook, f.root], {
    cwd: f.root, encoding: 'utf8', timeout: 10000,
    env: { ...process.env, COGAIN_LEAD_GATE: mode },
  }));
}

for (const mode of ['block', 'advise']) {
  test(`real session_stop consumer rejects malformed state with ${mode} policy`, async t => {
    const f = await fixture(t);
    writeFileSync(f.statePath, '{');
    const result = stopConsumer(f, mode);
    if (mode === 'block') {
      assert.equal(result.decision, 'block');
      assert.equal(typeof result.reason, 'string');
      assert.ok(result.reason.length > 0);
      assert.notEqual(result.continue, true);
    } else {
      assert.equal(result.continue, true);
      assert.equal(typeof result.additionalContext, 'string');
      assert.ok(result.additionalContext.length > 0);
      assert.equal(Object.hasOwn(result, 'decision'), false);
    }
    assert.equal(readFileSync(f.statePath, 'utf8'), '{');
  });

  test(`real session_stop consumer preserves infrastructure fail-open in ${mode} mode`, async t => {
    const f = await fixture(t);
    const original = readFileSync(f.statePath, 'utf8');
    put(f.root, '.agent/reports/merge-gate', 'not a directory\n');
    const result = stopConsumer(f, mode);
    assert.equal(Object.hasOwn(result, 'decision'), false);
    assert.equal(typeof result.additionalContext, 'string');
    assert.ok(result.additionalContext.length > 0);
    assert.equal(readFileSync(f.statePath, 'utf8'), original);
  });
}

const supersessionNames = [
  'masterdata-productioncost-workergrade-mapping', 'hr-expose-workergrade-grpc',
  'servicedesk-entity-cost-fields', 'servicedesk-cost-calculation',
  'frontend-cost-display', 'export-excel-cost-columns', 'test-ot-cost-regression',
];
const oldVersions = [2, 2, 4, 3, 4, 3, 6];
const newVersions = [2, 2, 4, 3, 6, 3, 7];

async function supersessionFixture(t, { hashOnly = false, expansion = true } = {}) {
  const f = await fixture(t, { hashOnly: true, taskId: 'ot-cost-shaped' });
  rmSync(f.statePath);
  f.refs = supersessionNames.map((_, index) => `.agent/planning/ot-cost-shaped/TASK-${index + 1}.md`);
  f.contracts = supersessionNames.map((name, index) => ({
    ...f.contracts[0], slice_id: name, contract_version: oldVersions[index],
    allowed_paths: [`src/slice-${index}.txt`], source_paths: ['src'],
  }));
  f.lifecycle.contract_versions = Object.fromEntries(supersessionNames.map((name, index) => [name, oldVersions[index]]));
  f.contracts.forEach((contract, index) => {
    put(f.root, f.refs[index], block('task-contract', contract));
    put(f.root, `src/slice-${index}.txt`, `slice ${index} baseline\n`);
  });
  const subjects = [];
  for (let index = 0; index < f.refs.length; index++) {
    f.lifecycle.next_action = `Historical dispatch ${index}`;
    put(f.root, f.lifecycleRef, block('task-lifecycle', f.lifecycle));
    subjects.push(taskSubject(f.root, f.refs[index]));
    if (!hashOnly) await captureTaskDispatch(f.root, [f.refs[index]]);
  }
  f.dispatch = ordered(subjects);
  if (hashOnly) writeFileSync(f.statePath, JSON.stringify({
    state_version: 1, task_id: subjects[0].task_id, repo_id: subjects[0].repo_id,
    worktree_id: subjects[0].worktree_id,
    slices: Object.fromEntries(subjects.map(identity => [identity.slice_id,
      { identity, record_ref: null, record_sha256: null, verdict: null }])),
  }));
  f.previousBytes = readFileSync(f.statePath, 'utf8');
  f.originalEvidence = hashOnly ? {} : evidenceBytes(f);
  f.lifecycle.next_action = 'Review full outstanding supersession';
  f.lifecycle.contract_versions = Object.fromEntries(supersessionNames.map((name, index) =>
    [name, expansion ? newVersions[index] : oldVersions[index]]));
  put(f.root, f.lifecycleRef, block('task-lifecycle', f.lifecycle));
  if (expansion) {
    put(f.root, 'expanded/employee.txt', 'approved new employee scope\n');
    for (const index of [4, 6]) {
      f.contracts[index] = { ...f.contracts[index], contract_version: newVersions[index],
        allowed_paths: [...f.contracts[index].allowed_paths, 'expanded/employee.txt'],
        source_paths: ['src', 'expanded'] };
      put(f.root, f.refs[index], block('task-contract', f.contracts[index]));
    }
  }
  f.approval = (overrides = {}, ref = '.agent/reports/merge-gate/checkpoints/supersession.md') => {
    const inspection = inspectTaskSupersession(f.root, f.refs);
    const authorized_mutations = inspection.baseline_kind === 'dispatch-backed'
      ? [...new Set([...inspection.mutation_paths, ...inspection.newly_reviewed_paths])].sort().map(path => ({
          path, provenance: 'Approved contract scope or mutation provenance',
        }))
      : [];
    let source_authorization = {
      kind: 'user-approved-current-source-review',
      user_words: 'Review và pin nguồn hiện tại và nguồn dependency đã được phê duyệt',
      authorized_mutations,
    };
    if (Object.hasOwn(overrides, 'source_authorization')) {
      source_authorization = overrides.source_authorization;
    }
    const { source_authorization: _ignored, ...otherOverrides } = overrides;
    const value = {
      approval_version: 1, owner: 'tech-lead', model_degraded: false,
      independent_review: true, inspection, reason: 'Approved full-set lifecycle and scope transition',
      source_authorization,
      ...otherOverrides,
    };
    put(f.root, ref, block('gate-supersession', value));
    return { ref, value };
  };
  return f;
}

function supersessionCLI(f, approval, refs = f.refs) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, 'publish-supersession', '--approval', approval.ref,
      ...refs.flatMap(ref => ['--contract', ref])], { cwd: f.root, timeout: 10000 });
    let stdout = '', stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', code => resolve({ code, stdout, stderr }));
  });
}

function assertOriginalEvidence(f) {
  for (const [name, bytes] of Object.entries(f.originalEvidence)) {
    assert.equal(readFileSync(join(f.proofDir, name), 'utf8'), bytes);
  }
}

async function rejectSupersession(f, approval, refs = f.refs) {
  const before = readFileSync(f.statePath, 'utf8');
  await assert.rejects(() => publishTaskSupersession(f.root, refs, approval.ref));
  assert.equal(readFileSync(f.statePath, 'utf8'), before);
  assertOriginalEvidence(f);
}

for (const hashOnly of [false, true]) {
  test(`seven mixed lifecycle/version subjects publish approved expansion with preserved ${hashOnly ? 'hash-only' : 'baseline'} evidence`, async t => {
    const f = await supersessionFixture(t, { hashOnly });
    assert.equal(new Set(f.dispatch.map(subject => subject.lifecycle_hash)).size, 7);
    const approval = f.approval();
    assert.equal(approval.value.inspection.baseline_kind, hashOnly ? 'hash-only' : 'dispatch-backed');
    const result = await supersessionCLI(f, approval);
    assert.equal(result.code, 0, result.stderr);
    const proof = JSON.parse(result.stdout);
    assert.equal(proof.value.predecessor_bytes, f.previousBytes);
    const state = json(f.statePath);
    assert.equal(state.state_version, 1);
    assert.deepEqual(f.refs.map(ref => taskSubject(f.root, ref).contract_version), newVersions);
    assert.equal(Object.keys(state.slices).length, 7);
    assert.equal(new Set(Object.values(state.slices).map(item => item.identity.lifecycle_hash)).size, 1);
    for (const obligation of Object.values(state.slices)) {
      assert.deepEqual(Object.keys(obligation).sort(), ['identity', 'record_ref', 'record_sha256', 'verdict']);
      assert.equal(obligation.record_ref, null);
      assert.equal(obligation.record_sha256, null);
      assert.equal(obligation.verdict, null);
    }
    assertOriginalEvidence(f);
    assert.equal(readdirSync(f.proofDir).filter(name => name.startsWith('dispatch-')).length, hashOnly ? 0 : 7);
    assert.equal(verifyTaskSupersession(f.root, f.refs).length, 1);
    assert.throws(() => verifyFrozenTaskSet(f.root, f.refs));
    const bytes = evidenceBytes(f);
    const stateBytes = readFileSync(f.statePath, 'utf8');
    const retry = await supersessionCLI(f, approval);
    assert.equal(retry.code, 0, retry.stderr);
    assert.deepEqual(JSON.parse(retry.stdout), proof);
    assert.deepEqual(evidenceBytes(f), bytes);
    assert.equal(readFileSync(f.statePath, 'utf8'), stateBytes);
    assert.deepEqual(await captureTaskDispatch(f.root, f.refs), ordered(f.refs.map(ref => taskSubject(f.root, ref))));
  });
}

test('lifecycle-only supersession leaves every canonical version/hash intact', async t => {
  const f = await supersessionFixture(t, { expansion: false });
  const approval = f.approval();
  await publishTaskSupersession(f.root, f.refs, approval.ref);
  for (const previous of f.dispatch) {
    const current = taskSubject(f.root, previous.contract_ref);
    assert.equal(current.contract_hash, previous.contract_hash);
    assert.equal(current.contract_version, previous.contract_version);
    assert.notEqual(current.lifecycle_hash, previous.lifecycle_hash);
  }
});

test('rejects identity supersession when proposed subjects are identical to current obligations without transition', async t => {
  const f = await supersessionFixture(t, { expansion: false });
  put(f.root, f.lifecycleRef, block('task-lifecycle', {
    ...f.lifecycle,
    next_action: 'Historical dispatch 6',
  }));
  const inspection = inspectTaskSupersession(f.root, f.refs);
  assert.deepEqual(inspection.previous_subjects, inspection.proposed_subjects);
  const approval = f.approval({ inspection });
  await rejectSupersession(f, approval);
});

test('explicit current-source review permits a sibling dependency change and pins it for subsequent completion', async t => {
  const f = await supersessionFixture(t);
  put(f.root, 'src/dependency.txt', 'authorized sibling-produced dependency\n');
  const inspection = inspectTaskSupersession(f.root, f.refs);
  assert.ok(inspection.mutation_paths.includes('src/dependency.txt'));
  const entry = inspection.reviewed_entries.find(e => e.path === 'src/dependency.txt');
  const allPaths = [...new Set([...inspection.mutation_paths, ...inspection.newly_reviewed_paths])];
  const approval = f.approval({
    reason: 'Independent review of sibling output src/dependency.txt',
    source_authorization: {
      kind: 'user-approved-current-source-review',
      user_words: 'Review và pin toàn bộ nguồn hiện tại, bao gồm src/dependency.txt do sibling thay đổi',
      authorized_mutations: allPaths.map(p => ({
        path: p,
        provenance: p === 'src/dependency.txt' ? 'Produced by sibling task under approved contract' : 'Approved expansion',
        sha256: p === 'src/dependency.txt' ? (entry.sha256 ?? entry.hash) : undefined,
      })),
    },
  });
  assert.ok(approval.value.inspection.mutation_paths.includes('src/dependency.txt'));
  await publishTaskSupersession(f.root, f.refs, approval.ref);
  assert.ok(inspectTaskCompletion(f.root, f.refs).reviewed_dependencies.some(e => e.path === 'src/dependency.txt'));
  put(f.root, 'src/dependency.txt', 'new dependency mutation without further approval\n');
  assert.throws(() => inspectTaskCompletion(f.root, f.refs));
});

for (const path of ['src/dependency.txt', 'src/owned.txt', 'expanded/employee.txt']) {
  test(`scope expansion cannot launder explicitly unapproved dirty source: ${path}`, async t => {
    const f = await supersessionFixture(t);
    put(f.root, path, 'unrelated dirty mutation, not produced by an authorized slice\n');
    const inspection = inspectTaskSupersession(f.root, f.refs);
    assert.ok(
      inspection.mutation_paths.includes(path) || inspection.newly_reviewed_paths.includes(path),
      `dirty path ${path} must be detected in mutation_paths or newly_reviewed_paths`
    );
    const allPaths = [...new Set([...inspection.mutation_paths, ...inspection.newly_reviewed_paths])];
    const authorized_mutations = allPaths
      .filter(p => p !== path)
      .map(p => ({ path: p, provenance: 'Authorized path' }));
    const approval = f.approval({
      reason: 'Approve contract scope expansion only; unapproved paths omitted structurally',
      source_authorization: {
        kind: 'user-approved-current-source-review',
        user_words: 'Review và pin nguồn hiện tại',
        authorized_mutations,
      },
    });
    await rejectSupersession(f, approval);
  });
}

for (const [desc, authFn] of [
  ['missing authorized_mutations', () => ({ kind: 'user-approved-current-source-review', user_words: 'Review' })],
  ['extra field in source_authorization', () => ({ kind: 'user-approved-current-source-review', user_words: 'Review', authorized_mutations: [], extra_field: true })],
  ['invalid kind', () => ({ kind: 'auto-approved', user_words: 'Review', authorized_mutations: [] })],
  ['empty user_words', () => ({ kind: 'user-approved-current-source-review', user_words: '   ', authorized_mutations: [] })],
  ['authorized_mutations is not array', () => ({ kind: 'user-approved-current-source-review', user_words: 'Review', authorized_mutations: 'not-array' })],
  ['item is not object', () => ({ kind: 'user-approved-current-source-review', user_words: 'Review', authorized_mutations: ['not-object'] })],
  ['item has invalid keys', () => ({ kind: 'user-approved-current-source-review', user_words: 'Review', authorized_mutations: [{ path: 'expanded/employee.txt' }] })],
  ['item has extra keys', () => ({ kind: 'user-approved-current-source-review', user_words: 'Review', authorized_mutations: [{ path: 'expanded/employee.txt', provenance: 'OK', extra: true }] })],
  ['path with leading dot-slash', () => ({ kind: 'user-approved-current-source-review', user_words: 'Review', authorized_mutations: [{ path: './expanded/employee.txt', provenance: 'OK' }] })],
  ['path with trailing slash', () => ({ kind: 'user-approved-current-source-review', user_words: 'Review', authorized_mutations: [{ path: 'expanded/employee.txt/', provenance: 'OK' }] })],
  ['path with backslash', () => ({ kind: 'user-approved-current-source-review', user_words: 'Review', authorized_mutations: [{ path: 'expanded\\employee.txt', provenance: 'OK' }] })],
  ['path with absolute slash', () => ({ kind: 'user-approved-current-source-review', user_words: 'Review', authorized_mutations: [{ path: '/expanded/employee.txt', provenance: 'OK' }] })],
  ['path with double slash', () => ({ kind: 'user-approved-current-source-review', user_words: 'Review', authorized_mutations: [{ path: 'expanded//employee.txt', provenance: 'OK' }] })],
  ['path with dot segment', () => ({ kind: 'user-approved-current-source-review', user_words: 'Review', authorized_mutations: [{ path: 'expanded/./employee.txt', provenance: 'OK' }] })],
  ['path with dotdot segment', () => ({ kind: 'user-approved-current-source-review', user_words: 'Review', authorized_mutations: [{ path: 'expanded/../expanded/employee.txt', provenance: 'OK' }] })],
  ['empty provenance', () => ({ kind: 'user-approved-current-source-review', user_words: 'Review', authorized_mutations: [{ path: 'expanded/employee.txt', provenance: '   ' }] })],
  ['invalid sha256 uppercase', () => ({ kind: 'user-approved-current-source-review', user_words: 'Review', authorized_mutations: [{ path: 'expanded/employee.txt', provenance: 'OK', sha256: 'A'.repeat(64) }] })],
  ['invalid sha256 length', () => ({ kind: 'user-approved-current-source-review', user_words: 'Review', authorized_mutations: [{ path: 'expanded/employee.txt', provenance: 'OK', sha256: 'a'.repeat(63) }] })],
  ['duplicate authorized mutation path', () => ({ kind: 'user-approved-current-source-review', user_words: 'Review', authorized_mutations: [{ path: 'expanded/employee.txt', provenance: 'First' }, { path: 'expanded/employee.txt', provenance: 'Second' }] })],
  ['path not in reviewed entries', () => ({ kind: 'user-approved-current-source-review', user_words: 'Review', authorized_mutations: [{ path: 'nonexistent/file.txt', provenance: 'OK' }] })],
  ['sha256 mismatch with actual entry', () => ({ kind: 'user-approved-current-source-review', user_words: 'Review', authorized_mutations: [{ path: 'expanded/employee.txt', provenance: 'OK', sha256: 'f'.repeat(64) }] })],
  ['dispatch-backed with empty authorized_mutations when newly introduced paths exist', () => ({ kind: 'user-approved-current-source-review', user_words: 'Review', authorized_mutations: [] })],
]) {
  test(`source authorization rejects invalid specification: ${desc}`, async t => {
    const f = await supersessionFixture(t);
    const source_authorization = authFn();
    const approval = f.approval({ source_authorization });
    await rejectSupersession(f, approval);
  });
}

test('unit validation of source authorization helper verifies path normalization rules', () => {
  assert.equal(isNormalizedRepoPath('src/file.txt'), true);
  assert.equal(isNormalizedRepoPath(''), false);
  assert.equal(isNormalizedRepoPath('/src/file.txt'), false);
  assert.equal(isNormalizedRepoPath('./src/file.txt'), false);
  assert.equal(isNormalizedRepoPath('src/file.txt/'), false);
  assert.equal(isNormalizedRepoPath('src//file.txt'), false);
  assert.equal(isNormalizedRepoPath('src\\file.txt'), false);
  assert.equal(isNormalizedRepoPath('src/./file.txt'), false);
  assert.equal(isNormalizedRepoPath('src/../file.txt'), false);
  assert.equal(isNormalizedRepoPath('src/\0file.txt'), false);
});

test('validateTaskSupersessionSourceAuthorization unit behavior on dispatch-backed vs hash-only baseline', () => {
  assert.doesNotThrow(() => validateTaskSupersessionSourceAuthorization({
    kind: 'user-approved-current-source-review',
    user_words: 'Review legacy',
    authorized_mutations: [],
  }, { baseline_kind: 'hash-only', mutation_paths: ['src/a.txt'], newly_reviewed_paths: [] }));

  assert.throws(() => validateTaskSupersessionSourceAuthorization({
    kind: 'user-approved-current-source-review',
    user_words: 'Review dispatch',
    authorized_mutations: [],
  }, { baseline_kind: 'dispatch-backed', mutation_paths: ['src/a.txt'], newly_reviewed_paths: [] }));
});

for (const kind of ['missing', 'duplicate', 'extra', 'wrong-task', 'wrong-repo', 'wrong-worktree',
  'version-decrease', 'same-version-edit', 'inactive', 'archived', 'superseded']) {
  test(`supersession rejects invalid outstanding identity: ${kind}`, async t => {
    const f = await supersessionFixture(t);
    const approval = f.approval();
    let refs = f.refs;
    if (kind === 'missing') refs = refs.slice(1);
    if (kind === 'duplicate') refs = [...refs, refs[0]];
    if (kind === 'extra') {
      const ref = `${dirname(refs[0])}/TASK-extra.md`;
      f.lifecycle.contract_versions['extra'] = 2;
      put(f.root, f.lifecycleRef, block('task-lifecycle', f.lifecycle));
      put(f.root, ref, block('task-contract', { ...f.contracts[0], slice_id: 'extra' }));
      refs = [...refs, ref];
    }
    if (['wrong-task', 'wrong-repo', 'wrong-worktree'].includes(kind)) {
      const state = json(f.statePath);
      const field = { 'wrong-task': 'task_id', 'wrong-repo': 'repo_id', 'wrong-worktree': 'worktree_id' }[kind];
      state[field] = field === 'task_id' ? 'other-task' : '0'.repeat(64);
      for (const item of Object.values(state.slices)) item.identity[field] = state[field];
      writeFileSync(f.statePath, JSON.stringify(state));
    }
    if (kind === 'version-decrease' || kind === 'same-version-edit') {
      const contract = { ...f.contracts[0], goal: 'Changed canonical contract',
        contract_version: kind === 'version-decrease' ? 1 : 2 };
      f.lifecycle.contract_versions[contract.slice_id] = contract.contract_version;
      put(f.root, f.lifecycleRef, block('task-lifecycle', f.lifecycle));
      put(f.root, refs[0], block('task-contract', contract));
    }
    if (kind === 'inactive') {
      f.lifecycle.status = 'blocked';
      f.lifecycle.blocker = 'Blocked on external dependency';
    }
    if (kind === 'archived') {
      f.lifecycle.archived = true;
    }
    if (kind === 'superseded') {
      f.lifecycle.status = 'superseded';
      f.lifecycle.superseded_by = 'replacement-task';
    }
    if (['inactive', 'archived', 'superseded'].includes(kind)) put(f.root, f.lifecycleRef, block('task-lifecycle', f.lifecycle));
    await rejectSupersession(f, approval, refs);
  });
}

for (const kind of ['owner', 'degraded', 'independent', 'authorization', 'empty-user-words',
  'unknown-field', 'pass-record', 'duplicate-fence', 'source', 'canonical', 'state', 'approval-symlink']) {
  test(`supersession rejects stale or forged approval: ${kind}`, async t => {
    const f = await supersessionFixture(t, { hashOnly: true });
    const overrides = {
      owner: { owner: 'worker' }, degraded: { model_degraded: true },
      independent: { independent_review: false }, authorization: { source_authorization: null },
      'empty-user-words': { source_authorization: { kind: 'user-approved-current-source-review', user_words: '', authorized_mutations: [] } },
      'unknown-field': { lead_approved: true },
    };
    const approval = f.approval(Object.hasOwn(overrides, kind) ? overrides[kind] : {});
    if (kind === 'pass-record') put(f.root, approval.ref, `verdict: pass\n${block('gate-supersession', approval.value)}`);
    if (kind === 'duplicate-fence') put(f.root, approval.ref, block('gate-supersession', approval.value).repeat(2));
    if (kind === 'source') put(f.root, 'src/slice-0.txt', 'changed after review\n');
    if (kind === 'canonical') {
      f.lifecycle.next_action = 'Changed after review';
      put(f.root, f.lifecycleRef, block('task-lifecycle', f.lifecycle));
    }
    if (kind === 'state') {
      const state = json(f.statePath);
      const item = Object.values(state.slices)[0];
      Object.assign(item, { record_ref: '.agent/reports/merge-gate/old.md',
        record_sha256: '1'.repeat(64), verdict: 'pass' });
      writeFileSync(f.statePath, JSON.stringify(state));
    }
    if (kind === 'approval-symlink') {
      put(f.root, 'approval-copy.md', readFileSync(join(f.root, approval.ref)));
      rmSync(join(f.root, approval.ref));
      symlinkSync(join(f.root, 'approval-copy.md'), join(f.root, approval.ref));
    }
    await rejectSupersession(f, approval);
  });
}

test('interrupted proof-before-state publication requires exact retry and preserves predecessor bytes', async t => {
  const f = await supersessionFixture(t);
  const approval = f.approval();
  const proof = await publishTaskSupersession(f.root, f.refs, approval.ref);
  const bytes = evidenceBytes(f);
  writeFileSync(f.statePath, proof.value.predecessor_bytes);
  assert.throws(() => verifyTaskSupersession(f.root, f.refs));
  const alternate = f.approval({ reason: 'Different approval during interruption' }, '.agent/reports/merge-gate/checkpoints/alternate-supersession.md');
  await rejectSupersession(f, alternate);
  assert.deepEqual(await publishTaskSupersession(f.root, f.refs, approval.ref), proof);
  assert.deepEqual(evidenceBytes(f), bytes);
  assert.equal(verifyTaskSupersession(f.root, f.refs).length, 1);
});

for (const kind of ['source', 'canonical', 'predecessor', 'checkpoint']) {
  test(`interrupted publication cannot recover a nonexact retry: ${kind}`, async t => {
    const f = await supersessionFixture(t);
    const approval = f.approval();
    const proof = await publishTaskSupersession(f.root, f.refs, approval.ref);
    writeFileSync(f.statePath, proof.value.predecessor_bytes);
    if (kind === 'source') put(f.root, 'src/slice-0.txt', 'changed during interruption\n');
    if (kind === 'canonical') {
      f.lifecycle.next_action = 'Changed during interruption';
      put(f.root, f.lifecycleRef, block('task-lifecycle', f.lifecycle));
    }
    if (kind === 'predecessor') writeFileSync(f.statePath, `${proof.value.predecessor_bytes} `);
    if (kind === 'checkpoint') put(f.root, approval.ref, `${block('gate-supersession', approval.value)}changed\n`);
    await rejectSupersession(f, approval);
  });
}

test('a second approved lifecycle transition links to the first without removing original evidence', async t => {
  const f = await supersessionFixture(t);
  const first = await publishTaskSupersession(f.root, f.refs, f.approval().ref);
  const bytes = evidenceBytes(f);
  f.lifecycle.next_action = 'Second independently reviewed lifecycle transition';
  put(f.root, f.lifecycleRef, block('task-lifecycle', f.lifecycle));
  const secondApproval = f.approval({}, '.agent/reports/merge-gate/checkpoints/second.md');
  const second = await publishTaskSupersession(f.root, f.refs, secondApproval.ref);
  assert.equal(second.value.previous_sha256, first.sha256);
  assert.equal(verifyTaskSupersession(f.root, f.refs).length, 2);
  for (const [name, content] of Object.entries(bytes)) assert.equal(readFileSync(join(f.proofDir, name), 'utf8'), content);
  await rejectSupersession(f, { ref: first.value.approval.ref });
});

for (const kind of ['proof', 'predecessor', 'approval', 'baseline', 'proof-symlink', 'fork', 'unlinked', 'partial-state']) {
  test(`published transition rejects tampered history: ${kind}`, async t => {
    const f = await supersessionFixture(t);
    const approval = f.approval();
    const proof = await publishTaskSupersession(f.root, f.refs, approval.ref);
    const path = join(f.root, proof.ref);
    if (kind === 'proof') writeFileSync(path, '{}');
    if (kind === 'predecessor') {
      const value = json(path);
      value.predecessor_bytes += ' ';
      writeFileSync(path, JSON.stringify(value));
    }
    if (kind === 'approval') put(f.root, approval.ref, `${block('gate-supersession', approval.value)}changed\n`);
    if (kind === 'baseline') writeFileSync(join(f.proofDir, Object.keys(f.originalEvidence).find(name => name.startsWith('dispatch-'))), '{}');
    if (kind === 'proof-symlink') {
      put(f.root, 'proof-copy.json', readFileSync(path));
      rmSync(path);
      symlinkSync(join(f.root, 'proof-copy.json'), path);
    }
    if (kind === 'fork' || kind === 'unlinked') {
      const ref = '.agent/reports/merge-gate/checkpoints/fork.md';
      put(f.root, ref, block('gate-supersession', approval.value));
      const bytes = readFileSync(join(f.root, ref));
      const value = { ...proof.value, approval: { ...proof.value.approval, ref, sha256: digest(bytes) },
        previous_sha256: kind === 'fork' ? null : '0'.repeat(64) };
      writeFileSync(join(f.proofDir, `transition-${digest(bytes)}.json`), JSON.stringify(value));
    }
    if (kind === 'partial-state') {
      const state = json(f.statePath);
      state.slices[f.dispatch[0].slice_id].identity = f.dispatch[0];
      writeFileSync(f.statePath, JSON.stringify(state));
    }
    assert.throws(() => verifyTaskSupersession(f.root, f.refs));
    await rejectSupersession(f, approval);
  });
}

test('concurrent exact publications and stop-style state update retain all obligations under shared lock', async t => {
  const f = await supersessionFixture(t);
  const approval = f.approval();
  const results = await Promise.all([supersessionCLI(f, approval), supersessionCLI(f, approval),
    updateGateState(f.statePath, null, state => {
      assert.equal(Object.keys(state.slices).length, 7);
      for (const item of Object.values(state.slices)) {
        state.slices[item.identity.slice_id] = { identity: item.identity,
          record_ref: null, record_sha256: null, verdict: null };
      }
    })]);
  for (const result of results.slice(0, 2)) assert.equal(result.code, 0, result.stderr);
  assert.equal(Object.keys(json(f.statePath).slices).length, 7);
  assert.equal(verifyTaskSupersession(f.root, f.refs).length, 1);
  assertOriginalEvidence(f);
});

test('concurrent competing approvals publish one winner and reject the loser without evidence corruption', async t => {
  const f = await supersessionFixture(t);
  const first = f.approval({ reason: 'First competing approval' }, '.agent/reports/merge-gate/checkpoints/first.md');
  const second = f.approval({ reason: 'Second competing approval' }, '.agent/reports/merge-gate/checkpoints/second.md');
  const results = await Promise.all([supersessionCLI(f, first), supersessionCLI(f, second)]);
  const successful = results.filter(r => r.code === 0);
  const failed = results.filter(r => r.code !== 0);
  assert.equal(successful.length, 1);
  assert.equal(failed.length, 1);
  assert.equal(verifyTaskSupersession(f.root, f.refs).length, 1);
  assertOriginalEvidence(f);
  const state = json(f.statePath);
  assert.equal(Object.keys(state.slices).length, 7);
});

test('shared lock rejects publication, dispatch, freeze and stop updates without deleting another owner lock', async t => {
  const f = await supersessionFixture(t);
  const approval = f.approval();
  const lock = `${f.statePath}.lock`;
  mkdirSync(lock);
  const before = readFileSync(f.statePath, 'utf8');
  const completionRef = '.agent/reports/merge-gate/checkpoints/not-read-under-lock.md';
  const results = await Promise.allSettled([
    publishTaskSupersession(f.root, f.refs, approval.ref),
    captureTaskDispatch(f.root, f.refs),
    freezeTaskSet(f.root, f.refs, completionRef),
    updateGateState(f.statePath, null, () => {}),
  ]);
  for (const result of results) {
    assert.equal(result.status, 'rejected');
    assert.equal(result.reason.code, 'LEAD_GATE_LOCK_BUSY');
  }
  assert.deepEqual(readdirSync(lock), []);
  assert.equal(readFileSync(f.statePath, 'utf8'), before);
  assertOriginalEvidence(f);
});

test('concurrent publish, dispatch and freeze cannot lose or prematurely certify the outstanding set', async t => {
  const f = await supersessionFixture(t);
  const approval = f.approval();
  const results = await Promise.allSettled([
    publishTaskSupersession(f.root, f.refs, approval.ref),
    captureTaskDispatch(f.root, f.refs),
    freezeTaskSet(f.root, f.refs, '.agent/reports/merge-gate/checkpoints/missing.md'),
  ]);
  assert.equal(results[0].status, 'fulfilled');
  assert.equal(results[2].status, 'rejected');
  const state = json(f.statePath);
  assert.equal(Object.keys(state.slices).length, 7);
  assert.equal(Object.hasOwn(state, 'freeze_ref'), false);
  assert.equal(verifyTaskSupersession(f.root, f.refs).length, 1);
  assertOriginalEvidence(f);
});

test('refreeze after supersession transition links to prior freeze and rejects redundant supersedes in completion', async t => {
  const f = await fixture(t);
  const initial = f.checkpoint();
  const oldFreeze = await freezeTaskSet(f.root, f.refs, initial.ref);
  assert.equal(json(f.statePath).freeze_ref, oldFreeze.freeze_ref);

  f.lifecycle.next_action = 'Transition to new scope';
  put(f.root, f.lifecycleRef, block('task-lifecycle', f.lifecycle));
  const inspection = inspectTaskSupersession(f.root, f.refs);
  const approvalRef = '.agent/reports/merge-gate/checkpoints/transition-approval.md';
  const approvalValue = {
    approval_version: 1, owner: 'tech-lead', model_degraded: false, independent_review: true,
    inspection, reason: 'Approved lifecycle transition',
    source_authorization: {
      kind: 'user-approved-current-source-review',
      user_words: 'Review và pin nguồn hiện tại',
      authorized_mutations: inspection.baseline_kind === 'dispatch-backed'
        ? [...new Set([...inspection.mutation_paths, ...inspection.newly_reviewed_paths])].map(path => ({ path, provenance: 'Scope' }))
        : [],
    },
  };
  put(f.root, approvalRef, block('gate-supersession', approvalValue));
  await publishTaskSupersession(f.root, f.refs, approvalRef);

  const resetState = json(f.statePath);
  assert.equal(Object.hasOwn(resetState, 'freeze_ref'), false);

  const completionRef = '.agent/reports/merge-gate/checkpoints/refreeze-completion.md';
  const view = inspectTaskCompletion(f.root, f.refs);

  put(f.root, completionRef, block('gate-completion', {
    ...view,
    supersedes: { freeze_sha256: oldFreeze.freeze_sha256, lead_approved: true, reason: 'Redundant' },
  }));
  await assert.rejects(() => freezeTaskSet(f.root, f.refs, completionRef));

  put(f.root, completionRef, block('gate-completion', view));
  const newFreeze = await freezeTaskSet(f.root, f.refs, completionRef);
  const newProof = json(join(f.root, newFreeze.freeze_ref));
  assert.equal(newProof.previous_sha256, oldFreeze.freeze_sha256);
  assert.equal(verifyFrozenTaskSet(f.root, f.refs).freeze_sha256, newFreeze.freeze_sha256);
});

test('verifyFrozenTaskSet rejects expected snapshot tampering and freeze proof mutation', async t => {
  const f = await fixture(t);
  const checkpoint = f.checkpoint();
  await freezeTaskSet(f.root, f.refs, checkpoint.ref);
  const expected = verifyFrozenTaskSet(f.root, f.refs);

  assert.throws(() => verifyFrozenTaskSet(f.root, f.refs, { ...expected, state_sha256: '0'.repeat(64) }));
  assert.throws(() => verifyFrozenTaskSet(f.root, f.refs, { ...expected, freeze_sha256: '0'.repeat(64) }));
  assert.throws(() => verifyFrozenTaskSet(f.root, f.refs, {
    ...expected,
    source_union: { ...expected.source_union, source_fingerprint: '0'.repeat(64) },
  }));
  const state = json(f.statePath);
  state.freeze_sha256 = '0'.repeat(64);
  writeFileSync(f.statePath, JSON.stringify(state));
  assert.throws(() => verifyFrozenTaskSet(f.root, f.refs));
});

test('supersession resets existing certification, retains freeze history and enforces source-only drift before and after freeze', async t => {
  const f = await fixture(t);
  const initial = f.checkpoint();
  const oldFreeze = await freezeTaskSet(f.root, f.refs, initial.ref);
  const oldBytes = readFileSync(join(f.root, oldFreeze.freeze_ref), 'utf8');
  const state = json(f.statePath);
  for (const item of Object.values(state.slices)) Object.assign(item, {
    record_ref: '.agent/reports/merge-gate/historical.md', record_sha256: '1'.repeat(64),
    verdict: 'pass', ci_ref: '.agent/reports/ci-parity/historical/summary.json', ci_sha256: '2'.repeat(64),
  });
  writeFileSync(f.statePath, JSON.stringify(state));
  f.lifecycle.next_action = 'Explicit lifecycle transition after certification';
  put(f.root, f.lifecycleRef, block('task-lifecycle', f.lifecycle));
  const inspection = inspectTaskSupersession(f.root, f.refs);
  const approvalRef = '.agent/reports/merge-gate/checkpoints/reset.md';
  put(f.root, approvalRef, block('gate-supersession', {
    approval_version: 1, owner: 'tech-lead', model_degraded: false, independent_review: true,
    inspection, reason: 'Explicitly approved certification invalidation',
    source_authorization: {
      kind: 'user-approved-current-source-review',
      user_words: 'Review và pin nguồn hiện tại',
      authorized_mutations: inspection.baseline_kind === 'dispatch-backed'
        ? [...new Set([...inspection.mutation_paths, ...inspection.newly_reviewed_paths])].map(path => ({ path, provenance: 'Approved certification reset scope' }))
        : [],
    },
  }));
  await publishTaskSupersession(f.root, f.refs, approvalRef);
  const reset = json(f.statePath);
  assert.equal(reset.state_version, 1);
  assert.equal(Object.hasOwn(reset, 'freeze_ref'), false);
  for (const item of Object.values(reset.slices)) assert.deepEqual(Object.keys(item).sort(),
    ['identity', 'record_ref', 'record_sha256', 'verdict']);
  assert.equal(readFileSync(join(f.root, oldFreeze.freeze_ref), 'utf8'), oldBytes);
  assert.throws(() => verifyFrozenTaskSet(f.root, f.refs));
  const dependency = readFileSync(join(f.root, 'src/dependency.txt'));
  put(f.root, 'src/dependency.txt', 'unapproved before new freeze\n');
  assert.throws(() => inspectTaskCompletion(f.root, f.refs));
  put(f.root, 'src/dependency.txt', dependency);
  const completionRef = '.agent/reports/merge-gate/checkpoints/after-reset.md';
  put(f.root, completionRef, block('gate-completion', inspectTaskCompletion(f.root, f.refs)));
  const frozen = await freezeTaskSet(f.root, f.refs, completionRef);
  assert.equal(json(join(f.root, frozen.freeze_ref)).previous_sha256, oldFreeze.freeze_sha256);
  const before = verifyFrozenTaskSet(f.root, f.refs);
  const rewritten = json(f.statePath);
  rewritten.slices = Object.fromEntries(before.subjects.map(identity => [identity.slice_id,
    { identity, record_ref: null, record_sha256: null, verdict: null }]));
  writeFileSync(f.statePath, JSON.stringify(rewritten, null, 2) + '\n');
  assert.deepEqual(verifyFrozenTaskSet(f.root, f.refs).subjects, before.subjects);
  put(f.root, 'src/dependency.txt', 'unapproved after freeze\n');
  assert.throws(() => verifyFrozenTaskSet(f.root, f.refs, before));
});
