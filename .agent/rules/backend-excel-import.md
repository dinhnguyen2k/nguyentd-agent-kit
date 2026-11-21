---
trigger: glob
glob: 'backend/src/Services/**/*.Import*.cs,backend/src/Services/**/*.Export*.cs,backend/src/Services/**/*ReportService*.cs'
description: "Backend Excel import/export rules (hook-only architecture, Infrastructure.Services.Excel base, ClosedXML mapping) for backend/src/Services Import/Export/Report code."
condition: ["backend/src/Services/**/*.Import*.cs", "backend/src/Services/**/*.Export*.cs", "backend/src/Services/**/*ReportService*.cs"]
paths: ["backend/src/Services/**/*.Import*.cs", "backend/src/Services/**/*.Export*.cs", "backend/src/Services/**/*ReportService*.cs"]
interruptMode: never
---

# Backend Excel Import/Export Rules

> Scope: Excel import/export trong `backend/src/Services/**`.

## 0. Hook-Only Architecture (BẮT BUỘC — Ưu Tiên Cao Nhất)

Không override method orchestration của `BaseService`; chỉ tùy biến qua hook.

### Các method CẤM override trong class con:

| Method gốc                                 | Lý do cấm                                               |
| ------------------------------------------ | ------------------------------------------------------- |
| `ImportFromExcel` / `ImportFromExcelAsync` | BaseService sở hữu parse → validate → persist → result. |
| `ExportTemplateAsync`                      | BaseService sở hữu upload/result/file name.             |
| `ExportDataAsync`                          | BaseService sở hữu upload/result/file name.             |

### Các hook Import được phép override:

```
BaseService.ImportFromExcel pipeline:
  ┌─ Validate file format
  ├─ CustomParseExcelToDtosAsync()      ← HOOK: Đọc Excel, map DTO trung gian, gán state
  ├─ LoadImportReferencesAsync()        ← HOOK: Query DB/gRPC lấy reference (Dictionary cache O(1))
  ├─ ValidateImportDtosAsync()          ← HOOK: Validate + phân loại toCreate/toUpdate/toDelete
  ├─ PrepareImportEntitiesAsync()       ← HOOK: Trả về tuple đã chuẩn bị từ bước Validate
  ├─ BeforeImportPersistAsync()         ← HOOK: Logic trước khi persist (nếu có)
  ├─ Persist (BaseService tự xử lý)
  └─ AfterImportPersistAsync()          ← HOOK: Logic sau khi persist thành công (nếu có)
```

### Các hook Export được phép override:

```
Export pipeline:
  ├─ GetExportTemplateFileName()        ← HOOK: Tên file mẫu
  ├─ GetExportDataFileName()            ← HOOK: Tên file xuất
  ├─ GenerateTemplateBytesAsync()       ← HOOK: Tạo byte[] file mẫu
  └─ GenerateExportDataBytesAsync()     ← HOOK: Tạo byte[] file dữ liệu
```

### Vi phạm — REJECT ngay lập tức:

1. Viết `public override async Task<...> ImportFromExcel(...)` trong class con.
2. Copy logic từ `BaseService.ImportFromExcel` rồi sửa trong class con.
3. Gọi trực tiếp `_repository.AddAsync`, `_unitOfWork.SaveChangesAsync` trong luồng import thay vì dùng hook.
4. Bỏ qua hook `ValidateImportDtosAsync` và tự viết validation inline.
5. Tự tạo method import mới (ví dụ: `CustomImport`, `MyImportFromExcel`) rồi bypass pipeline chuẩn.

> **Nếu BaseService thiếu hook cần thiết**: Báo cáo cho người dùng và đề xuất mở rộng BaseService thêm hook mới. KHÔNG bao giờ workaround bằng cách override method gốc.

## 1. Structure

1. Logic lớn tách `partial class`: `{Entity}Service.Import.cs`, `.Import.Parsing.cs`, `.Import.Lookups.cs`, `.Export.cs`.
2. Không gom parse, lookup, validate, persist và workbook generation vào một method.
3. Main flow phải tuyến tính: validate → parse → collect/resolve lookup → validate references → persist → result.

## 2. Header And Sheet Schema

1. Không hardcode tên header hoặc sheet rải rác trong code.
2. Với luồng chuyển sang DTO + attributes, dùng Excel row DTO riêng cho từng sheet làm nguồn metadata duy nhất.
   Khai báo vị trí, tiêu đề, alias và ràng buộc ô trên property; không gắn metadata Excel lên entity hoặc DTO API.
   Helper biên dịch metadata sang `ExcelSheetSchema`, sinh `Titles`, alias có ràng buộc vị trí và layout import cũ một lần theo type, không dựng lại theo từng dòng dữ liệu.
   Không suy thứ tự cột từ reflection hoặc suy bắt buộc nhập từ nullable và dấu `(*)`.
   Chỉ map property được khai báo cho Excel; cấu hình type không hỗ trợ hoặc vị trí cột sai phải báo lỗi rõ ràng.
   Reader/writer dùng getter/setter đã chuẩn bị, không reflection từng ô; giữ số dòng, thứ tự và lỗi parse để service tiếp tục xử lý nghiệp vụ.
   Metadata dùng chung không chứa trạng thái workbook; dropdown và hướng dẫn phụ thuộc ngữ cảnh phải cấu hình riêng cho từng workbook.
   Template, export, import, nhãn lỗi parser và tên cột trong sheet hướng dẫn phải đọc cùng schema.
   Không duy trì đồng thời DTO attributes, bộ constants hoặc danh sách descriptor chứa cùng metadata.
   Luồng chưa chuyển đổi được giữ `{Entity}Headers`, descriptor, `ExcelSheetSchema` hoặc header arrays hiện tại, không bắt buộc migrate ngoài phạm vi task.
3. Tên sheet chính khai báo tại attribute của Excel row DTO hoặc schema/constants của luồng chưa chuyển đổi, không khai báo trùng ở cả hai nơi.
   Tên sheet reference gom vào nhóm constants và dùng prefix `Data_...`.
4. Alias tiêu đề khai báo cạnh cột, alias tên sheet khai báo trong schema; helper chung xử lý tương thích, không lặp chuỗi `if/else` hoặc sửa nội dung ô header trước khi validate.
   Alias mặc định so khớp chính xác sau chuẩn hóa; so khớp chuỗi con phải được khai báo riêng và giới hạn đúng cột.
5. Chỉ khai báo legacy bằng prefix khi layout cũ đúng là N cột đầu của layout hiện tại, giữ nguyên tên chuẩn và thứ tự.
   Layout có chèn, bỏ ở giữa hoặc đổi thứ tự cột phải khai báo đầy đủ, không tự suy đoán hay dịch chuyển cột.
   Prefix chỉ phục vụ import, không được làm thay đổi template/export hiện tại.
6. Cấu hình sai như tiêu đề hoặc alias rỗng sau chuẩn hóa, key layout trùng/dành riêng, prefix vượt phạm vi phải báo lỗi rõ ràng.
   Không bỏ qua cấu hình sai, không để alias rỗng khớp mọi tiêu đề và không chọn tùy ý khi nhiều layout cùng khớp.
7. Cột hệ thống tự tính vẫn xuất hiện trong template/export khi contract yêu cầu, nhưng reader bỏ qua giá trị nhập của cột được khai báo bỏ qua import.
   Không đưa công thức nghiệp vụ, lookup hoặc mặc định nghiệp vụ vào helper chuyển kiểu để che dữ liệu thiếu hoặc sai.

## 3. Parsing Rules

1. Parsing row chỉ đọc cell và tạo parsed row object; không gọi DB/gRPC trong parsing method.
2. Parsed row records phải giữ field dạng raw code/string trước khi resolve ID.
3. Không parse cùng một sheet bằng nhiều convention khác nhau trong nhiều method.
4. Column index phụ thuộc header động phải resolve qua helper như `ResolveColumnIndex`, không dùng magic number nếu header có khả năng thay đổi.
5. Bước parse chỉ báo lỗi của chính ô giá trị (sai kiểu, sai định dạng ngày/số, ô giá trị bắt buộc bị trống qua `CellRequired`, vượt độ dài), kèm sheet + dòng + field rõ ràng.
   Mã danh mục/khóa tham chiếu không báo lỗi và không bị bỏ dòng (`continue`) ở bước parse; parsed row giữ raw code, kể cả null/rỗng, để `ValidateImportDtosAsync` báo một lần cho toàn bộ các dòng.
   Chỉ bỏ dòng trống hoàn toàn; lỗi cấu trúc sheet/header vẫn báo ngay tại parse.
   Ngoại lệ: dòng con không gắn được vào DTO cha lồng nhau (mã cha không có trong sheet cha) được báo lỗi tại parse kèm sheet + dòng.
   Áp dụng cho code mới hoặc code đang sửa.
6. Date import phải normalize về format gRPC/backend thống nhất, ví dụ `yyyy-MM-dd`, sau khi parse thành công.

## 4. Lookup Collection Rules

1. Không viết nhiều đoạn `SelectMany(...).Distinct(...).ToList()` lặp lại cho từng loại code/ID.
2. Gom input vào object như `ImportLookupCodes`, dùng `HashSet<string>(StringComparer.OrdinalIgnoreCase)` cho code và `HashSet<Guid>` cho ID.

3. Collect lookup input trong một method riêng, ví dụ `CollectImportLookupCodes(...)`.
4. Dùng `HashSet` ngay từ đầu.
5. Không tạo intermediate list lớn như `allDetails.ToList()` nếu chỉ dùng để lấy lookup input; duyệt trực tiếp `entities -> Details`.
6. Helper thêm code phải bỏ qua null/blank.

## 5. Lookup Resolution Rules

1. Tạo object output cho lookup result, ví dụ `ResolvedImportLookups` hoặc `ResolvedExportLookups`.
2. Main flow không nên giữ 8-10 biến lookup rời rạc như `uoms`, `products`, `services`, `models`.
3. Lookup method phải tự short-circuit khi input rỗng, hoặc caller phải dùng helper/task wrapper rõ ràng.
4. Không gọi DB/gRPC khi set lookup rỗng.
5. Resolve gRPC/DB lookup độc lập thì chạy parallel bằng `Task.WhenAll`.
6. Mọi missing reference phải gom lỗi trước khi persist; không để import chạy nửa chừng rồi mới fail vì thiếu lookup.
7. Missing-code validation phải dùng comparer phù hợp:
   - code: `StringComparer.OrdinalIgnoreCase`
   - ID: `Guid` exact match

## 6. Export Template Rules

**Đồng nhất template Import/Export (BẮT BUỘC):** Template Excel dùng cho Import và template Excel dùng cho Export phải có cùng cấu trúc dữ liệu: cùng sheet dữ liệu, tên và thứ tự header, số lượng và thứ tự cột, kiểu và ý nghĩa của từng cột.
Mapping header/parser của Import và mapping của Export phải ánh xạ đối xứng; cấm thêm, bỏ, đổi tên hoặc đổi thứ tự cột riêng một phía.
Nếu Export tạo workbook dữ liệu thay vì template trống, cấu trúc cột phải tuân thủ contract này và dữ liệu phải nhập lại được qua luồng Import mà không đổi ý nghĩa.
Không tự tạo ngoại lệ vì yêu cầu riêng của service; nếu yêu cầu sản phẩm mâu thuẫn với quy tắc này, phải báo người dùng để chốt thay đổi quy tắc trước khi triển khai.

1. Template sheet order phải ổn định và rõ ràng.
2. Data validation phải reference sheet `Data_...`, không dùng tên mơ hồ như `DS ...`.
3. Khi đổi header order, phải cập nhật đồng bộ:
   - thứ tự cột trong schema hoặc header arrays của luồng chưa chuyển đổi
   - parsing cell indexes
   - data validation columns
   - export write columns
4. Reference sheet headers cũng khai báo tập trung bằng schema hoặc constants, không lặp tên cột ở nhiều nơi.
5. Protected/reference sheets không được chứa secret hoặc hardcoded credential mới. Nếu phải protect workbook, dùng pattern hiện có và không tăng phạm vi secret.

## 6A. Excel Export Base (`Infrastructure.Services.Excel` — BẮT BUỘC cho code Export mới hoặc đang sửa)

Mọi luồng xuất Excel dữ liệu hoặc báo cáo viết mới / nâng cấp phải dùng bộ base tại `backend/src/BuildingBlocks/Infrastructure/Services/Excel/` thay vì tự dựng `XLWorkbook` hay gọi `AdjustToContents()` thủ công. Các luồng cũ ngoài phạm vi task giữ nguyên ổn định, chỉ dọn cuốn chiếu khi chạm tới.

Chọn đúng 1 trong 2 nhánh theo bản chất dữ liệu xuất:

1. **Xuất dữ liệu theo mẫu nhập (`ExcelDataExporter` trong `GenerateExportDataBytesAsync`):**
   - Luồng đã có `ExcelSheetDefinition<T>`: dùng `ExcelDataExporter.WriteBytes(ExcelDataSheet.From(rows, definition, overrides...))` (dùng `ExcelDataColumnOverride` nếu cần chỉnh `Width` / `WrapText`).
   - Luồng bảng phẳng chưa có attribute DTO: dùng `ExcelDataExporter.WriteBytes(ExcelDataSheet.FromColumns(sheetName, rows, columns))` với `ExcelDataColumn<T>`.
   - **Cấm** tự thêm cột STT, dòng tổng cộng, tiêu đề gộp hay đổi thứ tự cột làm gãy khả năng nhập lại qua `ImportFromExcel`.

2. **Xuất báo cáo để đọc / đối soát (`ExcelReportWriter`):**
   - Dùng `ExcelReportWriter.Write(new ExcelReport(Sheets: ..., Period: ..., ExportedBy: ..., Filters: ...))`.
   - Khai báo sheet qua `ReportSheet` (hoặc `ReportSheet.Single(...)` cho sheet 1 bảng, hỗ trợ `FreezeColumns`, `Kpis` qua `ReportKpi`, `CompactHeader` tự động rút gọn đầu sheet chi tiết đi sau sheet tổng quan).
   - Khai báo bảng qua `ReportTable.Of(rows, columns, title, totalLabel)` giữ nguyên luồng `IEnumerable<TRow>` (không `.ToList()` thừa trước khi ghi).
   - Khai báo cột qua `ReportCol` (`Index`, `Code`, `Text`, `Bool`, `Int`, `Number`, `Money`, `Percent`, `Duration`, `Date`, `DateTime`). Mặc định `Total = null`; chỉ bật `ReportTotal.Sum()` (tự sinh `SUBTOTAL(9,...)` khi có lọc hoặc `SUM(...)`) hoặc `ReportTotal.Fixed(value, note)` khi nghiệp vụ yêu cầu.

3. **Bất biến bắt buộc của Export mới:**
   - **Cấm** tự tạo `new XLWorkbook()`, `MemoryStream`, vòng `for` tô style từng ô hoặc gọi `ws.Columns().AdjustToContents()` trong service.
   - **Cấm** tạo DTO/row class trung gian chỉ để map sang `ExcelSheetWriter`.
   - Ngày/giờ phải dùng kiểu thật qua `ReportCol.Date` / `ReportCol.DateTime`, **không** format sang `string` (`dd/MM/yyyy`).
   - Bộ lọc hiển thị ở đầu báo cáo (`ExcelReport.Filters`) phải giải mã sang mã/tên đọc được, **cấm** in GUID thô.
   - Ẩn/bỏ cột theo quyền ngay khi tạo danh sách `ReportColumn<TRow>` ở tầng service trước khi đưa vào `ReportTable.Of`.
   - Báo cáo có thể lớn phải đặt trần dòng hợp lý ở service (ví dụ `20_000` dòng) trước khi materialize/xuất.

## 7. Transaction And Cross-Service Reliability

1. Import flow có local DB + remote gRPC write phải có transaction boundary rõ.
2. Nếu remote create/update chạy trước local commit, phải có compensation hoặc reconcile strategy.
3. Không dùng `local transaction + remote write` mà không có rollback/compensation path.
4. Khi return success, local commit phải đã hoàn thành.
5. Không swallow exception trong import; log đủ file name, sheet/row context nếu có.
6. Với import có thể lên hàng trăm/hàng ngàn dòng, không gọi create/lifecycle từng row nếu có batch path. Ưu tiên:
   - bulk local insert trong một transaction có chủ đích.
   - batch gRPC theo chunk.
   - track compensation cho từng remote item đã tạo thành công.
   - fail toàn bộ import nếu batch WorkItem lỗi mà flow yêu cầu all-or-nothing.

## 8. Validation

1. **DO NOT RUN build automatically. ON-DEMAND ONLY.** Nếu user yêu cầu build,
   dùng project Services bị ảnh hưởng với scope nhỏ nhất.

2. Nếu build thường fail do generated/zone files hoặc workspace artifact, ghi rõ command thay thế và warning còn lại.
3. Với thay đổi mapping/header/lookup, cần kiểm tra thủ công hoặc test case cho:
   - file rỗng
   - missing required header/cell
   - duplicate code
   - missing lookup reference
   - existing record update/upsert
   - new record create
4. Không claim import/export đúng nếu chỉ build pass mà chưa verify workbook/template behavior.

## 9. Naming Guide

Use responsibility-first names: `ImportLookupCodes`, `ExportLookupIds`, `ResolvedImportLookups`, `ResolvedExportLookups`, `Parsed{Sheet}Row`, `{Entity}Headers`, and `{Entity}ExportSheets`.

## 10. Anti-Patterns

Reject these patterns in new or modified import/export code:

1. Replacing or bypassing BaseService orchestration.
2. Direct repository/UoW persistence from a derived import flow instead of its supported save/preparation hooks.
3. Repeated inline header/sheet strings or magic column indexes.
4. Repeated list materialization/`Distinct()` chains for lookup collection.
5. DB/gRPC calls inside parsing or row loops.
6. Persisting before lookup validation completes.
7. Rollback that ignores remote side effects.
8. Exceptions without file/sheet/row context.
9. Data-driven exceptions (null/duplicate key) inside `ValidateImportDtosAsync`.
10. Manual `new XLWorkbook()`, `MemoryStream`, per-cell style loops, `AdjustToContents()`, raw GUID filter values, string-formatted dates, or intermediate export-only DTOs in new or modified Export code instead of `ExcelDataExporter` / `ExcelReportWriter`.

## 11. Upsert Safety (BẮT BUỘC)

> Bổ sung 2026-08-22 sau audit `ProductionOrderService`. Các quy tắc dưới đây áp dụng cho mọi luồng import có nhánh **update bản ghi đã tồn tại**.

1. **Edit-guard ở nhánh update — quyết định có chủ đích, không mặc định**: Import upsert có chạy guard nghiệp vụ (`ValidateCanEditAsync`, khoá sau duyệt kiểu `ApprovedDate`) hay không là **lựa chọn của chủ sở hữu nghiệp vụ**, phải ghi rõ trong service. Không tự ý thêm guard vào luồng import đang chạy, cũng không mặc định là đã có.
   - Tiền lệ đã chốt: `ProductionOrderService.ImportFromExcel` **cố ý không** kiểm tra `ApprovedDate` — đã import thì chấp nhận ghi đè (quyết định 2026-08-22).
2. **Giữ nguyên correlation Id khi map**: Id tạm do bước parse sinh ra để liên kết cha–con trong cùng file (ví dụ `localSemiId`) phải được giữ nguyên khi map DTO → entity. Cấm `Id = Guid.NewGuid()` trong mapper/mapping method vì sẽ làm con trỏ tới bản ghi không tồn tại. Dùng `Id = dto.Id ?? Guid.NewGuid()`.
3. **Tra cứu theo Code phải an toàn soft-delete**: Trước khi `ToDictionary(x => x.Code)` trên kết quả DB, xác nhận entity có `HasQueryFilter` loại bỏ `DeletedDate`; nếu không có, phải lọc tường minh `.Where(x => x.DeletedDate == null)`. Luôn dùng `GroupBy(...).ToDictionary(g => g.Key, g => g.First())` để tránh `ArgumentException` khi trùng key.
   Với khóa lấy từ Excel, `ValidateImportDtosAsync` không được ném exception vì dữ liệu, vì catch của `BaseService.ImportFromExcel` sẽ làm mất mọi lỗi đã gom.
   Khóa có thể null (row DTO qua `ExcelSheetReader` để null khi ô trống) phải được chặn trước indexer/`TryGetValue`/`ContainsKey`/`GetValueOrDefault`/`ToDictionary`, hoặc chỉ dùng sau checkpoint `if (errors.Count > 0) return errors;` đã báo lỗi mã đó.
   `ToDictionary` trên mã lấy từ Excel chỉ chạy sau bước báo trùng mã của chính tập đó.
   Ở Prepare, tham chiếu tùy chọn dùng `TryGetValue` kèm kiểm null; tham chiếu bắt buộc đã validate dùng indexer như invariant, không thêm lỗi người dùng.
4. **Đồng bộ comparer C# ↔ SQL**: `HashSet<string>(StringComparer.OrdinalIgnoreCase)` KHÔNG có hiệu lực khi set đó được dịch thành `IN (...)` trên PostgreSQL (so sánh case-sensitive). Khi lọc code trên DB phải chuẩn hoá cả hai vế (`x.Code.ToUpper()` + set đã upper) hoặc dùng `EF.Functions.ILike`, và ghi rõ đánh đổi index.
5. **Chống trùng khoá trong cùng file**: Bắt buộc kiểm tra trùng mã ở sheet header trước khi persist (dùng `ExcelImportHelpers.CheckDuplicateCode`), báo lỗi theo dòng thay vì để DB ném unique violation.
6. **Không suy diễn loại chứng từ từ cột nhãn tự do**: Nếu loại chứng từ tham chiếu có thể suy ra từ chính mã chứng từ (tra trong tập Dự án / Đơn hàng / …), không thêm cột "Loại chứng từ" và không viết hàm alias kiểu `IsProjectRef` / `IsSalesOrderRef` so khớp chuỗi tiếng Việt. Suy ra từ mã; nếu mã trùng ở nhiều loại thì báo lỗi mơ hồ theo dòng.
7. **Validation không được chết**: Mỗi điều kiện lỗi (trống, không tồn tại, ngưng hoạt động) của một loại mã chỉ báo ở MỘT tầng có `sheet + dòng + mã`.
   Báo từng dòng hoặc gom theo mã liệt kê đủ các dòng đều hợp lệ; code mới ưu tiên `ValidateImportCategoryCode`, trong cùng sheet giữ một dạng.
   Điều kiện chéo giữa các field (ví dụ có Mã ITP hoặc Mã NVL) được báo theo dòng.
   Kiểm tra lặp lại ở Prepare/Sync cho điều kiện validate đã bảo đảm là code chết.
8. **Cột đã validate phải được dùng**: Mọi cột đã collect/validate trong import phải được gán vào entity. Cột chỉ để validate rồi vứt (hoặc bị ghi đè ngay sau đó bởi giá trị default) là lỗi Data Symmetry — xoá cột hoặc dùng giá trị.
