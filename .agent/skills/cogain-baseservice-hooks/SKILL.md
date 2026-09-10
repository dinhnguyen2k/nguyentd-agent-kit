---
name: cogain-baseservice-hooks
description: Extends Cogain BaseService through supported hooks without replacing shared CRUD orchestration. Use when changing CRUD, AutoFilter, create/update/delete lifecycles, dropdowns, or shared service behavior in backend/**.
metadata:
  version: 1.0.0
  layer: project-skill
---

# Cogain BaseService Hooks

`BaseService` is shared orchestration. A derived service should override the smallest hook around the required behavior, not copy or replace the orchestration method.

## Source of Truth

Before editing, inspect:

- `backend/src/BuildingBlocks/Infrastructure/Services/BaseService.cs`
- the derived service being changed
- one nearby service using the same hook
- [references/hook-map.md](references/hook-map.md) for routing, then verify the signature in source

## Choose the Seam

| Need                                             | Preferred seam                                                                                     |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Change include string for one read path          | `BeforeGetByIdAsync`, `BeforeGetPagedAsync`, `BeforeGetAllAsync`, or `BeforeGetDropdownAsync`      |
| Add a filter shared by paged and non-paged reads | `BeforeApplyAutoFilterCoreAsync`                                                                   |
| Add only paged access/filter logic               | `BeforeApplyAutoFilterAsync`                                                                       |
| Enrich entities before DTO mapping               | `AfterGetByIdAsync`, `AfterGetPagedAsync`, or `AfterGetAllAsync`                                   |
| Enrich mapped DTO/result                         | `BeforeReturnGetByIdAsync`, `BeforeReturnGetPagedAsync`, or `BeforeReturnGetAllAsync`              |
| Validate/enrich create input                     | `BeforeCreateAsync` and `AfterMapperAsync`                                                         |
| Validate update                                  | `BeforeUpdateAsync`                                                                                |
| Change mapped entity after update mapping        | `AfterMappingAsync`                                                                                |
| Synchronize aggregate children                   | [skill:cogain-child-sync], not a mapping hook workaround                                           |
| Resolve data after child synchronization         | `AfterReconcileCollectionsAsync`                                                                   |
| Post-save side effect                            | `AfterCreateAsync` or `AfterUpdateAsync`; assess remote consistency first                          |
| Delete-specific include/validation               | `GetDeleteIncludeString`, `GetEntityForDeleteAsync`, `BeforeDeleteAsync`, `BeforeDeleteByIdsAsync` |
| Excel import/export                              | [skill:cogain-excel-import-export]                                                                 |

## Procedure

1. Trace the base method around the candidate hook; verify when it runs relative to mapping and `SaveChangesAsync`.
2. Find an existing override with the same intended outcome.
3. Override only that seam and preserve the base method's result/exception contract.
4. If the seam is missing, prove why composition or an existing hook cannot solve the case before changing `BaseService`.
5. Add a focused test at the derived-service level; change architecture tests when introducing a repository-wide invariant.

## Boundaries

- Do not override an orchestration method solely to add validation, includes, mapping, or a side effect.
- Do not add special-case entity checks to `BaseService` when a hook or domain interface can own the behavior.
- Do not issue a remote write inside a transaction without compensation/outbox/saga analysis.
- Do not call `ReconcileCollections` from new code.
- `AfterMappingAsync` runs before aggregate child synchronization; use `AfterReconcileCollectionsAsync` when newly synchronized children must exist first.

## Verification

- Hook signature and lifecycle position match current `BaseService.cs`.
- No shared orchestration was duplicated.
- Mapping, transaction, remote side effects, and persistence order are explicit.
- Targeted tests/build pass or the unverified gap is reported.
