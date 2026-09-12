---
name: plan
description: "Lập kế hoạch chiến lược theo chuẩn Senior Personnel. Use when creating an actionable, step-by-step implementation plan for complex tasks."
---

# /plan - Strategic Planning System

$ARGUMENTS

---

## 🟢 PHASE 1: Discovery & Terrain Analysis (Gatekeeper)

**Execution role**: `codebase discovery role`
**Mission**: Understand the current state before proposing changes.

- **Action**: Perform a recursive scan of the workspace.
- **Action**: Identify all relevant DNA (`GEMINI.md`) and Rules (`rules/`).
- **Critical Gate**: If the request is ambiguous, trigger the **Socratic Gate** and ask 3-5 clarifying questions.

## 🟡 PHASE 2: Strategic Implementation Plan (Primary Design)

**Execution role**: `planning role`
**Mission**: Create the initial blueprint for success — split one file per task, so an executing agent only ever opens the one file it's currently working on instead of paging back and forth through the whole plan.

- **Output folder**: `.agent/planning/{task-slug}/` (create it if missing).
- **File split**:
  1. `00-OVERVIEW.md` — the coordination hub. Contains: Goals, scope, dependency chains between tasks, the task index (ID, title, status, link to its file), and the review log from Phase 3. This is the only file read to get the big picture or to route work.
  2. `TASK-{NN}-{task-slug}.md` — one file per task, fully self-contained. Each file carries everything needed to execute that task without reopening other files: its goal, the specific dependencies/files it touches, its phase-by-phase steps, and its own verification plan (Automated + Manual).
- **Requirement**: Use GitHub-style alerts (IMPORTANT/WARNING) for risks, inline in the task file they belong to.
- **Requirement**: `00-OVERVIEW.md` MUST list every `TASK-*.md` file with a one-line description so nothing gets orphaned. Task files do not need to link back to each other — only to `00-OVERVIEW.md` if context is needed.
- **Protocol**:
  1. Define Clear Goals and the dependency map across tasks → `00-OVERVIEW.md`.
  2. Break the work into discrete tasks; for each one, write one `TASK-{NN}-{task-slug}.md` covering: its dependencies, its phase steps, and its verification plan.
  3. Register every task in the `00-OVERVIEW.md` index.

## 🟠 PHASE 3: Structured Review Loop (Stress-Testing)

**Execution role**: `planning role`
**Mission**: Stress-test the plan without assuming extra agent profiles exist.

- Review each affected task through three lenses:
  1. **Failure/YAGNI**: hidden assumptions, edge cases, rollback, and unnecessary scope.
  2. **System constraints**: performance, security, scalability, operations, and cost.
  3. **User impact**: cognitive load, flow clarity, compatibility, and error handling.
- Delegate an independent review only when the task is high-impact, the harness supports it, and delegation is authorized.
- Revise only affected `TASK-*.md` files and log accepted/rejected objections in `00-OVERVIEW.md`.

## 🔵 PHASE 4: Surgical Task Distribution

**Execution role**: `integration role`
**Mission**: Map the plan to specialized specialists.

- **Action**: In the task index inside `00-OVERVIEW.md`, assign each `TASK-*.md` its unique ID and owner (Backend, Frontend, etc.) — no separate tasks file, the index in `00-OVERVIEW.md` already is the assignment table.
- **Action**: Assign the "Heavy Lifters" (Backend, Frontend, etc.) per task.

## 🔴 PHASE 5: Plan Validation & Sign-off

**Execution role**: `verification role`
**Mission**: Ensure the plan is "Operational-Ready."

- **Verification**: Check if the plan matches `DNA_REF` compliance.
- **Review Check**: Confirm all three review lenses are addressed or explicitly acknowledged in the Review Log.
- **Reporting**: Report the exact folder path (`.agent/planning/{task-slug}/`) to the User, entry point `00-OVERVIEW.md`.

---

## Output Format

```markdown
[OK] Plan Created: .agent/planning/{task-slug}/
├── 00-OVERVIEW.md (start here: goals, dependency map, task index, review log)
├── TASK-01-{slug}.md (self-contained: deps, phases, verification)
├── TASK-02-{slug}.md
└── TASK-{NN}-{slug}.md

### Next Steps:

1. Review `00-OVERVIEW.md` for the big picture and task index.
2. Manually adjust individual `TASK-*.md` files if needed.
3. Run `/create` or `/orchestrate` to begin surgical execution — hand the executing agent only the one `TASK-*.md` it's working on, not the whole folder, to keep its context small.
```

---

## Key Principles:

- **No Code**: This workflow is strictly for strategy.
- **Naming Protocol**: Folder `.agent/planning/kebab-case-slug/`; `00-OVERVIEW.md` for coordination, `TASK-{NN}-{task-slug}.md` per task.
- **Context Discipline**: One file per task, fully self-contained. Never split a single task's concerns (deps/phases/verification) across multiple files — that just adds file-hopping. Never merge multiple tasks into one file either — that reloads unrelated context. `00-OVERVIEW.md` is index-only, not a place to duplicate task detail.
- **User-Centric**: Respect the user's OS and workspace constraints.
