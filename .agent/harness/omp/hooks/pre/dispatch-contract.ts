import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { prepareDispatchAssignment } from "../../../../scripts/dispatch-contract.mjs";

type DispatchHookAPI = {
	on(event: "tool_call", handler: (event: { toolName: string; input: unknown }, ctx: { cwd: string }) => { block: true; reason: string } | { input: unknown } | undefined): void;
};
const WRITERS: Record<string, true> = {
	"backend-specialist": true,
	"frontend-specialist": true,
	"test-author": true,
};
type Assignment = { agent?: string; task?: string };
type TaskInput = Assignment & { tasks?: Assignment[] };
type WriteInput = { path?: unknown; content?: unknown };

function findRepoRoot(start: string): string | null {
	for (let dir = resolve(start); ; dir = dirname(dir)) {
		if (existsSync(join(dir, ".agent/scripts/agent-boundary-guard.mjs"))) return dir;
		if (dirname(dir) === dir) return null;
	}
}

/** Chặn giao lane viết code khi brief thiếu recipe có evidence hoặc lệch TASK. */
export default function dispatchContract(pi: DispatchHookAPI): void {
	pi.on("tool_call", (event, ctx) => {
		if (event.toolName === "task") {
			try {
				const input = event.input as TaskInput;
				const items = Array.isArray(input.tasks) ? input.tasks : [input];
				const writers = items.filter(item => typeof item.agent === "string" && WRITERS[item.agent] === true);
				if (!writers.length) return;
				const root = findRepoRoot(ctx.cwd);
				if (!root) return;
				let changed = false;
				const prepared = items.map(item => {
					if (typeof item.agent !== "string" || WRITERS[item.agent] !== true) return item;
					if (typeof item.task !== "string") throw new Error("Lane viết code cần brief tự chứa trong tasks[].task.");
					const task = prepareDispatchAssignment(root, item.task);
					if (task === item.task) return item;
					changed = true;
					return { ...item, task };
				});
				if (changed) return { input: Array.isArray(input.tasks) ? { ...input, tasks: prepared } : prepared[0] };
			} catch (error) {
				const reason = error instanceof Error ? error.message : "Không kiểm được contract dispatch.";
				return { block: true, reason: `[dispatch-contract] ${reason}` };
			}
			return undefined;
		}
		if (event.toolName === "write") {
			try {
				const input = event.input as WriteInput | null | undefined;
				if (!input || typeof input.path !== "string" || typeof input.content !== "string") return;
				if (!/^agent:\/\/[^\s/]+$/.test(input.path)) return;
				const hasContract = /contract_(?:ref|version):/m.test(input.content) || /```(?:json[ \t]+)?dispatch-contract[ \t]*/m.test(input.content);
				if (!hasContract) return;
				const root = findRepoRoot(ctx.cwd);
				if (!root) return;
				const prepared = prepareDispatchAssignment(root, input.content);
				if (prepared !== input.content) return { input: { ...input, content: prepared } };
			} catch (error) {
				const reason = error instanceof Error ? error.message : "Không kiểm được contract dispatch.";
				return { block: true, reason: `[dispatch-contract] ${reason}` };
			}
			return undefined;
		}
		return undefined;
	});
}
