# Redis Cache Layer

Redis is accessed through `StackExchange.Redis` — `IDatabase` for data operations,
`IConnectionMultiplexer` when you need server-level features (pub/sub, key scan). Both are
resolved from DI; never construct a connection yourself (the multiplexer is expensive and
designed to be shared).

## Key convention

Environment-scoped, colon-separated, prefixed with `Cogain/`. Existing examples:

```
Cogain/CurrentUser:{env}:employee:{employeeId}
Cogain/permission:{env}:{applicationId}:{employeeId}
```

Centralize key construction in a static class so producers and invalidators cannot drift:

```csharp
public static class AssetCacheKeys
{
    private const string Prefix = "Cogain/asset";

    private static string Env =>
        Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Production";

    public static string ForUnit(Guid assetUnitId) => $"{Prefix}:{Env}:unit:{assetUnitId}";
    public static string ForWarehouseList(Guid warehouseId) => $"{Prefix}:{Env}:warehouse:{warehouseId}:units";
}
```

Missing the environment segment means staging and production share keys — treat it as a defect.

## A cache service, shaped like the ones that exist

```csharp
public class AssetUnitCacheService(IDatabase database, ILogger logger) : IAssetUnitCacheService
{
    private static readonly TimeSpan CacheDuration = TimeSpan.FromMinutes(30);

    public async Task<AssetUnitDto?> GetAsync(Guid id)
    {
        try
        {
            var cached = await database.StringGetAsync(AssetCacheKeys.ForUnit(id));
            if (cached.IsNullOrEmpty)
            {
                logger.Debug("AssetUnitCache MISS: key={Key}", AssetCacheKeys.ForUnit(id));
                return null;
            }

            return JsonSerializer.Deserialize<AssetUnitDto>(cached!);
        }
        catch (Exception ex)
        {
            // ✅ cache failure must not fail the request — degrade to the source of truth
            logger.Error(ex, "Error reading asset unit cache: {AssetUnitId}", id);
            return null;
        }
    }

    public async Task SetAsync(Guid id, AssetUnitDto dto)
    {
        try
        {
            await database.StringSetAsync(
                AssetCacheKeys.ForUnit(id),
                JsonSerializer.Serialize(dto),
                CacheDuration);                   // ✅ TTL always set
        }
        catch (Exception ex)
        {
            logger.Error(ex, "Error writing asset unit cache: {AssetUnitId}", id);
        }
    }

    public async Task InvalidateAsync(Guid id)
    {
        try
        {
            await database.KeyDeleteAsync(AssetCacheKeys.ForUnit(id));
            logger.Information("Invalidated asset unit cache: {AssetUnitId}", id);
        }
        catch (Exception ex)
        {
            logger.Error(ex, "Error invalidating asset unit cache: {AssetUnitId}", id);
        }
    }
}
```

Note the asymmetry that is intentional: read/write failures are swallowed (after logging)
because a cache outage must not take the feature down; a *stale* cache after a successful write
is a correctness bug, so invalidation failures must be loud.

## TTL is mandatory

```csharp
await database.StringSetAsync(key, json, TimeSpan.FromMinutes(30));   // ✅
await database.StringSetAsync(key, json);                             // ❌ never expires
```

Without a TTL, a missed invalidation is permanent. The TTL is the backstop, not the plan.

## Invalidate on every write path

```csharp
protected override async Task AfterUpdateAsync(Guid id, AssetUnitUpsertDto dto, AssetUnitDto result)
{
    await _cache.InvalidateAsync(id);            // update
}

protected override async Task BeforeDeleteAsync(AssetUnit entity)
{
    await _cache.InvalidateAsync(entity.Id);     // delete
}
```

Every cached read needs a matching invalidation on **create, update, delete, import, and bulk
update**. `BulkUpdateAsync` bypasses hooks — invalidate explicitly after it.

## Never cache authorization decisions ad hoc

Permission and user-status caching already exist (`PermissionCacheService`,
`UserStatusCacheService`, `LogoutCacheInvalidationService`) and are invalidated on logout and on
`PermissionChangedEvent`. Do not add a second permission cache — a stale one grants access after
a revoke.

## What not to cache

- Anything the caller is authorized to see differently (per-user data under a shared key)
- Values that must be transactionally consistent with a write you just made
- Large collections that change constantly (churn costs more than the hit saves)

## Batch reads

```csharp
// ✅ one round-trip
RedisKey[] keys = ids.Select(id => (RedisKey)AssetCacheKeys.ForUnit(id)).ToArray();
var values = await database.StringGetAsync(keys);   // positional results
```

## `KEYS` / `SCAN`

Scanning is O(keyspace) and blocks. `PermissionCacheService` uses a scan only as a documented
fallback when the key set is unknown. Prefer maintaining an index set (`SADD`) over scanning.

## Audit checkpoints

- Keys built through a shared helper and include the environment segment
- Every `StringSetAsync` passes a TTL
- Read/write failures logged and degraded; invalidation failures surfaced
- Every write path (including bulk and import) invalidates
- No new permission / authorization cache
- No `KEYS` in a request path
