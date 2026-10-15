---
name: tdd-workflow
description: "Use when writing a test first, making it pass minimally, and refactoring while preserving behavior."
metadata:
  category: "development"
  version: "4.1.0-fractal"
  layer: "master-skill"
  source: "Includes knowledge from https://github.com/mattpocock/skills (MIT License, Copyright (c) 2026 Matt Pocock), tdd-workflow and tdd-master-workflow."
---

# TDD Workflow

One behavior slice at a time: RED → GREEN → REFACTOR.
Test strategy belongs to `testing-patterns`; this skill owns the implementation procedure.

## Authority and ownership

`AI_RULES.md` and repository rules take precedence over this procedure.
Editing permission is not execution permission: run tests, coverage, scripts or other validation only when the user explicitly authorizes that action and scope.
Never infer authorization from a phase, checklist or helper.
`test-author` owns actual test files; production writers implement the agreed public contract and do not edit tests.
Do not commit or push unless explicitly requested.

## Before the cycle

Read the requirement, affected flow, nearest tests and existing patterns.
Read `CONTEXT.md` when present and applicable ADRs to align vocabulary and behavior.
Agree the observable public seam and acceptance criteria using [seam approval and test quality](./references/seams-and-quality.md).
Reuse an already approved seam rather than requesting redundant approval.
Undefined behavior or an unresolved contract needs a decision, not a guessed test.

## The single RED-GREEN-REFACTOR procedure

1. **RED:** `test-author` writes the smallest test demonstrating one specified behavior at the agreed seam.
   Expected results come from the specification or an independent worked example.
   When test execution is authorized, confirm failure is caused by missing behavior, not syntax, setup or an unrelated failure.
   Without execution permission, report RED as unobserved, not confirmed.
2. **GREEN:** the production writer implements only the behavior required by that test and contract.
   Preserve validation, authorization, data integrity and existing architecture; minimal does not mean unsafe or speculative.
   Run only the authorized test scope, if any, and report only observed results.
3. **REFACTOR:** improve naming, duplication, structure and complexity without changing the contract.
   Keep test changes with `test-author` and use the permitted validation scope to assess regressions.
   If execution is not authorized, state that preservation of green status is not verified.
4. Repeat with the next vertical behavior slice, not all imagined tests followed by all implementation.

No blanket coverage percentage, test-duration threshold or default external-mock mandate applies.
Use repository/specification requirements and `testing-patterns` for those decisions.
A test conflicting with the specification is `test-spec-conflict`, not authority to change business behavior.

## Knowledge and references

- [What to write](./sub-skills/what-to-write.md)
- [RED rules](./sub-skills/red-phase-rules.md)
- [Minimum code](./sub-skills/minimum-code.md)
- [GREEN rules](./sub-skills/green-phase-rules.md)
- [What to improve](./sub-skills/what-to-improve.md)
- [REFACTOR rules and AAA](./sub-skills/refactor-rules.md)
- [Role handoff](./sub-skills/multi-agent-pattern.md)
- [Seam approval and test quality](./references/seams-and-quality.md)
- [Behavior test examples](./references/tests.md)
- [Boundary mocking guidance](./references/mocking.md)
- [Test naming and AAA](./references/unit_test_naming_convention.md)
- [Legacy helper semantics](./references/helper-semantics.md)
