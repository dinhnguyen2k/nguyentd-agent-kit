---
name: database-migrations-migration-observability
description: 'Use when adding observability, monitoring, rollback signals, or CDC-related visibility for database migrations.'
allowed-tools: Read Write Edit Bash WebFetch
metadata:
  version: 4.1.0-fractal
  tags: database, cdc, debezium, kafka, prometheus, grafana, monitoring
---

# PostgreSQL Migration Observability

Migration observability guidance for Cogain PostgreSQL and EF Core changes. Use this as a companion to `database-migrations-sql-migrations`, not as a generic CDC platform template.

## Use this skill when

- A PostgreSQL/EF migration needs rollout visibility, rollback signals, data drift checks, or post-deploy verification
- A backfill or long-running schema change needs metrics, logs, or operational checkpoints
- CDC tooling is already approved and needs migration-specific observability

## Do not use this skill when

- The task only needs schema design; use `database-design` or `postgresql`
- The task only needs migration sequencing; use `database-migrations-sql-migrations`
- The proposal depends on MongoDB, Supabase, or a CDC stack Cogain has not adopted

## Instructions

1. Identify the migration blast radius: tables, services, backfills, write paths, and rollback boundaries.
2. Define observable checkpoints before changing schema: row counts, constraint validation, error rates, lock waits, job progress, and application logs.
3. Prefer existing Cogain telemetry and database checks before adding a new monitoring stack.
4. Treat Debezium, Prometheus, or Grafana guidance as optional infrastructure that requires an explicit deployment decision.
5. Capture the verification command/query in the migration plan.

## 🧠 Knowledge Modules (Fractal Skills)

### 1. [Change Data Capture with Debezium](./sub-skills/2-change-data-capture-with-debezium.md)

### 2. [Enterprise Monitoring and Alerting](./sub-skills/3-enterprise-monitoring-and-alerting.md)

### 3. [Grafana Dashboard Configuration](./sub-skills/4-grafana-dashboard-configuration.md)

### 4. [CI/CD Integration](./sub-skills/5-cicd-integration.md)
