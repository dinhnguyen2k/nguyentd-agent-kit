---
trigger: glob
glob: "**/*.php,composer.json,composer.lock"
description: "Quy tắc miền Backend PHP: PDO MySQL, prepared statements, identifier allowlists, XSS/CSRF/Auth, session, file upload, PHPMailer, transaction và xử lý lỗi."
condition: ["**/*.php", "composer.json", "composer.lock"]
interruptMode: never
---

# BACKEND.MD - Quy Tắc Miền Backend PHP

> Mục tiêu: Chuẩn hóa quy tắc Backend PHP cho ứng dụng web (procedural pages root `*.php`, module `admin/**` CRUD/auth, PDO MySQL, template `layout/**`, Composer `phpmailer/phpmailer ^6.10`).

---

## 0. Ưu Tiên Và Phạm Vi

1. `AI_RULES.md` là source of truth cao nhất. Rule này là extension cho miền Backend PHP.
2. Phạm vi áp dụng:
   - Các file PHP gốc: `*.php` (ví dụ `db.php`, `index.php`, `tour-detail.php`, `lien-he.php`...).
   - Module quản trị: `admin/**/*.php` (`admin/tour/**`, `admin/blog/**`, `admin/visa/**`, `admin/auth/**`...).
   - Cấu hình phụ thuộc: `composer.json`, `composer.lock`.
   - Các thư mục backend mở rộng (nếu có): `src/**`, `config/**`, `migrations/**`.
   - **Loại trừ**: `vendor/**` và các thư mục kiểm thử `tests/**`.

---

## 1. Cấu Trúc Mã Nguồn & Kết Nối CSDL (PDO MySQL)

1. **Kết nối CSDL qua `db.php`**:
   - Sử dụng kết nối PDO MySQL từ `db.php` (`mysql:host=$host;dbname=$db;charset=utf8mb4`).
   - Cấu hình PDO chuẩn: `PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION`, `PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC`.
   - Nhúng `$pdo` thông qua `require_once __DIR__ . '/db.php'` (hoặc đường dẫn tương đối chính xác từ `admin/`), tái sử dụng instance `$pdo`, **CẤM** tạo kết nối PDO mới lặp lại ở nhiều file.
2. **Cấu trúc luồng xử lý trang PHP chuẩn**:
   - Bước 1: Khởi động session (`session_start()`) và kiểm tra phân quyền (nếu thuộc `admin/**`).
   - Bước 2: Nhận và xác thực dữ liệu đầu vào (`$_GET`, `$_POST`), kiểm tra CSRF token cho các thao tác ghi.
   - Bước 3: Thực thi nghiệp vụ và tương tác CSDL qua Prepared Statements / PDO transactions.
   - Bước 4: Xử lý thông báo (flash message) và chuyển hướng (`header('Location: ...'); exit;`) hoặc nạp template (`layout/header.php`, view, `layout/footer.php`) để hiển thị.

---

## 2. Truy Vấn Dữ Liệu An Toàn & Prepared Statements

1. **Prepared Statements là BẮT BUỘC**:
   - Mọi biến dữ liệu từ người dùng (`$_GET`, `$_POST`, `$_COOKIE`) đưa vào câu SQL **BẮT BUỘC** phải dùng Prepared Statements có tham số hóa:
     ```php
     $stmt = $pdo->prepare('SELECT * FROM tours WHERE id = :id AND status = :status');
     $stmt->execute([':id' => $tourId, ':status' => 1]);
     $tour = $stmt->fetch();
     ```
   - **TUYỆT ĐỐI CẤM** nối chuỗi biến người dùng vào câu SQL (`"SELECT * FROM tours WHERE id = " . $_GET['id']`).
2. **Identifier Allowlists (Tên bảng, tên cột, sắp xếp)**:
   - Các định danh SQL như tên bảng, tên cột, hoặc chiều sắp xếp (`ASC`/`DESC`) KHÔNG THỂ bind qua tham số PDO.
   - Khi nhận tham số sắp xếp hoặc lọc động từ người dùng, **BẮT BUỘC** dùng allowlist nghiêm ngặt:
     ```php
     $allowedSort = ['created_at' => 'created_at', 'price' => 'price', 'id' => 'id'];
     $sortCol = $allowedSort[$_GET['sort'] ?? 'created_at'] ?? 'created_at';
     $order = (strtoupper($_GET['order'] ?? '') === 'ASC') ? 'ASC' : 'DESC';
     $stmt = $pdo->prepare("SELECT * FROM tours ORDER BY {$sortCol} {$order}");
     ```
3. **Phòng chống truy vấn N+1**:
   - **CẤM** thực thi câu query PDO bên trong vòng lặp `foreach` hoặc `while` (ví dụ lặp danh sách tour rồi chạy query lấy ảnh hoặc chi tiết của từng tour).
   - Hãy gom IDs lại và dùng `WHERE id IN (?, ?, ...)` hoặc sử dụng câu lệnh `JOIN`.

---

## 3. Quản Lý Session, Xác Thực & Phân Quyền Admin

1. **Khởi động session đúng chuẩn**:
   - `session_start()` phải được gọi ở đầu file trước khi có bất kỳ ký tự hoặc khoảng trắng nào được gửi về trình duyệt.
2. **Session Guard cho Module Admin**:
   - Mọi entry admin được bảo vệ phải kiểm session/quyền; loại trừ login và endpoint public có chủ đích, không tạo redirect loop.
   - Nếu chưa xác thực hoặc session hết hạn, lập tức chuyển hướng về trang đăng nhập và dừng thực thi:
     ```php
     if (empty($_SESSION['admin'])) {
         header('Location: /admin/auth/login.php');
         exit;
     }
     ```
3. **Phòng chống Session Fixation**:
   - Ngay sau khi người dùng đăng nhập thành công, **BẮT BUỘC** gọi `session_regenerate_id(true)` để đổi ID phiên mới và vô hiệu hóa ID phiên cũ.
4. **Đăng xuất an toàn**:
   - Luồng đăng xuất (`logout.php`) phải xóa sạch mảng `$_SESSION = []`, xóa cookie phiên trên trình duyệt và gọi `session_destroy()`. Ưu tiên bảo vệ thao tác đăng xuất bằng CSRF hoặc form POST để tránh bị tấn công đăng xuất từ xa qua thẻ `<img>`.

---

## 4. Bảo Vệ CSRF (Cross-Site Request Forgery)

1. **Bắt buộc cho mọi thao tác ghi (POST/PUT/DELETE) và Logout**:
   - Mọi form thay đổi trạng thái (tạo mới, cập nhật, xóa, upload, đổi trạng thái) bắt buộc phải có token CSRF.
2. **Cơ chế CSRF chuẩn**:
   - Khởi tạo token trong session nếu chưa có:
     ```php
     if (empty($_SESSION['csrf_token'])) {
         $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
     }
     ```
   - Nhúng token vào form HTML:
     ```html
     <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($_SESSION['csrf_token'], ENT_QUOTES, 'UTF-8'); ?>">
     ```
   - Kiểm tra token khi nhận request POST:
     ```php
     if ($_SERVER['REQUEST_METHOD'] === 'POST') {
         if (!is_string($_SESSION['csrf_token'] ?? null) || $_SESSION['csrf_token'] === '' ||
             !is_string($_POST['csrf_token'] ?? null) || $_POST['csrf_token'] === '' ||
             !hash_equals($_SESSION['csrf_token'], $_POST['csrf_token'])) {
             http_response_code(403);
             die('Yêu cầu không hợp lệ hoặc đã hết hạn (CSRF token mismatch).');
         }
     }
     ```

---

## 5. An Toàn File Upload

1. **Xác thực MIME type thực tế**:
   - **CẤM** tin tưởng `$_FILES['file']['type']` hay đuôi file do client gửi lên.
   - Bắt buộc dùng `finfo_file` (extension `fileinfo`) hoặc `mime_content_type` để kiểm tra nội dung thực tế của file tạm:
     ```php
     $finfo = finfo_open(FILEINFO_MIME_TYPE);
     $mime = finfo_file($finfo, $_FILES['image']['tmp_name']);
     finfo_close($finfo);
     $allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
     if (!in_array($mime, $allowedMimes, true)) {
         throw new Exception('Định dạng file không được hỗ trợ.');
     }
     ```
2. **Whitelist đuôi mở rộng (Extension)**:
   - Chỉ cho phép các extension nằm trong danh sách trắng (`['jpg', 'jpeg', 'png', 'webp']`). CẤM upload các đuôi `.php`, `.phtml`, `.php5`, `.sh`, `.exe`, `.html`, `.htaccess`.
3. **Giới hạn dung lượng**:
   - Kiểm tra `$_FILES['file']['size']` so với ngưỡng tối đa của hệ thống (ví dụ tối đa 2MB - 5MB cho ảnh).
4. **Tên file và đường dẫn lưu trữ**:
   - Sinh tên file lưu trữ ngẫu nhiên an toàn (ví dụ: `bin2hex(random_bytes(16)) . '.' . $ext`). CẤM dùng tên gốc từ người dùng để tránh Path Traversal (`../../`) và ghi đè file hệ thống.
   - Thư mục uploads (ví dụ `uploads/` hoặc `admin/uploads/`) phải được chặn quyền thực thi script PHP qua cấu hình máy chủ web hoặc file `.htaccess`.

---

## 6. Xử Lý Email Với PHPMailer

1. **Sử dụng đúng namespace**:
   - Sử dụng PHPMailer được cài đặt qua Composer:
     ```php
     use PHPMailer\PHPMailer\PHPMailer;
     use PHPMailer\PHPMailer\Exception;
     ```
2. **Bắt lỗi và bảo vệ Secrets**:
   - Mọi thao tác gửi mail bắt buộc bọc trong `try / catch (Exception $e)`:
     ```php
     $mail = new PHPMailer(true);
     try {
         // Cấu hình SMTP và gửi mail
         $mail->send();
     } catch (Exception $e) {
         error_log('PHPMailer Error: ' . $mail->ErrorInfo);
         $errorMessage = 'Không thể gửi email lúc này. Vui lòng thử lại sau.';
     }
     ```
   - **CẤM** in `ErrorInfo`, stack trace, hoặc cấu hình SMTP (tài khoản, mật khẩu máy chủ) ra giao diện người dùng.

---

## 7. Giao Dịch Database (ACID) & Độ Chính Xác Tiền Tệ

1. **PDO Transaction cho multi-step write**:
   - Khi một tác vụ ghi dữ liệu gồm nhiều bước liên quan (tạo tour và lưu danh sách ảnh, lưu thông tin đặt chỗ và cập nhật trạng thái):
     ```php
     $pdo->beginTransaction();
     try {
         // Thực hiện các câu lệnh INSERT / UPDATE
         $pdo->commit();
     } catch (\Throwable $e) {
         if ($pdo->inTransaction()) {
             $pdo->rollBack();
         }
         error_log('Transaction Failed: ' . $e->getMessage());
         throw $e;
     }
     ```
2. **Vị trí External Call**:
   - **CẤM** gọi gửi mail (PHPMailer) hoặc gọi HTTP bên thứ ba bên trong khối transaction của DB. Chỉ gửi mail sau khi `$pdo->commit()` thành công.
3. **Độ chính xác tiền tệ**:
   - Tiền tệ (giá tour, giá vé, số tiền thanh toán): Lưu trữ dưới dạng số nguyên `INT`/`BIGINT` (theo đơn vị VNĐ) hoặc `DECIMAL(15,2)` trong MySQL.
   - **CẤM** dùng kiểu `float` hoặc `double` cho các phép tính hoặc lưu trữ số tiền.

---

## 8. Quản Lý Secrets & Lỗi Hệ Thống

1. **Không hardcode credentials**:
   - Không commit mật khẩu CSDL hoặc mật khẩu SMTP lên kho mã nguồn.
2. **Xử lý lỗi an toàn ở production**:
   - Tắt `display_errors` ở môi trường production (`ini_set('display_errors', '0');`), bật `log_errors`.
   - Bắt các ngoại lệ `\PDOException` và `\Throwable`, ghi log chi tiết vào file log nội bộ hoặc qua `error_log()`, chỉ trả về thông báo thân thiện cho người dùng.

---

## 9. Kiểm Tra Mã Nguồn (On-Demand & Runtime-Conditional)

1. **ON-DEMAND ONLY**:
   - Không tự động chạy lint, validate hay test trừ khi người dùng yêu cầu rõ ràng.
2. **Điều kiện môi trường runtime**:
   - Kiểm tra cú pháp PHP: `php -l <file.php>` (chỉ thực hiện khi CLI `php` có sẵn trên máy chủ/môi trường chạy).
   - Kiểm tra Composer: `composer validate` (chỉ khi có Composer CLI).
   - Kiểm thử tự động (PHPUnit): Chỉ chạy khi dự án đã cài đặt và cấu hình PHPUnit trong `composer.json`.
