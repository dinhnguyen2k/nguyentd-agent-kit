---
name: cogain-child-sync
description: Declares and changes Cogain aggregate child collections through AggregateShape (sync, soft-delete, includes, snapshot nodes, mapping). Use when adding or changing nested update DTOs, child tables, BuildIncomingGraph, AggregateShape, SyncCollection on tab/import/confirm paths, or legacy ReconcileCollections behavior.
metadata:
  version: 2.0.0
  layer: project-skill
---

# Cogain Aggregate Child Sync

Decision record: `docs/adr/0003-aggregate-write-pipeline.md`.
Step-by-step guide with code: `docs/snapshot-policy-development-guide.md`.

## Required Pattern

1. The root entity implements `IAggregateRoot<TSelf>` and declares `public static AggregateShape<TSelf> Shape`.
2. Each owned collection is one `ChildrenById` or `ChildrenByKey` node with an explicit `update` callback; grandchildren nest inside the child builder.
3. The service overrides `BuildIncomingGraph(TUpdateDto dto, TEntity existing)` and maps DTO rows to transient child entities, keeping `null` when the DTO sends `null`.
4. AutoMapper: `IgnoreAggregateChildren()` on update DTO -> entity; `MapActiveChildren()` on entity -> DTO.
5. Services whose nodes carry `[SnapshotReference]` inject `AggregateSnapshotService` and call `UseSnapshots(service)` in the constructor.
6. Services needing WorkItem/transaction override `ExecuteCreateWriteAsync`/`ExecuteUpdateWriteAsync` and call `write.PersistAsync()` inside their boundary.

Reference implementation:

- `backend/src/Services/ServiceDesk/ServiceDesk.Data/Entities/SalesOrders/SalesOrder.cs`
- `backend/src/Services/ServiceDesk/ServiceDesk.Services/Implement/SalesOrders/SalesOrderService.cs`
- `backend/src/Services/ServiceDesk/ServiceDesk.Services/Implement/Production/ProductionOrder/ProductionOrderService.cs` (transactional write seam)

## Matching and Keys

- `ChildrenById`: match by persisted `Id` only.
- `ChildrenByKey`: match `Id` first, then the natural key; each existing row matches once.
- The key holds identity columns only, never mutable fields; use a tuple when uniqueness spans columns.
- Duplicate `Id` in the payload throws before any change.
- New rows keep their `Id`; BaseService calls `IUnitOfWork.MarkAdded(sync.Added)` so pre-assigned Ids insert instead of causing 409. Siblings/grandchildren may reference that Id as FK.

## Null and Empty Semantics

- `NullMeans.Keep` (default): `null` collection leaves rows untouched.
- `NullMeans.ClearAll`: `null` soft-deletes all active rows; choose it only when that is the existing FE/API contract.
- Empty collection always soft-deletes all active rows.
- `ManagedWhen(predicate)` restricts reconciliation to rows the screen owns.
- Soft-deleting a row cascades to its whole subtree.

## Other Write Paths

- Tab update: `TabUpdateHelpers.UpsertTabWithSnapshotAsync`.
- Import/confirm/custom: `AggregateSynchronizer.SyncCollection(root, x => x.Items, incoming)` then `_unitOfWork.MarkAdded(sync.Added)`; collect snapshots with `AggregateSnapshotService.CollectAsync` before the transaction, `Apply` inside it before `SaveChanges`.

## Boundaries

- One-to-one relations stay outside the shape; handle them in the parent node's `update` callback.
- `update` callbacks copy every mutable column and never touch `Id`, parent FK, audit or snapshot columns; a new column not copied there is silently never updated.
- Do not hand-write update includes, collection ignores or soft-delete filters for collections already in the shape.
- Do not remove children from an EF-tracked navigation when the FK is required; the shape soft-deletes instead.
- Do not assign `LastModified*` manually; the shared `AuditingInterceptor` owns audit fields.
- Do not add entity-specific branches to `AggregateShape`, `AggregateSynchronizer`, `AggregateSnapshotService` or `BaseService`.
- `ReconcileCollections*` reflection remains only for entities without a shape and is `[Obsolete]`. Any aggregate whose children you touch must get a shape instead.
- Do not make domain entities depend on DTO types.

## Verification

- App starts: `AddAggregateShapeValidation<AppDbContext>()` rejects shapes that disagree with the EF model.
- Covered: add (including pre-assigned Id), update in place, removal soft-deletes subtree, `null` vs empty per `NullMeans`, unchanged FK keeps historical snapshot, changed FK resolves new snapshot, every listed write path.
