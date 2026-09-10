# Centralized Error Handling

`GlobalExceptionHandlerMiddleware` is the single place that turns an unhandled exception into
the standard JSON envelope. It also logs it — this is deliberate: without that log the
exception would vanish and the FE would show a bare 500 with nothing in the service terminal.

## Exception -> status mapping (authoritative)

| Exception | HTTP | Message shown to the user |
| --- | --- | --- |
| `InvalidOperationException` | **400** | your exception message |
| `ArgumentException` | **400** | your exception message |
| `AutoMapperMappingException` | 400 | `Lỗi mapping dữ liệu: ...` |
| `DbUpdateException` | 400 | extracted Postgres message/detail |
| `UnauthorizedAccessException` | 403 | your exception message |
| `KeyNotFoundException` | 404 | `Không tìm thấy tài nguyên yêu cầu` |
| `TimeoutException` | 408 | `Yêu cầu hết thời gian chờ` |
| `DbUpdateConcurrencyException` | 409 | `Dữ liệu đã bị thay đổi bởi người khác` |
| `HttpRequestException` | 502 | `Lỗi kết nối đến dịch vụ` |
| anything else | **500** | `Đã xảy ra lỗi hệ thống...` (your message is buried in `detail`) |

The middleware also detects whether the action returns `PagedResult<T>` and shapes the error
payload accordingly, so the FE parser never breaks.

## The single most common backend defect

```csharp
// ❌ BAD — user-facing business rule thrown as a bare Exception
throw new Exception("Đã tồn tại quy tắc sinh mã của chức năng này");
// -> HTTP 500, message replaced by "Đã xảy ra lỗi hệ thống. Vui lòng liên hệ quản trị viên..."
```

```csharp
// ✅ GOOD — 400 with the real reason intact
throw new InvalidOperationException("Đã tồn tại quy tắc sinh mã của chức năng này.");
```

Rule: **any message a user is meant to read must travel as a `Result.Failure` or an
`InvalidOperationException`.** Reserve raw `Exception` (and 500) for genuine defects.

## Prefer `Result` where you can return it

```csharp
// ✅ Best — explicit, testable, no exception cost
public async Task<Result<AssetUnitDto>> PostDepreciationAsync(Guid id, CancellationToken ct)
{
    var asset = await _repository.GetByIdAsync(id);
    if (asset is null)
        return Result<AssetUnitDto>.NotFound($"Không tìm thấy tài sản {id}.");

    if (asset.Status == EStatus.Inactive)
        return Result<AssetUnitDto>.Failure("Tài sản đã ngừng sử dụng, không thể khấu hao.");

    // ...
}
```

Throw only where the signature gives you no choice — `BaseService` hooks return `Task`.

## Never swallow

```csharp
// ❌ BAD — failure disappears; caller sees success
try { await _journalEntryService.PostAsync(dto); }
catch { }

// ❌ BAD — loses stack trace and the original exception type
catch (Exception ex) { throw new Exception(ex.Message); }
```

```csharp
// ✅ GOOD — log with context, then let it bubble or convert deliberately
try
{
    await _journalEntryService.PostAsync(dto);
}
catch (RpcException ex)
{
    _logger.Error(ex, "Posting journal entry failed for asset {AssetId}, status {Status}",
        asset.Id, ex.StatusCode);
    throw new InvalidOperationException("Không thể ghi bút toán, vui lòng thử lại.");
}
```

Catch narrowly (`RpcException`, `DbUpdateException`, `TimeoutException`); a bare
`catch (Exception)` that converts everything hides real defects.

## Catching for compensation

Where a `catch` exists to undo remote work, it must rethrow after compensating — otherwise the
caller believes the operation succeeded. See
[Cross-Service Compensation](./cross-service-compensation.md).

## Audit checkpoints

- No `throw new Exception(...)` for a user-facing business rule
- No empty `catch { }`; no `catch` that drops the exception object from the log
- Rethrows preserve the original exception (`throw;`, or wrap with `ex` as inner)
- Business branches return `Result.Failure` rather than throwing where the signature allows
- New exception types thrown from services have a defined mapping in the middleware
