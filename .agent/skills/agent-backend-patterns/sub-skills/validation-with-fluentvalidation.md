# Validation with FluentValidation

The backend is the source of truth for all business validation. Frontend checks are UX only —
never the enforcement point.

## Two layers, two jobs

| Layer | Tool | Validates |
| --- | --- | --- |
| Shape | `AbstractValidator<TDto>` + `FluentValidationActionFilter` | required, length, range, format, cross-field within the DTO |
| Business | `BaseService` hooks / service methods | uniqueness, referential existence, state machine, permission scope, invariants |

Anything needing a database read or another service belongs in the service layer, not the validator.

## Shape validation

`FluentValidationActionFilter` resolves `IValidator<T>` for each action argument automatically,
so a registered validator needs no controller code. On failure it short-circuits with
`Result.Failure(errors, 400)` carrying every `ValidationError(Field, Message, ErrorCode)`.

```csharp
using FluentValidation;

namespace ERP.Services.Validation.Assets;

public class AssetUnitUpsertDtoValidator : AbstractValidator<AssetUnitUpsertDto>
{
    public AssetUnitUpsertDtoValidator()
    {
        RuleFor(x => x.Code)
            .NotEmpty().WithMessage("Mã tài sản là bắt buộc.")
            .MaximumLength(50).WithMessage("Mã tài sản tối đa 50 ký tự.");

        RuleFor(x => x.AssetId)
            .NotEmpty().WithMessage("Tài sản là bắt buộc.");

        RuleFor(x => x.PurchaseCost)
            .GreaterThan(0).WithMessage("Nguyên giá phải lớn hơn 0.");

        RuleFor(x => x.WarrantyEndDate)
            .GreaterThanOrEqualTo(x => x.PurchaseDate)
            .When(x => x.WarrantyEndDate.HasValue)
            .WithMessage("Ngày hết bảo hành không được nhỏ hơn ngày mua.");
    }
}
```

Register it where the service's validators are registered (assembly scan in
`ServiceExtensions`, e.g. `services.AddValidatorsFromAssemblyContaining<...>()`); a validator
that is not registered silently never runs.

Opt out per endpoint with `[SkipFluentValidation]` — and only with a stated reason.

## ❌ Don't put I/O in a validator

```csharp
// ❌ BAD — DB call inside a validator: runs on every request, bypasses transaction scope,
//    and duplicates the check the service must do anyway
RuleFor(x => x.Code).MustAsync(async (code, ct) =>
    !await _dbContext.AssetUnits.AnyAsync(a => a.Code == code, ct))
    .WithMessage("Mã đã tồn tại.");
```

```csharp
// ✅ GOOD — uniqueness is a business rule, enforced in the hook next to the write
protected override async Task BeforeCreateAsync(AssetUnitUpsertDto dto)
{
    if (await _repository.ExistsAsync(x => x.Code == dto.Code && x.DeletedDate == null))
        throw new InvalidOperationException($"Mã tài sản {dto.Code} đã tồn tại.");
}
```

Uniqueness still needs a DB unique index as the real guard — the pre-check only produces a
friendly message. See [Soft Delete & Filtered Indexes](./soft-delete-and-filtered-indexes.md).

## Collecting business errors instead of failing fast

When the user should see every problem at once (imports, multi-line documents):

```csharp
var errors = new List<ValidationError>();

for (var i = 0; i < dto.Lines.Count; i++)
{
    var line = dto.Lines[i];
    if (!warehouseIds.Contains(line.WarehouseId))
        errors.Add(new ValidationError($"Lines[{i}].WarehouseId", "Kho không tồn tại."));
    if (line.Quantity > availability.GetValueOrDefault(line.MaterialId))
        errors.Add(new ValidationError($"Lines[{i}].Quantity", "Vượt tồn kho khả dụng."));
}

if (errors.Count > 0)
    return Result<GoodsIssueDto>.Failure(errors);
```

Load the reference sets once, before the loop — never query per line
(see [N+1 Prevention](./n1-prevention-and-batch-loading.md)).

## Excel import validation

Use the import hooks: `LoadImportReferencesAsync` to preload lookups,
`ValidateImportDtosAsync` / `ValidateImportAsync` to accumulate row errors. Do not override
`ImportFromExcel`.

## Audit checkpoints

- Validator exists and is registered for every new request DTO
- No DB / gRPC calls inside validators
- Business invariants enforced server-side even when the FE already checks them
- Multi-row flows accumulate errors with row-indexed field names
- Uniqueness backed by a filtered unique index, not only a pre-check
