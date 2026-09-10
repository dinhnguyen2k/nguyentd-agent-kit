---
trigger: glob
glob: "**/*.{cs,ts,tsx,js,jsx}"
---

# Code style

- Khi sửa code, đọc `.editorconfig` áp dụng cho file, kể cả override trong thư mục con; dùng đúng giá trị và severity, không tự đặt style trái cấu hình.
- Viết đúng style ngay trên phần thay đổi và rà diff trước khi bàn giao; không bắt buộc chạy formatter mỗi phiên hoặc sau mỗi lần sửa.
- Chỉ chạy formatter khi người dùng yêu cầu; giới hạn file trong phạm vi tác vụ, loại migration và generated files.
- Xử lý warning/error trên dòng đang chạm; suggestion/silent không bắt buộc dọn và không phải lý do sửa lan cả file/project.
- Ưu tiên code dễ đọc; không đổi cú pháp nếu làm mất ý nghĩa hoặc thay đổi hành vi, comparer hay collection semantics.
- Với C# kế thừa `BaseService`, chỉ đổi sang primary constructor khi đã kiểm tra source và chứng minh constructor shape an toàn.
- `CS1998` là diagnostic cần kiểm tra logic async, không xử lý như hint thẩm mỹ.
