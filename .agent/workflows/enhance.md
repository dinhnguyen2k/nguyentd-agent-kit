---
name: enhance
description: Muốn sửa màu, thêm nút, sửa logic nhỏ? Vào đây.
---

# /enhance - Incremental Feature Upgrade

$ARGUMENTS

---

## 🟢 PHASE 1: Impact Discovery
**Execution role**: `codebase discovery role` & `frontend-specialist`
**Mission**: Map the "Blast Radius."
- **Action**: Identify all components and services affected by the change.
- **Action**: Check for breaking CSS or Logic changes.

## 🟡 PHASE 2: Enhancement Plan
**Execution role**: `planning role`
**Mission**: Strategic addition.
- **Action**: Create a mini-plan in the `task.md`.
- **Note**: For major UI overhauls, invoke `/brainstorm` first.

## 🔵 PHASE 3: Surgical Implementation
**Execution role**: `frontend-specialist` or `backend-specialist`
**Mission**: Add the "WOW" factor.
- **Action**: Implement changes using `ui-ux-pro-max` standards.
- **Standard**: Follow [clean-code](file:///skills/clean-code/SKILL.md) and [tailwind-patterns](file:///skills/tailwind-patterns/SKILL.md).

## 🔴 PHASE 4: Professional Verification
**Execution role**: `verification role` & `testing role`
**Mission**: Verify the delta.
- **Action**: Run `/preview` to playtest the UI.
- **Action**: Verify that existing tests still pass (Regression Check).
- **Handoff**: Document the change in `walkthrough.md`.

---

## Enhancement Principles:
- **Non-Destructive**: Don't break existing features to add new ones.
- **Consistent UI**: New elements must match the existing Design System.
- **Atomic Commits**: Group project changes in logical git commits.

---

## Examples:
- `/enhance add dark mode toggle`
- `/enhance integrate Google Auth`
- `/enhance make the landing page sections fade in`
