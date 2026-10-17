---
trigger: glob
glob: "**/*.php,css/**,js/**,layout/**,images/**,admin/css/**,admin/js/**"
description: "Quy tắc miền Frontend: Server-rendered PHP templates, CSS, Vanilla JS, jQuery/CKEditor, contextual escaping, CSRF và asset path safety."
---

# FRONTEND.MD - Quy Tắc Miền Giao Diện (HTML, CSS & JavaScript)

> Mục tiêu: Chuẩn hóa các quy tắc phát triển giao diện server-rendered (HTML được render từ PHP, layout templates trong `layout/**`, CSS trong `css/**`, JavaScript trong `js/**`, và giao diện quản trị trong `admin/**`).

---

## 0. Ưu Tiên Và Phạm Vi

1. `AI_RULES.md` là source of truth cao nhất. Rule này mở rộng chi tiết cho miền giao diện Frontend.
2. Phạm vi sở hữu:
   - Các tệp định dạng stylesheet: `css/**/*.css`, `admin/css/**/*.css`.
   - Các tệp kịch bản client: `js/**/*.js`, `admin/js/**/*.js`; chỉ chỉnh cấu hình tích hợp CKEditor tại source ứng dụng, không sửa thư viện bên thứ ba.
   - Thư mục hình ảnh & assets source: `images/**`; không coi nội dung upload là source để agent sửa.
   - Các tệp template layout: `layout/**/*.php`.
   - Các file PHP giao diện/trình bày (presentation) theo phân công rõ ràng. Khi chỉnh sửa file PHP chứa cả backend và frontend, phải đảm bảo nguyên tắc một chủ sở hữu (single owner) cho mỗi tác vụ.

---

## 1. Kiến Trúc Giao Diện Server-Rendered

1. **Cấu trúc Template Module**:
   - Sử dụng layout dùng chung thông qua các file nạp: `require_once 'layout/header.php'` và `require_once 'layout/footer.php'`.
   - Tách biệt rõ ràng phần chuẩn bị dữ liệu (PHP queries ở đầu file) và phần render thẻ HTML ở thân file.
2. **Đường dẫn tài nguyên (Asset Paths)**:
   - Đảm bảo đường dẫn file CSS, JS, ảnh và font chính xác từ cả trang root (như `index.php`, `tour-detail.php`) lẫn trang quản trị (như `admin/tour/index.php`).
   - Ưu tiên dùng đường dẫn tuyệt đối từ web root (ví dụ `/css/style.css`, `/js/main.js`) hoặc biến URL base để tránh lỗi 404 khi truy cập các URL đa cấp.

---

## 2. Contextual HTML Escaping (Chống XSS) - BẮT BUỘC

1. **Escape toàn bộ dữ liệu động in ra HTML**:
   - Mọi biến dữ liệu từ CSDL hoặc từ người dùng khi in ra trong khối HTML **BẮT BUỘC** phải bọc trong hàm escape an toàn:
     ```php
     <?php echo htmlspecialchars($tour['title'] ?? '', ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
     ```
   - **TUYỆT ĐỐI CẤM** dùng `echo $var;` trực tiếp cho dữ liệu chưa qua escape.
2. **Dữ liệu trong thuộc tính HTML (Attributes)**:
   - Thuộc tính HTML phải luôn được đặt trong cặp dấu nháy kép `"` và escape đầy đủ:
     ```html
     <input type="text" name="title" value="<?php echo htmlspecialchars($tour['title'] ?? '', ENT_QUOTES, 'UTF-8'); ?>">
     ```
3. **Dữ liệu nhúng vào JavaScript**:
   - Khi cần truyền dữ liệu từ PHP vào mã JavaScript, **BẮT BUỘC** dùng `json_encode` với các cờ chống XSS:
     ```html
     <script>
       const tourData = <?php echo json_encode($tourData, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP); ?>;
     </script>
     ```
4. **Trường hợp nội dung HTML giàu (Rich Text)**:
   - Với nội dung bài viết/mô tả từ CKEditor có chứa thẻ HTML định dạng, phải đảm bảo nội dung đã được làm sạch hoặc kiểm soát chặt chẽ tại tầng admin, chỉ cho phép các thẻ an toàn.

---

## 3. Quy Tắc CSS & Trình Bày

1. **Tổ chức Stylesheet**:
   - Viết các quy tắc định dạng trong các file CSS tương ứng thuộc `css/` hoặc `admin/css/`.
   - **HẠN CHẾ TỐI ĐA** việc viết inline style (`style="margin-top: 10px; color: red;"`) trực tiếp trên thẻ HTML.
2. **Thiết kế thích ứng (Responsive Design)**:
   - Đảm bảo giao diện hiển thị tốt trên các kích thước màn hình: Mobile, Tablet và Desktop.
   - Kiểm tra kỹ thanh điều hướng (navbar/menu toggle), bảng dữ liệu (responsive table) và các hình ảnh đại diện (giữ tỷ lệ aspect ratio).
3. **Thống nhất phong cách thiết kế**:
   - Kế thừa và tuân thủ hệ thống class, màu sắc và typography hiện có trong dự án; không tự ý nạp thêm các framework CSS khổng lồ mới trừ khi được yêu cầu.

---

## 4. JavaScript & Trải Nghiệm Biểu Mẫu (Form UX)

1. **Xử lý sự kiện và DOM**:
   - Sử dụng Vanilla JavaScript chuẩn hoặc các thư viện hiện có trong repo (jQuery, CKEditor).
   - Đảm bảo các đoạn mã JS không bị lỗi undefined khi một phần tử DOM không tồn tại trên trang hiện tại.
2. **Bảo vệ CSRF trong Form và AJAX**:
   - Mọi form HTML POST bắt buộc phải có input hidden chứa CSRF token.
   - Khi gửi AJAX request (ví dụ qua `fetch()` hoặc jQuery `$.ajax()`), đính kèm CSRF token vào `FormData` hoặc request header.
3. **Chống Submit trùng lặp (Double Submit Prevention)**:
   - Đối với các nút submit form đặt tour, liên hệ hoặc lưu dữ liệu, thêm xử lý vô hiệu hóa nút (`button.disabled = true;`) hoặc hiển thị hiệu ứng đang xử lý khi người dùng click, ngăn chặn việc bấm nhiều lần làm tạo nhiều bản ghi trùng lặp.
4. **Giữ lại dữ liệu đã nhập khi form có lỗi (Form State Preservation)**:
   - Khi gửi form thất bại do sai validation ở server, trang PHP tải lại phải hiển thị lại các giá trị người dùng đã điền trước đó vào các ô input tương ứng.

---

## 5. Quy Trình Kiểm Tra Giao Diện (Frontend Execution Gate)

1. **ON-DEMAND ONLY**:
   - **KHÔNG TỰ ĐỘNG CHẠY** bất kỳ lệnh lint, build hay kiểm tra trình duyệt nào trừ khi người dùng yêu cầu rõ ràng bằng các từ khóa như `lint`, `check`, `verify`.
2. **Phương pháp kiểm tra hiện có**:
   - Kiểm tra cú pháp PHP của file giao diện: `php -l <file.php>` (khi môi trường có sẵn lệnh `php`).
   - Kiểm tra thủ công tính toàn vẹn của đường dẫn CSS/JS/Image trong mã HTML.
   - Chi tiết quy trình kiểm tra xem tại `.agent/rules/frontend-fastcheck.md`.
