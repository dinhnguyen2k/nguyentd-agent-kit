# Critical Review Protocol

> Load when reviewing a design, a PR, or your own plan before writing code.
> Goal: find what **breaks**, not what's ugly.

---

## 1. Five Questions Before Any Non-Trivial Change

| # | Question | Red flag answer |
|---|----------|-----------------|
| 1 | What breaks for a real user if we ship nothing? | "Nothing, but it'd be cleaner" → don't build it |
| 2 | What's the invariant this must never violate? | Can't state one → requirement is undefined, ask |
| 3 | What happens when two of these run at once? | "That won't happen" → it will |
| 4 | If this is wrong in prod, how do we find out? | "Someone reports it" → add a log/metric/guard |
| 5 | How do we undo it? | "We don't" → this is an L3 decision, slow down |

---

## 2. Failure-Mode Sweep

Walk the change against each. Anything you can't dismiss with a reason is a finding.

| Class | Probe |
|-------|-------|
| **Concurrency** | Read-modify-write without lock/version? Double submit? Race on status transition? |
| **Partial failure** | Multi-step write without transaction — what state is left behind? |
| **Idempotency** | Retry / duplicate webhook / double-click → duplicate rows? |
| **Boundary data** | null, empty list, 0, negative, timezone/DST, string overflow, unicode |
| **Scale** | N+1 query? Unbounded IN clause? Full load into memory? Behaviour at 100x rows |
| **Trust boundary** | Client-supplied id/status/price used without server-side authorization check |
| **Time** | Server vs client clock, "now" captured twice, date-only vs datetime comparison |
| **Silent loss** | `catch { }`, ignored return value, swallowed validation error |

---

## 3. Steel-Man Before You Object

Before rejecting an approach, state the strongest case **for** it in one sentence.
If you can't, you don't understand it well enough to critique it.

```
Their case: they inlined the validation to avoid a round-trip on the hot path.
My concern: the same rule now exists in 2 places and only 1 got the new status.
```

This turns "wrong" into "here's the constraint you're trading against".

---

## 4. Disagreement Resolution

| Situation | Response |
|-----------|----------|
| I have evidence, they have preference | Present the failure scenario, once |
| Both are preferences | Follow existing codebase convention. Done. |
| They reaffirm after my evidence | Their decision. Implement it fully, note the assumption, move on. |
| I was wrong | Say so in one line, correct, continue. No post-mortem, no apology loop. |

---

## 5. Review Anti-Patterns

| ❌ Don't | Why |
|---------|-----|
| Rewrite their design as "feedback" | That's a different PR, not a review |
| List 15 nits | The one real bug gets lost |
| "Best practice says..." | Cite the failure, not the authority |
| Demand tests for everything | Demand tests for the logic that can be silently wrong |
| Block on style | Style is NOTE, forever |
| Invent requirements to justify complexity | That's speculative generality wearing a suit |

---

## 6. Output Shape

```
BLOCK (must fix)
  <file:line> — claim / break / fix

FLAG (fix now or record why not)
  <file:line> — claim / break / fix

NOTE (max 3)
  - ...

Assumptions I made: ...
Not covered by this review: ...
```

Empty BLOCK section is a valid, good result — say so plainly instead of manufacturing findings.
