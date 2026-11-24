# Quy Tắc Chi Tiết Excel Import/Export (Tham Chiếu Mở Rộng Của `backend-excel-import.md`)

Tài liệu này lưu chi tiết thiết kế schema header/sheet, gom tra cứu theo lô, cấu hình xuất dữ liệu/báo cáo và an toàn cập nhật (`Upsert Safety`) để giữ cho rule tự nạp `.agent/rules/backend-excel-import.md` gọn nhẹ dưới ngưỡng ngân sách ngữ cảnh.

## 1. Header Và Sheet Schema Chi Tiết

1. Với luồng chuyển sang DTO gắn attribute, dùng Excel row DTO riêng cho từng sheet làm nguồn metadata duy nhất.
   Khai báo vị trí, tiêu đề, alias và ràng buộc ô trên property; không gắn metadata Excel lên entity hoặc DTO API.
2. Helper biên dịch metadata sang `ExcelSheetSchema`, sinh `Titles`, alias có ràng buộc vị trí và layout import cũ một lần theo type, không dựng lại theo từng dòng dữ liệu.
   Không suy thứ tự cột từ reflection hoặc suy bắt buộc nhập từ nullable và dấu `(*)`.
   Chỉ map property được khai báo cho Excel; cấu hình type không hỗ trợ hoặc vị trí cột sai phải báo lỗi rõ ràng.
3. Reader/writer dùng getter/setter đã biên dịch sẵn, không reflection từng ô; giữ số dòng, thứ tự và lỗi parse để service tiếp tục xử lý nghiệp vụ.
   Metadata dùng chung không chứa trạng thái workbook; dropdown và hướng dẫn phụ thuộc ngữ cảnh phải cấu hình riêng cho từng workbook.
   Template, export, import, nhãn lỗi parser và tên cột trong sheet hướng dẫn phải đọc cùng schema.
   Không duy trì đồng thời DTO attributes, bộ constants hoặc danh sách descriptor chứa cùng metadata.
   Luồng chưa chuyển đổi được giữ `{Entity}Headers`, descriptor, `ExcelSheetSchema` hoặc header arrays hiện tại, không bắt buộc migrate ngoài phạm vi task.
4. Tên sheet chính khai báo tại attribute của Excel row DTO hoặc schema/constants của luồng chưa chuyển đổi, không khai báo trùng ở cả hai nơi.
   Tên sheet danh mục tham chiếu gom vào nhóm constants và dùng tiền tố `Data_...`.
5. Alias tiêu đề khai báo cạnh cột, alias tên sheet khai báo trong schema; helper chung xử lý tương thích, không lặp chuỗi `if/else` hoặc sửa nội dung ô header trước khi validate.
   Alias mặc định so khớp chính xác sau chuẩn hóa; so khớp chuỗi con phải được khai báo riêng và giới hạn đúng cột.
6. Chỉ khai báo legacy bằng prefix khi layout cũ đúng là N cột đầu của layout hiện tại, giữ nguyên tên chuẩn và thứ tự.
   Layout có chèn, bỏ ở giữa hoặc đổi thứ tự cột phải khai báo đầy đủ, không tự suy đoán hay dịch chuyển cột.
   Prefix chỉ phục vụ import, không được làm thay đổi template/export hiện tại.
7. Cấu hình sai như tiêu đề hoặc alias rỗng sau chuẩn hóa, key layout trùng/dành riêng, prefix vượt phạm vi phải báo lỗi rõ ràng.
   Không bỏ qua cấu hình sai, không để alias rỗng khớp mọi tiêu đề và không chọn tùy ý khi nhiều layout cùng khớp.
8. Cột hệ thống tự tính vẫn xuất hiện trong template/export khi contract yêu cầu, nhưng reader bỏ qua giá trị nhập của cột được khai báo bỏ qua import.
   Không đưa công thức nghiệp vụ, lookup hoặc mặc định nghiệp vụ vào helper chuyển kiểu để che dữ liệu thiếu hoặc sai.

## 2. Chi Tiết Parsing, Gom Mã & Phân Giải Lookup Theo Lô

1. Bước parse chỉ đọc ô và tạo đối tượng dòng tạm (`Parsed{Sheet}Row` giữ nguyên mã chuỗi thô trước khi phân giải ID), tuyệt đối không gọi DB/gRPC trong hàm parse.
2. Bước parse chỉ báo lỗi của chính ô giá trị (sai kiểu, sai định dạng ngày/số, ô bắt buộc trống qua `CellRequired`, vượt độ dài) kèm `sheet + dòng + trường`.
   Mã danh mục/khóa tham chiếu không báo lỗi và không bỏ dòng (`continue`) ở bước parse; giữ nguyên giá trị thô (kể cả rỗng) để `ValidateImportDtosAsync` kiểm tra tập trung một lần cho toàn bộ các dòng (trừ dòng con không gắn được vào mã cha trong sheet cha thì báo ngay kèm `sheet + dòng`).
3. Ngày tháng sau khi parse thành công phải chuẩn hóa về định dạng thống nhất (`yyyy-MM-dd`) trước khi gọi gRPC/backend.
4. Gom mã tra cứu trong một hàm riêng (`CollectImportLookupCodes`) vào đối tượng `ImportLookupCodes` dùng `HashSet<string>(StringComparer.OrdinalIgnoreCase)` cho mã và `HashSet<Guid>` cho ID ngay từ đầu (bỏ qua `null`/khoảng trắng, không tạo danh sách trung gian `.ToList()` thừa).
5. Kết quả tra cứu gom vào `ResolvedImportLookups` / `ResolvedExportLookups` (tránh truyền 8-10 biến rời rạc).
   Tự ngắt sớm khi tập mã rỗng; các nguồn tra cứu DB/gRPC độc lập chạy song song bằng `Task.WhenAll`; gom toàn bộ lỗi thiếu tham chiếu trước khi lưu DB.

## 3. Chi Tiết `Infrastructure.Services.Excel` Cho Xuất Dữ Liệu & Báo Cáo

1. **Xuất dữ liệu tái nhập được (`ExcelDataExporter` trong `GenerateExportDataBytesAsync`)**:
   - Đã có `ExcelSheetDefinition<T>`: dùng `ExcelDataExporter.WriteBytes(ExcelDataSheet.From(rows, definition, overrides...))` (kèm `ExcelDataColumnOverride` nếu chỉnh `Width` / `WrapText`).
   - Bảng phẳng chưa dùng attribute DTO: dùng `ExcelDataExporter.WriteBytes(ExcelDataSheet.FromColumns(sheetName, rows, columns))` với `ExcelDataColumn<T>`.
   - Cấm thêm cột STT, dòng tổng cộng, tiêu đề gộp hoặc đổi thứ tự cột làm gãy đối xứng khi nhập lại qua `ImportFromExcel`.
2. **Xuất báo cáo đọc / đối soát (`ExcelReportWriter`)**:
   - Dùng `ExcelReportWriter.Write(new ExcelReport(Sheets: ..., Period: ..., ExportedBy: ..., Filters: ...))`.
   - Khai báo sheet qua `ReportSheet` / `ReportSheet.Single(...)` (`FreezeColumns`, `Kpis`, `CompactHeader`), bảng qua `ReportTable.Of(rows, columns, title, totalLabel)` giữ nguyên `IEnumerable<TRow>`, cột qua `ReportCol` (`Index`, `Code`, `Text`, `Bool`, `Int`, `Number`, `Money`, `Percent`, `Duration`, `Date`, `DateTime`) và tổng qua `ReportTotal.Sum()` / `ReportTotal.Fixed(...)`.
   - Bộ lọc đầu báo cáo phải giải mã sang mã/tên đọc được (cấm in GUID thô); ngày giờ truyền kiểu thật (cấm ép sang chuỗi `dd/MM/yyyy`); đặt trần dòng hợp lý (ví dụ `20_000` dòng) trước khi xuất.

## 4. Chi Tiết An Toàn Khi Cập Nhật Qua Import (`Upsert Safety`)

1. **Khóa bản ghi đã chốt / phát hành (`ApprovedDate != null`)**: Mọi luồng có trạng thái chốt như `ProductionOrderService.ImportFromExcel` phải chặn ghi đè bản ghi có `ApprovedDate != null`, báo lỗi rõ theo từng dòng trước khi biến đổi graph và tái kiểm bên trong transaction (kể cả khi transient retry `attempt > 0`).
2. **Bảo toàn khóa liên kết tạm cha - con**: Giữ nguyên ID tạm sinh ở bước parse (`Id = dto.Id ?? Guid.NewGuid()`), cấm gọi `Guid.NewGuid()` đè làm đứt liên kết dòng con. Với cập nhật chi tiết theo khóa tự nhiên trên `ProductionOrder`, lập chỉ mục độ phức tạp tuyến tính trước khi remap để tránh quét lồng nhau.
3. **Tra cứu theo `Code` an toàn xóa mềm & không ném ngoại lệ dữ liệu**:
   - Luôn bảo đảm lọc `DeletedDate == null` và dùng `GroupBy(...).ToDictionary(g => g.Key, g => g.First())` sau bước kiểm tra trùng mã (`ExcelImportHelpers.CheckDuplicateCode`).
   - Không để `ValidateImportDtosAsync` ném exception vì khóa `null`/trùng từ dữ liệu người dùng làm mất danh sách lỗi gom được.
4. **Đồng bộ phân biệt hoa thường C# và PostgreSQL**: `HashSet<string>(StringComparer.OrdinalIgnoreCase)` không tự áp dụng khi dịch sang `IN (...)` trên PostgreSQL; phải chuẩn hóa cả hai vế (`ToUpper()`) hoặc dùng `EF.Functions.ILike` có cân nhắc chỉ mục.
5. **Không suy diễn loại chứng từ từ cột nhãn tiếng Việt tự do** nếu suy ra được trực tiếp từ mã chứng từ; mọi cột đã thu thập và kiểm tra hợp lệ đều phải được ánh xạ vào thực thể (tránh lỗi lệch đối xứng dữ liệu).

## 5. Kiến Trúc Base Import Streaming & Hiệu Năng Cao (`BuildingBlocks/Infrastructure`)

1. **`ExcelWorkbookStreamReader` (`Infrastructure/Services/Import/ExcelWorkbookStreamReader.cs`)**:
   - Đọc trực tiếp OpenXML forward-only (`OpenXmlReader` theo state `ReadFirstChild`/`ReadNextSibling`), nạp `SharedStringTable` và `Stylesheet` (gồm cả elapsed time `[h]:mm`) một lượt duy nhất, bỏ qua mọi sheet `Data_*` và VML comments, áp trần `MaxDataRows = 100_000`.
   - Hỗ trợ `ReadSheet<T>` / `TryReadSheet<T>` và `ReadRawSheet` / `TryReadRawSheet` (`ExcelRawRow` đọc nhanh theo chỉ số cột 1-based) trên cùng một stream bufferable (`MemoryStream` khi `!stream.CanSeek`).
2. **`WorkItemImportExecution` (`Infrastructure/Services/Import/WorkItemImportExecution.cs`)**:
   - Điều phối vòng đời chung: thu thập và áp `AggregateSnapshotService` ngoài transaction dưới `AutoDetectChanges = false` (`SnapshotRoots` gồm cả Update đã sync và Create dựng sẵn) -> chạy `BeforeTransactionAsync` -> mở `ExecuteCompensatedTransactionAsync` với `attempt` tracking -> `ExecuteInTransactionBeforeCreateAsync` -> `SaveTrackedChangesAsync` -> `BulkCreateWithWorkItemsBatchAsync` (mặc định `ChunkSize = 1000`, `MaxBatchSize(1000)` trên `DbContext`) -> `AfterCommitAsync` hậu commit (ví dụ `AutoReturnIfReachedEndStepBatchAsync`).
   - **Cấm truyền dữ liệu giữa các delegate `async` qua `AsyncLocal`**: `BeforeTransactionAsync` chạy trên `async` task con nên thay đổi `.Value` bị hủy sau khi `await` kết thúc; luôn chụp vào biến cục bộ của hàm gọi `RunAsync`.
   - **`SaveTrackedChangesAsync`**: giữ `SetAutoDetectChanges(false)` bao trọn cả `DetectChanges()` lẫn `await SaveChangesAsync(ct)` và chỉ khôi phục trong `finally` để `AuditingInterceptor` không kích hoạt thêm vòng quét `ChangeTracker`.
3. **`AggregateSnapshotService` & `QueryAggregate()` SplitQuery**:
   - Khi root ở trạng thái `Detached` hoặc `Added`, `AggregateSnapshotService` chỉ kiểm tra `rootEntry` một lần và bỏ qua `unitOfWork.Entry(node)` ở các node con, đồng thời khử trùng lặp `(Kind, Id)` ngay bằng `HashSet<SnapshotKey>`.
   - Khi kiểm tra bản ghi tồn tại trong `Import`, truy vấn danh sách `Id` trước bằng `_repository.Query(...).Select(x => x.Id)`; chỉ gọi `QueryAggregate()` khi `matchedIds.Count > 0`.
4. **`IUnitOfWork.BulkInsertEntitiesAsync` (`UnitOfWorkBase.cs` + `AuditingInterceptor.cs`)**:
   - Với cây entity sạch (`Npgsql`, không có hook `ISaveChangesHook`, không owned/discriminator/shadow column), tự động sinh SQL multi-row `INSERT ... VALUES ($1,$2,...),...` theo metadata `DbContext.Model` + `RelationalTypeMapping` + thứ tự tầng khóa ngoại `AggregateShapes` (gộp tới `min(1000, 60000 / số_cột)` dòng mỗi lệnh), đóng dấu audit bằng `ApplyAuditForBulkInsertAsync` và tự fallback về `AddRangeAsync` + `SaveChangesAsync` trong môi trường test (SQLite/in-memory).
