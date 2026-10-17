---
trigger: model_decision
description: "When the change touches an architecture/production risk surface: DB transaction boundary (PDO), SQL query performance/index on MySQL tables, external dependencies (PHPMailer/SMTP, 3rd-party HTTP), session auth & admin guards, CSRF protection, file upload security, or secrets management."
---

# ARCHITECTURE-REVIEW.MD - PHP & MySQL System Integrity

> Mục tiêu: review kiến trúc bám sát hệ thống PHP hiện tại (procedural pages root `*.php`, module `admin/**` CRUD/auth, PDO MySQL, template `layout/**`, Composer `phpmailer/phpmailer ^6.10`), tập trung vào an toàn dữ liệu, bảo mật và rủi ro vận hành production.

---

## 1. Review Scope And Priority

### 1.0 Scope Gate - Đọc trước
- Rule này nạp theo `model_decision`, không phải theo loại file.
Chỉ áp các mục tương ứng với **risk surface mà change thực sự chạm**, không chạy hết các mục cho mọi thay đổi.
- Mapping nhanh:
  - Transaction / write dữ liệu nghiệp vụ nhiều bước -> §2, §5
  - Truy vấn DB / query bảng lớn / index -> §3
  - Upload file / xử lý media -> §4
  - Form write / logout / CSRF -> §4
  - Xác thực session / phân quyền admin -> §4
  - Gửi mail qua PHPMailer / gọi API bên ngoài -> §2, §4
  - Trình bày giao diện / render HTML -> §4
- Change không chạm risk surface nào (sửa text thông báo, chỉnh sửa CSS/layout nhỏ, rename biến cục bộ) thì **không phát sinh finding từ file này**. Im lặng là kết quả hợp lệ.
- Trần độ phức tạp tuân thủ `.agent/rules/solution-complexity.md`. Không đề xuất microservices, message queue, ORM nặng hay framework phức tạp cho ứng dụng PHP hiện hữu.

- Ưu tiên kiểm tra các điểm dễ gây downtime, mất dữ liệu hoặc lộ lỗ hổng:
  - Nối chuỗi trực tiếp biến người dùng vào câu lệnh SQL thay vì dùng Prepared Statement hoặc identifier allowlist.
  - Render trực tiếp dữ liệu người dùng ra HTML/attribute mà không escape (`htmlspecialchars`).
  - Thiếu token CSRF cho các thao tác ghi dữ liệu (POST) hoặc thao tác đăng xuất.
  - Phân quyền trang admin lỏng lẻo, thiếu session guard fail-closed.
  - Upload file tin tưởng `$_FILES['type']` hoặc extension do client gửi, cho phép lưu và thực thi file mã độc trong thư mục web.
  - DB transaction bao quanh external call (như PHPMailer SMTP) gây giữ lock DB kéo dài.
  - Nuốt lỗi exception của PDO hoặc PHPMailer khiến hệ thống mất dữ liệu âm thầm.

---

## 2. Giao Dịch & Tính Nhất Quán Dữ Liệu (PDO Transactions)

### 2.1 Transaction Boundary - MUST
- Mọi thao tác ghi dữ liệu từ 2 bước trở lên phụ thuộc nhau (ví dụ: tạo tour + lịch trình, lưu booking + thông tin liên hệ, xóa cha + xóa con) BẮT BUỘC phải nằm trong một PDO transaction:
  ```php
  $pdo->beginTransaction();
  try {
      // Các thao tác ghi dữ liệu
      $pdo->commit();
  } catch (\Throwable $e) {
      if ($pdo->inTransaction()) {
          $pdo->rollBack();
      }
      throw $e;
  }
  ```
- **CẤM** đặt external dependency calls (như gửi email qua PHPMailer, gọi HTTP 3rd-party) bên trong khối transaction của DB. Transaction DB phải thật ngắn, chỉ bao bọc thao tác DB. Gửi mail/thông báo chỉ thực hiện SAU KHI `$pdo->commit()` thành công.

### 2.2 Độ Chính Xác Tiền Tệ & Dữ Liệu Nhạy Cảm - MUST
- Giá tour, số tiền thanh toán, phí dịch vụ: BẮT BUỘC lưu trữ bằng kiểu số nguyên (`INT`/`BIGINT` theo đơn vị VNĐ) hoặc `DECIMAL(15,2)` trong MySQL.
- **CẤM** sử dụng kiểu `float` hoặc `double` cho phép tính hoặc lưu trữ tiền tệ để tránh sai số dấu phẩy động.

---

## 3. Hiệu Năng Truy Vấn & Cơ Sở Dữ Liệu MySQL

### 3.1 Prepared Statements & SQL Parameter Binding - MUST
- Mọi giá trị đến từ người dùng (`$_GET`, `$_POST`, `$_COOKIE`) đưa vào câu SQL BẮT BUỘC dùng Prepared Statements:
  `$stmt = $pdo->prepare('SELECT ... WHERE id = :id'); $stmt->execute([':id' => $id]);`.
- Các định danh SQL không thể bind qua parameter (tên cột, tên bảng, hướng sắp xếp `ASC`/`DESC`): BẮT BUỘC dùng **Allowlist tường minh** kiểm tra qua `in_array($val, $allowedList, true)`. Cấm nối chuỗi tự do.

### 3.2 Phòng Chống Truy Vấn N+1 - MUST
- **CẤM** thực thi câu query PDO bên trong vòng lặp `foreach` hoặc `while` (ví dụ: lặp danh sách tour rồi chạy `SELECT` lấy ảnh hoặc chi tiết của từng tour).
- Phải gom mảng IDs và truy vấn 1 lần bằng `WHERE id IN (...)` hoặc dùng câu lệnh `JOIN`.

### 3.3 Phân Trang Danh Sách Lớn - MUST
- Các trang danh sách dữ liệu (bài viết, tour, liên hệ, nhật ký) phải có phân trang với `LIMIT :limit OFFSET :offset`.
- Tránh `SELECT *` không giới hạn trên các bảng có dữ liệu tăng trưởng theo thời gian.

---

## 4. Bảo Mật, Session & Quản Lý File

### 4.1 Quản Lý Session & Phân Quyền Admin - MUST
- Mọi entry quản trị được bảo vệ phải kiểm session/quyền trước xử lý; login và entry public chủ đích không tự chuyển hướng về chính login. Chặn request trái phép bằng redirect/403 và `exit`.
- Sau khi xác thực đăng nhập thành công, BẮT BUỘC gọi `session_regenerate_id(true)` để phòng chống Session Fixation.

### 4.2 Bảo Vệ CSRF (Cross-Site Request Forgery) - MUST
- Mọi form thực hiện hành động ghi (POST/PUT/DELETE) và hành động đăng xuất (logout) phải có CSRF token:
  - Sinh token ngẫu nhiên bằng `bin2hex(random_bytes(32))` lưu trong `$_SESSION['csrf_token']`.
  - Nhúng token vào form ẩn `<input type="hidden" name="csrf_token" value="...">`.
  - Token session và request phải là chuỗi không rỗng; từ chối token thiếu, mảng hoặc sai trước khi gọi `hash_equals`.

### 4.3 Contextual HTML Escaping (Chống XSS) - MUST
- Mọi dữ liệu xuất ra màn hình HTML BẮT BUỘC dùng hàm escape an toàn:
  `htmlspecialchars($val ?? '', ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')`.
- Khi nhúng dữ liệu vào thuộc tính JavaScript hoặc thẻ `<script>`, dùng `json_encode($data, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP)`.

### 4.4 An Toàn File Upload - MUST
- Xác thực định dạng file qua MIME type thực tế bằng `finfo_file` hoặc `mime_content_type`, CẤM dựa vào `$_FILES['file']['type']` hay đuôi mở rộng từ client.
- Áp dụng whitelist đuôi mở rộng cho phép (ví dụ: `['jpg', 'jpeg', 'png', 'webp']`).
- Giới hạn dung lượng file tối đa hợp lý.
- Đổi tên file sang chuỗi ngẫu nhiên an toàn (ví dụ: `bin2hex(random_bytes(16)) . '.' . $ext`) để chống ghi đè và Path Traversal (`../`).
- Đảm bảo thư mục lưu trữ file upload không cho phép thực thi script PHP (cấu hình web server hoặc `.htaccess`).

### 4.5 Quản Lý Secrets & PHPMailer Errors - MUST
- Cấm hardcode mật khẩu CSDL, SMTP password trong mã nguồn public.
- PHPMailer bật exception mode thì bắt `\PHPMailer\PHPMailer\Exception`; nếu không bật thì kiểm `send() === false`. Log lỗi đã loại secret/PII, báo lỗi thân thiện và không báo thành công giả.

---

## 5. Phân Loại Mức Độ Nghiêm Trọng (Severity Classification)

### BLOCKER
- Lỗ hổng SQL Injection (nối chuỗi trực tiếp input vào câu SQL).
- Hardcode secrets, database credentials hoặc SMTP password trong mã nguồn.
- Lỗ hổng Remote Code Execution qua file upload (cho phép upload file `.php` hoặc file thực thi vào thư mục web).
- Trang quản trị trong `admin/**` thiếu kiểm tra session auth guard.
- Thiếu CSRF token cho các thao tác thay đổi dữ liệu nghiêm trọng (đổi mật khẩu, xóa dữ liệu, đăng xuất).
- Lỗ hổng XSS lưu trữ hoặc phản xạ do render trực tiếp input không qua `htmlspecialchars`.

### MAJOR
- Multi-step write không bọc trong PDO transaction hoặc transaction bao quanh PHPMailer/external HTTP.
- Dùng kiểu `float/double` để tính toán tiền tệ.
- Truy vấn N+1 trong vòng lặp trên danh sách dữ liệu thực tế.
- Danh sách bảng lớn thiếu phân trang (`LIMIT`/`OFFSET`).
- Đăng nhập thành công không regenerate session ID.
- Nuốt lỗi exception của PDO hoặc PHPMailer không ghi log.

### MINOR
- Tên biến/hàm không nhất quán với quy ước của dự án.
- Thiếu index phụ trợ trên cột tìm kiếm ít dùng.
- Đường dẫn asset CSS/JS chưa tối ưu hoặc thừa code giao diện không dùng.

---

## 6. Required Review Output Format

Khi thực hiện architecture review, bắt buộc trả kết quả theo định dạng:

```markdown
Finding: [Mô tả ngắn gọn phát hiện]
Risk: [Rủi ro thực tế đối với hệ thống, dữ liệu hoặc bảo mật]
Evidence: [Đường dẫn file:dòng hoặc đoạn code cụ thể chứng minh]
Severity: [BLOCKER | MAJOR | MINOR]
Recommendation: [Định hướng giải quyết an toàn]
Suggested Fix: [Mã nguồn đề xuất khắc phục cụ thể theo ngữ cảnh PHP/PDO/MySQL]
```

Không đưa ra nhận xét chung chung kiểu "cần tối ưu kiến trúc" mà không có dẫn chứng mã nguồn cụ thể.
