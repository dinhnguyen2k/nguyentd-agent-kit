# Sub-Skill: C# Compiler Safety & Clean Code Rules

Sử dụng Sub-Skill này khi anh phát triển logic nghiệp vụ, gán biến, kiểm tra validation, hoặc xử lý các vấn đề liên quan đến Cảnh báo Nullable (`CS8600`, `CS8602`, `CS8604`...) trong C# (.NET 8).

C# Compiler hiện đại có khả năng phân tích luồng dữ liệu (Data-Flow Analysis) cực kỳ thông minh để track trạng thái nullable của đối tượng. Hãy viết code tối giản, tối ưu hóa để Compiler hiểu đúng và loại bỏ cảnh báo mà không cần dùng đến toán tử `!` (null-forgiving) một cách vô tội vạ.

---

## 💡 Quy tắc 1: Tối ưu hóa Null-Check & Modern Pattern Matching

Ưu tiên sử dụng Modern Pattern Matching khi kiểm tra null:

```csharp
if (value is null)
    return;
```

**Tuyệt đối KHÔNG** dùng defensive null check dư thừa nếu compiler/analyzer đã biết object đó chắc chắn **NON-NULL**.

### ❌ Bad:
```csharp
// ❌ Compiler đã biết response chắc chắn non-null nhưng vẫn check ?. và == true dư thừa
if (response?.Success == true)
```

### ✅ Good (Nếu response đã non-null):
```csharp
// 👍 Đơn giản và trực quan
if (response.Success)
```

### ✅ Good (Chỉ khi response thật sự nullable):
```csharp
// 👍 Đúng đắn khi có nguy cơ response bị null
if (response?.Success == true)
```

---

## 💡 Quy tắc 2: Throw Expression & Kiểm tra Null tham số

Nếu cần throw exception khi dữ liệu bị null, ưu tiên sử dụng cấu trúc Throw Expression inline gọn gàng:

```csharp
var entity = await repo.GetByIdAsync(id)
    ?? throw new InvalidOperationException("Entity không tồn tại.");
```

**Không sử dụng** `_ = await ... ?? throw ...` trừ khi có lý do kỹ thuật thực sự rõ ràng.

---

## 💡 Quy tắc 3: Collection Null Policy (Bộ quy chuẩn Collection Never-Null)

Ưu tiên thiết kế collection theo triết lý **Never-Null** (Không bao giờ để null).

### ✅ Good:
```csharp
public List<ItemDto> Items { get; set; } = [];
```
hoặc:
```csharp
public IReadOnlyCollection<ItemDto> Items { get; set; } = [];
```

Tránh để collection ở trạng thái nullable nếu không có ý nghĩa nghiệp vụ hay lý do đặc thù rõ ràng.

### 🛠️ Cách kiểm tra số lượng phần tử:
*   Nếu collection được đảm bảo **non-null** (Never-Null):
    ```csharp
    if (items.Count > 0)
    ```
*   Nếu collection thực sự có khả năng bị **nullable**:
    ```csharp
    if (items?.Count > 0)
    ```

---

## 💡 Quy tắc 4: Loại bỏ Async thừa thãi (Avoid async without await)

Nếu trong method không có bất kỳ từ khóa `await` nào, **BẮT BUỘC** bỏ từ khóa `async` ở chữ ký hàm và trả về `Task.CompletedTask` hoặc return trực tiếp Task gốc.

### ❌ Bad:
```csharp
protected override async Task BeforeCreateAsync(Dto dto)
{
    Validate(dto);
    // ❌ Cảnh báo CS1998: This async method lacks 'await' operators...
}
```

### ✅ Good:
```csharp
protected override Task BeforeCreateAsync(Dto dto)
{
    Validate(dto);
    return Task.CompletedTask; // 👍 Giải phóng bộ máy trạng thái (state machine) của async
}
```

Nếu chỉ thực hiện bọc (wrap) Task:
```csharp
private Task EnrichAllAsync(List<Dto> dtos)
{
    return Task.WhenAll(
        serviceA.EnrichAsync(dtos),
        serviceB.EnrichAsync(dtos)
    ); // 👍 Return trực tiếp Task gốc
}
```

### 🛠️ Chỉ giữ từ khóa `async/await` khi:
1. Có khối `try/catch`.
2. Có khối `using` hoặc `await using`.
3. Có logic xử lý nghiệp vụ chạy tiếp ở phía sau lệnh `await`.
4. Cần thực hiện biến đổi giá trị kết quả trả về (`transform result`).

---

## 💡 Quy tắc 5: Ưu tiên gom SaveChanges (Prefer one SaveChanges when possible)

Nếu có nhiều thực thể (entities) được EF Core tracking và cùng nằm trong một giao dịch nghiệp vụ (business transaction), **BẮT BUỘC** gom về một lần gọi `SaveChangesAsync` duy nhất ở cuối để tối ưu hóa IO Database.

```csharp
var hasChanged = false;

// mutate details
// mutate headers

if (hasChanged)
    await unitOfWork.SaveChangesAsync(); // 👍 Gom về 1 lần lưu duy nhất
```

**Tuyệt đối không** gọi `SaveChangesAsync()` nhiều lần rải rác nếu không có yêu cầu bắt buộc phải commit từng bước.

---

## 💡 Quy tắc 6: Chấp nhận Foreach Mutation (Foreach mutation is acceptable)

Với các thực thể đang được EF Core tracking, việc duyệt qua và chỉnh sửa trạng thái (mutate) bằng vòng lặp `foreach` truyền thống là hoàn toàn rõ ràng, trong sáng và được khuyến khích.

### ✅ Good:
```csharp
foreach (var item in items.Where(x => x.Status == Status.Pending))
{
    item.Status = Status.Completed;
    hasChanged = true;
}
```

**Tuyệt đối không** biến đổi ép buộc sang `List.ForEach()` chỉ với mục đích làm dòng code ngắn hơn nhưng làm giảm khả năng debug và đọc hiểu.

---

## 💡 Quy tắc 7: Tận dụng toán tử `await using`

Nếu tài nguyên (resource) có hỗ trợ interface `IAsyncDisposable` bên trong một phương thức async, **BẮT BUỘC** ưu tiên sử dụng `await using`:

```csharp
await using var stream = new MemoryStream();
```
*(Đối với MemoryStream, tầm ảnh hưởng thực tế lên tài nguyên không quá lớn, nhưng quy chuẩn này giúp đảm bảo code nhất quán với bộ Analyzer của dự án).*

---

## 💡 Quy tắc 8: Giải quyết Boilerplate Mappers bằng Generic & Delegate

Khi xử lý ánh xạ hàng loạt thực thể từ các gRPC response hoàn toàn khác nhau (được sinh từ các Protobuf message khác nhau như `GetEmployeesByCodesResponse`, `GetUnitsOfMeasureByCodesResponse`...) nhưng có chung một logic ánh xạ cấu trúc (duyệt qua danh sách, parse Guid từ chuỗi ID, lọc theo tập HashSet nếu có, và đưa vào Dictionary khóa Code), việc viết các hàm helper riêng cho từng thực thể sẽ sinh ra boilerplate code trùng lặp rất lớn.

*   **Giải pháp**: Sử dụng một **Generic Helper** nhận `IEnumerable<TSource>` kết hợp các delegate `Func<TSource, string>` để bóc tách logic chung. Điều này giúp loại bỏ hoàn toàn boilerplate code, giữ code siêu tinh gọn và duy trì hiệu năng cao.

### ❌ Bad (Trùng lặp cấu trúc, sinh boilerplate cho từng thực thể):
```csharp
private static Dictionary<string, Guid> MapEmployees(GetEmployeesByCodesResponse response)
{
    var map = new Dictionary<string, Guid>(StringComparer.OrdinalIgnoreCase);
    foreach (var emp in response.Employees)
        if (Guid.TryParse(emp.EmployeeId, out var id)) map[emp.Code] = id;
    return map;
}

private static Dictionary<string, Guid> MapUoms(GetUnitsOfMeasureByCodesResponse response)
{
    var map = new Dictionary<string, Guid>(StringComparer.OrdinalIgnoreCase);
    foreach (var uom in response.Items)
        if (Guid.TryParse(uom.Id, out var id)) map[uom.Code] = id;
    return map;
}
```

### ✅ Good (Gộp logic cấu trúc qua Generic & Delegate):
```csharp
// 1. Viết Generic Helper dùng chung
private static Dictionary<string, Guid> MapEntitiesToDictionary<TSource>(
    IEnumerable<TSource> source,
    Func<TSource, string> codeSelector,
    Func<TSource, string> idSelector,
    HashSet<string>? filterCodes = null)
{
    var map = new Dictionary<string, Guid>(StringComparer.OrdinalIgnoreCase);
    if (source is null)
        return map;

    foreach (var item in source)
    {
        var code = codeSelector(item);
        if (string.IsNullOrEmpty(code)) continue;
        if (filterCodes != null && !filterCodes.Contains(code)) continue;

        var idStr = idSelector(item);
        if (Guid.TryParse(idStr, out var id))
            map[code] = id;
    }
    return map;
}

// 2. Gọi trực tiếp tại nơi cần thiết mà KHÔNG cần định nghĩa các hàm mapper trung gian dư thừa:
var projectMap  = projectsResp?.Success == true ? MapEntitiesToDictionary(projectsResp.Data, d => d.Code, d => d.Id) : [];
var uomMap      = MapEntitiesToDictionary(uomResp?.Items, u => u.Code, u => u.Id);
var empMap      = MapEntitiesToDictionary(empResp?.Employees, e => e.Code, e => e.EmployeeId);
var teamMap     = MapEntitiesToDictionary(teamResp?.ProductionTeams, t => t.Code, t => t.ProductionTeamId, codes.TeamCodes);
```

> [!TIP]
> Việc gọi trực tiếp tại khối điều phối giúp loại bỏ hoàn toàn 100% các phương thức mapper trung gian (Dead Code / Boilerplate Wrappers), giữ cho cấu trúc tệp `.cs` siêu tinh gọn, dễ bảo trì và tối ưu hiệu suất biên dịch.

---

## 💡 Quy tắc 9: Nguyên tắc chung (General Principle)

> 🔴 **KHÔNG over-defensive (kiểm thử/bảo vệ quá mức) khi Compiler hoặc Analyzer đã đảm bảo an toàn tuyệt đối (Safety) cho dữ liệu.**
