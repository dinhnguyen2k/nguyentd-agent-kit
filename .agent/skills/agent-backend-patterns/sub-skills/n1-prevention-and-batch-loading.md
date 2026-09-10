# N+1 Prevention & Batch Loading

An N+1 is one query for the list plus one per item. In this codebase it appears in three
places: EF navigation access, gRPC calls to another service, and Redis lookups.

## 1. EF navigations

```csharp
// ❌ BAD — 1 + N queries (lazy/explicit load per row)
var assets = await _repository.Query(x => x.DeletedDate == null).ToListAsync(ct);
foreach (var asset in assets)
    asset.Warehouse = await _warehouseRepo.GetByIdAsync(asset.WarehouseId);   // N queries
```

```csharp
// ✅ BEST — project the joined column, 1 query
var rows = await _repository.Query(x => x.DeletedDate == null)
    .AsNoTracking()
    .Select(x => new AssetUnitListDto
    {
        Id = x.Id,
        Code = x.Code,
        WarehouseName = x.Warehouse.Name
    })
    .ToListAsync(ct);

// ✅ ALSO FINE when you need the entities — 1 query (or 2 with AsSplitQuery)
var assets = await _repository.Query(x => x.DeletedDate == null)
    .Include(x => x.Warehouse)
    .AsNoTracking()
    .ToListAsync(ct);
```

## 2. Cross-aggregate data: batch + dictionary

When the related rows come from a separate query, load them once and index them.

```csharp
// ✅ GOOD — 2 queries total
var assets = await _repository.Query(x => x.DeletedDate == null).AsNoTracking().ToListAsync(ct);

var warehouseIds = assets.Select(a => a.WarehouseId).Distinct().ToArray();
var warehouses = await _warehouseRepo.Query(w => warehouseIds.Contains(w.Id))
    .AsNoTracking()
    .Select(w => new { w.Id, w.Name })
    .ToListAsync(ct);

var warehouseNames = warehouses.ToDictionary(w => w.Id, w => w.Name);

var dtos = assets.Select(a => new AssetUnitListDto
{
    Id = a.Id,
    Code = a.Code,
    WarehouseName = warehouseNames.GetValueOrDefault(a.WarehouseId, string.Empty)
}).ToList();
```

`ToDictionary` throws on duplicate keys — use `ToLookup` (or group first) when the key is not
unique.

## 3. gRPC fan-out

Every gRPC call is a network round-trip. Batch the ids into one request, and **skip the call
entirely when the list is empty** (`.agent/rules/backend.md` §4.3).

```csharp
// ❌ BAD — one RPC per row
foreach (var line in lines)
{
    var res = await _masterDataGrpcClient.GetAssetsByIdsAsync(
        new GetIdsRequest { Ids = { line.AssetId.ToString() } });
    line.AssetName = res.Assets.FirstOrDefault()?.Name;
}
```

```csharp
// ✅ GOOD — one RPC, no RPC at all when there is nothing to fetch
private async Task<Dictionary<Guid, AssetInfo>> LoadAssetsAsync(IEnumerable<Guid> assetIds)
{
    var ids = assetIds.Where(id => id != Guid.Empty).Distinct().ToArray();
    if (ids.Length == 0)
        return [];   // no round-trip

    var request = new GetIdsRequest();
    request.Ids.AddRange(ids.Select(id => id.ToString()));

    var response = await _masterDataGrpcClient.GetAssetsByIdsAsync(request);
    return response.Assets.ToDictionary(a => Guid.Parse(a.Id), a => a);
}
```

For a service method that must return an empty response, avoid the async state machine:

```csharp
public Task<GetAssetsResponse> GetAssetsByIdsAsync(GetIdsRequest request)
{
    if (request.Ids.Count == 0)
        return Task.FromResult(new GetAssetsResponse());   // ✅ no allocation-heavy await path
    return LoadAsync(request);
}
```

## 4. Redis lookups

Use `StringGetAsync` with multiple keys (one round-trip) rather than a loop of single gets;
`IDatabase.StringGetAsync(RedisKey[])` returns values positionally.

## Queries inside a loop — the general smell

Any `await` on a repository, gRPC client or cache **inside** `foreach` / `for` / `Select` is
an N+1 until proven otherwise. Hoist the load above the loop.

```csharp
// ❌ BAD
foreach (var line in dto.Lines)
    if (!await _materialRepo.ExistsAsync(x => x.Id == line.MaterialId))
        errors.Add(new ValidationError($"Lines[{i}].MaterialId", "Không tồn tại."));

// ✅ GOOD
var ids = dto.Lines.Select(l => l.MaterialId).Distinct().ToArray();
var existing = (await _materialRepo.Query(x => ids.Contains(x.Id))
    .AsNoTracking().Select(x => x.Id).ToListAsync(ct)).ToHashSet();

for (var i = 0; i < dto.Lines.Count; i++)
    if (!existing.Contains(dto.Lines[i].MaterialId))
        errors.Add(new ValidationError($"Lines[{i}].MaterialId", "Không tồn tại."));
```

## Audit checkpoints

- No `await` on a repository / gRPC client / cache inside a loop
- Related data loaded in one batched query and indexed into a dictionary or lookup
- gRPC skipped when the id list is empty; ids deduped and `Guid.Empty` filtered first
- `ToDictionary` only where the key is provably unique, otherwise `ToLookup`
- Batched id collections materialized with `.ToArray()`
