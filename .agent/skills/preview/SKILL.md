---
name: preview
description: "Xem trước ứng dụng web hoạt động. Use when previewing web applications, checking UI components, or testing local runtime."
---

# /preview - Preview Management

Quản lý xem trước ứng dụng web PHP: kiểm tra trạng thái, khởi động máy chủ thử nghiệm cục bộ khi được yêu cầu.

---

## Task

Manage preview server: start, stop, status check.

### Commands

```
/preview           - Show current status
/preview start     - Start local development server (e.g. php -S localhost:8000)
/preview stop      - Stop server
/preview check     - Health check endpoint
```

---

## Usage Examples

### Start Local PHP Server (khi có runtime PHP CLI và user yêu cầu)
```
/preview start

Response:
🚀 Starting preview...
   Command: php -S localhost:8000
   Type: PHP Web Application

✅ Preview ready!
   URL: http://localhost:8000
```

### Status Check
```
/preview

Response:
=== Preview Status ===

🌐 URL: http://localhost:8000
📁 Project: /home/nguyentd/longphat
🏷️ Type: PHP Procedural App
💚 Health: OK
```

### Khi chưa cài đặt runtime PHP:
Nếu môi trường thực thi chưa cài đặt lệnh `php`:
```
Response:
⚠️ Runtime PHP CLI chưa khả dụng trong môi trường hiện tại.
Vui lòng cấu hình máy chủ web (Apache/Nginx/PHP-FPM) hoặc cài đặt PHP CLI để xem trước ứng dụng trực tiếp.
```
