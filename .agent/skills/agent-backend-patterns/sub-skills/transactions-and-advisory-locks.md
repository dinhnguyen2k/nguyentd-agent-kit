# Transactions & Advisory Locks

Mandatory rule (`.agent/rules/backend.md` §5.1): **every multi-step write inside one service
must run in a transaction.** `IUnitOfWork` provides both a scoped helper and manual control.

## Preferred: `ExecuteInTransactionAsync`

Commits on success, rolls back on any exception. Use this unless you need finer control.

```csharp
public async Task<Result<GoodsIssueDto>> PostAsync(CreateGoodsIssueDto dto, CancellationToken ct)
{
    GoodsIssue created = null;

    await _unitOfWork.ExecuteInTransactionAsync(async () =>
    {
        created = _mapper.Map<GoodsIssue>(dto);
        await _repository.AddAsync(created);

        var movements = BuildMovements(created);
        await _movementRepo.AddRangeAsync(movements);

        await _ledgerService.ApplyAsync(movements, ct);   // same DbContext, same transaction

        await _unitOfWork.SaveChangesAsync(ct);
    });

    return Result<GoodsIssueDto>.Success(_mapper.Map<GoodsIssueDto>(created));
}
```

## Manual control

```csharp
await _unitOfWork.BeginTransactionAsync();
try
{
    // ... writes ...
    await _unitOfWork.SaveChangesAsync(ct);
    await _unitOfWork.CommitTransactionAsync();
}
catch
{
    await _unitOfWork.RollbackTransactionAsync();   // ✅ every failure path rolls back
    throw;                                          // ✅ never swallow
}
```

## ❌ Anti-patterns

```csharp
// ❌ two independent commits — first survives when the second fails
await _repository.AddAsync(order);
await _unitOfWork.SaveChangesAsync();
await _movementRepo.AddRangeAsync(movements);
await _unitOfWork.SaveChangesAsync();

// ❌ returning early inside the transaction delegate without failing it: work already
//    performed gets COMMITTED because no exception escaped
await _unitOfWork.ExecuteInTransactionAsync(async () =>
{
    await _repository.AddAsync(order);
    if (!IsValid(order)) return;              // ❌ commits a half-built order
    await _movementRepo.AddRangeAsync(movements);
    await _unitOfWork.SaveChangesAsync(ct);
});

// ❌ HTTP/gRPC/Kafka call inside a DB transaction: holds locks for a network round-trip,
//    and cannot be rolled back
await _unitOfWork.ExecuteInTransactionAsync(async () =>
{
    await _repository.AddAsync(order);
    await _unitOfWork.SaveChangesAsync(ct);
    await _grpcClient.ReserveStockAsync(request);   // ❌ needs compensation, not a transaction
});
```

To abort inside the delegate, **throw** (`InvalidOperationException` -> 400):

```csharp
await _unitOfWork.ExecuteInTransactionAsync(async () =>
{
    if (!IsValid(order))
        throw new InvalidOperationException("Chứng từ không hợp lệ.");   // ✅ rolls back
    // ...
});
```

Validate before opening the transaction whenever the check needs no transactional read — keep
the transaction as short as possible.

## Advisory locks for read-check-write races

Read Committed does not protect a "read current stock, check, then write" sequence: two
concurrent requests can both read the pre-write value, both pass the check, and together break
the invariant. `AcquireAdvisoryLockAsync` takes a Postgres transaction-scoped
`pg_advisory_xact_lock`, released automatically on commit or rollback.

```csharp
await _unitOfWork.ExecuteInTransactionAsync(async () =>
{
    // Lock in a FIXED order (sorted) so two calls over overlapping sets cannot deadlock.
    foreach (var modelId in modelIds.Distinct().OrderBy(id => id))
        await _unitOfWork.AcquireAdvisoryLockAsync(ToAdvisoryLockKey(modelId));

    var ledger = await TransactionRepo.Query()
        .Where(x => modelIds.Contains(x.ModelId))
        .ToListAsync(ct);

    // read-check-write is now serialized per model
    var onHand = Replay(ledger);
    if (onHand + delta < 0)
        throw new InvalidOperationException("Tồn kho không đủ.");

    await _repository.AddAsync(newMovement);
    await _unitOfWork.SaveChangesAsync(ct);
});
```

Requirements:

1. Must be called **inside** an active transaction — outside, the lock is released immediately.
2. Always acquire multiple locks in a deterministic order (sort the keys).
3. Derive the key deterministically from the business identity (e.g. a stable hash of the
   entity's `Guid`) so all call sites contend on the same key.

A unique index or a `CHECK` constraint is a cheaper guard when the invariant can be expressed
declaratively — prefer it.

## Concurrency conflicts

`DbUpdateConcurrencyException` maps to **409** with `"Dữ liệu đã bị thay đổi bởi người khác"`.
That is the correct outcome for optimistic concurrency; do not catch and downgrade it.

## Audit checkpoints

- Multi-step write is inside `ExecuteInTransactionAsync` or an explicit Begin/Commit/Rollback
- No early `return` inside a transaction delegate that leaves a partial write committed
- Every manual `catch` path calls `RollbackTransactionAsync` and rethrows
- No HTTP / gRPC / Kafka call inside a DB transaction (use compensation or outbox)
- Read-check-write on money / stock / permissions guarded by an advisory lock or a DB constraint
- Multiple advisory locks acquired in sorted order
- One `SaveChangesAsync` per transaction boundary where possible
