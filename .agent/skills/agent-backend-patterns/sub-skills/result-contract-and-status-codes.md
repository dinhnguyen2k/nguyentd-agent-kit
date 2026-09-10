# Result Contract & Status Codes

`Contracts.Domain.Entities` defines the only three response shapes: `Result`, `Result<T>`,
`PagedResult<T>`. `ResultStatusCodeActionFilter` reads `StatusCode` off the returned object
and applies it to the HTTP response, so the status code lives in the payload.

## The critical rule

**Business failures must be `400 BadRequest`.** The frontend interceptor treats `401` as
"session expired" and `403` as "no access", so an ad-hoc `401/403/409` from business logic
triggers a spurious logout or an access-denied screen.

```csharp
// ✅ GOOD — business rejection
return Result<AssetUnitDto>.Failure("Asset already depreciated for this period.");
// -> StatusCode = 400 (default)

// ❌ BAD — hijacks auth semantics
return Result<AssetUnitDto>.Failure("Not your asset", HttpStatusCode.Forbidden);
// ❌ BAD — FE has no handler for 409
return Result<AssetUnitDto>.Failure("Duplicated code", HttpStatusCode.Conflict);
```

`401` / `403` are produced only by the auth pipeline (`AddJwtBearer`,
`PermissionAuthorizationHandler`), never by service code.

The one sanctioned `409` is the base engine's duplicate-key path: `BaseService.Create`
catches a unique-violation `DbUpdateException` and returns
`Result<T>.Failure(ValidationMessages.DuplicateKey, HttpStatusCode.Conflict)`. Do not add new
`409`s of your own — check for the duplicate in `BeforeCreateAsync` and reject with `400`.

## Success

```csharp
return Result<AssetUnitDto>.Success(dto);                                  // 200
return Result<AssetUnitDto>.Success(dto, HttpStatusCode.Created);          // 201
return Result.Success(HttpStatusCode.NoContent);                           // 204
```

`IsSuccess` is derived: `200 || 201 || 204`.

## Not found

```csharp
var entity = await _repository.GetByIdAsync(id);
if (entity is null)
    return Result<AssetUnitDto>.NotFound($"Asset unit {id} not found.");    // 404
```

`404` for a genuinely missing resource is correct and expected by the FE.

## Validation errors

Field-level errors go through the `ValidationError` collection so the FE can bind them to
inputs, instead of being flattened into one message.

`ValidationError` is a positional record: `(string Field, string Message, string? ErrorCode = null)`.

```csharp
var errors = new List<ValidationError>();
if (dto.Quantity <= 0)
    errors.Add(new ValidationError(nameof(dto.Quantity), "Quantity must be positive."));
if (dto.WarehouseId == Guid.Empty)
    errors.Add(new ValidationError(nameof(dto.WarehouseId), "Warehouse is required."));

if (errors.Count > 0)
    return Result<AssetUnitDto>.Failure(errors);   // 400 + Errors payload
```

Field-shaped validation usually belongs in a FluentValidation validator instead — the
`FluentValidationActionFilter` builds exactly this payload automatically. See
[Validation with FluentValidation](./validation-with-fluentvalidation.md).

## Paged results

```csharp
var (data, totalCount) = await _repository.GetPagedAsync(
    parameters.PageNumber, parameters.PageSize, predicate);

var paged = PagedResult<AssetUnitDto>.Create(
    _mapper.Map<IEnumerable<AssetUnitDto>>(data),
    totalCount, parameters.PageNumber, parameters.PageSize);

return PagedResult<AssetUnitDto>.Success(paged);
```

`TotalPages` is computed — never set it. `Data` never returns null (it defaults to an empty
list), so the FE can iterate unconditionally.

## Propagating a nested failure

```csharp
var journalResult = await _journalEntryService.PostAsync(entryDto);
if (!journalResult.IsSuccess)
    return Result<AssetUnitDto>.Failure(journalResult.Message);   // keep the real reason
```

## ❌ Anti-patterns

```csharp
// ❌ swallowing the reason
if (!journalResult.IsSuccess) return Result<AssetUnitDto>.Failure("Failed");
// ❌ success wrapper around a failure
return Result<AssetUnitDto>.Success(null, HttpStatusCode.OK, "Something went wrong");
// ❌ throwing raw exceptions for expected business branches
throw new Exception("Invalid quantity");
```

## Audit checkpoints

- Every business rejection is `400` with a message the user can act on
- `401` / `403` / `409` never originate from service code
- Nested failure messages are propagated, not replaced with a generic string
- `PagedResult` built via `Create` then `Success`; `TotalCount` reflects the pre-paging count
