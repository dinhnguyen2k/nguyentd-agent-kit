---
name: backend-development
description: Routes implementation, debugging, review, and design work for Cogain .NET 8 microservices. Use for backend/**, APIs, services, EF Core, PostgreSQL, gRPC, MassTransit, authorization, transactions, and backend tests.
metadata:
  category: engineering
  version: 2.0.0
  layer: project-router
---

# Backend Development

Use this as a router, not a backend textbook. `AI_RULES.md`, `.agent/rules/backend.md`, source code, and the project-native skills own detailed behavior.

## Route the Task

| Evidence in the request or touched code                        | Primary owner                       |
| -------------------------------------------------------------- | ----------------------------------- |
| CRUD chứng từ, bước HR xác nhận, báo cáo theo kỳ lương         | [skill:cogain-screen-archetypes]    |
| `BaseService`, CRUD hooks, AutoFilter, update/delete lifecycle | [skill:cogain-baseservice-hooks]    |
| ClosedXML, import/export, Excel template                       | [skill:cogain-excel-import-export]  |
| `AggregateShape`, child collections, `BuildIncomingGraph`      | [skill:cogain-child-sync]           |
| PostgreSQL schema/index/query plan                             | [skill:postgresql]                  |
| Measured C# or LINQ performance                                | [skill:backend-csharp-optimization] |
| API shape/versioning/compatibility                             | [skill:api-patterns]                |
| Unit or integration test strategy                              | [skill:testing-patterns]            |
| Recurring repo-specific failure                                | [skill:cogain-agent-gotchas]        |
| Cross-service architecture decision                            | [skill:dotnet-architect]            |

Reuse this router and skills already in context; read only missing skills or needed sections not yet loaded.
Every matching registry trigger requires its owning skill before the related decision, whether the trigger appears in the request or is discovered while inspecting relevant source/callers.
Matching a trigger does not authorize a worker to reopen design or expand scope.

Load the smallest set that satisfies those mandatory triggers, not a fixed one-skill limit. Context reuse never replaces inspection of affected source, nearest patterns/tests, or downstream consumers according to risk. Generic skills are fallback knowledge; project-native skills and source code own Cogain behavior.

## Workflow

1. Determine analysis, proposal, or implementation mode from the user request.
2. Main discovery/design: trace affected service/contract/entity/migration, nearest pattern/test and downstream consumers according to risk; settle invariants, reuse and the recipe under `.agent/workflows/plan.md`.
3. Worker implementation: confirm the current contract against source at the affected boundary, not a full rediscovery or parent-TASK/history reconstruction. On Antigravity (`agy`), when Main runs on a heavy planner model or dispatches parallel slices, Main may invoke `swarm` (`action: "add"`, `model: "gemini-4-hydrogen-high"`, referencing `.agents/agents/backend-specialist.md`) for fast execution.
   Missing design, source mismatch, failed reuse or a needed scope change returns Main `file:line`, expected/actual and the decision; do not choose another API/default/transaction/retry/compensation boundary or abstraction.
4. Apply the settled recipe within scope; choose equivalent local details, never a guessed fallback.
   Read affected source/pattern/tests/callers as risk requires; Main's conclusion cannot override conflicting source.
5. Report regression/coverage needs to Main under `AI_RULES.md` §9 and test-enforcement, including money/permission/stock/legal invariants; specialists neither write tests nor spawn `test-author`.
6. No automatic build/format/restore/tests; execution needs named user authorization and an authorized role, not a coverage duty.

## Non-Negotiable Boundaries

- Do not duplicate rules from `AI_RULES.md` in a new skill.
- Do not invent endpoints, contracts, hook names, package APIs, or test projects; resolve them from source.
- Do not assume local rollback reverses a remote write.
- Do not add a new abstraction without a concrete current need.
- Do not load every backend skill “for safety”; excess context makes routing less reliable.

## Verification

- The final implementation follows the current local layer and contract pattern.
- Validation status is explicit. Use `not run - not requested` when implementation
  was requested without validation.
- Public contract, permission, persistence, and cross-service effects were assessed.
- Final response follows the report format in `AI_RULES.md`.
