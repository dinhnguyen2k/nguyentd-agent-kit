---
name: create
description: "Tạo tính năng mới hoặc dự án từ A-Z với bộ máy chuyên nghiệp. Use when building a new feature, project, or module end-to-end."
---

# /create - Full-Cycle Product Creation

$ARGUMENTS

---

## 🟢 PHASE 1: Requirements Discovery

**Execution role**: `product discovery role` & `codebase discovery role`
**Mission**: Define the "What" and "Why."

- **Action**: Analyze User Intent and map to project scale.
- **Verification**: Ensure no conflict with existing system architecture.

## 🟡 PHASE 2: Strategic Architecture (PLAN)

**Execution role**: `planning role`
**Mission**: Define the "How."

- **Workflow Link**: Invokes `/plan` automatically.
- **Artifact**: Create `docs/PLAN-{slug}.md`.
- **Mandatory**: User MUST approve the plan before Phase 3 begins.

## 🔵 PHASE 3: Surgical Execution

**Execution role**: `integration role`
**Mission**: Direct the "Heavy Lifters."

- **Choreography**:
  1. `backend-specialist` owns schema/API/business logic and loads database skills when required.
  2. `frontend-specialist` owns UI/data-boundary work.
  3. Current agent integrates contracts, tests, and documentation.

## 🔴 PHASE 4: Professional Audit & Handoff

**Execution role**: `verification role` & `testing role`
**Mission**: Defend the Quality Gate.

- **Verification**: Run `/test` and `/security` workflows.
- **Artifact**: Create the final `walkthrough.md` with proof of work.

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
