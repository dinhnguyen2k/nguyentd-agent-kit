# Permission-Based Authorization

Authorization is **dynamic and permission-based**, never static role-based
(`.agent/rules/backend.md` §3). A permission is the string `Resource.Action`.

| Term | Meaning | Example |
| --- | --- | --- |
| Resource | business resource | `HR.Employee`, `MasterData.Project`, `AssetUnit` |
| Action | business operation | `View`, `Create`, `Update`, `Delete`, `Approve` |
| Permission | `Resource.Action` | `HR.Employee.Create` |

Constants live in `Shared.Authorization`: `Resources.*` and `Actions.*`. Add to those classes
rather than writing string literals.

## How a check happens

1. `[HasPermission(resource, action)]` derives from `AuthorizeAttribute` with
   `policy: "{resource}.{action}"`.
2. `PermissionPolicyProvider` materializes that policy name into a `PermissionRequirement`.
3. `PermissionAuthorizationHandler` evaluates it — **fail-closed**.

```csharp
public class HasPermissionAttribute : AuthorizeAttribute
{
    public HasPermissionAttribute(string resource, string action)
        : base(policy: $"{resource}.{action}") { }
}
```

Handler order: admin-group bypass (from `AuthorizationRolloutOptions.AdminGroups`) -> require a
valid `X-Employee-Id` -> validate username/employee ownership -> look up the employee's
permission snapshot (Redis cache, falling back to `IPermissionFallbackLoader` over gRPC).

Denies when the username cannot be resolved, the header is missing or malformed, ownership does
not match, or the snapshot is unavailable. Do not "fix" a deny by loosening any of those.

## Explicit checks

```csharp
[HttpPost("{id:guid}/approve")]
[HasPermission(Resources.AcceptanceMinute, Actions.Approve)]
public async Task<Result> Approve(Guid id, CancellationToken cancellationToken)
    => await service.ApproveAsync(id, cancellationToken);
```

## Implicit checks for `BaseController<>`

`EntityPermissionActionFilter` infers `"{Entity}.{Action}"` from the controller's generic entity
and the action method for controllers deriving from `BaseController<>`. So standard CRUD is
already protected with no attribute.

Consequences:

- A **custom action on a base-derived controller** may not be inferred — add
  `[HasPermission(...)]` explicitly.
- A **standalone controller** (not `BaseController<>`) gets no implicit check at all. Either add
  the attribute or call `await _currentUserService.HasPermissionAsync("Resource.Action")`.

## Checking inside a service

For decisions that depend on data (field-level visibility, conditional approval):

```csharp
private const string ViewCostPermission = "AssetUnit.ViewCost";

protected override async Task BeforeReturnGetPagedAsync(PagedResult<AssetUnitDto> result)
{
    if (await _currentUserService.HasPermissionAsync(ViewCostPermission))
        return;

    foreach (var dto in result.Data)
        dto.PurchaseCost = null;      // ✅ strip what the caller may not see
}
```

`HasPermissionAsync` mirrors the handler's evaluation (full-system-access bypass, then the
snapshot), so it stays consistent with attribute-based checks.

## Row-level scoping belongs in the query

```csharp
// ✅ GOOD — the database never returns rows the caller may not see
protected override async Task<IQueryable<AssetUnit>> BeforeApplyAutoFilterAsync(
    IQueryable<AssetUnit> query, AutoFilterPaging parameters)
{
    query = await base.BeforeApplyAutoFilterAsync(query, parameters);

    if (await _currentUserService.HasFullSystemAccessAsync())
        return query;

    var employeeId = await _currentUserService.GetEmployeeIdAsync();
    if (employeeId is null)
        throw new InvalidOperationException("Thiếu thông tin nhân sự của người dùng hiện tại.");

    return query.Where(x => x.ResponsibleEmployeeId == employeeId.Value);
}

// ❌ BAD — fetch everything, then filter in memory: paging counts are wrong and a
//    projection/export path easily skips the filter
var all = await _repository.Query().ToListAsync(ct);
var visible = all.Where(x => x.ResponsibleEmployeeId == employeeId).ToList();
```

Also remember `GetVisibleWorkItemScopeAsync` and `CheckTicketAccessAsync` for WorkItem/ticket
scoping — do not re-derive that logic.

## ❌ Anti-patterns

```csharp
// ❌ static role check — explicitly banned
if (User.IsInRole("Admin")) { /* ... */ }
if (user.Groups.Contains("Manager")) { /* ... */ }

// ❌ authorization decided by the client
if (dto.IsAdmin) { /* ... */ }

// ❌ silently skipping the check
[SkipPermissionCheck]      // with no comment saying why
public async Task<Result> DeleteAll() { }

// ❌ returning 403 from service code for a business rule
return Result.Failure("Không có quyền", HttpStatusCode.Forbidden);
// -> the FE interceptor shows an access-denied screen; if it IS a permission problem,
//    let the authorization pipeline produce the 403
```

## Adding a new permission

1. Add the `Resources.*` / `Actions.*` constants if missing.
2. Annotate the endpoint with `[HasPermission(...)]`.
3. Register the permission so it can be granted (permission metadata / seed) — an endpoint
   guarded by a permission nobody can hold is a 403 for everyone.
4. Verify the cache invalidation path: granting or revoking must publish
   `PermissionChangedEvent` so `PermissionCacheService` drops the snapshot.

## Audit checkpoints

- No `IsInRole` / group-name checks in business code
- Every state-changing endpoint is permission-guarded (explicitly or via the base controller)
- Custom actions on base-derived controllers carry an explicit `[HasPermission]`
- Standalone controllers check permissions explicitly
- Row-level scoping applied in the query, and applied on export/report paths too
- Field-level masking applied on every DTO path that exposes the field
- `[SkipPermissionCheck]` carries a written justification
- New permissions are grantable and invalidate the permission cache when changed
