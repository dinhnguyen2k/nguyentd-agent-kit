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
- Nếu worker `swarm` không có `call_mcp_tool`, worker ghi rõ trong báo cáo bàn giao và Main gọi song song một lượt `call_mcp_tool` (`lsp` -> `get_diagnostics`) cho các file sửa trước khi nghiệm thu.
- Khi `get_diagnostics` báo lỗi thuộc phạm vi giao việc, Main nhắn trả đúng worker đó để sửa bổ sung trước khi `kill`; đạt 0 lỗi mới gọi `swarm` (`action: "kill"`) dọn worker.
- Chẩn đoán tĩnh từ LSP không phải lệnh validation; khi user chưa yêu cầu chạy build/lint/test vẫn ghi `Validation: not run - not requested`.
