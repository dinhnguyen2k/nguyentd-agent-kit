---
name: enhance
description: "Sửa màu, thêm nút, sửa logic nhỏ. Use when making small enhancements, minor UI tweaks, or localized adjustments."
---

# /enhance - Incremental Feature Upgrade

$ARGUMENTS

---

## Artifact & Permission Contract

- Read-only/proposal: trả lời kèm source citations, không ghi artifact nếu chưa có quyền ghi riêng.
- Implementation một slice: không cần artifact mặc định; chỉ lưu compact contract/checkpoint khi cần handoff hoặc resume.
- Giữ lane fast/standard của `/orchestrate`; lane viết code vẫn cần canonical TASK theo gate, không tự nâng mọi việc thành governed.
- Implementation nhiều slice: dùng `.agent/planning/{task-slug}/00-OVERVIEW.md` và `TASK-{NN}-{task-slug}.md` theo `/plan`.
- Scope/acceptance chỉ sửa tại canonical TASK; overview chỉ giữ index/dependencies/lifecycle, chỉ coordinator cập nhật state.
- Lane governed: manifest được derive từ block `task-contract` bằng `.agent/scripts/task-contract.mjs`, không viết tay hoặc sao chép acceptance sang overview.
- Packet handoff trỏ `contract_ref` và snapshot identity (`contract_version`, `contract_hash`, `lifecycle_hash`); kiểm tra lifecycle/supersession trước khi resume.
- Không tạo `docs/PLAN-*`, `task.md`, `implementation_plan.md`, `walkthrough.md` hoặc handoff chỉ để lặp lại contract.
- Product docs/API/runbook/rollback độc nhất vẫn thuộc owner/path hiện có khi user yêu cầu; link từ TASK, không nhân bản.
- Research chỉ persist khi user yêu cầu tại `.agent/artifacts`, không tạo output mới tại reports/artifacts.
- Quyền edit không cấp quyền validation/generation; chỉ chạy hành động user nêu rõ, giữ merge gate theo `AI_RULES.md`.
- Không sửa tay generated output hoặc `CHANGELOG.md`, không commit/push khi chưa được yêu cầu.

## 🟢 PHASE 1: Impact Discovery
**Execution role**: `codebase discovery role` & `frontend-specialist`
**Mission**: Map the "Blast Radius."
- **Action**: Identify all components and services affected by the change.
- **Action**: Check for breaking CSS or Logic changes.

## 🟡 PHASE 2: Enhancement Plan
**Execution role**: `planning role`
**Mission**: Strategic addition.
- **Action**: Lập scope/reuse/acceptance trong câu trả lời hoặc canonical contract theo Artifact & Permission Contract, không tạo mini-plan trùng lặp.
- **Note**: For major UI overhauls, invoke `/brainstorm` first.

## 🔵 PHASE 3: Surgical Implementation
**Execution role**: `frontend-specialist` or `backend-specialist`
**Mission**: Add the "WOW" factor.
- **Action**: Implement changes using `ui-ux-pro-max` standards.
- **Standard**: Follow [clean-code](file:///skills/clean-code/SKILL.md) and [tailwind-patterns](file:///skills/tailwind-patterns/SKILL.md).

## 🔴 PHASE 4: Professional Verification
**Execution role**: `verification role` & `testing role`
**Mission**: Verify the delta.
- **Action**: Inspect source evidence for the UI delta; `/preview` chỉ chạy khi user cấp quyền khởi động app/browser interaction.
- **Action**: Regression tests chỉ chạy khi user yêu cầu; thay đổi test thuộc `test-author`.
- **Handoff**: Trả changed paths, source evidence, validation status và rủi ro còn lại; link contract/rollback hiện có, không tạo bản tóm tắt trùng lặp.

---

## Enhancement Principles:
- **Non-Destructive**: Don't break existing features to add new ones.
- **Consistent UI**: New elements must match the existing Design System.
- **Atomic Changes**: Giữ thay đổi theo scope logic; chỉ commit khi user yêu cầu rõ.

---

## Examples:
- `/enhance add dark mode toggle`
- `/enhance integrate Google Auth`
- `/enhance make the landing page sections fade in`
