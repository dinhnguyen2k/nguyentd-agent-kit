# Seam Approval and Test Quality

Adapted from `tdd/SKILL.md`, https://github.com/mattpocock/skills.
MIT License, Copyright (c) 2026 Matt Pocock.
No standalone license file exists in the source skill; preserve this source attribution.

A seam is the public boundary where callers observe behavior without reaching into internals.
Before test authorship, record the interface, acceptance criteria and approved seams.
An explicit user-approved specification or design can provide approval; ask the user only when the seam remains undecided.
Approval of a seam does not authorize executing tests.
When the interface itself is unresolved, consult `codebase-design` for module, interface, depth, seam, adapter, leverage and locality vocabulary rather than inventing a boundary.

Good tests read like a specification and survive internal refactors because they verify behavior through public interfaces.
Use domain vocabulary from `CONTEXT.md` when available and respect applicable ADRs.

## Avoid

- Implementation coupling: private-method tests, mocks of internal collaborators, incidental call counts/order or side-channel verification that bypasses the agreed interface.
  Interaction assertions can be appropriate when the interaction itself is the specified public boundary behavior, not an implementation accident.
- Tautological expectations: recomputing the expected answer with the implementation algorithm, deriving snapshots identically, or asserting a constant against itself.
  Use an independent specification, known-good literal or worked example.
- Horizontal slicing: writing all imagined tests before implementing all behavior.
  Each vertical slice is a tracer bullet informed by the previous cycle.

The upstream `tdd` entry excluded refactoring from its loop and deferred it to review.
The canonical owner retains its established RED-GREEN-REFACTOR procedure: behavior-preserving refactoring belongs after GREEN, with independent review where required and execution bounded by `AI_RULES.md`.
