# BaseService Hook Map

This map is a navigation aid, not an API contract. Search `BaseService.cs` before use because the shared service evolves.

| Operation      | Before/query seam                                                                                                                              | After-entity seam                                     | Before-return/post-save seam |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ---------------------------- |
| Get by id      | `BeforeGetByIdAsync`                                                                                                                           | `AfterGetByIdAsync`                                   | `BeforeReturnGetByIdAsync`   |
| Get paged      | `BeforeGetPagedAsync`, `BeforeApplyAutoFilterAsync`                                                                                            | `AfterGetPagedAsync`                                  | `BeforeReturnGetPagedAsync`  |
| Get all        | `BeforeGetAllAsync`, `BeforeApplyAutoFilterCoreAsync`                                                                                          | `AfterGetAllAsync`                                    | `BeforeReturnGetAllAsync`    |
| Dropdown       | `BeforeGetDropdownAsync`, `BeforeApplyAutoFilterCoreAsync`                                                                                     | —                                                     | —                            |
| Dropdown paged | `BeforeGetDropdownPagedAsync`, `BeforeApplyAutoFilterAsync`                                                                                    | —                                                     | —                            |
| Create         | `BeforeCreateAsync`                                                                                                                            | `AfterMapperAsync`, `ExecuteCreateWriteAsync`         | `AfterCreateAsync`           |
| Update         | `BeforeUpdateAsync`, `BuildIncomingGraph`, `GetUpdateIncludeString`                                                                            | `AfterMappingAsync`, `AfterChildrenSyncedAsync`, `ExecuteUpdateWriteAsync` | `AfterUpdateAsync`           |
| Delete         | `GetDeleteIncludeString`, `GetEntityForDeleteAsync`, `ResolveDeleteWorkItemIdAsync`                                                            | `BeforeDeleteAsync`, `BeforeDeleteByIdsAsync`         | —                            |
| Import         | `CustomParseExcelToDtosAsync`, `LoadImportReferencesAsync`, `ValidateImportDtosAsync`, `PrepareImportEntitiesAsync`, `SaveImportEntitiesAsync` | project-specific hooks in the current source          | —                            |
| Export         | `GenerateTemplateBytesAsync`, `GenerateExportDataBytesAsync`                                                                                   | —                                                     | filename hooks               |

## Lifecycle Facts That Change Decisions

- `GetPaged` uses `AsNoTracking`; it uses `AsSplitQuery` when includes are present.
- `BeforeApplyAutoFilterCoreAsync` is shared by paged and non-paged flows; `BeforeApplyAutoFilterAsync` adds paged/access-control behavior.
- Update runs in three phases: prepare (load with shape includes, map scalars, `AfterMappingAsync`, sync children, `MarkAdded`, `AfterChildrenSyncedAsync`, `DetectChanges`), collect snapshots outside any transaction, then `ExecuteUpdateWriteAsync(id, dto, write)` whose default is `write.PersistAsync()`.
- `PreparedWrite.PersistAsync()` re-runs prepare on execution-strategy replay; override `Execute*WriteAsync` to wrap WorkItem/transaction, never wrap `base.Update` in an outer transaction when the aggregate has snapshots (fail-fast).
- For entities with `AggregateShape`, `BuildIncomingGraph` must return non-null; null throws `InternalInvariantException`.
- Entities without a shape still use the `[Obsolete]` reflection reconciliation fallback.
- Snapshot services must call `UseSnapshots(AggregateSnapshotService)` in the constructor; missing wiring throws on first write.

## Search Commands

```bash
rg -n "protected virtual|public virtual" backend/src/BuildingBlocks/Infrastructure/Services/BaseService.cs
rg -n "override .*Before|override .*After|BuildIncomingGraph" backend/src/Services -g '*.cs'
```
