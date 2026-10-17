#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const sourceDir = path.resolve(__dirname, '..');
const targetDir = process.cwd();

console.log('Đang cài đặt NguyenTD PHP Agent Kit vào thư mục hiện tại...');

const itemsToCopy = [
  'AI_RULES.md',
  'OPINION.md',
  'AGENTS.md',
  '.agent',
];

function copyRecursive(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.lstatSync(src);
  const isDirectory = exists && stats.isDirectory();
  const isSymbolicLink = exists && stats.isSymbolicLink();

  if (isSymbolicLink) {
    const linkTarget = fs.readlinkSync(src);
    if (fs.existsSync(dest)) fs.unlinkSync(dest);
    fs.symlinkSync(linkTarget, dest);
  } else if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((child) => {
      copyRecursive(path.join(src, child), path.join(dest, child));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

for (const item of itemsToCopy) {
  const src = path.join(sourceDir, item);
  const dest = path.join(targetDir, item);
  if (sourceDir !== targetDir && fs.existsSync(src)) {
    try {
      copyRecursive(src, dest);
      console.log(`Đã sao chép: ${item}`);
    } catch (err) {
      console.error(`Lỗi khi chép ${item}:`, err.message);
      process.exitCode = 1;
    }
  }
}

if (!process.exitCode) {
  try {
    execFileSync('bash', ['.agent/scripts/install-harness-wiring.sh'], {
      cwd: targetDir,
      env: { ...process.env, AGENT_PROJECT_DIR: targetDir },
      stdio: 'inherit',
    });
    console.log('Cài đặt hoàn tất: PHP/PDO/MySQL skills, rules, workflows và harness links.');
  } catch (err) {
    console.error('Không thể cài harness wiring:', err.message);
    process.exitCode = 1;
  }
}
