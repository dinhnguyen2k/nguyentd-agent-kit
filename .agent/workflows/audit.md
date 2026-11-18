---
name: audit
description: Audit phân tầng ngữ cảnh (Progressive Disclosure) với 5 bước phân cấp rủi ro & kiểm định 4 câu hỏi cốt lõi.
---

# /audit - Progressive Disclosure Sign-off Workflow

$ARGUMENTS

---

## Quyền thực thi và artifact ownership

- Audit mặc định chỉ đọc: trả findings, citations và kết luận trong câu trả lời; không ghi file nếu user chưa cấp riêng quyền ghi.
- Risk level không cấp quyền build/lint/test/scan hoặc sửa code; chỉ chạy hành động và scope user yêu cầu rõ, tuân thủ `AI_RULES.md` và `.agent/rules/test-enforcement.md`.
- Khi có quyền lưu và cần handoff/resume, single-slice dùng compact contract/checkpoint; multi-slice dùng `.agent/planning/{task-slug}/00-OVERVIEW.md` và `TASK-*.md`.
- Scope/acceptance chỉ chỉnh ở canonical TASK có metadata `task-contract`; reuse `.agent/scripts/task-contract.mjs`, governed manifest derive từ metadata, không sửa tay.
- Chỉ coordinator cập nhật overview lifecycle/state, không sao chép acceptance; packet mang contract snapshot identity và supersession.
- Giữ findings, 4 câu trả lời, mức rủi ro, command/kết quả thật và unique audit evidence user yêu cầu; chỉ persist khi user cấp riêng quyền ghi. Không tạo `implementation_plan.md`, `walkthrough.md` hay report chỉ lặp scope/acceptance.
- CI proof và lịch sử kiểm tra (nếu có) là bằng chứng bất biến; audit chỉ dẫn nguồn thực tế, không tự suy diễn kết quả build/CI.

## 🎯 4 CÂU HỎI BẮT BUỘC TRẢ LỜI TẠI STEP 5:
1. **Scope & Requirement**: Code có đúng và đủ theo yêu cầu ban đầu không?
2. **Standards & Security**: Code có tuân thủ Architecture, Conventions (`AI_RULES.md`) & Bảo mật không?
3. **Robustness & Edge Cases**: Code có hoạt động đúng ở Happy Path + Edge Cases + Failure Cases không?
4. **Certification**: Code có đạt chất lượng 100% (Zero-Tolerance) để merge/ship không?

---

## 🟢 STEP 1: Target Identification (Phân loại Domain)
- **Execution role**: Main Orchestrator
- **Skills**: `git-advanced-workflows`, `concise-planning`
- **Thực hiện**: Chạy `git status` và `git diff --name-only` phân loại phạm vi kiểm tra (mặc định kiểm tra trực tiếp chỉ đọc, chỉ uỷ quyền subagent khi user yêu cầu hoặc phạm vi lớn cần tách):
  - **FE Only** (`frontend/**`) $\rightarrow$ Phạm vi `frontend-specialist`.
  - **BE Only** (`backend/**`) $\rightarrow$ Phạm vi `backend-specialist`.
  - **BE + FE (Dual-Domain)** $\rightarrow$ Phạm vi kết hợp `backend-specialist` và `frontend-specialist`.

---

## 🟡 STEP 2: Risk-Based Triage (Phân cấp Rủi ro Audit)
- **Execution role**: `backend-specialist` / `frontend-specialist`
- **Phân cấp & Skills**:
  - 🟢 **Low Risk** (Chỉnh sửa UI nhỏ, typo, thêm log, comment, config đơn giản):
    - *Mode*: Lightweight Audit
    - *Skills*: `clean-code`, `lint-and-validate`
    - *Kiểm tra*: Scope check nhanh; đọc build/lint evidence hiện có hoặc chạy đúng action/scope được cấp.
  - 🟡 **Medium Risk** (Thêm feature mới nội bộ, sửa service logic, schema DB không breaking):
    - *Mode*: Specialist Audit
    - *Skills*: `code-reviewer`, `agent-backend-patterns` / `agent-frontend-patterns`
    - *Kiểm tra*: Clean Architecture, Security inspection cơ bản, đọc unit test evidence vùng bị tác động; scan/test execution cần quyền riêng.
  - 🔴 **High Risk** (Core auth, payment, data migration, breaking API, security patch, shared modules):
    - *Mode*: Full Audit
    - *Skills*: `vulnerability-scanner`, `architecture-patterns`
    - *Kiểm tra*: Deep security inspection và evidence regression/edge/failure cases; vulnerability scan, full regression và stress test chỉ chạy khi được cấp đúng scope.

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
**Execution role**: `verifier` (đọc/chạy evidence được phép), `test-author` (viết test nếu được yêu cầu riêng)
- **Skills**:
  - *Backend Testing*: `tdd-workflow`, `unit-testing-test-generate`
  - *Frontend & E2E Testing*: `e2e-testing-patterns`, `playwright-skill`, `webapp-testing`
- **Thực hiện**: Đối chiếu test/evidence khoanh vùng tác động cho 3 kịch bản (**Happy Path**, **Edge Cases**, **Failure Cases**).
- Chỉ chạy test khi user yêu cầu rõ; audit không cấp quyền specialist sửa test hoặc tự chạy validation.

---

## 🔴 STEP 5: Final Certification & Sign-off
- **Execution role**: Main Orchestrator
- **Skills**: `code-reviewer`, `docs-architect`, `requesting-code-review`
- **Thực hiện**:
  1. Kiểm định và trả lời 4 câu hỏi cốt lõi (đối chiếu checklist canonical tại `.agent/skills/code-reviewer/references/checklist/`).
  2. Áp dụng quy tắc **Zero-Tolerance** (1 lỗi Critical/High $\rightarrow$ **REJECT**).
  3. Trả findings với citations và minh chứng thực nghiệm thực sự có; chỉ lưu unique audit evidence ở path được user cấp, không viết report lặp scope/acceptance.
  4. Đưa ra kết luận audit **PASSED** hoặc **REJECTED** (kèm danh sách điểm cần sửa và giới hạn kiểm chứng); thiếu evidence bắt buộc thì ghi chưa đủ cơ sở sign-off.
  5. Dẫn kết quả CI/validation thực tế nếu có; chưa chạy validation thì ghi `Validation: not run - not requested`.
