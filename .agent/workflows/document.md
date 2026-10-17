---
name: document
description: Soạn thảo và cập nhật tài liệu kỹ thuật cho ứng dụng PHP
---

# /document - Knowledge & Documentation System

$ARGUMENTS

---

## 🟢 PHASE 1: Codebase Extraction
**Execution role**: `orchestrator`
**Nhiệm vụ**: Xác định nội dung cần giải thích và ghi chép.
- Rà soát các hàm xử lý dữ liệu, câu truy vấn PDO, cấu trúc bảng MySQL và luồng giao diện trong `layout/**`.
- Xác định khoảng trống thông tin cần bổ sung tài liệu.

## 🟡 PHASE 2: Structural Drafting
**Execution role**: `orchestrator`
**Nhiệm vụ**: Xây dựng cấu trúc tài liệu rõ ràng:
- **Mục đích**: File/module này làm gì trong hệ thống?
- **Luồng dữ liệu**: Dữ liệu lấy từ đâu (bảng MySQL nào), xử lý ra sao, và render vào template nào?
- **Lưu ý & Rủi ro**: Các điều kiện cần có (kết nối CSDL, session admin, autoload PHPMailer).
- Định dạng chuẩn Markdown (GFM).

## 🔵 PHASE 3: Surgical Update
**Execution role**: `orchestrator`
**Nhiệm vụ**: Cập nhật tài liệu kỹ thuật hoặc chú thích trực tiếp trong code:
- Cập nhật tài liệu kiến trúc, tài liệu hướng dẫn hoặc docblock PHP trong code (`/** ... */`).
- Đảm bảo tài liệu ngắn gọn, đi thẳng vào bản chất kỹ thuật, không rườm rà.

## 🔴 PHASE 4: Clarity Audit & Sync
**Execution role**: `verifier`
**Nhiệm vụ**: Kiểm định chất lượng tài liệu.
- Đảm bảo các đường dẫn file, tên biến và cấu trúc bảng khớp 100% với mã nguồn hiện tại.
- Cập nhật `walkthrough.md` nếu là đợt cập nhật tài liệu lớn.

---

## Tiêu chí Tài liệu:
- **Đúng Thực tế**: Tài liệu phải phản ánh đúng hành vi code hiện hành.
- **Dễ hiểu**: Phục vụ tốt cho việc bảo trì dài hạn và onboarding thành viên mới.

---

## Ví dụ:
- `/document database schema and pdo queries`
- `/document admin authentication flow`
- `/document tour booking and mail notification flow`
