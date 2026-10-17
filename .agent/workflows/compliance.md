---
name: compliance
description: Rà soát bảo vệ dữ liệu cá nhân và tuân thủ pháp lý cho website
---

## ⚖️ Quy trình Kiểm soát Pháp lý & An toàn Dữ liệu Khách hàng

Đảm bảo website thu thập và xử lý thông tin khách hàng (đặt tour, liên hệ, tư vấn visa) tuân thủ quy định về bảo vệ dữ liệu cá nhân.

### 1. Rà soát Thu thập Dữ liệu (Data Inventory)
- **Execution role**: `orchestrator`
- Xác định các trường thông tin cá nhân thu thập: Họ tên, số điện thoại, email, địa chỉ, yêu cầu tour trong `lien-he.php` và các form đặt tour.
- Kiểm tra tính cần thiết: Chỉ thu thập đúng thông tin phục vụ liên hệ và nghiệp vụ du lịch.

### 2. Chính sách Bảo mật & Điều khoản
- **Execution role**: `orchestrator` & `frontend-specialist`
- Tích hợp liên kết Chính sách bảo mật (Privacy Policy) và Điều khoản sử dụng trong `layout/footer.php`.
- Bổ sung thông báo Cookie Consent và điều khoản đồng ý xử lý thông tin tại các form gửi thông tin khách hàng.

### 3. Bảo vệ Dữ liệu trong CSDL & Truyền tải
- **Execution role**: `backend-specialist` & `verifier`
- Bắt buộc sử dụng HTTPS cho toàn bộ website.
- Bảo mật thông tin lưu trong MySQL: Giới hạn quyền truy cập tài khoản CSDL, kiểm tra session admin, không lưu mật khẩu dạng plaintext.

### 4. Báo cáo Tuân thủ & Bàn giao
- **Execution role**: `verifier`
- Xác nhận các biện pháp bảo vệ dữ liệu đã được triển khai.
- Ghi nhận trạng thái tuân thủ vào báo cáo kiểm định bàn giao.
