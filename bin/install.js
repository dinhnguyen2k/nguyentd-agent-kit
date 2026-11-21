#!/usr/bin/env node

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const sourceDir = path.resolve(__dirname, '..');
let targetDir = process.cwd();
const rawArgs = process.argv.slice(2);

let coreMode = false;
let updateMode = false;
let dryRun = false;
let noUpdater = false;

function printHelp() {
  console.log(`NguyenTD Agent Kit - Bộ cài đặt quy tắc, kỹ năng và điều phối Agent

Cách dùng:
  nguyentd-agent-kit [thư_mục_đích] [tùy_chọn]
  agent-init [thư_mục_đích] [tùy_chọn]

Tùy chọn:
  --target <đường_dẫn>, -t  Chỉ định thư mục cài đặt (mặc định: thư mục hiện tại)
  --update, --force         Cập nhật các tệp đã có và tự động sao lưu bản cũ
  --core                    Chỉ cài bản thu gọn (.agent-core, hướng dẫn phối hợp)
  --dry-run                 Chạy thử nghiệm xem trước, không ghi đè lên đĩa
  --no-updater              Không tự động kích hoạt tiến trình chạy ngầm agent-updater
  --help, -h                Hiển thị hướng dẫn này
`);
}

for (let i = 0; i < rawArgs.length; i++) {
  const arg = rawArgs[i];
  if (arg === '--core') {
    coreMode = true;
  } else if (arg === '--update' || arg === '--force') {
    updateMode = true;
  } else if (arg === '--dry-run') {
    dryRun = true;
  } else if (arg === '--no-updater' || arg === '--skip-updater') {
    noUpdater = true;
  } else if (arg === '--target' || arg === '-t') {
    i++;
    if (i < rawArgs.length) targetDir = path.resolve(rawArgs[i]);
  } else if (arg.startsWith('--target=')) {
    targetDir = path.resolve(arg.slice('--target='.length));
  } else if (arg === '--help' || arg === '-h') {
    printHelp();
    process.exit(0);
  } else if (!arg.startsWith('-')) {
    targetDir = path.resolve(arg);
  } else {
    console.error(`✖ Tùy chọn không hợp lệ: ${arg}`);
    printHelp();
    process.exit(1);
  }
}

const legacyItems = [
  'AI_RULES.md',
  'OPINION.md',
  'AGENTS.md',
  '.agent',
];

const rootSymlinks = [
  { destination: 'CLAUDE.md', target: 'AGENTS.md' },
  { destination: 'GEMINI.md', target: 'AGENTS.md' },
  { destination: 'ANTIGRAVITY.md', target: 'AGENTS.md' },
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
  if (!fs.existsSync(targetDir)) {
    if (!dryRun) fs.mkdirSync(targetDir, { recursive: true });
  }
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
  if (!coreMode) {
    installRootSymlinks();
  }
  const wiringScript = path.join(targetDir, '.agent', 'scripts', 'install-harness-wiring.sh');
  if (!coreMode && !dryRun && !hasErrors && fs.existsSync(wiringScript)) {
    console.log('\n🔗 Đang thiết lập cấu hình harness wiring (.claude, .gemini, .cursor, .vscode)...');
    try {
      execFileSync('bash', [wiringScript], { cwd: targetDir, stdio: 'inherit' });
    } catch (err) {
      console.warn('⚠ Lỗi khi chạy install-harness-wiring.sh:', err.message);
    }
  }
  return hasErrors;
}

function installRootSymlinks() {
  if (coreMode || dryRun) return;
  for (const { destination, target } of rootSymlinks) {
    const destPath = path.join(targetDir, destination);
    const existing = destinationState(destPath);
    if (!existing) {
      fs.symlinkSync(target, destPath);
      console.log(`✔ Đã tạo liên kết: ${destination} -> ${target}`);
    } else if (existing.kind === 'link') {
      if (existing.linkTarget !== target && updateMode) {
        fs.unlinkSync(destPath);
        fs.symlinkSync(target, destPath);
        console.log(`✔ Đã cập nhật liên kết: ${destination} -> ${target}`);
      }
    } else if (existing.kind === 'file' && updateMode) {
      backupExistingEntry(destPath, destination, existing.kind);
      fs.unlinkSync(destPath);
      fs.symlinkSync(target, destPath);
      console.log(`✔ Đã thay thế tệp cũ bằng liên kết: ${destination} -> ${target}`);
    }
  }
}

function triggerAgentUpdater(targetDir) {
  if (process.env.AGENT_UPDATER_SKIP) return;
  console.log('\n⚡ Đang cấu hình và kích hoạt tiến trình tự động nâng cấp agent-updater...');

  const localBin = path.join(os.homedir(), '.local', 'bin', 'agent-updater');
  let binCmd = null;
  let binArgs = [];

  if (fs.existsSync(localBin)) {
    binCmd = localBin;
  } else {
    try {
      const whichOut = execFileSync('which', ['agent-updater'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      if (whichOut && fs.existsSync(whichOut)) {
        binCmd = whichOut;
      }
    } catch {
      // ignore
    }
  }

  if (!binCmd) {
    const devSibling = path.resolve(sourceDir, '..', 'cogain', 'agent-updater', 'bin', 'agent-updater');
    if (fs.existsSync(devSibling)) {
      binCmd = devSibling;
    }
  }

  if (!binCmd) {
    binCmd = 'npx';
    binArgs = ['-y', 'github:dinhnguyen2k/agent-updater'];
  }

  try {
    const finalArgs = [...binArgs, 'init', '--target', targetDir];
    execFileSync(binCmd, finalArgs, {
      stdio: 'inherit',
      env: { ...process.env, AGENT_UPDATER_SKIP: '1' },
    });
    console.log('\n✔ Hệ thống Agent và tiến trình agent-updater đã sẵn sàng hoạt động!');
  } catch (err) {
    console.warn(`\n⚠ Lưu ý: Chưa thể tự động kích hoạt dịch vụ chạy ngầm (${err.message}).`);
    console.warn(`  Bạn có thể kích hoạt sau bằng lệnh: npx -y github:dinhnguyen2k/agent-updater init --target "${targetDir}"`);
  }
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
  const hasErrors = installItems(items, !coreMode);
  if (hasErrors) {
    process.exitCode = 1;
  } else if (!coreMode && !dryRun && !noUpdater) {
    triggerAgentUpdater(targetDir);
  }
} catch (error) {
  reportError(error.message);
  process.exitCode = 1;
}
