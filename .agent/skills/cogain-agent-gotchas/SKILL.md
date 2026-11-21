---
name: cogain-agent-gotchas
description: Prevents recurring Cogain-specific semantic mistakes learned from .planning/errors/ERRORS.md. Use during debugging, review, or implementation near AutoFilter, API integration, EF reflection/child relations, React Hook Form, Radix controls, and shared tables.
metadata:
  version: 1.1.0
  layer: project-skill
---

# Cogain Agent Gotchas

Đọc nhóm liên quan trước khi sửa code ở các ranh giới dễ sai ngữ nghĩa; nhật ký sự cố gốc lưu tại `.planning/errors/ERRORS.md`.

## Kiểm Tra Tĩnh Đã Chuyển Xuống Guard

- Đã cưỡng chế tự động tại `R10` (`.agent/contracts/agent-registry.json`): cấm barrel `@shared/components|hooks|services`, `.uuid()` của Zod 4, `.catch('')` trên `SearchSchema`, `<input type="number">`, gán tay header `X-Employee-Id`, import chéo `_components`/`-components` giữa route, `eslint-disable react-hooks/exhaustive-deps`, `as unknown as`, `catch` rỗng C#, `NotImplementedException`, `using` chéo `Data`/`Repositories` giữa service, sửa tay file sinh tự động và import asset tĩnh không tồn tại.

## API & AutoFilter

- Xác minh endpoint thật trên controller backend trước khi thêm query phía frontend.
- Tham số không khai báo trên request model AutoFilter sẽ bị bỏ qua âm thầm; đưa predicate động vào biểu thức `Filters` trừ khi endpoint bind tường minh property đó.

## API-to-Form Hydration & Luồng Nghiệp Vụ

- ID và mảng nullable từ backend phải được chuẩn hóa về giá trị khớp schema trước khi `form.reset`; `value ?? []` không chuẩn hóa được chuỗi khác null thành mảng nên cần type guard rõ ràng.
- Form dùng `CreatorSelector` hoặc `useRefDocSelector` bắt buộc giữ `createdById` và `createdOrganizationId` xuyên suốt schema -> giá trị mặc định -> payload submit -> `CreateWorkItemRequest`.

## EF Core Reflection, Excel Import & Bảng Con

- Quét navigation bằng reflection bắt buộc loại trừ property có `[NotMapped]`.
- Gỡ phần tử khỏi collection con đang được EF Core track với FK bắt buộc sẽ làm đứt quan hệ và cố set FK về null; phải dùng đồng bộ xóa mềm do aggregate sở hữu theo `[skill:cogain-child-sync]`.
- Cột snapshot non-null trong DB đòi hỏi phủ đủ resolver/mapping và fallback hợp lệ về nghiệp vụ; `?? string.Empty` chỉ tránh null chứ không chứng minh đúng nghiệp vụ.
- Batch Excel import không kích hoạt tra cứu snapshot gRPC khi cột mã tham chiếu để trống: giữ `Guid.Empty` ở provisional graph và bảo lưu nguyên trạng ID/snapshot cũ khi update.

## Screen Archetypes & Giao Diện Dùng Chung

- Dùng `[skill:cogain-screen-archetypes]` và `.agent/contracts/archetype-exemplars.json` làm chuẩn duy nhất cho CRUD list, bảng con, báo cáo kỳ lương (`PayrollReportQueryHelper`, `ReportExecution`, `ReportLayout`) và luồng HR Confirm.

## React Feedback Loops & Radix UI

- `useEffect` gọi `setState` của cha hoặc `form.setValue` bắt buộc phải idempotent và không phụ thuộc callback inline hoặc instance table vừa tạo mới mỗi render.
- Radix `Select` có thể phát lại giá trị rỗng hiện tại lúc mount; chặn phát trùng và dùng `undefined` khi rỗng không phải là một option hợp lệ.
- Radix `Checkbox` trong form phát sự kiện click nổi bọt qua hidden input gốc; không bọc thêm handler click-toggle bên ngoài, chỉ dùng `<label>`.
