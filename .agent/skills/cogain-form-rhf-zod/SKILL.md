---
name: cogain-form-rhf-zod
description: Implements Cogain React Hook Form and Zod forms with safe API hydration, empty-value normalization, watched-field effects, and backend validation parity. Use when changing frontend forms, schemas, zodResolver, reset, setValue, or nullable IDs.
metadata:
  version: 1.0.0
  layer: project-skill
---

# Cogain React Hook Form + Zod

Treat the form model and API model as different boundary types when nullability or UI control values differ.

## Data Boundary

- Hydration: map API data into form-safe values; do not pass nullable API arrays/IDs directly when the schema expects arrays or strings.
- Submission: convert UI `""` to `null`/`undefined` according to the API contract.
- Validation: backend owns business rules. Zod mirrors stable rules for UX but must not become the only enforcement layer.
- Enums: preserve numeric values shared with the backend; do not submit raw magic numbers when a domain enum exists.

## Effects and Watched Fields

- Before `setValue` inside an effect, compare `form.getValues(field)` with the intended value.
- Hoist watched values; do not call `form.watch()` inside dependency arrays or memo callbacks.
- Do not use changing `key` props to force form subtrees to remount when reset/hydration can express the transition.
- Keep reset/hydration idempotent so tab switches and async refetches cannot create update loops.

## Controls

- Normalize multi-select/tree values to arrays before calling `.map`.
- Do not pass `""` as a controlled Radix Select value unless an explicit empty option exists; prefer `undefined` for no selection.
- Ignore identical value emissions before forwarding `onChange`.
- Do not nest buttons or wrap Radix Checkbox/Switch in a parent click-toggle. Use `Label htmlFor` and the control's own handler.

## Procedure

1. Inspect the Zod schema, inferred form type, API type, default values, reset mapping, and submit mapping together.
2. Make null/empty/array normalization explicit at hydration and submission boundaries.
3. Trace every watched-field effect for a feedback cycle.
4. Add a regression test for the failure mode when the form is shared or the bug was runtime-only.

## Verification

- Create and edit hydration produce schema-valid form values.
- Submission matches backend nullability and enum contracts.
- Repeated reset/effect execution is idempotent.
- Keyboard/label behavior remains valid for interactive controls.
- Target app lint/build and relevant tests pass.
