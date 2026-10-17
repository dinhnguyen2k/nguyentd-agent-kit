---
trigger: glob
glob: "**/*.{php,js,html}"
description: "Quy tắc nhất quán giữa Server-side PHP và Client-side HTML/JS: đồng bộ tên trường form, CSRF token, validation, nullable values và hiển thị lỗi."
---

# DOMAIN-PARITY.MD - Nhất Quán Server-side PHP ↔ Client-side HTML/JS

> Mục tiêu: Đảm bảo tính nhất quán tuyệt đối giữa mã nguồn xử lý backend PHP và mã nguồn giao diện client (server-rendered HTML, CSS, JavaScript).

---

## 1. Nguồn Chân Lý Về Validation

1. **PHP Backend là chốt chặn cuối cùng**:
   - Backend PHP chịu trách nhiệm kiểm tra tính hợp lệ của toàn bộ dữ liệu đầu vào.
   - Validation phía client (HTML5 attributes `required`, `pattern`, `maxlength` hoặc các hàm kiểm tra bằng JavaScript) chỉ nhằm mục đích phản hồi nhanh cho người dùng (UX), không được coi là đủ để bảo vệ hệ thống.
2. **Không nới lỏng quy tắc ở Backend**:
   - Quy tắc kiểm tra ở client và server phải đồng nhất về giới hạn độ dài, định dạng số, định dạng email, và các trường bắt buộc.

---

## 2. Đồng Bộ Tên Trường Form (Form Field Names)

1. **Khớp chính xác tên trường**:
   - Tên thuộc tính `name="..."` trên các thẻ input HTML (`<input>`, `<select>`, `<textarea>`) phải khớp chính xác 100% với khóa truy cập trong `$_POST` hoặc `$_GET` ở file PHP xử lý.
   - Ví dụ: `<input name="tour_title">` thì backend phải đọc `$_POST['tour_title']`, không viết `$_POST['title']` gây mất dữ liệu.
2. **Mảng trường động (Form Arrays)**:
   - Với các form nhập nhiều dòng (như danh sách ngày khởi hành, danh sách ảnh tour), dùng cú pháp mảng HTML chuẩn: `name="schedules[][day]"` hoặc `name="images[]"`, và backend duyệt tương ứng.

---

## 3. Đồng Bộ Bảo Vệ CSRF

1. **Nhúng token trong Form HTML**:
   - Mọi form thực hiện thao tác ghi (POST/PUT/DELETE) và thao tác đăng xuất đều phải chứa input ẩn CSRF token lấy từ session PHP:
     ```html
     <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($_SESSION['csrf_token'] ?? '', ENT_QUOTES, 'UTF-8'); ?>">
     ```
2. **Đính kèm CSRF trong AJAX Request**:
   - Nếu JavaScript thực hiện gửi request POST/JSON qua `fetch()` hoặc `XMLHttpRequest`, bắt buộc phải lấy token CSRF từ thẻ meta hoặc từ form để truyền vào `FormData` hoặc request header.

---

## 4. Xử Lý Giá Trị Rỗng & Nullable Fields

1. **Chuỗi rỗng sang NULL**:
   - Khi người dùng để trống một trường không bắt buộc trên form, trình duyệt gửi chuỗi rỗng `""`.
   - Phía PHP backend phải chuẩn hóa:
     ```php
     $note = !empty(trim($_POST['note'] ?? '')) ? trim($_POST['note']) : null;
     ```
   - Tránh lưu chuỗi rỗng vào các cột CSDL định nghĩa kiểu `INT`, `DATE` hoặc `DECIMAL` cho phép `NULL`.

---

## 5. Đồng Bộ Giá Trị Trạng Thái (Status Parity)

1. **Thống nhất giá trị đại diện**:
   - Các giá trị trạng thái (ví dụ: `1: Kích hoạt / Hiển thị`, `0: Ẩn / Chờ duyệt`) phải được sử dụng đồng nhất giữa câu lệnh SQL, mã PHP render thẻ `<option>` / badge trạng thái, và kịch bản JavaScript filter/toggle.
   - Tránh việc một bên dùng số nguyên `1 / 0` và một bên dùng chuỗi `'active' / 'inactive'`.

---

## 6. Hiển Thị Lỗi & Phản Hồi Trạng Thái Đồng Bộ

1. **Hiển thị lỗi rõ ràng**:
   - Khi backend phát hiện lỗi dữ liệu, thông báo lỗi phải được hiển thị tại vị trí trực quan trên form (hoặc thông qua flash message ở đầu trang).
   - Nếu form bị lỗi submit, giữ lại các giá trị người dùng đã nhập hợp lệ (old input) để họ không phải nhập lại từ đầu:
     ```html
     <input type="text" name="customer_name" value="<?php echo htmlspecialchars($_POST['customer_name'] ?? $defaultValue, ENT_QUOTES, 'UTF-8'); ?>">
     ```
