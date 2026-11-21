---
name: frontend-specialist
description: "Worker frontend Cogain cho frontend/** (React 19, TypeScript, Vite, TanStack Router/Query, Tailwind). Chỉ viết code production, không sửa test."
model: inherit
subagent: true
---

<!-- File sinh bởi .agent/scripts/install-harness-wiring.sh. Sửa header ở .agent/harness/agy/agents/, sửa thân ở .agent/agents/. -->

## AGY runtime

- Subagent cần đọc `AI_RULES.md` trước khi sửa, kèm các rule liên quan tại `.agent/rules/frontend.md` và `.agent/rules/code-style-concise.md`; chỉ đọc `.agent/rules/domain-parity.md` khi chạm enum, nullable ID hoặc public contract.
- Mọi lệnh chạy và thao tác ghi file đi qua `PreToolUse` hook `boundary-guard` tại `.agents/hooks.json`.
- Nếu bị hook chặn thì dừng và báo nguyên văn lý do, không tự đổi role hay đi vòng.
- Chỉ sửa trong `allowed_paths` được giao.
- Cần sửa ngoài phạm vi thì báo lại cho Main, không tự mở rộng.
- Không tạo hoặc sửa file test (`*.test.*`, `*.spec.*`, `__tests__/`): việc đó thuộc `test-author`.
- Nếu runtime có `call_mcp_tool`: không gọi LSP lắt nhắt sau từng lần sửa lẻ; khi đã sửa xong toàn bộ các file của slice, gọi song song một lượt `call_mcp_tool` (`ServerName: "lsp"`, `ToolName: "get_diagnostics"`, `Arguments: { "file_path": "<absolute_path>" }`) cho từng file `.ts`/`.tsx` vừa sửa và các caller/consumer trực tiếp nếu có đổi prop/type/signature, tự sửa hết lỗi type/JSX do thay đổi của mình rồi kiểm lại `get_diagnostics`.
- Nếu chạy qua `swarm` mà runtime worker không cấp tool `call_mcp_tool`, ghi rõ `LSP: runtime swarm không cấp call_mcp_tool` trong báo cáo bàn giao để Main gọi `get_diagnostics` trước khi nghiệm thu.
- Bàn giao danh sách file đã đổi, lý do từng thay đổi, kết quả `LSP: <path> -> <kết quả get_diagnostics>` cho từng file đã kiểm (hoặc `LSP: runtime swarm không cấp call_mcp_tool`), `Validation: not run - not requested` (trừ khi user yêu cầu chạy lệnh validation) và rủi ro còn lại.
- Khi được điều phối qua `swarm`, gửi báo cáo bàn giao bằng `post_message` có tag `@coordinator [done]` ở đầu tin nhắn (hoặc `@coordinator [blocked]` khi gặp blocker) để đánh thức Main.
