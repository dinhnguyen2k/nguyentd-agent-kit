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

## 0. Hook-Only Architecture (BẮT BUỘC)

Không override method điều phối gốc của `BaseService` (`ImportFromExcel`, `ImportFromExcelAsync`, `ExportTemplateAsync`, `ExportDataAsync`) và không tạo hàm import riêng đi vòng qua pipeline chuẩn; chỉ mở rộng qua đúng hook:

- **Import hooks**: `CustomParseExcelToDtosAsync` -> `LoadImportReferencesAsync` -> `ValidateImportDtosAsync` -> `PrepareImportEntitiesAsync` -> `SaveImportEntitiesAsync` (mặc định ghi create/update/delete trong một `ExecuteInTransactionAsync`; logic trước/sau ghi đặt trong override hook này, thu thập snapshot/gRPC trước khi mở transaction).
- **Export hooks**: `GetExportTemplateFileName`, `GetExportDataFileName`, `GenerateTemplateBytesAsync`, `GenerateExportDataBytesAsync`.
- Không gọi trực tiếp `_repository.AddAsync` hoặc `_unitOfWork.SaveChangesAsync` bên trong luồng parse/validate import. Nếu `BaseService` thiếu seam, báo cáo để mở rộng hook dùng chung.

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
   - Không tự ý thêm/bỏ `ValidateCanEditAsync` trên luồng đang chạy nếu chưa có quyết định nghiệp vụ.
   - Bảo toàn ID liên kết tạm cha - con (`Id = dto.Id ?? Guid.NewGuid()`, cấm sinh đè `Guid.NewGuid()` mới).
   - Tra cứu `Code` trên DB phải lọc `DeletedDate == null`, chuẩn hóa hoa/thường khớp PostgreSQL (`ToUpper()` / `ILike`), kiểm tra trùng mã trong file trước bằng `ExcelImportHelpers.CheckDuplicateCode`, và không để `ValidateImportDtosAsync` ném exception dữ liệu làm mất danh sách lỗi đã gom.
   - Mọi cột đã thu thập và kiểm tra hợp lệ phải được gán thực sự vào entity (tránh cột chết).
3. Kiểm chứng: Không tự động chạy build khi người dùng chưa yêu cầu (`AI_RULES.md` §2); không kết luận import/export đúng nếu chỉ dựa vào kết quả biên dịch mà chưa kiểm tra tính đối xứng cột và xử lý dòng lỗi.
