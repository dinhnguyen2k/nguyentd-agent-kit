---
trigger: always_on
---

# AGY Runtime Extension

Nguồn luật duy nhất là `AI_RULES.md` và `AGENTS.md`.
Báo cáo trung thực mọi lỗi công cụ, build hoặc test, kể cả khi kết quả đó làm hỏng kết luận trước đó.

## Điều phối Specialist & Model Tốc Độ Cao (`gemini-4-hydrogen-high`)

- **Ưu tiên ghim `gemini-4-hydrogen-high` (Gemini 4 Hydrogen High) để chạy nhanh**:
  - Khi phiên chính đang chạy trên model lập kế hoạch nặng (`Gemini 4 Carbon`, `Gemini 4 Neon`, `Claude Opus`) hoặc khi chạy từ 2 nhánh độc lập trở lên (cả triển khai code lẫn nghiên cứu `FOCUSED` / `DEEP`, review, kiểm định), điều phối qua `swarm` (`action: "add"`, `model: "gemini-4-hydrogen-high"`, dùng `tasks: [...]` khi chia nhiều nhánh cùng vai trò để khởi chạy đồng thời không vướng tranh chấp mở trajectory DB).
  - Khi phiên chính đã chọn sẵn **Gemini 4 Hydrogen (High)** hoặc chế độ **Orchestrator** (tự ghép Planner với Executor Hydrogen High) và chỉ xử lý 1 nhánh cục bộ đơn giản (`<= 2` tệp cùng miền), gọi trực tiếp `invoke_subagent` (`TypeName: "backend-specialist" | "frontend-specialist" | "researcher"`, `Model: "inherit"`) để tận dụng sẵn `call_mcp_tool` (`lsp` -> `get_diagnostics`) mà không tốn lượt quản lý bảng tin. Nếu gọi `>= 3` `invoke_subagent` song song mà 1 nhánh báo `initialized by another opener`, chỉ gọi bù lại đúng nhánh bị trượt ở lượt kế tiếp.
- Trong `brief` của `swarm add`, yêu cầu worker đọc `.agents/agents/<role>.md` cùng `AI_RULES.md`, ghi rõ `allowed_paths` + `acceptance` (với nhánh viết code), không tự thêm `monitor`/`narrator` trừ khi user yêu cầu, và dặn đăng `@coordinator [done]` hoặc `@coordinator [blocked]` khi hoàn tất; ở lượt vừa gọi `swarm add`, Main dừng lượt để chờ tin đánh thức, nghiệm thu xong gọi `swarm` (`action: "kill"`).
- Khi worker báo `LSP: circuit-open (timeout)` hoặc cầu chì `.agent/scratch/.runtime/lsp-circuit.json` đang mở (`OPEN`), **Main TUYỆT ĐỐI KHÔNG gọi lại `get_diagnostics` lần nữa** để tránh treo phiên, mà nghiệm thu trực tiếp bằng mã nguồn tĩnh và ghi nhận minh bạch trạng thái cho người dùng; chỉ khi worker `swarm` không có `call_mcp_tool` VÀ cầu chì đang đóng (`CLOSED`) thì Main mới thăm dò `get_diagnostics` đúng 1 tệp đầu tiên trước khi gọi song song cho các tệp còn lại (tệp đầu quá hạn/lỗi thì dừng ngay và nghiệm thu tĩnh).
- Khi `get_diagnostics` báo lỗi thuộc phạm vi giao việc, Main nhắn trả đúng worker đó để sửa bổ sung trước khi `kill`; đạt 0 lỗi mới gọi `swarm` (`action: "kill"`) dọn worker.
- Chẩn đoán tĩnh từ LSP không phải lệnh validation; khi user chưa yêu cầu chạy build/lint/test vẫn ghi `Validation: not run - not requested`.

## Vòng đời Hook AGY & Bảo trì

- AGY cưỡng chế bằng 4 điểm hook trong `.agent/harness/agy/hooks.json`: `PreToolUse` (`agy/boundary-guard.mjs` kiểm R1-R10, dispatch contract, `R4` theo session và tự ghi ma sát vào `.agent/reports/agent-friction.jsonl`), `PostToolUse` + `PreInvocation` + `Stop` (`agy/lifecycle-hook.mjs` theo dõi `dirtyFiles`/LSP, phát nhịp đồng bộ tiến độ xuyên suốt mỗi 30 lượt mà không thúc nghỉ sớm, và nhắc kiểm tra tĩnh trước bàn giao tối đa 1 lần).
- Kiểm thử luật guard dùng `--sandbox` (không ghi log/trace và bỏ qua state role trên đĩa); ngoại lệ `R10` khai báo tại `enforcement.allowlist` bắt buộc có `expires_at` TTL; nâng cấp `.agent/` thực hiện theo quy trình `/upgrade-agent`.
