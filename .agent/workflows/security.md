---
name: security
description: Rà soát lỗ hổng và thắt chặt bảo mật cho ứng dụng PHP / MySQL
---

# /security - Professional Armor & Security Audit

$ARGUMENTS

---

## 🟢 PHASE 1: Attack Surface Mapping
**Execution role**: `orchestrator`
**Nhiệm vụ**: Xác định toàn bộ bề mặt tấn công của ứng dụng PHP.
- **Điểm vào dữ liệu**: Các form POST/GET trên các trang công khai (`lien-he.php`, `search-redirect.php`, bộ lọc tour) và các trang trong `admin/**`.
- **Điểm tương tác CSDL**: Toàn bộ các vị trí thực thi câu lệnh SQL PDO trong `db.php`, `admin/**`, và các file root.
- **Điểm tải tệp**: Các form upload hình ảnh tour, bài viết, banner trong khu vực admin.
- **Cơ chế xác thực**: Đăng nhập, session cookie và kiểm tra quyền trong `admin/**`.

## 🟡 PHASE 2: Vulnerability Analysis
**Execution role**: `verifier`
**Nhiệm vụ**: Phân tích các nguy cơ bảo mật theo chuẩn OWASP Top 10 cho PHP:
- **SQL Injection**: Kiểm tra xem có câu truy vấn PDO nào nối chuỗi biến trực tiếp thay vì dùng prepared statements và tham số ràng buộc (`:param` hoặc `?`).
- **Cross-Site Scripting (XSS)**: Kiểm tra các biến lấy từ CSDL hoặc request khi in ra HTML có được bọc qua `htmlspecialchars($val, ENT_QUOTES, 'UTF-8')` không.
- **Cross-Site Request Forgery (CSRF)**: Kiểm tra các form POST quan trọng (thêm/sửa/xóa tour, đổi mật khẩu) đã có CSRF token trong session chưa.
- **Broken Authentication**: Kiểm tra việc lưu trữ mật khẩu có dùng `password_hash()` chuẩn không (tuyệt đối không dùng MD5, SHA1 hoặc plaintext).
- **Insecure File Upload**: Kiểm tra cơ chế upload: Có whitelist extension không? Có đổi tên file ngẫu nhiên không? Có chặn thực thi `.php` trong thư mục upload không?
- **Phụ thuộc bên thứ ba**: Kiểm tra `composer audit` (khi môi trường có Composer) để rà quét CVE thư viện `phpmailer/phpmailer`.

## 🔵 PHASE 3: Surgical Hardening
**Execution role**: `backend-specialist`
**Nhiệm vụ**: Vá các lỗ hổng theo thứ tự ưu tiên:
- Chuyển đổi mọi câu lệnh SQL sang PDO Prepared Statements.
- Bổ sung `htmlspecialchars()` cho các vị trí hiển thị dữ liệu người dùng.
- Thêm header bảo mật: `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Content-Security-Policy`.
- Cấu hình session an toàn: `session.cookie_httponly = 1`, `session.cookie_samesite = 'Lax'`.

## 🔴 PHASE 4: Verification & Compliance Report
**Execution role**: `verifier`
**Nhiệm vụ**: Xác nhận hệ thống đã được gia cố an toàn.
- Kiểm tra lại các điểm vừa vá.
- Đảm bảo thông tin đăng nhập CSDL và SMTP không bao giờ bị hardcode hoặc lộ trong log.
- Tạo bảng đánh giá rủi ro an toàn thông tin trong `walkthrough.md`.

---

## Nguyên tắc An toàn Tuyệt đối:
- **Không Hardcode**: Không bao giờ commit mật khẩu CSDL hoặc thông tin nhạy cảm vào Git.
- **Validate Input, Escape Output**: Không bao giờ tin tưởng dữ liệu đầu vào; luôn escape khi hiển thị ra HTML.
- **Fail-Closed**: Khi kết nối CSDL hoặc kiểm tra phân quyền thất bại, chặn quyền truy cập ngay lập tức, không để lộ thông tin nhạy cảm của hệ thống.

---

## Ví dụ:
- `/security audit sql injection in admin queries`
- `/security harden file upload in admin tours`
- `/security check xss protection across public templates`
