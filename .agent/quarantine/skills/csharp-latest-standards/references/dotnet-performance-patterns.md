# .NET 10 Runtime Performance Patterns
<!-- last_synced: 2026-07-24 -->
<!-- source: devblogs.microsoft.com/dotnet + research -->

## TL;DR
1. **JIT Improvements**: Method inlining, loop unrolling, devirtualization — tự động, dev không cần action.
2. **FrozenDictionary/FrozenSet**: Dùng cho lookup tables read-only. Nhanh hơn Dictionary thông thường.
3. **Span/Memory**: Zero-allocation string parsing. Dùng `ReadOnlySpan<char>` thay vì `Substring()`.
4. **SearchValues**: Tìm kiếm ký tự mẫu trong chuỗi lớn — hardware-accelerated.
5. **System.Text.Json Source Gen**: Compile-time serialization, không cần reflection runtime.

---

## 1. Frozen Collections (.NET 8+)

```csharp
// GOOD — khởi tạo 1 lần, tra cứu cực nhanh
private static readonly FrozenDictionary<string, EStatus> StatusMap =
    new Dictionary<string, EStatus>
    {
        ["Active"] = EStatus.Active,
        ["Inactive"] = EStatus.Inactive,
        ["InUsed"] = EStatus.InUsed,
    }.ToFrozenDictionary(StringComparer.OrdinalIgnoreCase);

// Usage: O(1) lookup
if (StatusMap.TryGetValue(input, out var status)) { /* ... */ }
```

## 2. Span & Zero-Allocation Parsing

```csharp
// GOOD — parse mà không allocate string mới
public static (string FirstName, string LastName) ParseName(ReadOnlySpan<char> fullName)
{
    var spaceIndex = fullName.IndexOf(' ');
    if (spaceIndex < 0)
        return (fullName.ToString(), "");
    return (fullName[..spaceIndex].ToString(), fullName[(spaceIndex + 1)..].ToString());
}
```

## 3. SearchValues (.NET 8+)

```csharp
// GOOD — hardware-accelerated character search
private static readonly SearchValues<char> Separators = SearchValues.Create(",;|");

public static bool ContainsSeparator(ReadOnlySpan<char> input)
    => input.ContainsAny(Separators);
```

## 4. System.Text.Json Source Generator

```csharp
[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase)]
[JsonSerializable(typeof(ProductDto))]
[JsonSerializable(typeof(List<ProductDto>))]
partial class AppJsonContext : JsonSerializerContext { }

// Usage — compile-time serialization, no reflection
var json = JsonSerializer.Serialize(dto, AppJsonContext.Default.ProductDto);
```

## 5. HashSet vs ToHashSet

```csharp
// GOOD — O(1) lookup thay vì O(N) với List.Contains
var activeIds = products
    .Where(p => p.Status == EStatus.Active)
    .Select(p => p.Id)
    .ToHashSet();

// O(1) check
if (activeIds.Contains(targetId)) { /* ... */ }
```

---

## ⚠️ Cogain Adaptation Notes
1. **JIT improvements**: Tự động có khi upgrade .NET. Dev không cần thay đổi code.
2. **FrozenDictionary**: Tuyệt vời cho EStatus mapping, permission lookups, category caches.
3. **Source Gen JSON**: Cân nhắc cho high-throughput API endpoints. Hiện Cogain dùng Newtonsoft/System.Text.Json reflection.
