---
name: realtime
description: Tích hợp cập nhật thời gian thực (SSE, AJAX Polling, WebSockets) cho ứng dụng PHP
---

## ⚡ Quy trình Tác chiến Thời gian thực (Realtime & Live Updates)

Sử dụng workflow này khi cần xây dựng thông báo trực tiếp, cập nhật đơn đặt tour mới, hoặc bảng điều khiển admin theo thời gian thực.

### 1. Phân tích Kiến trúc
- **Execution role**: `orchestrator`
- Lựa chọn giải pháp phù hợp với kiến trúc server-rendered PHP:
  - **Server-Sent Events (SSE)**: Phù hợp nhất cho luồng thông báo 1 chiều từ server đến admin (nhẹ, hỗ trợ sẵn qua HTTP).
  - **AJAX Long-Polling**: Phù hợp cho kiểm tra cập nhật định kỳ (dễ triển khai, tương thích 100% PHP truyền thống).
  - **WebSockets độc lập**: Khi yêu cầu tương tác hai chiều liên tục với tần suất cao.

### 2. Triển khai Server-side (PHP)
- **Execution role**: `backend-specialist`
- Với Server-Sent Events (SSE):
  ```php
  header('Content-Type: text/event-stream');
  header('Cache-Control: no-cache');
  header('Connection: keep-alive');
  ```
- Kiểm tra xác thực session người dùng trước khi mở luồng stream.
- Truy vấn CSDL MySQL tối ưu, tránh vòng lặp vô hạn làm nghẽn PHP worker thread (`sleep()` có kiểm soát và đóng buffer `ob_flush()`, `flush()`).

### 3. Đồng bộ Frontend (Vanilla JS)
- **Execution role**: `frontend-specialist`
- Sử dụng API `EventSource` nguyên bản hoặc `fetch()` định kỳ trong `js/**`.
- Xử lý sự kiện mất kết nối và tự động thử kết nối lại (auto-reconnect).
- Cập nhật DOM trực tiếp để hiển thị thông báo mới mà không cần tải lại toàn bộ trang.

### 4. Kiểm định & Đánh giá Tải
- **Execution role**: `verifier`
- Kiểm tra tài nguyên CPU và bộ nhớ khi có nhiều kết nối mở đồng thời.
- Đảm bảo session không bị lock (dùng `session_write_close()` khi chạy long-polling/stream).
