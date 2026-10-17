---
trigger: glob
glob: "**/*.php,tests/**"
description: "Quy tắc kiểm thử và phân định ranh giới vai trò: ON-DEMAND ONLY, tách quyền viết test, verifier, test-author và các lệnh kiểm tra PHP an toàn."
---

# TEST-ENFORCEMENT.MD - Quy Tắc Kiểm Thử & Ranh Giới Vai Trò

> Mục tiêu: Đảm bảo chất lượng mã nguồn PHP/JS, phân định ranh giới vai trò rõ ràng giữa người triển khai (`implementer`) và người kiểm thử (`test-author`, `verifier`), ngăn ngừa tình trạng test giả hoặc tự ý chạy lệnh tốn tài nguyên.

---

## 1. Khi Nào Chạy Kiểm Thử Và Ranh Giới Vai Trò

1. **Phân định vai trò (Role Separation)**:
   - Việc chạy bộ kiểm thử và kiểm chứng tự động thuộc về Agent nghiệm thu (`verifier`).
   - Agent triển khai (`backend-specialist`, `frontend-specialist`, `implementer`): **TUYỆT ĐỐI CẤM** tự ý chạy các lệnh kiểm thử tự động, lint hoặc build giữa phiên làm việc.
2. **Nguyên tắc ON-DEMAND ONLY (BẮT BUỘC)**:
   - **DO NOT RUN test or lint automatically.**
   - Chỉ kích hoạt lệnh kiểm thử khi người dùng yêu cầu rõ ràng đích danh vai trò `verifier` hoặc một lệnh/phạm vi kiểm tra cụ thể (`php -l`, `composer validate`, `test`).
   - Các chỉ thị lập kế hoạch, task manifest, hoặc phân công `test-author` KHÔNG cấp quyền tự động chạy kiểm thử.
3. **Tính Idempotent**:
   - Khi có sự cho phép rõ ràng từ người dùng, chỉ chạy kiểm thử 1 lần cho trạng thái mã nguồn hiện tại. Không chạy lại khi các file liên quan chưa có thay đổi.

---

## 2. Ranh Giới Bảo Vệ Ở Tầng Runtime

Quy định phân quyền thực thi qua boundary guard và các biến môi trường:

| Rule | Mục tiêu chặn | Role được phép |
|---|---|---|
| **R1** | Chạy lệnh kiểm thử / test suite: `phpunit`, `jest`, `vitest`, `playwright`, `npm test` | `verifier`, `test-author` |
| **R2** | Ghi vào thư mục kiểm thử (`tests/**`, `*Test.php`) qua Edit/Write hoặc shell | `test-author` |
| **R3** | Sửa các file cấu hình enforcement (boundary guard, settings) | `maintainer` |

- **Biến môi trường vai trò**: Biến `COGAIN_AGENT_ROLE` được giữ nguyên (tên biến lịch sử để đảm bảo tương thích hệ thống). Ví dụ khi thực thi với role verifier: `COGAIN_AGENT_ROLE=verifier`.
- Role mặc định là `implementer` (chặt nhất). Agent bị chặn thì dừng lại và báo cáo, tuyệt đối không tự ý mở quyền cho chính mình.

---

## 3. Tách Quyền Viết Test (Chống Test Xanh Giả)

1. **Người viết code không viết test cho chính mình**:
   - Agent triển khai code tính năng (`backend-specialist`) **không được viết test cho chính code đó**, nhằm tránh việc vô tình hợp thức hóa các hành vi sai lệch vừa tạo ra.
   - Việc viết test độc lập thuộc về vai trò `test-author` (sở hữu thư mục `tests/**`, `*Test.php`).
2. **Cấm các hành vi gian lận test**:
   - Cấm sửa assertion, xóa test, hoặc hardcode giá trị fixture vào code production chỉ để test vượt qua.
   - Cấm nuốt exception hoặc nới lỏng khối `catch` để che giấu lỗi thực tế.
3. **Đánh giá dựa trên diff thực tế**:
   - `verifier` phải đọc kỹ diff thay đổi của implementation và so khớp với yêu cầu nghiệp vụ, không chỉ dựa vào việc test chạy thành công.

---

## 4. Các Lệnh Kiểm Tra Thực Tế Trong Ứng Dụng PHP

1. **Kiểm tra cú pháp PHP (Syntax Lint)**:
   - Lệnh: `php -l <file.php>` (ví dụ: `php -l db.php` hoặc `php -l index.php`).
   - *Lưu ý môi trường runtime*: Lệnh `php -l` chỉ khả dụng khi máy chủ hoặc môi trường container đã cài đặt CLI `php`. Nếu môi trường chỉ có Node.js mà chưa có binary `php`, không cố chạy lệnh này để tránh phát sinh lỗi `command not found`; thay vào đó thực hiện static inspection.
2. **Kiểm tra tính hợp lệ của Composer**:
   - Lệnh: `composer validate` (chỉ khi có Composer CLI).
3. **Kiểm thử đơn vị (PHPUnit)**:
   - Chỉ chạy khi dự án đã được cài đặt và cấu hình PHPUnit trong `composer.json` (hiện tại repo chưa cài đặt PHPUnit, không giả định sự tồn tại của nó).
