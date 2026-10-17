---
name: php-development
description: Use when implementing or reviewing plain PHP/PDO request handlers, forms, session auth, secure uploads, or PHPMailer delivery.
metadata:
  category: engineering
  version: 1.0.0
  layer: project-skill
---

# PHP Development

Quy trình cho PHP thuần trong dự án hiện tại, không áp đặt Laravel/Symfony/ORM.
Rule invariant nằm ở `.agent/rules/backend.md` và `security-compliance.md`; skill này hướng dẫn chọn đường xử lý.

## 1. Xác định đường chạy

- Đọc entry PHP, file include/guard, form/action, `db.php`, Composer lock và template liên quan.
- Trace input -> method/auth/CSRF -> validation -> PDO/upload/email -> redirect/HTML/JSON.
- Giữ tên session/field/URL/table hiện có; không copy tên minh họa thành contract thật.
- Đọc PHP/runtime/extension constraints trước cú pháp mới; không tự thêm code tương thích PHP cũ hoặc nâng phiên bản.
- `php -v`, `php -m`, `php -l <file>`, `composer validate` chỉ chạy khi user yêu cầu và công cụ có sẵn.
Không có runtime thì báo thiếu, không tạo giả lập hoặc gọi inspection là runtime proof.

## 2. PDO và dữ liệu

Tái sử dụng kết nối hiện có; xác nhận driver MySQL trước khi dùng [skill:mysql].
Bind mọi giá trị từ request bằng prepared statement; identifier/order chỉ chọn từ allowlist tường minh.
Không dùng placeholder cho tên bảng/cột hoặc ghép raw input vào SQL.
Validate scalar/type/range trước bind, đặc biệt ID, LIMIT/OFFSET; dùng `PDO::PARAM_INT` khi cần số nguyên.
Native prepared statements cần placeholder riêng cho mỗi lần xuất hiện; không đổi `ATTR_EMULATE_PREPARES` toàn ứng dụng mà chưa kiểm caller.
`ERRMODE_EXCEPTION` giúp phát hiện lỗi, không phải lý do in SQL/exception cho khách.
Select cột cần dùng, giới hạn/paginate danh sách, tránh SELECT trong vòng lặp render; gom lookup khi thực sự có N+1.

Multi-step write liên quan cần transaction trên engine hỗ trợ.
Bắt `Throwable` tại boundary có thể rollback rồi ném/báo lỗi đúng contract, không báo thành công sau lỗi.
Không chạy DDL trong transaction với giả định rollback được; MySQL có implicit commit.
SMTP/HTTP sau DB commit, không giữ lock khi chờ dịch vụ ngoài.
Tiền dùng integer minor units hoặc DECIMAL/string theo schema, không tính bằng float; không tự migrate dữ liệu cũ.

## 3. Form, auth và CSRF

Kiểm method và auth/quyền tại từng protected handler, trước đọc/ghi dữ liệu; login/public entry có chủ đích không bị redirect loop.
Session phải khởi động trước output; tái dùng guard/session key hiện có.
Cookie HttpOnly/SameSite và Secure theo HTTPS deployment tin cậy; không tin header proxy tùy ý để quyết định HTTPS.
Regenerate session ID sau login; password dùng `password_hash`/`password_verify`, không tự đổi dữ liệu mật khẩu cũ ngoài scope.

Token CSRF sinh bằng `random_bytes`, lưu session, nhúng form và xác minh trước side effect, kể cả logout:

```php
$expected = $_SESSION['csrf_token'] ?? null;
$submitted = $_POST['csrf_token'] ?? null;
if (!is_string($expected) || $expected === '' ||
    !is_string($submitted) || $submitted === '' ||
    !hash_equals($expected, $submitted)) {
    http_response_code(403);
    exit;
}
```

CSRF không thay thế authorization; hidden ID và JavaScript validation đều không đáng tin.
Giữ dữ liệu form hợp lệ khi validation fail và dùng POST/Redirect/GET khi phù hợp contract hiện có.

## 4. Output context

Text HTML/quoted attribute dùng `htmlspecialchars((string)$value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')` tại output boundary, không HTML-escape dữ liệu trước khi lưu DB.
URL cần validate scheme/host/path theo nghiệp vụ rồi mới escape attribute; `htmlspecialchars` không chặn `javascript:`.
Dữ liệu nhúng trong `<script>` dùng `json_encode` với `JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT`, xử lý lỗi encode.
DOM text dùng `textContent`, không ghép input vào `innerHTML`.
Rich HTML từ CKEditor cần allowlist sanitizer đáng tin ở server; tài khoản admin không làm HTML tự an toàn, không dùng regex tự viết hoặc chỉ `strip_tags` để thay sanitizer.
Không thêm dependency sanitizer khi chưa được phép; nếu thiếu cơ chế an toàn thì báo prerequisite.

## 5. Upload

Kiểm `UPLOAD_ERR_OK`, giới hạn byte thực tế và cấu hình server trước xử lý.
Kiểm MIME qua fileinfo nội dung tệp tạm, map MIME -> extension allowlist; không tin filename hoặc `$_FILES['type']`.
Tên lưu ngẫu nhiên, đường dẫn server kiểm soát, `move_uploaded_file`; chặn traversal/overwrite và script execution tại web server.
Ưu tiên ngoài web root; nếu lưu public phải kiểm cấu hình cấm thực thi và xử lý content-type phù hợp.
Không coi SVG/HTML là ảnh an toàn; chỉ chấp nhận nếu có policy và sanitizer riêng.
Lỗi move/DB phải giữ nhất quán metadata/file; chỉ cleanup file do thao tác hiện tại tạo, không xóa upload không liên quan.

## 6. PHPMailer

Dùng Composer autoload và config hiện có, không chép SMTP credential vào source/log/chat.
Bật exception mode thì bắt `PHPMailer\PHPMailer\Exception`; không bật thì kiểm `send() === false`.
Không bỏ TLS verification để chữa SMTP; kiểm host/port/encryption và trust store đúng môi trường.
Validate recipient/Reply-To, From là địa chỉ server được cấu hình; escape input trong HTML email và có plain-text body khi phù hợp.
Log đã loại secret/PII, không SMTP transcript; báo thất bại đúng contract, không trả success giả.
Test bằng mail capture/test double được cấu hình, không gửi mail thật khi chưa được phép.

## 7. Bằng chứng

Theo quyền user và công cụ thật: syntax check hẹp, test invariant có runner, hoặc request/browser scenario với DB test riêng.
Không bịa sẵn PHPUnit/PHPStan/CS Fixer; không cài tool để lấp báo cáo.
`php -l` không chứng minh DB/session/form/upload/email đúng; báo chính xác phần chưa chạy.
