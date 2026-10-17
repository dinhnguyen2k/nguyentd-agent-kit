# Sub-Skill: C# LINQ & Collection Optimization

Sử dụng Sub-Skill này khi anh làm việc với mã nguồn C# (.NET 8) liên quan đến viết truy vấn LINQ, ánh xạ đối tượng (mapping), lọc dữ liệu (filter), hoặc xử lý danh sách (Collections) từ Database/gRPC.

---

## 🚀 Kịch bản Rà soát tự động (Automated Linter Tool)

Sub-Skill này đi kèm với một **Tool rà soát tự động** bằng Python đặt tại:
`[scan-linq.py](file:///home/nguyentd/cogain/cogain-core/.agent/skills/backend-csharp-optimization/scripts/scan-linq.py)`

### Cách sử dụng dành cho Agent & Nhà phát triển:
Trước khi hoàn tất bất kỳ thay đổi backend nào liên quan đến file C# (`*.cs`), **BẮT BUỘC** chạy lệnh sau từ terminal tại thư mục gốc của dự án để quét lỗi tự động.

Mặc định script chỉ quét các file C# đang thay đổi (unstaged, staged, untracked) trong `backend/src` và ghi report để dễ đọc/fix:
```bash
python3 .agent/skills/backend-csharp-optimization/scripts/scan-linq.py
```

Report mặc định được ghi tại:
```text
.agent/reports/scan-linq-report.txt
```

Nếu cần quét đúng file đang xử lý:
```bash
python3 .agent/skills/backend-csharp-optimization/scripts/scan-linq.py --files backend/src/Services/MasterData/MasterData.Services/Implement/Products/ProductService.Import.cs
```

Nếu cần quét full toàn bộ backend (legacy mode):
```bash
python3 .agent/skills/backend-csharp-optimization/scripts/scan-linq.py --all
```

Nếu cần report JSON để parse tự động:
```bash
python3 .agent/skills/backend-csharp-optimization/scripts/scan-linq.py --report-format json --report-file .agent/reports/scan-linq-report.json
```

Nếu muốn tự động dọn `using` không còn dùng (unused usings) chỉ trong đúng scope file đang quét:
```bash
python3 .agent/skills/backend-csharp-optimization/scripts/scan-linq.py --cleanup-unused-usings
```

Khi cần dọn theo file cụ thể:
```bash
python3 .agent/skills/backend-csharp-optimization/scripts/scan-linq.py --files backend/src/Services/MasterData/MasterData.Services/Implement/Production/SemiFinishedGoodService.Import.cs --cleanup-unused-usings
```

Nếu script phát hiện vi phạm, hãy tiến hành sửa mã nguồn theo đúng gợi ý của script trước khi bàn giao công việc.

---

## 💡 Quy tắc 1: Distinct().ToList() vs ToHashSet()

Dùng `ToHashSet()` khi collection là tập key/id để lookup/filter dữ liệu (độ phức tạp $O(1)$).

```csharp
var ids = rows.Select(x => x.Id).ToHashSet();

var entities = await repo.Query(x => ids.Contains(x.Id)).ToListAsync();
```

Dùng `Distinct().ToList()` khi cần list có thứ tự để iterate (duyệt), response, export, UI:

```csharp
var codes = rows.Select(x => x.Code).Distinct().ToList();
```

### ❌ Tránh Anti-pattern:
```csharp
// ❌ List lookup Contains tốn O(N) bộ nhớ phẳng và CPU so sánh
var ids = rows.Select(x => x.Id).Distinct().ToList();
items.Where(x => ids.Contains(x.Id));
```

### ✅ Nên đổi thành:
```csharp
// 👍 HashSet lookup O(1) tối ưu hiệu năng
var ids = rows.Select(x => x.Id).ToHashSet();
items.Where(x => ids.Contains(x.Id));
```

---

## 💡 Quy tắc 2: Tối ưu hóa thứ tự LINQ (Lọc trùng trước khi chuyển kiểu dữ liệu)

**Hành động**: **BẮT BUỘC** gọi `.Distinct()` trên Value Type (Guid, int...) **TRƯỚC** khi gọi `.Select(x => x.ToString())`.

### Rule ngắn gọn:
- Không viết: `.Select(x => x.Id.ToString()).Distinct().ToList()`
- Phải viết: `.Select(x => x.Id).Distinct().Select(id => id.ToString()).ToList()`
- Với nullable ID (`Guid?`, `int?`...): ưu tiên lọc null trước.

### ❌ Code SAI / Dễ lỗi (Before)
```csharp
var projectDetailIds = productionOrders
    .Select(o => o.ProjectDetailId.ToString()) // ❌ ToString trước khi loại trùng
    .Distinct()                                // ❌ Lọc trùng trên string
    .ToList();
```

### ✅ Code ĐÚNG / Tối ưu (After)
```csharp
var projectDetailIds = productionOrders
    .Select(o => o.ProjectDetailId)
    .Where(id => id != Guid.Empty)
    .Distinct()                  // 👍 Lọc trùng trên kiểu Guid (Value Type) cực nhanh ở mức phần cứng
    .Select(id => id.ToString()) // 👍 Chỉ gọi ToString() cho các Guid duy nhất (Unique)
    .ToList();                   // 👍 GC không phải dọn dẹp hàng ngàn chuỗi rác trên Heap
```

### ✅ Với nullable ID (khuyến nghị)
```csharp
var projectDetailIds = productionOrders
    .Where(o => o.ProjectDetailId.HasValue)
    .Select(o => o.ProjectDetailId.Value)
    .Distinct()
    .Select(id => id.ToString())
    .ToList();
```

Lý do:
- Tránh tạo string thừa cho các ID trùng.
- `Distinct()` trên Guid/int/long thường rẻ hơn distinct trên string.
- Giảm allocation trên heap.
- Tránh phát sinh chuỗi rỗng không mong muốn từ nullable ID.

---

## 💡 Quy tắc 3: Chọn Any(), Count property, Count(), AnyAsync() theo đúng source type

**Hành động**: Không dùng máy móc một kiểu. Chọn phương thức kiểm tra sự tồn tại hoặc số lượng phần tử dựa theo kiểu dữ liệu (source type) thực tế của collection:

### Case 1: Source là `IEnumerable<T>` thuần (chỉ cần check có phần tử hay không)
- **Hành động**: Dùng `.Any()`, không dùng `.Count() > 0`.
- **Lý do**: Quy tắc `CA1827` của Microsoft Learn chỉ ra rằng `Count()` hoặc `LongCount()` để kiểm tra có phần tử sẽ bắt buộc phải duyệt (enumerate) toàn bộ collection để đếm, trong khi `Any()` sẽ trả về kết quả ngay lập tức khi tìm thấy phần tử đầu tiên.
- **Ví dụ**:
  ```csharp
  // ❌ Bad
  if (rows.Count() > 0) { ... }

  // ✅ Good
  if (rows.Any()) { ... }
  ```

### Case 2: Source là `List<T>`, array, `ICollection<T>`, `IReadOnlyCollection<T>`
- **Hành động**: Dùng property `.Count` hoặc `.Length`, không dùng `.Any()` và không dùng `.Count()` extension method.
- **Lý do**: Quy tắc `CA1860` khuyến nghị dùng Length, Count, hoặc IsEmpty nếu collection có property sẵn thay vì gọi Enumerable.Any(). Quy tắc `CA1829` khuyến nghị dùng Length/Count property thay cho Enumerable.Count() để tránh cấp phát IEnumerator không cần thiết.
- **Ví dụ**:
  ```csharp
  // ❌ Bad
  if (items.Any()) { ... }
  var count = items.Count();

  // ✅ Good
  if (items.Count > 0) { ... }
  var count = items.Count;
  ```

### Case 3: Source là EF Core `IQueryable<T>` (chỉ cần kiểm tra tồn tại phía Database)
- **Hành động**: Dùng `AnyAsync()`, không dùng `CountAsync() > 0`.
- **Lý do**: Quy tắc `CA1828` nêu rõ CountAsync/LongCountAsync để check tồn tại sẽ chạy câu lệnh SQL COUNT(*) và đếm toàn bộ, trong khi AnyAsync sinh ra câu SQL EXISTS hiệu quả hơn nhiều.
- **Ví dụ**:
  ```csharp
  // ❌ Bad
  if (await query.CountAsync() > 0) { ... }

  // ✅ Good
  if (await query.AnyAsync()) { ... }
  ```

---

## 💡 Quy tắc 4: Tránh ToList() không cần thiết (Avoid unnecessary ToList())

Không thực hiện materialize danh sách bằng cách gọi `.ToList()` nếu method tiếp theo chỉ nhận `IEnumerable<T>` và chỉ thực hiện duyệt qua (enumerate) đúng một lần.

### ❌ Bad:
```csharp
// ❌ Gọi ToList() tạo mảng mới trên Heap không cần thiết
await EnrichAsync(items.ToList());
```

### ✅ Good:
```csharp
// 👍 Truyền thẳng IEnumerable, compiler tự động duyệt qua
await EnrichAsync(items);
```

### 🛠️ Chỉ sử dụng `.ToList()` khi:
1. Method bắt buộc yêu cầu tham số kiểu dữ liệu là `List<T>`.
2. Cần lấy `Count`, truy cập theo chỉ mục (`index`), hoặc muốn thay đổi danh sách (`mutate list`).
3. Muốn tránh multiple enumeration (duyệt danh sách nhiều lần trên IEnumerable).
4. Cần chụp lại snapshot dữ liệu tại thời điểm hiện tại.

Nếu bắt buộc dùng `List<T>`, hãy materialize và kiểm tra trước khi truyền:
```csharp
var list = items.ToList();

if (list.Count > 0)
    await EnrichAsync(list);
```

---

## 💡 Quy tắc 5: Kết hợp gRPC Response Map & Dictionary Lookup

**Hành động**: Chuyển danh sách đối tượng đích về Dictionary để tra cứu nhanh bằng ID nhằm giảm độ phức tạp từ $O(N \times M)$ xuống $O(N + M)$.

### ❌ Code SAI / Dễ lỗi (Before)
```csharp
// Tìm kiếm phần tử bằng FirstOrDefault trong vòng lặp (Độ phức tạp O(N*M))
foreach (var pd in pdResponse.Items)
{
    var fg = fgResponse.Items.FirstOrDefault(f => f.Id == pd.FinishedGoodId);
    if (fg != null)
    {
        finishedGoodMap[pd.Id] = fg;
    }
}
```

### ✅ Code ĐÚNG / Tối ưu (After)
```csharp
// Chuyển danh sách đích về Dictionary trước (O(M))
var fgDict = fgResponse.Items
    .Where(fg => !string.IsNullOrEmpty(fg.Id))
    .ToDictionary(fg => fg.Id, fg => fg);

// Duyệt và tra cứu O(1) qua TryGetValue (Tổng độ phức tạp giảm còn O(N + M))
foreach (var pd in pdResponse.Items)
{
    if (Guid.TryParse(pd.Id, out var pdId) && 
        !string.IsNullOrEmpty(pd.FinishedGoodId) && 
        fgDict.TryGetValue(pd.FinishedGoodId, out var fg))
    {
        finishedGoodMap[pdId] = fg;
    }
}
```

---

## 💡 Quy tắc 6: List<T>.ConvertAll() và Select().ToList()

**Hành động**: Khi nguồn dữ liệu ở mức compile-time đã chắc chắn là một `List<T>` cụ thể (concrete `List<T>`) và thao tác chỉ là ánh xạ 1-1 sang một `List<TResult>`, **ƯU TIÊN** sử dụng phương thức `ConvertAll()` thay vì chuỗi `.Select(...).ToList()`, đặc biệt là trong các hot path (vòng lặp hiệu năng cao), xử lý dữ liệu lớn (import/batch/export) hoặc các đoạn code có tần suất chạy lớn. 

*Lưu ý*: Với code nghiệp vụ nhỏ hoặc danh sách số lượng ít, sử dụng LINQ `.Select(...).ToList()` vẫn hoàn toàn chấp nhận được nếu nó giúp code đồng bộ, quen thuộc và dễ đọc hơn đối với nhóm phát triển.

### Tại sao?
- **Tối ưu hóa hiệu năng & Cấp phát**: `.Select().ToList()` thường phải đi qua các LINQ iterator và delegate chain trung gian, đồng thời việc khởi tạo List đích từ IEnumerable có thể không tối ưu được dung lượng ban đầu chính xác (tuỳ thuộc vào cơ chế nội bộ của .NET). Trong khi đó, `ConvertAll()` là phương thức trực tiếp trên `List<T>` cụ thể. Nó biết trước chính xác kích thước của danh sách nguồn, do đó cấp phát ngay lập tức danh sách đích với capacity chính xác ngay từ đầu, tránh hoàn toàn chi phí re-allocation và resize mảng động.
- **Điều kiện áp dụng**: Chỉ áp dụng khi biến nguồn thực sự có kiểu tĩnh là `List<T>`. Nếu nguồn là `IEnumerable<T>`, `IReadOnlyList<T>`, `ICollection<T>`, truy vấn EF Core (IQueryable), hoặc nằm trong một chuỗi pipeline phức tạp có chứa `.Where()`, `.OrderBy()`, `.GroupBy()`, v.v., thì không sử dụng `ConvertAll` để tránh làm code bị phân mảnh và giảm tính thẩm mỹ/đồng bộ của LINQ.

### ❌ Pattern chưa tối ưu (Before - đặc biệt trong hot paths / batch import)
```csharp
var semiFinishedGoodsDto = sfgDetails.Select(d => new ProductionOrderSemiFinishedSourceDto
{
    Id = Guid.NewGuid(),
    ModelId = d.ModelId,
    Quantity = d.Quantity,
    ModelCode = d.Model.Code,
    ModelName = d.Model.Name,
    SourceKey = d.ModelId.ToString()
}).ToList();
```

### ✅ Pattern tối ưu hơn (After)
```csharp
var semiFinishedGoodsDto = sfgDetails.ConvertAll(d => new ProductionOrderSemiFinishedSourceDto
{
    Id = Guid.NewGuid(),
    ModelId = d.ModelId,
    Quantity = d.Quantity,
    ModelCode = d.Model.Code,
    ModelName = d.Model.Name,
    SourceKey = d.ModelId.ToString()
});
```

---

## 💡 Quy tắc 7: Tránh duyệt `IEnumerable<T>` nhiều lần — Possible Multiple Enumeration

**Hành động**: Khi biến có kiểu `IEnumerable<T>` thuần, **KHÔNG** vừa gọi `.Count()`, `.Any()`, `.Last()`, `.First()` rồi lại duyệt `foreach`/LINQ tiếp trên cùng sequence đó nếu sequence đó có thể là lazy LINQ, DB query (IQueryable), yield return, stream, hoặc gRPC/page iterator.

### Tại sao?
Microsoft Learn cảnh báo quy tắc `CA1851`: nhiều LINQ method như `Select`, `Where` dùng cơ chế trì hoãn thực thi (deferred execution); kết quả không được tính một lần rồi cache lại. Nếu enumerate nhiều lần, query có thể chạy lại nhiều lần, tốn tài nguyên, hoặc sinh bug ngoài ý muốn nếu enumeration đó có side effect.

### ❌ Bad (Duyệt nhiều lần):
```csharp
public void Process(IEnumerable<OrderRow> rows)
{
    var count = rows.Count(); // ❌ Enumerate lần 1 (để đếm)

    foreach (var row in rows) // ❌ Enumerate lần 2 (để xử lý)
    {
        Handle(row);
    }
}
```

### ✅ Good (Materialize một lần nếu cần dùng nhiều lần):
```csharp
public void Process(IEnumerable<OrderRow> rows)
{
    // Dùng pattern matching / ép kiểu nhanh hoặc materialize bằng ToList()
    var list = rows as IList<OrderRow> ?? rows.ToList();

    var count = list.Count; // 👍 Truy cập property O(1) không duyệt lại

    foreach (var row in list) // 👍 Duyệt qua list trong memory
    {
        Handle(row);
    }
}
```

### ✅ Good hơn (Thay đổi Contract nếu method thật sự cần Count + Duyệt):
```csharp
public void Process(IReadOnlyCollection<OrderRow> rows)
{
    if (rows.Count == 0)
        return;

    foreach (var row in rows)
    {
        Handle(row);
    }
}
```

### Khi nào được phép bỏ qua?
1. Biến compile-time thực tế đã là `List<T>`, array, `ICollection<T>`, `IReadOnlyCollection<T>`.
2. Phương thức nhận `IEnumerable<T>` chỉ thực hiện duyệt qua đúng một lần.
3. Dữ liệu rất nhỏ, nằm hoàn toàn trong bộ nhớ và không nằm trong hot path.

---

## 💡 Quy tắc 8: Với List/Array/IReadOnlyList, ưu tiên property/indexer thay vì LINQ First/Last/Count

**Hành động**: Khi source đã là `List<T>`, array, `IReadOnlyList<T>`, hoặc collection có indexer cụ thể, không sử dụng các LINQ extension method nếu có thể truy cập trực tiếp bằng property/indexer tương đương.

### Tại sao?
Quy tắc `CA1826` khuyến nghị dùng property/indexer thay vì LINQ `Count`, `First`, `FirstOrDefault`, `Last`, `LastOrDefault` trên các collection có API tương ứng để đạt hiệu năng tốt hơn (tránh tạo cấu trúc lặp, delegate và iterator allocations).

### ❌ Bad:
```csharp
var first = items.First();
var last = items.Last();
var count = items.Count();
```

### ✅ Good:
```csharp
var first = items[0];
var last = items[^1]; // Sử dụng index từ cuối mảng của C# 8.0+
var count = items.Count;
```

### Với nullable/safe access:
```csharp
if (items.Count == 0)
    return null;

var first = items[0];
var last = items[^1];
```

### Không áp dụng khi:
1. Source là `IEnumerable<T>` thuần chưa được materialize.
2. Có pipeline LINQ filter/order trước đó (ví dụ: `items.Where(...).First()`).
3. Cần semantic rõ ràng của `FirstOrDefault(predicate)` có truyền lambda:
   `var matched = items.FirstOrDefault(x => x.Code == code);`

---

## 💡 Quy tắc 9: Sử dụng API Dictionary lookup đúng cách (Tránh ContainsKey + indexer và Keys.Contains)

**Hành động**: Với `Dictionary<TKey, TValue>` hoặc `IDictionary<TKey, TValue>`, sử dụng đúng API lookup để tối ưu hóa hiệu năng tìm kiếm và gán giá trị.

### 9.1. Không dùng `dictionary.Keys.Contains(key)`
- **Hành động**: Thay thế `dictionary.Keys.Contains(key)` bằng `dictionary.ContainsKey(key)`.
- **Lý do**: Quy tắc `CA1841` chỉ ra rằng việc truy cập `.Keys` hoặc `.Values` có thể phát sinh allocation không đáng có, và LINQ `Contains` trên `IEnumerable<T>` có độ phức tạp $O(N)$ trong khi Dictionary key lookup gốc có độ phức tạp $O(1)$.
- **Ví dụ**:
  ```csharp
  // ❌ Bad
  if (customerMap.Keys.Contains(customerId)) { ... }

  // ✅ Good
  if (customerMap.ContainsKey(customerId)) { ... }
  ```

### 9.2. Không dùng ContainsKey rồi mới lấy giá trị bằng indexer
- **Hành động**: Sử dụng `TryGetValue()` để vừa kiểm tra sự tồn tại và vừa lấy ra giá trị trong một lần lookup duy nhất.
- **Lý do**: Quy tắc `CA1854` chỉ ra rằng `ContainsKey` + indexer sẽ phải thực hiện lookup key đến 2 lần độc lập; sử dụng `TryGetValue()` rút ngắn xuống 1 lần duy nhất.
- **Ví dụ**:
  ```csharp
  // ❌ Bad
  if (customerMap.ContainsKey(customerId))
  {
      var customer = customerMap[customerId]; // ❌ Lookup lần 2
      Use(customer);
  }

  // ✅ Good
  if (customerMap.TryGetValue(customerId, out var customer)) // 👍 Lookup 1 lần
  {
      Use(customer);
  }
  ```

### Khi nào vẫn dùng ContainsKey?
Dùng `ContainsKey()` khi bạn chỉ cần kiểm tra xem key có tồn tại hay không và không hề có nhu cầu lấy hay sử dụng giá trị đi kèm với key đó:
```csharp
if (processedIds.ContainsKey(id))
{
    continue;
}
```

---

## 💡 Quy tắc 10: Tối ưu hóa thêm phần tử vào Dictionary (Ưu tiên TryAdd)

**Hành động**: Khi muốn thêm một phần tử vào Dictionary nếu key của nó chưa tồn tại, hãy dùng `TryAdd()` thay vì kiểm tra `ContainsKey()` rồi mới gọi `Add()`.

### Tại sao?
Quy tắc `CA1864` chỉ ra rằng việc gọi cả `ContainsKey` và `Add` đều thực hiện lookup key độc lập, gây dư thừa. `TryAdd` hiệu quả hơn vì nó chỉ lookup 1 lần để thực hiện kiểm tra và thêm phần tử, đồng thời không ghi đè giá trị nếu key đã tồn tại.

### ❌ Bad:
```csharp
if (!errorMap.ContainsKey(row.Code))
{
    errorMap.Add(row.Code, errorMessage); // ❌ Lookup lần 2
}
```

### ✅ Good:
```csharp
errorMap.TryAdd(row.Code, errorMessage); // 👍 Tự động check và add trong 1 lần lookup
```

### Nếu cần xử lý logic khi key đã tồn tại:
```csharp
if (!errorMap.TryAdd(row.Code, errorMessage))
{
    errorMap[row.Code] += $"; {errorMessage}"; // Xử lý append chuỗi lỗi khi đã trùng key
}
```

### Nếu chủ đích là ghi đè (overwrite) giá trị bất kể có tồn tại hay chưa:
```csharp
errorMap[row.Code] = errorMessage; // Sử dụng trực tiếp indexer
```

---

## 💡 Quy tắc 11: Giữ LINQ query ở trạng thái deferred, chỉ materialize ở biên xử lý

**Hành động**: Không gọi `.ToList()`, `.ToArray()`, `.ToDictionary()` quá sớm khi phía sau vẫn còn các phương thức lọc/biến đổi dữ liệu khác như `.Where()`, `.Select()`, `.OrderBy()`, `.Skip()`, `.Take()`.

### Tại sao?
Các phương thức LINQ như `Where`, `Select` sử dụng cơ chế trì hoãn thực thi (deferred execution). Việc gọi `.ToList()` hoặc `.ToArray()` quá sớm sẽ ép query thực thi ngay lập tức (immediate execution) và cache toàn bộ kết quả thô vào RAM, làm mất đi khả năng tối ưu hóa truy vấn của database engine (trong EF Core) hoặc gây lãng phí bộ nhớ heap đối với in-memory collections.

### ❌ Bad (Materialize quá sớm gây lãng phí tài nguyên):
```csharp
// ❌ Gọi ToListAsync() tải toàn bộ dữ liệu thô từ Database lên RAM trước khi lọc
var activeUsers = await dbContext.Users.ToListAsync(); 

var result = activeUsers
    .Where(x => x.IsActive)
    .Select(x => new UserDto { Id = x.Id, Name = x.Name })
    .ToList();
```

### ✅ Good (Xây dựng query deferred trước, materialize sau):
```csharp
// 👍 SQL được sinh ra sẽ chứa sẵn WHERE và SELECT, Database chỉ trả về các trường cần thiết của user active
var result = await dbContext.Users
    .Where(x => x.IsActive)
    .Select(x => new UserDto { Id = x.Id, Name = x.Name })
    .ToListAsync();
```

### Với in-memory collection (IEnumerable):
```csharp
var result = rows
    .Where(x => x.IsValid)
    .Select(x => new RowDto { Code = x.Code, Name = x.Name })
    .ToList(); // 👍 Chỉ gọi ToList() ở bước cuối cùng
```

### Chỉ materialize sớm khi:
1. Cần chụp lại snapshot dữ liệu cố định tại thời điểm hiện tại.
2. Cần tránh lỗi duyệt nhiều lần (Multiple Enumeration).
3. Cần thay đổi cấu trúc danh sách (mutate list).
4. Phương thức tiếp theo bắt buộc nhận tham số kiểu `List<T>` hoặc `T[]`.
5. Cần tách biệt phần query database khỏi phần xử lý logic in-memory không dịch được sang SQL.

---

## 💡 Quy tắc 12: Dùng TryGetNonEnumeratedCount khi cần Count của IEnumerable<T> không muốn duyệt

**Hành động**: Nếu phương thức nhận vào một `IEnumerable<T>` và bạn chỉ muốn lấy số lượng phần tử để phục vụ mục đích pre-allocate (khởi tạo kích thước danh sách đích), ghi log, hoặc hiển thị tiến độ mà không muốn tốn chi phí duyệt qua sequence, hãy dùng `TryGetNonEnumeratedCount`.

### Tại sao?
Phương thức `TryGetNonEnumeratedCount` cố gắng xác định số lượng phần tử của sequence mà không buộc phải thực hiện duyệt qua nó. Phương thức này kiểm tra nhanh bằng cách so khớp kiểu (type-test) với các kiểu collection phổ biến đã biết sẵn kích thước như `ICollection<T>`, `ICollection`, và một số kiểu nội bộ của LINQ.

### ❌ Bad:
```csharp
public List<OrderDto> Map(IEnumerable<Order> orders)
{
    var result = new List<OrderDto>(orders.Count()); // ❌ Gọi Count() có thể ép duyệt toàn bộ sequence O(N)

    foreach (var order in orders)
    {
        result.Add(Map(order));
    }
    return result;
}
```

### ✅ Good:
```csharp
public List<OrderDto> Map(IEnumerable<Order> orders)
{
    // 👍 Tận dụng TryGetNonEnumeratedCount để set capacity nếu lấy được count O(1)
    var result = orders.TryGetNonEnumeratedCount(out var count)
        ? new List<OrderDto>(count)
        : new List<OrderDto>();

    foreach (var order in orders)
    {
        result.Add(Map(order));
    }
    return result;
}
```

### Không dùng khi:
1. Source tĩnh đã là `List<T>`, array, hoặc collection có sẵn property `.Count`.
2. Bạn bắt buộc cần số lượng chính xác tuyệt đối ở mọi thời điểm và chấp nhận chi phí duyệt qua sequence.
3. Phương thức chỉ duyệt sequence một lần duy nhất và không có nhu cầu tối ưu hóa dung lượng cấp phát ban đầu.
```

---

## Rule 13: EF Core Select() Projection — tránh Include() cho Read-Only Query

### Nguyên tắc
Khi query chỉ cần **một vài field** từ entity hoặc navigation property, **PHẢI** dùng `.Select()` projection thay vì `.Include()` để:
- Giảm lượng dữ liệu truyền từ DB (SQL chỉ SELECT các cột cần thiết).
- Tránh track entity không cần thiết (kết hợp `.AsNoTracking()`).
- Giảm memory footprint đáng kể khi entity có nhiều cột hoặc navigation lớn.

### Vi phạm — fetch toàn bộ entity + Include

```csharp
// ❌ BAD: Include() load nguyên entity FinishedGood và Model dù chỉ cần Code + Name
var projectDetails = await _unitOfWork.GetRepository<ProjectDetail>().Query()
    .AsNoTracking()
    .Include(pd => pd.FinishedGood)  // load ALL columns of FinishedGood
    .Include(pd => pd.Model)         // load ALL columns of Model
    .Where(pd => pd.ProjectId == projectId)
    .ToListAsync();

// Rồi access pd.FinishedGood?.Code, pd.FinishedGood?.Name... chỉ vài field
```

### Chuẩn — Select() projection chỉ lấy fields cần

```csharp
// ✅ GOOD: Select() chỉ project fields thực sự cần
var projectDetails = await _unitOfWork.GetRepository<ProjectDetail>().Query()
    .AsNoTracking()
    .Where(pd => pd.ProjectId == projectId)
    .Select(pd => new
    {
        pd.Id,
        pd.ModelId,
        FinishedGoodCode = pd.FinishedGood != null ? pd.FinishedGood.Code : null,
        FinishedGoodName = pd.FinishedGood != null ? pd.FinishedGood.Name : null,
        ModelCode = pd.Model != null ? pd.Model.Code : null,
        ModelName = pd.Model != null ? pd.Model.Name : null,
    })
    .ToListAsync();
```

### Khi nào vẫn dùng Include():
1. **Write operation** — cần track entity để update/delete (`.Include()` + tracked context).
2. **Cần toàn bộ fields** — ví dụ mapping entity sang full DTO với AutoMapper profile.
3. **Cần thao tác trên navigation** — add/remove items trong child collection.

### Combo tối ưu thường gặp:
```csharp
// Select() + Dictionary lookup + OrderBy = O(n+m) thay vì O(n×m)
var templateLookup = await _unitOfWork.GetRepository<ItemTemplate>().Query()
    .AsNoTracking()
    .Where(it => codes.Contains(it.ItemCode))
    .Select(it => new { it.Id, it.Code, it.Name, it.ItemCode, it.ModelId })
    .ToListAsync()
    .ContinueWith(t => t.Result
        .GroupBy(x => x.ItemCode ?? "", StringComparer.OrdinalIgnoreCase)
        .ToDictionary(g => g.Key, g => g.OrderBy(x => x.Id).ToList(),
            StringComparer.OrdinalIgnoreCase));
```

### Tham khảo:
- [Microsoft Learn — Efficient Querying](https://learn.microsoft.com/en-us/ef/core/performance/efficient-querying#project-only-properties-you-need)
- Rule 5 (Dictionary Lookup) — kết hợp để loại bỏ O(n×m) pattern.
- Rule 4 (Avoid unnecessary ToList) — đặt `.Select()` **trước** `.ToListAsync()` để DB thực hiện projection.

