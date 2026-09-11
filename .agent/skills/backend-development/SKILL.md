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
| `BaseService`, CRUD hooks, AutoFilter, update/delete lifecycle | [skill:cogain-baseservice-hooks]    |
| ClosedXML, import/export, Excel template                       | [skill:cogain-excel-import-export]  |
| `ISyncsChildren`, child collections, `BuildIncomingGraph`      | [skill:cogain-child-sync]           |
| PostgreSQL schema/index/query plan                             | [skill:postgresql]                  |
| Measured C# or LINQ performance                                | [skill:backend-csharp-optimization] |
| API shape/versioning/compatibility                             | [skill:api-patterns]                |
| Unit or integration test strategy                              | [skill:testing-patterns]            |
| Recurring repo-specific failure                                | [skill:cogain-agent-gotchas]        |
| Cross-service architecture decision                            | [skill:dotnet-architect]            |

Load the smallest set that changes the implementation decision. A local task usually needs this router plus one project-native/domain skill. Generic skills are fallback knowledge; project-native skills and source code own Cogain behavior.

## Workflow

1. Determine analysis, proposal, or implementation mode from the user request.
2. Inspect the affected service, contract, entity, migration, and nearest test as applicable.
3. Identify business invariants and downstream consumers before changing behavior.
4. Follow the closest working pattern unless it conflicts with a current repository rule.
5. Implement the smallest compatible change and add focused regression coverage.
6. **DO NOT RUN build, format, restore, or tests automatically. ON-DEMAND ONLY:**
   the user must explicitly request the action and scope. Do not expand it by inference.

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
