---
name: health
description: Đánh giá chỉ đọc về độ ổn định lâu dài của codebase - điểm nóng theo churn và kích thước, nợ đã ghi, lỗi lặp, lộ trình trả nợ.
---

# /health - Đánh giá độ ổn định lâu dài

Chỉ chạy khi user yêu cầu rõ ràng (`/health`); thực hiện trực tiếp ở chế độ chỉ đọc mà không tự động spawn subagent.
Workflow này là owner duy nhất của phương pháp đánh giá health, không tạo reference/workflow thứ hai.
Mặc định chỉ đọc code, trả đánh giá kèm evidence/citation trong câu trả lời, không tự ghi báo cáo.
Chỉ khi user yêu cầu lưu nghiên cứu, ghi tại `.agent/artifacts`; không tạo output mới trong `.agent/reports/health`.
Yêu cầu `/health` không tự cấp quyền sửa code, tạo plan hoặc chạy validation.

## Luồng

1. Điểm nóng: `git log --since=90.days --name-only` trong `backend/src` và `frontend`, xếp theo số commit nhân số dòng hiện tại.
2. Đối chiếu `.planning/codebase/CONCERNS.md`, `.planning/errors/ERRORS.md`, kết quả tổng hợp ma sát từ `.agent/reports/agent-friction.jsonl` + `.agent/reports/boundary-guard.log` (qua `node .agent/scripts/summarize-friction.mjs`), độ trôi của `.agent/contracts/archetype-exemplars.json`, record merge gate (lỗi lặp, lỗi lọt tới user, verdict `blocked-user`) và ADR trong `docs/adr/`.
3. Mỗi điểm nóng hoặc nhóm ma sát lặp (`>= 2` lần): chủ kiến, giả thuyết, evidence `file:line` hoặc luật nguồn, bằng chứng cần đọc thêm, đề xuất kết tinh (chuyển thành luật tĩnh `R10`, bổ sung `archetype-exemplars.json`, cập nhật `OPINION.md` hay trả nợ code) và lý do làm lúc này.
4. Lộ trình: xếp theo lãi; mỗi khoản thành một `/plan` riêng khi user duyệt.
5. Chỉ số: lỗi lọt tới user, số vòng rework, tỉ lệ `plan-defect` và `worker-defect`, số lần CI parity đỏ.
6. Trả verdict-first: kết luận, evidence/giả thuyết chưa chốt, hành động và owner, rủi ro; không tự biến đề xuất thành source edit hoặc validation.

## Giới hạn

- Số dòng chỉ là đại diện thô cho độ phức tạp.
- Số commit phụ thuộc thói quen commit, nên so tương đối giữa các file, không so tuyệt đối.
- Chưa đọc code thì chỉ là giả thuyết, không kết luận.
