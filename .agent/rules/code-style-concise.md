---
trigger: glob
glob: "**/*.{php,js,css,html}"
description: "Quy tắc phong cách viết code ngắn gọn, chuẩn xác cho PHP, HTML, CSS và JavaScript: thụt lề, guard clauses, diff sạch và hạn chế format lan man."
---

# Code style - PHP, HTML, CSS & JavaScript

- Khi sửa code, đọc `.editorconfig` áp dụng cho file (nếu có); dùng đúng thụt lề và quy cách hiện hữu của file đang sửa (thường là 4 spaces cho PHP, nhất quán cho CSS/JS/HTML), không tự đặt style trái cấu hình hoặc gây xáo trộn diff.
- Viết đúng style ngay trên phần thay đổi và rà soát lại `git diff` trước khi bàn giao; không tự ý chạy công cụ format tự động làm thay đổi hàng loạt dòng không liên quan.
- Chỉ chạy formatter khi người dùng yêu cầu cụ thể; giới hạn phạm vi file chặt chẽ trong tác vụ được giao.
- Xử lý lỗi/cảnh báo trên dòng code đang chạm; không lấy lý do format để sửa lan sang các hàm hoặc module khác ngoài phạm vi.
- Ưu tiên code ngắn gọn, trực diện và dễ đọc:
  - Trong PHP: Sử dụng cú pháp mảng ngắn `[]` thay cho `array()`, dùng toán tử `??` (null coalescing) và toán tử ternary rút gọn khi kiểm tra dữ liệu mảng.
  - So sánh an toàn: Dùng so sánh nghiêm ngặt `===` và `!==` khi kiểm tra kiểu dữ liệu hoặc giá trị boolean/null/chuỗi.
  - Giảm độ sâu lồng khối: Sử dụng Guard Clauses (kiểm tra điều kiện sai để `return` hoặc `redirect` sớm) thay vì lồng nhiều tầng `if-else` phức tạp làm thụt lề code quá sâu.
  - Trong procedural PHP: Phân tách rõ các khối logic: (1) Khởi động session & auth guard -> (2) Nhận & validate input -> (3) Xử lý CSDL / nghiệp vụ -> (4) Render template hoặc chuyển hướng.
