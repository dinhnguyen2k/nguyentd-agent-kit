---
description: "OMP Main runtime extensions: xd://lsp timeout, dispatch-contract hook, advisor blocker & agent:// protocol, session hygiene."
alwaysApply: true
agents: main
---

# Mở rộng Runtime OMP (chỉ phiên chính)

Mọi quy tắc gốc, cổng an toàn và định tuyến vai trò tuân theo `AI_RULES.md` và `AGENTS.md` (không chép lặp lại tại đây).
File này chỉ quy định 4 cơ chế đặc thù của runtime Oh-My-Pi:

1. **Chẩn đoán `xd://lsp` trước bàn giao**:
   - Agent sửa code xử lý diagnostics từng file ở lần sửa cuối; cần truy vấn chủ động thì gọi `xd://lsp diagnostics` theo từng file (không dùng glob) với `timeout` tối đa 20 giây.
   - Nếu quá hạn hoặc không trả kết quả, gọi `xd://lsp` `action: reload` đúng 1 lần cho file đó rồi kiểm lại 1 lần; vẫn không trả thì báo `LSP: timeout` hoặc `LSP: no report` thay vì lặp tiếp.
2. **Giao persisted TASK qua hook `dispatch-contract.ts`**:
   - Với task nhiều slice dùng `.agent/planning/<slug>/`, Main chỉ cần truyền đúng 2 dòng `contract_ref` và `contract_version` để hook `.agent/harness/omp/hooks/pre/dispatch-contract.ts` tự trích và chèn brief đầy đủ từ canonical TASK trước khi dispatch.
3. **Xử lý `advisor` blocker và giao tiếp `write agent://<id>`**:
   - Khi `advisor` báo `blocker`, worker dừng ghi/chạy lệnh và trả `blocked`; Main đối chiếu source để cấp phạm vi sửa hoặc bác bỏ có bằng chứng, tối đa 2 vòng sửa (quá 2 vòng còn sai thì cancel run và đổi owner/model/contract).
   - Rework gửi qua `write agent://<id>` chỉ chứa delta và invariant cần sửa; cấm gửi tin cảm ơn, ACK rỗng hoặc đánh thức agent đang idle chỉ để xác nhận kết thúc.
4. **Vệ sinh ngữ cảnh phiên**:
   - Khi người dùng chuyển sang module hoặc tác vụ không liên quan, nhắc chạy `/compact` hoặc mở phiên mới trước khi thực hiện.
