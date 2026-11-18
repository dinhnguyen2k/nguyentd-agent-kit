---
name: compliance
description: Legal & Data Privacy Compliance (GDPR, HIPAA, SOC2).
---

## ⚖️ Quy trình Kiểm soát Pháp lý & Tuân thủ

Đảm bảo dự án của bạn đáp ứng các tiêu chuẩn an toàn dữ liệu toàn cầu.

### Quyền thực thi và artifact
- Yêu cầu rà soát/inspect chỉ trả findings và dẫn chứng trong chat, không sửa file hoặc persist báo cáo nếu chưa có quyền ghi riêng.
- Chỉ triển khai bước 2 khi user yêu cầu sửa/triển khai; quyền ghi không cấp quyền chạy scanner hoặc validation.
- Một slice chỉ dùng contract/checkpoint gọn khi handoff/resume cần; nhiều slice dùng `.agent/planning/{task-slug}/00-OVERVIEW.md` và `TASK-*.md` theo `/plan`.
- Scope/acceptance nằm trong TASK canonical; overview chỉ index/link, chỉ coordinator cập nhật lifecycle.
- Lane governed dẫn xuất manifest từ metadata TASK bằng parser canonical, không sửa tay manifest hoặc sao chép acceptance.
- Packet handoff tham chiếu identity của contract snapshot và quan hệ supersession; không tạo PLAN, implementation_plan, walkthrough hoặc handoff chỉ để lặp lại contract.
- Giữ báo cáo pháp lý/domain, Privacy Policy và Terms of Service độc nhất khi được yêu cầu rõ, tại path được cấp quyền.
- Research chỉ persist khi được yêu cầu trong `.agent/artifacts`, không ghi mới vào `reports/artifacts`.

### 1. Rà soát Dữ liệu (Inventory)
- Xác định các loại dữ liệu cá nhân (PII) đang thu thập.
- Kiểm tra mục đích sử dụng dữ liệu.

### 2. Áp dụng DNA Compliance
- Triển khai `Privacy Policy` và `Terms of Service` từ thư mục `.shared/compliance`.
- Cấu hình Cookie Consent và Data Deletion mechanisms.

### 3. Kiểm kê Bảo mật
- Auditor: `security review role`.
- Kiểm tra mã hóa dữ liệu (At rest & In transit).

### 4. Báo cáo Tuân thủ
- Mặc định trả findings, dẫn chứng, giới hạn đánh giá và validation status trong chat.
- Chỉ xuất `COMPLIANCE_REPORT.md` để bàn giao khách hàng/đối tác khi user yêu cầu rõ báo cáo file và path được cấp quyền; không tự tạo cho inspect-only.

- Chỉ chạy `npx compliance-scanner .` khi user yêu cầu đúng hành động scanner và dependency đã được xác minh theo quy tắc an toàn; không dùng turbo hoặc tự tải package.
- Nếu chưa được yêu cầu validation, ghi `Validation: not run - not requested`; không tuyên bố đạt compliance chỉ từ inspection.
