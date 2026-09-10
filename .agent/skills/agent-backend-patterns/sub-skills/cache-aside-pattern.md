# Cache-Aside Pattern

Read from cache; on a miss, read the source of truth, populate the cache, return. The
application owns the cache — Redis is never the source of truth.

## Baseline

```csharp
public async Task<Result<AssetUnitDto>> GetCachedAsync(Guid id, CancellationToken ct)
{
    var cached = await _cache.GetAsync(id);
    if (cached is not null)
        return Result<AssetUnitDto>.Success(cached);

    var entity = await _repository.Query(x => x.Id == id)
        .AsNoTracking()
        .FirstOrDefaultAsync(ct);

    if (entity is null)
        return Result<AssetUnitDto>.NotFound($"Không tìm thấy tài sản {id}.");   // ✅ don't cache misses

    var dto = _mapper.Map<AssetUnitDto>(entity);
    await _cache.SetAsync(id, dto);
    return Result<AssetUnitDto>.Success(dto);
}
```

Caching "not found" turns a transient state into a lasting one; if you must (to absorb a hot
scan of invalid ids), use a much shorter TTL and a distinct sentinel.

## Stampede protection

On a cold or evicted key, every concurrent request misses and hits the database at once.
`PermissionCacheService` guards this with a per-key `SemaphoreSlim` held in a
`ConcurrentDictionary` — apply the same shape for expensive loads.

```csharp
private static readonly ConcurrentDictionary<string, SemaphoreSlim> _semaphores = new();

private async Task<AssetUnitDto?> LoadWithSingleFlightAsync(Guid id, CancellationToken ct)
{
    var key = AssetCacheKeys.ForUnit(id);

    var gate = _semaphores.GetOrAdd(key, _ => new SemaphoreSlim(1, 1));
    await gate.WaitAsync(ct);
    try
    {
        // double-check: another caller may have populated it while we waited
        var cached = await _cache.GetAsync(id);
        if (cached is not null)
            return cached;

        var entity = await _repository.Query(x => x.Id == id).AsNoTracking().FirstOrDefaultAsync(ct);
        if (entity is null)
            return null;

        var dto = _mapper.Map<AssetUnitDto>(entity);
        await _cache.SetAsync(id, dto);
        return dto;
    }
    finally
    {
        gate.Release();   // ✅ always release
    }
}
```

Two caveats:

1. The semaphore is **per process** — with N service instances you get N concurrent loads, not
   one. That is usually enough; if it is not, you need a Redis lock.
2. The dictionary grows with the key space. Bound it (keys of low cardinality only) or evict.

## Cache invalidation, not cache mutation

```csharp
// ✅ GOOD — delete the key; the next read repopulates from the DB
await _cache.InvalidateAsync(id);

// ❌ BAD — write-through into the cache before/without the DB commit succeeding:
//    if the transaction rolls back the cache now holds data that never existed
await _cache.SetAsync(id, updatedDto);
await _unitOfWork.SaveChangesAsync(ct);
```

Invalidate **after** the commit, not inside the transaction:

```csharp
await _unitOfWork.ExecuteInTransactionAsync(async () =>
{
    await _repository.UpdateAsync(entity);
    await _unitOfWork.SaveChangesAsync(ct);
});

await _cache.InvalidateAsync(entity.Id);   // ✅ after commit
```

Inside the transaction you would evict on a path that may still roll back, and a concurrent
reader could repopulate the key with pre-commit data.

## Read-your-own-write

Right after a write, a cached read can still serve the old value to the same user. If the flow
requires the user to see their change immediately, bypass the cache for that read rather than
tightening the TTL.

## Caching lists

List keys are invalidated by *any* member changing, which is easy to get wrong. Prefer caching
individual entities plus a cached list of **ids**, or don't cache the list at all. If you do
cache a list, enumerate the write paths that must invalidate it in a comment.

## When not to cache

Measure first. A well-indexed single-row Postgres lookup is often faster than a Redis
round-trip plus JSON deserialization. Cache when the source is genuinely expensive (aggregations,
cross-service gRPC fan-out, permission snapshots), not by default.

## Audit checkpoints

- Cache is populated after a miss, never treated as the source of truth
- Misses (`null` / not-found) are not cached, or use a distinct short TTL
- Invalidation happens after commit, and covers every write path
- Expensive loads have single-flight protection; every `WaitAsync` has a `finally` release
- List caches document their invalidation triggers
- Caching justified by cost, not added reflexively
