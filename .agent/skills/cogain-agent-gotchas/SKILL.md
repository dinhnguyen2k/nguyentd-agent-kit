---
name: cogain-agent-gotchas
description: Prevents recurring Cogain-specific mistakes learned from .planning/errors/ERRORS.md. Use during debugging, review, or implementation near AutoFilter, API integration, EF reflection/child relations, React Hook Form, Radix controls, and shared tables.
metadata:
  version: 1.0.0
  layer: project-skill
---

# Cogain Agent Gotchas

Read the relevant category before editing code near a previously failed boundary. The source incident log is `.planning/errors/ERRORS.md`.

## API and AutoFilter

- Verify a backend endpoint exists before adding a frontend query. Search controller routes and existing service clients.
- Parameters not declared on an AutoFilter request model can be silently ignored. Put supported dynamic predicates in the `Filters` expression unless the endpoint explicitly binds a property.

## API-to-Form Hydration

- Nullable backend IDs and arrays must be mapped into schema-safe form values.
- `value ?? []` does not normalize a non-null string into an array. Use an explicit type guard/normalizer.

## EF Core Reflection and Children

- Reflection-based navigation discovery must exclude `[NotMapped]` properties.
- Removing a child from a tracked required-FK navigation can sever the association and try to set the FK to null. Use aggregate-owned soft-delete sync via [skill:cogain-child-sync].
- Non-null DB snapshot columns require complete resolver/mapping coverage and a business-valid fallback; `?? string.Empty` only prevents null and does not prove semantic validity.

## React Feedback Loops

- Effects that call parent state or `form.setValue` must be idempotent.
- Do not depend on unstable inline callbacks or freshly created table instances when the effect calls parent `setState`.
- Radix Select may emit the current empty value during mount; suppress identical emissions and use `undefined` when empty is not an option.
- Radix Checkbox inside a form dispatches a bubbling native click through its hidden input. Do not add a wrapping click-toggle; use a label.

## Turn an Incident Into a Guardrail

When the same failure family recurs:

1. Add a regression test or deterministic architecture/static check where possible.
2. Update the owning project skill with the smallest decision-changing rule.
3. Keep the incident details in `ERRORS.md`; do not copy the narrative into every prompt.

## Verification

- The root cause, not only the symptom, is covered.
- A test or static check fails on the old behavior when practical.
- New guidance has one clear owner and is linked rather than duplicated.
