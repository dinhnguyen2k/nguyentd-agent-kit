# Layered Architecture & Controllers

Every service keeps four layers: `API -> Services -> Repositories -> Data`.
A layer may only call the layer directly below it.

| Project | Owns | Must NOT contain |
| --- | --- | --- |
| `<S>.API` | Controllers, gRPC services, DI wiring, filters | Business rules, EF queries |
| `<S>.Services` | Business logic, orchestration, hooks | `DbContext`, HTTP concerns |
| `<S>.Repositories` | Repository impls, `UnitOfWork` | Business rules |
| `<S>.Data` | Entities, `DbContext`, EF configurations, migrations | Anything else |

## Controllers are declarations, not logic

Most CRUD controllers are a single line — the generic base supplies every endpoint.

```csharp
namespace MasterData.API.Controllers;

public class PortTypesController(IPortTypeService service)
    : BaseExcelController<IPortTypeService, PortType, PortTypeDto, CreatePortTypeDto,
        UpdatePortTypeDto, DropdownDto<Guid>, AutoFilter, AutoFilterPaging>(service)
{
}
```

Add an action only for behaviour the base does not cover:

```csharp
public class AssetUnitsController(IAssetUnitService service)
    : BaseExcelController<IAssetUnitService, AssetUnit, AssetUnitDto, AssetUnitUpsertDto,
        AssetUnitUpsertDto, DropdownDto<Guid>, AutoFilter, AutoFilterPaging>(service)
{
    [HttpPost("{id:guid}/post-depreciation")]
    [HasPermission(Resources.AssetUnit, Actions.Approve)]
    public async Task<Result> PostDepreciation(Guid id, CancellationToken cancellationToken)
        => await service.PostDepreciationAsync(id, cancellationToken);
}
```

## ❌ BAD: logic leaking into the API layer

```csharp
[HttpPost]
public async Task<IActionResult> Create(CreateAssetUnitDto dto)
{
    // ❌ EF query in a controller
    var exists = await _dbContext.AssetUnits.AnyAsync(x => x.Code == dto.Code);
    if (exists) return Conflict("Duplicated code");        // ❌ 409 breaks the FE interceptor
    // ❌ business rule in a controller
    dto.Status = dto.PurchaseCost > 50_000_000 ? "NeedApproval" : "Draft";
    return Ok(await _service.Create(dto));                  // ❌ hides Result status code
}
```

## ✅ GOOD: same rule, in the service

```csharp
protected override async Task BeforeCreateAsync(AssetUnitUpsertDto dto)
{
    if (await _repository.ExistsAsync(x => x.Code == dto.Code && x.DeletedDate == null))
        // InvalidOperationException -> 400 + this message (see centralized-error-handling)
        throw new InvalidOperationException($"Asset code {dto.Code} already exists.");
}
```

## Route conventions

```
GET    /api/v1/asset-units              # paged list  -> PagedResult<T>
GET    /api/v1/asset-units/{id}         # single      -> Result<T>
GET    /api/v1/asset-units/dropdown     # dropdown    -> Result<IEnumerable<TDropdownDto>>
POST   /api/v1/asset-units              # create      -> Result<T>
PUT    /api/v1/asset-units/{id}         # update      -> Result<T>
DELETE /api/v1/asset-units/{id}         # delete      -> Result
POST   /api/v1/asset-units/import-excel # import      -> Result
```

Filtering / paging / sorting arrive through `AutoFilter` / `AutoFilterPaging`
(`System.Linq.Dynamic.Core` based) — do not invent per-endpoint query parameters when the
auto-filter already covers them.

## Cross-service reads

Never reach into another service's database. Use its gRPC client (registered in
`ServiceExtensions`) or subscribe to its integration events.

## Audit checkpoints

- Controller has no `DbContext`, no repository, no business branch
- Public endpoint carries `[HasPermission(...)]` unless deliberately `[SkipPermissionCheck]`
- New endpoint is registered in `OcelotApiGw` routing when the FE must reach it
- Return type is `Result` / `Result<T>` / `PagedResult<T>`, not `IActionResult` wrapping `Ok()`
