---
trigger: glob
glob: 'backend/src/Services/**/*.Import*.cs,backend/src/Services/**/*.Export*.cs,backend/src/Services/**/*ReportService*.cs'
description: "Backend Excel import/export rules (hook-only architecture, Infrastructure.Services.Excel base, ClosedXML mapping) for backend/src/Services Import/Export/Report code."
condition: ["backend/src/Services/**/*.Import*.cs", "backend/src/Services/**/*.Export*.cs", "backend/src/Services/**/*ReportService*.cs"]
paths: ["backend/src/Services/**/*.Import*.cs", "backend/src/Services/**/*.Export*.cs", "backend/src/Services/**/*ReportService*.cs"]
interruptMode: never
---

# Backend Excel Import/Export Rules

> Scope: Excel import/export trong `backend/src/Services/**`. Chi tiết mở rộng về schema legacy, builder xuất file và upsert xem tại `[skill:cogain-excel-import-export]` (`.agent/skills/cogain-excel-import-export/references/detailed-rules.md`).

## 0. Kiến Trúc Base Import & Hook (BẮT BUỘC)

Chỉ mở rộng qua đúng hook của `BaseService`:
- Import: `CustomParseExcelToDtosAsync` -> `LoadImportReferencesAsync` -> `ValidateImportDtosAsync` / `ValidateImportAsync` -> `CustomImportMappingAsync` -> `PrepareImportEntitiesAsync` -> `SaveImportEntitiesAsync`; lỗi tổng hợp qua `CreateImportValidationFailure`.
- Export: `GetExportTemplateFileName`, `GetExportDataFileName`, `GenerateTemplateBytesAsync`, `GenerateExportDataBytesAsync`.

Ngoại lệ có kiểm soát: chỉ aggregate nhiều sheet kèm `WorkItem` (hiện có `ProductionOrderService`, `OvertimeRequestService`) mới được bỏ qua `BaseService.ImportFromExcel`, và phải theo đúng các trụ cột dưới đây:

1. **Chọn bộ đọc theo kích thước đo được**:
   - Mặc định dùng `ExcelSheetReader` (ClosedXML) như mọi import khác.
   - Chỉ dùng `ExcelWorkbookStreamReader` (`ReadSheet<T>` / `ReadRawSheet`) khi file thực tế lớn (cỡ hàng nghìn dòng trở lên hoặc nhiều MB) và có số đo parse cô lập chứng minh lợi ích; không chuyển import nhỏ sang stream reader.
   - Không viết bộ chuyển đổi giá trị riêng: service dùng API public của `ExcelParsingHelpers`; trong `BuildingBlocks`, bộ đọc dùng chung các helper `internal` (`FromExcelSerial`, `TryParseDateText`, `TryParseDateTimeText`, `TryParseTimeText`, `TryParseIntegerText`). Hàm cố ý khác ngữ nghĩa phải có comment một dòng nêu khác biệt.
   - Phải tôn trọng cờ `Date1904` của workbook; giá trị giờ ≥ 24 giờ bị từ chối nhất quán giữa hai bộ đọc, thông báo nêu sheet, dòng, cột, giá trị.
2. **Điều phối snapshot và giao dịch bù trừ (`WorkItemImportExecution.RunAsync`)**:
   - Gọi khi `AutoDetectChanges` đang bật; snapshot thu thập ngoài transaction.
   - `SaveTrackedChangesAsync` chỉ `DetectChanges` + `SaveChangesAsync`; caller sở hữu cờ: bọc bằng `SetAutoDetectChanges(false)` ... `finally SetAutoDetectChanges(true)`.
   - Khi execution strategy chạy lại (`attempt > 0`), ChangeTracker đã bị xóa (`IUnitOfWork.cs` hợp đồng retry): phải nạp lại graph từ DB, đồng bộ lại và áp lại snapshot, không dùng entity của lần trước.
   - `AfterCommitAsync` chỉ chạy sau commit và để exception truyền ra.
   - Không để lại `Stopwatch`/log thời gian từng pha trong mã import; đo hiệu năng bằng instrumentation tạm trên nhánh đo, gỡ trước khi bàn giao (§5).
3. **Một trục ghi EF Core chuẩn theo `ADR-0003` và `ADR-0004` (`docs/adr/`)**:
   - Tạo mới: dùng `_repository.AddRangeAsync` + `_unitOfWork.SaveChangesAsync` trong vùng `AutoDetectChanges` tắt; không cấu hình `MaxBatchSize` (trùng mặc định 1.000 của Npgsql EF), không tự dựng SQL `INSERT` đa dòng hay `COPY` trong service.
   - Cập nhật: truy vấn `Id` nhẹ trước khi tải `QueryAggregate()` dùng `AsSplitQuery()` (bỏ qua tải graph khi `matchedIds.Count == 0`) trong vùng `AutoDetectChanges` tắt để giữ nguyên `OriginalValues` bảo toàn snapshot lịch sử (`AggregateSnapshotService`), đồng bộ qua `AggregateSynchronizer.Sync` + `_unitOfWork.MarkAdded(sync.Added)` và lưu bằng `WorkItemImportExecution.SaveTrackedChangesAsync`.
   - Không dùng tầng bulk song song hoặc `AsNoTracking` stub cho đường cập nhật có snapshot lịch sử; mọi thay đổi bảng con đi qua `AggregateShape` và `AuditingInterceptor` dùng chung.
4. Không gọi `_repository.AddAsync` hoặc `_unitOfWork.SaveChangesAsync` bên trong vòng parse/validate.

## 1. Cấu Trúc, Schema Cột & Đối Xứng Import/Export

1. Tách logic lớn theo trách nhiệm (`{Entity}Service.Import.cs`, `.Import.Parsing.cs`, `.Import.Lookups.cs`, `.Export.cs`); giữ luồng tuyến tính: `validate file -> parse -> batch lookup -> validate nghiệp vụ -> persist -> result`.
2. Không hardcode rải rác tên header/sheet hoặc chỉ số cột ma thuật:
   - Luồng mới dùng Excel row DTO gắn attribute biên dịch một lần sang `ExcelSheetSchema` (getter/setter biên dịch sẵn, không reflection từng ô, không gắn attribute Excel lên Entity hay DTO API).
   - Sheet danh mục tham chiếu dùng tiền tố `Data_...` và khai báo tập trung.
3. **Đối xứng Import/Export bắt buộc**: Mẫu nhập và file xuất dữ liệu tái nhập phải trùng khớp cấu trúc sheet, tên/thứ tự cột và ngữ nghĩa dữ liệu để file xuất ra nhập lại được nguyên vẹn qua `ImportFromExcel`.

## 2. Parsing & Tra Cứu Theo Lô (Batch Lookup)

1. Hàm parse chỉ đọc ô sang `Parsed{Sheet}Row` (giữ mã chuỗi thô) và báo lỗi định dạng/ô bắt buộc kèm `sheet + dòng + trường`; **tuyệt đối không gọi DB/gRPC trong vòng lặp parse hoặc theo từng dòng**.
2. Giữ nguyên mã danh mục thô ở bước parse để `ValidateImportDtosAsync` kiểm tra tập trung một lần và gom đủ mọi lỗi thiếu/sai tham chiếu trước khi persist.
3. Gom khóa cần tra vào `ImportLookupCodes` (`HashSet<string>(StringComparer.OrdinalIgnoreCase)` cho mã, `HashSet<Guid>` cho ID), ngắt sớm khi tập rỗng, chạy song song các nguồn độc lập bằng `Task.WhenAll` và trả về `ResolvedImportLookups` / `ResolvedExportLookups`.

## 3. Xuất Excel Chuẩn (`Infrastructure.Services.Excel`)

Mọi luồng xuất Excel viết mới hoặc sửa đổi phải dùng bộ hạ tầng tại `backend/src/BuildingBlocks/Infrastructure/Services/Excel/` (cấm tự dựng `new XLWorkbook()`, `MemoryStream`, vòng lặp tô style từng ô hoặc gọi `AdjustToContents()`):

1. **Xuất dữ liệu tái nhập (`GenerateExportDataBytesAsync`)**: dùng `ExcelDataExporter.WriteBytes` (`ExcelDataSheet.From` hoặc `ExcelDataSheet.FromColumns`), cấm chèn cột STT/dòng tổng làm gãy khả năng nhập lại.
2. **Xuất báo cáo phân tích/đối soát**: dùng `ExcelReportWriter.Write` (`ExcelReport`, `ReportSheet`, `ReportTable.Of`, `ReportCol.*`, `ReportTotal.*`); truyền ngày/giờ đúng kiểu thật (không ép sang chuỗi), giải mã nhãn bộ lọc đọc được (cấm in GUID thô) và đặt trần dòng hợp lý trước khi materialize.

## 4. Giao Dịch Liên Dịch Vụ & An Toàn Cập Nhật (`Upsert Safety`)

1. Luồng import có ghi sang dịch vụ khác qua gRPC phải định nghĩa rõ ranh giới giao dịch và cơ chế bù trừ (`compensation`), ưu tiên xử lý theo lô thay vì gọi lẻ từng dòng.
2. Khi import có nhánh cập nhật bản ghi cũ (`Upsert`):
   - Kiểm tra khóa nghiệp vụ (như `ApprovedDate != null` trên `ProductionOrder`) trước khi biến đổi graph để báo lỗi sớm theo dòng.
   - Trong transaction (cả lần đầu lẫn `attempt > 0`), giành khóa hàng bằng một `ExecuteUpdateAsync` no-op có điều kiện trạng thái (`ApprovedDate == null && DeletedDate == null`, set `LastModifiedDate = LastModifiedDate`, tiền lệ `AttendanceTicketStateReader`); số hàng bị ảnh hưởng nhỏ hơn số bản ghi cần ghi thì trả lỗi kèm mã bị chốt/xóa. Cấm tái kiểm bằng truy vấn `AsNoTracking` vì không khóa hàng, thao tác chốt vẫn chen vào được.
   - Bảo toàn ID liên kết tạm cha - con (`Id = dto.Id ?? Guid.NewGuid()`, cấm sinh đè `Guid.NewGuid()` mới).
   - Cập nhật đồng bộ con dựa trên `QueryAggregate()` (`AsSplitQuery`) và `AggregateSynchronizer.Sync` + `_unitOfWork.MarkAdded(sync.Added)` để giữ `Id` dòng khớp, giữ `OriginalValues` cho snapshot lịch sử và xóa mềm dòng bị bỏ; không xóa rồi chèn lại cả graph.
   - Tra cứu `Code` trên DB phải lọc `DeletedDate == null`, chuẩn hóa hoa/thường khớp PostgreSQL (`ToUpper()` / `ILike`), kiểm tra trùng mã trong file trước bằng `ExcelImportHelpers.CheckDuplicateCode`, và không để `ValidateImportDtosAsync` ném exception dữ liệu làm mất danh sách lỗi đã gom.
   - Mọi cột đã thu thập và kiểm tra hợp lệ phải được gán thực sự vào entity (tránh cột chết).
   - Với batch create có `WorkItem`, gộp tra cứu phụ trợ (ví dụ kho mặc định `ApplyDefaultFromWarehouseBatchAsync`) một lần trước transaction.
3. Kiểm chứng: Không tự động chạy build khi người dùng chưa yêu cầu (`AI_RULES.md` §2); không kết luận import/export đúng nếu chỉ dựa vào kết quả biên dịch mà chưa kiểm tra tính đối xứng cột và xử lý dòng lỗi.

## 5. Đo Hiệu Năng Import (khi tối ưu hoặc đổi kiến trúc ghi)

1. Quy kết chậm phải dựa trên số đo từng pha (parse, snapshot, ghi, WorkItem, hậu commit) và số round-trip DB, không dựa trên một lần đo tổng. `Stopwatch`/log pha chỉ là instrumentation tạm trong lúc đo và phải gỡ khỏi mã trước khi bàn giao.
2. Giao thức tối thiểu: cùng fixture byte-giống, cùng DB, cùng cấu hình build giữa các mốc; 1 lượt khởi động + ≥7 lượt mỗi kịch bản (tạo mới, cập nhật); báo median/min/max, không báo p95 khi n < 20; đo RTT DB trước và sau; đo lại mốc so sánh sau cùng để kiểm trôi (>15% thì cảnh báo).
3. Ngưỡng chấp nhận đặt trước khi đo; tối ưu chỉ được giữ khi vượt ngưỡng đã đặt hoặc đơn giản hơn với hiệu năng tương đương.
4. Benchmark và E2E chạy trên dữ liệu có tiền tố riêng và dọn qua API của ứng dụng, không xóa bằng SQL.
5. Mọi tối ưu hoặc thay đổi luồng ghi phải kiểm đầy đủ trên PostgreSQL thật: tạo mới, cập nhật giữ ID, thêm và xóa mềm dòng con, bảo toàn snapshot lịch sử, audit, rollback, WorkItem và khóa lệnh đã chốt. Báo riêng kịch bản bị chặn bởi dữ liệu môi trường; không tính là đạt.
