---
name: frontend-development
description: Routes implementation, debugging, review, and design work for frontend styling, UI scripts, and layout templates. Use for css/**, js/**, images/**, and layout/** templates.
metadata:
  category: engineering
  version: 2.0.0
  layer: project-router
---

# Frontend Development

Use this as a router for frontend layout, styling, and client-side scripting. `AI_RULES.md`, `.agent/rules/frontend.md`, application templates, and project-native skills own detailed behavior.

## Route the Task

| Evidence in request or code                              | Primary owner                                                            |
| -------------------------------------------------------- | ------------------------------------------------------------------------ |
| Layout templates (`layout/**`), vanilla JS, DOM events   | [skill:agent-frontend-patterns]                                          |
| Server-rendered data integration, form submission        | [skill:php-development]                                                  |
| Explicit design/visual exploration from scratch          | [skill:frontend-design]                                                  |
| UI/UX standards, typography, responsive rules, review    | [skill:ui-ux-pro-max]                                                    |
| Browser behavior/E2E testing                             | [skill:playwright-skill] or [skill:webapp-testing]                       |
| React component composition (opt-in ONLY if required)    | [skill:react-patterns]                                                   |
| Tailwind utility styling (opt-in ONLY if required)       | [skill:tailwind-patterns]                                                |
| Reusable TypeScript generics (opt-in ONLY if required)   | [skill:typescript-pro]                                                   |

Reuse this router and skills already in context; read only missing skills or needed sections not yet loaded.
Every matching registry trigger requires its owning skill before the related decision, whether the trigger appears in the request or is discovered while inspecting relevant source/consumers.
Matching a trigger does not authorize a worker to reopen design or expand scope.

Load the smallest set that satisfies those mandatory triggers. Context reuse never replaces inspection of affected source, nearest templates, or shared styles according to risk.
Note: React, Tailwind, and TypeScript are opt-in only if actual project dependencies require them; the default stack is plain CSS, vanilla JS, and server-rendered PHP templates.

## UI reference (on demand)

Rule text excerpted from evondevKit `ui-ux` lives in `references/ui-ux-evondev/` (source and license: its `README.md`).
Read only the file matching the UI surface you are changing; never load the folder.

| Changing | Read |
| --- | --- |
| New screen or section, scope, layout structure | `references/ui-ux-evondev/rules-core.md` |
| Card/grid/table nesting, dividers | `references/ui-ux-evondev/rules-layout.md` |
| Text, numbers, truncation, dates, labels | `references/ui-ux-evondev/rules-text.md` |
| Hover, row actions, loading/empty/error states, modal dismiss | `references/ui-ux-evondev/rules-interaction.md` |
| Responsive design, mobile breakpoints, flexible layout | `references/ui-ux-evondev/responsive-tailwind.md` |
| Page header, navigation, breadcrumbs, error pages | `references/ui-ux-evondev/layout-page.md` |
| Multi-field form, field validation errors, input hints | `references/ui-ux-evondev/layout-form.md` |
| Confirm dialog, modal overlay, dropdowns | `references/ui-ux-evondev/layout-overlay.md` |
| Specific component pattern | `references/ui-ux-evondev/components/<button\|breadcrumb\|description-list\|inline-edit\|empty-state\|file-upload\|quantity-input\|charts>.md` |
| Self-check before handoff of UI work | `references/ui-ux-evondev/review-taxonomy.md` |

### Application UI Guidelines

- Keep existing styling conventions in `css/**`; do not rewrite global stylesheets without authorization.
- Form inputs: use consistent heights and padding matching existing styles.
- Responsive design: ensure layouts look clean on mobile (375px+), tablet (768px+), and desktop (1024px+).
- Escape all server-rendered content in PHP templates with `htmlspecialchars()`.
- Interactive elements: ensure every clickable element has a visible `:hover` and `:focus` state.

## Workflow

1. Determine analysis, proposal, or implementation mode.
2. Main discovery/design: identify touched templates (`layout/**`, `*.php`) and assets (`css/**`, `js/**`). Trace component boundaries and visual hierarchy before dispatch.
3. Worker implementation: respect existing HTML markup and CSS classes; avoid introducing unnecessary third-party libraries.
4. Verify responsive layout, DOM behavior, and visual hierarchy.
5. Verification status is explicit: report `Validation: not run - not requested` when implementation was requested without automated validation.
