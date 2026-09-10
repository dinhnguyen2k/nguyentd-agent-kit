# Resilience & Retry

## Current state (be accurate about this)

- **Gateway**: `OcelotApiGw` registers `.AddPolly()`, so retry / circuit-breaker behaviour is
  configured declaratively per route in `ocelot.json` (`QoSOptions`).
- **Services**: gRPC clients are registered plainly — address only, no retry policy and
  **no deadline**:

```csharp
builder.Services.AddGrpcClient<MasterDataInfoGrpc.MasterDataInfoGrpcClient>(o =>
{
    o.Address = new Uri(builder.Configuration["Services:MasterData:Grpc"]!);
});
```

So a slow downstream service currently blocks the caller for as long as the connection lives.
Adding a deadline is the single highest-value resilience change on any new call path.

## Set a deadline on every gRPC call

```csharp
var response = await _masterDataGrpcClient.GetAssetsByIdsAsync(
    request,
    deadline: DateTime.UtcNow.AddSeconds(5),      // ✅ bounded wait
    cancellationToken: cancellationToken);        // ✅ propagate caller cancellation
```

A blown deadline surfaces as `RpcException` with `StatusCode.DeadlineExceeded`. Handle it — do
not let it become an unmapped 500.

```csharp
try
{
    var response = await _masterDataGrpcClient.GetAssetsByIdsAsync(
        request, deadline: DateTime.UtcNow.AddSeconds(5), cancellationToken: ct);
    return response.Assets.ToDictionary(a => Guid.Parse(a.Id), a => a);
}
catch (RpcException ex) when (ex.StatusCode is StatusCode.DeadlineExceeded or StatusCode.Unavailable)
{
    _logger.Error(ex, "MasterData gRPC unavailable for {Count} asset ids, status {Status}",
        ids.Length, ex.StatusCode);
    throw new InvalidOperationException("Không kết nối được dịch vụ danh mục, vui lòng thử lại.");
}
```

## Retry only what is safe to repeat

| Operation | Retry? |
| --- | --- |
| Read (`Get*`, query, cache read) | ✅ yes — idempotent |
| Create without an idempotency key | ❌ no — may duplicate |
| Update setting absolute values | ✅ usually — idempotent |
| Increment / append / "add movement" | ❌ no — repeats the effect |
| Delete | ✅ yes — usually idempotent |

Retry only `Unavailable`, `DeadlineExceeded`, `ResourceExhausted`, `Internal`, and transient
network failures. Never retry `InvalidArgument`, `NotFound`, `PermissionDenied`,
`FailedPrecondition` — the answer will not change.

## Exponential backoff with jitter

```csharp
private static async Task<T> RetryTransientAsync<T>(
    Func<CancellationToken, Task<T>> operation,
    ILogger logger,
    CancellationToken cancellationToken,
    int maxAttempts = 3)
{
    for (var attempt = 1; ; attempt++)
    {
        try
        {
            return await operation(cancellationToken);
        }
        catch (RpcException ex) when (attempt < maxAttempts &&
            ex.StatusCode is StatusCode.Unavailable or StatusCode.DeadlineExceeded)
        {
            // 200ms, 400ms, 800ms + jitter so N callers do not retry in lockstep
            var delay = TimeSpan.FromMilliseconds(
                200 * Math.Pow(2, attempt - 1) + Random.Shared.Next(0, 100));

            logger.Warning(ex, "Transient gRPC failure, attempt {Attempt}/{Max}, retrying in {Delay}ms",
                attempt, maxAttempts, delay.TotalMilliseconds);

            await Task.Delay(delay, cancellationToken);
        }
    }
}
```

Jitter is not optional: without it, every instance retries at the same instant and the
downstream service receives a synchronized burst exactly while it is recovering.

## ❌ Retry anti-patterns

```csharp
// ❌ retries a non-idempotent write — creates duplicates
await RetryTransientAsync(ct => _client.CreateWorkItemAsync(request, cancellationToken: ct), ...);

// ❌ retries a permanent failure 3 times, tripling the latency of a guaranteed failure
catch (RpcException) { /* retry regardless of status */ }

// ❌ blocking sleep — burns a thread-pool thread
Thread.Sleep(1000);

// ❌ ignores cancellation: keeps retrying after the client disconnected
await Task.Delay(delay);

// ❌ retry inside a DB transaction — holds locks across every attempt
await _unitOfWork.ExecuteInTransactionAsync(async () => await RetryTransientAsync(...));
```

## Timeouts everywhere, not just gRPC

- HTTP: configure `HttpClient.Timeout` (or a `CancellationTokenSource` with a delay) —
  `HttpRequestException` maps to 502.
- EF Core: long reports need a bounded command timeout rather than an unbounded query.
- Redis: `StackExchange.Redis` has its own timeouts; a Redis failure must degrade to the source
  of truth, never fail the request (see [Redis Cache Layer](./redis-cache-layer.md)).

## Fallback beats failure where correctness allows it

`GrpcPermissionFallbackLoader` exists because permissions must resolve even when the cache path
fails. Apply the same thinking: if a degraded answer is safe, prefer it — and log that you
degraded. If a degraded answer is *not* safe (money, stock, permissions granting access), fail
loudly instead.

## Audit checkpoints

- Every new gRPC call passes a `deadline` and the `CancellationToken`
- `RpcException` handled and mapped to a user-readable 400, not left to become a 500
- Retries limited to idempotent operations and transient status codes
- Backoff is exponential, jittered, and honours cancellation; no `Thread.Sleep`
- No retry loop inside a DB transaction
- Cache/optional-dependency failures degrade; critical-path failures surface
