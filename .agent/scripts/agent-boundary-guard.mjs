#!/usr/bin/env node
/**
 * Cogain Agent Boundary Guard - PreToolUse hook.
 *
 * Chặn ở tầng tool-calling, không phụ thuộc "lời dặn trong prompt".
 * Nguồn sự thật duy nhất: `.agent/contracts/agent-registry.json`.
 *
 * Ba luật được thực thi:
 *   R1 test-runner   - lệnh chạy test suite chỉ dành cho `verifier` / `test-author`.
 *   R2 test-write    - ghi vào cây test (qua Edit/Write hoặc qua shell) chỉ dành cho `test-author`.
 *   R3 self-protect  - sửa chính file cấu hình enforcement chỉ dành cho `maintainer`.
 *
 * Role được phân giải theo thứ tự: payload subagent -> env COGAIN_AGENT_ROLE ->
 * file state (TTL 8h) -> mặc định `implementer` (chặt nhất).
 *
 * Fail-open có chủ đích: script lỗi thì tool vẫn chạy. Đổi lại script không có
 * dependency ngoài Node core. Mọi lần deny đều ghi `.agent/reports/boundary-guard.log`.
 */

import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..");
const REGISTRY_PATH = join(ROOT, ".agent", "contracts", "agent-registry.json");
const RUNTIME_DIR = join(ROOT, ".agent", "scratch", ".runtime");
const ROLE_FILE = join(RUNTIME_DIR, "agent-role");
const TRACE_FILE = join(RUNTIME_DIR, "last-hook-payload.json");
const LOG_FILE = join(ROOT, ".agent", "reports", "boundary-guard.log");
const ROLE_TTL_MS = 8 * 60 * 60 * 1000;
const DEFAULT_ROLE = "implementer";
let CLI_MODE = false;

/* ----------------------------------------------------------------- helpers */

function log(line) {
  try {
    mkdirSync(dirname(LOG_FILE), { recursive: true });
    appendFileSync(LOG_FILE, `${new Date().toISOString()} ${line}\n`);
  } catch {
    /* logging không bao giờ được làm hỏng tool call */
  }
}

function allow() {
  process.exit(0);
}

function deny(rule, role, reason) {
  log(`DENY rule=${rule} role=${role} :: ${reason.replace(/\s+/g, " ").slice(0, 400)}`);
  if (CLI_MODE) {
    process.stderr.write(`[${rule}] ${reason}\n`);
    process.exit(2);
  }
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason,
      },
      systemMessage: `[boundary-guard] ${rule} bị chặn cho role '${role}'. Xem .agent/reports/boundary-guard.log`,
    })
  );
  process.exit(0);
}

/** Glob rút gọn: `**` vượt thư mục, `*` trong một segment. */
function globToRegExp(glob, { anchored = true } = {}) {
  let out = "";
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    if (ch === "*") {
      if (glob[i + 1] === "*") {
        out += "[^\\s\"']*";
        i++;
        if (glob[i + 1] === "/") i++;
      } else {
        out += "[^/\\s\"']*";
      }
    } else if (ch === "?") {
      out += "[^/]";
    } else {
      out += ch.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(anchored ? `^${out}$` : out);
}

function matchesAny(value, globs) {
  return (globs || []).some((g) => globToRegExp(g).test(value));
}

function toRepoRelative(p) {
  if (!p) return null;
  let path = String(p).replace(/\\/g, "/");
  const root = ROOT.replace(/\\/g, "/");
  if (path.startsWith(root)) path = path.slice(root.length);
  return path.replace(/^\/+/, "").replace(/^\.\//, "");
}

/* -------------------------------------------------------------------- role */

function knownRoles(registry) {
  return new Set([...registry.agents.map((a) => a.name), DEFAULT_ROLE, "maintainer"]);
}

function resolveRole(payload, registry) {
  const known = knownRoles(registry);

  // 1. Subagent thật (khi agent được đăng ký trong .claude/agents/).
  //    Tên field khác nhau giữa các bản Claude Code nên thử nhiều biến thể.
  const fromPayload =
    payload.agent_type || payload.agentType || payload.subagent_type || payload.agent_name;
  if (fromPayload && known.has(fromPayload)) return { role: fromPayload, source: "subagent" };

  // 2. Env (dùng cho CI hoặc lệnh một-phát).
  const fromEnv = process.env.COGAIN_AGENT_ROLE;
  if (fromEnv && known.has(fromEnv)) return { role: fromEnv, source: "env" };

  // 3. File state do `.agent/scripts/agent-role.sh` ghi, hết hạn sau 8h.
  try {
    if (existsSync(ROLE_FILE)) {
      const age = Date.now() - statSync(ROLE_FILE).mtimeMs;
      const value = readFileSync(ROLE_FILE, "utf8").trim();
      if (age <= ROLE_TTL_MS && known.has(value)) return { role: value, source: "state-file" };
      if (age > ROLE_TTL_MS) log(`ROLE-EXPIRED value=${value} age_h=${(age / 3.6e6).toFixed(1)}`);
    }
  } catch {
    /* ignore */
  }

  return { role: DEFAULT_ROLE, source: "default" };
}

/* -------------------------------------------------------------------- main */

/**
 * Hai chế độ chạy:
 *   1. Hook (Claude Code PreToolUse): đọc payload JSON từ stdin, trả JSON quyết định.
 *   2. CLI (harness không có hook: Codex, Antigravity, CI, git hook):
 *        node agent-boundary-guard.mjs --check-command "dotnet test --filter X" [--role verifier]
 *        node agent-boundary-guard.mjs --check-write backend/tests/Foo.cs
 *      exit 0 = cho phép, exit 2 = bị chặn kèm lý do ở stderr.
 */
let payload = {};
const argv = process.argv.slice(2);
if (argv.length > 0) {
  CLI_MODE = true;
  const flag = (name) => {
    const i = argv.indexOf(name);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : null;
  };
  const roleArg = flag("--role");
  if (roleArg) process.env.COGAIN_AGENT_ROLE = roleArg;
  const command = flag("--check-command");
  const writePath = flag("--check-write");
  if (command) payload = { tool_name: "Bash", tool_input: { command } };
  else if (writePath) payload = { tool_name: "Write", tool_input: { file_path: writePath } };
  else {
    process.stderr.write(
      "usage: agent-boundary-guard.mjs --check-command <cmd> | --check-write <path> [--role <role>]\n"
    );
    process.exit(1);
  }
} else {
  try {
    payload = JSON.parse(readFileSync(0, "utf8") || "{}");
  } catch {
    allow();
  }
}

let registry;
try {
  registry = JSON.parse(readFileSync(REGISTRY_PATH, "utf8"));
} catch (err) {
  log(`GUARD-ERROR không đọc được registry: ${err.message}`);
  allow();
}

try {
  // Trace: giữ lại shape của payload để biết runtime có cấp danh tính agent hay không.
  mkdirSync(RUNTIME_DIR, { recursive: true });
  writeFileSync(
    TRACE_FILE,
    JSON.stringify({ at: new Date().toISOString(), keys: Object.keys(payload), tool: payload.tool_name }, null, 2)
  );
} catch {
  /* ignore */
}

let { role, source } = resolveRole(payload, registry);
const tool = payload.tool_name || "";
const input = payload.tool_input || {};
const rules = registry.enforcement?.rules || {};
const agentEntry = registry.agents.find((a) => a.name === role) || null;

try {
  /* ---------------------------------------------------------- Bash branch */
  if (tool === "Bash") {
    const raw = String(input.command || "");
    const cmd = raw.replace(/\s+/g, " ").trim();

    // Khai báo role ngay trên dòng lệnh: `COGAIN_AGENT_ROLE=verifier dotnet test ...`.
    // Harness nào cũng dùng được vì nó chỉ là chuỗi lệnh, và nó luôn hiện trong transcript.
    const inline = cmd.match(/^COGAIN_(?:AGENT_)?ROLE=([a-z-]+)\s+/);
    if (inline && knownRoles(registry).has(inline[1])) {
      log(`ROLE-INLINE role=${inline[1]} cmd=${cmd.slice(0, 120)}`);
      role = inline[1];
      source = "inline";
    }

    // R1: test runner.
    const r1 = rules.test_runner || {};
    const hitsRunner = (r1.patterns || []).some((p) => new RegExp(p, "i").test(cmd));
    if (hitsRunner && !(r1.allowed_roles || []).includes(role)) {
      deny(
        "R1-test-runner",
        role,
        `${r1.deny_message}\n\n` +
          `Lệnh bị chặn: ${cmd.slice(0, 200)}\n` +
          `Role hiện tại: ${role} (nguồn: ${source}).\n\n` +
          `Agent triển khai chỉ được xác thực bằng \`dotnet build <project>\`. Build xanh là bằng chứng hợp lệ: DỪNG và bàn giao.\n` +
          `Chạy test là quyết định của người dùng. Nếu người dùng muốn mở cổng, người dùng chạy:\n` +
          `  ! .agent/scripts/agent-role.sh verifier\n` +
          `Không tự ý mở cổng rồi chạy tiếp.`
      );
    }

    const r2 = rules.test_write || {};

    // Bỏ các dạng redirect không phải ghi file trước khi tìm token ghi:
    // `2>&1`, `>/dev/null` không biến lệnh thành lệnh sửa file.
    const stripped = cmd.replace(/\d?>\s*&\s*\d/g, " ").replace(/\d?>>?\s*\/dev\/null/g, " ");
    const mutIndexes = (r2.shell_mutating_tokens || [])
      .map((t) => stripped.indexOf(t))
      .filter((i) => i >= 0);
    const isMutating = mutIndexes.length > 0;
    const firstMut = isMutating ? Math.min(...mutIndexes) : -1;

    // R3b: sửa file cấu hình enforcement bằng shell (đường vòng của Edit/Write).
    // Chỉ tính khi đường dẫn được bảo vệ đứng SAU token ghi, để `cat settings.json > /tmp/x`
    // (chỉ đọc) không bị chặn oan.
    const r3shell = rules.self_protect || {};
    // Xét MỌI lần xuất hiện sau token ghi: `jq . f.json > /tmp/x && mv /tmp/x f.json`
    // có f.json ở cả hai phía, lần sau mới là lần bị ghi đè.
    const protectedHit = (registry.protected_config_paths || []).find(
      (p) => isMutating && stripped.indexOf(p, firstMut) !== -1
    );
    if (isMutating && protectedHit && !(r3shell.allowed_roles || []).includes(role)) {
      deny(
        "R3-self-protect-shell",
        role,
        `Permission Denied: lệnh này ghi vào file cấu hình enforcement.\n\n` +
          `Lệnh bị chặn: ${cmd.slice(0, 200)}\n` +
          `Chỉ role 'maintainer' được sửa. Nới ranh giới là quyết định của người dùng.`
      );
    }

    // R2b: ghi vào cây test bằng shell.
    const touchesTestPath = (r2.shell_path_markers || []).some(
      (m) => isMutating && stripped.indexOf(m, firstMut) !== -1
    );
    if (touchesTestPath && isMutating && !(r2.allowed_roles || []).includes(role)) {
      deny(
        "R2-test-write-shell",
        role,
        `Permission Denied: writing to the test tree is reserved for 'test-author'.\n\n` +
          `Lệnh bị chặn: ${cmd.slice(0, 200)}\n` +
          `Role hiện tại: ${role} (nguồn: ${source}).\n\n` +
          `Test biên dịch lỗi hay đỏ do đổi contract thì báo \`test-spec-conflict\` kèm tên test, không tự sửa test.`
      );
    }
    allow();
  }

  /* --------------------------------------------------- Edit / Write branch */
  if (["Edit", "Write", "MultiEdit", "NotebookEdit"].includes(tool)) {
    const target = toRepoRelative(input.file_path || input.notebook_path || "");
    if (!target) allow();

    // R3: tự bảo vệ cấu hình enforcement.
    const r3 = rules.self_protect || {};
    if (matchesAny(target, registry.protected_config_paths) && !(r3.allowed_roles || []).includes(role)) {
      deny(
        "R3-self-protect",
        role,
        `Permission Denied: ${target} là file cấu hình enforcement.\n\n` +
          `Chỉ role 'maintainer' được sửa (COGAIN_AGENT_ROLE=maintainer hoặc \`! .agent/scripts/agent-role.sh maintainer\`).\n` +
          `Nới ranh giới là quyết định của người dùng, không phải cách xử lý khi bị chặn.`
      );
    }

    // R2a: ghi vào cây test.
    const r2 = rules.test_write || {};
    if (matchesAny(target, registry.test_paths) && !(r2.allowed_roles || []).includes(role)) {
      deny(
        "R2-test-write",
        role,
        `Permission Denied: writing to the test tree is reserved for 'test-author'.\n\n` +
          `File bị chặn: ${target}\n` +
          `Role hiện tại: ${role} (nguồn: ${source}).\n\n` +
          `Không sửa/xoá assertion, thêm Skip, hay chỉnh expected value để build xanh.\n` +
          `Test mâu thuẫn spec là \`test-spec-conflict\`: dừng, báo tên test và mâu thuẫn, để người dùng quyết.`
      );
    }

    // Write boundary theo registry.
    // Chỉ áp khi role đến từ danh tính thật (subagent) hoặc env của chính process đó.
    // Role lấy từ state file là "cấp thêm năng lực", không được biến thành gông cho
    // seat khác đang chạy song song (test-author và specialist chạy cùng lúc).
    if (agentEntry && role !== DEFAULT_ROLE && (source === "subagent" || source === "env")) {
      if (matchesAny(target, agentEntry.deny_write_paths)) {
        deny(
          "R4-deny-write-path",
          role,
          `Permission Denied: ${target} nằm trong deny_write_paths của '${role}'.\n` +
            `Ranh giới khai báo tại .agent/contracts/agent-registry.json.`
        );
      }
      const scoped = agentEntry.write_paths || [];
      if (scoped.length > 0 && !matchesAny(target, scoped) && !matchesAny(target, registry.shared_write_paths || [])) {
        deny(
          "R4-outside-write-path",
          role,
          `Permission Denied: ${target} nằm ngoài write_paths của '${role}' (${scoped.join(", ")}).\n` +
            `Cần đổi file ngoài ranh giới thì báo lại cho orchestrator/người dùng, không tự mở rộng phạm vi.`
        );
      }
      if (agentEntry.kind === "gate" && scoped.length === 0) {
        deny(
          "R4-gate-readonly",
          role,
          `Permission Denied: '${role}' là cổng kiểm định read-only, không được sửa file.\n` +
            `Gate đỏ thì trả về cho implementer, không tự vá.`
        );
      }
    }
    allow();
  }
} catch (err) {
  log(`GUARD-ERROR ${err.stack?.split("\n")[0] || err.message}`);
}

allow();
