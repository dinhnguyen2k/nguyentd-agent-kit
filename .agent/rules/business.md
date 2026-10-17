---
trigger: glob
glob: "**/*.{php,sql,js,html}"
description: "Quy tắc nghiệp vụ ứng dụng PHP/MySQL: Backend là nguồn chân lý, PDO transactions, tính nhất quán dữ liệu, độ chính xác tiền tệ và phân quyền admin."
---

# BUSINESS.MD - Quy Tắc Nghiệp Vụ Ứng Dụng Web PHP

> Mục tiêu: Chuẩn hóa các quy tắc nghiệp vụ có thể thực thi và kiểm chứng theo codebase PHP/PDO/MySQL hiện tại (procedural scripts, admin CRUD, PDO MySQL, PHPMailer).

---

## 0. Ưu Tiên Và Phạm Vi

1. `AI_RULES.md` là source of truth cao nhất. Rule này mở rộng chi tiết cho miền nghiệp vụ ứng dụng.
2. Khi có xung đột giữa tài liệu và code đang chạy:
   - Ưu tiên behavior thực tế quan sát được trong mã nguồn và schema CSDL.
   - Nêu rõ xung đột, không tự ý suy diễn hoặc thêm các trường CSDL tưởng tượng.
3. Phạm vi áp dụng:
   - Các file PHP xử lý và hiển thị: `*.php`, `admin/**/*.php`.
   - Các script CSDL: `*.sql`, cấu hình kết nối `db.php`.
   - Các file giao diện và kịch bản tương tác: `layout/**`, `js/**`.

---

## 1. Nguồn Chân Lý Nghiệp Vụ (Single Source of Truth)

1. **Backend PHP là nơi chốt chặn cuối cùng**:
   - Mọi validation dữ liệu (bắt buộc, độ dài, định dạng email, số điện thoại, giá tiền, ngày tháng) bắt buộc phải được kiểm tra tại tầng PHP.
   - Validation phía client (HTML `required`, JavaScript regex) chỉ phục vụ trải nghiệm người dùng (UX), tuyệt đối không được coi là lớp bảo vệ duy nhất.
2. **Ràng buộc tại CSDL MySQL (Invariants)**:
   - Database phải tham gia bảo vệ tính toàn vẹn dữ liệu thông qua các ràng buộc: Primary Key (PK), Foreign Key (FK), Unique Index (UK), NOT NULL.
   - Không lưu trữ các dữ liệu mâu thuẫn hoặc thiếu trường bắt buộc vào CSDL.
3. **Đánh giá tác động toàn diện**:
   - Khi tạo mới, sửa đổi hoặc xóa một thực thể (Tour, Blog, Visa, Banner, Liên hệ), phải đánh giá tác động chéo giữa CSDL, giao diện hiển thị phía khách (`index.php`, `tour-detail.php`...) và trang quản trị `admin/**`.

---

## 2. Quy Tắc Thiết Kế Nghiệp Vụ Trong Repo

1. **Luồng xử lý chuẩn của một chức năng**:
   - Kiểm tra Session & Phân quyền (với các trang `admin/**`).
   - Kiểm tra CSRF token cho toàn bộ request POST / thao tác ghi.
   - Nhận, làm sạch (sanitize) và kiểm tra tính hợp lệ của dữ liệu đầu vào.
   - Thực thi tương tác CSDL qua Prepared Statements / PDO transactions.
   - Trả thông báo kết quả (flash session message) và redirect hoặc render view.
2. **Quản lý trạng thái thực thể**:
   - Sử dụng các hằng số hoặc giá trị số nguyên chuẩn đã có trong CSDL (ví dụ `status = 1` là hiển thị/kích hoạt, `status = 0` là ẩn/chờ duyệt).
   - Tránh tự tạo các trạng thái mới hoặc định danh mơ hồ không khớp với cấu trúc bảng hiện tại.
3. **Phân quyền và bảo vệ trang quản trị**:
   - Phân quyền admin phải fail-closed: nếu không tồn tại session hợp lệ (`$_SESSION['admin']`), chặn truy cập ngay lập tức (`header('Location: ...'); exit;`).
   - Cấm bypass kiểm tra phiên đăng nhập để "thử nghiệm nhanh".

---

## 3. Giao Dịch, Tính Nhất Quán & Tích Hợp

1. **Giao dịch nhiều bước (Multi-step Write)**:
   - Các thao tác cần thành công hoặc cùng thất bại (ví dụ: tạo tour và lưu danh sách lịch trình/ảnh kèm theo, xóa bản ghi cha và các bản ghi con phụ thuộc) bắt buộc phải đặt trong cùng một PDO transaction (`$pdo->beginTransaction()`).
2. **Tách biệt External Call khỏi Transaction**:
   - **CẤM** gọi gửi email qua PHPMailer hoặc gọi API bên ngoài bên trong khối transaction của CSDL.
   - Gửi email thông báo chỉ được thực hiện sau khi `$pdo->commit()` thành công. Nếu gửi mail thất bại, ghi log lỗi nhưng không làm rollback dữ liệu đã lưu hợp lệ trừ khi nghiệp vụ yêu cầu bắt buộc email phải gửi được mới tính là thành công.
3. **Xóa an toàn & Dữ liệu mồ côi (Orphaned Records)**:
   - Khi xóa một thực thể, phải dọn dẹp hoặc cập nhật các bản ghi liên quan để không để lại dữ liệu rác trong CSDL.
   - Với các file ảnh/tài liệu đính kèm (trong `uploads/`), chỉ xóa file trên đĩa khi bản ghi CSDL đã được xóa thành công.

---

## 4. Dữ Liệu Tiền Tệ & Nhạy Cảm

1. **Quy tắc tính toán tiền tệ**:
   - Giá tour, giá vé, phụ thu, số tiền thanh toán: Bắt buộc dùng số nguyên `INT`/`BIGINT` (theo đơn vị VNĐ) hoặc kiểu `DECIMAL(15,2)` trong MySQL.
   - **TUYỆT ĐỐI CẤM** dùng kiểu số thực `float` hoặc `double` trong PHP để tính toán tiền tệ nhằm tránh sai số làm tròn.
2. **Dữ liệu nhạy cảm & Lịch sử nghiệp vụ**:
   - Các bản ghi giao dịch, liên hệ khách hàng hoặc đơn đặt tour không được xóa tùy tiện làm sai lệch lịch sử kinh doanh. Ưu tiên cập nhật trạng thái (ví dụ `status = 0` hoặc `is_deleted = 1` nếu có cột) thay vì `DELETE` cứng.

---

## 5. Audit, Logging & Xử Lý Lỗi Nghiệp Vụ

1. **Không nuốt lỗi CSDL**:
   - Cấm dùng `catch (\Exception $e) { }` rỗng để bỏ qua lỗi PDO.
   - Khi xảy ra lỗi ngoại lệ, bắt buộc:
     - Ghi log nội bộ chi tiết (`error_log('Database error: ' . $e->getMessage())`) phục vụ điều tra sự cố.
     - Rollback transaction nếu đang mở.
     - Trả thông báo lỗi an toàn, dễ hiểu cho người dùng, không làm lộ chi tiết cấu trúc CSDL ra ngoài.
2. **Audit các hành động quản trị**:
   - Các thay đổi quan trọng trong `admin/**` (thay đổi giá tour, xóa tour, duyệt liên hệ) nên lưu trữ thông tin thời điểm và định danh người thực hiện để phục vụ kiểm tra khi cần.

---

## 6. Các Pattern Bị Cấm Tuyệt Đối

1. Đặt kiểm tra logic nghiệp vụ hoặc tính giá tiền chỉ ở JavaScript phía client mà không kiểm tra lại ở PHP backend.
2. Bỏ qua kiểm tra CSRF cho các thao tác POST/DELETE/Logout.
3. Cho phép thực thi câu lệnh SQL với tham số nối chuỗi trực tiếp từ người dùng.
4. Tự ý thay đổi cấu trúc bảng CSDL (thêm cột, sửa kiểu dữ liệu) mà không có yêu cầu rõ ràng từ người dùng.
