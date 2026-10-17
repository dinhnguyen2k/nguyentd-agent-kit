---
name: monitor
description: Giám sát trạng thái hoạt động và sức khỏe của ứng dụng PHP / MySQL
---

# /monitor - PHP Application Observability & Health

$ARGUMENTS

---

## 🟢 PHASE 1: Topology Discovery
**Execution role**: `orchestrator`
**Nhiệm vụ**: Xác định các điểm trọng yếu cần giám sát.
- Điểm kết nối CSDL MySQL (`db.php`).
- File log lỗi PHP (`error_log` hoặc cấu hình logging của web server).
- Các endpoint quan trọng: trang chủ, chi tiết tour, form liên hệ, đăng nhập admin.
- Thư mục lưu trữ tệp tin upload và phân vùng đĩa.

## 🟡 PHASE 2: Sourcing & Alerting Logic
**Execution role**: `orchestrator`
**Nhiệm vụ**: Xác định ngưỡng sức khỏe hệ thống.
- HTTP status: Phản hồi 200 OK cho các trang chính.
- Tần suất lỗi Fatal Error hoặc PDOException trong PHP error log.
- Thời gian phản hồi trang web và truy vấn MySQL chậm (Slow Query Log).

## 🔵 PHASE 3: Surgical Instrumentation
**Execution role**: `backend-specialist`
**Nhiệm vụ**: Thiết lập cơ chế ghi nhận và cảnh báo.
- Bật ghi log lỗi PHP an toàn (ghi log vào file nội bộ, không hiển thị trực tiếp ra màn hình trên môi trường production).
- Thiết lập cơ chế bắt `PDOException` và ghi nhận chi tiết lỗi vào log hệ thống.
- Cấu hình bắt lỗi khi gửi email qua PHPMailer.

## 🔴 PHASE 4: Reliability Audit
**Execution role**: `verifier`
**Nhiệm vụ**: Xác minh hoạt động của hệ thống giám sát.
- Kiểm tra tính đầy đủ của file log.
- Xác nhận không có thông tin đăng nhập CSDL hoặc mật khẩu người dùng bị ghi vào file log.
- Báo cáo trạng thái sức khỏe tổng thể.

---

## Nguyên tắc Giám sát:
- **Không làm chậm ứng dụng**: Cơ chế ghi log phải nhẹ và không gây nghẽn I/O.
- **Bảo mật Log**: File log không được đặt trong thư mục public có thể tải về trực tiếp từ trình duyệt.
- **Dựa trên Bằng chứng**: Phán đoán dựa vào số liệu và thông báo lỗi thực tế.

---

## Ví dụ:
- `/monitor check db connection health`
- `/monitor inspect php error log`
- `/monitor check disk space and uploads folder`
