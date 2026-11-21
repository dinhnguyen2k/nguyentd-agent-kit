---
name: cogain-screen-archetypes
description: Maps Cogain feature and screen archetypes to mandatory backend helpers and frontend shared components. Use when planning, creating, reviewing, or refactoring CRUD list screens, document forms, HR confirmation flows, or payroll/period reports.
metadata:
  version: 1.1.0
  layer: project-skill
---

# Cogain Screen Archetypes

Chỉ mục máy đọc được chứa các tệp mẫu chuẩn đã duyệt và 5 bất biến toàn cục nằm tại `.agent/contracts/archetype-exemplars.json`.
Khi mở rộng hoặc tạo mới màn hình/service theo một trong 4 archetype dưới đây, specialist được phép mở trực tiếp đúng tệp mẫu trong `backend_exemplars` và `frontend_exemplars` của `.agent/contracts/archetype-exemplars.json` thay vì sao chép code cũ lân cận.

## 1. Màn Danh Sách CRUD & Chứng Từ (`crud-list`)

- Mẫu chuẩn BE/FE: xem mục `archetypes.crud-list` trong `.agent/contracts/archetype-exemplars.json` (`TeamLoanService.cs`, `team-loan/index.tsx`).
- Bố cục khung: `MasterDetailLayout` (`frontend/shared/components/master-detail-layout.tsx`) + `TableToolbar` (`frontend/shared/components/custom/table-toolbar.tsx`) + `CustomTable` (`frontend/shared/components/custom-table.tsx`).
- Thao tác dòng: truyền prop `rowActions` (`RowActionsConfig` tại `frontend/shared/components/custom/table-row-actions.tsx`); cấm tự dựng cột `id: 'actions'` và state `DeleteConfirm` lẻ.
- Cột chuẩn: `<ColumnCode />` (`frontend/shared/components/column-code.tsx`), `<DoubleLineCell />` (`frontend/shared/components/double-line-cell.tsx`), `useAuditColumns()` (`frontend/shared/hooks/use-audit-columns.tsx`).
- Cú pháp cấm (`@shared/*` barrel, `.catch('')` trên `SearchSchema`): đã cưỡng chế tự động tại `R10` (`agent-registry.json`).

## 2. Form Chứng Từ & Bảng Con (`document-child-sync-form`)

- Mẫu chuẩn BE/FE: xem mục `archetypes.document-child-sync-form` trong `.agent/contracts/archetype-exemplars.json` (`CommercialTermService.cs`, `LaborOrder.cs`, `labor-order-form.tsx`, `labor-order-form.schema.ts`).
- Nạp kèm `[skill:cogain-form-rhf-zod]` và `[skill:cogain-child-sync]`.
- Cú pháp cấm (`z.string().uuid()`, `<input type="number">`): đã cưỡng chế tự động tại `R10` (`agent-registry.json`); dùng `z.guid()` và `NumericInput`.
- Chọn người lập / phiếu tham chiếu: form có `CreatorSelector` hoặc `useRefDocSelector` (`frontend/shared/hooks/use-ref-doc-selector.ts`) bắt buộc giữ `createdById` và `createdOrganizationId` xuyên suốt schema -> defaults -> `form.reset` -> payload submit -> `CreateWorkItemRequest`.
- Tham chiếu liên service: đăng ký `ISnapshotPolicy` (`SnapshotContracts.cs`) và điều phối qua `ISnapshotLifecycleService` trước write boundary; cấm gán tay snapshot từ client hoặc gọi gRPC trong transaction DB.

## 3. Báo Cáo Tổng Hợp & Chi Tiết Theo Kỳ Lương (`payroll-period-report`)

- Mẫu chuẩn BE/FE: xem mục `archetypes.payroll-period-report` trong `.agent/contracts/archetype-exemplars.json` (`LaborOrderPayrollReportService.cs`, `labor-order-payroll-report/index.tsx`).
- **Backend**:
  - Kỳ lương & phiếu đóng: dùng `PayrollReportQueryHelper.TryResolvePayrollPeriod` (bọc `AttendanceReportPeriod.Resolve(..., payroll: true)`) và `PayrollReportQueryHelper.GetClosedWorkItemIdsAsync` (lọc `EWorkItemStatus.Closed`; cấm đếm phiếu chưa `Closed`).
  - Kỳ chấm công/chốt công (không phải báo cáo kỳ lương ServiceDesk): lấy qua `AttendancePeriodCalendar` (danh mục kỳ `TYPQUA03` của MasterData, dựng bằng `MasterDataAttendancePeriodCalendar.CreateAttendancePeriodCalendar`); `16..15` chỉ là `DefaultWindow` khi tháng chưa cấu hình kỳ.
  - Mốc thời gian hiệu lực: cắt kỳ theo mốc nghiệp vụ đã chốt (như `HrConfirmedDate`), không tự đổi sang `CreatedDate`.
  - Khung thực thi & xuất Excel: dùng `ReportExecution.RunPageAsync` / `RunReadAsync` / `RunExportAsync` kết hợp `ExcelReportWriter`, `ReportCol`, `ExcelReportLabels.ResolveFilterLabel` và `Dictionary<string, string>? FilterLabels` (cấm khai báo lặp cặp `*Label` cho từng `*Id`).
- **Frontend**:
  - Giao diện: dùng `ReportLayout`, `ReportPanel`, `ReportSummaryTable`, `ReportDetailTable`, `ReportFilterChips` và helper dựng cột trong `frontend/shared/components/report-layout.tsx` cùng `<PayrollPeriodInput />`.
  - Hooks dữ liệu: dùng `useReportSummaryQuery`, `useReportPageQuery`, `useReportExcelExport` cùng `ReportFilterLabels` / `buildExportFilterLabelParams` (`frontend/shared/hooks/use-report-queries.ts`).
  - Import chéo `_components`/`-components` giữa các route đã bị chặn tại `R10`; dùng helper từ `@shared/lib`.

## 4. Luồng Nhân Sự Xác Nhận (`hr-confirm`)

- Mẫu chuẩn BE/FE: xem mục `archetypes.hr-confirm` trong `.agent/contracts/archetype-exemplars.json` (`HrConfirmSnapshotPolicies.cs`, `hr-confirm/labor-order/index.tsx`).
- **Backend**: đăng ký `ISnapshotPolicy<HrConfirmSnapshotCommand, TEntity>`, thu thập snapshot trước transition qua `ISnapshotLifecycleService.ExecuteAsync`; chỉ ghi `HrConfirmedDate = DateTimeOffset.UtcNow`, `HrConfirmedById` (và `IsHrConfirm = true` nếu có) khi `response.StatusEnum == (int)EWorkItemStatus.Closed`.
- **Frontend**: hiển thị `hrConfirmedDate` và `hrConfirmedByNameSnapshot`; màn HRM dưới `frontend/hrm/src/routes/_app/hr-confirm/*` khóa cứng `currentStepCode` theo giá trị `HR_CONFIRM` của domain và tái dùng tiện ích lọc tại `frontend/hrm/src/routes/_app/hr-confirm/-components/hr-confirm-utils.ts`.
