# Middleware & Action Filters

Cross-cutting behaviour lives in `BuildingBlocks/Infrastructure/{Middlewares,Filters}` and is
wired identically in every service. Do not re-implement these concerns inside a controller or
service.

## Actual pipeline (`<Service>.API/Program.cs`)

```csharp
app.UseSwagger();
app.UseSwaggerUI(/* ... */);
app.UseHttpsRedirection();
app.UseCors("CorsPolicy");
app.UseMiddleware<GlobalExceptionHandlerMiddleware>();   // must precede auth to catch its errors
app.UseAuthentication();
app.UseAuthorization();
app.MapGet("/health", () => "ERP API is healthy!").AllowAnonymous();
app.MapGrpcService<ErpInfoGrpcService>();
app.MapControllers();
```

Order matters: the exception handler is registered before `UseAuthentication` so failures
anywhere downstream still produce the standard JSON envelope.

## Registered action filters (`AddControllers`)

```csharp
services.AddControllers(options =>
{
    options.Filters.Add<ResultStatusCodeActionFilter>();   // Result.StatusCode -> HTTP status
    options.Filters.Add<ModelValidationActionFilter>();    // ModelState -> Result.Failure(400)
    options.Filters.Add<FluentValidationActionFilter>();   // IValidator<T> -> Result.Failure(errors)
    options.Filters.Add<EntityPermissionActionFilter>();   // implicit "{Entity}.{Action}" check
    options.Filters.Add<EmployeeIdValidationFilter>();     // X-Employee-Id GUID guard
});
```

Consequences to rely on rather than duplicate:

- Returning `Result<T>.Failure(...)` already yields the right HTTP status — never wrap it in
  `BadRequest(...)`
- Invalid DTO shape never reaches your action
- Controllers deriving from `BaseController<>` get a permission check without an attribute;
  standalone controllers must declare `[HasPermission(...)]` or check
  `ICurrentUserService.HasPermissionAsync`
- Employee-scoped endpoints get the `X-Employee-Id` header validated for you

Escape hatches: `[SkipFluentValidation]`, `[SkipPermissionCheck]` — each needs an explicit
justification in review.

## Adding middleware

Only for genuinely per-request, pipeline-wide concerns (correlation ids, request logging,
tenant resolution). Keep it allocation-light — it runs on every request.

```csharp
namespace Infrastructure.Middlewares;

public class CorrelationIdMiddleware(RequestDelegate next)
{
    private const string HeaderName = "X-Correlation-Id";

    public async Task InvokeAsync(HttpContext context, ILogger<CorrelationIdMiddleware> logger)
    {
        var correlationId = context.Request.Headers[HeaderName].FirstOrDefault()
                            ?? Guid.NewGuid().ToString();

        context.Response.Headers[HeaderName] = correlationId;

        using (Serilog.Context.LogContext.PushProperty("CorrelationId", correlationId))
        {
            await next(context);   // ✅ always call next
        }
    }
}
```

Register in `Program.cs` in a deliberate position, before `UseAuthentication` if the property
should appear on auth failures too.

## ❌ Middleware anti-patterns

```csharp
// ❌ swallowing the pipeline: response never completes downstream
public async Task InvokeAsync(HttpContext context)
{
    if (!IsAllowed(context)) { context.Response.StatusCode = 403; return; }  // no log, no body
    await _next(context);
}

// ❌ scoped service captured in a middleware constructor (middleware is a singleton)
public class AuditMiddleware(RequestDelegate next, IUnitOfWork unitOfWork) { }
//    resolve per request via InvokeAsync parameters or context.RequestServices instead

// ❌ writing to the body after the response has started
```

## Filter vs middleware

| Need | Use |
| --- | --- |
| Access to action arguments, model state, or the returned `Result` | Action filter |
| Runs for non-MVC endpoints too (gRPC, health, static) | Middleware |
| Authorization decision | Authorization policy / handler, not a filter |

## Audit checkpoints

- `GlobalExceptionHandlerMiddleware` still registered before `UseAuthentication`
- New middleware always calls `next` (or documents why it terminates) and logs terminations
- No scoped dependency injected into a middleware constructor
- Controllers do not re-do validation / permission work the filters already perform
- `[SkipPermissionCheck]` / `[SkipFluentValidation]` usage justified
