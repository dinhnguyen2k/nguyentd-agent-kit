type WorkerContext = {
	agent: { kind: "main" | "sub"; name: string };
};
type CheckpointHookAPI = {
	on(event: "agent_start" | "turn_start", handler: (event: unknown, ctx: WorkerContext) => void): void;
	on(event: "tool_result", handler: (event: unknown, ctx: WorkerContext) => { additionalContext: string } | undefined): void;
};
const WRITERS = new Set(["backend-specialist", "frontend-specialist", "test-author"]);
const WARNING_TURN = 30;
const CHECKPOINT_TURN = 40;

/** Nhắc bàn giao sớm, không đợi runtime cưỡng bức dừng rồi mới cứu context. */
export default function workerCheckpoint(pi: CheckpointHookAPI): void {
	let turns = 0;
	let notifiedTurn = 0;
	const isWorker = (ctx: WorkerContext) => ctx.agent.kind === "sub" && WRITERS.has(ctx.agent.name);
	pi.on("agent_start", (_event, ctx) => {
		if (!isWorker(ctx)) return;
		turns = 0;
		notifiedTurn = 0;
	});
	pi.on("turn_start", (_event, ctx) => {
		if (isWorker(ctx)) turns++;
	});
	pi.on("tool_result", (_event, ctx) => {
		if (!isWorker(ctx) || notifiedTurn === turns || (turns !== WARNING_TURN && turns !== CHECKPOINT_TURN)) return;
		notifiedTurn = turns;
		return {
			additionalContext: turns === WARNING_TURN
				? "Đã qua 30 turn trong run này. Giữ milestone hiện hành; không mở rộng discovery hoặc audit. Nếu phần còn lại chưa thể hoàn tất trong run, chuẩn bị checkpoint gọn để Main tiếp tục cùng owner."
				: "Đã qua 40 turn trong run này, gần soft request budget 50. Gói milestone hiện hành và chuẩn bị checkpoint: không tự dừng hay từ chối bước cần thiết chỉ vì đủ 40 turn; tiếp tục nếu acceptance còn khả thi trong run. Chỉ bàn giao partial/blocked khi có giới hạn runtime/context hoặc blocker thực tế, nêu đủ file đã sửa, việc còn lại tại symbol cụ thể, LSP ở revision cuối và finding advisor còn mở. Thiếu diagnostics thì ghi rõ chưa kiểm; không báo implemented. Không chạy validation chưa được user yêu cầu.",
		};
	});
}
