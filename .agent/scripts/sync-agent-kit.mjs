#!/usr/bin/env node
/**
 * Đồng bộ một chiều có màng lọc khử riêng tư từ dự án làm việc sang kho `nguyentd-agent-kit`.
 * - Chỉ đồng bộ các thư mục/tệp thuộc hệ thống điều phối dùng chung.
 * - Tự động loại trừ thư mục trạng thái, khóa bí mật và các kỹ năng gắn cứng hạ tầng nội bộ.
 * - Tự động chuyển liên kết `file://<projectRoot>/...` thành đường dẫn tương đối chuẩn.
 * - Quét chặn tuyệt đối khóa bí mật, đường dẫn máy cá nhân (`/home/...`) và tên miền nội bộ trước khi ghi/commit.
 * - Tự chạy `validate-agent-system.mjs --write-catalog` trên kho kit để bảo đảm 0 lỗi.
 *
 * Cách dùng:
 *   node .agent/scripts/sync-agent-kit.mjs --check
 *   node .agent/scripts/sync-agent-kit.mjs [--kit ~/nguyentd-agent-kit] [--commit "Thông điệp" [--push]]
 */
import { execFileSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, posix, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PROJECT = resolve(HERE, "..", "..");
const DEFAULT_KIT = process.env.NGUYENTD_AGENT_KIT_DIR
  ? resolve(process.env.NGUYENTD_AGENT_KIT_DIR)
  : join(homedir(), "nguyentd-agent-kit");

const ROOT_FILES = ["AI_RULES.md", "AGENTS.md", "OPINION.md"];
const AGENT_SUBPATHS = [
  "ARCHITECTURE.md",
  "agents",
  "contracts",
  "evals",
  "harness",
  "knowledge",
  "rules",
  "scripts",
  "skills",
  "workflows",
];

const EXCLUDED_SEGMENTS = new Set([
  ".config",
  "archive",
  "planning",
  "reports",
  "scratch",
  "artifacts",
  "task-manifests",
  "node_modules",
  "__pycache__",
  ".DS_Store",
]);

const EXCLUDED_EXACT_OR_PREFIX = [
  ".agent/SKILLS.md",
  ".agent/skills/cogain-gitlab-mr",
  ".agent/workflows/create-mr.md",
  ".agent/workflows/create-tag.md",
  ".agent/skills/playwright-skill/drivers/cogain-auth-driver.cjs",
  ".agent/skills/playwright-skill/sub-skills/cogain-authenticated-e2e.md",
  ".agent/skills/playwright-skill/package-lock.json",
];

const INTERNAL_CONTENT_RE = new RegExp(
  `(?:\\b(?!settings\\.local\\b|cogain\\.local\\b)[a-z0-9-]+(?:\\.[a-z0-9-]+)*\\.(?:local|internal|lan)(?![a-z0-9-])|\\b${"cg" + "-dev"}\\b|\\.${"cogain-e2e"}\\.env)`,
  "i"
);
const SECRET_LEAK_RE =
  /\b(?:glpat-[A-Za-z0-9_-]{16,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16})\b/;
const LOCAL_USER_PATH_RE = new RegExp(["", "(?:home|Users)", "[A-Za-z0-9._-]+", ""].join("/"));

const TEXT_EXT_RE = /\.(?:md|mjs|cjs|js|ts|tsx|json|yml|yaml|toml|sh|py|txt|csv)$/i;

function parseArgs(argv) {
  const opts = {
    project: DEFAULT_PROJECT,
    kit: DEFAULT_KIT,
    checkOnly: false,
    commitMessage: null,
    push: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--check" || arg === "--dry-run") {
      opts.checkOnly = true;
    } else if (arg === "--push") {
      opts.push = true;
    } else if (arg === "--kit" && argv[i + 1]) {
      opts.kit = resolve(argv[++i]);
    } else if (arg === "--project" && argv[i + 1]) {
      opts.project = resolve(argv[++i]);
    } else if (arg === "--commit" && argv[i + 1]) {
      opts.commitMessage = argv[++i].trim();
    } else {
      throw new Error(
        `Tham số không hợp lệ: ${arg}\nCách dùng: node .agent/scripts/sync-agent-kit.mjs [--check] [--kit <dir>] [--commit "<msg>" [--push]]`
      );
    }
  }
  if (opts.push && !opts.commitMessage) {
    throw new Error("Cờ --push yêu cầu đi kèm --commit \"<thông điệp>\" tường minh.");
  }
  if (opts.checkOnly && (opts.commitMessage || opts.push)) {
    throw new Error("Không kết hợp --check với --commit hoặc --push.");
  }
  return opts;
}

function isExcludedRel(relPath) {
  const norm = relPath.replace(/\\/g, "/");
  const parts = norm.split("/");
  if (parts.some((p) => EXCLUDED_SEGMENTS.has(p) || p.startsWith(".temp-"))) return true;
  return EXCLUDED_EXACT_OR_PREFIX.some((prefix) => norm === prefix || norm.startsWith(`${prefix}/`));
}

function collectCandidatePaths(projectRoot) {
  const list = [];
  for (const rf of ROOT_FILES) {
    if (existsSync(join(projectRoot, rf))) list.push(rf);
  }
  const walk = (rel) => {
    if (isExcludedRel(rel)) return;
    const full = join(projectRoot, rel);
    if (!existsSync(full)) return;
    const st = lstatSync(full);
    if (st.isSymbolicLink()) {
      list.push(rel);
      return;
    }
    if (st.isDirectory()) {
      for (const entry of readdirSync(full).sort()) {
        walk(posix.join(rel.replace(/\\/g, "/"), entry));
      }
      return;
    }
    if (st.isFile()) list.push(rel);
  };
  for (const sub of AGENT_SUBPATHS) {
    walk(posix.join(".agent", sub));
  }
  return list;
}

function sanitizeText(rawText, relPath, projectRoot) {
  const norm = relPath.replace(/\\/g, "/");
  const escapedRoot = projectRoot.replace(/\\/g, "/").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const fileUriRe = new RegExp(`file://${escapedRoot}/([^)\\s"'\`#]+)(#[^)\\s"'\`]*)?`, "g");
  const fromDir = posix.dirname(norm);
  let out = rawText.replace(fileUriRe, (_, targetRel, hash = "") => {
    if (norm.endsWith(".md") && fromDir && fromDir !== ".") {
      const relLink = posix.relative(fromDir, targetRel);
      return `${relLink || posix.basename(targetRel)}${hash}`;
    }
    return `${targetRel}${hash}`;
  });

  if (/^\.agent\/evals\/cases\/[^/]+\.json$/.test(norm)) {
    try {
      const parsed = JSON.parse(out);
      if (Array.isArray(parsed.cases)) {
        const excludedSkills = new Set(
          EXCLUDED_EXACT_OR_PREFIX.filter((p) => p.startsWith(".agent/skills/")).map((p) => p.split("/")[2])
        );
        parsed.cases = parsed.cases.filter(
          (c) => !(Array.isArray(c?.skills) && c.skills.some((s) => excludedSkills.has(s))) && !INTERNAL_CONTENT_RE.test(JSON.stringify(c))
        );
        out = `${JSON.stringify(parsed, null, 2)}\n`;
      }
    } catch {
      /* giữ nguyên cho validator báo lỗi nếu JSON hỏng */
    }
  } else if (norm === ".agent/workflows/README.md") {
    const excludedWf = new Set(
      EXCLUDED_EXACT_OR_PREFIX.filter((p) => p.startsWith(".agent/workflows/") && p.endsWith(".md")).map((p) =>
        posix.basename(p, ".md")
      )
    );
    out = out
      .split("\n")
      .filter((line) => {
        const m = line.match(/^\|\s*`([a-z0-9-]+)`\s*\|/);
        return !(m && excludedWf.has(m[1]));
      })
      .join("\n");
  }

  return out;
}

function scanLeaks(text, relPath) {
  const lines = text.split(/\r?\n/);
  const findings = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (SECRET_LEAK_RE.test(line)) {
      findings.push(`${relPath}:${i + 1}: phát hiện mẫu khóa bí mật/token`);
    }
    if (LOCAL_USER_PATH_RE.test(line)) {
      findings.push(`${relPath}:${i + 1}: phát hiện đường dẫn máy cá nhân (/home/ hoặc /Users/)`);
    }
    if (INTERNAL_CONTENT_RE.test(line)) {
      findings.push(`${relPath}:${i + 1}: phát hiện tên miền/tài khoản nội bộ`);
    }
  }
  return findings;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const { project, kit, checkOnly, commitMessage, push } = opts;

  if (!existsSync(join(project, ".agent", "scripts", "agent-boundary-guard.mjs"))) {
    throw new Error(`Không tìm thấy nguồn .agent hợp lệ tại: ${project}`);
  }
  if (!existsSync(join(kit, "bin", "install.js")) || !existsSync(join(kit, "core", ".agent-core"))) {
    throw new Error(`Không tìm thấy kho nguyentd-agent-kit hợp lệ tại: ${kit}`);
  }
  if (resolve(project) === resolve(kit)) {
    throw new Error("Thư mục dự án và thư mục kit không được trùng nhau.");
  }

  const candidates = collectCandidatePaths(project);
  const added = [];
  const updated = [];
  const quarantinedMoved = [];
  const removedStaleWorkflows = [];
  const skippedInternal = [];
  const leakErrors = [];

  for (const rel of candidates) {
    const src = join(project, rel);
    const dst = join(kit, rel);
    const srcStat = lstatSync(src);

    if (srcStat.isSymbolicLink()) {
      const target = readlinkSync(src);
      if (LOCAL_USER_PATH_RE.test(target) || target.startsWith("/")) {
        leakErrors.push(`${rel}: symlink tuyệt đối không an toàn (${target})`);
        continue;
      }
      const dstExists = existsSync(dst) || (() => { try { lstatSync(dst); return true; } catch { return false; } })();
      const sameLink = dstExists && lstatSync(dst).isSymbolicLink() && readlinkSync(dst) === target;
      if (!sameLink) {
        dstExists ? updated.push(rel) : added.push(rel);
        if (!checkOnly) {
          mkdirSync(dirname(dst), { recursive: true });
          if (dstExists) unlinkSync(dst);
          symlinkSync(target, dst);
        }
      }
      continue;
    }

    const rawBuf = readFileSync(src);
    const isText = TEXT_EXT_RE.test(rel);
    let outBuf = rawBuf;

    if (isText) {
      const rawStr = rawBuf.toString("utf8");
      const sanitized = sanitizeText(rawStr, rel, project);
      if (INTERNAL_CONTENT_RE.test(sanitized)) {
        // Giữ nguyên bản sạch trên kit nếu tệp dùng chung trong dự án đã gắn thông tin nội bộ riêng.
        if (existsSync(dst)) {
          skippedInternal.push(rel);
          continue;
        }
        leakErrors.push(...scanLeaks(sanitized, rel));
        continue;
      }
      const leaks = scanLeaks(sanitized, rel);
      if (leaks.length > 0) {
        leakErrors.push(...leaks);
        continue;
      }
      outBuf = Buffer.from(sanitized, "utf8");
    }

    const dstExists = existsSync(dst);
    const isSame = dstExists && lstatSync(dst).isFile() && readFileSync(dst).equals(outBuf);
    if (!isSame) {
      dstExists ? updated.push(rel) : added.push(rel);
      if (!checkOnly) {
        mkdirSync(dirname(dst), { recursive: true });
        writeFileSync(dst, outBuf, { mode: statSync(src).mode });
      }
    }
  }

  if (leakErrors.length > 0) {
    console.error("✖ Chặn đồng bộ do phát hiện dữ liệu nhạy cảm hoặc đường dẫn cục bộ:");
    for (const err of leakErrors) console.error(`  - ${err}`);
    process.exit(2);
  }

  // Tự động di chuyển các skill đã đưa vào danh sách cách ly trong skill-governance.json sang .agent/quarantine/skills/ trên kit.
  const govPath = join(project, ".agent", "knowledge", "skill-governance.json");
  if (existsSync(govPath)) {
    const gov = JSON.parse(readFileSync(govPath, "utf8"));
    for (const item of gov.quarantinedSkills || []) {
      if (!item?.name) continue;
      const activeInKit = join(kit, ".agent", "skills", item.name);
      const quarantineInKit = join(kit, ".agent", "quarantine", "skills", item.name);
      if (existsSync(activeInKit)) {
        quarantinedMoved.push(`.agent/skills/${item.name} -> .agent/quarantine/skills/${item.name}`);
        if (!checkOnly) {
          mkdirSync(dirname(quarantineInKit), { recursive: true });
          if (existsSync(quarantineInKit)) rmSync(quarantineInKit, { recursive: true, force: true });
          renameSync(activeInKit, quarantineInKit);
        }
      }
    }
  }

  // Dọn các workflow đã gỡ khỏi dự án nguồn (trừ README.md).
  const kitWfDir = join(kit, ".agent", "workflows");
  const projWfDir = join(project, ".agent", "workflows");
  if (existsSync(kitWfDir) && existsSync(projWfDir)) {
    for (const wf of readdirSync(kitWfDir).sort()) {
      if (!wf.endsWith(".md") || wf === "README.md") continue;
      if (!existsSync(join(projWfDir, wf))) {
        removedStaleWorkflows.push(`.agent/workflows/${wf}`);
        if (!checkOnly) rmSync(join(kitWfDir, wf), { force: true });
      }
    }
  }

  const totalChanges = added.length + updated.length + quarantinedMoved.length + removedStaleWorkflows.length;
  console.log(`=== Đồng bộ Agent Kit (${checkOnly ? "KIỂM TRA TRƯỚC" : "GHI THẬT"}) ===`);
  console.log(`Nguồn : ${project}`);
  console.log(`Đích  : ${kit}`);
  console.log(
    `Mới: ${added.length} | Cập nhật: ${updated.length} | Cách ly skill: ${quarantinedMoved.length} | Gỡ workflow cũ: ${removedStaleWorkflows.length} | Bỏ qua nội bộ: ${skippedInternal.length}`
  );
  for (const f of added) console.log(`  [+] ${f}`);
  for (const f of updated) console.log(`  [~] ${f}`);
  for (const f of quarantinedMoved) console.log(`  [quarantine] ${f}`);
  for (const f of removedStaleWorkflows) console.log(`  [-] ${f}`);
  for (const f of skippedInternal) console.log(`  [skip-internal] ${f} (giữ bản trung lập trên kit)`);

  if (checkOnly) {
    if (totalChanges > 0) {
      console.log("-> Kho kit đang lệch so với bản dự án. Chạy lại không kèm --check để đồng bộ.");
      process.exit(1);
    }
    console.log("-> Kho kit đã đồng bộ 100%.");
    return;
  }

  console.log("\n=== Chạy kiểm định trên kho kit & cập nhật SKILLS.md ===");
  execFileSync(process.execPath, [".agent/scripts/validate-agent-system.mjs", "--write-catalog"], {
    cwd: kit,
    stdio: "inherit",
  });

  if (commitMessage) {
    const status = execFileSync("git", ["-C", kit, "status", "--porcelain"], { encoding: "utf8" }).trim();
    if (!status) {
      console.log("Không có thay đổi mới trên kho kit để commit.");
      return;
    }
    execFileSync("git", ["-C", kit, "add", "-A"], { stdio: "inherit" });
    execFileSync("git", ["-C", kit, "commit", "-m", commitMessage], { stdio: "inherit" });
    if (push) {
      execFileSync("git", ["-C", kit, "push", "origin", "main"], { stdio: "inherit" });
    }
  }
}

try {
  main();
} catch (err) {
  console.error(`✖ ${err.message}`);
  process.exit(1);
}
