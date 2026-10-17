---
name: blog
description: Quản lý và phát triển tính năng tin tức / bài viết (Blog) cho website PHP
---

## 📝 Quy trình Phát triển & Tối ưu Phân hệ Blog

Hướng dẫn phát triển, hiển thị và quản lý bài viết tin tức du lịch trong ứng dụng PHP Long Phát (`blog.php`, `blog-detail.php`, `admin/**`).

### 1. Cấu trúc Dữ liệu & Quản trị (Admin)
- **Execution role**: `backend-specialist`
- Bảng CSDL MySQL lưu bài viết (tiêu đề, slug, tóm tắt, nội dung HTML, ảnh đại diện, ngày tạo, trạng thái hiển thị).
- Chức năng quản trị bài viết trong `admin/**`: Thêm, sửa, xóa, duyệt bài với bảo vệ CSRF và phân quyền session.
- Xử lý upload ảnh đại diện bài viết an toàn vào `images/**`.

### 2. Hiển thị Trang Tin tức Công khai
- **Execution role**: `frontend-specialist` (phối hợp dữ liệu từ `backend-specialist`)
- `blog.php`: Hiển thị danh sách bài viết theo phân trang (pagination), định dạng ngày tháng tiếng Việt, hiển thị ảnh đại diện responsive.
- `blog-detail.php`: Trang chi tiết bài viết với layout chuẩn (`layout/header.php`, `layout/footer.php`), sidebar bài viết liên quan/mới nhất.
- Chống XSS: Thoát các dữ liệu người dùng nhập, cho phép HTML an toàn trong phần nội dung bài viết từ admin (qua whitelist sanitize).

### 3. Tối ưu SEO & Chia sẻ Mạng xã hội
- **Execution role**: `frontend-specialist` & `verifier`
- Cấu hình OpenGraph động (`og:title`, `og:image`, `og:description`) theo bài viết cụ thể trong `layout/header.php`.
- Tự động tạo thẻ meta canonical và cấu trúc dữ liệu Schema.org Article / NewsArticle.
