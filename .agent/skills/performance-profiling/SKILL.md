---
name: performance-profiling
description: "Use when choosing profiling tools, creating measurements, analyzing traces, or validating performance improvements."
metadata:
  category: "infrastructure"
  version: "4.1.0-fractal"
  layer: "master-skill"
---

# Performance Profiling

> Measure, analyze, optimize - in that order.

## Runtime Tooling

No Lighthouse runner is bundled in this repository. Choose the target app's
existing profiling command or an explicitly approved external tool, record the
exact command and result, and never claim a performance measurement without
evidence.

Before measuring a backend after a merge/pull, confirm the running binaries and
dev servers are not older than `HEAD` (DLL mtime, Vite start time); rebuild via
the authorized build path and restart first. Split each slow request into DB
execution (`EXPLAIN ANALYZE`), network transfer and app-side rendering before
blaming code; a remote dev DB over VPN can dominate every number.
Then propose only the smallest local change that also helps production; do not
add infrastructure layers (background export jobs, rate limiters, custom
streaming writers, denormalized status) for a dev-network bottleneck.

---

## 1. Core Web Vitals

## 🧠 Knowledge Modules (Fractal Skills)

### 1. [Targets](./sub-skills/targets.md)
### 2. [When to Measure](./sub-skills/when-to-measure.md)
### 3. [The 4-Step Process](./sub-skills/the-4-step-process.md)
### 4. [Profiling Tool Selection](./sub-skills/profiling-tool-selection.md)
### 5. [What to Look For](./sub-skills/what-to-look-for.md)
### 6. [Optimization Actions](./sub-skills/optimization-actions.md)
### 7. [Performance Tab Analysis](./sub-skills/performance-tab-analysis.md)
### 8. [Memory Tab Analysis](./sub-skills/memory-tab-analysis.md)
### 9. [By Symptom](./sub-skills/by-symptom.md)
