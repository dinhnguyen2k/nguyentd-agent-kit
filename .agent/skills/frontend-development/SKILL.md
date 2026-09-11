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
| Component composition/effects                            | [skill:react-patterns]                                                   |
| Reusable TypeScript generics                             | [skill:typescript-pro]                                                   |
| Tailwind tokens/shared primitives                        | [skill:tailwind-patterns] and, only when shared, [skill:core-components] |
| Explicit design/visual exploration                       | [skill:frontend-design]                                                  |
| Browser behavior/E2E                                     | [skill:playwright-skill] or [skill:webapp-testing]                       |

Load the smallest set that changes the decision. Do not load visual-design, browser, accessibility, and performance guidance for every routine code change.

## Workflow

1. Determine analysis, proposal, or implementation mode.
2. Identify the target package from its `package.json` name and inspect a local analogous route/hook/component.
3. Trace the complete boundary affected: route/search params, hook/query, service client, backend contract, and shared primitive as applicable.
4. Implement the smallest change that preserves current patterns and shared consumers.
5. Add focused regression coverage for changed behavior or a recurring runtime failure.
6. Report implementation status. **DO NOT RUN lint, typecheck, route generation,
   build, browser checks, or tests automatically. ON-DEMAND ONLY:** the user must
   explicitly request the validation action by name.

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
