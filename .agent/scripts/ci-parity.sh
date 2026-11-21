#!/usr/bin/env bash
# ci-parity.sh - kiểm trước merge đúng những target GitLab CI sẽ build sau khi merge vào develop.
# Nguồn target: .gitlab/ci/build-backend.yml (BACKEND_PROJECT) và build-frontend.yml (package frontend/*).
# Một cửa build: chỉ chạy khi user yêu cầu rõ ràng (qua verifier/maintainer hoặc user tự chạy, AI_RULES.md §2); guard R8 chặn build trực tiếp.
#
#   bash .agent/scripts/ci-parity.sh [--base <ref>] [--force] [--dry-run] [--profile] [--backend-all | --scope <path>...] [--path <path>]... [--strict] [--contract <TASK>]...
#
# - Chọn target như rule `changes:` của CI; đổi BuildingBlocks, sln hoặc .gitlab-ci.yml thì build mọi service.
# - Chế độ scoped (--scope/--path): chỉ build target thuộc scope chỉ định để feedback nhanh.
# - Nhớ kết quả theo fingerprint của từng target: input không đổi thì không build lại, kể cả khi đang đỏ.
# - Khoá flock: mỗi lúc chỉ một lần chạy; đang bận thì thoát 75, không xếp hàng.
# - Task-bound gate dùng lặp --contract cho toàn bộ outstanding slice của cùng task/repo/worktree.
# - --backend-all: dev build toàn backend kể cả khi source không đổi; không dùng với --scope/--path/--contract.
# - --profile: bật ghi log nhị phân (.binlog) cho backend target được chọn để chẩn đoán hiệu năng build.
#   LƯU Ý BẢO MẬT: binlog chứa chi tiết môi trường và quá trình build, chỉ lưu nội bộ trong thư mục run, không commit hay chia sẻ ra ngoài.
# - Gom toàn bộ backend thành một target solution; scope hẹp vẫn build từng API.
# - Target chạy tuần tự, độ ưu tiên thấp, MSBuild tối đa 4 node và không giữ node sau build.
# Backend build Debug qua backend/fast-build.sh: backend/src không có `#if DEBUG` và không bật
# TreatWarningsAsErrors, nên lỗi compile trùng với `-c Release` của CI mà vẫn dùng lại cache local.
# Exit: 0 xanh, 1 đỏ, 2 sai tham số hoặc thiếu công cụ, 75 đang có lần chạy khác.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

VERSION="4"
CONTRACTS=()
BASE="HEAD"
FORCE=0
DRY_RUN=0
STRICT=0
BACKEND_ALL=0
PROFILE=0
SCOPES=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --base)
      [[ $# -ge 2 ]] || { echo "ci-parity: --base cần một ref" >&2; exit 2; }
      [[ -n "$2" ]] || { echo "ci-parity: --base cần một ref" >&2; exit 2; }
      BASE="$2"
      shift 2
      ;;
    --force) FORCE=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    --strict) STRICT=1; shift ;;
    --backend-all) BACKEND_ALL=1; shift ;;
    --profile) PROFILE=1; shift ;;
    --contract)
      [[ $# -ge 2 && -n "$2" ]] || { echo "ci-parity: --contract cần một đường dẫn không rỗng" >&2; exit 2; }
      CONTRACTS+=("$2"); shift 2 ;;
    --scope|--path)
      [[ $# -ge 2 ]] || { echo "ci-parity: $1 cần một đường dẫn không rỗng" >&2; exit 2; }
      [[ -n "$2" ]] || { echo "ci-parity: $1 cần một đường dẫn không rỗng" >&2; exit 2; }
      SCOPES+=("$2")
      shift 2
      ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "ci-parity: tham số không hợp lệ: $1" >&2; exit 2 ;;
  esac
done

if (( BACKEND_ALL )); then
  if (( ${#SCOPES[@]} || ${#CONTRACTS[@]} )); then
    echo "ci-parity: --backend-all là dev build riêng, không dùng với --scope/--path/--contract" >&2
    exit 2
  fi
  SCOPES=(backend)
fi

BASE_SHA="$(git rev-parse --verify --quiet "$BASE^{commit}")" || { echo "ci-parity: ref không hợp lệ: $BASE" >&2; exit 2; }
SCOPED_MODE=0
if [[ ${#SCOPES[@]} -gt 0 ]]; then
  SCOPED_MODE=1
  for idx in "${!SCOPES[@]}"; do
    s="${SCOPES[$idx]}"
    while [[ "$s" == */ && "$s" != "/" ]]; do
      s="${s%/}"
    done
    while [[ "$s" == ./* ]]; do
      s="${s#./}"
    done
    if [[ -z "$s" || "$s" == /* || "$s" == *".."* ]]; then
      echo "ci-parity: đường dẫn scope không hợp lệ (phải là đường dẫn tương đối trong repo): '$s'" >&2
      exit 2
    fi
    if ! { [[ -e "$s" ]] || git ls-files --error-unmatch "$s" >/dev/null 2>&1 || git diff --name-only "$BASE_SHA" -- "$s" 2>/dev/null | grep -q . ; }; then
      echo "ci-parity: đường dẫn scope không tồn tại hoặc không khớp trong repo: '$s'" >&2
      exit 2
    fi
    SCOPES[$idx]="$s"
  done
fi
OUT_DIR=".agent/reports/ci-parity"
CACHE_DIR="$OUT_DIR/cache"
LOCK_FILE=".agent/scratch/.runtime/ci-parity.lock"

RUNTIME_LOG_DIR=""
cleanup_runtime() {
  if [[ -n "${RUNTIME_LOG_DIR:-}" && -d "${RUNTIME_LOG_DIR:-}" ]]; then
    rm -rf "$RUNTIME_LOG_DIR"
  fi
}
trap cleanup_runtime EXIT INT TERM

# Node xử lý JSON, publish immutable và kiểm reference.
# Đường dẫn evidence không được ghép thành JSON qua shell.
evidence() {
  local command="$1"; shift
  node --input-type=module - "$ROOT" "$command" "$@" --contracts "${CONTRACTS[@]}" <<'NODE'
import { readFileSync, writeFileSync, renameSync, linkSync, unlinkSync, existsSync, readdirSync, statSync, realpathSync, rmSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { readTaskContract, computeSourceIdentity, verifyFrozenTaskSet, gateStatePath, updateGateState } from './.agent/scripts/task-contract.mjs';
const [root, command, ...allArgs] = process.argv.slice(2);
const contractMarker = allArgs.indexOf('--contracts');
if (contractMarker < 0) throw new Error('INVALID_EVIDENCE_COMMAND');
const args = allArgs.slice(0, contractMarker);
const contractPaths = allArgs.slice(contractMarker + 1);
const taskBound = contractPaths.length > 0;
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const json = path => JSON.parse(readFileSync(path, 'utf8'));
const canonicalJSON = value => JSON.stringify(value, (_, entry) => entry && typeof entry === 'object' && !Array.isArray(entry)
  ? Object.fromEntries(Object.keys(entry).sort().map(key => [key, entry[key]])) : entry);
const confined = path => {
  const absolute = resolve(root, path);
  if (!existsSync(absolute) || !absolute.startsWith(`${root}/.agent/reports/ci-parity/logs/`) || !realpathSync(absolute).startsWith(`${root}/.agent/reports/ci-parity/logs/`)) throw new Error('INVALID_EVIDENCE_REF');
  return absolute;
};
const subject = path => {
  const c = readTaskContract(root, path);
  const { task_id, slice_id, contract_ref, contract_version, contract_hash, lifecycle_hash } = c;
  return { task_id, slice_id, contract_ref, contract_version, contract_hash, lifecycle_hash, ...computeSourceIdentity(root, c.source_paths) };
};
const legacyUnboundIdentity = () => {
  const evidenceRoots = ['.agent/reports', '.agent/scratch', '.agent/task-manifests'];
  const isEvidence = path => evidenceRoots.some(prefix => path === prefix || path.startsWith(`${prefix}/`));
  // Giữ cả source bị ignore và file tracked đã xóa, nhưng không quét output build.
  const tracked = execFileSync('git', ['-C', root, 'ls-files', '-z', '--cached'], { encoding: 'utf8', timeout: 10000, maxBuffer: 32 * 1024 * 1024 });
  const changed = execFileSync('git', ['-C', root, 'diff', '--name-only', '-z', 'HEAD', '--'], { encoding: 'utf8', timeout: 10000, maxBuffer: 32 * 1024 * 1024 });
  const paths = new Set([...tracked.split('\0'), ...changed.split('\0')].filter(path => path && !isEvidence(path)));
  const outputDirectories = new Set(['bin', 'obj', 'dist', 'node_modules']);
  const collect = directory => {
    for (const entry of readdirSync(resolve(root, directory), { withFileTypes: true })) {
      const path = directory ? `${directory}/${entry.name}` : entry.name;
      if (entry.name === '.git' || isEvidence(path)) continue;
      if (entry.isDirectory()) {
        if (outputDirectories.has(entry.name.toLowerCase()) || path === 'backend/logs' ||
            path === '.dotnet/.dotnet' || path === '.nuget/packages' || path.endsWith('/.nuget/packages')) continue;
        collect(path);
      } else paths.add(path);
    }
  };
  collect('');
  const sourceFiles = [...paths].sort();
  const sourcePaths = [...new Set(sourceFiles.map(path => path.startsWith('.agent/') ? path.split('/').slice(0, 2).join('/') : path.split('/')[0]))].sort();
  return computeSourceIdentity(root, sourcePaths, { sourceFiles });
};
const identity = () => {
  if (taskBound) return contractPaths.map(subject).sort((a, b) => a.slice_id.localeCompare(b.slice_id) || a.contract_ref.localeCompare(b.contract_ref));
  try {
    const evidenceRoots = ['.agent/reports', '.agent/scratch', '.agent/task-manifests'];
    const outputDirectories = new Set(['bin', 'obj', 'dist', 'node_modules']);
    const isIgnoredPath = path => {
      if (!path || evidenceRoots.some(prefix => path === prefix || path.startsWith(`${prefix}/`))) return true;
      if (path === 'backend/logs' || path === '.dotnet/.dotnet' || path === '.nuget/packages' || path.endsWith('/.nuget/packages')) return true;
      return path.split('/').some(seg => outputDirectories.has(seg.toLowerCase()));
    };
    const common = realpathSync(resolve(root, execFileSync('git', ['-C', root, 'rev-parse', '--git-common-dir'], { encoding: 'utf8', timeout: 10000 }).trim()));
    const worktree = realpathSync(execFileSync('git', ['-C', root, 'rev-parse', '--show-toplevel'], { encoding: 'utf8', timeout: 10000 }).trim());
    const head = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8', timeout: 10000 }).trim();
    const statusRaw = execFileSync('git', ['-C', root, 'status', '--porcelain=v1', '-z', '--untracked-files=all'], { encoding: 'utf8', timeout: 10000, maxBuffer: 32 * 1024 * 1024 });
    const statusTokens = statusRaw.split('\0');
    const dirtyPaths = new Set();
    for (let idx = 0; idx < statusTokens.length; idx++) {
      const token = statusTokens[idx];
      if (!token) continue;
      const code = token.slice(0, 2);
      const filePath = token.slice(3);
      if (filePath && !isIgnoredPath(filePath)) dirtyPaths.add(filePath);
      if (code.includes('R') || code.includes('C')) {
        const oldPath = statusTokens[idx + 1];
        if (oldPath && !isIgnoredPath(oldPath)) dirtyPaths.add(oldPath);
        idx += 1;
      }
    }
    const localInputs = execFileSync('git', ['-C', root, 'ls-files', '-z', '--others', '--ignored', '--exclude-standard', '--',
      '.agent/scripts', '.agent/contracts', 'backend/Directory.Build.props', '.editorconfig', 'backend/.editorconfig', 'backend/fast-build.sh', 'frontend/fast-check.sh'
    ], { encoding: 'utf8', timeout: 10000, maxBuffer: 32 * 1024 * 1024 });
    for (const p of localInputs.split('\0')) {
      if (p && !isIgnoredPath(p)) dirtyPaths.add(p);
    }
    const hashFileStat = p => {
      const abs = resolve(root, p);
      if (!existsSync(abs)) return { path: p, kind: 'deleted' };
      const st = statSync(abs);
      if (!st.isFile()) return { path: p, kind: 'other' };
      return { path: p, kind: 'file', executable: Boolean(st.mode & 0o111), hash: hash(abs) };
    };
    const entries = [...dirtyPaths].sort().map(hashFileStat);
    const sourcePaths = [...new Set(['git:HEAD', ...entries.map(e => e.path.startsWith('.agent/') ? e.path.split('/').slice(0, 2).join('/') : e.path.split('/')[0])])].sort();
    const sha = value => createHash('sha256').update(value).digest('hex');
    return {
      repo_id: sha(common),
      worktree_id: sha(worktree),
      source_fingerprint: sha(canonicalJSON({ head, source_paths: sourcePaths, entries })),
      source_paths: sourcePaths
    };
  } catch {
    return legacyUnboundIdentity();
  }
};

const validTaskSetSummary = summary => {
  if (summary.summary_version !== 3 || summary.binding !== 'task-set-bound' || !Array.isArray(summary.subjects) ||
      !Array.isArray(summary.subjects_after) || !summary.subjects.length || summary.subjects.length !== summary.subjects_after.length) return false;
  return summary.subjects.every((item, index) => canonicalJSON(item) === canonicalJSON(summary.subjects_after[index])) &&
    new Set(summary.subjects.map(item => item.slice_id)).size === summary.subjects.length &&
    summary.subjects.every((item, index) => !index || summary.subjects[index - 1].slice_id.localeCompare(item.slice_id) < 0) &&
    summary.subjects.every(item => item.task_id === summary.task_id && item.repo_id === summary.repo_id && item.worktree_id === summary.worktree_id &&
      typeof item.contract_ref === 'string' && typeof item.source_fingerprint === 'string' && Array.isArray(item.source_paths));
};
const outstanding = (subjects, before) => {
  const frozen = verifyFrozenTaskSet(root, contractPaths);
  if (canonicalJSON(subjects) !== canonicalJSON(frozen.subjects)) throw new Error('OUTSTANDING_SUBJECT_MISMATCH');
  if (before && canonicalJSON(subjects) !== canonicalJSON(before)) throw new Error('TASK_SET_CHANGED_BEFORE_RUN');
  return frozen;
};
const atomic = (path, value, immutable = false) => {
  const temp = `${path}.${process.pid}.tmp`;
  writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
  try { if (immutable) { linkSync(temp, path); unlinkSync(temp); } else renameSync(temp, path); }
  finally { if (existsSync(temp)) unlinkSync(temp); }
};
const verify = (ref, digest) => {
  if (typeof ref !== 'string' || typeof digest !== 'string' || hash(confined(ref)) !== digest) throw new Error('INVALID_EVIDENCE_HASH');
};
const validateCache = (marker, name, fingerprint, mode, currentIdentity) => {
  try {
    if (!existsSync(marker)) return null;
    let c;
    try { c = json(marker); } catch { return null; }
    if (!c || c.cache_version !== 2 || c.status !== (marker.endsWith('.ok') ? 'pass' : 'fail')) return null;
    if (typeof c.summary_ref !== 'string' || typeof c.summary_sha256 !== 'string') return null;
    if (c.mode !== mode || c.fingerprint !== fingerprint || c.name !== name) return null;

    const summaryPath = confined(c.summary_ref);
    if (hash(summaryPath) !== c.summary_sha256) return null;

    let s;
    try { s = json(summaryPath); } catch { return null; }
    if (!s || s.source_integrity !== 'unchanged' || s.mode !== mode || s.is_merge_parity !== (mode === 'full') || !['pass', 'fail'].includes(s.status)) return null;

    if (taskBound) {
      if (s.summary_version !== 3 || s.binding !== 'task-set-bound') return null;
      if (!validTaskSetSummary(s)) return null;
      if (typeof s.source_union?.source_fingerprint !== 'string' || !Array.isArray(s.source_union?.source_paths)) return null;
      if (JSON.stringify(s.source_union) !== JSON.stringify(s.source_union_after)) return null;
      if (canonicalJSON(s.source_union.source_paths) !== canonicalJSON([...new Set(s.subjects.flatMap(item => item.source_paths))].sort())) return null;
      if (canonicalJSON(s.subjects) !== canonicalJSON(currentIdentity)) return null;
      const frozen = outstanding(currentIdentity);
      if (canonicalJSON(s.source_union) !== canonicalJSON(frozen.source_union)) return null;
    } else {
      if (s.summary_version !== 2 || s.binding !== 'unbound') return null;
      if (!currentIdentity ||
          s.repo_id !== currentIdentity.repo_id ||
          s.worktree_id !== currentIdentity.worktree_id ||
          s.source_fingerprint !== currentIdentity.source_fingerprint ||
          canonicalJSON(s.source_paths) !== canonicalJSON(currentIdentity.source_paths)) return null;
    }

    const t = s.targets?.find?.(t => t.name === name && t.fingerprint === fingerprint && t.status === c.status);
    if (!t || t.cached || t.name !== name || t.fingerprint !== fingerprint) return null;

    if (typeof t.log_ref === 'string' && typeof t.log_sha256 === 'string') {
      const logPath = confined(t.log_ref);
      if (hash(logPath) !== t.log_sha256) return null;
    } else if (c.status === 'fail' || t.log_ref !== null || t.log_sha256 !== null) {
      return null;
    }

    if (typeof t.binlog_ref === 'string' && typeof t.binlog_sha256 === 'string') {
      const binlogPath = confined(t.binlog_ref);
      if (hash(binlogPath) !== t.binlog_sha256) return null;
    } else if (t.binlog_ref !== undefined && (t.binlog_ref !== null || t.binlog_sha256 !== null)) {
      return null;
    }

    return { ...t, cached: true, evidence_ref: c.summary_ref, evidence_sha256: c.summary_sha256 };
  } catch {
    return null;
  }
};
try {
  if (command === 'preflight') {
    const subjects = identity();
    if (taskBound) outstanding(subjects);
    console.log(JSON.stringify(subjects));
  } else if (command === 'identity') {
    const subjects = identity();
    if (taskBound) outstanding(subjects);
    console.log(JSON.stringify(subjects));
  } else if (command === 'snapshot') {
    const [dir] = args;
    const subjects = identity();
    if (taskBound) {
      await updateGateState(gateStatePath(root, subjects[0]), null, () => {
        const frozen = outstanding(subjects);
        atomic(`${dir}/frozen-before.json`, frozen, true);
        atomic(`${dir}/source-union-before.json`, frozen.source_union, true);
        atomic(`${dir}/source-before.json`, subjects, true);
      });
    } else {
      atomic(`${dir}/source-before.json`, subjects, true);
    }
    console.log(JSON.stringify(subjects));
  } else if (command === 'cache') {
    const [marker, name, fingerprint, mode, currentIdentityJson] = args;
    let currentIdentity = null;
    try { currentIdentity = JSON.parse(currentIdentityJson); } catch { process.exit(1); }
    const valid = validateCache(marker, name, fingerprint, mode, currentIdentity);
    if (!valid) process.exit(1);
    console.log(JSON.stringify(valid));
  } else if (command === 'target') {
    const [file, name, fingerprint, status, log, seconds, durationMs, binlog] = args;
    const hasLog = Boolean(log && existsSync(resolve(root, log)));
    const hasBinlog = Boolean(binlog && existsSync(resolve(root, binlog)));
    atomic(file, {
      name, fingerprint, status, cached: false,
      seconds: Number(seconds),
      duration_ms: durationMs !== undefined && durationMs !== '' ? Number(durationMs) : null,
      log_ref: hasLog ? log : null,
      log_sha256: hasLog ? hash(resolve(root, log)) : null,
      binlog_ref: hasBinlog ? binlog : null,
      binlog_sha256: hasBinlog ? hash(resolve(root, binlog)) : null
    }, true);
  } else if (command === 'publish') {
    const [dir, beforeFile, base, baseRef, mode, requestedStatus, scopesFile, outsideFile] = args;
    const before = json(beforeFile);
    const publish = () => {
    const after = identity();
    let unchanged = JSON.stringify(before) === JSON.stringify(after);
    let unionBefore = null, unionAfter = null;
    let frozenBefore = null, frozenAfter = null;
    if (taskBound) {
      outstanding(before, null);
      frozenBefore = json(`${dir}/frozen-before.json`);
      frozenAfter = verifyFrozenTaskSet(root, contractPaths, frozenBefore);
      unionBefore = json(`${dir}/source-union-before.json`);
      unionAfter = frozenAfter.source_union;
      unchanged = unchanged && JSON.stringify(unionBefore) === JSON.stringify(unionAfter);
    }
    const targets = readdirSync(dir).filter(n => n.endsWith('.target.json')).sort().map(n => json(`${dir}/${n}`));
    const status = unchanged ? requestedStatus : 'source-changed';
    const summary = {
      summary_version: taskBound ? 3 : 2, binding: taskBound ? 'task-set-bound' : 'unbound',
      ...(taskBound ? {
        task_id: before[0].task_id, repo_id: before[0].repo_id, worktree_id: before[0].worktree_id,
        subjects: before, subjects_after: after, source_union: unionBefore, source_union_after: unionAfter,
        frozen_before: frozenBefore, frozen_after: frozenAfter
      } : { ...before, source_after: after }),
      source_integrity: unchanged ? 'unchanged' : 'changed',
      run_id: dir.split('/').at(-1), base, base_ref: baseRef, mode,
      is_merge_parity: mode === 'full', status, log_dir: dir,
      scopes: readFileSync(scopesFile, 'utf8').split('\0').filter(Boolean),
      unscoped_changed_files: readFileSync(outsideFile, 'utf8').split('\0').filter(Boolean), targets
    };
    summary.unscoped_changed_count = summary.unscoped_changed_files.length;
    const ref = `${dir}/summary.json`;
    atomic(ref, summary, true);
    const digest = hash(ref);
    if (unchanged) for (const t of targets.filter(t => !t.cached)) {
      const prefix = mode === 'scoped' ? 'scoped_' : '';
      const key = `.agent/reports/ci-parity/cache/${prefix}${t.name.replace(/[:/]/g, '_')}-${t.fingerprint}`;
      atomic(`${key}.${t.status === 'pass' ? 'ok' : 'fail'}`, { cache_version: 2, name: t.name, mode, fingerprint: t.fingerprint, status: t.status, summary_ref: ref, summary_sha256: digest });
      const opposite = `${key}.${t.status === 'pass' ? 'fail' : 'ok'}`;
      if (existsSync(opposite)) unlinkSync(opposite);
    }
    atomic(`.agent/reports/ci-parity/${mode === 'scoped' ? 'last-scoped-run' : 'last-run'}.json`, { summary_ref: ref, summary_sha256: digest, run_id: summary.run_id, mode, status });
    console.log(status);
    };
    if (taskBound) await updateGateState(gateStatePath(root, before[0]), null, publish);
    else publish();
  } else if (command === 'retain') {
    const logs = resolve(root, '.agent/reports/ci-parity/logs');
    if (!existsSync(logs)) mkdirSync(logs, { recursive: true });
    const pins = new Set();
    let uncertain = false;
    const visitRef = ref => {
      try {
        if (typeof ref !== 'string') return;
        const absPath = resolve(root, ref);
        if (!existsSync(absPath)) return;
        const path = confined(ref);
        const run = relative(logs, path).split('/')[0];
        if (pins.has(run)) return;
        pins.add(run);
        const summaryFile = resolve(logs, run, 'summary.json');
        if (!existsSync(summaryFile)) return;
        const summary = json(summaryFile);
        if (summary.summary_version === 3 && (!validTaskSetSummary(summary) || JSON.stringify(summary.source_union) !== JSON.stringify(summary.source_union_after) ||
            canonicalJSON(summary.source_union?.source_paths) !== canonicalJSON([...new Set(summary.subjects.flatMap(item => item.source_paths))].sort()))) throw new Error('INVALID_TASK_SET_SUMMARY');
        for (const t of summary.targets || []) {
          if (t.cached && typeof t.evidence_ref === 'string') {
            const evAbs = resolve(root, t.evidence_ref);
            if (existsSync(evAbs)) {
              verify(t.evidence_ref, t.evidence_sha256);
              visitRef(t.evidence_ref);
            }
          }
        }
      } catch (error) { uncertain = true; console.error(`ci-parity retention: giữ mọi run: ${error.message}`); }
    };
    const scan = (dir, depth = 0) => {
      if (!existsSync(dir)) return;
      if (depth > 5) { uncertain = true; console.error(`ci-parity retention: giữ mọi run: vượt độ sâu ${relative(root, dir)}`); return; }
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = resolve(dir, entry.name);
        if (path === logs) continue;
        if (entry.isSymbolicLink()) { uncertain = true; console.error(`ci-parity retention: giữ mọi run: symlink ${relative(root, path)}`); continue; }
        if (entry.isDirectory()) { scan(path, depth + 1); continue; }
        const text = readFileSync(path, 'utf8');
        if (path.includes('/ci-parity/cache/')) {
          try {
            const c = json(path);
            if (typeof c.summary_ref === 'string') {
              const sumPath = resolve(root, c.summary_ref);
              if (!existsSync(sumPath)) {
                try { unlinkSync(path); } catch {}
                continue;
              }
              verify(c.summary_ref, c.summary_sha256);
              visitRef(c.summary_ref);
            } else {
              try { unlinkSync(path); } catch {}
            }
          }
          catch (error) {
            try { unlinkSync(path); } catch {}
          }
        } else if (text.includes('ci-parity/logs/')) {
          // Format record chưa biết phải giữ evidence, không xóa fail-open.
          try {
            const refs = [];
            const walk = v => { if (typeof v === 'string' && v.includes('ci-parity/logs/')) refs.push(v); else if (v && typeof v === 'object') Object.values(v).forEach(walk); };
            walk(JSON.parse(text));
            if (!refs.length) throw new Error('UNKNOWN_PIN_FORMAT');
            refs.forEach(visitRef);
          } catch (error) { uncertain = true; console.error(`ci-parity retention: giữ mọi run: pin ${relative(root, path)}: ${error.message}`); }
        } else if (path.includes('/merge-gate/')) {
          uncertain = true;
          console.error(`ci-parity retention: giữ mọi run: không xác định pin của record ${relative(root, path)}`);
        }
      }
    };
    scan(resolve(root, '.agent/reports'));
    if (!uncertain) {
      const runs = readdirSync(logs).filter(n => statSync(resolve(logs, n)).isDirectory()).sort((a, b) => statSync(resolve(logs, b)).mtimeMs - statSync(resolve(logs, a)).mtimeMs);
      for (const run of runs.slice(20)) if (!pins.has(run)) rmSync(resolve(logs, run), { recursive: true });
      // Resolve pin trước khi hết hạn cache; run được giữ qua vòng cleanup này.
      const cache = resolve(root, '.agent/reports/ci-parity/cache');
      if (existsSync(cache)) {
        for (const name of readdirSync(cache)) {
          const path = resolve(cache, name);
          if (statSync(path).isFile() && Date.now() - statSync(path).mtimeMs > 30 * 86400000) unlinkSync(path);
        }
      }
    }
  } else throw new Error('INVALID_EVIDENCE_COMMAND');
} catch (error) { console.error(`ci-parity evidence: ${error.code || error.message}`); process.exitCode = 2; }
NODE
}

if [[ ${#CONTRACTS[@]} -gt 0 ]]; then
  evidence preflight >/dev/null || exit 2
fi

begin_evidence() {
  mkdir -p "$CACHE_DIR" "$(dirname "$LOCK_FILE")" "$OUT_DIR/logs"
  exec 9>"$LOCK_FILE"
  flock -n 9 || { echo "ci-parity: lần chạy khác đang giữ khoá $LOCK_FILE; không xếp hàng." >&2; exit 75; }
  LOG_DIR="$(mktemp -d "$OUT_DIR/logs/$(date +%Y%m%d-%H%M%S)-XXXXXXXX")"
  RUN_ID="${LOG_DIR##*/}"
  RUNTIME_LOG_DIR="$(mktemp -d ".agent/scratch/.runtime/ci-parity-$RUN_ID-XXXXXX")"
  CURRENT_IDENTITY="$(evidence snapshot "$LOG_DIR")"
  printf '%s\0' "${SCOPES[@]}" > "$LOG_DIR/scopes.bin"
  printf '%s\0' "${OUT_SCOPE_FILES[@]}" > "$LOG_DIR/outside.bin"
}
publish_evidence() {
  local result
  result="$(evidence publish "$LOG_DIR" "$LOG_DIR/source-before.json" "$BASE_SHA" "$BASE" "$([[ $SCOPED_MODE == 1 ]] && echo scoped || echo full)" "$1" "$LOG_DIR/scopes.bin" "$LOG_DIR/outside.bin")"
  evidence retain
  [[ "$result" != source-changed ]] || { echo "ci-parity: source thay đổi trong lần chạy; không chứng nhận pass." >&2; exit 1; }
}

# File đổi so với base: tracked (đã hoặc chưa stage) cộng untracked không bị ignore.
mapfile -t CHANGED < <({ git diff --name-only "$BASE_SHA"; git ls-files --others --exclude-standard; } | sort -u)

IN_SCOPE_FILES=()
OUT_SCOPE_FILES=()
if (( SCOPED_MODE )); then
  if git ls-files -u | grep -q .; then
    echo "ci-parity: phát hiện git merge conflict chưa giải quyết trong workspace" >&2
    exit 2
  fi

  for f in "${CHANGED[@]}"; do
    in_s=0
    for s in "${SCOPES[@]}"; do
      if [[ "$f" == "$s" || "$f" == "$s/"* ]]; then
        in_s=1
        break
      fi
    done
    if (( in_s )); then
      IN_SCOPE_FILES+=("$f")
    else
      OUT_SCOPE_FILES+=("$f")
    fi
  done

  if [[ ${#IN_SCOPE_FILES[@]} -eq 0 ]] && (( ! BACKEND_ALL )); then
    echo "ci-parity: không có thay đổi nào trong scope đã khai báo: ${SCOPES[*]}" >&2
    echo "ci-parity: các file thay đổi hiện tại nằm ngoài scope (${#OUT_SCOPE_FILES[@]} file)." >&2
    if (( ! DRY_RUN )); then begin_evidence; publish_evidence not-applicable; fi
    exit 2
  fi

  if [[ ${#OUT_SCOPE_FILES[@]} -gt 0 ]]; then
    if (( STRICT )); then
      echo "ci-parity: [strict] phát hiện ${#OUT_SCOPE_FILES[@]} file thay đổi ngoài scope. Dừng tiến trình." >&2
      exit 2
    else
      echo "ci-parity [scoped]: CHẾ ĐỘ FEEDBACK CỤC BỘ (Scope: ${SCOPES[*]})"
      echo "ci-parity [scoped]: CẢNH BÁO: Phát hiện ${#OUT_SCOPE_FILES[@]} file thay đổi NGOÀI scope đã khai báo:"
      for ((j=0; j<${#OUT_SCOPE_FILES[@]} && j<10; j++)); do
        echo "  - ${OUT_SCOPE_FILES[j]}"
      done
      if [[ ${#OUT_SCOPE_FILES[@]} -gt 10 ]]; then
        echo "  ... và $(( ${#OUT_SCOPE_FILES[@]} - 10 )) file khác."
      fi
      echo "ci-parity [scoped]: LƯU Ý: Các thay đổi ngoài scope bị bỏ qua cho lần chạy này."
      echo "ci-parity [scoped]: KẾT QUẢ NÀY CHỈ DÙNG CHO PHẢN HỒI NỘI BỘ, KHÔNG THAY THẾ MERGE GATE!"
    fi
  fi
else
  if [[ ${#CHANGED[@]} -eq 0 ]]; then
    if (( PROFILE )); then
      echo "ci-parity: --profile yêu cầu ít nhất một target backend được chọn" >&2
      exit 2
    fi
    echo "ci-parity: không có thay đổi so với $BASE (${BASE_SHA:0:9})."
    if (( ! DRY_RUN )); then begin_evidence; publish_evidence not-applicable; fi
    exit 0
  fi
fi

changed_under() {
  local f
  for f in "${CHANGED[@]}"; do [[ "$f" == "$1"* ]] && return 0; done
  return 1
}

changed_exact() {
  local f
  for f in "${CHANGED[@]}"; do [[ "$f" == "$1" ]] && return 0; done
  return 1
}

T_NAME=()
T_ROOTS=()
T_KIND=()
T_ARGS=()
# add_target <tên> <roots cách nhau bởi dấu cách> <kind> [args...]
add_target() {
  T_NAME+=("$1")
  T_ROOTS+=("$2")
  T_KIND+=("$3")
  T_ARGS+=("${*:4}")
}
target_matches_scope() {
  local target_root="$1"
  local clean_root="${target_root%/}"
  local s
  for s in "${SCOPES[@]}"; do
    if [[ "$clean_root" == "$s" || "$clean_root" == "$s/"* || "$s" == "$target_root"* || "$s" == "$clean_root" ]]; then
      return 0
    fi
  done
  return 1
}

lockfile_scope_match() {
  local s
  for s in "${SCOPES[@]}"; do
    case "$s" in
      package.json|pnpm-lock.yaml|pnpm-workspace.yaml|frontend/*/package.json|frontend|frontend/\*)
        return 0
        ;;
    esac
  done
  return 1
}


# Lockfile: CI chạy `pnpm install --frozen-lockfile`, đỏ khi package.json lệch pnpm-lock.yaml.
MANIFESTS="package.json pnpm-lock.yaml pnpm-workspace.yaml $(printf '%s ' frontend/*/package.json)"
if (( ! SCOPED_MODE )) || lockfile_scope_match; then
  for f in "${CHANGED[@]}"; do
    case "$f" in
      package.json|pnpm-lock.yaml|pnpm-workspace.yaml|frontend/*/package.json)
        add_target "fe:lockfile" "$MANIFESTS" lockfile
        break
        ;;
    esac
  done
fi

# Backend: mỗi BACKEND_PROJECT của CI build khi thư mục service của nó đổi, hoặc khi đổi phần dùng chung.
be_common=0
if (( BACKEND_ALL )) || changed_under "backend/src/BuildingBlocks/" || changed_exact "backend/CogainSolution.sln" || changed_exact ".gitlab-ci.yml"; then
  be_common=1
fi
mapfile -t BE_PROJECTS < <(sed -n 's/^[[:space:]]*BACKEND_PROJECT:[[:space:]]*//p' .gitlab/ci/build-backend.yml)
BE_SELECTED=()
BE_ROOTS=""
for proj in "${BE_PROJECTS[@]}"; do
  proj="${proj//[[:space:]]/}"
  [[ -n "$proj" ]] || continue
  svc_root="$(dirname "$(dirname "$proj")")/"
  if { (( ! SCOPED_MODE )) || target_matches_scope "$svc_root"; } && { (( be_common )) || changed_under "$svc_root"; }; then
    BE_SELECTED+=("$proj")
    BE_ROOTS+="$svc_root "
  fi
done
BE_COMMON_INPUTS=".agent/scripts/ci-parity.sh backend/fast-build.sh backend/Directory.Build.props .editorconfig backend/.editorconfig .gitlab/ci/build-backend.yml backend/src/BuildingBlocks/ backend/CogainSolution.sln"
if (( ${#BE_SELECTED[@]} > 1 && ${#BE_SELECTED[@]} == ${#BE_PROJECTS[@]} )); then
  add_target "be:solution" \
    "${BE_ROOTS}${BE_COMMON_INPUTS}" \
    backend "backend/CogainSolution.sln"
else
  for proj in "${BE_SELECTED[@]}"; do
    svc_root="$(dirname "$(dirname "$proj")")/"
    add_target "be:$(basename "$proj" .csproj)" \
      "$svc_root ${BE_COMMON_INPUTS}" \
      backend "$proj"
  done
fi

# Frontend: CI build package đổi và package phụ thuộc (`...[HEAD^1]`); mọi app phụ thuộc frontend/shared.
fe_shared=0
changed_under "frontend/shared/" && fe_shared=1
for pkg_json in frontend/*/package.json; do
  app="$(basename "$(dirname "$pkg_json")")"
  [[ "$app" == "shared" ]] && continue
  if { (( ! SCOPED_MODE )) || target_matches_scope "frontend/$app/"; } && { (( fe_shared )) || changed_under "frontend/$app/"; }; then
    # CI luôn generate routes trước build, kể cả khi chỉ dependency hoặc shared đổi.
    add_target "fe:$app" "frontend/$app/ frontend/shared/ $MANIFESTS" frontend "$app" --routes
  fi
done

if [[ ${#T_NAME[@]} -eq 0 ]]; then
  if (( PROFILE )); then
    echo "ci-parity: --profile yêu cầu ít nhất một target backend được chọn" >&2
    exit 2
  fi
  if (( ! DRY_RUN )); then begin_evidence; publish_evidence not-applicable; fi
  if (( SCOPED_MODE )); then
    echo "ci-parity: scope '${SCOPES[*]}' không ánh xạ tới bất kỳ target build nào được định nghĩa" >&2
    exit 2
  else
    echo "ci-parity: thay đổi không chạm target nào CI sẽ build (base ${BASE_SHA:0:9})."
    exit 0
  fi
fi

if (( PROFILE )); then
  has_backend=0
  for k in "${T_KIND[@]}"; do
    if [[ "$k" == "backend" ]]; then
      has_backend=1
      break
    fi
  done
  if (( ! has_backend )); then
    echo "ci-parity: --profile yêu cầu ít nhất một target backend được chọn" >&2
    exit 2
  fi
fi

HAS_BACKEND=0
HAS_FRONTEND_OR_LOCKFILE=0
for k in "${T_KIND[@]}"; do
  [[ "$k" == "backend" ]] && HAS_BACKEND=1
  [[ "$k" == "frontend" || "$k" == "lockfile" ]] && HAS_FRONTEND_OR_LOCKFILE=1
done

NODE_VERSION=""
DOTNET_VERSION=""
PNPM_VERSION=""

NODE_VERSION="$(node -v 2>/dev/null || echo "missing")"
if (( HAS_BACKEND )); then
  DOTNET_VERSION="$(dotnet --version 2>/dev/null || echo "missing")"
fi
if (( HAS_FRONTEND_OR_LOCKFILE )); then
  PNPM_VERSION="$(pnpm --version 2>/dev/null || echo "missing")"
fi

fingerprint() {
  local kind="$1"
  shift
  local f
  {
    printf 'v%s %s node=%s\n' "$VERSION" "$BASE_SHA" "$NODE_VERSION"
    case "$kind" in
      backend) printf 'dotnet=%s\n' "$DOTNET_VERSION" ;;
      frontend|lockfile) printf 'pnpm=%s\n' "$PNPM_VERSION" ;;
    esac
    git diff --binary "$BASE_SHA" -- "$@"
    git ls-files --others --exclude-standard -- "$@" | while IFS= read -r f; do
      printf '%s ' "$f"
      sha256sum < "$f"
    done
  } | sha256sum | cut -c1-16
}

echo "ci-parity base=$BASE (${BASE_SHA:0:9}) targets: ${T_NAME[*]}"

if (( DRY_RUN )); then
  CURRENT_IDENTITY="$(evidence identity)"
  mode="$([[ $SCOPED_MODE == 1 ]] && echo scoped || echo full)"
  for i in "${!T_NAME[@]}"; do
    name="${T_NAME[$i]}"
    kind="${T_KIND[$i]}"
    read -r -a roots <<< "${T_ROOTS[$i]}"
    fp="$(fingerprint "$kind" "${roots[@]}")"
    if (( SCOPED_MODE )); then
      key="$CACHE_DIR/scoped_${name//[:\/]/_}-$fp"
    else
      key="$CACHE_DIR/${name//[:\/]/_}-$fp"
    fi
    state="cần build"
    skip_cache=0
    (( FORCE )) && skip_cache=1
    if (( PROFILE )) && [[ "$kind" == backend ]]; then
      skip_cache=1
    fi
    if (( ! skip_cache )); then
      for s in ok fail; do
        if [[ -f "$key.$s" ]] && evidence cache "$key.$s" "$name" "$fp" "$mode" "$CURRENT_IDENTITY" >/dev/null 2>&1; then
          [[ "$s" == ok ]] && state="đã xanh"
          [[ "$s" == fail ]] && state="đã đỏ"
          break
        fi
      done
    fi
    echo "  $name [$fp] $state"
  done
  exit 0
fi

begin_evidence

LOW=(nice -n 10)
command -v ionice >/dev/null 2>&1 && LOW=(ionice -c 2 -n 7 nice -n 10)
export DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_NOLOGO=1

# Thiếu script local thì target đỏ kèm lý do, không chặn các target khác.
run_target() {
  local kind="$1"
  shift
  case "$kind" in
    lockfile) "${LOW[@]}" pnpm install --frozen-lockfile ;;
    backend)
      [[ -f backend/fast-build.sh ]] || { echo "ci-parity: thiếu backend/fast-build.sh"; return 1; }
      local proj="$1"
      shift
      "${LOW[@]}" bash backend/fast-build.sh "$proj" -m:4 /nodeReuse:false "$@"
      ;;
    frontend)
      [[ -f frontend/fast-check.sh ]] || { echo "ci-parity: thiếu frontend/fast-check.sh"; return 1; }
      "${LOW[@]}" bash frontend/fast-check.sh "$@"
      ;;
  esac
}

FAILED=0
mode="$([[ $SCOPED_MODE == 1 ]] && echo scoped || echo full)"
for i in "${!T_NAME[@]}"; do
  name="${T_NAME[$i]}"
  kind="${T_KIND[$i]}"
  read -r -a roots <<< "${T_ROOTS[$i]}"
  fp="$(fingerprint "$kind" "${roots[@]}")"
  if (( SCOPED_MODE )); then
    key="$CACHE_DIR/scoped_${name//[:\/]/_}-$fp"
  else
    key="$CACHE_DIR/${name//[:\/]/_}-$fp"
  fi
  target_file="$LOG_DIR/${name//[:\/]/_}.target.json"

  skip_cache=0
  (( FORCE )) && skip_cache=1
  if (( PROFILE )) && [[ "$kind" == backend ]]; then
    skip_cache=1
  fi

  if (( ! skip_cache )); then
    for cached_status in ok fail; do
      if [[ -f "$key.$cached_status" ]] && evidence cache "$key.$cached_status" "$name" "$fp" "$mode" "$CURRENT_IDENTITY" > "$target_file.tmp" 2>/dev/null; then
        mv "$target_file.tmp" "$target_file"
        echo "[cached] $name $cached_status"
        [[ "$cached_status" != fail ]] || FAILED=1
        break
      fi
    done
    rm -f "$target_file.tmp"
    [[ ! -f "$target_file" ]] || continue
  fi

  runtime_log="$RUNTIME_LOG_DIR/${name//[:\/]/_}.log"
  durable_log="$LOG_DIR/${name//[:\/]/_}.log"
  runtime_binlog="$ROOT/$RUNTIME_LOG_DIR/${name//[:\/]/_}.binlog"
  durable_binlog="$LOG_DIR/${name//[:\/]/_}.binlog"

  read -r -a args <<< "${T_ARGS[$i]}"
  run_args=("${args[@]}")
  if (( PROFILE )) && [[ "$kind" == backend ]]; then
    run_args+=("-bl:$runtime_binlog")
  fi

  start_ms=$(date +%s%3N)
  target_rc=0
  run_target "$kind" "${run_args[@]}" > "$runtime_log" 2>&1 || target_rc=$?
  end_ms=$(date +%s%3N)
  duration_ms=$(( end_ms - start_ms ))
  (( duration_ms < 0 )) && duration_ms=0
  secs=$(( duration_ms / 1000 ))

  mv "$runtime_log" "$durable_log"

  target_binlog_ref=""
  if (( PROFILE )) && [[ "$kind" == backend ]]; then
    if [[ -f "$runtime_binlog" ]]; then
      mv "$runtime_binlog" "$durable_binlog"
      target_binlog_ref="$durable_binlog"
    elif (( target_rc == 0 )); then
      echo "ci-parity: thiếu file binlog sau khi build thành công: $runtime_binlog" >> "$durable_log"
      target_rc=1
    fi
  fi

  if (( target_rc == 0 )); then
    echo "[run]    $name PASS ${secs}s"
    evidence target "$target_file" "$name" "$fp" pass "$durable_log" "$secs" "$duration_ms" "$target_binlog_ref"
  else
    echo "[run]    $name FAIL ${secs}s"
    tail -n 40 "$durable_log" | sed 's/^/    /'
    evidence target "$target_file" "$name" "$fp" fail "$durable_log" "$secs" "$duration_ms" "$target_binlog_ref"
    FAILED=1
  fi
done

status="pass"
(( FAILED )) && status="fail"

publish_evidence "$status"
echo "ci-parity: $status (${#T_NAME[@]} target, base ${BASE_SHA:0:9}) - $LOG_DIR/summary.json"
exit "$FAILED"
