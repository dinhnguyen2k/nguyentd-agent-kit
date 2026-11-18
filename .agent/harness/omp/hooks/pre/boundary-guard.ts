/**
 * Nối OMP `tool_call` vào `.agent/scripts/agent-boundary-guard.mjs` (hook mode, stdin JSON).
 * Luật nằm ở `.agent/contracts/agent-registry.json`; file này chỉ dịch tool call của OMP
 * sang payload kiểu Claude Code (`Bash` / `Write`) rồi đọc quyết định của guard.
 * Fail-open như guard: lỗi của chính hook không được chặn tool.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";

type GuardCheck = { tool_name: "Bash" | "Write"; tool_input: { command?: string; file_path?: string } };

const GUARD_REL = join(".agent", "scripts", "agent-boundary-guard.mjs");
const URL_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;
// Paths tìm thấy trong payload của các chế độ edit: hashline, apply_patch, unified diff.
const EDIT_PATH_PATTERNS = [
	/^\[([^\]#\n]+)#[0-9A-Fa-f]{4}\]/gm,
	/^MV\s+"?([^"\n]+?)"?\s*$/gm,
	/^\*\*\* (?:Add|Update|Delete) File:\s*(.+)$/gm,
	/^\*\*\* Move to:\s*(.+)$/gm,
	/^\+\+\+ b\/(.+)$/gm,
];
// Đường ghi file trong code `eval` (Python prelude, Bun, Node, pathlib).
const EVAL_WRITE_PATTERNS = [
	/\bwrite\(\s*["'`]([^"'`]+)["'`]/g,
	/\bBun\.write\(\s*["'`]([^"'`]+)["'`]/g,
	/\bwriteFileSync\(\s*["'`]([^"'`]+)["'`]/g,
	/\bopen\(\s*["']([^"']+)["']\s*,\s*["'][wax]/g,
	/\bPath\(\s*["']([^"']+)["']\s*\)\.write_(?:text|bytes)\(/g,
];
const EVAL_SPAWNS_PROCESS = /\bsubprocess\b|\bos\.system\b|\bBun\.\$|\$`|\bspawn(?:Sync)?\(|\bexec(?:Sync)?\(|\btool\.bash\b/;
const MCP_FS_WRITE = /^mcp__filesystem_(write_file|edit_file|move_file|create_directory)$/;

function findRepoRoot(start: string): string | null {
	for (let dir = resolve(start); ; dir = dirname(dir)) {
		if (existsSync(join(dir, GUARD_REL))) return dir;
		if (dirname(dir) === dir) return null;
	}
}

function str(value: unknown): string | null {
	return typeof value === "string" && value.length > 0 ? value : null;
}

/** Path trong tham số của MCP filesystem (`write_file`, `edit_file`, `move_file`, `create_directory`) và `ast_edit`. */
function argPaths(args: Record<string, unknown>): string[] {
	const single = ["path", "file_path", "source", "destination"].map(k => str(args[k]));
	const many = Array.isArray(args.paths) ? args.paths.map(str) : [];
	return [...single, ...many].filter((p): p is string => p !== null);
}

function parseJson(text: unknown): Record<string, unknown> {
	try {
		const value = JSON.parse(String(text ?? ""));
		return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
	} catch {
		return {};
	}
}

function writes(paths: string[]): GuardCheck[] {
	return paths.filter(p => !URL_SCHEME.test(p)).map(p => ({ tool_name: "Write", tool_input: { file_path: p } }));
}

function toChecks(toolName: string, input: Record<string, unknown>): GuardCheck[] {
	if (toolName === "bash") {
		const command = str(input.command);
		return command ? [{ tool_name: "Bash", tool_input: { command } }] : [];
	}
	if (toolName === "edit" || toolName === "apply_patch") {
		const text = Object.values(input).filter((v): v is string => typeof v === "string").join("\n");
		const found = EDIT_PATH_PATTERNS.flatMap(p => [...text.matchAll(p)].map(m => m[1].trim()));
		return writes([...found, ...argPaths(input)]);
	}
	if (toolName === "write") {
		const path = str(input.path);
		if (!path) return [];
		const device = path.match(/^xd:\/\/([\w-]+)/)?.[1];
		if (!device) return writes([path]);
		if (device === "ast_edit" || MCP_FS_WRITE.test(device)) return writes(argPaths(parseJson(input.content)));
		return [];
	}
	if (toolName === "ast_edit" || MCP_FS_WRITE.test(toolName)) return writes(argPaths(input));
	if (toolName === "eval") {
		const code = str(input.code);
		if (!code) return [];
		const checks = writes(EVAL_WRITE_PATTERNS.flatMap(p => [...code.matchAll(p)].map(m => m[1].trim())));
		// Bỏ dấu nháy để regex lệnh của guard (viết cho shell) thấy `pnpm test` trong `run('pnpm test')`.
		if (EVAL_SPAWNS_PROCESS.test(code)) checks.push({ tool_name: "Bash", tool_input: { command: code.replace(/["'`]/g, " ") } });
		return checks;
	}
	return [];
}

function denyReason(root: string, check: GuardCheck, agentName: string | undefined): string | null {
	const payload = { ...check, ...(agentName ? { agent_name: agentName } : {}) };
	const run = spawnSync("node", [join(root, GUARD_REL)], {
		cwd: root,
		input: JSON.stringify(payload),
		encoding: "utf8",
		timeout: 10_000,
	});
	if (run.error || run.status !== 0 || !run.stdout.trim()) return null;
	const out = parseJson(run.stdout).hookSpecificOutput as Record<string, unknown> | undefined;
	return out?.permissionDecision === "deny" ? String(out.permissionDecisionReason ?? "blocked by boundary-guard") : null;
}

export default function boundaryGuard(pi: ExtensionAPI): void {
	pi.on("tool_call", async (event, ctx) => {
		try {
			const root = findRepoRoot(ctx.cwd);
			if (!root) return;
			const input = (event.input ?? {}) as Record<string, unknown>;
			const checks = toChecks(event.toolName, input).map(c =>
				c.tool_input.file_path && !isAbsolute(c.tool_input.file_path)
					? { ...c, tool_input: { file_path: resolve(ctx.cwd, c.tool_input.file_path) } }
					: c,
			);
			// Subagent: tên agent là danh tính thật để guard áp write boundary (R4). Main: guard tự lấy env/state/default.
			const agentName = ctx.agent?.kind === "sub" && ctx.agent.name !== "sub" ? ctx.agent.name : undefined;
			for (const check of checks) {
				const reason = denyReason(root, check, agentName);
				if (reason) return { block: true, reason: `[boundary-guard] ${reason}` };
			}
		} catch {
			// Fail-open có chủ đích, khớp `fail_mode: open-on-crash` trong agent-registry.json.
		}
		return undefined;
	});
}
