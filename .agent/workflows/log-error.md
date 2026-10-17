---
name: log-error
description: Ghi lại lỗi vào Error Log để học tập và cải thiện
---

# /log-error - Hệ thống Ghi nhận Lỗi Tự động

Workflow này hướng dẫn Agent cách ghi lại lỗi một cách có hệ thống.

## 📋 Các bước thực hiện

1. **Phát hiện lỗi**:
   - Lỗi có thể đến từ: Lỗi cú pháp PHP (`php -l`), PDOException, Runtime Warning/Fatal error, logic bug, hoặc lỗi gửi mail PHPMailer.
   - Đọc kỹ thông báo lỗi và stack trace.

2. **Phân loại lỗi**:
   - **Type**: Xác định loại (Syntax / Logic / Database / Runtime)
   - **Severity**: 
     - `Critical`: Ứng dụng sập hoàn toàn (trang trắng HTTP 500, lỗi kết nối CSDL trong `db.php`)
     - `High`: Tính năng chính bị hỏng (không xem được tour, không gửi được liên hệ, lỗi đăng nhập admin)
     - `Medium`: Tính năng phụ hoặc hiển thị bị sai lệch (sai định dạng ngày, lỗi giao diện nhỏ)
     - `Low`: Warning nhỏ, notice PHP không ảnh hưởng trực tiếp đến người dùng

3. **Thu thập thông tin**:
   - File và dòng code gây lỗi
   - Agent nào đang thực hiện (`backend-specialist` hoặc `frontend-specialist`)
   - Thời gian xảy ra lỗi
   - Error message chi tiết

4. **Ghi vào ERRORS.md**:
   - Mở file `.planning/errors/ERRORS.md` hoặc `ERRORS.md`
   - Thêm entry mới theo format chuẩn
   - Lưu file

5. **Thông báo người dùng**:
   - "🐛 Đã ghi lại lỗi vào `ERRORS.md`. Đang tiến hành xử lý nguyên nhân gốc..."

6. **Giải quyết lỗi**:
   - Áp dụng bản sửa tối thiểu, đúng bản chất (không fix tạm, không che giấu lỗi bằng `@`)
   - Xác minh lại trên code
   - Cập nhật Status trong `ERRORS.md` thành `Fixed`

7. **Học từ lỗi**:
   - Nếu lỗi lặp lại >= 2 lần: Tạo ghi chú kiểm tra trong quy trình phát triển

---

## 💡 Ví dụ Thực tế

Khi gặp lỗi truy vấn cơ sở dữ liệu PDO:
```
Fatal error: Uncaught PDOException: SQLSTATE[42S22]: Column not found: 1054 Unknown column 'is_featured' in 'where clause' in /home/nguyentd/longphat/tour-trong-nuoc.php:18
```

Agent sẽ ghi vào `ERRORS.md`:
```markdown
## [2026-10-18 10:30] - MySQL Column Not Found in Tour Query

- **Type**: Database
- **Severity**: High
- **File**: `tour-trong-nuoc.php:18`
- **Execution role**: backend-specialist
- **Root Cause**: Câu lệnh SQL sử dụng cột `is_featured` nhưng cấu trúc bảng trong MySQL thực tế đặt tên là `noi_bat`
- **Error Message**: 
  ```
  PDOException: SQLSTATE[42S22]: Column not found: 1054 Unknown column 'is_featured' in 'where clause'
  ```
- **Fix Applied**: Sửa câu truy vấn `$pdo->prepare("SELECT * FROM tours WHERE noi_bat = :status")` với đúng tên cột trong CSDL
- **Prevention**: Luôn đối chiếu tên cột với schema bảng MySQL trước khi viết truy vấn PDO
- **Status**: Fixed
```

---

**Lưu ý**: Ghi nhận lỗi có trách nhiệm, giúp tích lũy kinh nghiệm và tránh lặp lại cùng một sai lầm.
