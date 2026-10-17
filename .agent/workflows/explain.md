---
name: explain
description: Giải thích chi tiết mã nguồn, kiến trúc và luồng dữ liệu ứng dụng PHP
---

## 💡 Quy trình Giải thích Tri thức & Luồng Xử lý

Quy trình này phục vụ giải thích chuyên sâu luồng xử lý mã nguồn, bóc tách câu truy vấn CSDL, hoặc hướng dẫn thành viên mới hiểu rõ bản chất kiến trúc ứng dụng.

### 1. Bóc tách Logic & Căn cứ Kỹ thuật
- **Execution role**: `orchestrator` hoặc `backend-specialist` / `frontend-specialist`
- Giải thích **"Tại sao" (Why)** thay vì chỉ liệt kê "Làm gì" (What).
- Làm rõ luồng tương tác: Từ yêu cầu người dùng -> file PHP xử lý -> truy vấn CSDL MySQL qua PDO -> template hiển thị `layout/**`.
- Phân tích rõ các quyết định thiết kế: lý do dùng prepared statements, cơ chế bảo vệ XSS/CSRF, và cách tổ chức session.

### 2. Ví dụ Minh họa Cụ thể
- **Execution role**: `backend-specialist` hoặc `frontend-specialist`
- Đưa ra đoạn mã PHP hoặc HTML/CSS ngắn gọn, có chú thích giải thích từng bước xử lý dữ liệu.
- Phân tích các trường hợp biên (edge cases) và cách mã nguồn xử lý khi dữ liệu rỗng hoặc sai định dạng.

### 3. Đánh đổi Kỹ thuật & Rủi ro
- **Execution role**: `verifier`
- Nêu rõ các đánh đổi kỹ thuật (ví dụ: truy vấn đơn giản vs tối ưu index CSDL, render server vs AJAX).
- Cảnh báo các rủi ro bảo mật tiềm ẩn và lưu ý khi mở rộng thêm chức năng.
