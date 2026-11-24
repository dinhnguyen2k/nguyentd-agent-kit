#!/usr/bin/env node
/**
 * Thu gọn và thống nhất các tệp phân tích, kế hoạch, báo cáo và bản nháp cũ quá N ngày (mặc định 10 ngày).
 * Bảo vệ cứng:
 *   - `.planning/codebase/**` và `.planning/errors/**` (kiến trúc sống & sổ lỗi sống)
 *   - `.agent/scratch/.runtime/**` (trạng thái phiên đang chạy)
 *   - Toàn bộ cấu hình nguồn của `.agent/` (`agents`, `contracts`, `evals`, `harness`, `knowledge`, `quarantine`, `rules`, `scripts`, `skills`, `workflows`)
 *
 * Cách dùng:
 *   node .agent/scripts/prune-agent-state.mjs [--days 10] [--check] [--no-treehouse] [--json]
 */
import { execFileSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(HERE, "..", "..");
const MS_PER_DAY = 86_400_000;

function parseArgs(argv) {
  const opts = {
    root: DEFAULT_ROOT,
    days: 10,
    checkOnly: false,
    includeTreehouse: true,
    json: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--check" || a === "--dry-run") {
      opts.checkOnly = true;
    } else if (a === "--no-treehouse") {
      opts.includeTreehouse = false;
    } else if (a === "--json") {
      opts.json = true;
    } else if (a === "--days" && argv[i + 1]) {
      const val = Number(argv[++i]);
      if (!Number.isFinite(val) || val < 1) {
        throw new Error(`Số ngày không hợp lệ: ${val}`);
      }
      opts.days = val;
    } else if (a.startsWith("--days=")) {
      const val = Number(a.slice("--days=".length));
      if (!Number.isFinite(val) || val < 1) {
        throw new Error(`Số ngày không hợp lệ: ${val}`);
      }
      opts.days = val;
    } else if (a === "--root" && argv[i + 1]) {
      opts.root = resolve(argv[++i]);
    } else {
      throw new Error(`Tham số không hợp lệ: ${a}`);
    }
  }
  return opts;
}

function safeLstat(p) {
  try {
    return lstatSync(p);
  } catch {
    return null;
  }
}

function measureTree(targetPath) {
  const st = safeLstat(targetPath);
  if (!st || st.isSymbolicLink()) return { files: 0, bytes: 0, newestMtimeMs: 0 };
  if (st.isFile()) return { files: 1, bytes: st.size, newestMtimeMs: st.mtimeMs };
  if (!st.isDirectory()) return { files: 0, bytes: 0, newestMtimeMs: 0 };

  let files = 0;
  let bytes = 0;
  let newestMtimeMs = 0;
  for (const name of readdirSync(targetPath)) {
    const sub = measureTree(join(targetPath, name));
    files += sub.files;
    bytes += sub.bytes;
    if (sub.newestMtimeMs > newestMtimeMs) newestMtimeMs = sub.newestMtimeMs;
  }
  return { files, bytes, newestMtimeMs };
}

function removePath(targetPath, checkOnly, stats, bucket) {
  const st = safeLstat(targetPath);
  if (!st || st.isSymbolicLink()) return false;
  const info = measureTree(targetPath);
  if (!checkOnly) {
    rmSync(targetPath, { recursive: true, force: true });
  }
  stats.deletedFiles += info.files;
  stats.deletedBytes += info.bytes;
  stats.deletedEntries += 1;
  if (bucket) {
    bucket.deletedFiles += info.files;
    bucket.deletedBytes += info.bytes;
    bucket.deletedEntries += 1;
  }
  return true;
}

function pruneOldFilesRecursively(dirPath, cutoffMs, checkOnly, stats, bucket, protectedNames = new Set()) {
  const st = safeLstat(dirPath);
  if (!st || st.isSymbolicLink() || !st.isDirectory()) return;

  for (const name of readdirSync(dirPath)) {
    if (protectedNames.has(name)) continue;
    const full = join(dirPath, name);
    const childSt = safeLstat(full);
    if (!childSt || childSt.isSymbolicLink()) continue;

    if (childSt.isDirectory()) {
      pruneOldFilesRecursively(full, cutoffMs, checkOnly, stats, bucket);
      const after = readdirSync(full);
      if (after.length === 0) {
        if (!checkOnly) rmSync(full, { recursive: true, force: true });
        stats.deletedEntries += 1;
        if (bucket) bucket.deletedEntries += 1;
      }
    } else if (childSt.isFile()) {
      if (childSt.mtimeMs < cutoffMs) {
        removePath(full, checkOnly, stats, bucket);
      } else {
        stats.keptFiles += 1;
        if (bucket) bucket.keptFiles += 1;
      }
    }
  }
}

function pruneDirByNewest(containerDir, cutoffMs, checkOnly, stats, bucket, skipNames = new Set()) {
  const st = safeLstat(containerDir);
  if (!st || st.isSymbolicLink() || !st.isDirectory()) return;

  for (const name of readdirSync(containerDir)) {
    if (skipNames.has(name)) continue;
    const full = join(containerDir, name);
    const childSt = safeLstat(full);
    if (!childSt || childSt.isSymbolicLink()) continue;

    const info = measureTree(full);
    if (info.files === 0 || info.newestMtimeMs < cutoffMs) {
      removePath(full, checkOnly, stats, bucket);
    } else {
      stats.keptFiles += info.files;
      if (bucket) bucket.keptFiles += info.files;
    }
  }
}

function atomicWriteText(filePath, content) {
  const tmpPath = join(dirname(filePath), `.${basename(filePath)}.prune.${process.pid}.tmp`);
  writeFileSync(tmpPath, content, "utf8");
  renameSync(tmpPath, filePath);
}

function pruneTimestampedLog(filePath, cutoffMs, mode, checkOnly) {
  const st = safeLstat(filePath);
  if (!st || st.isSymbolicLink() || !st.isFile()) {
    return { trimmedLines: 0, remainingLines: 0, freedBytes: 0 };
  }
  const raw = readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/);
  const kept = [];
  let trimmedLines = 0;

  for (const line of lines) {
    if (!line.trim()) continue;
    let tsMs = NaN;
    if (mode === "guard-log") {
      const m = line.match(/^(\d{4}-\d{2}-\d{2}T\S+)/);
      if (m) tsMs = Date.parse(m[1]);
    } else if (mode === "friction-jsonl") {
      try {
        const obj = JSON.parse(line);
        if (obj?.at) tsMs = Date.parse(obj.at);
      } catch {
        tsMs = NaN;
      }
    }
    if (Number.isFinite(tsMs) && tsMs < cutoffMs) {
      trimmedLines += 1;
    } else {
      kept.push(line);
    }
  }

  let freedBytes = 0;
  if (trimmedLines > 0) {
    const nextText = kept.length > 0 ? `${kept.join("\n")}\n` : "";
    freedBytes = Math.max(0, Buffer.byteLength(raw, "utf8") - Buffer.byteLength(nextText, "utf8"));
    if (!checkOnly) {
      atomicWriteText(filePath, nextText);
    }
  }
  return { trimmedLines, remainingLines: kept.length, freedBytes };
}

function hasTrackedFilesUnder(repoRoot, relDir) {
  try {
    const out = execFileSync("git", ["-C", repoRoot, "ls-files", relDir], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5000,
    }).trim();
    return out.length > 0;
  } catch {
    // Fail-safe: nếu không kiểm tra được git thì xem như được theo dõi để không xóa nhầm.
    return true;
  }
}

function pruneSingleRoot(targetRoot, cutoffMs, checkOnly, isPrimaryRoot) {
  const stats = {
    root: targetRoot,
    deletedFiles: 0,
    deletedBytes: 0,
    deletedEntries: 0,
    keptFiles: 0,
    trimmedGuardLines: 0,
    remainingGuardLines: 0,
    trimmedFrictionLines: 0,
    remainingFrictionLines: 0,
    categories: {},
  };

  const bucket = (name) => {
    if (!stats.categories[name]) {
      stats.categories[name] = { deletedFiles: 0, deletedBytes: 0, deletedEntries: 0, keptFiles: 0 };
    }
    return stats.categories[name];
  };

  // 1. .agent/archive: bỏ hẳn kho lưu trữ cũ
  const archiveDir = join(targetRoot, ".agent", "archive");
  const archiveSt = safeLstat(archiveDir);
  if (archiveSt && !archiveSt.isSymbolicLink()) {
    removePath(archiveDir, checkOnly, stats, bucket("archive"));
  }

  // 2. .github: chỉ dọn khi hoàn toàn không được Git theo dõi
  const githubDir = join(targetRoot, ".github");
  const githubSt = safeLstat(githubDir);
  if (githubSt && !githubSt.isSymbolicLink() && githubSt.isDirectory() && !hasTrackedFilesUnder(targetRoot, ".github")) {
    pruneOldFilesRecursively(githubDir, cutoffMs, checkOnly, stats, bucket("github"));
    const remaining = readdirSync(githubDir);
    if (remaining.length === 0) {
      if (!checkOnly) rmSync(githubDir, { recursive: true, force: true });
      stats.deletedEntries += 1;
      bucket("github").deletedEntries += 1;
    }
  }

  // 3. .planning: BẢO VỆ TUYỆT ĐỐI `codebase` và `errors`; dọn phần còn lại quá hạn
  const planningDir = join(targetRoot, ".planning");
  const planningSt = safeLstat(planningDir);
  if (planningSt && !planningSt.isSymbolicLink() && planningSt.isDirectory()) {
    pruneDirByNewest(planningDir, cutoffMs, checkOnly, stats, bucket("planning"), new Set(["codebase", "errors"]));
  }

  // 4. .agent/planning/<slug>: hết hạn theo tệp mới nhất trong mỗi thư mục kế hoạch
  const agentPlanningDir = join(targetRoot, ".agent", "planning");
  pruneDirByNewest(agentPlanningDir, cutoffMs, checkOnly, stats, bucket("agent-planning"));

  // 5. .agent/artifacts
  const artifactsDir = join(targetRoot, ".agent", "artifacts");
  pruneDirByNewest(artifactsDir, cutoffMs, checkOnly, stats, bucket("artifacts"));

  // 6. .agent/task-manifests
  const manifestsDir = join(targetRoot, ".agent", "task-manifests");
  pruneDirByNewest(manifestsDir, cutoffMs, checkOnly, stats, bucket("task-manifests"));

  // 7. .agent/reports
  const reportsDir = join(targetRoot, ".agent", "reports");
  const reportsSt = safeLstat(reportsDir);
  if (reportsSt && !reportsSt.isSymbolicLink() && reportsSt.isDirectory()) {
    const repBucket = bucket("reports");
    const guardLog = join(reportsDir, "boundary-guard.log");
    const frictionLog = join(reportsDir, "agent-friction.jsonl");

    const guardTrim = pruneTimestampedLog(guardLog, cutoffMs, "guard-log", checkOnly);
    const frictionTrim = pruneTimestampedLog(frictionLog, cutoffMs, "friction-jsonl", checkOnly);
    if (isPrimaryRoot) {
      stats.trimmedGuardLines = guardTrim.trimmedLines;
      stats.remainingGuardLines = guardTrim.remainingLines;
      stats.trimmedFrictionLines = frictionTrim.trimmedLines;
      stats.remainingFrictionLines = frictionTrim.remainingLines;
    }
    stats.deletedBytes += guardTrim.freedBytes + frictionTrim.freedBytes;
    repBucket.deletedBytes += guardTrim.freedBytes + frictionTrim.freedBytes;

    const ciLogsDir = join(reportsDir, "ci-parity", "logs");
    pruneDirByNewest(ciLogsDir, cutoffMs, checkOnly, stats, repBucket);

    const ciCacheDir = join(reportsDir, "ci-parity", "cache");
    pruneDirByNewest(ciCacheDir, cutoffMs, checkOnly, stats, repBucket);

    const ciDir = join(reportsDir, "ci-parity");
    pruneDirByNewest(ciDir, cutoffMs, checkOnly, stats, repBucket, new Set(["logs", "cache"]));

    pruneDirByNewest(
      reportsDir,
      cutoffMs,
      checkOnly,
      stats,
      repBucket,
      new Set(["boundary-guard.log", "agent-friction.jsonl", "ci-parity"])
    );
  }

  // 8. .agent/scratch: BẢO VỆ CỨNG `.runtime`
  const scratchDir = join(targetRoot, ".agent", "scratch");
  pruneOldFilesRecursively(scratchDir, cutoffMs, checkOnly, stats, bucket("scratch"), new Set([".runtime"]));

  return stats;
}

function discoverTreehouseWorktrees(primaryRoot) {
  const base = join(homedir(), ".treehouse");
  if (!existsSync(base)) return [];

  const found = new Set();
  const skipWalk = new Set([".git", "node_modules", ".agent", ".planning", "backend", "frontend", ".omp", ".agents", ".claude"]);

  function walk(dir, depth) {
    if (depth > 6) return;
    const st = safeLstat(dir);
    if (!st || st.isSymbolicLink() || !st.isDirectory()) return;

    const dotAgent = safeLstat(join(dir, ".agent"));
    const dotPlanning = safeLstat(join(dir, ".planning"));
    if ((dotAgent && !dotAgent.isSymbolicLink() && dotAgent.isDirectory()) ||
        (dotPlanning && !dotPlanning.isSymbolicLink() && dotPlanning.isDirectory())) {
      const resolved = resolve(dir);
      if (resolved !== resolve(primaryRoot)) {
        found.add(resolved);
      }
      return;
    }

    for (const name of readdirSync(dir)) {
      if (skipWalk.has(name)) continue;
      if (name.startsWith("harness-shared-backup.") || name.startsWith("harness-sync-backup.")) continue;
      walk(join(dir, name), depth + 1);
    }
  }

  walk(base, 0);
  return [...found].sort();
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const cutoffMs = Date.now() - opts.days * MS_PER_DAY;
  const targets = [opts.root];
  if (opts.includeTreehouse) {
    targets.push(...discoverTreehouseWorktrees(opts.root));
  }

  const perRoot = targets.map((t, idx) => pruneSingleRoot(t, cutoffMs, opts.checkOnly, idx === 0));
  const summary = {
    ok: true,
    mode: opts.checkOnly ? "check" : "apply",
    days: opts.days,
    totalDeletedFiles: perRoot.reduce((acc, r) => acc + r.deletedFiles, 0),
    totalDeletedBytes: perRoot.reduce((acc, r) => acc + r.deletedBytes, 0),
    totalDeletedEntries: perRoot.reduce((acc, r) => acc + r.deletedEntries, 0),
    totalKeptFiles: perRoot.reduce((acc, r) => acc + r.keptFiles, 0),
    trimmedGuardLines: perRoot[0]?.trimmedGuardLines || 0,
    remainingGuardLines: perRoot[0]?.remainingGuardLines || 0,
    trimmedFrictionLines: perRoot[0]?.trimmedFrictionLines || 0,
    remainingFrictionLines: perRoot[0]?.remainingFrictionLines || 0,
    roots: perRoot,
  };

  if (opts.json) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  console.log(
    `=== Dọn trạng thái & tài liệu quá ${opts.days} ngày (${opts.checkOnly ? "KIỂM TRA" : "ĐÃ DỌN"}) ===`
  );
  for (const r of perRoot) {
    const mb = (r.deletedBytes / (1024 * 1024)).toFixed(2);
    console.log(
      `- ${r.root}: xóa ${r.deletedFiles} tệp (${mb} MB, ${r.deletedEntries} mục) | giữ ${r.keptFiles} tệp`
    );
    if (r.trimmedGuardLines > 0 || r.trimmedFrictionLines > 0) {
      console.log(
        `  log cắt >${opts.days} ngày: guard -${r.trimmedGuardLines} dòng (còn ${r.remainingGuardLines}), friction -${r.trimmedFrictionLines} dòng (còn ${r.remainingFrictionLines})`
      );
    }
  }
}

try {
  main();
} catch (err) {
  console.error(`✖ ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
