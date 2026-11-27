---
name: cogain-form-rhf-zod
description: Implements Cogain React Hook Form and Zod forms with safe API hydration, empty-value normalization, watched-field effects, and backend validation parity. Use when changing frontend forms, schemas, zodResolver, reset, setValue, or nullable IDs.
metadata:
  version: 1.1.0
  layer: project-skill
---

# Cogain React Hook Form + Zod

Treat the form model and API model as different boundary types when nullability or UI control values differ.

## Data Boundary

- Hydration: map API data into form-safe values; do not pass nullable API arrays/IDs directly when the schema expects arrays or strings.
- Submission: convert UI `""` to `null`/`undefined` according to the API contract.
- Submit pending: every `await` before `mutateAsync` (file upload, lookup) runs inside the submit handler, so Save and Cancel must be disabled by `form.formState.isSubmitting` as well as `mutation.isPending`; otherwise double submit creates duplicate records.
- After any `await` inside submit, build the payload from `form.getValues()`, not from the `values` argument captured before the await.
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
- Tiêu đề form (SheetTitle/DialogTitle) dùng `FormTitle` shared, không viết tay ternary `mode === 'create'`.

## FieldArray Child Tables & Render Isolation

- Preserve `useFieldArray` keys (`field.id`): use `insert(index, item, { shouldFocus: false })` and `remove(indexOrIndices)` for row add, duplicate, calendar date toggle, or row/bulk deletion, and use `form.setValue(\`details.\${idx}.\${field}\`, value, { shouldDirty: true, shouldValidate: form.formState.isSubmitted })` for bulk field updates or default application. Restrict `replace()` to initial hydration or clearing all rows (`[]`), because `replace()` regenerates every `field.id`, unmounts all `<tr>` rows, wipes row selection, and replays entry animations.
- Configure child input tables with `ResizableWrapTable` (`isSubTable`, `headerVariant="sub-primary"`, `disableEntryAnimation`), `useFieldRowActions` (passing `useCallback`-stabilized handlers and a module-level `getRowId`, never inline arrows), and `useFirstErrorRowId` paired with `useFormState({ control, name: 'details' })` instead of reading root `form.formState`.
- Isolate `useWatch({ control, name: 'details' })` out of the root form component: move watched array calculations (tab badges, summary totals, conditional apply buttons, and calendar date mapping keyed by a primitive `dateKeysSignature`) into small module-level `React.memo` leaf components.
- Pass `dropdownQuery.isLoading` (not `isFetching`) to `Combobox` `loading` props for cached master-data dropdowns so background refetches never flicker spinners across every row, and warm static dropdown queries in the parent list route when practical.

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
- Validation status follows `.agent/rules/frontend-fastcheck.md`.
  **DO NOT RUN lint/build/tests unless the user explicitly requests the action.**
