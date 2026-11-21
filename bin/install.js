#!/usr/bin/env node

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const sourceDir = path.resolve(__dirname, '..');
const targetDir = process.cwd();
const rawArgs = process.argv.slice(2);
const allowedFlags = new Set(['--core', '--update', '--dry-run']);
const hasInvalidArguments = rawArgs.some((arg) => !allowedFlags.has(arg));
const coreMode = rawArgs.includes('--core');
const updateMode = rawArgs.includes('--update');
const dryRun = rawArgs.includes('--dry-run');

const legacyItems = [
  'AI_RULES.md',
  'OPINION.md',
  'AGENTS.md',
  'GEMINI.md',
  'CLAUDE.md',
  'ANTIGRAVITY.md',
  '.agent',
];
const privateDirectoryNames = new Set([
  '.config',
  'archive',
  'scratch',
  'reports',
  'planning',
  'artifacts',
  'task-manifests',
  '__pycache__',
  'node_modules',
]);
const researchFiles = [
  'SKILL.md',
  'references/lookup.md',
  'references/focused.md',
  'references/deep.md',
];
const projectEntryFiles = new Set([
  'AGENTS.md',
  'CLAUDE.md',
  'GEMINI.md',
  'ANTIGRAVITY.md',
]);

let activeBackupDir = null;

function isWithin(parent, child) {
  return child === parent || child.startsWith(`${parent}${path.sep}`);
}

function reportError(message) {
  console.error(`✖ ${message}`);
}

function ensureTargetOutsideKit() {
  const realSource = fs.realpathSync(sourceDir);
  const realTarget = fs.realpathSync(targetDir);
  if (isWithin(realSource, realTarget)) {
    throw new Error('Thư mục cài đặt không được là thư mục kit hoặc nằm bên trong kit.');
  }
}

function getBackupRoot() {
  if (activeBackupDir) return activeBackupDir;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const base = coreMode && !fs.existsSync(path.join(targetDir, '.agent'))
    ? path.join(targetDir, '.agent-core', '.backups')
    : path.join(targetDir, '.agent', 'scratch', 'kit-backups');
  activeBackupDir = path.join(base, stamp);
  return activeBackupDir;
}

function backupExistingEntry(destination, relativePath, existingKind) {
  if (dryRun) return;
  const backupPath = path.join(getBackupRoot(), relativePath);
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  if (existingKind === 'link') {
    fs.symlinkSync(fs.readlinkSync(destination), backupPath);
  } else if (existingKind === 'file') {
    fs.copyFileSync(destination, backupPath);
  }
}

function sourceKind(source) {
  let stats;
  try {
    stats = fs.lstatSync(source);
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error(`Thiếu nguồn: ${path.relative(sourceDir, source)}`);
    throw error;
  }

  const realParent = fs.realpathSync(path.dirname(source));
  if (!isWithin(fs.realpathSync(sourceDir), realParent)) {
    throw new Error(`Thư mục cha của nguồn nằm ngoài kit: ${source}`);
  }

  if (stats.isSymbolicLink()) {
    const linkTarget = fs.readlinkSync(source);
    if (path.isAbsolute(linkTarget)) throw new Error(`Liên kết nguồn không dùng đường dẫn tương đối: ${source}`);
    const resolvedTarget = path.resolve(path.dirname(source), linkTarget);
    if (!isWithin(sourceDir, resolvedTarget)) throw new Error(`Liên kết nguồn trỏ ra ngoài kit: ${source}`);
    const realTarget = fs.realpathSync(resolvedTarget);
    if (!isWithin(fs.realpathSync(sourceDir), realTarget)) {
      throw new Error(`Liên kết nguồn dẫn ra ngoài kit: ${source}`);
    }
    return { kind: 'link', linkTarget };
  }
  if (stats.isDirectory()) return { kind: 'directory' };
  if (stats.isFile()) return { kind: 'file', mode: stats.mode };
  throw new Error(`Loại mục nguồn không được hỗ trợ: ${source}`);
}

function destinationState(destination) {
  try {
    const stats = fs.lstatSync(destination);
    if (stats.isSymbolicLink()) return { kind: 'link', linkTarget: fs.readlinkSync(destination) };
    if (stats.isDirectory()) return { kind: 'directory' };
    if (stats.isFile()) return { kind: 'file' };
    return { kind: 'other' };
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function ensureSafeDestinationAncestors(destination) {
  const relative = path.relative(targetDir, path.dirname(destination));
  let current = targetDir;
  for (const part of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    const state = destinationState(current);
    if (state && state.kind !== 'directory') {
      throw new Error(`Bị chặn vì không phải thư mục hoặc là liên kết: ${path.relative(targetDir, current)}`);
    }
    if (!state && !dryRun) fs.mkdirSync(current);
  }
}

function filesEqual(source, destination) {
  const sourceBytes = fs.readFileSync(source);
  const destinationBytes = fs.readFileSync(destination);
  return sourceBytes.equals(destinationBytes);
}

function installEntry(source, destination, relativePath, skipsPrivate) {
  const sourceEntry = sourceKind(source);
  const kind = sourceEntry.kind;
  if (skipsPrivate && kind === 'directory' && privateDirectoryNames.has(path.basename(source))) {
    return new Set(['skipped']);
  }

  ensureSafeDestinationAncestors(destination);
  const existing = destinationState(destination);
  if (kind === 'link') {
    if (!existing) {
      if (!dryRun) fs.symlinkSync(sourceEntry.linkTarget, destination);
      return new Set(['installed']);
    }
    if (existing.kind === 'link' && existing.linkTarget === sourceEntry.linkTarget) return new Set(['identical']);
    if (updateMode && existing.kind !== 'directory' && !(coreMode && projectEntryFiles.has(relativePath))) {
      backupExistingEntry(destination, relativePath, existing.kind);
      if (!dryRun) {
        fs.unlinkSync(destination);
        fs.symlinkSync(sourceEntry.linkTarget, destination);
      }
      return new Set(['updated']);
    }
    throw new Error(`Mục đã tồn tại nhưng khác nguồn: ${relativePath}`);
  }
  if (kind === 'directory') {
    if (existing && existing.kind !== 'directory') throw new Error(`Bị chặn vì không phải thư mục: ${relativePath}`);
    if (!existing && !dryRun) fs.mkdirSync(destination);
    const result = new Set(existing ? ['identical'] : ['installed']);
    for (const child of fs.readdirSync(source)) {
      const childPath = path.join(relativePath, child);
      try {
        const childResult = installEntry(
          path.join(source, child),
          path.join(destination, child),
          childPath,
          skipsPrivate,
        );
        for (const status of childResult) result.add(status);
      } catch (error) {
        result.add('failed');
        reportError(`${childPath}: ${error.message}`);
      }
    }
    return result;
  }
  if (existing) {
    if (existing.kind === 'file' && filesEqual(source, destination)) return new Set(['identical']);
    // Ở chế độ --core, không ghi đè AGENTS.md riêng của dự án khác để bảo toàn hướng dẫn nội bộ dự án đó.
    if (updateMode && existing.kind === 'file' && !(coreMode && projectEntryFiles.has(relativePath))) {
      backupExistingEntry(destination, relativePath, existing.kind);
      if (!dryRun) {
        fs.copyFileSync(source, destination);
        fs.chmodSync(destination, sourceEntry.mode);
      }
      return new Set(['updated']);
    }
    throw new Error(`Tệp đã tồn tại nhưng khác nguồn: ${relativePath}`);
  }
  if (!dryRun) {
    fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL);
    fs.chmodSync(destination, sourceEntry.mode);
  }
  return new Set(['installed']);
}

function installItems(items, skipsPrivate) {
  let hasErrors = false;
  for (const item of items) {
    const source = path.join(sourceDir, item.source);
    const destination = path.join(targetDir, item.destination);
    try {
      const result = installEntry(source, destination, item.destination, skipsPrivate);
      if (result.has('failed')) {
        hasErrors = true;
        console.error(`⚠ Có mục không cài được trong ${item.destination}; xem lỗi ở trên.`);
      } else if (result.has('updated') && result.has('installed')) {
        console.log(`✔ ${dryRun ? '[Xem trước] Sẽ thêm và cập nhật' : 'Đã thêm và cập nhật'} các mục trong ${item.destination}`);
      } else if (result.has('updated')) {
        console.log(`✔ ${dryRun ? '[Xem trước] Sẽ cập nhật' : 'Đã cập nhật'} các mục trong ${item.destination}`);
      } else if (result.has('installed')) {
        console.log(`✔ ${dryRun ? '[Xem trước] Sẽ thêm' : 'Đã thêm hoặc xác nhận'} các mục trong ${item.destination}`);
      } else if (result.has('skipped')) {
        console.log(`↷ Đã bỏ qua một số thư mục trạng thái riêng trong ${item.destination}`);
      } else {
        console.log(`✔ Đã đồng bộ sẵn: ${item.destination}`);
      }
    } catch (error) {
      hasErrors = true;
      reportError(`${item.destination}: ${error.message}`);
      if (coreMode && projectEntryFiles.has(item.destination)) {
        console.error('  Cần thêm thủ công vào tệp điều hướng hiện có:');
        console.error('  Đọc `.agent-core/team.md` để biết khi nào giao việc cho Researcher.');
      }
    }
  }
  if (activeBackupDir && !dryRun) {
    console.log(`↺ Đã sao lưu các tệp cũ trước khi ghi đè tại: ${path.relative(targetDir, activeBackupDir)}`);
  }
  const wiringScript = path.join(targetDir, '.agent', 'scripts', 'install-harness-wiring.sh');
  if (updateMode && !coreMode && !dryRun && !hasErrors && fs.existsSync(wiringScript)) {
    execFileSync('bash', [wiringScript], { cwd: targetDir, stdio: 'inherit' });
  }
  return hasErrors;
}

function coreItems() {
  const corePath = path.join(sourceDir, 'core');
  try {
    const stats = fs.lstatSync(corePath);
    if (!stats.isDirectory()) {
      reportError('core: Nguồn core phải là một thư mục.');
      process.exitCode = 1;
      return [];
    }
    return fs.readdirSync(corePath).map((name) => ({
      source: path.join('core', name),
      destination: name,
    }));
  } catch (error) {
    if (error.code === 'ENOENT') {
      reportError('core: Thiếu nguồn.');
      process.exitCode = 1;
      return [];
    }
    reportError(`core: ${error.message}`);
    process.exitCode = 1;
    return [];
  }
}

if (hasInvalidArguments) {
  reportError('Cách dùng: node bin/install.js [--core] [--update] [--dry-run]');
  process.exitCode = 1;
} else {
  try {
    ensureTargetOutsideKit();
    const items = coreMode
      ? [
          ...coreItems(),
          ...researchFiles.map((file) => ({
            source: path.join('.agent', 'skills', 'research', file),
            destination: path.join('.agent-core', 'research', file),
          })),
        ]
      : legacyItems.map((item) => ({ source: item, destination: item }));
    if (installItems(items, !coreMode)) process.exitCode = 1;
  } catch (error) {
    reportError(error.message);
    process.exitCode = 1;
  }
}
