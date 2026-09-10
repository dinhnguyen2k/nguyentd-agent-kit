#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const sourceDir = path.resolve(__dirname, '..');
const targetDir = process.cwd();

console.log('\x1b[36m%s\x1b[0m', '🌸 Đang cài đặt NguyenTD Agent Kit vào thư mục hiện tại...');

const itemsToCopy = [
  'AI_RULES.md',
  'OPINION.md',
  'AGENTS.md',
  'GEMINI.md',
  'CLAUDE.md',
  'ANTIGRAVITY.md',
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
  if (fs.existsSync(src)) {
    try {
      copyRecursive(src, dest);
      console.log(`  \x1b[32m✔\x1b[0m Đã sao chép: ${item}`);
    } catch (err) {
      console.error(`  \x1b[31m✖\x1b[0m Lỗi khi chép ${item}:`, err.message);
    }
  }
}

console.log('\n\x1b[32m%s\x1b[0m', '✨ Cài đặt hoàn tất!');
console.log('📌 Danh mục đã trang bị:');
console.log('   - 📜 AI_RULES.md (Luật cốt lõi)');
console.log('   - 💡 OPINION.md (Cách nghĩ & ưu tiên của NguyenTD)');
console.log('   - 🤖 AGENTS.md, GEMINI.md, CLAUDE.md, ANTIGRAVITY.md');
console.log('   - 🧠 .agent/ (92 skills, rules, workflows, agents, contracts)');
