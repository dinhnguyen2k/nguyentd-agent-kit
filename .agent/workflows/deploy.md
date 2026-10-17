---
name: deploy
description: Quy trình kiểm tra và chuẩn bị triển khai ứng dụng PHP
---

# /deploy - PHP Application Deployment Preparation

$ARGUMENTS

---

## 🟢 PHASE 1: Pre-Flight Integrity Check
**Execution role**: `orchestrator` & `verifier`
**Nhiệm vụ**: Đảm bảo mã nguồn sẵn sàng trước khi đưa lên môi trường hosting/server.
- **Kiểm tra**:
  - [ ] Cú pháp PHP hợp lệ (chạy `php -l <file>` khi có yêu cầu và PHP runtime có sẵn).
  - [ ] File `composer.json` và `composer.lock` hợp lệ (`composer validate` theo yêu cầu).
  - [ ] Cấu hình database kết nối an toàn trong `db.php`, không để lộ mật khẩu trong version control.
  - [ ] Không có file tạm, debug log, hay credentials bị commit vào git.

## 🟡 PHASE 2: Release Packaging & Dependencies
**Execution role**: `orchestrator`
**Nhiệm vụ**: Chuẩn bị gói mã nguồn triển khai.
- **Hành động**:
  - Kiểm tra các dependency trong `vendor/` (nếu có dùng `composer install --no-dev --optimize-autoloader` trên server mục tiêu).
  - Đảm bảo các thư mục tài nguyên (`layout/**`, `css/**`, `js/**`, `images/**`) đầy đủ và đúng đường dẫn tương đối.
  - Thiết lập phân quyền thư mục upload/ghi log an toàn trên server (chặn quyền thực thi script trong thư mục upload).

## 🔵 PHASE 3: Target Deployment
**Execution role**: `orchestrator`
**Nhiệm vụ**: Chuyển giao mã nguồn lên server đích (Web server Apache/Nginx + PHP-FPM, cPanel, VPS).
- **Hành động**:
  - Đồng bộ file mã nguồn qua Git hoặc SSH/SFTP theo thỏa thuận triển khai của dự án.
  - Cập nhật database schema (nếu có migration/thay đổi bảng MySQL) với phương án backup trước.
  - Xác nhận web server đã cấu hình trỏ đúng document root.

## 🔴 PHASE 4: Health Audit & Verification
**Execution role**: `verifier`
**Nhiệm vụ**: Xác minh trạng thái sau triển khai.
- **Hành động**:
  - Kiểm tra HTTP status của trang chủ (`index.php`) và các trang dịch vụ (`tour-*.php`, `visa.php`, `lien-he.php`).
  - Kiểm tra trang đăng nhập `admin/**` và xác thực kết nối database MySQL hoạt động trơn tru.
  - Kiểm tra log lỗi PHP trên server (error_log) để kịp thời phát hiện exception.

---

## Quy tắc Triển khai (Deployment Rules):
- **Không tự ý chạy lệnh**: Tuân thủ chính sách on-demand, chỉ chạy lệnh kiểm tra khi người dùng yêu cầu rõ ràng.
- **Backup First**: Luôn sao lưu CSDL MySQL và mã nguồn cũ trước khi cập nhật production.
- **Bảo mật**: Tuyệt đối không để lộ thông tin kết nối CSDL, tài khoản admin, hoặc SMTP credentials.

---

## Ví dụ:
- `/deploy check`
- `/deploy verify-files`
- `/deploy post-release-audit`
