---
trigger: glob
glob: "composer.json,composer.lock"
description: "Quy trình kiểm soát tương thích phiên bản PHP, Composer dependencies (PHPMailer) và môi trường CSDL MySQL."
---

# SERVICE-VERSION-COMPATIBILITY.MD - Tương Thích Phiên Bản PHP, MySQL & Composer

> **Mục tiêu**: Đảm bảo tính tương thích và vận hành ổn định giữa môi trường runtime PHP của máy chủ, các gói phụ thuộc Composer (hiện tại `phpmailer/phpmailer ^6.10`), và hệ quản trị CSDL MySQL.

---

## 1. Tương Thích Phiên Bản Môi Trường PHP

1. **Không giả định phiên bản PHP quá mới**:
   - Xác nhận PHP version thực tế từ runtime/deployment và Composer platform constraints trước khi chọn cú pháp.
   - Không tự nâng runtime hoặc ép tương thích phiên bản cũ đã hết hỗ trợ; báo rủi ro và đề xuất nâng cấp riêng nếu phát hiện.
2. **Kiểm tra extension theo đường chạy thực tế**:
   - PDO và `pdo_mysql` cho kết nối MySQL.
   - `fileinfo` nếu dùng kiểm MIME upload; `mbstring` nếu code thực sự gọi hàm `mb_*`.
   - `openssl` nếu SMTP dùng TLS; PHPMailer SMTP không mặc định cần `curl`.
   - Đối chiếu Composer platform requirements và runtime; không khẳng định extension đã cài khi chưa kiểm.

---

## 2. Quản Lý Phụ Thuộc Composer & SemVer

1. **Nguồn sự thật về phụ thuộc**:
   - `composer.json` và `composer.lock` là nguồn sự thật cho các thư viện bên thứ ba.
   - Hiện tại ứng dụng sử dụng: `phpmailer/phpmailer: ^6.10`.
   - **CẤM** tự ý cài đặt thêm các framework hoặc thư viện nặng (như Laravel, Symfony components, ORM cồng kềnh) khi chưa có yêu cầu rõ ràng từ người dùng.
2. **Quy ước SemVer (Semantic Versioning)**:
   - Khi cập nhật thư viện trong `composer.json`:
     - Giữ nguyên ràng buộc phiên bản tương thích ngược (`^6.10`).
     - Chỉ nâng cấp Minor/Patch để nhận bản vá lỗi bảo mật.
3. **Kiểm tra tính hợp lệ của Composer**:
   - Khi có thay đổi trong `composer.json`, kiểm tra tính hợp lệ bằng lệnh: `composer validate` (chỉ thực hiện theo yêu cầu on-demand và khi môi trường có sẵn Composer CLI).

---

## 3. Tương Thích Hệ Quản Trị CSDL MySQL

1. **Chuẩn hóa cú pháp SQL**:
   - Xác nhận engine và phiên bản MySQL/MariaDB thực tế trước khi chọn cú pháp SQL.
   - Không mặc định MySQL 5.7 hoặc 8.0; không buộc hạ cú pháp nếu runtime hiện có hỗ trợ.
2. **Bộ mã ký tự UTF-8 (Charset & Collation)**:
   - Dùng `utf8mb4` khi thiết kế mới; kiểm charset/collation hiện có trước khi đổi kết nối/schema, không tự migrate bảng hoặc áp collation cố định.

---

## 4. Tương Thích Giữa Trang Khách (Public) & Module Quản Trị (Admin)

1. **Đồng bộ khi thay đổi dữ liệu**:
   - Khi cập nhật logic nghiệp vụ hoặc trường dữ liệu (ví dụ: thêm thông tin giá tour, trạng thái visa, banner liên kết), bắt buộc rà soát và cập nhật đồng bộ ở cả hai phía:
     - Phía hiển thị khách: các trang root `*.php` (`index.php`, `tour-detail.php`, `visa.php`...).
     - Phía quản trị: các module tương ứng trong `admin/**` (`admin/tour/**`, `admin/visa/**`...).
2. **Không để đứt gãy luồng người dùng**:
   - Không xóa hoặc đổi tên các cột CSDL mà phía giao diện khách đang truy vấn để tránh làm vỡ giao diện website.
