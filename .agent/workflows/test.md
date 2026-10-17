---
name: test
description: Kiểm thử và xác minh chất lượng mã nguồn PHP theo nhu cầu (On-Demand)
---

# /test - Verification & Test Suite

$ARGUMENTS

---

## 🟢 PHASE 1: Code Analysis & Edge Case Mapping
**Execution role**: `test-author`
**Nhiệm vụ**: Xác định không gian kiểm thử cho logic PHP hoặc giao diện.
- **Phân tích**: Xác định các hàm xử lý dữ liệu, câu lệnh truy vấn PDO MySQL, xử lý form submit, hoặc hàm tiện ích.
- **Kịch bản**: Lập danh sách kịch bản kiểm thử:
  - **Happy Path**: Dữ liệu hợp lệ, truy vấn trả về kết quả đúng.
  - **Edge Cases**: Dữ liệu rỗng, số lượng bản ghi bằng 0, chuỗi ký tự đặc biệt tiếng Việt, giới hạn pagination.
  - **Failure Cases**: Lỗi kết nối CSDL, tham số đầu vào không hợp lệ, dữ liệu độc hại tiềm ẩn XSS/SQL Injection.

## 🟡 PHASE 2: Test Strategy & Fixtures
**Execution role**: `test-author`
**Nhiệm vụ**: Xây dựng chiến lược kiểm thử phù hợp với kiến trúc ứng dụng PHP thuần.
- **Phương án kiểm thử**:
  - **Cú pháp**: `php -l <file>` (kiểm tra lỗi cú pháp PHP).
  - **Composer**: `composer validate` (kiểm tra tính hợp lệ của composer.json).
  - **PHPUnit**: Chỉ áp dụng khi dự án đã cài đặt và cấu hình sẵn PHPUnit (`vendor/bin/phpunit` hoặc `phpunit.xml`). Tuyệt đối không tự ý cài đặt package testing mới mà không có sự đồng ý.
  - **Script kiểm thử độc lập**: Viết test script procedural riêng biệt trong `tests/` nếu cần xác minh logic cụ thể.

## 🔵 PHASE 3: Test Implementation
**Execution role**: `test-author`
**Nhiệm vụ**: Soạn thảo các ca kiểm thử.
- Đặt file kiểm thử đúng quy ước: `tests/**`, `*Test.php`.
- Không làm thay đổi hay làm ô nhiễm dữ liệu thật trong cơ sở dữ liệu production.
- Đảm bảo kiểm thử độc lập, có thể dọn dẹp dữ liệu kiểm thử sau khi hoàn thành.

## 🔴 PHASE 4: Verification & Sign-off
**Execution role**: `verifier`
**Nhiệm vụ**: Xác minh kết quả kiểm thử.
- **Chính sách On-Demand**: Chỉ chạy lệnh kiểm thử khi người dùng yêu cầu đích danh.
- **Điều kiện môi trường**: Lệnh `php -l` hoặc PHPUnit phụ thuộc vào việc môi trường đã cài đặt PHP CLI hay chưa. Nếu thiếu runtime, báo rõ trạng thái thay vì giả lập chạy.
- **Báo cáo**: Ghi nhận kết quả `pass/fail` kèm bằng chứng thực thi trong `walkthrough.md`.

---

## Tiêu chí Kiểm thử:
- **An toàn CSDL**: Không chạy test ghi vào CSDL thật mà không có transaction rollback hoặc DB test riêng.
- **Không tự ý cài đặt**: Giữ nguyên dependency hiện tại (`phpmailer/phpmailer`), không tự ý cài thêm tool testing nặng.
- **Rõ ràng**: Báo cáo rõ ràng lỗi (nếu có) và dòng code cụ thể cần điều chỉnh.

---

## Ví dụ:
- `/test syntax lien-he.php`
- `/test tour-detail query logic`
- `/test admin auth session`
