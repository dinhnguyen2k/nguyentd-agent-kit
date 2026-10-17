---
trigger: glob
glob: "**/*.{php,sql,js,json,html}"
description: "Quy tắc bảo mật và tuân thủ cho PHP/MySQL: SQL Injection, XSS, CSRF, session auth, file upload an toàn, PHPMailer errors và quản lý secrets."
---

# SECURITY-COMPLIANCE.MD - Quy Tắc Bảo Mật & Tuân Thủ Cho Ứng Dụng Web PHP

> **Mục tiêu**: Đảm bảo an toàn thông tin hệ thống, phòng ngừa triệt để các lỗ hổng bảo mật web phổ biến (OWASP Top 10) trong môi trường PHP và MySQL: SQL Injection, XSS, CSRF, File Upload RCE, Session Hijacking/Fixation, và lộ lọt dữ liệu nhạy cảm.

---

## 🚫 1. Cấm Tuyệt Đối (Forbidden Actions)

1. **Hardcode Secrets**: Tuyệt đối không viết mật khẩu CSDL, tài khoản/mật khẩu SMTP của PHPMailer, hoặc API key trực tiếp trong mã nguồn commit lên git.
2. **Commit Token / Config Nhạy Cảm**: Đảm bảo các file chứa secret, mật khẩu thực tế hoặc biến môi trường phải nằm trong `.gitignore`.
3. **Phá Hủy Dữ Liệu**: Tuyệt đối không chạy lệnh xóa database thô (`DROP TABLE`, `TRUNCATE TABLE`, xóa database) trừ khi được người dùng yêu cầu rõ ràng và qua các bước xác nhận.
4. **Upload File Thực Thi**: Nghiêm cấm cho phép upload các file mã thực thi (`.php`, `.phtml`, `.php5`, `.sh`, `.exe`, `.cgi`, `.pl`) vào thư mục lưu trữ của máy chủ web.

---

## 🛡️ 2. Tiêu Chuẩn Code An Toàn Cốt Lõi (Coding Standards)

### 2.1. Phòng Chống SQL Injection - BẮT BUỘC
*   **Prepared Statements**: Mọi giá trị đến từ người dùng (`$_GET`, `$_POST`, `$_COOKIE`) khi đưa vào câu lệnh SQL bắt buộc phải sử dụng Prepared Statements với tham số hóa của PDO:
    ```php
    $stmt = $pdo->prepare('SELECT * FROM tours WHERE id = :id AND status = :status');
    $stmt->execute([':id' => $tourId, ':status' => 1]);
    ```
*   **TUYỆT ĐỐI CẤM**: Nối chuỗi trực tiếp dữ liệu người dùng vào câu SQL (`"SELECT * FROM users WHERE email = '" . $_POST['email'] . "'"`).
*   **Identifier Allowlists**: Đối với các thành phần không thể bind qua tham số (tên bảng, tên cột, hướng sắp xếp `ASC`/`DESC`), bắt buộc dùng danh sách trắng (allowlist) được kiểm tra chặt chẽ bằng `in_array($input, $allowedList, true)` trước khi ráp vào câu lệnh.

### 2.2. Phòng Chống XSS (Cross-Site Scripting) - BẮT BUỘC
*   **Contextual HTML Escaping**: Mọi dữ liệu xuất ra màn hình HTML bắt buộc phải được bọc trong hàm escape an toàn:
    ```php
    <?php echo htmlspecialchars($data ?? '', ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
    ```
*   **Dữ liệu trong thuộc tính HTML**: Luôn đặt giá trị trong cặp dấu nháy kép `"` và escape bằng `ENT_QUOTES`.
*   **Dữ liệu truyền vào JavaScript**: Khi nhúng dữ liệu từ PHP vào thẻ `<script>`, bắt buộc dùng `json_encode` với các cờ an toàn:
    ```php
    const config = <?php echo json_encode($data, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP); ?>;
    ```

### 2.3. Phòng Chống CSRF (Cross-Site Request Forgery) - BẮT BUỘC
*   **Áp dụng**: Bắt buộc cho mọi form thực hiện thao tác ghi (POST/PUT/DELETE) và thao tác đăng xuất (logout).
*   **Quy trình sinh và xác thực**:
    1. Sinh token ngẫu nhiên lưu trong session:
       ```php
       if (empty($_SESSION['csrf_token'])) {
           $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
       }
       ```
    2. Nhúng vào form qua thẻ ẩn:
       ```html
       <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($_SESSION['csrf_token'], ENT_QUOTES, 'UTF-8'); ?>">
       ```
    3. Kiểm tra bằng `hash_equals` tại backend trước khi xử lý logic:
       ```php
       if ($_SERVER['REQUEST_METHOD'] === 'POST') {
           if (!is_string($_SESSION['csrf_token'] ?? null) || $_SESSION['csrf_token'] === '' ||
               !is_string($_POST['csrf_token'] ?? null) || $_POST['csrf_token'] === '' ||
               !hash_equals($_SESSION['csrf_token'], $_POST['csrf_token'])) {
               http_response_code(403);
               die('CSRF token validation failed.');
           }
       }
       ```

### 2.4. Quản Lý Session & Xác Thực Người Dùng (Authentication)
*   **Mã hóa mật khẩu**: Bắt buộc dùng `password_hash($password, PASSWORD_DEFAULT)` khi lưu mật khẩu mới và dùng `password_verify($password, $hash)` khi kiểm tra đăng nhập. Tuyệt đối cấm dùng MD5, SHA1 hoặc lưu mật khẩu dạng văn bản thô.
*   **Chống Session Fixation**: Ngay sau khi người dùng đăng nhập thành công, bắt buộc gọi `session_regenerate_id(true)` để cấp ID phiên mới và hủy ID phiên cũ.
*   **Session Guard cho Admin**: Mọi file trong `admin/**` phải kiểm tra trạng thái đăng nhập hợp lệ ở đầu file. Nếu chưa xác thực, lập tức chuyển hướng về trang login và kết thúc kịch bản (`exit;`).
*   **Cookie Session An Toàn**: Cấu hình các cờ bảo vệ cho cookie session: `HttpOnly` (ngăn JavaScript đọc cookie), `SameSite=Lax` hoặc `Strict` (chống CSRF), và `Secure` khi chạy trên môi trường HTTPS.

### 2.5. An Toàn File Upload
*   **Kiểm tra MIME type thực tế**: Dùng `finfo_file` hoặc `mime_content_type` để kiểm tra nội dung thực tế của file tạm. Tuyệt đối không tin tưởng `$_FILES['file']['type']` từ trình duyệt gửi lên.
*   **Danh sách trắng đuôi file (Extension Whitelist)**: Chỉ cho phép các đuôi mở rộng an toàn (ví dụ: `jpg`, `jpeg`, `png`, `webp`).
*   **Giới hạn kích thước**: Giới hạn dung lượng tối đa cho mỗi file tải lên.
*   **Tên file an toàn**: Đổi tên file sang chuỗi ngẫu nhiên (ví dụ `bin2hex(random_bytes(16)) . '.' . $ext`) để chống Path Traversal (`../../`) và ghi đè file có sẵn.
*   **Chặn thực thi PHP**: Thư mục lưu trữ file tải lên (như `uploads/`) phải được cấu hình chặn thực thi mã PHP (thông qua `.htaccess` hoặc cấu hình web server).

### 2.6. Xử Lý Lỗi PHPMailer & Bảo Vệ Hạ Tầng
*   Nếu bật exception mode, bắt `\PHPMailer\PHPMailer\Exception`; nếu không bật, kiểm `send() === false`.
*   Ghi log nội bộ đã loại secret/PII; không log nguyên SMTP transcript hoặc thông tin xác thực.
*   Tuyệt đối không hiển thị mật khẩu SMTP, tài khoản mail máy chủ hoặc stack trace chi tiết ra màn hình người dùng.

---

## 🔒 3. Bảo Vệ Dữ Liệu Cá Nhân (PII) & Giao Dịch

1. **Che giấu dữ liệu định danh (PII Masking)**:
   - Thông tin cá nhân nhạy cảm của khách hàng (Số điện thoại, Email, Số CMND/CCCD) không được in công khai trên giao diện khách.
   - Khi hiển thị tóm tắt, áp dụng cơ chế masking (Ví dụ: `098***1234`, `ng***@gmail.com`).
2. **Giao dịch tiền tệ**:
   - Sử dụng kiểu số nguyên (`INT`/`BIGINT` đơn vị VNĐ) hoặc `DECIMAL(15,2)` trong MySQL. Tuyệt đối không dùng kiểu `float/double`.
3. **Tắt hiển thị lỗi ở Production**:
   - Tắt `display_errors` ở môi trường production (`ini_set('display_errors', '0');`), bật `log_errors` để mọi lỗi hệ thống được ghi nhận vào file log máy chủ an toàn.
