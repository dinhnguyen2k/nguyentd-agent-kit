---
name: frontend-design
description: "Thiết kế Frontend theo quy trình orchestration: concept -> UI spec -> build -> audit."
---

# /frontend-design - Orchestrated Frontend Design System

$ARGUMENTS

---

## 🟢 PHASE 1: Context & Design Discovery
**Execution role**: `frontend-specialist`
**Mission**: Chốt bối cảnh trước khi vẽ UI.
- Xác định user flow, business constraints, và responsive priorities.
- Rà conventions/runtime của repo (`React + Vite + TanStack + Tailwind + Radix`).
- Chốt visual direction và risk list (a11y/perf/maintainability).

## 🟡 PHASE 2: Design Blueprint (UI Spec)
**Execution role**: `frontend-specialist` + `integration role`
**Mission**: Tạo blueprint có thể triển khai.
- Output: `UI-SPEC-<slug>.md` (hoặc cập nhật spec liên quan nếu đã tồn tại).
- Bắt buộc nêu:
  1. Layout structure + information hierarchy
  2. Component map (shared vs app-local)
  3. State/data flow (query/mutation/form state)
  4. Accessibility & performance checkpoints
- **Gate**: Yêu cầu user xác nhận blueprint trước khi sang implementation.

## 🔵 PHASE 3: Implementation (Frontend Build)
**Execution role**: `frontend-specialist`
**Mission**: Build UI theo blueprint với thay đổi nhỏ và an toàn.
- Ưu tiên tái sử dụng pattern/component đang có trong repo.
- Không introduce framework pattern lệch stack (Next-only patterns, RSC, v.v.).
- **DO NOT RUN lint, typecheck, route generation, build, browser checks, or tests
  automatically. ON-DEMAND ONLY:** the user must explicitly request the validation
  action by name. Otherwise hand off `Validation: not run - not requested`.

## 🔴 PHASE 4: Quality Audit & Handoff
**Execution role**: `verification role`
**Mission**: Đóng quality gate trước khi bàn giao.
- Audit 4 trục:
  1. Visual consistency (design tokens, spacing, typography)
  2. Accessibility (focus, labels, keyboard flow, color contrast)
  3. Responsiveness (mobile/tablet/desktop)
  4. Performance (render hotspots, unnecessary re-renders)
- Output: `walkthrough.md` gồm:
  - Mục tiêu đã đạt
  - File changed
  - Trạng thái validation và command evidence nếu đã chạy
  - Residual risks

## 🟣 PHASE 5: Orchestrate Mode (Optional)
**Execution role**: `integration role`
**Trigger**: Khi user yêu cầu `orchestrate`, `swarm`, hoặc cần parallel execution.
- Chia việc theo nhóm độc lập để tránh đụng file:
  1. `frontend-specialist`: UI implementation
  2. `verification role`: a11y/perf/review
  3. `testing role` (hoặc workflow `/test`): regression checks
- Update `walkthrough.md`. A workflow, orchestration tier, or verification role cannot
  grant frontend validation permission on the user's behalf.
- Nếu task vượt frontend scope (đụng API/contract), chuyển sang `/orchestrate` tổng với `backend-specialist`.

---

## Output Format

```markdown
[OK] Frontend Design Completed

### Artifacts
- UI Spec: {path}
- Walkthrough: {path}

### Validation
- Status: {not run - not requested/pass/fail}
- Evidence: {command/result nếu đã chạy}

### Residual Risks
- {if any}
```

---

## Failure Gates (Block Completion)

- Không có `UI-SPEC-<slug>.md` (hoặc equivalent update).
- Không có `walkthrough.md`.
- Claim `verified` nhưng không có command evidence.
- Thiết kế đi lệch conventions runtime của repo.
