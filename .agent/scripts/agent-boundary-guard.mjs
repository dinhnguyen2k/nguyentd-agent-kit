#!/usr/bin/env node
/**
 * Cogain Agent Boundary Guard - In-process engine + PreToolUse hook + CLI.
 *
 * Chặn ở tầng tool-calling, không phụ thuộc lời dặn trong prompt.
 * Nguồn sự thật duy nhất: `.agent/contracts/agent-registry.json`.
 *
 * Các luật được thực thi:
 *   R1 test-runner      - lệnh chạy test suite chỉ dành cho `verifier` / `test-author`.
 *   R2 test-write       - ghi vào cây test (qua Edit/Write hoặc shell) chỉ dành cho `test-author`.
 *   R3 self-protect     - sửa chính file cấu hình enforcement chỉ dành cho `maintainer`.
 *   R4 write-boundary   - giới hạn đường dẫn ghi theo danh tính subagent/env.
 *   R5 secret-inline    - credential viết literal trên dòng lệnh, chặn mọi role.
 *   R6 db-destructive   - drop/truncate/delete không WHERE trên DB, chặn mọi role.
 *   R7 migration-write  - cấm tự viết/sửa file migration/snapshot EF Core.
 *   R8 build-runner     - build/typecheck chỉ khi user yêu cầu; role được phép theo registry.
 *   R9 migration-runner - cấm tự sinh/chạy migration EF Core (add-migration, dotnet ef).
 *   R10 code-conventions - chặn mẫu code frontend bị cấm (@shared barrel, .uuid(), .catch('')).
 *
 * Fail-open có chủ đích: lỗi nội bộ của guard không làm hỏng tool call.
 * Mọi lần deny đều ghi `.agent/reports/boundary-guard.log`.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, realpathSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(HERE, "..", "..");
const ROLE_TTL_MS = 14 * 60 * 60 * 1000;
const DEFAULT_ROLE = "implementer";
const PRIVILEGED_INLINE_ROLES = new Set(["verifier", "test-author", "maintainer"]);
const registryCache = new Map();

function appendLog(logFile, line) {
  if (!logFile) return;
  try {
    mkdirSync(dirname(logFile), { recursive: true });
    appendFileSync(logFile, `${new Date().toISOString()} ${line}\n`);
  } catch {
    /* logging không bao giờ được làm hỏng tool call */
  }
}

function loadRegistry(registryPath, logFile) {
  try {
    const mtimeMs = statSync(registryPath).mtimeMs;
    const cached = registryCache.get(registryPath);
    if (cached && cached.mtimeMs === mtimeMs) return cached.data;
    const data = JSON.parse(readFileSync(registryPath, "utf8"));
    registryCache.set(registryPath, { mtimeMs, data });
    return data;
  } catch (err) {
    appendLog(logFile, `GUARD-ERROR không đọc được registry: ${err.message}`);
    return null;
  }
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

function toRepoRelative(p, rootDir) {
  if (!p) return null;
  let normalized = String(p).replace(/\\/g, "/");
  const root = rootDir.replace(/\\/g, "/");
  if (normalized === root) return "";
  if (normalized.startsWith(`${root}/`)) normalized = normalized.slice(root.length + 1);
  return normalized.replace(/^\/+/, "").replace(/^\.\//, "");
}

function knownRoles(registry) {
  return new Set([...(registry.agents || []).map((a) => a.name), DEFAULT_ROLE, "maintainer"]);
}

function readStateFileRole(roleFile, logFile, known, sandbox) {
  if (sandbox) return null;
  try {
    if (existsSync(roleFile)) {
      const age = Date.now() - statSync(roleFile).mtimeMs;
      const value = readFileSync(roleFile, "utf8").trim();
      if (age <= ROLE_TTL_MS && known.has(value)) return value;
      if (age > ROLE_TTL_MS) {
        appendLog(logFile, `ROLE-EXPIRED value=${value} age_h=${(age / 3.6e6).toFixed(1)}`);
        try {
          unlinkSync(roleFile);
        } catch {
          /* ignore */
        }
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

function resolveRole(payload, registry, { roleFile, logFile, agentName, envRole, sandbox }) {
  const known = knownRoles(registry);
  const stateFileRole = readStateFileRole(roleFile, logFile, known, sandbox);

  const fromPayload =
    agentName || payload.agent_type || payload.agentType || payload.subagent_type || payload.agent_name;
  if (fromPayload && known.has(fromPayload)) return { role: fromPayload, source: "subagent", stateFileRole };

  const fromEnv = sandbox ? envRole : envRole ?? process.env.COGAIN_AGENT_ROLE;
  if (fromEnv && known.has(fromEnv)) return { role: fromEnv, source: "env", stateFileRole };

  if (stateFileRole) return { role: stateFileRole, source: "state-file", stateFileRole };

  return { role: DEFAULT_ROLE, source: "default", stateFileRole };
}

function isAllowlisted(allowlist, ruleId, target, now) {
  return (allowlist || []).some((entry) => {
    if (!entry || entry.rule_id !== ruleId) return false;
    if (!matchesAny(target, entry.path_globs)) return false;
    const expiresMs = Date.parse(entry.expires_at);
    return Number.isFinite(expiresMs) && expiresMs >= now;
  });
}

/**
 * Đánh giá một payload chuẩn hoá (`Bash` / `Edit` / `Write` / `MultiEdit` / `NotebookEdit`) ngay trong bộ nhớ.
 */
export function evaluateBoundaryPayload(payload, options = {}) {
  const sandbox = options.sandbox === true;
  const cliMode = options.cliMode === true;
  const checkFs = !sandbox || options.checkFs === true;
  const now = options.now ?? Date.now();
  const root = options.root ? resolve(options.root) : DEFAULT_ROOT;
  const registryPath = join(root, ".agent", "contracts", "agent-registry.json");
  const runtimeDir = join(root, ".agent", "scratch", ".runtime");
  const roleFile = join(runtimeDir, "agent-role");
  const traceFile = join(runtimeDir, "last-hook-payload.json");
  const logFile = sandbox ? null : join(root, ".agent", "reports", "boundary-guard.log");
  const frictionFile = sandbox || cliMode ? null : join(root, ".agent", "reports", "agent-friction.jsonl");

  const registry = loadRegistry(registryPath, logFile);
  if (!registry) return { decision: "allow" };

  if (!sandbox && process.env.COGAIN_GUARD_TRACE === "1") {
    try {
      mkdirSync(runtimeDir, { recursive: true });
      writeFileSync(
        traceFile,
        JSON.stringify({ at: new Date().toISOString(), keys: Object.keys(payload || {}), tool: payload?.tool_name }, null, 2)
      );
    } catch {
      /* ignore */
    }
  }

  const denyResult = (rule, role, reason) => {
    const compact = reason.replace(/\s+/g, " ").slice(0, 400);
    appendLog(logFile, `DENY rule=${rule} role=${role} :: ${compact}`);
    if (frictionFile) {
      try {
        mkdirSync(dirname(frictionFile), { recursive: true });
        appendFileSync(
          frictionFile,
          `${JSON.stringify({ at: new Date().toISOString(), type: "guard-deny", rule_id: rule, role, message: compact.slice(0, 240) })}\n`
        );
      } catch {
        /* fail-open */
      }
    }
    return { decision: "deny", rule, role, reason };
  };

  try {
    let { role, source, stateFileRole } = resolveRole(payload || {}, registry, {
      roleFile,
      logFile,
      agentName: options.agentName,
      envRole: options.envRole,
      sandbox,
    });
    const tool = payload?.tool_name || "";
    const input = payload?.tool_input || {};
    const rules = registry.enforcement?.rules || {};
    const agentEntry = (registry.agents || []).find((a) => a.name === role) || null;

    if (tool === "Bash") {
      const raw = String(input.command || "");
      const cmd = raw.replace(/\s+/g, " ").trim();

      const inline = cmd.match(/^COGAIN_(?:AGENT_)?ROLE=([a-z-]+)\s+/);
      if (inline && knownRoles(registry).has(inline[1])) {
        const requestedRole = inline[1];
        const canElevate =
          !PRIVILEGED_INLINE_ROLES.has(requestedRole) ||
          requestedRole === role ||
          cliMode ||
          stateFileRole === "maintainer";
        if (canElevate) {
          appendLog(logFile, `ROLE-INLINE role=${requestedRole} cmd=${cmd.slice(0, 120)}`);
          role = requestedRole;
          source = "inline";
        } else {
          appendLog(logFile, `ROLE-INLINE-BLOCKED requested=${requestedRole} current=${role} source=${source} cmd=${cmd.slice(0, 120)}`);
        }
      }

      for (const key of ["secret_inline", "db_destructive", "build_runner", "migration_runner"]) {
        const r = rules[key];
        if (!r || !(r.patterns || []).some((p) => new RegExp(p, "i").test(cmd))) continue;
        if ((r.allowed_roles || []).includes(role)) continue;
        const shown = r.echo_command ? `\n\nLệnh bị chặn: ${cmd.slice(0, 200)}` : "";
        return denyResult(`${r.id}-${key.replace("_", "-")}`, role, `${r.deny_message}${shown}`);
      }

      const r1 = rules.test_runner || {};
      const hitsRunner = (r1.patterns || []).some((p) => new RegExp(p, "i").test(cmd));
      if (hitsRunner && !(r1.allowed_roles || []).includes(role)) {
        return denyResult(
          "R1-test-runner",
          role,
          `${r1.deny_message}\n\n` +
            `Lệnh bị chặn: ${cmd.slice(0, 200)}\n` +
            `Role hiện tại: ${role} (nguồn: ${source}).\n\n` +
            `Agent triển khai không tự build hay chạy test; CI parity qua verifier/maintainer chỉ khi user yêu cầu CI/build. DỪNG và bàn giao.\n` +
            `Chạy test là quyết định của người dùng. Nếu người dùng muốn mở cổng, người dùng chạy:\n` +
            `  ! .agent/scripts/agent-role.sh verifier\n` +
            `Không tự ý mở cổng rồi chạy tiếp.`
        );
      }

      const r2 = rules.test_write || {};
      const stripQuotes = (s) => s.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, " ");
      const unquoted = stripQuotes(cmd);
      const stripped = unquoted
        .replace(/\d?>\s*&\s*\d/g, " ")
        .replace(/\d?>>?\s*\/dev\/null/g, " ")
        .replace(/[=-]>/g, "  ");

      const cmdPrefix = "(?:^|[;&|(`]|\\b(?:sudo|xargs|env)\\s+)\\s*(?:[A-Za-z_][A-Za-z0-9_]*=(?:'[^']*'|\"[^\"]*\"|\\S+)\\s+)*";
      const mutatingCmdRe = new RegExp(cmdPrefix + "(?:rm|cp|mv|truncate|tee|ln|patch)\\b", "i");
      const sedMutatingRe = new RegExp(cmdPrefix + "sed\\b[^;&|]*(?:^|\\s)-[a-zA-Z]*i", "i");
      const gitMutatingCmdRe = new RegExp(cmdPrefix + "git\\s+(?:checkout|restore|apply)\\b", "i");
      const redirectionRe = />>?[^&]/;

      const isMutating =
        mutatingCmdRe.test(stripped) ||
        sedMutatingRe.test(stripped) ||
        gitMutatingCmdRe.test(stripped) ||
        redirectionRe.test(stripped);

      let firstMut = -1;
      if (isMutating) {
        const matches = [];
        const m1 = stripped.match(mutatingCmdRe);
        if (m1 && m1.index !== undefined) matches.push(m1.index);
        const m2 = stripped.match(sedMutatingRe);
        if (m2 && m2.index !== undefined) matches.push(m2.index);
        const m3 = stripped.match(gitMutatingCmdRe);
        if (m3 && m3.index !== undefined) matches.push(m3.index);
        const m4 = stripped.match(redirectionRe);
        if (m4 && m4.index !== undefined) matches.push(m4.index);
        firstMut = matches.length > 0 ? Math.min(...matches) : 0;
      }

      const r3shell = rules.self_protect || {};
      const protectedHit = (registry.protected_config_paths || []).find(
        (p) => isMutating && cmd.indexOf(p, firstMut) !== -1
      );
      if (isMutating && protectedHit && !(r3shell.allowed_roles || []).includes(role)) {
        return denyResult(
          "R3-self-protect-shell",
          role,
          `Permission Denied: lệnh này ghi vào file cấu hình enforcement.\n\n` +
            `Lệnh bị chặn: ${cmd.slice(0, 200)}\n` +
            `Chỉ role 'maintainer' được sửa. Nới ranh giới là quyết định của người dùng.`
        );
      }

      const touchesTestPath = (r2.shell_path_markers || []).some(
        (m) => isMutating && cmd.indexOf(m, firstMut) !== -1
      );
      if (touchesTestPath && isMutating && !(r2.allowed_roles || []).includes(role)) {
        return denyResult(
          "R2-test-write-shell",
          role,
          `Permission Denied: writing to the test tree is reserved for 'test-author'.\n\n` +
            `Lệnh bị chặn: ${cmd.slice(0, 200)}\n` +
            `Role hiện tại: ${role} (nguồn: ${source}).\n\n` +
            `Test biên dịch lỗi hay đỏ do đổi contract thì báo \`test-spec-conflict\` kèm tên test, không tự sửa test.`
        );
      }

      const touchesMigrationPath =
        isMutating &&
        (cmd.indexOf("Migrations/", firstMut) !== -1 ||
          (registry.migration_paths || []).some((m) => cmd.indexOf(m.replace(/\/\*\*$/, "/"), firstMut) !== -1));
      const r7shell = rules.migration_write || {};
      if (touchesMigrationPath && isMutating && !(r7shell.allowed_roles || []).includes(role)) {
        return denyResult(
          "R7-migration-write-shell",
          role,
          `Permission Denied: CẤM TUYỆT ĐỐI Agent tự viết tay hoặc chỉnh sửa file migration/snapshot EF Core bằng shell.\n\n` +
            `Lệnh bị chặn: ${cmd.slice(0, 200)}\n` +
            `Role hiện tại: ${role} (nguồn: ${source}).`
        );
      }

      if (agentEntry && agentEntry.kind === "gate" && role !== DEFAULT_ROLE && (source === "subagent" || source === "env")) {
        const gitMutatingRe =
          role === "verifier"
            ? /\bgit\s+(?:commit|push|reset|clean|checkout|restore|apply|merge|rebase|cherry-pick)\b/i
            : /\bgit\s+(?:commit|push|reset|clean|checkout|restore|apply|merge|rebase|cherry-pick|stash)\b/i;
        const nonReadOnlyExecRe =
          role === "researcher" || role === "reviewer"
            ? /(?:^|[;&|(`])\s*(?:env\s+)?(?:dotnet|npm|pnpm|yarn|npx|pnpx|bunx|bun|psql|pg_restore|sqlite3|docker)\b/i
            : null;
        if (isMutating || gitMutatingRe.test(stripped) || (nonReadOnlyExecRe && nonReadOnlyExecRe.test(stripped))) {
          return denyResult(
            "R4-gate-readonly-shell",
            role,
            `Permission Denied: '${role}' là cổng chỉ đọc, không được chạy lệnh ghi/sửa tệp hoặc lệnh thực thi nặng qua shell.\n\n` +
              `Lệnh bị chặn: ${cmd.slice(0, 200)}`
          );
        }
      }

      return { decision: "allow" };
    }

    if (["Edit", "Write", "MultiEdit", "NotebookEdit"].includes(tool)) {
      const target = toRepoRelative(input.file_path || input.notebook_path || "", root);
      if (!target) return { decision: "allow" };

      const r3 = rules.self_protect || {};
      if (matchesAny(target, registry.protected_config_paths) && !(r3.allowed_roles || []).includes(role)) {
        return denyResult(
          "R3-self-protect",
          role,
          `Permission Denied: ${target} là file cấu hình enforcement.\n\n` +
            `Chỉ role 'maintainer' được sửa (COGAIN_AGENT_ROLE=maintainer hoặc \`! .agent/scripts/agent-role.sh maintainer\`).\n` +
            `Nới ranh giới là quyết định của người dùng, không phải cách xử lý khi bị chặn.`
        );
      }

      const r2 = rules.test_write || {};
      if (matchesAny(target, registry.test_paths) && !(r2.allowed_roles || []).includes(role)) {
        return denyResult(
          "R2-test-write",
          role,
          `Permission Denied: writing to the test tree is reserved for 'test-author'.\n\n` +
            `File bị chặn: ${target}\n` +
            `Role hiện tại: ${role} (nguồn: ${source}).\n\n` +
            `Không sửa/xoá assertion, thêm Skip, hay chỉnh expected value để build xanh.\n` +
            `Test mâu thuẫn spec là \`test-spec-conflict\`: dừng, báo tên test và mâu thuẫn, để người dùng quyết.`
        );
      }

      const r7 = rules.migration_write || {};
      if (matchesAny(target, registry.migration_paths || []) && !(r7.allowed_roles || []).includes(role)) {
        return denyResult(
          "R7-migration-write",
          role,
          `Permission Denied: ${target} là file migration/snapshot EF Core.\n\n` +
            `CẤM TUYỆT ĐỐI Agent tự viết tay hoặc chỉnh sửa file migration/snapshot.\n` +
            `Sai sót phải sửa từ Entity hoặc Fluent API Configuration rồi để người dùng tự sinh migration bằng add-migration.`
        );
      }

      if (agentEntry && role !== DEFAULT_ROLE && (source === "subagent" || source === "env")) {
        if (matchesAny(target, agentEntry.deny_write_paths)) {
          return denyResult(
            "R4-deny-write-path",
            role,
            `Permission Denied: ${target} nằm trong deny_write_paths của '${role}'.\n` +
              `Ranh giới khai báo tại .agent/contracts/agent-registry.json.`
          );
        }
        const scoped = agentEntry.write_paths || [];
        if (scoped.length > 0 && !matchesAny(target, scoped) && !matchesAny(target, registry.shared_write_paths || [])) {
          return denyResult(
            "R4-outside-write-path",
            role,
            `Permission Denied: ${target} nằm ngoài write_paths của '${role}' (${scoped.join(", ")}).\n` +
              `Cần đổi file ngoài ranh giới thì báo lại cho orchestrator/người dùng, không tự mở rộng phạm vi.`
          );
        }
        if (agentEntry.kind === "gate" && scoped.length === 0) {
          return denyResult(
            "R4-gate-readonly",
            role,
            `Permission Denied: '${role}' là cổng kiểm định read-only, không được sửa file.\n` +
              `Gate đỏ thì trả về cho implementer, không tự vá.`
          );
        }
      }

      const r10 = rules.code_conventions || {};
      const allowlist =
        sandbox && Array.isArray(options.allowlist) ? options.allowlist : (registry.enforcement?.allowlist || []);
      const writtenText =
        input.new_content ??
        input.new_string ??
        (Array.isArray(input.edits) ? input.edits.map((e) => e?.new_string || "").join("\n") : null) ??
        input.content ??
        "";
      if (!(r10.allowed_roles || []).includes(role)) {
        for (const chk of r10.checks || []) {
          if (
            matchesAny(target, chk.path_globs) &&
            !isAllowlisted(allowlist, chk.id, target, now) &&
            new RegExp(chk.pattern).test(writtenText)
          ) {
            return denyResult(`R10-${chk.id}`, role, `Permission Denied: ${chk.message}\n\nFile: ${target}`);
          }
        }

        const csServiceMatch = target.match(/^backend\/src\/Services\/([^/]+)\/.*\.cs$/);
        if (csServiceMatch && writtenText && !isAllowlisted(allowlist, "no-cross-service-data-using", target, now)) {
          const currentService = csServiceMatch[1];
          const usingRe = /\busing\s+(?:Cogain\.)?(?:Services\.)?([A-Za-z0-9_]+)\.(?:Data|Repositories|Persistence)\b/g;
          for (const m of writtenText.matchAll(usingRe)) {
            if (m[1] !== currentService) {
              return denyResult(
                "R10-no-cross-service-data-using",
                role,
                `Permission Denied: Service '${currentService}' không được 'using' trực tiếp tầng ${m[0].split(".").at(-1)} của service khác ('${m[1]}'). Hãy giao tiếp qua Contracts/API/gRPC.\n\nFile: ${target}`
              );
            }
          }
        }

        const feSrcMatch = target.match(/^frontend\/([^/]+)\/src\/.*\.(?:ts|tsx)$/);
        if (checkFs && feSrcMatch && writtenText && !isAllowlisted(allowlist, "missing-static-asset", target, now)) {
          const appName = feSrcMatch[1];
          const assetRe = /\bimport\s+(?:[^'";]+\s+from\s+)?['"]([^'"]+\.(?:css|svg|png|jpg|jpeg|webp))['"]/g;
          for (const m of writtenText.matchAll(assetRe)) {
            const spec = m[1];
            let resolvedAsset = null;
            if (spec.startsWith("./") || spec.startsWith("../")) {
              resolvedAsset = resolve(dirname(join(root, target)), spec);
            } else if (spec.startsWith("@/")) {
              resolvedAsset = resolve(root, "frontend", appName, "src", spec.slice(2));
            } else if (spec.startsWith("@shared/")) {
              resolvedAsset = resolve(root, "frontend", "shared", spec.slice("@shared/".length));
            }
            if (resolvedAsset && !existsSync(resolvedAsset)) {
              const relResolved = toRepoRelative(resolvedAsset, root) || resolvedAsset;
              return denyResult(
                "R10-missing-static-asset",
                role,
                `Permission Denied: Tệp asset/CSS được import không tồn tại trên đĩa ('${spec}' -> '${relResolved}'). Kiểm tra lại đường dẫn trước khi bàn giao.\n\nFile: ${target}`
              );
            }
          }
        }
      }

      return { decision: "allow" };
    }
  } catch (err) {
    appendLog(logFile, `GUARD-ERROR ${err.stack?.split("\n")[0] || err.message}`);
  }

  return { decision: "allow" };
}

/**
 * Đánh giá danh sách checks trong bộ nhớ, trả về lý do chặn đầu tiên hoặc `null` nếu hợp lệ.
 */
export function evaluateBoundaryChecks(checks, options = {}) {
  for (const check of checks || []) {
    const res = evaluateBoundaryPayload(check, options);
    if (res.decision === "deny") return res.reason;
  }
  return null;
}

function runMain() {
  const argv = process.argv.slice(2);
  let cliMode = false;
  const sandbox = argv.includes("--sandbox");
  let payload = {};
  let envRole;

  if (argv.length > 0) {
    cliMode = true;
    const flag = (name) => {
      const i = argv.indexOf(name);
      return i >= 0 && argv[i + 1] ? argv[i + 1] : null;
    };
    const roleArg = flag("--role");
    if (roleArg) envRole = roleArg;
    const command = flag("--check-command");
    const writePath = flag("--check-write");
    const contentArg = flag("--content");
    if (command) {
      payload = { tool_name: "Bash", tool_input: { command } };
    } else if (writePath) {
      payload = {
        tool_name: "Write",
        tool_input: { file_path: writePath, ...(contentArg ? { new_content: contentArg } : {}) },
      };
    } else {
      process.stderr.write(
        "usage: agent-boundary-guard.mjs [--sandbox] --check-command <cmd> | --check-write <path> [--content <text>] [--role <role>]\n"
      );
      process.exit(1);
    }
  } else {
    try {
      payload = JSON.parse(readFileSync(0, "utf8") || "{}");
    } catch {
      process.exit(0);
    }
  }

  const res = evaluateBoundaryPayload(payload, { envRole, cliMode, sandbox });
  if (res.decision === "deny") {
    if (cliMode) {
      process.stderr.write(`[${res.rule}] ${res.reason}\n`);
      process.exit(2);
    }
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: res.reason,
        },
        systemMessage: `[boundary-guard] ${res.rule} bị chặn cho role '${res.role}'. Xem .agent/reports/boundary-guard.log`,
      })
    );
  }
  process.exit(0);
}

let isMain = false;
if (process.argv[1]) {
  try {
    isMain = realpathSync(resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    isMain = resolve(process.argv[1]) === fileURLToPath(import.meta.url);
  }
}
if (isMain) {
  runMain();
}
