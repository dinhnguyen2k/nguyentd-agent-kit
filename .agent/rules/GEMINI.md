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
- Trách nhiệm chạy LSP (`call_mcp_tool` tới `lsp` -> `get_diagnostics`) trước bàn giao thuộc về specialist sửa code (`.cs`, `.ts`, `.tsx`), không thuộc Main.
- Khi nghiệm thu, Main đọc kết quả (`read_board` nếu dùng `swarm`) và chỉ đối chiếu `git diff` với mục `LSP:` trong báo cáo của specialist; Main không tự gọi LSP thay hoặc chạy lại thường lệ (trừ khi có mâu thuẫn cụ thể hoặc user giao Main code trực tiếp).
- Specialist bàn giao thiếu kết quả `LSP:` cho file đã sửa (kèm caller trực tiếp nếu đổi contract/signature) hoặc còn lỗi thuộc phạm vi slice thì Main nhắn trả lại đúng worker đó (`post_message` tag `@<name>` trên `swarm`, hoặc `send_message` trên subagent) để tự chạy LSP và sửa bổ sung; sau khi nghiệm thu đạt thì gọi `swarm` (`action: "kill"`) dọn worker đã xong việc.
- Chẩn đoán tĩnh từ LSP không phải lệnh validation; khi user chưa yêu cầu chạy build/lint/test thì vẫn ghi `Validation: not run - not requested` (`AI_RULES.md` §2).
