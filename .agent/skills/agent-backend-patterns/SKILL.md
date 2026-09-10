---
name: agent-backend-patterns
description: >
  Backend patterns for the Cogain ASP.NET Core 8 microservices backend (C#).
  Layered architecture (API -> Services -> Repositories -> Data), Result<T> contract,
  BaseService hooks, EF Core / PostgreSQL optimization, transactions & compensation,
  Redis caching, permission-based authorization, Serilog logging.
  Use when writing, reviewing, or auditing anything under `backend/**`.
metadata:
  version: "5.0.0-csharp"
---

# Backend Patterns (C# / ASP.NET Core 8)

Patterns and review criteria for `backend/src/**`. All examples are C# and follow the
conventions that already exist in this repository — not generic textbook patterns.

## Stack facts (do not contradict these)

| Concern | What this repo actually uses |
| --- | --- |
| Runtime | .NET 8, ASP.NET Core 8 microservices, `backend/CogainSolution.sln` |
| Layers | `<Service>.API` -> `<Service>.Services` -> `<Service>.Repositories` -> `<Service>.Data` |
| Shared code | `backend/src/BuildingBlocks/{Contracts,Infrastructure,Shared}` |
| Gateway | `OcelotApiGw` (Ocelot + Polly + CacheManager) |
| Database | PostgreSQL + EF Core 8, snake_case columns, soft delete via `DeletedDate` |
| API contract | `Result`, `Result<T>`, `PagedResult<T>` (`Contracts.Domain.Entities`) |
| CRUD engine | `BaseService<...>` + `BaseController` / `BaseExcelController` |
| Data access | `IBaseRepository<TEntity>`, `IUnitOfWork` (`Contracts.Domain.Interfaces`) |
| Cache | Redis via `StackExchange.Redis` (`IDatabase`, `IConnectionMultiplexer`) |
| Messaging | `IEventBus` -> Kafka (`KafkaEventBus`) or MassTransit (`MassTransitEventBus`) |
| Inter-service | gRPC clients (e.g. `MasterDataInfoGrpc.MasterDataInfoGrpcClient`) |
| Auth | Authentik OIDC + `AddJwtBearer`; permissions as `Resource.Action` |
| Validation | FluentValidation (`AbstractValidator<T>`) |
| Logging | Serilog — `Serilog.ILogger` in services, `ILogger<T>` in middleware |
| Mapping | AutoMapper 14 |

## Use this skill when

- Implementing or changing a service under `backend/src/Services/**`
- Reviewing / auditing a backend diff (`/audit` Medium & High risk)
- Touching transactions, cross-service writes, caching, or authorization
- Optimizing EF Core queries or gRPC fan-out

## Do not use this skill when

- The change is frontend-only (`frontend/**`) -> use `agent-frontend-patterns`
- You need language-level C# guidance only -> use `csharp-latest-standards` / `csharp-pro`
- You need deep .NET architecture theory -> use `dotnet-backend-patterns`

## Precedence

`AI_RULES.md` > `.agent/rules/backend.md` > `.agent/rules/backend-pragmatic-solid.md` > this skill.
This skill shows *how* to implement those rules; it never overrides them.

## Audit checklist (fast pass)

Contract & API
- [ ] Returns `Result` / `Result<T>` / `PagedResult<T>`; no raw DTO or anonymous object
- [ ] Business failures use **400** via `Result.Failure(msg)` — never ad-hoc 401/403/409
- [ ] Controller stays thin; no business logic, no `DbContext`, no repository calls

Service layer
- [ ] No override of `ImportFromExcel` / `ExportTemplateAsync` / `ExportDataAsync`
- [ ] Customization done through `BaseService` hooks, not by re-implementing core methods
- [ ] `CancellationToken` propagated through every async path it can reach

Data & performance
- [ ] `.AsNoTracking()` on read-only queries over non-trivial sets
- [ ] Projection / deliberate `Include` — no accidental N+1, no `Include` fan-out for unused data
- [ ] Large `IN` sets use `array.Contains(x.Id)` with a materialized `.ToArray()`
- [ ] gRPC calls skipped entirely when the id list is empty
- [ ] Soft-delete respected; unique indexes carry `.HasFilter("\"deleted_date\" IS NULL")`

Consistency
- [ ] Multi-step writes wrapped in `ExecuteInTransactionAsync` (or explicit Begin/Commit/Rollback)
- [ ] Cross-service writes declare their model: compensation, outbox, or saga
- [ ] Read-check-write races protected (`AcquireAdvisoryLockAsync` or a DB constraint)

Security
- [ ] `[HasPermission(resource, action)]` present; no static role checks, no auth bypass
- [ ] Employee-scoped flows validate the `X-Employee-Id` GUID header
- [ ] No hardcoded secrets / tokens / API keys

Observability & tests
- [ ] Errors logged with structured Serilog properties; no silent `catch { }`
- [ ] Cache writes have a TTL and a matching invalidation path
- [ ] Tests under `backend/tests/**` cover money / permission / inventory / legal invariants

## 🧠 Knowledge Modules (Fractal Skills)

### 1. [Layered Architecture & Controllers](./sub-skills/layered-architecture-and-controllers.md)
### 2. [Result Contract & Status Codes](./sub-skills/result-contract-and-status-codes.md)
### 3. [Repository & Unit of Work](./sub-skills/repository-and-unit-of-work.md)
### 4. [BaseService Hook Pattern](./sub-skills/baseservice-hook-pattern.md)
### 5. [Validation with FluentValidation](./sub-skills/validation-with-fluentvalidation.md)
### 6. [Middleware & Action Filters](./sub-skills/middleware-and-filters.md)
### 7. [Centralized Error Handling](./sub-skills/centralized-error-handling.md)
### 8. [EF Core Query Optimization](./sub-skills/ef-core-query-optimization.md)
### 9. [N+1 Prevention & Batch Loading](./sub-skills/n1-prevention-and-batch-loading.md)
### 10. [Soft Delete & Filtered Indexes](./sub-skills/soft-delete-and-filtered-indexes.md)
### 11. [Transactions & Advisory Locks](./sub-skills/transactions-and-advisory-locks.md)
### 12. [Cross-Service Compensation](./sub-skills/cross-service-compensation.md)
### 13. [Redis Cache Layer](./sub-skills/redis-cache-layer.md)
### 14. [Cache-Aside Pattern](./sub-skills/cache-aside-pattern.md)
### 15. [Resilience & Retry](./sub-skills/resilience-and-retry.md)
### 16. [JWT Authentication](./sub-skills/jwt-authentication.md)
### 17. [Permission-Based Authorization](./sub-skills/permission-based-authorization.md)
### 18. [Rate Limiting](./sub-skills/rate-limiting.md)
### 19. [Background Jobs & Event Bus](./sub-skills/background-jobs-and-event-bus.md)
### 20. [Structured Logging with Serilog](./sub-skills/structured-logging-serilog.md)

**Remember**: prefer the simplest design that solves the current problem
(`backend-pragmatic-solid.md`). Add abstraction only under real pressure to change.
