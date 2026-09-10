# Structured Logging with Serilog

Configured once in `BuildingBlocks/Common.Logging/Serilogger.cs` and wired per service with
`builder.Host.UseSerilog(Serilogger.Configure)`.

## What the configuration means for you

```csharp
configuration
    .MinimumLevel.Warning()                 // ⚠️ default floor is Warning
    .WriteTo.Debug()
    .WriteTo.Console(outputTemplate: "[{Timestamp:HH:mm:ss} {Level}] {SourceContext}...")
    // Elasticsearch sink when ElasticConfiguration:Uri is set
    .Enrich.FromLogContext()
    .Enrich.WithMachineName()
    .Enrich.WithProperty("Environment", environmentName)
    .Enrich.WithProperty("Application", applicationName)
    .ReadFrom.Configuration(context.Configuration);
```

Two consequences that decide how you log:

1. **The default minimum level is `Warning`.** `Debug` and `Information` calls are dropped unless
   `appsettings` raises the level. Never rely on an `Information` log as the only record of
   something that matters — and never use logging as a substitute for a real audit trail.
2. **Logs go to Elasticsearch** (indexed as `mslogs-{app}-{env}-{yyyy-MM}`). Properties are
   queryable *only* if you pass them as named template parameters.

## Message templates, not interpolation

```csharp
// ✅ GOOD — AssetUnitId and Status become searchable fields in Elasticsearch
_logger.Error(ex, "Posting depreciation failed for asset {AssetUnitId}, status {Status}",
    asset.Id, asset.Status);

// ❌ BAD — one opaque string; you cannot filter by asset id
_logger.Error(ex, $"Posting depreciation failed for asset {asset.Id}, status {asset.Status}");
```

Use `PascalCase` property names, and keep the same name for the same concept across services
(`AssetUnitId`, `EmployeeId`, `WarehouseId`) so a single Kibana query spans them.

## Two logger abstractions coexist — match the surroundings

```csharp
// Services (BaseService and its subclasses): Serilog's ILogger
public class AssetUnitService(/* ... */ Serilog.ILogger logger) { }
logger.Error(ex, "...");          // Error / Warning / Information / Debug

// Middleware, filters, handlers: Microsoft's ILogger<T>
public class GlobalExceptionHandlerMiddleware(RequestDelegate next, ILogger<GlobalExceptionHandlerMiddleware> logger) { }
logger.LogError(ex, "...");       // LogError / LogWarning / LogInformation / LogDebug
```

Both funnel into the same sinks. Do not introduce a third logging abstraction, and do not use
`Console.WriteLine` — it is unstructured and invisible in Elasticsearch.

## Always pass the exception object

```csharp
// ✅ GOOD — full stack trace and inner exceptions reach the sink
_logger.Error(ex, "Failed to sync employee {EmployeeId}", message.Id);

// ❌ BAD — stack trace lost; the message alone rarely identifies the cause
_logger.Error("Failed to sync employee: " + ex.Message);
```

## Level selection

| Level | Use for | Reaches sinks by default |
| --- | --- | --- |
| `Error` | Operation failed; someone should look | ✅ |
| `Warning` | Degraded but handled (cache miss fallback, retry, compensation ran) | ✅ |
| `Information` | Significant state change (invalidated cache, job completed) | ❌ (raise the level to see it) |
| `Debug` | Local diagnosis | ❌ |

`GlobalExceptionHandlerMiddleware` already logs every unhandled exception at `Error` — that
logging exists specifically so exceptions are not invisible. Do not add a duplicate log for the
same exception on its way out.

## Never swallow silently

```csharp
// ❌ BAD — the rule is explicit: no silent error swallowing
try { await _cache.InvalidateAsync(id); } catch { }

// ✅ GOOD
try
{
    await _cache.InvalidateAsync(id);
}
catch (Exception ex)
{
    _logger.Error(ex, "Failed to invalidate asset cache {AssetUnitId} — data may be stale", id);
}
```

## Never log secrets or personal data

```csharp
// ❌ BAD
_logger.Information("Login with token {Token} for {Email}", accessToken, user.Email);
_logger.Debug("Request body: {Body}", JsonSerializer.Serialize(dto));   // may contain salary, ID numbers
```

Log identifiers, not payloads. Salary, personnel records, bank details and auth headers stay out
of logs; a whole-DTO dump is how they leak.

## Correlation

`Enrich.FromLogContext()` is enabled, so pushed properties attach to everything downstream:

```csharp
using (Serilog.Context.LogContext.PushProperty("CorrelationId", correlationId))
{
    await next(context);
}
```

Include the correlation id (or at least the primary entity id) when logging inside a multi-step
flow — that is what makes a cross-service failure reconstructable.

## Compensation and money paths log more

Where a failure needs manual repair, log every identifier needed to repair it:

```csharp
_logger.Error(ex,
    "Compensation failed: local reservation {ReservationId} rolled back but remote hold {RemoteHoldId} " +
    "still exists for warehouse {WarehouseId} — manual cleanup required",
    reservation.Id, remoteHoldId, warehouseId);
```

## Audit checkpoints

- Message templates with named properties; no string interpolation or concatenation
- Exception object always passed to `Error` / `LogError`
- No empty `catch`; every handled failure logs at `Warning` or above
- Nothing important relies on `Information` / `Debug` reaching the sink
- No tokens, passwords, personal or salary data, or whole-DTO dumps in logs
- No `Console.WriteLine`
- Compensation / money / permission failures log every identifier needed for manual repair
