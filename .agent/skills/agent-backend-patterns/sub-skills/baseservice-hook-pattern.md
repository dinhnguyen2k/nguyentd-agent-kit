# BaseService Hook Pattern

`BaseService<TEntity, TDto, TCreateDto, TUpdateDto, TDropdownDto, TFilter, TFilterPaging>`
implements the full CRUD + dropdown + paging + Excel pipeline. Customization happens through
`protected virtual` hooks, never by re-implementing the pipeline.

## Hard bans (`AI_RULES.md` + `.agent/rules/backend-excel-import.md`)

Never override:

- `ImportFromExcel`
- `ExportTemplateAsync`
- `ExportDataAsync`

These orchestrate file parsing, validation, code generation and compensation. Override the
Excel hooks instead: `ParseExcelToImportDtos`, `CustomParseExcelToDtosAsync`,
`LoadImportReferencesAsync`, `ValidateImportDtosAsync`, `ValidateImportAsync`,
`CustomImportMappingAsync`, `PrepareImportEntitiesAsync`, `SaveImportEntitiesAsync`.

## Available fields (already injected)

`_repository`, `_unitOfWork`, `_mapper`, `_config`, `_logger` (Serilog `ILogger`),
`_currentUserService`, `_autoFilterService`, `_redisAutoIncrement`, `_fileService`, `_eventBus`.

## Hook map

| Operation | Hooks, in execution order |
| --- | --- |
| Create | `BeforeCreateAsync(dto)` -> map -> `AfterMapperAsync(dto, entity)` -> audit + code gen -> save -> `AfterCreateAsync(dto, result)` |
| Update | `BeforeUpdateAsync(id, dto)` -> `GetUpdateIncludeString()` -> map -> `AfterMappingAsync(entity, dto)` -> save -> `AfterUpdateAsync(id, dto, result)` |
| Delete | `GetDeleteIncludeString()` / `GetEntityForDeleteAsync(id)` -> `BeforeDeleteAsync(entity)` -> delete |
| DeleteByIds | `BeforeDeleteByIdsAsync(entities)` -> delete |
| GetById | `BeforeGetByIdAsync(id, includeString)` -> load -> `AfterGetByIdAsync(entity)` -> map -> `BeforeReturnGetByIdAsync(dto)` |
| GetPaged | `BeforeGetPagedAsync(parameters, includeString)` -> `BeforeApplyAutoFilterAsync(query, parameters)` -> page -> `AfterGetPagedAsync(entities)` -> `BeforeReturnGetPagedAsync(result)` |
| GetAll | `BeforeGetAllAsync` -> load -> `AfterGetAllAsync` -> `BeforeReturnGetAllAsync` |
| Dropdown | `BeforeGetDropdownAsync` / `BeforeGetDropdownPagedAsync` |

Hooks returning `Task<string>` (`BeforeGetByIdAsync`, `BeforeGetPagedAsync`, ...) let you
supply an `includeString`; returning `null` keeps the caller's value.

## Validating in a hook

Hooks return `Task`, not `Result`, so rejection is by exception. Throw
`InvalidOperationException` — `GlobalExceptionHandlerMiddleware` maps it to **400** with your
message intact. A plain `Exception` becomes a **500** with a generic message and hides the
reason from the user.

```csharp
// ✅ GOOD
protected override async Task BeforeCreateAsync(CreateCodeGenerationRuleDto dto)
{
    if (await _repository.ExistsAsync(x => x.Namespace == dto.Namespace && x.DeletedDate == null))
        throw new InvalidOperationException("Đã tồn tại quy tắc sinh mã của chức năng này.");
}

// ❌ BAD — user sees "Đã xảy ra lỗi hệ thống" with HTTP 500
protected override async Task BeforeCreateAsync(CreateCodeGenerationRuleDto dto)
{
    if (await _repository.ExistsAsync(x => x.Namespace == dto.Namespace))
        throw new Exception("Đã tồn tại quy tắc sinh mã của chức năng này.");
}
```

## Enriching an entity after mapping

`AfterMapperAsync` runs once the DTO is mapped and the entity has its `Id`, which is where
snapshot fields resolved over gRPC belong.

```csharp
protected override async Task AfterMapperAsync(AssetUnitUpsertDto dto, AssetUnit entity)
{
    if (entity.AssetId == Guid.Empty) return;

    var response = await _masterDataGrpcClient.GetAssetsByIdsAsync(
        new GetIdsRequest { Ids = { entity.AssetId.ToString() } });

    var asset = response.Assets.FirstOrDefault();
    if (asset is null)
        throw new InvalidOperationException("Không tìm thấy tài sản trong danh mục.");

    entity.AssetCode = asset.Code;
    entity.AssetName = asset.Name;
}
```

## Extending the paged query

```csharp
protected override async Task<IQueryable<AssetUnit>> BeforeApplyAutoFilterAsync(
    IQueryable<AssetUnit> query, AutoFilterPaging parameters)
{
    query = await base.BeforeApplyAutoFilterAsync(query, parameters);

    // Server-enforced scoping — never trust a client-supplied owner filter.
    if (await _currentUserService.HasFullSystemAccessAsync())
        return query;

    var employeeId = await _currentUserService.GetEmployeeIdAsync();
    if (employeeId is null)
        throw new InvalidOperationException("Thiếu thông tin nhân sự của người dùng hiện tại.");

    return query.Where(x => x.ResponsibleEmployeeId == employeeId.Value);
}
```

Always call `base` first in a hook that has a meaningful base implementation.

## Overriding a public method

Permitted for `Create` / `Update` / `Delete` when you need to wrap the base call — but the base
must still run.

```csharp
// ✅ GOOD — wraps, does not replace
public override Task<Result<AssetUnitDto>> Create(AssetUnitUpsertDto dto)
    => _workItemLifecycleService.CreateWithWorkItemAsync(
        WorkItemCategoryCode,
        async () => await base.Create(dto),
        (result, categoryInfo, createdById) => BuildCreateWorkItemRequest(result, categoryInfo, createdById),
        useTransaction: true);

// ❌ BAD — reimplements the pipeline, loses audit fields, code generation and hooks
public override async Task<Result<AssetUnitDto>> Create(AssetUnitUpsertDto dto)
{
    var entity = _mapper.Map<AssetUnit>(dto);
    await _repository.AddAsync(entity);
    await _unitOfWork.SaveChangesAsync();
    return Result<AssetUnitDto>.Success(_mapper.Map<AssetUnitDto>(entity));
}
```

## Audit checkpoints

- `ImportFromExcel` / `ExportTemplateAsync` / `ExportDataAsync` are not overridden
- Hook rejections use `InvalidOperationException` (400), not bare `Exception` (500)
- Overridden public methods still invoke `base.*`
- Hooks with a base implementation call `base` before adding behaviour
- No duplicate mapping / audit / code-generation logic reimplemented in a subclass
