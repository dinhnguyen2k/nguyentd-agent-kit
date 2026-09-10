# Cogain-Specific Code Patterns
<!-- Ví dụ thực tế áp dụng các best practices vào codebase Cogain -->

## 1. Service Pattern — Sử dụng BaseService Hooks

```csharp
// ✅ GOOD — Override hooks thay vì override Create/Update
public class ProductService : BaseService<Product, ProductDto, CreateProductDto, UpdateProductDto, ProductDropdownDto>
{
    // KHÔNG khai báo lại _mapper, _repository, _unitOfWork — đã có trong BaseService
    
    protected override async Task BeforeCreateAsync(CreateProductDto dto, Product entity, CancellationToken ct)
    {
        // Validate business rules TRƯỚC khi save
        await ValidateUniqueCodeAsync(dto.Code, ct);
    }

    protected override async Task AfterCreateAsync(ProductDto dto, Product entity, CancellationToken ct)
    {
        // Gọi gRPC tạo danh mục liên kết SAU khi entity đã được save
        await _categoryGrpcClient.CreateDefaultCategoriesAsync(entity.Id, ct);
    }

    protected override async Task BeforeUpdateAsync(UpdateProductDto dto, Product entity, CancellationToken ct)
    {
        // Validate trước update — entity đã được load từ DB
    }
}
```

## 2. Query Pattern — Repository + AsNoTracking

```csharp
// ✅ GOOD — Sử dụng _repository thay vì _context trực tiếp
public async Task<Result<List<ProductDropdownDto>>> GetActiveProductsAsync(CancellationToken ct)
{
    var items = await _repository
        .FindByCondition(p => p.Status == EStatus.Active)
        .AsNoTracking()
        .Select(p => new ProductDropdownDto
        {
            Id = p.Id,
            Name = p.Name,
            Code = p.Code
        })
        .ToListAsync(ct);
    
    return Result<List<ProductDropdownDto>>.Success(items);
}
```

## 3. gRPC Call Pattern — Empty Guard + Compensation

```csharp
// ✅ GOOD — Kiểm tra rỗng + Compensation
protected override async Task AfterCreateAsync(ProductDto dto, Product entity, CancellationToken ct)
{
    var categoryIds = dto.CategoryIds;
    if (categoryIds is not { Count: > 0 })
        return;

    try
    {
        await _categoryClient.AssignCategoriesAsync(
            new AssignRequest { ProductId = entity.Id.ToString() }, ct);
    }
    catch
    {
        // Compensation: rollback nếu gRPC fail
        // BaseService transaction sẽ tự rollback local entity
        throw;
    }
}
```

## 4. Excel Import Pattern — Partial Class

```csharp
// File chính: ProductService.cs
public partial class ProductService
{
    private const string MasterSheetName = "Sheet1";
    private static readonly string[] MasterHeaders = ["Mã (*)", "Tên (*)", "Danh mục"];
    
    protected override string GetExportTemplateFileName() => "Template_Product";
    protected override string GetExportDataFileName() => "Products";
}

// File Excel: ProductService.Import.cs
public partial class ProductService
{
    #region State & Variables
    private List<ProductImportDto>? _parsedImportData;
    private Dictionary<string, Guid>? _categoryLookup;
    #endregion

    #region Import
    protected override async Task<List<ProductImportDto>> CustomParseExcelToDtosAsync(
        Stream stream, CancellationToken ct)
    {
        // Parse Excel → DTO trung gian
        _parsedImportData = ParseExcelStream(stream);
        return _parsedImportData;
    }

    protected override async Task LoadImportReferencesAsync(CancellationToken ct)
    {
        // Load lookup tables MỘT LẦN, không query trong vòng lặp
        var categories = await _categoryRepository
            .FindByCondition(c => c.Status == EStatus.Active)
            .AsNoTracking()
            .ToListAsync(ct);
        _categoryLookup = categories.ToDictionary(c => c.Code, c => c.Id);
    }
    #endregion
}
```

## 5. Collection Expression C# 12

```csharp
// ✅ GOOD — Dùng collection expression [..]
List<string> combined = [..existingCodes, ..newCodes];
int[] ids = [1, 2, 3];
string[] empty = [];
```

## 6. AutoMapper Configuration — Ignore Id

```csharp
// ✅ BẮT BUỘC — ignore Id khi mapping Update DTO → Entity
CreateMap<UpdateProductDto, Product>()
    .ForMember(d => d.Id, opt => opt.Ignore());

// ✅ Child collections — Ignore và xử lý thủ công
CreateMap<UpdateOrderDto, Order>()
    .ForMember(d => d.Id, opt => opt.Ignore())
    .ForMember(d => d.OrderDetails, opt => opt.Ignore());
```
