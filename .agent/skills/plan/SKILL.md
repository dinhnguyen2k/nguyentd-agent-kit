---
name: plan
description: "Main nghiên cứu, chốt giải pháp và giao contract thực thi gọn. Use when creating an actionable implementation plan."
---

# /plan

$ARGUMENTS

Đọc `.agent/workflows/plan.md` để áp dụng protocol duy nhất cho discovery, contract, dispatch và artifact ownership.
Không tạo thêm template hoặc chép workflow vào đầu ra.

- Main chốt giải pháp có bằng chứng; worker xác nhận source và implement, không nghiên cứu lại tính khả thi.
- Plan chỉ giữ quyết định và ràng buộc làm thay đổi hành động; bỏ boilerplate, section rỗng, lịch sử suy luận và phương án đã loại.
- TASK hiện hành đủ để làm, không lặp metadata/prose hoặc ghép yêu cầu từ overview/TASK cũ; vẫn phải đọc source/test/pattern theo risk.
- Việc nhỏ dùng brief gọn; persist, validation, generation và installer chỉ trong quyền user đã cấp.
- Thiếu quyết định ảnh hưởng correctness thì chưa dispatch; bàn giao chỉ nêu kết quả đã chốt, path thật, blocker và phần chưa kiểm.

Chỉ đọc reference supersession theo trigger tại workflow; không load protocol lifecycle chi tiết để tạo plan mới thông thường.
