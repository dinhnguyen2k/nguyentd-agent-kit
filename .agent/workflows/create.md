---
name: create
description: Phát triển tính năng mới toàn diện cho ứng dụng PHP theo quy trình chuyên nghiệp
---

# /create - Full-Cycle Feature Creation

$ARGUMENTS

---

## 🟢 PHASE 1: Requirements Discovery
**Execution role**: `orchestrator`
**Nhiệm vụ**: Xác định rõ mục tiêu tính năng ("What" & "Why").
- Phân tích yêu cầu của người dùng và rà soát kiến trúc ứng dụng PHP hiện tại.
- Xác định phạm vi ảnh hưởng: Các file PHP gốc, template `layout/**`, CSS/JS, và bảng CSDL MySQL liên quan.

## 🟡 PHASE 2: Strategic Architecture (PLAN)
**Execution role**: `orchestrator`
**Nhiệm vụ**: Lập kế hoạch chi tiết ("How").
- Kích hoạt quy trình `/plan` nếu tính năng có độ phức tạp cao hoặc chạm nhiều file.
- Định hình kế hoạch triển khai: Lược đồ bảng MySQL, truy vấn PDO, luồng xử lý form, và giao diện HTML/CSS.
- Người dùng xác nhận kế hoạch trước khi bắt đầu viết code.

## 🔵 PHASE 3: Surgical Execution
**Execution role**: `orchestrator` điều phối
**Nhiệm vụ**: Triển khai mã nguồn theo đúng phân vai chuyên môn:
1. `backend-specialist`: Xử lý CSDL MySQL, truy vấn PDO với prepared statements, xử lý logic PHP, xác thực session, và tích hợp PHPMailer nếu cần.
2. `frontend-specialist`: Xây dựng layout HTML semantic, CSS trong `css/**`, Javascript tương tác trong `js/**`, và nhúng biến hiển thị an toàn (`htmlspecialchars`).
3. Đảm bảo phân định rõ quyền sở hữu file, tránh xung đột ghi đè.

## 🔴 PHASE 4: Professional Audit & Handoff
**Execution role**: `verifier` & `test-author`
**Nhiệm vụ**: Đảm bảo cổng chất lượng trước khi bàn giao.
- Kiểm tra tính bảo mật (SQL Injection, XSS, CSRF, bảo vệ mật khẩu).
- Thực hiện kiểm tra on-demand theo yêu cầu người dùng (cú pháp `php -l`, composer validate, hoặc kịch bản kiểm thử độc lập).
- Tạo hoặc cập nhật `walkthrough.md` với bằng chứng công việc đã hoàn thành.

---

## Quy tắc Thực hiện:
- **Tính thực tế**: Không dùng code giả lập, placeholder chưa hoàn thiện.
- **Bảo mật**: Không bao giờ hardcode mật khẩu CSDL hoặc SMTP credentials.
- **Tương thích Stack**: Không tự ý cài framework nặng hoặc chuyển đổi kiến trúc sang SPA/React trừ khi có yêu cầu rõ ràng.

---

## Ví dụ:
- `/create tour booking form with email notification`
- `/create admin visa management module`
- `/create customer contact inquiry with PHPMailer`
