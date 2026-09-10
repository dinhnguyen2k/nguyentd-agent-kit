# Cross-Service Compensation

A DB transaction cannot roll back a gRPC call or a Kafka publish. Any flow that writes locally
**and** remotely must declare its consistency model (`.agent/rules/backend.md` §5.2):

| Model | When | Mechanism |
| --- | --- | --- |
| Strong consistency | The remote write must not survive a local failure | Compensation (undo the remote call) |
| Eventual consistency | The remote side may lag | Outbox / inbox + `IEventBus` |
| Long-running workflow | Multiple services, multiple steps, human steps | Saga |

Pick one explicitly and say so in the code comment — "we did not think about it" is the defect
this rule exists to prevent.

## The failure both orderings create

```
remote first -> local second:   remote succeeded, local rolled back  => orphaned remote state
local first  -> remote second:  local committed, remote failed       => local row referencing nothing
```

Both need a plan. Neither is safe by default.

## Existing infrastructure: `IWorkItemLifecycleService`

WorkItem side effects already have a compensation scope. Use it rather than hand-rolling.

```csharp
public interface IWorkItemCompensationScope
{
    void TrackCreated(Guid workItemId);                     // undo = delete it
    void TrackUpdated(UpdateWorkItemRequest rollbackRequest); // undo = re-apply the old state
    Task RollbackAsync();
}
```

`ExecuteCompensatedTransactionAsync` runs the local transaction and, on failure, **rolls back
locally first, then replays the tracked remote undos**:

```csharp
return await _workItemLifecycleService.ExecuteCompensatedTransactionAsync(
    $"{nameof(MechanicalPackingListService)}.{nameof(ImportFromExcel)}",
    async compensationScope =>
    {
        foreach (var dto in importDtos)
        {
            await repo.UpdateAsync(existing);

            // the scope records the undo for this remote mutation
            var updateResult = await _workItemLifecycleService.UpdateWorkItemAsync(
                BuildUpdateWorkItemRequest(existing),
                compensationScope,
                rollbackRequest);

            if (!updateResult.IsSuccess)
                return Result.Failure($"Lỗi khi cập nhật WorkItem [{dto.FinishedGoodsCode}]: {updateResult.Message}");
        }

        await _unitOfWork.SaveChangesAsync();
        return Result.Success();
    });
```

For a single create, `CreateWithWorkItemAsync(..., useTransaction: true)` handles the whole
pattern. In a batch, pass `useTransaction: false` **and** the caller's `compensationScope` — the
outer scope owns the transaction.

## Hand-rolled compensation

When no helper exists, the shape is: do the local work, commit, then attempt the remote call; on
remote failure, undo locally. Or do the remote work first and track an explicit undo.

```csharp
// ✅ local first, remote second, local undo on remote failure
await _unitOfWork.ExecuteInTransactionAsync(async () =>
{
    await _repository.AddAsync(reservation);
    await _unitOfWork.SaveChangesAsync(ct);
});

try
{
    await _inventoryGrpcClient.ReserveStockAsync(request, cancellationToken: ct);
}
catch (RpcException ex)
{
    _logger.Error(ex, "Remote reservation failed, compensating local reservation {ReservationId}",
        reservation.Id);

    await _unitOfWork.ExecuteInTransactionAsync(async () =>
    {
        reservation.Delete();                       // compensating write
        await _repository.UpdateAsync(reservation);
        await _unitOfWork.SaveChangesAsync(ct);
    });

    throw new InvalidOperationException("Không thể giữ tồn kho, vui lòng thử lại.");  // ✅ rethrow
}
```

Rules for a compensating handler:

1. **Log before compensating** — with the ids needed to fix it by hand if compensation also fails.
2. **Rethrow after compensating.** Silently returning success is the worst outcome.
3. Make the compensation **idempotent** — it may run twice.
4. If compensation itself fails, log at `Error` with every identifier; that is a manual-repair
   ticket, not a swallowed error.

## Delete flows

```csharp
// remote first -> local second: local failure leaves the remote object deleted forever
//   => compensation must be able to recreate it, or use the other ordering
// local first  -> remote second: remote failure leaves an orphan
//   => retry, or record it for a reconciliation job
```

Pick the ordering whose failure mode you can actually repair, and comment why.

## Batch / import compensation

If remote calls happen per row **before** the local commit, a commit failure orphans every
remote object created in that batch. Either:

- run the whole batch inside one compensation scope (as above), or
- commit locally per chunk so the blast radius is one chunk.

## Eventual consistency with `IEventBus`

```csharp
public interface IEventBus
{
    Task PublishAsync<TEvent>(string topic, TEvent @event, CancellationToken cancellationToken = default)
        where TEvent : IntegrationEvent;
}
```

Publishing **inside** a DB transaction is unsafe: the message can be delivered while the
transaction rolls back. Publish after the commit, and accept that a crash between commit and
publish loses the message unless you persist it first (outbox).

```csharp
await _unitOfWork.ExecuteInTransactionAsync(async () =>
{
    await _repository.AddAsync(order);
    await _unitOfWork.SaveChangesAsync(ct);
});

// after commit — consumers must be idempotent
await _eventBus.PublishAsync("erp.order.created", new OrderCreatedEvent(order.Id), ct);
```

Consumers must tolerate duplicates and out-of-order delivery: key on the business id, not on
arrival order.

## Audit checkpoints

- Every local+remote write flow names its model (compensation / outbox / saga) in a comment
- Remote calls inside a batch are tracked in a compensation scope
- Compensating handlers log with identifiers, are idempotent, and rethrow
- No `IEventBus.PublishAsync` inside a DB transaction
- Event consumers are idempotent
- Delete flows state the ordering and the repair path for the failure mode
