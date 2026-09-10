# EF Core Query Optimization

EF Core 8 on PostgreSQL (Npgsql). These rules are mandatory (`.agent/rules/backend.md` §4).

## `AsNoTracking()` on read paths

Tracking allocates a snapshot per entity and makes `SaveChanges` scan them. Read-only queries
over anything beyond a handful of rows must opt out.

```csharp
// ✅ GOOD
var rows = await _repository.Query(x => x.DeletedDate == null)
    .AsNoTracking()
    .Where(x => x.WarehouseId == warehouseId)
    .ToListAsync(cancellationToken);
```

Do **not** use `AsNoTracking()` on entities you intend to modify — the change tracker will not
see the edits and `SaveChangesAsync` will silently do nothing.

## Project, don't materialize

```csharp
// ✅ GOOD — SELECT of 4 columns
var list = await _repository.Query(x => x.DeletedDate == null)
    .AsNoTracking()
    .Select(x => new AssetUnitListDto
    {
        Id = x.Id,
        Code = x.Code,
        Name = x.Name,
        WarehouseName = x.Warehouse.Name      // translated to a JOIN, no Include needed
    })
    .ToListAsync(cancellationToken);

// ❌ BAD — SELECT *, plus every Include's columns, then maps in memory
var entities = await _repository.QueryWithIncludes(x => x.DeletedDate == null, "Warehouse,Asset,Lines")
    .ToListAsync(cancellationToken);
var list = _mapper.Map<List<AssetUnitListDto>>(entities);
```

Reach for `Include` only when you need whole entities (a write path, or a DTO that genuinely
maps a full graph).

## Large `IN` sets

Materialize the collection to an **array** — Npgsql translates
`array.Contains(x.Id)` into a single `= ANY(@p)` parameter instead of N inlined constants,
so the plan is cached and the statement stays small.

```csharp
// ✅ GOOD
var ids = dto.Lines.Select(l => l.MaterialId).Distinct().ToArray();
var materials = await _materialRepo.Query(x => ids.Contains(x.Id))
    .AsNoTracking()
    .ToListAsync(cancellationToken);

// ❌ BAD — List<Guid> of 5,000 items expanded into the SQL text
var idList = dto.Lines.Select(l => l.MaterialId).ToList();
var materials = await _materialRepo.Query(x => idList.Contains(x.Id)).ToListAsync();
```

## Filter before you page, page in the database

```csharp
// ✅ GOOD — OFFSET/LIMIT in SQL, count in SQL
var (data, total) = await _repository.GetPagedAsync(
    parameters.PageNumber, parameters.PageSize,
    x => x.DeletedDate == null && x.Status == EStatus.Active);

// ❌ BAD — loads the table, pages in memory
var all = await _repository.GetAllAsync();
var page = all.Skip((page - 1) * size).Take(size).ToList();
```

An `OrderBy` is required for stable paging — unordered `OFFSET` may repeat or skip rows.

## Aggregate in the database

```csharp
// ✅ GOOD
var total = await _repository.Query(x => x.WarehouseId == id && x.DeletedDate == null)
    .SumAsync(x => x.PurchaseCost, cancellationToken);

// ❌ BAD — transfers every row to sum locally
var total = (await _repository.WhereAsync(x => x.WarehouseId == id)).Sum(x => x.PurchaseCost);
```

Same for `AnyAsync` over `Count() > 0`, and `ExistsAsync` over loading the entity.

## LINQ hygiene (in-memory phase)

```csharp
// ✅ O(1) lookups
var allowedIds = permissions.Select(p => p.WarehouseId).ToHashSet();
var visible = rows.Where(r => allowedIds.Contains(r.WarehouseId)).ToList();

// ❌ O(n·m)
var allowedIds = permissions.Select(p => p.WarehouseId).Distinct().ToList();

// ✅ dedupe + drop empties on the value type BEFORE ToString() — avoids throwaway strings
var idStrings = ids.Where(id => id != Guid.Empty).Distinct().Select(id => id.ToString()).ToArray();

// ❌ allocates a string per duplicate, then dedupes strings
var idStrings = ids.Select(id => id.ToString()).Distinct().ToArray();
```

Enumerate once: assign `.ToList()` / `.ToArray()` rather than re-running a LINQ chain in a loop.

## `CancellationToken` everywhere

```csharp
// ✅ GOOD — client disconnect aborts the query
public async Task<Result<IEnumerable<AssetUnitDto>>> SearchAsync(string term, CancellationToken cancellationToken)
{
    var rows = await _repository.Query(x => x.Code.Contains(term))
        .AsNoTracking()
        .ToListAsync(cancellationToken);
    // ...
}
```

Accept a token in every new async service method and pass it to every EF, Redis and gRPC call.

## Split queries for wide graphs

One `Include` of a collection multiplies rows (cartesian explosion). When including two or more
collections:

```csharp
var order = await _repository.Query(x => x.Id == id)
    .Include(x => x.Lines)
    .Include(x => x.Attachments)
    .AsSplitQuery()
    .FirstOrDefaultAsync(cancellationToken);
```

## Audit checkpoints

- Read-only queries: `.AsNoTracking()` + projection
- No `GetAllAsync()` / `ToListAsync()` followed by in-memory filtering, paging or aggregation
- `Contains` over a materialized `.ToArray()`
- Paged queries carry a deterministic `OrderBy`
- `CancellationToken` accepted and forwarded on every new async path
- Multi-collection `Include` uses `AsSplitQuery()`
