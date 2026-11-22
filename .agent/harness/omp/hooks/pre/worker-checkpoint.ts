type WorkerContext = {
	agent: { kind: "main" | "sub"; name: string };
};
type CheckpointHookAPI = {
	on(event: "agent_start" | "turn_start", handler: (event: unknown, ctx: WorkerContext) => void): void;
	on(event: "tool_result", handler: (event: unknown, ctx: WorkerContext) => { additionalContext: string } | undefined): void;
};

const ROLE_BUDGETS: Record<string, { soft: number; warn: number; checkpoint: number }> = {
	"backend-specialist": { soft: 90, warn: 45, checkpoint: 70 },
	"frontend-specialist": { soft: 90, warn: 45, checkpoint: 70 },
	"test-author": { soft: 80, warn: 40, checkpoint: 60 },
	verifier: { soft: 60, warn: 35, checkpoint: 48 },
	reviewer: { soft: 60, warn: 35, checkpoint: 48 },
	"security-reviewer": { soft: 60, warn: 35, checkpoint: 48 },
	researcher: { soft: 65, warn: 40, checkpoint: 52 },
};

/** Nhắc bàn giao theo đúng ngân sách từng vai trò, không ngắt non slice nền lớn ở turn 30/40. */
export default function workerCheckpoint(pi: CheckpointHookAPI): void {
	let turns = 0;
	let notifiedTurn = 0;
	const budgetFor = (ctx: WorkerContext) => (ctx.agent.kind === "sub" ? ROLE_BUDGETS[ctx.agent.name] : undefined);
	pi.on("agent_start", (_event, ctx) => {
		if (!budgetFor(ctx)) return;
		turns = 0;
		notifiedTurn = 0;
	});
	pi.on("turn_start", (_event, ctx) => {
		if (budgetFor(ctx)) turns++;
	});
	pi.on("tool_result", (_event, ctx) => {
		const cfg = budgetFor(ctx);
		if (!cfg || notifiedTurn === turns || (turns !== cfg.warn && turns !== cfg.checkpoint)) return;
		notifiedTurn = turns;
		return {
			additionalContext:
				turns === cfg.warn
					? `Đã qua ${cfg.warn} turn trong run này (soft budget: ${cfg.soft}). Gom song song các lệnh đọc/sửa/diagnostics còn lại theo lô thay vì đi từng tệp một; giữ chặt milestone hiện hành, không mở rộng khảo sát ngoài allowed_paths.`
					: `Đã qua ${cfg.checkpoint} turn trong run này, gần soft request budget ${cfg.soft} (dừng cứng ở ${Math.floor(cfg.soft * 1.5)}). Không tự dừng nếu acceptance sắp hoàn tất trong vài bước tới; chỉ bàn giao partial/blocked khi không kịp hoàn tất hoặc có blocker thực tế, ghi rõ file đã sửa, symbol còn lại, LSP ở revision cuối và finding advisor còn mở.`,
		};
	});
}
