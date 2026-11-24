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

- Default (`BaseService.ImportFromExcel`): Do NOT override `ImportFromExcel`, `ExportTemplateAsync`, or `ExportDataAsync` for standard imports; extend via hooks (`CustomParseExcelToDtosAsync`, `LoadImportReferencesAsync`, `ValidateImportDtosAsync`, `PrepareImportEntitiesAsync`, `SaveImportEntitiesAsync`).
- Large/multi-sheet `WorkItem`-backed aggregates (`ProductionOrderService`, `OvertimeRequestService`):
  - Parse via `ExcelWorkbookStreamReader` (`ReadSheet<T>` / `ReadRawSheet`) - never `new XLWorkbook(stream)` on large import reads.
  - Orchestrate snapshots + compensated WorkItem batch creation via `WorkItemImportExecution.RunAsync` + `SaveTrackedChangesAsync` (default `ChunkSize = 1000`). Pass state via captured local closures, NEVER `AsyncLocal` written inside `async` delegates.
  - Persist large multi-table insert graphs via `IUnitOfWork.BulkInsertEntitiesAsync` (Npgsql metadata-driven multi-row `INSERT` respecting `AggregateShapes` and `AuditingInterceptor`, with safe EF Core fallback).

Confirm exact hook and helper signatures in `BaseService.cs`, `ExcelWorkbookStreamReader.cs`, `WorkItemImportExecution.cs`, and `UnitOfWorkBase.cs`.

## Procedure

1. Define the import/export column contract once and verify symmetry.
2. Parse cells via `ExcelWorkbookStreamReader` into DTOs/raw rows with row-aware errors; never make per-cell or per-row DB/gRPC calls inside parsing.
3. Batch-load lookup/reference data before processing rows (including default enrichments like `ApplyDefaultFromWarehouseBatchAsync` applied for both Create and Update); run independent lookups concurrently with `Task.WhenAll`.
4. Pre-query lightweight IDs before loading full `QueryAggregate()` graphs under `SplitQuery`; block locked/approved records (e.g. `ApprovedDate != null`) both before mutation and inside the transaction on retry.
5. Collect snapshots outside the transaction (`AutoDetectChanges = false`), persist updates with `WorkItemImportExecution.SaveTrackedChangesAsync`, and persist bulk creates with `_unitOfWork.BulkInsertEntitiesAsync` + `WorkItemLifecycleService.BulkCreateWithWorkItemsBatchAsync` (never log per-item inside tight loops).
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
