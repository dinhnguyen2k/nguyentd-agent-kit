---
trigger: always_on
---

# AGY Runtime Extension

Nguồn luật duy nhất là `AI_RULES.md` và `AGENTS.md`.
Báo cáo trung thực mọi lỗi công cụ, build hoặc test, kể cả khi kết quả đó làm hỏng kết luận trước đó.

## Điều phối Specialist theo quy mô (Lựa chọn 1A)

- **Một nhánh cục bộ đơn giản** (chạm <= 2 file cùng một miền, không cần chạy đa luồng song song): ưu tiên gọi trực tiếp qua `invoke_subagent` (`TypeName: "backend-specialist" | "frontend-specialist"`) để subagent tự nạp sẵn profile và tự chạy `call_mcp_tool` (`lsp` -> `get_diagnostics`) sửa sạch lỗi trước bàn giao, không tốn lượt chờ trung gian.
- **Nhiều nhánh độc lập chạy song song hoặc bài toán phức tạp cần ghim cứng `gemini-4-hydrogen-high`**: dùng `swarm` (`action: "add"`, `model: "gemini-4-hydrogen-high"`), không tự thêm `monitor` hoặc `narrator` trừ khi user yêu cầu.
- Trong `brief` của `swarm add`, yêu cầu worker đọc `.agents/agents/<specialist>.md` cùng `AI_RULES.md`, khóa `allowed_paths`, và dặn đăng `@coordinator [done]` hoặc `@coordinator [blocked]` khi hoàn tất; ở lượt vừa gọi `swarm add`, Main dừng lượt để chờ tin đánh thức.
- Khi worker báo `LSP: circuit-open (timeout)` hoặc cầu chì `.agent/scratch/.runtime/lsp-circuit.json` đang mở (`OPEN`), **Main TUYỆT ĐỐI KHÔNG gọi lại `get_diagnostics` lần nữa** để tránh treo phiên, mà nghiệm thu trực tiếp bằng mã nguồn tĩnh và ghi nhận minh bạch trạng thái cho người dùng; chỉ khi worker `swarm` không có `call_mcp_tool` VÀ cầu chì đang đóng (`CLOSED`) thì Main mới thăm dò `get_diagnostics` đúng 1 tệp đầu tiên trước khi gọi song song cho các tệp còn lại (tệp đầu quá hạn/lỗi thì dừng ngay và nghiệm thu tĩnh).
- Khi `get_diagnostics` báo lỗi thuộc phạm vi giao việc, Main nhắn trả đúng worker đó để sửa bổ sung trước khi `kill`; đạt 0 lỗi mới gọi `swarm` (`action: "kill"`) dọn worker.
- Chẩn đoán tĩnh từ LSP không phải lệnh validation; khi user chưa yêu cầu chạy build/lint/test vẫn ghi `Validation: not run - not requested`.

## Vòng đời Hook AGY & Bảo trì

- AGY cưỡng chế bằng 4 điểm hook trong `.agent/harness/agy/hooks.json`: `PreToolUse` (`agy/boundary-guard.mjs` kiểm R1-R10, dispatch contract, `R4` theo session và tự ghi ma sát vào `.agent/reports/agent-friction.jsonl`), `PostToolUse` + `PreInvocation` + `Stop` (`agy/lifecycle-hook.mjs` theo dõi `dirtyFiles`/LSP, phát nhịp đồng bộ tiến độ xuyên suốt mỗi 30 lượt mà không thúc nghỉ sớm, và nhắc kiểm tra tĩnh trước bàn giao tối đa 1 lần).
- Kiểm thử luật guard dùng `--sandbox` (không ghi log/trace và bỏ qua state role trên đĩa); ngoại lệ `R10` khai báo tại `enforcement.allowlist` bắt buộc có `expires_at` TTL; nâng cấp `.agent/` thực hiện theo quy trình `/upgrade-agent`.
