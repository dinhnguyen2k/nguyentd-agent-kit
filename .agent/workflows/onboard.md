---
name: onboard
description: Hướng dẫn thành viên mới tiếp cận và làm quen với dự án PHP Long Phát
---

# /onboard - Team Onboarding Guide

$ARGUMENTS

---

## Nhiệm vụ
Hỗ trợ lập trình viên mới nắm bắt cấu trúc dự án và thiết lập môi trường phát triển nhanh chóng, an toàn.

### Các bước Thực hiện:

1. **Tìm hiểu Kiến trúc Ứng dụng**:
   - Đọc tóm tắt kiến trúc tại `.agent/ARCHITECTURE.md` (hoặc `.vi.md`).
   - Nắm cấu trúc dự án:
     - Các file PHP gốc: `index.php`, `tour-*.php`, `visa.php`, `blog.php`, `lien-he.php`.
     - Phân hệ quản trị: `admin/**`.
     - Tầng dữ liệu: `db.php` sử dụng kết nối PDO MySQL.
     - Tầng giao diện: `layout/**`, `css/**`, `js/**`, `images/**`.
     - Thư viện phụ thuộc: `composer.json` (`phpmailer/phpmailer`).

2. **Thiết lập Môi trường Cục bộ**:
   - Kiểm tra runtime PHP trên máy phát triển (`php -v`).
   - Cài đặt dependency qua Composer: `composer install` (nếu thư mục `vendor/` chưa được cài đặt).
   - Thiết lập cơ sở dữ liệu MySQL và cấu hình thông số kết nối trong `db.php` (lưu ý tuyệt đối không commit thông tin mật khẩu lên git).

3. **Chạy Thử nghiệm Cục bộ**:
   - Khởi động web server tích hợp của PHP khi làm việc local:
     ```bash
     php -S 127.0.0.1:8000 -t .
     ```
   - Truy cập `http://127.0.0.1:8000` trên trình duyệt.
   - *Lưu ý*: Máy trạm cần cài đặt PHP CLI và dịch vụ MySQL để các trang động hiển thị đầy đủ dữ liệu.

4. **Tác vụ Làm quen (First Good Task)**:
   - Thử nghiệm chỉnh sửa một thành phần nhỏ trong `layout/footer.php` hoặc `css/style.css`.
   - Kiểm tra luồng dữ liệu từ truy vấn CSDL trong `db.php` đến file hiển thị.

---

## Lệnh Sử dụng:
```
/onboard        # Bắt đầu hướng dẫn tương tác
/onboard docs   # Xem danh sách tài liệu hướng dẫn và liên kết quan trọng
```
