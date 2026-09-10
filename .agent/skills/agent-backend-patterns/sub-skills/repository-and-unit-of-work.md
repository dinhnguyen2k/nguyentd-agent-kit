# Repository & Unit of Work

`IBaseRepository<TEntity>` and `IUnitOfWork` live in `Contracts.Domain.Interfaces`;
`BaseRepository<TEntity>` and each service's `UnitOfWork` implement them. Do not write a new
generic repository — extend the existing one.

## What `IBaseRepository<TEntity>` already gives you

```csharp
Task<TEntity> GetByIdAsync(Guid id);
Task<TEntity> GetByIdAsync(Guid id, string includeString = "");
Task<TEntity> AddAsync(TEntity entity);
Task<IEnumerable<TEntity>> AddRangeAsync(IEnumerable<TEntity> entities);
Task<TEntity> UpdateAsync(TEntity entity);
Task DeleteAsync(Guid id);                       // soft delete via DeletedDate
Task<bool> ExistsAsync(Expression<Func<TEntity, bool>> predicate);
IQueryable<TEntity> Query();                     // compose further, then materialize
IQueryable<TEntity> Query(Expression<Func<TEntity, bool>> predicate);
IQueryable<TEntity> QueryWithIncludes(Expression<Func<TEntity, bool>> predicate, string includeString = "");
Task<TEntity> FirstOrDefaultAsync(Expression<Func<TEntity, bool>> predicate);
Task<List<TEntity>> WhereAsync(Expression<Func<TEntity, bool>> predicate);
Task<(IEnumerable<TEntity> Data, int TotalCount)> GetPagedAsync(int pageNumber, int pageSize, ...);
Task<int> CountAsync(Expression<Func<TEntity, bool>> predicate = null);
Task<int> BulkUpdateAsync(predicate, setPropertyCalls);   // ExecuteUpdate, no tracking
```

## Getting a repository

```csharp
public class AssetUnitService(IUnitOfWork unitOfWork, /* ... */)
{
    private readonly IBaseRepository<AssetUnit> _assetRepo = unitOfWork.GetRepository<AssetUnit>();
    private readonly IBaseRepository<Warehouse> _warehouseRepo = unitOfWork.GetRepository<Warehouse>();
}
```

Inside a `BaseService` subclass, `_repository` (for `TEntity`) and `_unitOfWork` are already
available — do not re-resolve them.

## Save exactly once per logical operation

All repositories from one `IUnitOfWork` share a `DbContext`, so one `SaveChangesAsync` commits
every change together.

```csharp
// ✅ GOOD — one save, one implicit transaction
await _assetRepo.AddAsync(asset);
await _movementRepo.AddRangeAsync(movements);
await _unitOfWork.SaveChangesAsync(cancellationToken);
```

```csharp
// ❌ BAD — two saves: the first can commit while the second fails, leaving orphans
await _assetRepo.AddAsync(asset);
await _unitOfWork.SaveChangesAsync();
await _movementRepo.AddRangeAsync(movements);
await _unitOfWork.SaveChangesAsync();
```

If the steps must interleave with reads or external calls, wrap them —
see [Transactions & Advisory Locks](./transactions-and-advisory-locks.md).

## `Query()` for anything non-trivial

`Query()` returns `IQueryable`, so filtering, projection and paging translate to SQL.

```csharp
// ✅ GOOD — filter + project in the database
var rows = await _assetRepo.Query(x => x.DeletedDate == null && x.WarehouseId == warehouseId)
    .AsNoTracking()
    .OrderByDescending(x => x.CreatedDate)
    .Select(x => new AssetUnitListDto(x.Id, x.Code, x.Name, x.PurchaseCost))
    .Take(50)
    .ToListAsync(cancellationToken);

// ❌ BAD — pulls every row and filters in memory
var all = await _assetRepo.GetAllAsync();
var rows = all.Where(x => x.WarehouseId == warehouseId).Take(50).ToList();
```

## Bulk updates without loading entities

```csharp
// ✅ One UPDATE statement, no change tracking, no N round-trips
await _assetRepo.BulkUpdateAsync(
    x => x.WarehouseId == warehouseId && x.DeletedDate == null,
    setters => setters
        .SetProperty(x => x.Status, EStatus.Inactive)
        .SetProperty(x => x.LastModifiedDate, DateTimeOffset.UtcNow));
```

`BulkUpdateAsync` bypasses the change tracker: it will not fire audit-field logic or
`SaveChangesAsync` interceptors. Use it for mechanical mass updates, not for
audit-relevant business writes.

## Bulk insert hygiene

```csharp
_unitOfWork.SetAutoDetectChanges(false);
try
{
    foreach (var chunk in entities.Chunk(1_000))
    {
        await _repository.AddRangeAsync(chunk);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        _unitOfWork.ClearChangeTracker();   // prevents O(n²) tracker growth
    }
}
finally
{
    _unitOfWork.SetAutoDetectChanges(true); // must always be restored
}
```

## Custom repositories

Add a service-specific repository only when the query genuinely cannot be expressed through
`Query()` — raw SQL, a window function, a recursive CTE. Then it belongs in
`<Service>.Repositories` behind a named interface, not inline in the service.

## Audit checkpoints

- One `SaveChangesAsync` per logical operation; multi-step writes are transactional
- No `GetAllAsync()` followed by in-memory `Where` / `Take`
- Read paths use `.AsNoTracking()` and project to DTOs
- `SetAutoDetectChanges(false)` is always paired with a `finally` restore
- New repository interfaces justified by a query `Query()` cannot express
