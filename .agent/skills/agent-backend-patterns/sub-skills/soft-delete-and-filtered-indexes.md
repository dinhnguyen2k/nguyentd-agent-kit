# Soft Delete & Filtered Indexes

Rows are never physically removed on the normal delete path. `EntityAuditBase<T>` carries
`DeletedDate` (`DateTimeOffset?`) and `Delete()` stamps `DateTimeOffset.UtcNow`.

```csharp
public abstract record EntityAuditBase<T> : EntityBase<T>, IAuditable
{
    public DateTimeOffset CreatedDate { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? LastModifiedDate { get; set; }
    public DateTimeOffset? DeletedDate { get; set; }
    public Guid? CreatedById { get; set; }
    public string CreatedByUser { get; set; } = string.Empty;
    public string ModifiedByUser { get; set; } = string.Empty;
    public void Delete() => DeletedDate = DateTimeOffset.UtcNow;
}
```

## Entity configuration: both pieces are required

The convention in this repo is a **global query filter** plus a **filtered unique index**.
Nearly every existing configuration has both — a new one that omits either is a defect.

```csharp
public class PaymentRequestConfiguration : IEntityTypeConfiguration<PaymentRequest>
{
    public void Configure(EntityTypeBuilder<PaymentRequest> builder)
    {
        builder.ToTable("payment_request");
        builder.HasKey(x => x.Id);

        // 1) exclude soft-deleted rows from every query by default
        builder.HasQueryFilter(x => !x.DeletedDate.HasValue);

        // 2) uniqueness that ignores soft-deleted rows
        builder.HasIndex(x => x.Code)
            .IsUnique()
            .HasFilter("\"deleted_date\" IS NULL");

        builder.Property(x => x.Code).IsRequired().HasMaxLength(50);
    }
}
```

## Why the index filter is not optional

```
Without .HasFilter("\"deleted_date\" IS NULL"):
  create "PR-001"  -> ok
  delete "PR-001"  -> row stays, deleted_date set
  create "PR-001"  -> ❌ unique violation on a code the user can no longer see
```

The column name inside `HasFilter` is **raw SQL**: use the snake_case physical name with escaped
double quotes (`"deleted_date"`), not the CLR property name.

## Composite uniqueness

```csharp
builder.HasIndex(x => new { x.WarehouseId, x.MaterialId })
    .IsUnique()
    .HasFilter("\"deleted_date\" IS NULL");
```

## Querying

With the global filter in place, ordinary queries are already scoped:

```csharp
var rows = await _repository.Query().AsNoTracking().ToListAsync(ct);   // excludes deleted
```

An explicit `x.DeletedDate == null` is redundant but harmless — and it is the safe habit when
you have not verified the entity's configuration. What is **not** safe is assuming a filter
exists: check the entity's `IEntityTypeConfiguration` before relying on it.

To include deleted rows deliberately (restore flows, audit reports):

```csharp
var withDeleted = await _repository.Query()
    .IgnoreQueryFilters()
    .Where(x => x.Code == code)
    .AsNoTracking()
    .ToListAsync(ct);
```

Note that `IgnoreQueryFilters()` disables filters for the **whole** query, including navigations.

## Filters and navigations

EF applies the query filter to `Include`d collections as well, so soft-deleted children
disappear from a parent graph automatically. A required navigation to a filtered entity can make
a parent row unreachable — if a child is soft-deleted and the parent's `Include` is required,
verify the parent still loads.

## Raw SQL and bulk operations bypass the filter

`ExecuteUpdate` / `ExecuteDelete` / `BulkUpdateAsync` and `FromSql` do **not** apply the global
filter. Restate the predicate:

```csharp
await _repository.BulkUpdateAsync(
    x => x.WarehouseId == warehouseId && x.DeletedDate == null,   // ✅ explicit
    setters => setters.SetProperty(x => x.Status, EStatus.Inactive));
```

## Cascade behaviour

`OnDelete(DeleteBehavior.Cascade)` only fires on a hard delete. Soft-deleting a parent leaves
children live — cascade the soft delete explicitly in `BeforeDeleteAsync`, loading the children
via `GetDeleteIncludeString()`.

```csharp
protected override string GetDeleteIncludeString() => "Details";

protected override async Task BeforeDeleteAsync(PaymentRequest entity)
{
    foreach (var detail in entity.Details)
        detail.Delete();
    await Task.CompletedTask;   // saved by the base pipeline
}
```

## Audit checkpoints

- New entity config declares `HasQueryFilter(x => !x.DeletedDate.HasValue)`
- Every unique index carries `.HasFilter("\"deleted_date\" IS NULL")` with the snake_case column
- Bulk / raw-SQL paths restate the `DeletedDate == null` predicate
- Soft-deleting a parent also soft-deletes children that must not survive it
- `IgnoreQueryFilters()` appears only in deliberate restore / audit queries
- Migration generated for the index change and reviewed
