---
name: deploy
description: "Quy trình triển khai ứng dụng web PHP lên máy chủ sản xuất. Use when preparing deployment scripts, configuring web server/PHP runtime, or shipping code to production."
---

# /deploy - Production Release System

Quy trình triển khai ứng dụng web PHP lên môi trường staging hoặc production.

---

## 🟢 PHASE 1: Pre-Flight Integrity Check
**Execution role**: `deployment role` & `security review role`
**Mission**: Đảm bảo mã nguồn sẵn sàng triển khai an toàn.
- **Action**: Kiểm tra cú pháp PHP và cấu hình Composer khi có runtime:
  - Cú pháp: `php -l <file.php>` cho các file thay đổi (nếu có `php` CLI).
  - Cấu hình gói: `composer validate --no-check-publish`.
- **Checklist**:
  - [ ] Không có lỗi cú pháp PHP.
  - [ ] Biến môi trường CSDL (`DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS`) và SMTP (`SMTP_HOST`, `SMTP_PASS`) đã sẵn sàng trên production.
  - [ ] Thư mục tải lên (`uploads/`) có quyền ghi hợp lệ (0755) và tắt thực thi file `.php`.
  - [ ] Không chứa thông tin bí mật hoặc file cấu hình cục bộ trong mã nguồn.

## 🟡 PHASE 2: Dependency & Asset Preparation
**Execution role**: `deployment role`
**Mission**: Chuẩn bị các gói phụ thuộc production.
- **Action**: Cài đặt vendor tối ưu hóa (khi có Composer):
  ```bash
  composer install --no-dev --optimize-autoloader
  ```
- **Gate**: Dừng và kiểm tra checklist trước khi đẩy code lên server.

## 🔵 PHASE 3: Surgical Deployment
**Execution role**: `deployment role`
**Mission**: Cập nhật mã nguồn trên máy chủ web (Apache / Nginx / PHP-FPM).
- **Action**: Triển khai qua Git pull, rsync hoặc pipeline CI/CD đã được cấu hình.
- **Database**: Chạy các câu lệnh SQL migration tương thích ngược (nếu có thay đổi cấu trúc bảng).

## 🔴 PHASE 4: Health Audit & Verification
**Execution role**: `performance-optimizer` & `incident-responder`
**Mission**: Xác nhận ứng dụng hoạt động bình thường trên môi trường thực tế.
- **Action**: Kiểm tra mã phản hồi HTTP (200 OK) tại trang chủ (`/`), danh sách tour và trang quản trị.
- **Action**: Xác nhận kết nối PDO CSDL thành công trong log máy chủ web.
- **Artifact**: Báo cáo trạng thái triển khai và kiểm tra sức khỏe hệ thống cho người dùng.

---

## Deployment Rules:
- **No Yolo-Deploy**: Không bao giờ triển khai mà chưa kiểm tra tính toàn vẹn cú pháp và cấu hình.
- **Rollback Ready**: Luôn có phương án sao lưu CSDL và mã nguồn trước khi deploy để quay lại phiên bản trước nếu có sự cố.
- **Zero Downtime**: Đảm bảo không làm gián đoạn trải nghiệm của khách hàng truy cập website.
