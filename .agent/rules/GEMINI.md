---
trigger: always_on
---

# Cross-Harness Extension

`AI_RULES.md` là nguồn sự thật, `OPINION.md` là cách nghĩ khi luật im lặng, routing và context policy nằm trong `AGENTS.md`.
Báo cáo trung thực lỗi tool/build/test, kể cả khi nó làm hỏng kết luận trước đó.

## Điều phối Specialist & Model trên AGY

- Main chạy theo model do user tuỳ chọn ở phiên hiện tại; riêng các specialist (`backend-specialist`, `frontend-specialist`, `test-author`, `verifier`, `reviewer`) mặc định luôn ghim chạy `gemini-4-hydrogen-high` (Gemini 4 Hydrogen High) thông qua tool `swarm` (`action: "add"`, `model: "gemini-4-hydrogen-high"`), trừ khi user yêu cầu đích danh model khác.
- Không tự tạo thêm worker `monitor` hoặc `narrator` khi dùng `swarm` cho các slice thông thường để tránh tốn thêm lượt và quota; chỉ tạo khi user yêu cầu chạy swarm lớn đa luồng.
- Trong `brief` của `swarm add`, yêu cầu worker đọc `.agents/agents/<specialist>.md` và `AI_RULES.md` trước khi làm, nêu rõ phạm vi `allowed_paths`, và dặn đăng `@coordinator [done]` (hoặc `@coordinator [blocked]`) kèm báo cáo bàn giao khi xong; ở lượt vừa gọi `swarm add`, Main kết thúc lượt để chờ tin `@coordinator` đánh thức (vì `read_board`/`post_message`/`swarm_wait` xuất hiện ở lượt kế tiếp).
- Nếu specialist có tool `call_mcp_tool` (subagent trực tiếp), specialist tự chạy `lsp` -> `get_diagnostics` một lượt cho các file `.cs`/`.ts`/`.tsx` vừa sửa (kèm caller trực tiếp nếu đổi signature/contract) trước bàn giao; Main đọc mục `LSP:` trong báo cáo và đối chiếu với `git diff`, không tự chạy lại thường lệ.
- Nếu specialist chạy qua `swarm` mà runtime worker không cấp tool `call_mcp_tool`, worker ghi rõ `LSP: runtime swarm không cấp call_mcp_tool` trong báo cáo bàn giao và Main bắt buộc gọi song song một lượt `call_mcp_tool` (`lsp` -> `get_diagnostics`) cho toàn bộ file sửa trước khi nghiệm thu (không nhắn trả bắt worker chạy công cụ mà runtime không cấp).
- Khi kết quả `get_diagnostics` có lỗi thuộc phạm vi slice, Main nhắn trả lại đúng worker đó (`post_message` tag `@<name>` trước khi `kill`, hoặc `send_message`) để sửa bổ sung; nghiệm thu đạt 0 lỗi mới gọi `swarm` (`action: "kill"`) dọn worker.
- Chẩn đoán tĩnh từ LSP không phải lệnh validation; khi user chưa yêu cầu chạy build/lint/test thì vẫn ghi `Validation: not run - not requested` (`AI_RULES.md` §2).
