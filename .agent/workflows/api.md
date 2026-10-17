---
name: api
description: Thiết kế và triển khai API / AJAX endpoint trong ứng dụng PHP
---

## 🛠️ Quy trình Thiết kế và Triển khai API / Endpoint PHP

Quy trình này hướng dẫn xây dựng các endpoint dữ liệu (JSON/AJAX) an toàn, hiệu quả trong ứng dụng PHP thuần.

### 1. Phân tích & Đặc tả Endpoint
- **Execution role**: `orchestrator` & `backend-specialist`
- Xác định mục đích endpoint (ví dụ: AJAX tìm kiếm tour, tải thêm bài viết, submit form đặt tour).
- Thống nhất phương thức HTTP (GET cho tra cứu dữ liệu, POST cho gửi/thay đổi dữ liệu).
- Định nghĩa định dạng dữ liệu đầu vào và cấu trúc JSON trả về (`{ "success": true, "data": [...], "message": "..." }`).

### 2. Triển khai Logic Backend
- **Execution role**: `backend-specialist`
- Thiết lập header phản hồi JSON:
  ```php
  header('Content-Type: application/json; charset=utf-8');
  ```
- Kiểm tra tính hợp lệ của tham số (`$_GET` hoặc `$_POST` hoặc `php://input`).
- Thực hiện truy vấn cơ sở dữ liệu qua **PDO MySQL** bằng prepared statements.
- Xử lý mã lỗi HTTP phù hợp: `http_response_code(200)`, `400`, `401`, `404`, `500`.
- Xuất dữ liệu bằng `echo json_encode($data, JSON_UNESCAPED_UNICODE); exit;`.

### 3. Kiểm định & Bảo mật
- **Execution role**: `verifier`
- Kiểm tra phòng chống SQL Injection (luôn dùng tham số liên kết trong PDO).
- Kiểm tra xác thực và phân quyền (ví dụ: các endpoint admin trong `admin/**` phải kiểm tra session đăng nhập).
- Kiểm tra chống CSRF đối với các endpoint nhận POST form.

### 4. Tài liệu hóa
- **Execution role**: `orchestrator`
- Mô tả endpoint, các tham số bắt buộc, và cấu trúc mẫu phản hồi vào tài liệu kỹ thuật hoặc ghi chú trong code.
