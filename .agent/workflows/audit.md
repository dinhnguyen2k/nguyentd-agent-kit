---
name: audit
description: Audit phân tầng ngữ cảnh (Progressive Disclosure) với 5 bước phân cấp rủi ro & kiểm định 4 câu hỏi cốt lõi cho ứng dụng PHP.
---

# /audit - Progressive Disclosure Sign-off Workflow

$ARGUMENTS

---

## 🎯 4 CÂU HỎI BẮT BUỘC TRẢ LỜI TẠI STEP 5:
1. **Scope & Requirement**: Code có đúng và đủ theo yêu cầu ban đầu không?
2. **Standards & Security**: Code có tuân thủ Architecture, Conventions (`AI_RULES.md`) & Bảo mật (PDO prepared statements, escaping XSS, CSRF) không?
3. **Robustness & Edge Cases**: Code có hoạt động đúng ở Happy Path + Edge Cases + Failure Cases không?
4. **Certification**: Code có đạt chất lượng để tích hợp mà không gây rủi ro phá vỡ hệ thống không?

---

## 🟢 STEP 1: Target Identification (Phân loại Domain)
- **Execution role**: `orchestrator`
- **Skills**: `git-advanced-workflows`, `concise-planning`
- **Thực hiện**: Phân loại theo quyền sở hữu file:
  - **FE**: `css/**`, `js/**`, `images/**`, `layout/**`, và PHP presentation qua explicit handoff $\rightarrow$ Kích hoạt `frontend-specialist`.
  - **BE**: `**/*.php`, `composer.json/lock`, thư mục cấu hình/migrations (ngoại trừ `vendor/**` và tests) $\rightarrow$ Kích hoạt `backend-specialist`.
  - **BE + FE (Dual-Domain)** $\rightarrow$ `orchestrator` điều phối tuần tự hoặc phân ranh giới rõ ràng.

---

## 🟡 STEP 2: Risk-Based Triage (Phân cấp Rủi ro Audit)
- **Execution role**: `backend-specialist` / `frontend-specialist`
- **Phân cấp & Phạm vi**:
  - 🟢 **Low Risk** (Chỉnh sửa UI CSS nhỏ, typo, thêm log, comment, sửa text tĩnh):
    - *Mode*: Lightweight Audit
    - *Kiểm tra*: Cú pháp PHP hợp lệ (`php -l`), kiểm tra hiển thị không vỡ layout.
  - 🟡 **Medium Risk** (Thêm tính năng hiển thị mới, sửa logic query PDO, thêm form liên hệ):
    - *Mode*: Specialist Audit
    - *Kiểm tra*: Dùng prepared statements chuẩn, escape HTML đầy đủ, kiểm tra dữ liệu đầu vào.
  - 🔴 **High Risk** (Xác thực admin, đổi mật khẩu, xử lý file upload, thay đổi schema bảng MySQL, gửi email qua SMTP):
    - *Mode*: Full Audit
    - *Kiểm tra*: Quét lỗ hổng injection, kiểm tra quyền truy cập session, an toàn upload và bảo vệ credentials.

---

## 🔵 STEP 3: Finding-Driven Lazy Context Investigation
- **Execution role**: `backend-specialist` / `frontend-specialist`
- **Nguyên tắc**: Không load tràn lan codebase. Chỉ Lazy Load context khi có **Finding** (Lỗi/Nghi vấn).
- **Skills Nạp Theo Loại Finding**:
  - 🐞 *Nghi vấn Logic / Code quality*: Nạp `debugging-master`, `clean-code`.
  - 🔒 *Nghi vấn Bảo mật (Security)*: Nạp `vulnerability-scanner`, `php-development`.
  - 🗄️ *Nghi vấn Database / Truy vấn*: Nạp `mysql`, `database-optimizer`.
  - ⚡ *Nghi vấn Hiệu năng (Performance)*: Nạp `performance-profiling`, `performance-engineer`.

---

## 🟣 STEP 4: Target-Focused Testing (On-Demand)
- **Execution role**: `test-author` & `verifier`
- **Thực hiện**:
  - Kiểm tra theo yêu cầu rõ ràng của người dùng (không tự động chạy ngầm).
  - Lệnh syntax: `php -l <file>` (khi môi trường có PHP runtime).
  - Lệnh Composer: `composer validate` (khi có Composer).
  - PHPUnit: Chỉ chạy khi dự án đã cấu hình và cài đặt PHPUnit.
  - Kiểm tra 3 kịch bản: **Happy Path**, **Edge Cases** (ký tự tiếng Việt, null, empty array), và **Failure Cases** (lỗi kết nối DB, input độc hại).

---

## 🔴 STEP 5: Final Certification & Sign-off
- **Execution role**: `orchestrator` & `verifier`
- **Thực hiện**:
  1. Kiểm định và trả lời 4 câu hỏi cốt lõi.
  2. Bắt buộc từ chối nếu tồn tại lỗi Bảo mật Nghiêm trọng (SQL injection, lộ mật khẩu trong code, thiếu escape HTML ở form nhập liệu).
  3. Cập nhật artifact `walkthrough.md` với minh chứng thực tế.
  4. Đưa ra kết luận **PASSED** hoặc **REJECTED** (kèm danh sách điểm cần sửa).
