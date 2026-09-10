---
name: database-design
description: 'Use when designing relational schema, indexes, normalization boundaries, migrations, or ORM mapping decisions.'
metadata:
  category: 'database'
  version: '4.1.0-fractal'
  layer: 'master-skill'
---

# Database Design

> **Learn to THINK, not copy SQL patterns.**

## 🎯 Selective Reading Rule

**Read ONLY files relevant to the request!** Check the content map, find what you need.

| File                    | Description                               | When to Read       |
| ----------------------- | ----------------------------------------- | ------------------ |
| `database-selection.md` | PostgreSQL-first choices and alternatives | Choosing database  |
| `orm-selection.md`      | EF Core-first choices and alternatives    | Choosing ORM       |
| `schema-design.md`      | Normalization, PKs, relationships         | Designing schema   |
| `indexing.md`           | Index types, composite indexes            | Performance tuning |
| `optimization.md`       | N+1, EXPLAIN ANALYZE                      | Query optimization |
| `migrations.md`         | Safe migrations, serverless DBs           | Schema changes     |

---

## ⚠️ Core Principle

- For Cogain backend, PostgreSQL and EF Core are the default unless a task explicitly targets a different system
- Choose database/ORM based on context for greenfield or non-Cogain work
- Do not introduce a new database or ORM into Cogain without an explicit architecture decision

---

## Decision Checklist

Before designing schema:

- [ ] Confirmed whether this is Cogain PostgreSQL/EF Core work or a greenfield/non-Cogain decision?
- [ ] Chosen database for THIS context?
- [ ] Considered deployment environment?
- [ ] Planned index strategy?
- [ ] Defined relationship types?

---

## Hard DoD for Every DB Change (Mandatory)

Any schema/query/index change is incomplete unless all checks below are satisfied:

1. Access pattern impact is explicit

- Identify affected queries that use filter/join/sort/paging on changed schema.
- Cover at least list/search/detail/export-report/background-job paths when relevant.

2. Indexes are mapped to query paths

- Explain which index serves which filter/join/sort.
- Prefer composite indexes when query shape requires them.

3. Foreign keys are indexed by default

- Every new FK must have an index, unless a documented reason says otherwise.

4. Hot query plans are reasonable on large tables

- Avoid avoidable `Seq Scan` / costly `Nested Loop` when index or query rewrite can fix it.

5. Migration safety is explicit

- Provide rollback or remediation plan.
- Document lock risk and safe deployment strategy for large changes.

6. PostgreSQL large index creation is safe

- Use `CREATE INDEX CONCURRENTLY` when appropriate.

7. Evidence is mandatory

- Provide before/after evidence for at least one hot query or one representative primary access-pattern query.
- Evidence must include `EXPLAIN ANALYZE` (or equivalent), timing, rows scanned, and index usage.

## Representative Query Requirement (Mandatory)

Not every engineer can identify "hot query" consistently. PR must list 1-3 representative queries:

- `query list` (screen/API list with filters + paging)
- `query detail` (single record/detail view)
- `query export/report` or aggregate query
- `query background job` (batch/reconciliation/sync), if affected

## OLTP vs Report Index Strategy (Mandatory)

- OLTP queries usually need selective filters, small pages, low-latency reads.
- Report/analytics queries may scan wide ranges and aggregate heavily; index alone may not be enough.
- Do not force all report queries into OLTP-style indexing; choose strategy by workload.

## Reviewer Checklist (Mandatory)

- [ ] What schema changed?
- [ ] Which queries are affected?
- [ ] Which new FKs were added?
- [ ] Which indexes were added/changed and why?
- [ ] Is there before/after plan evidence?
- [ ] Is migration lock risk documented?
- [ ] What is rollback/remediation plan?

---

## Anti-Patterns

❌ Default to PostgreSQL for simple apps (SQLite may suffice)
❌ Skip indexing
❌ Use SELECT \* in production
❌ Store JSON when structured data is better
❌ Ignore N+1 queries
❌ Ship DB changes without representative queries and plan evidence
