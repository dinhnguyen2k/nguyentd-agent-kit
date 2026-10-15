---
name: create
description: "Tạo tính năng mới hoặc dự án từ A-Z với bộ máy chuyên nghiệp. Use when building a new feature, project, or module end-to-end."
---

# /create - Full-Cycle Product Creation

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

## 🟢 PHASE 1: Requirements Discovery

**Execution role**: `product discovery role` & `codebase discovery role`
**Mission**: Define the "What" and "Why."

- **Action**: Analyze User Intent and map to project scale.
- **Verification**: Ensure no conflict with existing system architecture.

## 🟡 PHASE 2: Strategic Architecture (PLAN)

**Execution role**: `planning role`
**Mission**: Define the "How."

- **Workflow Link**: Invokes `/plan` automatically.
- **Artifact**: Áp dụng Artifact & Permission Contract; `/plan` không tự cấp quyền persist.
- **Mandatory**: User MUST approve the plan before Phase 3 begins.

## 🔵 PHASE 3: Surgical Execution

**Execution role**: `integration role`
**Mission**: Direct the "Heavy Lifters."

- **Choreography**:
  1. `backend-specialist` owns schema/API/business logic and loads database skills when required.
  2. `frontend-specialist` owns UI/data-boundary work.
  3. Current agent integrates contracts and requested documentation; `test-author` owns test changes.

## 🔴 PHASE 4: Professional Audit & Handoff

**Execution role**: `verification role` & `testing role`
**Mission**: Defend the Quality Gate.

- **Verification**: Review source evidence for testing/security; chỉ chạy checks đã được user cấp quyền.
- **Handoff**: Trả changed paths, source evidence, validation status và rủi ro còn lại; link contract/rollback hiện có, không tạo bản tóm tắt trùng lặp.

---

## Rules of Engagement:

- **No Placeholders**: Every generated asset must be functional.
- **Security-First**: No hardcoded keys, ever.
- **Product Fit**: Frontend work follows the existing product and uses `frontend-design` only for explicit visual design scope.

---

## Examples:

- `/create e-commerce dashboard with analytics`
- `/create inventory management CLI in Rust`
- `/create portfolio site with video backgrounds`
