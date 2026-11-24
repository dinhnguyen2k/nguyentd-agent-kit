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

Chỉ mở rộng qua đúng hook của `BaseService` (`CustomParseExcelToDtosAsync` -> `LoadImportReferencesAsync` -> `ValidateImportDtosAsync` -> `PrepareImportEntitiesAsync` -> `SaveImportEntitiesAsync`, Export: `GetExportTemplateFileName`, `GetExportDataFileName`, `GenerateTemplateBytesAsync`, `GenerateExportDataBytesAsync`).

Ngoại lệ có kiểm soát: khi aggregate nhiều sheet kèm `WorkItem` cần bỏ qua `BaseService.ImportFromExcel` (ví dụ `ProductionOrderService.ImportFromExcel`), vẫn phải đi qua cùng 3 trụ cột dùng chung trong `BuildingBlocks` thay vì viết pipeline đơn lẻ:

1. **Đọc Excel Streaming (`ExcelWorkbookStreamReader`)**: Luôn dùng `ExcelWorkbookStreamReader` (`ReadSheet<T>` cho DTO gắn attribute hoặc `ReadRawSheet` cho layout vị trí cột) để đọc OpenXML forward-only (bỏ qua sheet `Data_*` và comments VML); cấm mở `new XLWorkbook(stream)` trên luồng import dữ liệu lớn.
2. **Điều phối Snapshot + Giao dịch bù trừ (`WorkItemImportExecution.RunAsync`)**: Thu thập và áp `AggregateSnapshotService` / policy ngoài transaction với `AutoDetectChanges = false` (`SnapshotRoots`), truyền trạng thái qua biến cục bộ (cấm truyền qua `AsyncLocal` bên trong delegate `async`), giữ `SetAutoDetectChanges(false)` bao trọn `DetectChanges() + SaveChangesAsync()` bằng `WorkItemImportExecution.SaveTrackedChangesAsync`, và chạy `AfterCommitAsync` theo lô ngoài transaction.
3. **Chèn lô đa dòng (`IUnitOfWork.BulkInsertEntitiesAsync`) & Batch DB**: Với lô tạo mới số lượng lớn, ưu tiên `_unitOfWork.BulkInsertEntitiesAsync` (`ChunkSize = 1000`, Npgsql `MaxBatchSize(1000)` trong `ConfigureServices.cs`); trước khi gọi `QueryAggregate()` có `SplitQuery` để kiểm tra bản ghi tồn tại, luôn truy vấn danh sách `Id` nhẹ trước để tránh bắn nhiều query rỗng qua mạng.
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
   - Kiểm tra khóa nghiệp vụ (như `ApprovedDate != null` trên `ProductionOrder`) cả trước khi biến đổi graph lẫn tái kiểm bên trong transaction (kể cả khi execution strategy retry `attempt > 0`), trả lỗi theo từng dòng thay vì âm thầm ghi đè.
   - Bảo toàn ID liên kết tạm cha - con (`Id = dto.Id ?? Guid.NewGuid()`, cấm sinh đè `Guid.NewGuid()` mới).
   - Tra cứu `Code` trên DB phải lọc `DeletedDate == null`, chuẩn hóa hoa/thường khớp PostgreSQL (`ToUpper()` / `ILike`), kiểm tra trùng mã trong file trước bằng `ExcelImportHelpers.CheckDuplicateCode`, và không để `ValidateImportDtosAsync` ném exception dữ liệu làm mất danh sách lỗi đã gom.
   - Mọi cột đã thu thập và kiểm tra hợp lệ phải được gán thực sự vào entity (tránh cột chết).
   - Với batch create có `WorkItem`, không bọc `AggregateSnapshotService` cho node `Detached` bằng nhiều vòng `DbContext.Entry(node)` và phải gộp tra cứu phụ trợ (ví dụ kho mặc định `ApplyDefaultFromWarehouseBatchAsync`) một lần trước transaction.
3. Kiểm chứng: Không tự động chạy build khi người dùng chưa yêu cầu (`AI_RULES.md` §2); không kết luận import/export đúng nếu chỉ dựa vào kết quả biên dịch mà chưa kiểm tra tính đối xứng cột và xử lý dòng lỗi.
