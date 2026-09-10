# JWT Authentication

Authentication is OIDC against Authentik, validated per service with
`Microsoft.AspNetCore.Authentication.JwtBearer`. Tokens are never issued or signed by this
backend — do not add token-minting code.

## Configuration (`ConfigureJwtAuthentication`)

```csharp
services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = authority;
        options.MetadataAddress = metadataAddress;     // OIDC discovery -> signing keys
        options.RequireHttpsMetadata = true;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuers = validIssuers,               // multiple issuers accepted
            ValidateAudience = false,                  // internal services
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(2),
            RoleClaimType = "groups"
        };

        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context => { /* also accept ?access_token= for SSE/websocket */ }
        };
    });
```

Signing keys are fetched from discovery — never configure a symmetric key or a hardcoded secret.
`ValidateLifetime`, `ValidateIssuer` and `RequireHttpsMetadata` must stay `true`.

## Pipeline order

```csharp
app.UseMiddleware<GlobalExceptionHandlerMiddleware>();
app.UseAuthentication();   // populates HttpContext.User
app.UseAuthorization();    // evaluates policies (permissions)
```

`UseAuthentication` before `UseAuthorization`, always.

## Reading the caller: `ICurrentUserService`

Never parse claims by hand in a service.

```csharp
public interface ICurrentUserService
{
    string UserId { get; }
    string Username { get; }
    string Email { get; }
    bool IsAuthenticated { get; }
    string Language { get; }
    string? GetClaimValue(string claimType);
    Task<Guid?> GetEmployeeIdAsync();
    Task<Guid?> GetOrganizationIdAsync();
    Task<(Guid? EmployeeId, Guid? OrganizationId)> GetCurrentIdentityAsync();
    Task<bool> CheckTicketAccessAsync(Guid ticketId, ITicketAccessControl ticket);
    Task<VisibleWorkItemScope> GetVisibleWorkItemScopeAsync(Guid currentUserId, string categoryCode);
    Task<bool> HasFullSystemAccessAsync();
    Task<bool> HasPermissionAsync(string permission);
}
```

```csharp
// ✅ GOOD
var employeeId = await _currentUserService.GetEmployeeIdAsync();
if (employeeId is null)
    throw new InvalidOperationException("Thiếu thông tin nhân sự của người dùng hiện tại.");

// ❌ BAD — bypasses the employee resolution + cache the service owns
var sub = _httpContextAccessor.HttpContext?.User.FindFirst("sub")?.Value;
var employeeId = Guid.Parse(sub!);
```

## The `X-Employee-Id` header

A user may map to several employee records, so employee-scoped requests carry
`X-Employee-Id`. `EmployeeIdValidationFilter` enforces it globally:

1. Header missing -> **400** `"X-Employee-Id header is required."`
2. Not a GUID -> **400** `"X-Employee-Id must be a valid GUID."`
3. Ownership mismatch (username does not own that employee) -> **403** `"Invalid employee context."`

Bootstrap endpoints that run *before* an employee is chosen opt out with
`[SkipEmployeeIdValidation]`. Any new use of that attribute needs a stated reason.

Never trust an employee id from the request body — the header path is the validated one.

## Anonymous endpoints

```csharp
app.MapGet("/health", () => "ERP API is healthy!").AllowAnonymous();   // ✅ liveness only
```

Keep the anonymous surface to health checks. `/version` already requires authorization.

## ❌ Anti-patterns

```csharp
// ❌ hardcoded secret / key material
options.TokenValidationParameters.IssuerSigningKey =
    new SymmetricSecurityKey(Encoding.UTF8.GetBytes("super-secret"));

// ❌ disabling validation to "make it work locally"
options.TokenValidationParameters.ValidateIssuer = false;
options.TokenValidationParameters.ValidateLifetime = false;
options.RequireHttpsMetadata = false;

// ❌ trusting a client-supplied identity
var employeeId = dto.EmployeeId;   // caller can send anyone's id

// ❌ logging the token
_logger.Information("Token: {Token}", accessToken);
```

## Logout and revocation

Access is cached (`PermissionCacheService`, `UserStatusCacheService`) and invalidated by
`LogoutCacheInvalidationService` and `PermissionChangedEvent`. If you introduce a new
identity-derived cache, wire it into that invalidation path or a revoked user keeps working
until the TTL expires.

## Audit checkpoints

- No hardcoded keys/secrets; discovery-based key resolution intact
- `ValidateIssuer` / `ValidateLifetime` / `RequireHttpsMetadata` unchanged
- Identity read through `ICurrentUserService`, not raw claims
- Employee id taken from the validated header, never from the body
- New `[SkipEmployeeIdValidation]` / `AllowAnonymous` usage justified
- No tokens, passwords, or full auth headers in logs
