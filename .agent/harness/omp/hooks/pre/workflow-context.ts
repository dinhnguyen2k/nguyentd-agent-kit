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
		content?: string | Array<{
			type?: string;
			text?: string;
		}>;
	};
};

type SessionManager = {
	getBranch(): SessionEntry[];
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

type ToolResultEvent = {
	toolName: string;
	toolCallId: string;
	input: unknown;
	details?: unknown;
	isError?: boolean;
};

type WorkflowHookAPI = {
	on(event: "before_agent_start", handler: (event: BeforeAgentStartEvent, ctx: ExtensionContext) => { systemPrompt?: string[] } | void): void;
	on(event: "session.compacting", handler: (event: CompactingEvent, ctx: ExtensionContext) => { context?: string[]; prompt?: string; preserveData?: Record<string, unknown> } | void): void;
	on(event: "tool_result", handler: (event: ToolResultEvent, ctx: ExtensionContext) => void): void;
	appendEntry<T = unknown>(customType: string, data: T): void;
};

const CUSTOM_TYPE = "cogain.workflow";
const LIFECYCLE_POLICY_MARKER = "<!-- cogain-workflow-lifecycle -->";
const LIFECYCLE_POLICY_BLOCK = `${LIFECYCLE_POLICY_MARKER}
[Workflow Lifecycle & Communication]
- Main↔user và Main↔agent giao tiếp ngắn gọn, dễ hiểu, kết luận trước; không lặp bối cảnh, không kể lại quá trình, không diễn đạt vòng vo; chỉ giải thích sâu khi user yêu cầu, luôn giữ đầy đủ rủi ro, bằng chứng và LSP cần thiết.
- Phân biệt giao việc (cần đủ contract, recipe, evidence) với bàn giao (chỉ nêu kết quả, file thay đổi, blocker, phần chưa kiểm). Khi cần user quyết định: chỉ nêu vấn đề, đề xuất và đánh đổi chính.
- Main chốt recipe/source trước dispatch, worker xác nhận điểm sửa rồi thi hành theo đúng recipe. Rework cùng owner bằng delta và phân biệt implementation/contract-discovery/requirement change.
- Source mismatch với API đã chốt: dừng và trả Main, không đoán field.`;

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

type WorkflowDecisionEntry = TaskDispatchDecision | ContinuationContractDecision | ContinuationDeltaDecision;

type MainTaskRecord = {
	id: string;
	name?: string;
	agent?: string;
	handle?: string;
	activeContract?: ContractInfo;
	deltas: string[];
	status: "dispatched";
};

type UnmatchedContinuationRecord = {
	target: string;
	activeContract?: ContractInfo;
	deltas: string[];
};

type MainState = {
	version: number;
	role: "main";
	tasks: Record<string, MainTaskRecord>;
	unmatchedContinuations: Record<string, UnmatchedContinuationRecord>;
};

function extractMessageText(content: unknown): string {
	if (typeof content === "string") return content;
	if (Array.isArray(content)) {
		return content
			.filter(b => b && typeof b === "object" && (b.type === "text" || !b.type) && typeof b.text === "string")
			.map(b => b.text)
			.join("\n");
	}
	return "";
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

	for (const entry of branch) {
		if (entry.type === "custom" && entry.customType === CUSTOM_TYPE) {
			const data = entry.data as WorkflowDecisionEntry | undefined;
			if (!data || typeof data !== "object" || data.version !== 1) continue;

			if (data.type === "task_dispatch") {
				const key = `${data.toolCallId}:${data.index}`;
				tasks[key] = {
					id: key,
					name: data.name,
					agent: data.agent,
					handle: data.handle,
					activeContract: data.contract,
					deltas: [],
					status: "dispatched",
				};
			} else if (data.type === "continuation_contract") {
				let matched = false;
				for (const task of Object.values(tasks)) {
					if ((task.handle && task.handle === data.target) || (task.name && task.name === data.target)) {
						task.activeContract = data.contract;
						task.deltas = [];
						matched = true;
					}
				}
				if (!matched) {
					if (!unmatchedContinuations[data.target]) {
						unmatchedContinuations[data.target] = { target: data.target, activeContract: data.contract, deltas: [] };
					} else {
						unmatchedContinuations[data.target].activeContract = data.contract;
						unmatchedContinuations[data.target].deltas = [];
					}
				}
			} else if (data.type === "continuation_delta") {
				let matched = false;
				for (const task of Object.values(tasks)) {
					if ((task.handle && task.handle === data.target) || (task.name && task.name === data.target)) {
						task.deltas.push(data.delta);
						matched = true;
					}
				}
				if (!matched) {
					if (!unmatchedContinuations[data.target]) {
						unmatchedContinuations[data.target] = { target: data.target, deltas: [data.delta] };
					} else {
						unmatchedContinuations[data.target].deltas.push(data.delta);
					}
				}
			}
		}
	}

	return {
		version: 1,
		role: "main",
		tasks,
		unmatchedContinuations,
	};
}

export default function workflowContext(pi: WorkflowHookAPI): void {
	pi.on("before_agent_start", (event, ctx) => {
		if (event.reason === "revive") return;
		if (ctx.agent.id === "advisor" || ctx.agent.name === "advisor") return;
		if (event.systemPrompt.some(block => typeof block === "string" && block.includes(LIFECYCLE_POLICY_MARKER))) return;
		return { systemPrompt: [...event.systemPrompt, LIFECYCLE_POLICY_BLOCK] };
	});

	pi.on("tool_result", (event, ctx) => {
		if (ctx.agent.kind !== "main") return;
		if (ctx.agent.id === "advisor" || ctx.agent.name === "advisor") return;
		if (event.isError === true) return;

		if (event.toolName === "task") {
			const input = event.input as { tasks?: Array<{ name?: string; agent?: string; task?: string }> } | undefined;
			if (!input || !Array.isArray(input.tasks)) return;
			const details = event.details as { progress?: Array<{ index?: number; id?: string; agent?: string }> } | undefined;
			const progressList = Array.isArray(details?.progress) ? details.progress : [];

			input.tasks.forEach((item, index) => {
				if (!item || typeof item !== "object") return;
				const taskBrief = typeof item.task === "string" ? item.task : "";
				const contract = parseContractInfo(taskBrief);
				if (!contract) return;

				const explicitName = typeof item.name === "string" && item.name.length > 0 ? item.name : undefined;
				const progressItem = progressList.find(p => p.index === index);
				const resolvedHandle = typeof progressItem?.id === "string" && progressItem.id.length > 0 ? progressItem.id : undefined;
				const actualAgent = typeof progressItem?.agent === "string" && progressItem.agent.length > 0
					? progressItem.agent
					: (typeof item.agent === "string" && item.agent.length > 0 ? item.agent : undefined);

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
		} else if (event.toolName === "write") {
			const input = event.input as { path?: unknown; content?: unknown } | undefined;
			const path = typeof input?.path === "string" ? input.path : "";
			const content = typeof input?.content === "string" ? input.content : "";
			const match = path.match(/^agent:\/\/([^\s/]+)$/);
			if (!match) return;
			const target = match[1];
			if (target === "all") return;

			const contract = parseContractInfo(content);
			if (contract) {
				const decision: ContinuationContractDecision = {
					version: 1,
					type: "continuation_contract",
					target,
					contract,
				};
				pi.appendEntry(CUSTOM_TYPE, decision);
			} else {
				const decision: ContinuationDeltaDecision = {
					version: 1,
					type: "continuation_delta",
					target,
					delta: content,
				};
				pi.appendEntry(CUSTOM_TYPE, decision);
			}
		}
	});

	pi.on("session.compacting", (_event, ctx) => {
		if (ctx.agent.id === "advisor" || ctx.agent.name === "advisor") return;
		const branch = ctx.sessionManager.getBranch();
		const contextLines: string[] = [];

		if (ctx.agent.kind === "sub") {
			const state = reconstructWorkerState(branch, ctx.agent.name);
			if (!state.activeContract && state.deltas.length === 0) return;

			if (state.activeContract) {
				if (state.activeContract.isCanonical) {
					contextLines.push(`[Active Contract] (canonical) ref: ${state.activeContract.contractRef}, version: ${state.activeContract.contractVersion}`);
				} else {
					contextLines.push(`[Active Contract] (inline recipe):\n${state.activeContract.raw}`);
				}
			}
			if (state.deltas.length > 0) {
				contextLines.push(`[Active Deltas] (${state.deltas.length} items):\n` + state.deltas.map((d, i) => `--- Delta ${i + 1} ---\n${d}`).join("\n"));
			}

			return {
				context: contextLines.length > 0 ? contextLines : undefined,
				preserveData: {
					[CUSTOM_TYPE]: state,
				},
			};
		} else {
			const state = reconstructMainState(branch);
			const taskList = Object.values(state.tasks);
			const unmatchedList = Object.values(state.unmatchedContinuations);

			const hasContent = taskList.some(t => t.activeContract || t.deltas.length > 0) ||
				unmatchedList.some(u => u.activeContract || u.deltas.length > 0);

			if (!hasContent) return;

			for (const task of taskList) {
				const nameStr = task.name ? `name=${task.name}` : "name=unspecified";
				const agentStr = task.agent ? `agent=${task.agent}` : "agent=unspecified";
				const handleStr = task.handle ? `handle=${task.handle}` : "handle=unassigned";
				let line = `[Dispatched Task: id=${task.id}, ${nameStr}, ${agentStr}, ${handleStr}] Status: ${task.status}`;
				if (task.activeContract) {
					if (task.activeContract.isCanonical) {
						line += ` | Contract (canonical): ${task.activeContract.contractRef} v${task.activeContract.contractVersion}`;
					} else {
						line += ` | Contract (inline):\n${task.activeContract.raw}`;
					}
				}
				if (task.deltas.length > 0) {
					line += `\nSent continuation messages (${task.deltas.length} items):\n` + task.deltas.map((d, i) => `  - Continuation ${i + 1}: ${d}`).join("\n");
				}
				contextLines.push(line);
			}

			for (const unmatched of unmatchedList) {
				let line = `[Sent Continuation to Target: ${unmatched.target}]`;
				if (unmatched.activeContract) {
					if (unmatched.activeContract.isCanonical) {
						line += ` | Contract (canonical): ${unmatched.activeContract.contractRef} v${unmatched.activeContract.contractVersion}`;
					} else {
						line += ` | Contract (inline):\n${unmatched.activeContract.raw}`;
					}
				}
				if (unmatched.deltas.length > 0) {
					line += `\nSent continuation messages (${unmatched.deltas.length} items):\n` + unmatched.deltas.map((d, i) => `  - Continuation ${i + 1}: ${d}`).join("\n");
				}
				contextLines.push(line);
			}

			return {
				context: contextLines.length > 0 ? contextLines : undefined,
				preserveData: {
					[CUSTOM_TYPE]: state,
				},
			};
		}
	});
}
