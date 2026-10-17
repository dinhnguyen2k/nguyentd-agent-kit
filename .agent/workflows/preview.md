---
name: preview
description: Quản lý preview server nội bộ cho ứng dụng PHP
---

# /preview - Local PHP Preview Server

$ARGUMENTS

---

## Task

Quản lý preview server cục bộ phục vụ kiểm thử giao diện và luồng xử lý web PHP.

### Commands

```
/preview           - Xem trạng thái máy chủ preview
/preview start     - Khởi động máy chủ preview cục bộ
/preview stop      - Dừng máy chủ preview
```

---

## ⚠️ Điều kiện Tiên quyết & Cảnh báo Quan trọng

1. **Yêu cầu Runtime PHP**:
   - Preview server sử dụng built-in web server của PHP CLI: `php -S 127.0.0.1:8000 -t .`
   - Chỉ thực thi được khi môi trường máy trạm đã cài đặt binary `php`. Nếu chưa có `php`, không tự động claim là server đang chạy.
2. **Cơ sở dữ liệu MySQL**:
   - Ứng dụng phụ thuộc vào kết nối MySQL trong `db.php`.
   - Cần cấu hình database MySQL cục bộ hoặc qua biến môi trường trước khi kiểm tra các tính năng tương tác dữ liệu.
   - **Tuyệt đối không cam kết ứng dụng hoạt động đầy đủ nếu thiếu database.**
3. **Bảo mật Thông tin Đăng nhập**:
   - Không in, hiển thị hoặc ghi log thông tin mật khẩu database (`$pass`) hay tài khoản SMTP ra màn hình chat hoặc log công khai.
4. **Phạm vi mạng**:
   - Chỉ chạy preview tại địa chỉ nội bộ `127.0.0.1` (loopback), không mở cổng ra public network.

---

## Lệnh thực thi Cục bộ (Manual / On-demand)

Khởi động máy chủ cục bộ:
```bash
# Chỉ chạy khi máy trạm đã cài PHP và đứng tại thư mục gốc ứng dụng
php -S 127.0.0.1:8000 -t .
```

Địa chỉ truy cập trình duyệt:
`http://127.0.0.1:8000`

---

## Ví dụ Sử dụng

### Bật Preview
```
User: /preview start

Phản hồi:
🚀 Khởi động PHP built-in web server:
   Lệnh: php -S 127.0.0.1:8000 -t .
   URL: http://127.0.0.1:8000
   Trạng thái: Đang lắng nghe trên loopback

⚠️ Lưu ý:
- Yêu cầu môi trường đã cài PHP CLI.
- Các trang động (tours, visa, blogs, admin) cần dịch vụ MySQL hoạt động.
- Không cam kết hoạt động đầy đủ nếu CSDL chưa kết nối.
```
