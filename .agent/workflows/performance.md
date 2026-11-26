---
name: performance
description: Muốn web chạy mượt? Tối ưu tốc độ và hiệu năng theo chuẩn Performance Expert.
---

# /performance - Speed & Efficiency Optimization

$ARGUMENTS

## Benchmark một thao tác E2E

Với yêu cầu đo thao tác thật từ trình duyệt tới dữ liệu hiển thị hoặc file tải xong, dùng [quy trình benchmark E2E](../skills/performance/references/e2e-benchmark.md) và giao agent phụ trách thay đổi làm đầu mối đo trong phạm vi được cấp quyền.

## Permission & Output Contract

- Audit/analyze is read-only: return findings with source citations and available measurements in chat; do not edit files or persist artifacts without explicit write permission.
- Optimization requires explicit implementation permission; measurement and validation commands require separate authorization naming the action.
- Reuse existing evidence first; never infer permission to start an app, run Lighthouse, profiling, build, lint, tests, or other checks from this workflow.
- For authorized implementation, a single slice uses a compact contract/checkpoint only when handoff/resume needs it; multi-slice work reuses `.agent/planning/{task-slug}/00-OVERVIEW.md` and canonical `TASK-*.md` contracts from `/plan`.
- Scope and acceptance live only in TASK contracts; governed work derives its manifest from canonical TASK metadata/parser, not a second narrative plan.
- Handoff packets reference the contract snapshot identity and supersession; only the coordinator updates overview lifecycle state, and gate/CI evidence remains immutable.
- Do not create duplicate PLAN, implementation_plan, walkthrough, or handoff narratives.
- Preserve requested measurement evidence, flame graphs, and unique runbooks/rollback instructions at their existing owner and link them; persist research only when explicitly requested in `.agent/artifacts`, never new `reports/artifacts`.

---

## 🟢 PHASE 1: Baseline Profiling
**Execution role**: `performance-optimizer` & `codebase discovery role`
**Mission**: Measure the "Starting Line."
- **Action**: Inspect existing Lighthouse evidence (Mobile & Desktop); run an audit only when explicitly authorized.
- **Action**: Record available Core Web Vitals (LCP, FID, CLS), including measurement context and missing evidence.
- **Tool**: Check for "Network Waterfalls" and large asset sizes.

## 🟡 PHASE 2: Bottleneck Identification
**Execution role**: `performance-optimizer`
**Mission**: Find the "Anchor."
- **Checklist**:
  - Unoptimized images?
  - Unused JS/CSS?
  - N+1 Database queries?
  - Long hydration times?

## 🔵 PHASE 3: Surgical Optimization
**Execution role**: `frontend-specialist` & `backend-specialist`
**Mission**: Cut the weight.
- **Action**: With implementation permission, apply Lazy Loading, Code Splitting, or Image Compression only to evidenced bottlenecks.
- **Backend**: Consider caching (Redis/CDN) and DB indices only where measurements justify the change and existing architecture gates permit it.

## 🔴 PHASE 4: Delta Verification & Reporting
**Execution role**: `verification role`
**Mission**: Prove the gain.
- **Action**: Compare available before/after measurements under matching conditions; run Lighthouse or profiling only when explicitly authorized.
- **Output**: Return requested measurement deltas and available flame graph evidence with citations, conditions, and remaining uncertainty; no mandatory `walkthrough.md`.
- **Validation**: Report only checks actually run; otherwise state `Validation: not run - not requested`.

---

## Performance Targets:
- **Lighthouse**: Target Score > 95 in all categories.
- **LCP**: < 2.5s.
- **Bundle Size**: Minimize main-thread JS execution.

---

## Examples:
- `/performance audit home page speed`
- `/performance optimize images and fonts`
- `/performance reduce bundle size`
