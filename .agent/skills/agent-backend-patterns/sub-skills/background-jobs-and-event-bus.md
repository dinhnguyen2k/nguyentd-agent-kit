# Background Jobs & Event Bus

Two mechanisms exist. Pick by ownership: work that belongs to **this** service goes in a hosted
service; work another service must react to goes on the **event bus**.

## Never fire-and-forget

```csharp
// ❌ BAD — unobserved task: exceptions vanish, work dies on shutdown or a recycle,
//    and the DI scope (DbContext!) is disposed underneath it
_ = Task.Run(async () => await ReindexAsync(id));
Task.Run(() => SendEmailAsync(dto));      // same problem, plus no await
```

An `async void` handler is the same defect with a different shape.

## Hosted services

`BackgroundService` for startup or periodic work owned by the service —
`CodeGenerationRegistrar` is the in-repo example (it rebuilds Redis code-generation metadata at
startup).

```csharp
builder.Services.AddHostedService(sp => new CodeGenerationRegistrar(
    sp.GetRequiredService<IConnectionMultiplexer>(),
    "ERP"));
```

Periodic work, with the two things that are always forgotten — a scope per iteration, and a
try/catch so one failure does not kill the loop:

```csharp
public class DepreciationPostingWorker(IServiceScopeFactory scopeFactory, ILogger logger)
    : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromHours(1);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(Interval);

        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                // ✅ a fresh scope per iteration — DbContext is scoped, never captured
                using var scope = scopeFactory.CreateScope();
                var service = scope.ServiceProvider.GetRequiredService<IAssetDepreciationService>();
                await service.PostDueAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;                                  // ✅ shutdown, not a failure
            }
            catch (Exception ex)
            {
                logger.Error(ex, "Depreciation posting iteration failed");   // ✅ loop survives
            }
        }
    }
}
```

Rules:

1. Never inject a scoped service (`IUnitOfWork`, `DbContext`, any `*Service`) into a
   `BackgroundService` constructor — it is a singleton. Use `IServiceScopeFactory`.
2. Honour `stoppingToken` everywhere so shutdown is not blocked.
3. Wrap each iteration; an unhandled exception in `ExecuteAsync` ends the service silently.
4. With N replicas the job runs N times — guard with a Redis lock or make it idempotent.

## Integration events

```csharp
public interface IEventBus
{
    Task PublishAsync<TEvent>(string topic, TEvent @event, CancellationToken cancellationToken = default)
        where TEvent : IntegrationEvent;
}

public abstract record IntegrationEvent
{
    public Guid EventId { get; init; } = Guid.NewGuid();
    public DateTimeOffset OccurredOn { get; init; } = DateTimeOffset.UtcNow;
    public string CorrelationId { get; init; }
    public int Version { get; init; } = 1;
    public string EntityName { get; set; }
    public string Action { get; set; }
}
```

Implementations: `KafkaEventBus` (Confluent producer, keyed by `EventId`) and
`MassTransitEventBus`. `_eventBus` is already available inside `BaseService`.

### Publish after commit

```csharp
await _unitOfWork.ExecuteInTransactionAsync(async () =>
{
    await _repository.AddAsync(order);
    await _unitOfWork.SaveChangesAsync(ct);
});

// ✅ after commit — publishing inside the transaction can emit an event for a rolled-back write
await _eventBus.PublishAsync("erp.order.created", new OrderCreatedEvent
{
    EntityName = nameof(Order),
    Action = "Created",
    OrderId = order.Id
}, ct);
```

A crash between commit and publish loses the event. If the consumer must not miss it, persist an
outbox row inside the transaction and publish from a worker
(see [Cross-Service Compensation](./cross-service-compensation.md)).

`Version` exists so consumers can evolve: add fields, bump `Version`, and keep old consumers
working. Do not repurpose an existing field's meaning.

## Consumers must be idempotent

At-least-once delivery means duplicates and retries are normal.

```csharp
public class EmployeeSyncBaseConsumer<TEntity>(
    IBaseRepository<TEntity> repository, IUnitOfWork unitOfWork, IMapper mapper, ILogger logger)
    : IConsumer<EmployeeMessage>
    where TEntity : class
{
    public virtual async Task Consume(ConsumeContext<EmployeeMessage> context)
    {
        var message = context.Message;

        // ✅ upsert keyed on the business id — replaying the message is harmless
        var entity = await repository.GetByIdAsync(message.Id);
        if (entity is not null)
        {
            mapper.Map(message, entity);
            await repository.UpdateAsync(entity);
        }
        else
        {
            await repository.AddAsync(mapper.Map<TEntity>(message));
        }

        await unitOfWork.SaveChangesAsync();
    }
}
```

Do not swallow exceptions in a consumer to "avoid a redelivery loop" — that silently drops data.
Let it fail and rely on the broker's retry/dead-letter handling, and log with the message id.

## Choosing

| Need | Mechanism |
| --- | --- |
| Periodic / startup work owned by this service | `BackgroundService` |
| Long request-time work the user should not wait for | Publish an event, consume it out of band |
| Another service must react to a state change | `IEventBus` + consumer |
| Strict ordering / exactly-once | Neither — design for idempotency instead |

## Audit checkpoints

- No `Task.Run` / `async void` fire-and-forget for real work
- `BackgroundService` resolves scoped services via `IServiceScopeFactory`, one scope per iteration
- Each iteration is exception-wrapped and honours `stoppingToken`
- Multi-replica jobs are idempotent or lock-guarded
- Events published after commit, never inside the transaction
- Consumers are idempotent, keyed on the business id, and do not swallow failures
