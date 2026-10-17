---
name: cogain-child-sync
description: Implements aggregate-owned soft-delete synchronization for Cogain EF Core child collections. Use when adding or changing nested update DTOs, ISyncsChildren, BuildIncomingGraph, SyncChildCollection, or legacy ReconcileCollections behavior.
metadata:
  version: 1.0.0
  layer: project-skill
---

# Cogain Child Collection Sync

The target pattern is aggregate-owned synchronization: the entity owns child invariants; the service translates DTOs into a transient entity graph.

## Required Pattern

1. The aggregate entity implements invariant `ISyncsChildren<TEntity>`.
2. `SyncChildren(TEntity incoming)` calls `EntityAuditBase.SyncChildCollection` for each owned collection.
3. The service overrides `BuildIncomingGraph(TUpdateDto dto, TEntity existing)` and maps DTO child rows to transient child entities.
4. `BaseService.Update` calls `SyncChildren` and skips legacy reflection reconciliation.
5. Removed children stay in the tracked navigation and receive soft-delete audit fields.

Reference implementation:

- `backend/src/Services/MasterData/MasterData.Data/Entities/Production/SemiFinishedGood.cs`
- `backend/src/Services/MasterData/MasterData.Services/Implement/Production/SemiFinishedGoodService.cs`
- `backend/tests/Architecture.Tests/ChildSyncArchitectureTests.cs`

## Design the Natural Key

- Prefer persisted `Id` when the payload carries a valid ID; `SyncChildCollection` already handles this.
- Supply a stable domain natural key for new rows. Use a tuple when uniqueness spans columns.
- Include every field that determines child identity, but exclude mutable fields that should be updated in place.
- Use `onUpdate` for mutable properties and `beforeAdd` for parent FK, owner type, or other creation invariants.

## Null and Empty Semantics

Current `SyncChildCollection` treats `incoming == null` as “soft-delete all active children.” Do not assume null means “leave unchanged.” If the API needs patch semantics, establish that contract explicitly before using this pattern.

## Legacy

`EntityAuditBase.SyncCollection` (hard-remove, no soft-delete) is legacy and still serves CRM only. Do not use it for new code.

## Boundaries

- Do not add new `ReconcileCollections` or `ReconcileCollectionsAsync` usage; both are obsolete.
- Do not remove children from an EF-tracked navigation when the child FK is required. That severs the association and can cause EF to null a non-nullable FK.
- Do not make domain entities depend on DTO types.
- Do not make `ISyncsChildren<T>` contravariant; the invariant runtime guard is deliberate.
- Do not sync non-owned references as children. Aggregate ownership must be clear.

## Verification

- `ChildSyncArchitectureTests` passes.
- Tests cover add, update, duplicate payload key, omitted/removal behavior, and soft-delete behavior relevant to the collection.
- Parent FK and creation-only invariants are set in `beforeAdd`.
- Existing active rows update in place; removed rows keep audit history.
