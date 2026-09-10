# BaseService Hook Map

This map is a navigation aid, not an API contract. Search `BaseService.cs` before use because the shared service evolves.

| Operation      | Before/query seam                                                                                                                              | After-entity seam                                     | Before-return/post-save seam |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ---------------------------- |
| Get by id      | `BeforeGetByIdAsync`                                                                                                                           | `AfterGetByIdAsync`                                   | `BeforeReturnGetByIdAsync`   |
| Get paged      | `BeforeGetPagedAsync`, `BeforeApplyAutoFilterAsync`                                                                                            | `AfterGetPagedAsync`                                  | `BeforeReturnGetPagedAsync`  |
| Get all        | `BeforeGetAllAsync`, `BeforeApplyAutoFilterCoreAsync`                                                                                          | `AfterGetAllAsync`                                    | `BeforeReturnGetAllAsync`    |
| Dropdown       | `BeforeGetDropdownAsync`, `BeforeApplyAutoFilterCoreAsync`                                                                                     | —                                                     | —                            |
| Dropdown paged | `BeforeGetDropdownPagedAsync`, `BeforeApplyAutoFilterAsync`                                                                                    | —                                                     | —                            |
| Create         | `BeforeCreateAsync`                                                                                                                            | `AfterMapperAsync`                                    | `AfterCreateAsync`           |
| Update         | `BeforeUpdateAsync`, `BuildIncomingGraph`                                                                                                      | `AfterMappingAsync`, `AfterReconcileCollectionsAsync` | `AfterUpdateAsync`           |
| Delete         | `GetDeleteIncludeString`, `GetEntityForDeleteAsync`, `ResolveDeleteWorkItemIdAsync`                                                            | `BeforeDeleteAsync`, `BeforeDeleteByIdsAsync`         | —                            |
| Import         | `CustomParseExcelToDtosAsync`, `LoadImportReferencesAsync`, `ValidateImportDtosAsync`, `PrepareImportEntitiesAsync`, `SaveImportEntitiesAsync` | project-specific hooks in the current source          | —                            |
| Export         | `GenerateTemplateBytesAsync`, `GenerateExportDataBytesAsync`                                                                                   | —                                                     | filename hooks               |

## Lifecycle Facts That Change Decisions

- `GetPaged` uses `AsNoTracking`; it uses `AsSplitQuery` when includes are present.
- `BeforeApplyAutoFilterCoreAsync` is shared by paged and non-paged flows; `BeforeApplyAutoFilterAsync` adds paged/access-control behavior.
- Update maps scalar fields, calls `AfterMappingAsync`, builds/synchronizes the incoming child graph, then calls `AfterReconcileCollectionsAsync` before repository update/save.
- Returning non-null from `BuildIncomingGraph` requires the entity to implement `ISyncsChildren<TEntity>`; otherwise update throws.
- Returning null from `BuildIncomingGraph` currently enters the legacy reconciliation path for backward compatibility.

## Search Commands

```bash
rg -n "protected virtual|public virtual" backend/src/BuildingBlocks/Infrastructure/Services/BaseService.cs
rg -n "override .*Before|override .*After|BuildIncomingGraph" backend/src/Services -g '*.cs'
```
