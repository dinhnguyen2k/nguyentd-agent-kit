---
name: backend-csharp-optimization
description: Optimizes C# LINQ, collections, allocations, and compiler-safety patterns for Cogain .NET 8. Use when profiling or reviewing a concrete C# performance issue; not for every routine backend edit.
metadata:
  category: engineering
  version: 3.0.0
  layer: project-skill
---

# C# Optimization

Optimize only after identifying a concrete hot path, allocation pattern, complexity problem, or compiler-safety issue. Preserve clarity and query-provider behavior.

## Route Selectively

- Read [sub-skills/linq-collections.md](sub-skills/linq-collections.md) for repeated lookups, deduplication, large `Contains`, materialization, or nested LINQ.
- Read [sub-skills/clean-compiler-safety.md](sub-skills/clean-compiler-safety.md) for nullable flow, guards, pattern matching, or assignment safety.
- Use [skill:postgresql] or [skill:database-optimizer] for SQL translation, indexes, and query plans; those concerns are out of scope here.
- Use [skill:cogain-baseservice-hooks] for BaseService lifecycle decisions; do not turn a local optimization into shared orchestration changes.

## Procedure

1. Identify the workload and current complexity/allocation/query behavior.
2. Verify whether the code executes in memory or remains an `IQueryable`; an in-memory optimization can change SQL translation.
3. Apply the smallest change with measurable or complexity-based benefit.
4. Preserve ordering, duplicate, null, comparer, and deferred-execution semantics.
5. **DO NOT RUN tests/build or benchmarks automatically.** When the user explicitly
   requests measurement or validation, run only the authorized scope.

The optional scanner reports candidate patterns; it does not prove a bug:

```bash
python3 .agent/skills/backend-csharp-optimization/scripts/scan-linq.py
```

## Boundaries

- Do not require this skill for every C# edit.
- Do not replace readable linear work with clever code without evidence.
- Do not claim `HashSet` is faster when construction dominates or order/duplicates matter.
- Do not apply new C#/.NET-version features unless the target project supports them.
- Do not run network-based knowledge sync scripts as part of routine implementation.

## Verification

- Behavior and query translation are unchanged unless an intentional contract change is documented.
- Complexity/allocation improvement is explained with evidence proportional to the claim.
- Target build/tests pass or the gap is stated.
