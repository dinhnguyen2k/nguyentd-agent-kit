---
name: cogain-excel-import-export
description: Extends Cogain BaseService Excel import/export through supported hooks, ClosedXML conventions, validation, batch lookup, and compensation rules. Use for ImportFromExcel, ExportTemplateAsync, ExportDataAsync, templates, or spreadsheet mappings.
metadata:
  version: 1.0.0
  layer: project-skill
---

# Cogain Excel Import/Export

The base methods own orchestration. Derived services customize behavior through hooks.

## Mandatory Reading

Read `.agent/rules/backend-excel-import.md` for core invariants and [references/detailed-rules.md](references/detailed-rules.md) when designing sheet schemas, batch lookups, `ExcelDataExporter`/`ExcelReportWriter` layouts, or upsert flows; then inspect `BaseService.cs` and one nearby service with the same import/export shape.

## Orchestration Boundary

Choose the right shared infrastructure tier in `backend/src/BuildingBlocks`:

- Default (`BaseService.ImportFromExcel`): Do NOT override `ImportFromExcel`, `ExportTemplateAsync`, or `ExportDataAsync` for standard imports; extend via hooks (`CustomParseExcelToDtosAsync`, `LoadImportReferencesAsync`, `ValidateImportDtosAsync`, `ValidateImportAsync`, `CustomImportMappingAsync`, `PrepareImportEntitiesAsync`, `SaveImportEntitiesAsync`).
- Large/multi-sheet `WorkItem`-backed aggregates (`ProductionOrderService`, `OvertimeRequestService`):
  - Parse via `ExcelWorkbookStreamReader` (`ReadSheet<T>` / `ReadRawSheet`) only when measured file size justifies it; otherwise `ExcelSheetReader`. Value conversion goes through `ExcelParsingHelpers`; the workbook `Date1904` flag must be honored.
  - Điều phối snapshot và tạo `WorkItem` qua `WorkItemImportExecution.RunAsync`.
  - Ghi qua trục EF Core chuẩn (`docs/adr/0003-aggregate-write-pipeline.md`, `docs/adr/0004-excel-import-architecture.md`): tạo mới dùng `AddRangeAsync` + `SaveChangesAsync` trong vùng `AutoDetectChanges` tắt; cập nhật dùng `QueryAggregate()` (`AsSplitQuery`) + `AggregateSynchronizer.Sync` + `MarkAdded` + `SaveTrackedChangesAsync`. Không tự dựng SQL `INSERT` đa dòng hay `COPY` trong service.

Confirm exact hook and helper signatures in `BaseService.cs`, `ExcelWorkbookStreamReader.cs`, `ExcelParsingHelpers.cs`, and `WorkItemImportExecution.cs`.

## Procedure

1. Define the import/export column contract once and verify symmetry.
2. Parse thành DTO/dòng thô và báo lỗi theo dòng; dùng `ExcelWorkbookStreamReader` cho luồng lớn như trên. Không gọi DB/gRPC theo từng ô hoặc dòng.
3. Batch-load lookup/reference data before processing rows (including default enrichments like `ApplyDefaultFromWarehouseBatchAsync` applied for both Create and Update); run independent lookups concurrently with `Task.WhenAll`.
4. Truy vấn `Id` nhẹ trước khi tải `QueryAggregate()` dùng `AsSplitQuery` trong vùng tắt `AutoDetectChanges` (bỏ qua khi không có `Id`), chặn lệnh đã chốt trước khi sửa và giành khóa có điều kiện trong transaction ở lần đầu lẫn retry (`ClaimUnapprovedOrdersAsync`); báo lỗi nếu thiếu hàng giành khóa được.
5. Với luồng `WorkItem`, thu thập snapshot ngoài transaction để giữ nguyên `OriginalValues` bảo toàn tên lịch sử; áp context lên graph thực tế cần ghi. `RunAsync` không tự lưu cập nhật: caller gọi `WorkItemImportExecution.SaveTrackedChangesAsync` và tự khôi phục `AutoDetectChanges` trong `finally`.
6. Generate templates and re-importable/analytical exports through `Infrastructure.Services.Excel`:
   - Use `ExcelDataExporter.WriteBytes` (`ExcelDataSheet.From` / `ExcelDataSheet.FromColumns`) in `GenerateExportDataBytesAsync`.
   - Use `ExcelReportWriter.Write` (`ExcelReport` / `ReportSheet` / `ReportTable.Of` / `ReportCol.*` / `ReportTotal.*`) for analytical/read-only reports, passing human-readable filter labels (never raw GUIDs) and typed dates.

## Boundaries

- Import and export columns must remain symmetric unless the product contract explicitly distinguishes them.
- Do not hide validation failures by coercing invalid values to defaults.
- Do not trust spreadsheet MIME or extension alone; retain base validation.
- Explicitly guard locked/approved records (`ApprovedDate != null`) against silent overwrite when business rules forbid editing after approval.
- Do not write `AsyncLocal` state inside `async` `WorkItemImportExecution` callbacks (`BeforeTransactionAsync`); values will not flow out across `await` boundaries.
- Do not emit secrets, internal audit fields, or unapproved identifiers into export files.

## Verification

- Template header, parser mapping, validation, and export mapping agree.
- At least one success and one row-level failure path are tested for meaningful changes.
- Large imports avoid per-row remote/data calls.
- Compensation or eventual-consistency ownership is documented for remote side effects.
- Performance claims follow the measurement protocol in `.agent/rules/backend-excel-import.md` §5 (per-phase timings, ≥7 runs, median/min/max, drift re-run).
- Với thay đổi luồng lớn, kiểm chứng trên PostgreSQL thật về audit, rollback, WorkItem, bảo toàn snapshot lịch sử, khóa lệnh đã chốt và đồng bộ dòng con.
