# NguyenTD's Opinions

Chỉ áp dụng khi `AI_RULES.md` và rule miền chưa quyết định.

## PHP thực dụng

- Giữ PHP thuần/PDO nếu nó giải quyết đúng bài toán; không thêm framework chỉ để chuẩn hóa cấu trúc.
- Tách helper khi có logic lặp thật; không bọc PDO bằng repository chỉ để chuyển tiếp lời gọi.
- Bắt lỗi PDO/PHPMailer tại boundary xử lý được nó; log an toàn, không lộ SQL/credential và không báo thành công giả.
- Giữ URL, form và giao diện tiếng Việt hiện có trừ khi yêu cầu đổi.
