---
description: "OMP Main runtime extensions: xd://lsp timeout, dispatch-contract hook, advisor blocker & agent:// protocol, continuous overnight execution & fault isolation."
alwaysApply: true
agents: main
---

# Mở rộng Runtime OMP (chỉ phiên chính)

Mọi quy tắc gốc, cổng an toàn và định tuyến vai trò tuân theo `AI_RULES.md` và `AGENTS.md` (không chép lặp lại tại đây).
File này chỉ quy định 5 cơ chế đặc thù của runtime Oh-My-Pi:

1. **Chẩn đoán `xd://lsp` trước bàn giao**:
   - Agent sửa code chỉ kiểm tra 1 lượt cuối slice bằng **Thăm dò 1 tệp đơn (Canary Probe)**: gọi `xd://lsp diagnostics` cho đúng 1 tệp đầu tiên vừa sửa (không dùng glob) với `timeout` tối đa 8 giây; chỉ khi tệp đầu tiên phản hồi bình thường mới gọi tiếp cho các tệp còn lại.
   - Nếu tệp đầu tiên quá hạn hoặc không trả kết quả: **DỪNG NGAY** không gọi tiếp các tệp còn lại, tuyệt đối không gọi `xd://lsp` `action: reload` hay lặp lại; chuyển sang đối chiếu tĩnh chữ ký khai báo gốc/caller và báo `LSP: timeout (circuit-open, skipped remaining files)`.
2. **Giao persisted TASK qua hook `dispatch-contract.ts`**:
   - Với task nhiều slice dùng `.agent/planning/<slug>/`, Main chỉ cần truyền đúng 2 dòng `contract_ref` và `contract_version` để hook `.agent/harness/omp/hooks/pre/dispatch-contract.ts` tự trích và chèn brief đầy đủ từ canonical TASK trước khi dispatch (hỗ trợ cả đọc nguồn chung qua symlink worktree).
3. **Xử lý `advisor` blocker và giao tiếp `write agent://<id>`**:
   - Khi `advisor` báo `blocker`, worker dừng ghi/chạy lệnh và trả `blocked`; Main đối chiếu source để cấp phạm vi sửa hoặc bác bỏ có bằng chứng, tối đa 2 vòng sửa (quá 2 vòng còn sai thì cancel run và đổi owner/model/contract).
   - Rework gửi qua `write agent://<id>` chỉ chứa delta và invariant cần sửa; cấm gửi tin cảm ơn, ACK rỗng hoặc đánh thức agent đang idle chỉ để xác nhận kết thúc.
4. **Chạy xuyên suốt qua đêm & Cô lập nhánh lỗi (`Continuous Execution & Fault Isolation`)**:
   - Với tác vụ nhiều bước hoặc nhiều nhánh chạy song song, bắt buộc mở và cập nhật danh sách `todo` theo từng chặng; ngay khi nghiệm thu xong một slice, Main **phải gọi ngay công cụ `task` / bước thực thi kế tiếp trong cùng lượt**, tuyệt đối không xuất báo cáo tiến độ trung gian rồi dừng lượt (`stop=stop`) khi không còn job nền.
   - Lỗi cục bộ ở một nhánh (vướng Vùng Đỏ, lệch đường dẫn worktree, guard chặn, khóa build tạm thời) chỉ treo riêng nhánh đó và các slice phụ thuộc trực tiếp; Main bắt buộc chạy xuyên suốt hết mọi nhánh độc lập còn lại.
   - Hook `session_stop` tự động giữ phiên Main chạy tiếp nếu còn mục `todo` mở hoặc còn `TASK-*.md` chưa triển khai trong kế hoạch đang chạy (có cầu chì ngắt tự động khi không tiến triển 2 lượt liên tiếp hoặc lỗi hạ tầng lặp 3 lần); khi thực sự xong hết hoặc dừng theo yêu cầu user, cập nhật đóng/hủy sạch `todo` trước khi gửi báo cáo cuối.
5. **Vệ sinh ngữ cảnh phiên**:
   - Khi người dùng chuyển sang module hoặc tác vụ không liên quan, nhắc chạy `/compact` hoặc mở phiên mới trước khi thực hiện.
