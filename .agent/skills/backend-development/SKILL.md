---
name: backend-development
description: Routes implementation, debugging, review, and design work for PHP backend and database. Use for *.php, admin/**, PDO, MySQL, session, forms, uploads, email, and backend procedures.
metadata:
  category: engineering
  version: 2.0.0
  layer: project-router
---

# Backend Development

Use this as a router for PHP backend and database tasks. `AI_RULES.md`, `.agent/rules/backend.md`, source code, and project-native skills own detailed behavior.

## Route the Task

| Evidence in the request or touched code                        | Primary owner                       |
| -------------------------------------------------------------- | ----------------------------------- |
| PHP procedural pages, forms, sessions, uploads, PHPMailer      | [skill:php-development]             |
| PDO queries, MySQL schema, indexes, migrations, db.php         | [skill:mysql]                       |
| Reusable backend patterns, security invariants, error handling | [skill:agent-backend-patterns]      |
| API endpoint shape, JSON responses, status codes               | [skill:api-patterns]                |
| Unit or integration test strategy                              | [skill:testing-patterns]            |
| Code quality, refactoring, procedural architecture             | [skill:clean-code]                  |
| Database query plan tuning, query optimization                 | [skill:database-optimizer]          |
| PostgreSQL schema/query (opt-in ONLY if dependencies require)  | [skill:postgresql]                  |

Reuse this router and skills already in context; read only missing skills or needed sections not yet loaded.
Every matching registry trigger requires its owning skill before the related decision, whether the trigger appears in the request or is discovered while inspecting relevant source/callers.
Matching a trigger does not authorize a worker to reopen design or expand scope.

Load the smallest set that satisfies those mandatory triggers, not a fixed one-skill limit. Generic skills are fallback knowledge; project-native skills (`php-development`, `mysql`, `agent-backend-patterns`) and source code own application behavior.

## Workflow

1. Determine analysis, proposal, or implementation mode from the user request.
2. Main discovery/design: trace affected page script/database query/include, nearest pattern/test according to risk; settle invariants, reuse, and recipe under `.agent/workflows/plan.md`.
3. Worker implementation: confirm current contract against source at the affected boundary, not a full rediscovery or reconstruction.
   Missing design, source mismatch, failed reuse or a needed scope change returns Main `file:line`, expected/actual and the decision.
4. Apply the settled recipe within scope; choose equivalent local details, never a guessed fallback.
   Read affected source/pattern/callers as risk requires; Main's conclusion cannot override conflicting source.
5. Report regression/verification needs to Main under `AI_RULES.md` §9.
6. No automatic build/format/tests; execution needs named user authorization and an authorized role.

## Non-Negotiable Boundaries

- Do not duplicate rules from `AI_RULES.md` in a new skill.
- Do not invent database columns, session keys, request parameters, or framework abstractions; resolve them from source.
- Do not use string interpolation or concatenation in SQL queries; always use PDO prepared statements.
- Do not assume modern framework features (Laravel Eloquent, Blade, Symfony DI, .NET/C#) in this plain PHP codebase.
- Do not load every backend skill “for safety”; excess context makes routing less reliable.

## Verification

- The final implementation follows the local script structure and database pattern.
- Validation status is explicit. Use `Validation: not run - not requested` when implementation was requested without validation, or `Validation: not run - runtime not installed` if `php` CLI is absent.
- Security invariants (SQL injection, XSS, CSRF, session validation, file upload validation) were assessed.
- Final response follows the report format in `AI_RULES.md`.
