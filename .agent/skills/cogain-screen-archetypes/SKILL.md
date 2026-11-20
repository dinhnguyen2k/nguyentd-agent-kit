---
name: cogain-screen-archetypes
description: Maps Cogain feature and screen archetypes to mandatory backend helpers and frontend shared components. Use when planning, creating, reviewing, or refactoring CRUD list screens, document forms, HR confirmation flows, or payroll/period reports.
metadata:
  version: 1.0.0
  layer: project-skill
---

# Cogain Screen Archetypes

Bản đồ khuôn mẫu chuẩn (Feature & Archetype Map) giúp tái dùng đúng helper backend và shared component frontend của Cogain, không tự chế UI/query/pipeline mới hoặc sao chép helper nội bộ giữa các route.

## 1. Màn Danh Sách CRUD & Chứng Từ

- Bố cục khung: `MasterDetailLayout` (`frontend/shared/components/master-detail-layout.tsx`) + `TableToolbar` (`frontend/shared/components/custom/table-toolbar.tsx`) + `CustomTable` (`frontend/shared/components/custom-table.tsx`).
- Thao tác dòng: truyền prop `rowActions` (`RowActionsConfig` từ `@shared/components/custom/table-row-actions` tại `frontend/shared/components/custom/table-row-actions.tsx`). Cấm tự dựng cột `id: 'actions'` và state `DeleteConfirm` lẻ.
- Cột chuẩn: mã chứng từ dùng `<ColumnCode />` (`frontend/shared/components/column-code.tsx`), ô mã + tên dùng `<DoubleLineCell />` (`frontend/shared/components/double-line-cell.tsx`), cột hệ thống dùng `useAuditColumns()` (`frontend/shared/hooks/use-audit-columns.tsx`).
- URL search: `SearchSchema` dùng `.optional()` và đặt default khi đọc tại list; cấm `.catch('')` hoặc `.catch(1)` làm tràn param rỗng lên URL.
- Import `@shared`: import trực tiếp từng file `@shared/components/<file>` (ví dụ `@shared/components/custom-table`); cấm import qua barrel `@shared/components`.

## 2. Form Chứng Từ & Bảng Con

- Quy tắc form và bảng con chuẩn: nạp kèm `[skill:cogain-form-rhf-zod]` và `[skill:cogain-child-sync]`.
- Kiểu GUID .NET: trong Zod 4 bắt buộc dùng `z.guid()`, cấm `z.string().uuid()` vì ID không chuẩn RFC từ DB/backend sẽ bị từ chối im lặng.
- Chọn người lập / phiếu tham chiếu: form có `CreatorSelector` hoặc `useRefDocSelector` (`frontend/shared/hooks/use-ref-doc-selector.ts`) bắt buộc khai báo `createdById` và `createdOrganizationId` xuyên suốt schema, giá trị mặc định, `form.reset` và payload submit; backend phải truyền `CreatedOrganizationId` vào `CreateWorkItemRequest`.
- Tham chiếu liên service: đăng ký `ISnapshotPolicy` (`backend/src/BuildingBlocks/Contracts/Snapshots/SnapshotContracts.cs`) và điều phối qua `ISnapshotLifecycleService` (`backend/src/BuildingBlocks/Contracts/Application/Interfaces/ISnapshotLifecycleService.cs`); cấm gán tay code/name snapshot từ client hoặc gọi gRPC rời rạc.

## 3. Báo Cáo Tổng Hợp & Chi Tiết Theo Kỳ Lương (`Payroll Report Archetype`)

### Backend

- Kỳ lương & phiếu đóng: dùng `PayrollReportQueryHelper.TryResolvePayrollPeriod` (`backend/src/Services/ServiceDesk/ServiceDesk.Services/Implement/Production/PayrollReportQueryHelper.cs`, bọc `AttendanceReportPeriod.Resolve(..., payroll: true)` tại `backend/src/BuildingBlocks/Shared/Helpers/AttendanceReportHelper.cs` cắt kỳ từ ngày 16 tháng chọn đến hết ngày 15 tháng sau giờ VN) và `PayrollReportQueryHelper.GetClosedWorkItemIdsAsync` (lọc `EWorkItemStatus.Closed`; cấm đếm phiếu chưa `Closed`).
- Mốc thời gian hiệu lực: cắt kỳ theo mốc nghiệp vụ đã chốt (như `HrConfirmedDate`), không tự suy diễn sang `CreatedDate` nếu nghiệp vụ tính theo ngày xác nhận.
- Khung thực thi & xuất Excel: dùng `ReportExecution.RunPageAsync`, `ReportExecution.RunReadAsync`, `ReportExecution.RunExportAsync` (`backend/src/BuildingBlocks/Contracts/Application/Reports/ReportExecution.cs`) kết hợp `ExcelReportWriter` (`backend/src/BuildingBlocks/Infrastructure/Services/Excel/ExcelReportWriter.cs`), `ReportCol` và `ExcelReportLabels` (`backend/src/BuildingBlocks/Infrastructure/Services/Excel/ExcelReportModels.cs`).

### Frontend

- Thành phần giao diện: dùng `ReportLayout`, `ReportPanel`, `ReportSummaryTable`, `ReportDetailTable`, `ReportFilterChips` (`frontend/shared/components/report-layout.tsx`) cùng `<PayrollPeriodInput />` (`frontend/shared/components/custom/payroll-period-input.tsx`).
- Hooks dữ liệu: dùng `useReportSummaryQuery`, `useReportPageQuery`, `useReportExcelExport` (`frontend/shared/hooks/use-report-queries.ts`) để tách cache tổng hợp khỏi phân trang chi tiết.
- Định dạng dùng chung: dùng helper từ `@shared/lib` (`frontend/shared/lib/utils.ts`: `formatVndSafe`, `formatDate`, `formatNumber`). **Cấm tuyệt đối import chéo `_components` hoặc `-components` của route khác** (không mượn helper nội bộ từ module khác như `labor-order/_components`).

## 4. Luồng Nhân Sự Xác Nhận (`HR Confirm Archetype`)

- Backend: đăng ký `ISnapshotPolicy<HrConfirmSnapshotCommand, TEntity>` tại `backend/src/Services/ServiceDesk/ServiceDesk.Services/Implement/Production/HrConfirmSnapshotPolicies.cs`. Thu thập snapshot trước transition qua `ISnapshotLifecycleService.ExecuteAsync`; khi `response.StatusEnum == (int)EWorkItemStatus.Closed` mới ghi `HrConfirmedDate = DateTimeOffset.UtcNow`, `HrConfirmedById` (kèm `IsHrConfirm = true` nếu entity có cột) và áp snapshot người xác nhận.
- Frontend: màn danh sách và chi tiết chứng từ hiển thị `hrConfirmedDate` và `hrConfirmedByNameSnapshot`; màn HRM dưới `frontend/hrm/src/routes/_app/hr-confirm/*` khóa cứng `currentStepCode` theo giá trị `HR_CONFIRM` của domain và dùng tiện ích lọc tại `frontend/hrm/src/routes/_app/hr-confirm/-components/hr-confirm-utils.ts`.
