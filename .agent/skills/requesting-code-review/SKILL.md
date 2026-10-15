---
name: requesting-code-review
description: Use before merging governed work or when an explicit independent review is requested.
metadata:
  version: "4.1.0-cogain"
---

# Cogain On-Demand Review & Governed Verification

Code review is opt-in and runs only when explicitly requested by the user.
Ordinary deliverables are coordinated directly by `main` using concise `allowed_paths`, `Reuse`, and `Acceptance` and verified from source evidence without a mandatory merge gate or automatic `reviewer` invocation.

When the user explicitly requests an independent code review, use the read-only `reviewer` role or inspect directly with [code-reviewer](../code-reviewer/SKILL.md) (risk and Cogain D1-D10 rubric) or [code-review](../code-review/SKILL.md) (fixed-point Standards/Spec diff review).

For governed work that requires independent acceptance verification, pass the Task Manifest, diff, validation commands/results, and
residual risks to the registered read-only `verifier`.

The verifier returns `pass`, `fail`, or `blocked` with evidence mapped to each
acceptance criterion. It must not edit the source. A `fail` returns to the owning
worker for a bounded retry; a `blocked` result identifies the missing authority or
input.

Never treat a reviewer persona name, a commit SHA, or an external tool as required
unless it exists in the current registry/harness.

Use [code-reviewer](../code-reviewer/SKILL.md) for risk/checklist knowledge and
[code-review](../code-review/SKILL.md) only for an explicitly requested fixed-point diff review.
Neither replaces the governed verifier contract above.
The [review briefing template](./code-reviewer.md) is optional input guidance, not
an agent registration, validation authorization, or automatic gate.
