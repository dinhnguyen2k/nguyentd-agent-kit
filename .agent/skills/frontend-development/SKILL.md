---
name: frontend-development
description: Routes implementation, debugging, review, and design work for the Cogain React 19 and Vite frontend. Use for frontend/**, routes, queries, forms, shared components, state, styling, and frontend tests.
metadata:
  category: engineering
  version: 1.0.0
  layer: project-router
---

# Frontend Development

Use this as a router, not a React textbook. `AI_RULES.md`, `.agent/rules/frontend.md`, current app code, and project-native skills own detailed behavior.

## Route the Task

| Evidence in request or code                              | Primary owner                                                            |
| -------------------------------------------------------- | ------------------------------------------------------------------------ |
| TanStack Query keys/mutations/invalidation               | [skill:cogain-query-cache]                                               |
| React Hook Form, Zod, reset/hydration, nullable IDs      | [skill:cogain-form-rhf-zod]                                              |
| Recurring API, EF-to-UI, Radix, effect, or table failure | [skill:cogain-agent-gotchas]                                             |
| Triển khai, sửa hoặc chẩn đoán search/filter danh sách | [Search và filter](references/search-and-filter.md), chỉ đọc khi task chạm luồng này |
| Component composition/effects                            | [skill:react-patterns]                                                   |
| Reusable TypeScript generics                             | [skill:typescript-pro]                                                   |
| Tailwind tokens/shared primitives                        | [skill:tailwind-patterns] and, only when shared, [skill:core-components] |
| Explicit design/visual exploration                       | [skill:frontend-design]                                                  |
| Browser behavior/E2E                                     | [skill:playwright-skill] or [skill:webapp-testing]                       |

Reuse this router and skills already in context; read only missing skills or needed sections not yet loaded.
Every matching registry trigger requires its owning skill before the related decision, whether the trigger appears in the request or is discovered while inspecting relevant source/consumers.
Matching a trigger does not authorize a worker to reopen design or expand scope.

Load the smallest set that satisfies those mandatory triggers. Context reuse never replaces inspection of affected source, nearest patterns/tests, or shared consumers according to risk. Do not load visual-design, browser, accessibility, and performance guidance for every routine code change.

Không nạp reference search/filter khi task chỉ sửa layout, màu sắc, form, mutation hoặc bảng không thay đổi hành vi tìm kiếm/lọc.

## UI reference (on demand)

Rule text excerpted from evondevKit `ui-ux` lives in `references/ui-ux-evondev/` (source and license: its `README.md`).
Read only the file matching the UI surface you are changing; never load the folder.

| Changing | Read |
| --- | --- |
| New screen or section, scope, state mapping | `references/ui-ux-evondev/rules-core.md` |
| Card/grid/table nesting, dividers | `references/ui-ux-evondev/rules-layout.md` |
| Text, numbers, truncation, codes, dates, copy | `references/ui-ux-evondev/rules-text.md` |
| Hover, row actions, loading/empty/error, modal dismiss, labels, password, focus after delete | `references/ui-ux-evondev/rules-interaction.md` |
| Narrow screens, wide tables, raw `<button>`, `ring-*`, transitions, `@theme`/`:root` vars | `references/ui-ux-evondev/responsive-tailwind.md` |
| Page header, breadcrumb placement, 404/403/500 | `references/ui-ux-evondev/layout-page.md` |
| Multi-field or multi-step form, field errors, hints, char limits | `references/ui-ux-evondev/layout-form.md` |
| Confirm dialog, modal, sheet, dropdown, filter popover | `references/ui-ux-evondev/layout-overlay.md` |
| That component | `references/ui-ux-evondev/components/<button\|breadcrumb\|description-list\|inline-edit\|empty-state\|file-upload\|quantity-input\|charts>.md` |
| Self-check before handoff of UI work | `references/ui-ux-evondev/review-taxonomy.md` |

Cogain overrides win over every file above:

- Keep `frontend/shared/ui` as-is: `Button` default `variant: 'default'`, solid `destructive`, `transition-all`, `whitespace-nowrap`; `Card` keeps `shadow-sm`; `Badge` keeps its variants; primitives keep `focus-visible:ring-[3px]` (ignore `I13`/`I14`).
- Colors, radius, heights, density come from Figma tokens and `frontend/erp/src/index.css` (`h-9`, `h-8` compact, `rounded-md`); source examples (`rose-*`, `emerald-*`, `bg-surface`, `bg-item-hover`, `--border-strong`, `shadow-modal`, `rounded-xl`, `h-10`/`h-11`) are illustrations, not tokens to add.
- Page background stays `--background`; existing "Nhập..." placeholders stay; empty cells show `-`; sort arrows keep `custom-table.tsx` direction; overlays portal via `getPortalContainer()`.
- Ignore probe, screenshot, wireframe, mock-data, and empty-handler instructions; verify by reading code only.
- Cross-references to rules not present in the folder (`M30`, `N8`, `budgets.md`, ...) are not loaded; do not infer them.

## Workflow

1. Determine analysis, proposal, or implementation mode.
2. Main discovery/design: identify the package from `package.json`; trace affected route/search -> hook/query -> service -> API/shared primitive and nearest pattern/test according to risk.
   Settle interaction/data/cache semantics, reuse and consumer impact before dispatch under `.agent/workflows/plan.md`.
3. Worker implementation: confirm the current contract against source at the affected boundary, not a full rediscovery or parent-TASK/history reconstruction.
   Missing design, source mismatch, failed reuse or a needed scope change returns Main `file:line`, expected/actual and the decision; do not choose another endpoint/DTO/default, cache/interaction semantics or abstraction.
4. Apply the settled recipe within scope; choose equivalent local details, never a guessed fallback.
   Read affected source/pattern/tests/consumers as risk requires; Main's conclusion cannot override conflicting source.
5. Report regression/coverage needs to Main under `AI_RULES.md` §9 and test-enforcement, including money/permission/stock/legal invariants; specialists neither write tests nor spawn `test-author`.
6. No automatic lint/typecheck/generation/build/browser checks/tests; execution needs named user authorization and an authorized role, not a coverage duty.

## Non-Negotiable Boundaries

- Do not introduce Next.js-only behavior into the Vite apps.
- Do not call fetch/axios directly from routes/components when a service/hook layer owns the request.
- Do not store server state in Zustand to bypass TanStack Query.
- Do not invent endpoints or duplicate shared types across apps.
- Do not impose a visual style unrelated to the product/task.
- Do not load every frontend skill “for safety”; excess context makes routing less reliable.

## Verification

- The changed app follows route -> hook/query -> service boundaries.
- Form/API and enum/nullability contracts remain aligned.
- Shared changes were checked against multiple consumers.
- Validation status is explicit. Use `not run - not requested` when implementation
  was requested without validation. A skill or workflow cannot grant validation
  permission on the user's behalf.
