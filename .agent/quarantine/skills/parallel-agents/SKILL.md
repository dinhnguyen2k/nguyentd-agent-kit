---
name: parallel-agents
description: Use when the user explicitly authorizes parallel research, review, or implementation with independent and disjoint task scopes.
metadata:
  version: "4.1.0-cogain"
---

# Cogain Parallel Coordination

Parallelism is an optimization, not a default. It is valid only when work has
disjoint ownership, independent acceptance criteria, bounded stop conditions, and
an available runtime profile in `.agent/contracts/agent-registry.json`.

- Research/review lanes return concise structured findings to the coordinator.
- Write lanes use separate worktrees or otherwise isolated scopes.
- Backend/frontend contract changes are normally sequenced, not parallel.
- Governed work uses Task Manifests and the read-only `verifier` gate.
- Local work stays single-agent and self-validates.

Do not load legacy example subskills that name unregistered agents or external
harness commands.
