---
name: cogain-react-state-effects
description: Enforces Cogain React 19.1 + Vite SWC state ownership and eliminates unnecessary useEffect across TanStack Router, TanStack Query, React Hook Form, and Radix UI. Use when adding or changing component state, derived values, useEffect, ref callbacks, URL filters, or form/query synchronization in frontend/**.
metadata:
  version: 1.0.0
  layer: project-skill
---

# Cogain React State Ownership & Effects

Target stack: `react@^19.1.1`, `@vitejs/plugin-react-swc` (React Compiler is NOT enabled), `@tanstack/react-router@^1.132`, `@tanstack/react-query@^5.90`, `react-hook-form@^7.65`, and Radix UI.

## 1. State Ownership Gate (Check Before Opening `useEffect`)

Assign every value to one canonical owner before reaching for `useState` or `useEffect`:

1. **Render derivation** - synchronous calculation from current props, local UI state, `query.data`, or `useWatch`.
2. **Interaction event handler** - state updates, dependent field resets, async lookups, or mutations triggered by a specific user action.
3. **TanStack Router URL search (`Route.useSearch()`)** - shareable search text, filters, pagination, sorting, and active tabs.
4. **TanStack Query cache (`query.data` / `select`)** - server state, dropdown lookups, and cached response projections (`[skill:cogain-query-cache]`).
5. **React Hook Form state (`useWatch` / field `onChange`)** - form input drafts, dirty tracking, and schema validation (`[skill:cogain-form-rhf-zod]`).

`useEffect` is valid **only** when synchronizing a mounted component with an external system outside React.

## 2. Six Forbidden `useEffect` Patterns & Cogain Replacements

| Scenario | Forbidden `useEffect` Pattern | Cogain Standard Replacement |
| --- | --- | --- |
| **1. Derived values / filtered options / totals** | Copying `query.data`, props, or watched inputs into `useState` via `useEffect` | Compute directly in render (read form values via `useWatch({ control, name })`); wrap in `useMemo` only when computation is heavy or reference stability is needed for `columns`, `options`, or callbacks passed to shared tables and Radix controls under Vite SWC |
| **2. Dependent form fields** (warehouse / province / source doc -> clear child fields or load lookup) | Chaining `form.watch` + `useEffect` + `form.setValue` | Handle inside the source control's event handler (`onValueChange`, `field.onChange`, or `RefDocumentSelector`'s `requestSourceContextChange`), and guard after every `await` with `if (form.getValues(field) !== expected) return;` |
| **3. URL search, filter, pagination, sorting** | Mirroring URL params into `useState` and syncing two-way with `useEffect` | Keep `Route.useSearch()` (validated with `.optional()` schema fields) as the single source of truth and update via `navigate({ search: (prev) => ... })` or `useTableChange` |
| **4. Post-fetch transform & post-mutation actions** | Watching `query.data` to reshape records or watching `mutation.isSuccess` to toast/close | Read `query.data` directly in render or project with `useQuery({ select })`; run toast, dialog close, navigation, and cache invalidation in `useMutation({ onSuccess })` |
| **5. Child-to-parent change notification** | Watching internal child state in `useEffect` to emit `onChange(localValue)` | Invoke `onChange(next)` directly in the event handler that changes the value, guarded with `if (next === current) return;` to block duplicate emissions |
| **6. Edit form hydration** | Calling unguarded `form.reset(query.data)` in `useEffect` on every `query.data` reference change | **Priority 1** - mount `<FormBody key={recordId ?? 'create'} defaultValues={mapped} />` only after API data is ready (no `useEffect`); **Priority 2** (when `Sheet`/`Dialog` stays mounted or shares `useRefDocSelector`) - pass `useForm({ values: mapped, resetOptions: { keepDirtyValues: true } })` or gate `form.reset(mapped)` with `hydratedKeyRef` keyed by `${open}:${mode}:${recordId ?? 'create'}` so background refetches never wipe dirty user input |

```tsx
// Dependent field lookup inside event handler with post-await race guard
const handleWarehouseChange = async (warehouseId: string | undefined) => {
  form.setValue('warehouseId', warehouseId, { shouldDirty: true, shouldValidate: true });
  form.setValue('binLocationId', undefined, { shouldDirty: true });
  if (!warehouseId) return;
  const defaults = await fetchWarehouseDefaults(warehouseId);
  if (form.getValues('warehouseId') !== warehouseId) return;
  form.setValue('binLocationId', defaults.defaultBinId ?? undefined);
};

// React 19 ref cleanup wrapped in useCallback (required on Vite SWC without React Compiler)
const observeNodeRef = useCallback((node: HTMLElement | null) => {
  if (!node) return;
  const observer = new ResizeObserver(() => onMeasure(node.clientWidth));
  observer.observe(node);
  return () => observer.disconnect();
}, [onMeasure]);
```

## 3. Valid `useEffect` Cases & React 19.1 + SWC Safety Gates

Valid external-system targets:
- `window` or `document` event listeners (`keydown`, `resize`, `visibilitychange`)
- Timers (`setTimeout`, `setInterval`)
- SignalR or WebSocket subscriptions
- Imperative DOM APIs and third-party non-React editor/chart SDKs

Mandatory safety gates when an external effect or ref subscription is genuinely required:

1. **React 19.1 Version Gate**: **NEVER use `useEffectEvent`** while Cogain pins `react@^19.1.1` (`useEffectEvent` is only stable starting in `react >= 19.2.0`).
2. **SWC Ref Cleanup Gate**: When using a React 19 callback `ref` with cleanup (`ref={(node) => { ...; return cleanup; }}`) for Radix Portals, `ResizeObserver`, or DOM observers, wrap it in `useCallback` or a static module function because Vite SWC has no React Compiler (inline arrow refs run cleanup and re-attach on every re-render).
3. **Cleanup, Idempotency & Anti-Bypass**:
   - Return a symmetric cleanup function from every `useEffect`, survive `<StrictMode>` double invocation, and compare current state or `form.getValues(field)` before writing.
   - **NEVER bypass the `useEffect` ban** by calling `setState`, `form.setValue`, or `navigate` directly in the render body, deferring writes in `queueMicrotask` or `setTimeout(..., 0)`, or adding `eslint-disable` for `react-hooks/exhaustive-deps`.

## 4. Verification

- Every state value maps to one owner in Section 1 with no duplicated server, URL, or form state.
- Dependent async handlers re-check `form.getValues(field)` after `await`, and edit hydration preserves unsaved user edits across background TanStack Query refetches without widening types to `any`.
- Report regression test needs to Main without editing test files directly unless authorized as `test-author` (`AI_RULES.md` §6, §9).
- Do not run lint, build, typecheck, or tests unless the user explicitly requests the action; record `Validation: not run - not requested` (`AI_RULES.md` §2, `.agent/rules/frontend-fastcheck.md`).
