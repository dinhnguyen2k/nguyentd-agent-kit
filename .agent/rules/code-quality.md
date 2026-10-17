---
trigger: model_decision
description: "When reviewing code quality, naming conventions, refactoring anti-patterns, or writing clean production-grade PHP, HTML, CSS, and JS code."
---

# CODE-QUALITY.MD - Engineering Excellence Cho PHP & Web Frontend

> **Mục tiêu**: Đảm bảo mã nguồn PHP, HTML, CSS và JavaScript luôn đạt chất lượng cao, an toàn, dễ đọc và dễ bảo trì ngay từ đầu.

---

## 🚫 1. Anti-Patterns (Cấm Tuyệt Đối)

1. **Mã debug còn sót lại**: Không commit các lệnh debug như `var_dump()`, `print_r()`, `die()`, `exit;` tạm thời hoặc `console.log()` vào mã nguồn hoàn thiện.
2. **Magic Numbers & Chuỗi cứng (Magic Strings)**: Không sử dụng các con số hoặc chuỗi ký tự bí ẩn trực tiếp trong logic (ví dụ `if ($status == 3)`). Hãy định nghĩa hằng số hoặc mảng ánh xạ trạng thái rõ nghĩa.
3. **Nuốt lỗi im lặng (Silent Failures)**: Tuyệt đối cấm sử dụng khối `catch (\Exception $e) {}` rỗng mà không ghi log hay có giải pháp xử lý. Lỗi ngoại lệ từ CSDL PDO hoặc PHPMailer phải luôn được ghi nhận vào `error_log`.
4. **Hàm/Script quá dài và ôm đồm**: Một hàm hoặc một khối script không nên đảm nhiệm quá nhiều trọng trách. Hãy tách biệt rõ ràng: nhận input -> kiểm tra hợp lệ -> truy vấn CSDL -> trả kết quả/render giao diện.
5. **Code phình dọc (Vertical Bloat)**: Giữ code ngắn gọn, súc tích theo quy chuẩn tại `.agent/rules/code-style-concise.md`.

---

## ✅ 2. Best Practices (Khuyên Dùng)

1. **Quy ước đặt tên (Naming Conventions)**:
   - **Biến & Hàm PHP**: Sử dụng `camelCase` hoặc `snake_case` nhất quán với phong cách hiện hành của file đang sửa đổi.
   - **Hằng số**: Sử dụng `SCREAMING_SNAKE_CASE` (ví dụ: `MAX_UPLOAD_SIZE`, `STATUS_PUBLISHED`).
   - **Tên file trang web**: Sử dụng `kebab-case` (ví dụ: `tour-detail.php`, `lien-he.php`).
   - **JavaScript**: `camelCase` cho biến và hàm, `kebab-case` cho tên file `.js`.
2. **Bình luận mã nguồn (Comments)**:
   - Giải thích "TẠI SAO" làm như vậy đối với các đoạn code xử lý nghiệp vụ phức tạp, không giải thích những gì code đã thể hiện rõ ràng.
3. **Xử lý lỗi & Ngoại lệ**:
   - Sử dụng `try / catch` cho các thao tác CSDL PDO và gửi email qua PHPMailer.
   - Luôn rollback transaction nếu có lỗi xảy ra trong quá trình ghi dữ liệu nhiều bước.
   - Trả thông báo lỗi an toàn, lịch sự cho người dùng; ghi chi tiết kỹ thuật vào file log nội bộ.
4. **Viết code rõ ràng và tương thích an toàn**:
   - Sử dụng các toán tử hiện đại và an toàn như toán tử null coalescing (`??`), toán tử ternary rút gọn khi kiểm tra dữ liệu mảng.

---

## 🧪 3. Chất Lượng Trong Thực Thi

1. **Đọc trước khi sửa**: Luôn đọc kỹ cấu trúc của file hiện tại và các hàm xung quanh trước khi thêm mới hoặc sửa đổi code.
2. **Tái sử dụng thay vì nhân bản**: Tận dụng các template có sẵn (`layout/header.php`, `layout/footer.php`) và kết nối `$pdo` từ `db.php`, không viết lại các đoạn mã trùng lặp.
