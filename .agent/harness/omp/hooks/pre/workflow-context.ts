import {
	armSessionContinuation,
	evaluateMainStopGate,
	extractPlanDirFromPath,
	findRepoRoot,
	inspectPlanDirRemaining,
	recordSessionDispatch,
	recordSessionEdit,
	recordSessionToolOutcome,
	resetSessionTurnCounters,
	updateSessionTodoState,
} from "../../../../scripts/agent-lifecycle-core.mjs";

type AgentContext = {
	kind: "main" | "sub";
	id: string;
	name: string;
	depth: number;
	parentId?: string;
};

type SessionEntry = {
	id: string;
	parentId: string | null;
	type: string;
	customType?: string;
	data?: unknown;
	details?: Record<string, unknown>;
	message?: {
		role: string;
		content?:
			| string
			| Array<{
					type?: string;
					text?: string;
			  }>;
	};
};

type SessionManager = {
	getBranch(): SessionEntry[];
	getSessionId?(): string;
};

type ExtensionContext = {
	agent: AgentContext;
	sessionManager: SessionManager;
	cwd: string;
};

type BeforeAgentStartEvent = {
	prompt?: string;
	systemPrompt: string[];
	reason?: string;
};

type CompactingEvent = {
	sessionId: string;
	messages: unknown[];
};

type ToolCallEvent = {
	toolName: string;
	input: unknown;
};

type ToolResultEvent = {
	toolName: string;
	toolCallId: string;
	input: unknown;
	content?: unknown;
	details?: unknown;
	isError?: boolean;
};

type SessionStopEvent = {
	messages?: unknown[];
	turn_id?: number;
	last_assistant_message?: unknown;
	session_id?: string;
	stop_hook_active?: boolean;
	signal?: AbortSignal;
};

type WorkflowHookAPI = {
	on(event: "before_agent_start", handler: (event: BeforeAgentStartEvent, ctx: ExtensionContext) => { systemPrompt?: string[] } | void): void;
	on(event: "tool_call", handler: (event: ToolCallEvent, ctx: ExtensionContext) => { block: true; reason: string } | void): void;
	on(
		event: "session.compacting",
		handler: (event: CompactingEvent, ctx: ExtensionContext) => { context?: string[]; prompt?: string; preserveData?: Record<string, unknown> } | void,
	): void;
	on(event: "tool_result", handler: (event: ToolResultEvent, ctx: ExtensionContext) => void): void;
	on(
		event: "session_stop",
		handler: (event: SessionStopEvent, ctx: ExtensionContext) => { decision: "block"; reason: string } | { continue: true; additionalContext: string } | void,
	): void;
	appendEntry<T = unknown>(customType: string, data: T): void;
};

const CUSTOM_TYPE = "cogain.workflow";
const MAX_REWORK_CONTINUATIONS_PER_HANDLE = 2;
const MAX_AUDIT_WAVES_PER_USER_TURN = 1;
const AUDIT_AGENT_NAMES = new Set(["reviewer", "security-reviewer"]);
const SHORT_STOP_CONTROL_RE = /^\s*(?:dừng|stop|cancel|abort|hủy|thôi)\b/i;
const LIFECYCLE_POLICY_MARKER = "<!-- cogain-workflow-lifecycle -->";
const LIFECYCLE_POLICY_BLOCK = `${LIFECYCLE_POLICY_MARKER}
[Quy tắc Vận hành Xuyên Suốt & Ngôn ngữ Bắt buộc]
- NGÔN NGỮ BẮT BUỘC (AI_RULES.md §8): Mọi câu trả lời, thông báo tiến độ và báo cáo gửi người dùng PHẢI viết bằng Tiếng Việt có dấu đầy đủ (tuyệt đối không trượt sang Tiếng Anh và cấm độc thoại kể lể "Next I'm planning to..." sau nhiều lần nén ngữ cảnh); nêu kết quả và ảnh hưởng thực tế trước, không dùng từ nội bộ khó hiểu.
- Giao tiếp Main↔agent: ngắn gọn, kết luận trước, đủ bằng chứng/rủi ro/LSP; worker bàn giao qua kết quả kết thúc lượt, KHÔNG gửi thêm tin <irc> báo xong trùng lặp gây đánh thức kép Main.
- Chạy xuyên suốt theo chặng: hoàn tất toàn bộ thay đổi mã nguồn + dọn API cũ trước khi mở cổng build/test tổng; đóng băng sửa mã nguồn trong lúc verifier/test-author đang chạy kiểm tra; khi user đã cho phép chạy test, bắt buộc cấp permitted_checks để test-author tự chạy xanh cục bộ trước khi bàn giao.
- Nghỉ hưu tác vụ dài & Cô lập nhánh lỗi: tối đa 2 vòng gửi sửa tiếp trên một handle (quá 2 vòng thì tóm tắt bàn giao sang specialist mới ngữ cảnh sạch); nhánh vướng Vùng Đỏ hoặc lỗi cục bộ thì ghi vào Hộp thư Quyết định (không gọi ask chặn luồng khi còn nhánh độc lập) và chạy hết các nhánh độc lập còn lại.`;

type ContractInfo = {
	raw: string;
	isCanonical: boolean;
	contractRef?: string;
	contractVersion?: number;
};

function parseContractInfo(text: string): ContractInfo | null {
	if (!text || typeof text !== "string") return null;
	const refMatch = text.match(/^contract_ref:[ \t]*(\S+)[ \t]*$/m);
	const verMatch = text.match(/^contract_version:[ \t]*([1-9]\d*)[ \t]*$/m);
	const hasFence = /```(?:json[ \t]+)?dispatch-contract[ \t]*/m.test(text);

	if (refMatch && verMatch) {
		return {
			raw: text.trim(),
			isCanonical: true,
			contractRef: refMatch[1],
			contractVersion: Number(verMatch[1]),
		};
	}
	if (hasFence) {
		return {
			raw: text.trim(),
			isCanonical: false,
		};
	}
	return null;
}

type WorkerState = {
	version: number;
	role: "worker";
	agentName: string;
	activeContract?: ContractInfo;
	deltas: string[];
};

type TaskDispatchDecision = {
	version: 1;
	type: "task_dispatch";
	toolCallId: string;
	index: number;
	name?: string;
	agent?: string;
	handle?: string;
	contract: ContractInfo;
};

type ContinuationContractDecision = {
	version: 1;
	type: "continuation_contract";
	target: string;
	contract: ContractInfo;
};

type ContinuationDeltaDecision = {
	version: 1;
	type: "continuation_delta";
	target: string;
	delta: string;
};

type TodoSnapshotDecision = {
	version: 1;
	type: "todo_snapshot";
	openCount: number;
	completedCount: number;
	sample: string[];
};

type PlanArmedDecision = {
	version: 1;
	type: "plan_armed";
	planDir: string;
};

type AuditWaveDecision = {
	version: 1;
	type: "audit_wave";
	agents: string[];
};

type WorkflowDecisionEntry =
	| TaskDispatchDecision
	| ContinuationContractDecision
	| ContinuationDeltaDecision
	| TodoSnapshotDecision
	| PlanArmedDecision
	| AuditWaveDecision;

type MainTaskRecord = {
	id: string;
	name?: string;
	agent?: string;
	handle?: string;
	activeContract?: ContractInfo;
	deltas: string[];
	continuationCount: number;
	status: "dispatched" | "completed";
};

type UnmatchedContinuationRecord = {
	target: string;
	activeContract?: ContractInfo;
	deltas: string[];
	continuationCount: number;
};

type MainState = {
	version: number;
	role: "main";
	tasks: Record<string, MainTaskRecord>;
	unmatchedContinuations: Record<string, UnmatchedContinuationRecord>;
	planDir: string | null;
	openTodoCount: number;
	completedTodoCount: number;
	todoSample: string[];
	lastUserText: string;
	auditWaveCountSinceUser: number;
	progressMarker: number;
};

function extractMessageText(content: unknown): string {
	if (typeof content === "string") return content;
	if (Array.isArray(content)) {
		return content
			.filter(b => b && typeof b === "object" && (b.type === "text" || !b.type) && typeof b.text === "string")
			.map(b => b.text)
			.join("\n");
	}
	if (content && typeof content === "object" && "content" in (content as Record<string, unknown>)) {
		return extractMessageText((content as Record<string, unknown>).content);
	}
	return "";
}

function extractTodoSummaryFromDetails(details: unknown): { openCount: number; completedCount: number; sample: string[] } | null {
	if (!details || typeof details !== "object") return null;
	const phases = (details as { phases?: unknown }).phases;
	if (!Array.isArray(phases)) return null;
	let openCount = 0;
	let completedCount = 0;
	const sample: string[] = [];
	for (const phase of phases) {
		if (!phase || typeof phase !== "object") continue;
		const phaseName = typeof (phase as { name?: unknown }).name === "string" ? (phase as { name: string }).name : "";
		const tasks = Array.isArray((phase as { tasks?: unknown }).tasks) ? (phase as { tasks: Array<Record<string, unknown>> }).tasks : [];
		for (const t of tasks) {
			if (!t || typeof t !== "object") continue;
			const status = String(t.status ?? "");
			const text = typeof t.content === "string" ? t.content.trim() : "";
			if (status === "pending" || status === "in_progress") {
				openCount += 1;
				if (text && sample.length < 5) {
					sample.push(phaseName ? `${text} (${phaseName})` : text);
				}
			} else if (status === "completed" || status === "abandoned") {
				completedCount += 1;
			}
		}
	}
	return { openCount, completedCount, sample };
}

function extractEditedPathsFromToolInput(toolName: string, input: unknown): string[] {
	if (!input || typeof input !== "object") return [];
	const rec = input as Record<string, unknown>;
	const out: string[] = [];
	for (const k of ["path", "file_path", "Path", "TargetFile"]) {
		if (typeof rec[k] === "string" && (rec[k] as string).length > 0 && !(rec[k] as string).startsWith("agent://") && !(rec[k] as string).startsWith("xd://")) {
			out.push(rec[k] as string);
		}
	}
	if (toolName === "apply_patch" || toolName === "edit") {
		const raw = Object.values(rec)
			.filter((v): v is string => typeof v === "string")
			.join("\n");
		for (const m of raw.matchAll(/^\*\*\* (?:Add|Update) File:\s*(.+)$/gm)) {
			out.push(m[1].trim());
		}
	}
	return [...new Set(out)];
}

function reconstructWorkerState(branch: SessionEntry[], agentName: string): WorkerState {
	let activeContract: ContractInfo | undefined;
	let deltas: string[] = [];

	for (const entry of branch) {
		if (entry.type === "message" && entry.message?.role === "user") {
			const text = extractMessageText(entry.message.content);
			const contract = parseContractInfo(text);
			if (contract) {
				activeContract = contract;
				deltas = [];
			}
		} else if (entry.type === "custom_message" && entry.customType === "irc:incoming") {
			if (entry.details?.fromParent === true && typeof entry.details.message === "string") {
				const msg = entry.details.message;
				const contract = parseContractInfo(msg);
				if (contract) {
					activeContract = contract;
					deltas = [];
				} else {
					deltas.push(msg);
				}
			}
		}
	}

	return {
		version: 1,
		role: "worker",
		agentName,
		activeContract,
		deltas,
	};
}

function reconstructMainState(branch: SessionEntry[]): MainState {
	const tasks: Record<string, MainTaskRecord> = {};
	const unmatchedContinuations: Record<string, UnmatchedContinuationRecord> = {};
	let planDir: string | null = null;
	let openTodoCount = 0;
	let completedTodoCount = 0;
	let todoSample: string[] = [];
	let lastUserText = "";
	let auditWaveCountSinceUser = 0;
	let dispatchEvents = 0;

	for (const entry of branch) {
		if (entry.type === "message" && entry.message?.role === "user") {
			const txt = extractMessageText(entry.message.content);
			if (txt && !txt.startsWith("[Wait interrupted by message]")) {
				lastUserText = txt;
				auditWaveCountSinceUser = 0;
			}
			continue;
		}

		if (entry.type === "custom_message" && entry.customType === "async-result") {
			const jobs = Array.isArray(entry.details?.jobs) ? (entry.details?.jobs as Array<Record<string, unknown>>) : [];
			for (const job of jobs) {
				if (job?.status !== "completed") continue;
				const jobAgentId = typeof job.agentId === "string" ? job.agentId : typeof job.jobId === "string" ? job.jobId : "";
				if (!jobAgentId) continue;
				for (const task of Object.values(tasks)) {
					if (task.handle === jobAgentId || task.name === jobAgentId) {
						task.status = "completed";
					}
				}
			}
			continue;
		}

		if (entry.type === "custom" && entry.customType === CUSTOM_TYPE) {
			const data = entry.data as WorkflowDecisionEntry | undefined;
			if (!data || typeof data !== "object" || data.version !== 1) continue;

			if (data.type === "task_dispatch") {
				dispatchEvents += 1;
				const key = `${data.toolCallId}:${data.index}`;
				tasks[key] = {
					id: key,
					name: data.name,
					agent: data.agent,
					handle: data.handle,
					activeContract: data.contract,
					deltas: [],
					continuationCount: 0,
					status: "dispatched",
				};
				if (data.contract.contractRef) {
					const m = data.contract.contractRef.match(/^(\.agent\/planning\/[^/]+)\/TASK-[^/]+\.md$/);
					if (m) planDir = m[1];
				}
			} else if (data.type === "continuation_contract") {
				dispatchEvents += 1;
				let matched = false;
				for (const task of Object.values(tasks)) {
					if ((task.handle && task.handle === data.target) || (task.name && task.name === data.target)) {
						task.activeContract = data.contract;
						task.deltas = [];
						task.continuationCount += 1;
						task.status = "dispatched";
						matched = true;
					}
				}
				if (!matched) {
					const prev = unmatchedContinuations[data.target];
					unmatchedContinuations[data.target] = {
						target: data.target,
						activeContract: data.contract,
						deltas: [],
						continuationCount: (prev?.continuationCount ?? 0) + 1,
					};
				}
				if (data.contract.contractRef) {
					const m = data.contract.contractRef.match(/^(\.agent\/planning\/[^/]+)\/TASK-[^/]+\.md$/);
					if (m) planDir = m[1];
				}
			} else if (data.type === "continuation_delta") {
				dispatchEvents += 1;
				let matched = false;
				for (const task of Object.values(tasks)) {
					if ((task.handle && task.handle === data.target) || (task.name && task.name === data.target)) {
						task.deltas.push(data.delta);
						task.continuationCount += 1;
						matched = true;
					}
				}
				if (!matched) {
					if (!unmatchedContinuations[data.target]) {
						unmatchedContinuations[data.target] = { target: data.target, deltas: [data.delta], continuationCount: 1 };
					} else {
						unmatchedContinuations[data.target].deltas.push(data.delta);
						unmatchedContinuations[data.target].continuationCount += 1;
					}
				}
			} else if (data.type === "todo_snapshot") {
				openTodoCount = data.openCount;
				completedTodoCount = data.completedCount;
				todoSample = data.sample;
			} else if (data.type === "plan_armed") {
				planDir = data.planDir;
			} else if (data.type === "audit_wave") {
				auditWaveCountSinceUser += 1;
			}
		}
	}

	const completedTaskCount = Object.values(tasks).filter(t => t.status === "completed").length;
	return {
		version: 1,
		role: "main",
		tasks,
		unmatchedContinuations,
		planDir,
		openTodoCount,
		completedTodoCount,
		todoSample,
		lastUserText,
		auditWaveCountSinceUser,
		progressMarker: completedTodoCount * 1000 + dispatchEvents * 100 + completedTaskCount * 10,
	};
}

function countContinuationsForTarget(state: MainState, target: string): number {
	let maxCount = state.unmatchedContinuations[target]?.continuationCount ?? 0;
	for (const task of Object.values(state.tasks)) {
		if (task.handle === target || task.name === target) {
			if (task.continuationCount > maxCount) maxCount = task.continuationCount;
		}
	}
	return maxCount;
}

function resolveSessionId(ctx: ExtensionContext, fallback?: string): string {
	const fromMgr = typeof ctx.sessionManager.getSessionId === "function" ? ctx.sessionManager.getSessionId() : "";
	return fromMgr || fallback || "omp-main";
}

export default function workflowContext(pi: WorkflowHookAPI): void {
	let askWarnedInCurrentTurn = false;

	pi.on("before_agent_start", (event, ctx) => {
		if (ctx.agent.id === "advisor" || ctx.agent.name === "advisor") return;
		if (ctx.agent.kind === "main" && event.reason !== "revive" && typeof event.prompt === "string" && event.prompt.trim()) {
			askWarnedInCurrentTurn = false;
			const root = findRepoRoot(ctx.cwd);
			if (root) {
				resetSessionTurnCounters(root, resolveSessionId(ctx), { userPrompt: event.prompt });
			}
		}
		if (event.reason === "revive") return;
		if (event.systemPrompt.some(block => typeof block === "string" && block.includes(LIFECYCLE_POLICY_MARKER))) return;
		return { systemPrompt: [...event.systemPrompt, LIFECYCLE_POLICY_BLOCK] };
	});

	pi.on("tool_call", (event, ctx) => {
		try {
			if (ctx.agent.kind !== "main") return;
			if (ctx.agent.id === "advisor" || ctx.agent.name === "advisor") return;

			if (event.toolName === "ask") {
				if (askWarnedInCurrentTurn) return;
				const root = findRepoRoot(ctx.cwd);
				if (!root) return;
				const state = reconstructMainState(ctx.sessionManager.getBranch());
				const taskList = Object.values(state.tasks);
				const dispatchedRefs = taskList.map(t => t.activeContract?.contractRef).filter((x): x is string => Boolean(x));
				const completedRefs = taskList
					.filter(t => t.status === "completed")
					.map(t => t.activeContract?.contractRef)
					.filter((x): x is string => Boolean(x));
				const planStatus = state.planDir
					? inspectPlanDirRemaining(root, state.planDir, { completedRefs, dispatchedRefs })
					: { remainingSlices: [] };

				if (state.openTodoCount > 1 || planStatus.remainingSlices.length > 0) {
					askWarnedInCurrentTurn = true;
					return {
						block: true,
						reason:
							"[non-blocking-queue] CẤM gọi tool 'ask' làm treo cứng toàn bộ phiên chạy xuyên suốt khi vẫn còn hạng mục todo mở hoặc TASK chưa triển khai! " +
							"Theo AI_RULES.md §3: hãy đóng gói câu hỏi kèm đề xuất vào 'Hộp thư Quyết định', chỉ treo riêng nhánh đang vướng đó, và gọi ngay tool thực thi TẤT CẢ các nhánh/TASK độc lập còn lại trước. " +
							"(Chỉ gọi lại 'ask' nếu bạn đã kiểm chứng chắc chắn 100% phần việc còn lại đều bị chặn trực tiếp bởi câu hỏi này).",
					};
				}
				return;
			}

			if (event.toolName === "task") {
				const rawInput = (event.input ?? {}) as { agent?: unknown; tasks?: Array<{ agent?: unknown }> };
				const items = Array.isArray(rawInput.tasks) ? rawInput.tasks : [rawInput];
				const touchesAuditAgent = items.some(it => typeof it?.agent === "string" && AUDIT_AGENT_NAMES.has(it.agent));
				if (touchesAuditAgent) {
					const state = reconstructMainState(ctx.sessionManager.getBranch());
					if (state.auditWaveCountSinceUser >= MAX_AUDIT_WAVES_PER_USER_TURN) {
						return {
							block: true,
							reason:
								`[audit-loop-cap] Đã chạy đủ trần ${MAX_AUDIT_WAVES_PER_USER_TURN} đợt kiểm toán độc lập (reviewer/security-reviewer) trong lượt yêu cầu hiện tại. ` +
								`CẤM tự mở thêm vòng kiểm toán mới nối đuôi sau khi đã sửa xong hoặc sau khi cổng kiểm tra đã xanh (tránh đẻ thêm TASK mới vô tận và đốt cạn token). ` +
								`Hãy hoàn tất dứt điểm các mục đang mở, chạy cổng kiểm tra chốt một lần (nếu được cấp quyền) và bàn giao kết quả cho người dùng.`,
						};
					}
				}
			}

			if (event.toolName === "write") {
				const input = event.input as { path?: unknown; content?: unknown } | undefined;
				const path = typeof input?.path === "string" ? input.path : "";
				const content = typeof input?.content === "string" ? input.content : "";
				const match = path.match(/^agent:\/\/([^\s/]+)$/);
				if (!match || match[1] === "all") return;
				if (content.length < 100 && SHORT_STOP_CONTROL_RE.test(content)) return;

				const target = match[1];
				const state = reconstructMainState(ctx.sessionManager.getBranch());
				const usedContinuations = countContinuationsForTarget(state, target);
				if (usedContinuations >= MAX_REWORK_CONTINUATIONS_PER_HANDLE) {
					return {
						block: true,
						reason:
							`[handle-retirement-cap] Tác vụ '${target}' đã dùng đủ trần ${MAX_REWORK_CONTINUATIONS_PER_HANDLE} vòng gửi sửa tiếp qua 'write agent://${target}'. ` +
							`Nuôi tiếp cùng một handle sẽ làm phình ngữ cảnh (tăng vọt độ trễ ở cả worker lẫn bộ đôi advisor). ` +
							`Hãy dừng dùng handle '${target}', tóm tắt gọn phần việc còn lại (kèm tệp đã đổi, lỗi cụ thể và quyền kiểm tra permitted_checks nếu có) rồi gọi tool 'task' tạo một specialist mới có ngữ cảnh sạch.`,
					};
				}
			}
		} catch {
			// Fail-open an toàn
		}
		return undefined;
	});

	pi.on("tool_result", (event, ctx) => {
		if (ctx.agent.kind !== "main") return;
		if (ctx.agent.id === "advisor" || ctx.agent.name === "advisor") return;

		const root = findRepoRoot(ctx.cwd);
		const sessionId = resolveSessionId(ctx);
		if (root) {
			const errText = event.isError ? extractMessageText(event.content) : "";
			recordSessionToolOutcome(root, sessionId, { failed: Boolean(event.isError), errorText: errText });
		}
		if (event.isError === true) return;

		if (event.toolName === "todo") {
			const summary = extractTodoSummaryFromDetails(event.details);
			if (summary) {
				const entry: TodoSnapshotDecision = {
					version: 1,
					type: "todo_snapshot",
					openCount: summary.openCount,
					completedCount: summary.completedCount,
					sample: summary.sample,
				};
				pi.appendEntry(CUSTOM_TYPE, entry);
				if (root) updateSessionTodoState(root, sessionId, summary);
			}
			return;
		}

		if (event.toolName === "task") {
			const rawInput = (event.input ?? {}) as { name?: string; agent?: string; task?: string; tasks?: Array<{ name?: string; agent?: string; task?: string }> };
			const taskItems = Array.isArray(rawInput.tasks) ? rawInput.tasks : [rawInput];
			const details = event.details as { progress?: Array<{ index?: number; id?: string; agent?: string }> } | undefined;
			const progressList = Array.isArray(details?.progress) ? details.progress : [];
			const auditAgentsInBatch: string[] = [];

			taskItems.forEach((item, index) => {
				if (!item || typeof item !== "object") return;
				const taskBrief = typeof item.task === "string" ? item.task : "";
				const explicitName = typeof item.name === "string" && item.name.length > 0 ? item.name : undefined;
				const progressItem = progressList.find(p => p.index === index);
				const resolvedHandle = typeof progressItem?.id === "string" && progressItem.id.length > 0 ? progressItem.id : undefined;
				const actualAgent =
					typeof progressItem?.agent === "string" && progressItem.agent.length > 0
						? progressItem.agent
						: typeof item.agent === "string" && item.agent.length > 0
							? item.agent
							: undefined;

				if (actualAgent && AUDIT_AGENT_NAMES.has(actualAgent)) {
					auditAgentsInBatch.push(actualAgent);
				}

				const contract = parseContractInfo(taskBrief);
				if (root) {
					recordSessionDispatch(root, sessionId, {
						agentType: actualAgent,
						contractRef: contract?.contractRef ?? null,
						summary: explicitName ?? taskBrief.slice(0, 120),
					});
					const pDir = contract?.contractRef ? extractPlanDirFromPath(root, contract.contractRef) : null;
					if (pDir) {
						armSessionContinuation(root, sessionId, { planDir: pDir });
						pi.appendEntry(CUSTOM_TYPE, { version: 1, type: "plan_armed", planDir: pDir } satisfies PlanArmedDecision);
					}
				}
				if (!contract) return;

				const decision: TaskDispatchDecision = {
					version: 1,
					type: "task_dispatch",
					toolCallId: event.toolCallId,
					index,
					name: explicitName,
					agent: actualAgent,
					handle: resolvedHandle,
					contract,
				};
				pi.appendEntry(CUSTOM_TYPE, decision);
			});
			if (auditAgentsInBatch.length > 0) {
				pi.appendEntry(CUSTOM_TYPE, { version: 1, type: "audit_wave", agents: auditAgentsInBatch } satisfies AuditWaveDecision);
			}
			return;
		}

		if (event.toolName === "write" || event.toolName === "edit" || event.toolName === "apply_patch") {
			if (event.toolName === "write") {
				const input = event.input as { path?: unknown; content?: unknown } | undefined;
				const path = typeof input?.path === "string" ? input.path : "";
				const content = typeof input?.content === "string" ? input.content : "";
				const match = path.match(/^agent:\/\/([^\s/]+)$/);
				if (match) {
					const target = match[1];
					if (target === "all") return;
					const contract = parseContractInfo(content);
					if (contract) {
						pi.appendEntry(CUSTOM_TYPE, {
							version: 1,
							type: "continuation_contract",
							target,
							contract,
						} satisfies ContinuationContractDecision);
					} else {
						pi.appendEntry(CUSTOM_TYPE, {
							version: 1,
							type: "continuation_delta",
							target,
							delta: content,
						} satisfies ContinuationDeltaDecision);
					}
					return;
				}
			}

			if (root) {
				const editedPaths = extractEditedPathsFromToolInput(event.toolName, event.input);
				if (editedPaths.length > 0) {
					recordSessionEdit(root, sessionId, editedPaths);
					for (const p of editedPaths) {
						const pDir = extractPlanDirFromPath(root, p);
						if (pDir) {
							armSessionContinuation(root, sessionId, { planDir: pDir });
							pi.appendEntry(CUSTOM_TYPE, { version: 1, type: "plan_armed", planDir: pDir } satisfies PlanArmedDecision);
						}
					}
				}
			}
		}
	});

	pi.on("session.compacting", (event, ctx) => {
		if (ctx.agent.id === "advisor" || ctx.agent.name === "advisor") return;
		const branch = ctx.sessionManager.getBranch();
		const contextLines: string[] = [];

		if (ctx.agent.kind === "sub") {
			const state = reconstructWorkerState(branch, ctx.agent.name);
			if (!state.activeContract && state.deltas.length === 0) return;

			if (state.activeContract) {
				if (state.activeContract.isCanonical) {
					contextLines.push(`[Hợp đồng đang thực thi] (canonical) ref: ${state.activeContract.contractRef}, version: ${state.activeContract.contractVersion}`);
				} else {
					contextLines.push(`[Hợp đồng đang thực thi] (inline):\n${state.activeContract.raw}`);
				}
			}
			if (state.deltas.length > 0) {
				contextLines.push(
					`[Yêu cầu sửa bổ sung gần nhất] (${state.deltas.length} mục):\n` +
						state.deltas.slice(-3).map((d, i) => `--- Mục ${i + 1} ---\n${d}`).join("\n"),
				);
			}

			return {
				context: contextLines.length > 0 ? contextLines : undefined,
				preserveData: { [CUSTOM_TYPE]: state },
			};
		}

		contextLines.push(
			"[Quy tắc Ngôn ngữ & Điều phối Bắt buộc Sau Khi Nén Ngữ Cảnh]\n" +
				"- BẮT BUỘC trả lời người dùng bằng Tiếng Việt có dấu đầy đủ (AI_RULES.md §8); cấm trượt sang Tiếng Anh, cấm độc thoại 'Next I am planning to...'.\n" +
				"- Chạy xuyên suốt theo chặng: hoàn tất toàn bộ sửa mã nguồn + dọn API cũ trước khi chạy bộ test tổng; đóng băng sửa mã nguồn khi verifier/test-author đang chạy kiểm tra; tối đa 2 vòng gửi sửa tiếp trên một tác vụ con.",
		);

		const state = reconstructMainState(branch);
		const root = findRepoRoot(ctx.cwd);
		const taskList = Object.values(state.tasks);
		const unmatchedList = Object.values(state.unmatchedContinuations);

		if (state.planDir || state.openTodoCount > 0) {
			const roadmapParts: string[] = ["[Lộ trình Kế hoạch Đang Chạy - Không Dừng Non Khi Còn Hạng Mục Khả Thi]"];
			if (state.planDir) {
				roadmapParts.push(`Thư mục kế hoạch: ${state.planDir}/00-OVERVIEW.md`);
				if (root) {
					const dispatchedRefs = taskList.map(t => t.activeContract?.contractRef).filter((x): x is string => Boolean(x));
					const completedRefs = taskList
						.filter(t => t.status === "completed")
						.map(t => t.activeContract?.contractRef)
						.filter((x): x is string => Boolean(x));
					const planStatus = inspectPlanDirRemaining(root, state.planDir, { completedRefs, dispatchedRefs });
					if (planStatus.remainingSlices.length > 0) {
						roadmapParts.push(`Các TASK chưa giao (${planStatus.remainingSlices.length}): ${planStatus.remainingSlices.join(", ")}`);
					}
					if (planStatus.inFlightSlices.length > 0) {
						roadmapParts.push(`Các TASK đang chạy / chờ nghiệm thu (${planStatus.inFlightSlices.length}): ${planStatus.inFlightSlices.join(", ")}`);
					}
				}
			}
			if (state.openTodoCount > 0) {
				roadmapParts.push(`Mục todo còn mở (${state.openTodoCount} chưa xong, ${state.completedTodoCount} đã xong): ${state.todoSample.join(" | ")}`);
			}
			roadmapParts.push(
				"Quy tắc nối nhịp: Sau khi nghiệm thu mỗi phần, gọi ngay công cụ thực thi phần kế tiếp trong cùng lượt; nhánh vướng Vùng Đỏ/lỗi cục bộ thì ghi vào Hộp thư Quyết định (không gọi ask chặn luồng) và làm hết các nhánh độc lập.",
			);
			contextLines.push(roadmapParts.join("\n"));
		}

		const completedTasks = taskList.filter(t => t.status === "completed");
		const activeTasks = taskList.filter(t => t.status !== "completed");

		if (completedTasks.length > 0) {
			const compactDone = completedTasks
				.map(t => `${t.name || t.handle || t.id}${t.activeContract?.contractRef ? ` (${t.activeContract.contractRef} v${t.activeContract.contractVersion})` : ""}`)
				.join(", ");
			contextLines.push(`[Các tác vụ đã hoàn tất (${completedTasks.length})]: ${compactDone}`);
		}

		const recentActive = activeTasks.slice(-4);
		for (const task of recentActive) {
			const nameStr = task.name ? `tên=${task.name}` : "tên=chưa-đặt";
			const agentStr = task.agent ? `vai-trò=${task.agent}` : "vai-trò=chưa-rõ";
			const handleStr = task.handle ? `handle=${task.handle}` : "handle=chưa-gán";
			let line = `[Tác vụ đang mở: id=${task.id}, ${nameStr}, ${agentStr}, ${handleStr}, số-vòng-rework=${task.continuationCount}/${MAX_REWORK_CONTINUATIONS_PER_HANDLE}]`;
			if (task.activeContract) {
				if (task.activeContract.isCanonical) {
					line += ` | Hợp đồng: ${task.activeContract.contractRef} v${task.activeContract.contractVersion}`;
				} else {
					line += ` | Hợp đồng (inline):\n${task.activeContract.raw.slice(0, 1600)}`;
				}
			}
			if (task.deltas.length > 0) {
				const tailDeltas = task.deltas.slice(-2);
				line += `\nSửa tiếp gần nhất (${tailDeltas.length}/${task.deltas.length}):\n` + tailDeltas.map((d, i) => `  - ${i + 1}: ${d.slice(0, 450)}`).join("\n");
			}
			contextLines.push(line);
		}

		for (const unmatched of unmatchedList.slice(-2)) {
			let line = `[Tin sửa tiếp gửi tới: ${unmatched.target}, số-vòng=${unmatched.continuationCount}/${MAX_REWORK_CONTINUATIONS_PER_HANDLE}]`;
			if (unmatched.activeContract?.isCanonical) {
				line += ` | Hợp đồng: ${unmatched.activeContract.contractRef} v${unmatched.activeContract.contractVersion}`;
			}
			if (unmatched.deltas.length > 0) {
				line += `\nNội dung cuối: ${unmatched.deltas.at(-1)?.slice(0, 400) ?? ""}`;
			}
			contextLines.push(line);
		}

		return {
			context: contextLines,
			preserveData: { [CUSTOM_TYPE]: { planDir: state.planDir, openTodoCount: state.openTodoCount, sessionId: event.sessionId } },
		};
	});

	pi.on("session_stop", (event, ctx) => {
		try {
			if (ctx.agent.kind !== "main") return;
			if (ctx.agent.id === "advisor" || ctx.agent.name === "advisor") return;
			if (event.signal?.aborted) return;

			const root = findRepoRoot(ctx.cwd);
			if (!root) return;

			const branch = ctx.sessionManager.getBranch();
			const state = reconstructMainState(branch);
			const taskList = Object.values(state.tasks);
			const dispatchedRefs = taskList.map(t => t.activeContract?.contractRef).filter((x): x is string => Boolean(x));
			const completedRefs = taskList
				.filter(t => t.status === "completed")
				.map(t => t.activeContract?.contractRef)
				.filter((x): x is string => Boolean(x));
			const lastAssistantText = extractMessageText(event.last_assistant_message);
			const sessionId = resolveSessionId(ctx, event.session_id);

			const gate = evaluateMainStopGate(root, sessionId, {
				armed: Boolean(state.planDir) || state.openTodoCount > 0,
				planDir: state.planDir,
				openTodoCount: state.openTodoCount,
				completedTodoCount: state.completedTodoCount,
				todoSample: state.todoSample,
				dispatchedRefs,
				completedRefs,
				progressMarker: state.progressMarker,
				lastAssistantText,
				lastUserText: state.lastUserText,
				signalAborted: Boolean(event.signal?.aborted),
			});

			if (gate.decision === "block" && gate.reason) {
				return { decision: "block", reason: gate.reason };
			}
		} catch {
			// Fail-open tuyệt đối: lỗi trong hook không được khóa chết phiên OMP.
		}
		return undefined;
	});
}
