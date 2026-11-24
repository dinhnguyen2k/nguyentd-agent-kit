/**
 * Nối OMP `tool_call` trực tiếp vào `evaluateBoundaryChecks` trong bộ nhớ (0 lần spawn tiến trình con).
 * Luật nằm ở `.agent/contracts/agent-registry.json`; file này chỉ dịch tool call của OMP
 * sang payload chuẩn (`Bash` / `Write`) rồi đọc quyết định từ engine dùng chung.
 * Fail-open như guard: lỗi của chính hook không được chặn tool.
 */
import { existsSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { evaluateBoundaryChecks } from "../../../../scripts/agent-boundary-guard.mjs";
import { splitApplyPatchIntoFileChecks } from "../../../../scripts/agent-lifecycle-core.mjs";

type GuardCheck = {
	tool_name: "Bash" | "Write";
	tool_input: { command?: string; file_path?: string; new_content?: string };
};

const GUARD_REL = join(".agent", "scripts", "agent-boundary-guard.mjs");
const URL_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;
const EDIT_PATH_PATTERNS = [
	/^\[([^\]#\n]+)#[0-9A-Fa-f]{4}\]/gm,
	/^MV\s+"?([^"\n]+?)"?\s*$/gm,
	/^\*\*\* (?:Add|Update|Delete) File:\s*(.+)$/gm,
	/^\*\*\* Move to:\s*(.+)$/gm,
	/^\+\+\+ b\/(.+)$/gm,
];
const EVAL_WRITE_PATTERNS = [
	/\bwrite\(\s*["'`]([^"'`]+)["'`]/g,
	/\bBun\.write\(\s*["'`]([^"'`]+)["'`]/g,
	/\bwriteFileSync\(\s*["'`]([^"'`]+)["'`]/g,
	/\bopen\(\s*["']([^"']+)["']\s*,\s*["'][wax]/g,
	/\bPath\(\s*["']([^"']+)["']\s*\)\.write_(?:text|bytes)\(/g,
];
const EVAL_SPAWNS_PROCESS = /\bsh\(|\bsubprocess\b|\bos\.system\b|\bBun\.\$|\$`|\bspawn(?:Sync)?\(|\bexec(?:Sync)?\(|\btool\.bash\b/;
const SUB_EVAL_ESCAPE_HATCH = /\bsh\(|\bBun\.\$|\$`|\bsubprocess\b|\bchild_process\b|\bos\.(?:system|popen|exec\w*|spawn\w*)\b|(?<![\w.$])(?:spawn|exec|execFile|fork)(?:Sync)?\(|\bBun\.write\(|\b(?:writeFileSync|appendFileSync)\(|\bopen\([^)]*,\s*["'][wax]|\bPath\([^)]*\)\.write_(?:text|bytes)\(|\.write_(?:text|bytes)\(|(?<![\w.$])write\(/;
const MCP_FS_WRITE = /^mcp_+filesystem_+(write_file|append_file|edit_file|move_file|create_directory)$/;

function findRepoRoot(start: string): string | null {
	for (let dir = resolve(start); ; dir = dirname(dir)) {
		if (existsSync(join(dir, GUARD_REL))) return dir;
		if (dirname(dir) === dir) return null;
	}
}

function str(value: unknown): string | null {
	return typeof value === "string" && value.length > 0 ? value : null;
}

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

function lspMutation(device: string, args: Record<string, unknown>): { mutates: boolean; files: string[] } {
	const action = str(args.action);
	const isRenameDevice = device !== "lsp";
	const mutates = isRenameDevice || action === "rename" || action === "rename_file" || action === "request" || (action === "code_actions" && args.apply === true);
	const file = isRenameDevice ? str(args.file_path) ?? str(args.file) ?? str(args.path) : str(args.file);
	return { mutates, files: mutates && file ? [file, ...(device === "lsp" && action === "rename_file" && str(args.new_name) ? [str(args.new_name)!] : [])] : [] };
}

function subBlockReason(toolName: string, input: Record<string, unknown>): string | null {
	if (toolName === "eval" && SUB_EVAL_ESCAPE_HATCH.test(str(input.code) ?? "")) {
		return "Trong eval của subagent chỉ được chạy lệnh/ghi tệp qua tool.bash, tool.edit, tool.write (đi qua guard với giá trị lúc chạy); không dùng sh(), Bun.$, $`...`, subprocess, os.system, spawn/exec, Bun.write, writeFileSync/appendFileSync, open(...,'w'), Path.write_*, write() của prelude.";
	}
	if (toolName !== "write") return null;
	const device = str(input.path)?.match(/^xd:\/\/([\w-]+)/)?.[1];
	if (device === "debug") return "Subagent không được gắn vào hoặc khởi chạy tiến trình qua debugger.";
	if (device === "lsp" || device === "mcp__lsp_rename_symbol" || device === "mcp__lsp_rename_symbol_strict") {
		const { mutates, files } = lspMutation(device, parseJson(input.content));
		if (mutates && files.length === 0) return "Thiếu đối số tệp đích cho thao tác có thể sửa tệp qua thiết bị LSP.";
	}
	return null;
}

function extractPatchAddedContent(input: Record<string, unknown>, fullText: string): string | null {
	const direct =
		str(input.newText) ??
		str(input.new_string) ??
		str(input.content) ??
		(Array.isArray(input.edits)
			? input.edits.map(e => str((e as Record<string, unknown> | null)?.new_string) ?? str((e as Record<string, unknown> | null)?.newText) ?? "").join("\n") || null
			: null);
	if (direct) return direct;
	const added = fullText
		.split("\n")
		.filter(line => line.startsWith("+") && !line.startsWith("+++ "))
		.map(line => line.slice(1))
		.join("\n");
	return added || null;
}

function writes(paths: string[], newContent?: string | null): GuardCheck[] {
	return [...new Set(paths)]
		.filter(p => !URL_SCHEME.test(p))
		.map(p => ({ tool_name: "Write", tool_input: { file_path: p, ...(newContent ? { new_content: newContent } : {}) } }));
}

function toChecks(toolName: string, input: Record<string, unknown>, isSub: boolean): GuardCheck[] {
	if (toolName === "bash") {
		const command = str(input.command);
		return command ? [{ tool_name: "Bash", tool_input: { command } }] : [];
	}
	if (toolName === "edit" || toolName === "apply_patch") {
		const text = Object.values(input).filter((v): v is string => typeof v === "string").join("\n");
		const patchChecks = splitApplyPatchIntoFileChecks(text) as GuardCheck[];
		if (patchChecks.length > 0) {
			const covered = new Set(patchChecks.map(c => c.tool_input.file_path).filter((p): p is string => Boolean(p)));
			const extraPaths = argPaths(input).filter(p => !covered.has(p));
			return [...patchChecks, ...writes(extraPaths)];
		}
		const found = EDIT_PATH_PATTERNS.flatMap(p => [...text.matchAll(p)].map(m => m[1].trim()));
		const newContent = extractPatchAddedContent(input, text);
		return writes([...found, ...argPaths(input)], newContent);
	}
	if (toolName === "write") {
		const path = str(input.path);
		if (!path) return [];
		const device = path.match(/^xd:\/\/([\w-]+)/)?.[1];
		if (!device) return writes([path], str(input.content));
		if (isSub && (device === "lsp" || device === "mcp__lsp_rename_symbol" || device === "mcp__lsp_rename_symbol_strict")) {
			const { mutates, files } = lspMutation(device, parseJson(input.content));
			return mutates ? writes(files) : [];
		}
		if (device === "ast_edit" || MCP_FS_WRITE.test(device)) {
			const mcpArgs = parseJson(input.content);
			return writes(argPaths(mcpArgs), str(mcpArgs.content) ?? str(mcpArgs.newText) ?? str(mcpArgs.new_string));
		}
		return [];
	}
	if (toolName === "ast_edit" || MCP_FS_WRITE.test(toolName)) {
		return writes(argPaths(input), str(input.content) ?? str(input.newText) ?? str(input.new_string));
	}
	if (toolName === "eval") {
		const code = str(input.code);
		if (!code) return [];
		const checks = writes(EVAL_WRITE_PATTERNS.flatMap(p => [...code.matchAll(p)].map(m => m[1].trim())));
		if (EVAL_SPAWNS_PROCESS.test(code)) checks.push({ tool_name: "Bash", tool_input: { command: code.replace(/["'`]/g, " ") } });
		return checks;
	}
	return [];
}

export default function boundaryGuard(pi: ExtensionAPI): void {
	pi.on("tool_call", async (event, ctx) => {
		try {
			const root = findRepoRoot(ctx.cwd);
			if (!root) return;
			const input = (event.input ?? {}) as Record<string, unknown>;
			const isSub = ctx.agent?.kind === "sub" && ctx.agent.name !== "sub";
			const blockReason = isSub ? subBlockReason(event.toolName, input) : null;
			if (blockReason) return { block: true, reason: `[boundary-guard] ${blockReason}` };
			const checks = toChecks(event.toolName, input, isSub).map(c =>
				c.tool_input.file_path && !isAbsolute(c.tool_input.file_path)
					? { ...c, tool_input: { ...c.tool_input, file_path: resolve(ctx.cwd, c.tool_input.file_path) } }
					: c,
			);
			if (checks.length === 0) return;
			const agentName = isSub ? ctx.agent?.name : undefined;
			const reason = evaluateBoundaryChecks(checks, { root, agentName });
			if (reason) return { block: true, reason: `[boundary-guard] ${reason}` };
		} catch {
			// Fail-open có chủ đích, khớp `fail_mode: open-on-crash` trong agent-registry.json.
		}
		return undefined;
	});
}
