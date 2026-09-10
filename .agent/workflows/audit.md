---
name: audit
description: Audit phân tầng ngữ cảnh (Progressive Disclosure) với 5 bước phân cấp rủi ro & kiểm định 4 câu hỏi cốt lõi.
---

# /audit - Progressive Disclosure Sign-off Workflow

$ARGUMENTS

---

## 🎯 4 CÂU HỎI BẮT BUỘC TRẢ LỜI TẠI STEP 5:
1. **Scope & Requirement**: Code có đúng và đủ theo yêu cầu ban đầu không?
2. **Standards & Security**: Code có tuân thủ Architecture, Conventions (`AI_RULES.md`) & Bảo mật không?
3. **Robustness & Edge Cases**: Code có hoạt động đúng ở Happy Path + Edge Cases + Failure Cases không?
4. **Certification**: Code có đạt chất lượng 100% (Zero-Tolerance) để merge/ship không?

---

## 🟢 STEP 1: Target Identification (Phân loại Domain)
- **Execution role**: Main Orchestrator
- **Skills**: `git-advanced-workflows`, `concise-planning`
- **Thực hiện**: Chạy `git status` và `git diff --name-only` phân loại:
  - **FE Only** (`frontend/**`) $\rightarrow$ Kích hoạt `frontend-specialist`.
  - **BE Only** (`backend/**`) $\rightarrow$ Kích hoạt `backend-specialist`.
  - **BE + FE (Dual-Domain)** $\rightarrow$ Phối hợp cả `backend-specialist` và `frontend-specialist`.

---

## 🟡 STEP 2: Risk-Based Triage (Phân cấp Rủi ro Audit)
- **Execution role**: `backend-specialist` / `frontend-specialist`
- **Phân cấp & Skills**:
  - 🟢 **Low Risk** (Chỉnh sửa UI nhỏ, typo, thêm log, comment, config đơn giản):
    - *Mode*: Lightweight Audit
    - *Skills*: `clean-code`, `lint-and-validate`
    - *Kiểm tra*: Build/lint pass, scope check nhanh.
  - 🟡 **Medium Risk** (Thêm feature mới nội bộ, sửa service logic, schema DB không breaking):
    - *Mode*: Specialist Audit
    - *Skills*: `code-reviewer`, `agent-backend-patterns` / `agent-frontend-patterns`
    - *Kiểm tra*: Clean Architecture, Security scan cơ bản, unit tests vùng bị tác động.
  - 🔴 **High Risk** (Core auth, payment, data migration, breaking API, security patch, shared modules):
    - *Mode*: Full Audit
    - *Skills*: `vulnerability-scanner`, `architecture-patterns`
    - *Kiểm tra*: Deep vulnerability scan, full regression suite, stress test edge/failure cases.

---

## 🔵 STEP 3: Finding-Driven Lazy Context Investigation
- **Execution role**: `backend-specialist` / `frontend-specialist`
- **Nguyên tắc**: Không load tràn lan codebase. Chỉ Lazy Load context khi có **Finding** (Lỗi/Nghi vấn).
- **Skills Nạp Theo Loại Finding**:
  - 🐞 *Nghi vấn Logic / Code quality*: Nạp `debugging-master`, `clean-code`.
  - 🔒 *Nghi vấn Bảo mật (Security)*: Nạp `vulnerability-scanner`, `determine_threat_model`.
  - 🗄️ *Nghi vấn Database / Migration*: Nạp `postgresql`, `database-optimizer`.
  - ⚡ *Nghi vấn Hiệu năng (Performance)*: Nạp `performance-profiling`, `performance-engineer`.

---

## 🟣 STEP 4: Target-Focused Testing
- **Execution role**: `backend-specialist` (BE) / `frontend-specialist` (FE)
- **Skills**:
  - *Backend Testing*: `tdd-workflow`, `unit-testing-test-generate`
  - *Frontend & E2E Testing*: `e2e-testing-patterns`, `playwright-skill`, `webapp-testing`
- **Thực hiện**: Chạy test khoanh vùng tác động, kiểm tra 3 kịch bản (**Happy Path**, **Edge Cases**, **Failure Cases**).

---

## 🔴 STEP 5: Final Certification & Sign-off
- **Execution role**: Main Orchestrator
- **Skills**: `code-review-checklist`, `docs-architect`, `requesting-code-review`
- **Thực hiện**:
  1. Kiểm định và trả lời 4 câu hỏi cốt lõi.
  2. Áp dụng quy tắc **Zero-Tolerance** (1 lỗi Critical/High $\rightarrow$ **REJECT**).
  3. Cập nhật artifact `walkthrough.md` với minh chứng thực nghiệm.
  4. Đưa ra kết luận **PASSED - Ready for Merge** hoặc **REJECTED** (kèm danh sách điểm cần sửa).
