# Rate Limiting

Rate limiting belongs at the **gateway**, not inside a service. `OcelotApiGw` owns it.

## Current configuration

`OcelotApiGw/Options/RateLimitingOptions.cs`, bound from `appsettings.json`:

```csharp
public class RateLimitingOptions
{
    public const string SectionName = "RateLimiting";

    public int MaxRequests { get; set; } = 100;
    public int TimeWindowMinutes { get; set; } = 1;
    public bool EnableRateLimiting { get; set; } = false;
}
```

```json
"RateLimiting": {
  "MaxRequests": 100,
  "TimeWindowMinutes": 1,
  "EnableRateLimiting": false
}
```

Note that it is **disabled by default** — do not claim in a review that an endpoint is
rate-limited without checking the deployed configuration. Per-route limits go in `ocelot.json`
(`RateLimitOptions`); resilience/QoS on the same route is Polly-backed via `.AddPolly()`.

## ❌ Never hand-roll an in-memory limiter in a service

```csharp
// ❌ BAD — this was the old (TypeScript) guidance and it is wrong here
public class RateLimiter
{
    private readonly Dictionary<string, List<DateTime>> _requests = new();
    // ...
}
```

Why it fails in this architecture:

1. **Per-instance state.** With N replicas the effective limit is N × the configured value.
2. **Unbounded growth.** A dictionary keyed by IP is a memory leak and a trivial DoS vector.
3. **Not thread-safe.** A plain `Dictionary` under concurrent requests corrupts or throws.
4. **Wrong layer.** The gateway already sees every request and can reject before it costs a
   thread, a DB connection, or a permission lookup.
5. **Client IP is wrong behind the gateway** — a service sees the gateway's address unless
   forwarded headers are configured, so it would throttle everyone as one client.

## If a service genuinely needs its own limit

Only for expensive per-user operations the gateway cannot distinguish (report generation,
bulk export, an outbound API with its own quota). Use Redis so the counter is shared:

```csharp
public class RedisRateLimiter(IDatabase database, ILogger logger)
{
    public async Task<bool> TryAcquireAsync(string action, Guid employeeId, int maxRequests, TimeSpan window)
    {
        var env = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Production";
        var key = $"Cogain/ratelimit:{env}:{action}:{employeeId}";

        try
        {
            var count = await database.StringIncrementAsync(key);
            if (count == 1)
                await database.KeyExpireAsync(key, window);   // TTL on first hit in the window

            return count <= maxRequests;
        }
        catch (Exception ex)
        {
            // fail-open: a Redis outage must not block legitimate work
            logger.Error(ex, "Rate limiter unavailable for {Action}/{EmployeeId}", action, employeeId);
            return true;
        }
    }
}
```

`INCR` + `EXPIRE` is atomic enough for a fixed window and needs no lock. Key on the **employee
id**, not the IP — behind the gateway the IP is not the client.

Then reject with a business failure, since 429 is not part of the FE contract:

```csharp
if (!await _rateLimiter.TryAcquireAsync("export-assets", employeeId.Value, 5, TimeSpan.FromMinutes(1)))
    return Result<string>.Failure("Bạn đã yêu cầu xuất dữ liệu quá nhiều lần, vui lòng thử lại sau 1 phút.");
```

Decide fail-open vs fail-closed deliberately: fail-open for convenience limits, fail-closed when
the limit protects a paid quota or a third-party contract.

## Related protections that are not rate limiting

- **Bounded page size**: cap `PageSize` server-side so one request cannot ask for a million rows.
- **Excel import size**: `ValidateExcelFile` already bounds the upload — keep it.
- **Query timeouts**: see [Resilience & Retry](./resilience-and-retry.md).

## Audit checkpoints

- No in-memory / static-dictionary limiter in a service
- Any service-level limit is Redis-backed, keyed on the employee id, and has a TTL
- Fail-open vs fail-closed is a stated decision
- Rejection surfaces as a `400` business failure, not a raw 429
- `PageSize` capped server-side
- Claims that an endpoint "is rate limited" verified against `EnableRateLimiting` and `ocelot.json`
