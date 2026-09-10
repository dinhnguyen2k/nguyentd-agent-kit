---
name: status
description: "Xem Dashboard báo cáo trạng thái dự án chuyên nghiệp. Use when checking project status, summarizing recent tasks, or reporting progress."
---

# /status - Executive Project Dashboard

$ARGUMENTS

---

## 🟢 PHASE 1: Data Aggregation
**Execution role**: `product-owner` & `codebase discovery role`
**Mission**: Gather the "Pulse" of the project.
- **Action**: Read `task.md`, `walkthrough.md`, and `ERRORS.md`.
- **Action**: Check git history for recent velocity.

## 🟡 PHASE 2: Logic & Health Assessment
**Execution role**: `product-owner`
**Mission**: Analyze the "Vitals."
- **Checks**:
  - Are milestones being hit?
  - Is technical debt (ERRORS.md) increasing?
  - Is the plan still aligned with the goal?

## 🔵 PHASE 3: Dashboard Synthesis
**Execution role**: `product-owner`
**Mission**: Create a visual overview.
- **Action**: Generate a Markdown-friendly dashboard with progress bars and status badges.

## 🔴 PHASE 4: Professional Reporting
**Execution role**: `integration role`
**Mission**: Deliver the "Executive Summary."
- **Artifact**: A concise, professional message to the User summarizing current state and next immediate steps.

---

## Status Indicators:
- 🟢 **Healthy**: On track, no blockers.
- 🟡 **Warning**: Minor delays or increasing errors.
- 🔴 **Blocked**: Critical dependencies or major bugs.

---

## Examples:
- `/status`
- `/status focus on infrastructure`
- `/status show recent errors`
