---
name: subagent-driven-development
description: Use when the user explicitly authorizes parallel implementation and the governed task has independent, disjoint write scopes.
metadata:
  version: "4.1.0-cogain"
---

# Cogain Parallel Implementation

Use only after `/orchestrate` classifies work as `governed`. This is not the
default for a local task.

1. Create one Task Manifest per worker with disjoint `allowed_paths`.
2. Give each worker only its manifest, target files, nearest tests, and triggered
   context. Do not pass an unbounded conversation history.
3. Each worker returns a diff, validation evidence, and residual risks; workers do
   not commit, merge, deploy, or repair another worker's scope.
4. Sequence work when paths or contracts overlap.
5. Send the integrated result to the read-only `verifier`. A failed verification
   returns to the owner for one bounded retry.

Only dispatch a worker when it has independent work, a clear completion condition,
and a real time or quality benefit. Use the runtime registry; never assume an
external subagent type exists.
