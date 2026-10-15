# 3. Generate Plan

Use `.agent/workflows/plan.md` as the canonical protocol; this is presentation guidance, not another contract template.

- State the settled approach in one sentence; add a reason/source citation only when it protects a meaningful decision.
- List only the atomic, ordered actions actually needed, naming files/symbols and the concrete change; do not force 6-10 tasks.
- Include scope exclusions, dependencies, failure behavior and acceptance only where needed to execute safely; do not repeat canonical metadata in prose.
- Omit empty sections, generic discovery steps already completed by Main, discarded alternatives, review PASS and questions that are already settled.
- Include validation/rollout only within named user authorization; do not insert testing, app startup, generation or commit steps by default.
- For an implementation handoff, present instructions rather than inviting the worker to explore, compare designs or optimize beyond scope.