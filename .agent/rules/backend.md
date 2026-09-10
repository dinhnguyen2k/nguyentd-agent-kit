---
trigger: glob
glob: 'backend/**/*'
---

# BACKEND.MD - Quy Tắc Miền Backend Cogain

> Mục tiêu: Tối giản hóa context và chuẩn hóa các quy tắc Backend (ASP.NET Core 8 microservices).

---

## 0. Ưu Tiên Và Phạm Vi

1. `AI_RULES.md` là source of truth cao nhất. Rule này chỉ là extension cho backend domain.
2. Scope áp dụng: `backend/src/**`, `backend/tests/**`, các file config backend.

---

## 1. Kiến Trúc Bắt Buộc

1. **Kiến trúc lớp**: Mỗi service tuân thủ 4 lớp: `API -> Services -> Repositories -> Data`.
2. **Shared logic**: Dùng `backend/src/BuildingBlocks/*` (`Contracts`, `Infrastructure`, `Shared`).
3. **Gateway**: Định cấu hình thông qua `OcelotApiGw`.
4. **BaseService Hooks**: Cấm override phương thức gốc của `BaseService`. Bắt buộc tùy biến qua các hook (`BeforeCreateAsync`, `AfterMapperAsync`, `BeforeUpdateAsync`...).
5. **Excel Import/Export**: Xem quy tắc chi tiết tại [.agent/rules/backend-excel-import.md](file:///home/nguyentd/cogain/cogain-core/.agent/rules/backend-excel-import.md).

---

## 2. API Contract & Response Pattern

1. **Chuẩn trả về**: Dùng `Result<T>`, `Result`, `PagedResult<T>`.
2. **Lỗi Nghiệp vụ**: Bắt buộc dùng `400 BadRequest` (gọi `Result.Failure(msg)`). Cấm dùng `401`, `403`, `409` tùy tiện để tránh làm lỗi cơ chế interceptor ở Frontend.

---

## 3. Quy Tắc Auth & Security Guardrails (Critical)

1. **Permission Model**: Cấu trúc `Resource.Action` (resolve qua `PermissionPolicyProvider`, `PermissionAuthorizationHandler`).
2. **Thuật ngữ**:
   - `Resource`: Tài nguyên nghiệp vụ (`HR.Employee`, `MasterData.Project`).
   - `Action`: Thao tác nghiệp vụ (`View`, `Create`, `Update`, `Delete`, `Approve`).
   - `Permission`: Chuỗi ghép `Resource.Action` (ví dụ: `HR.Employee.Create`).
   - `Authorization`: Quyết định phân quyền động, không dùng role-based tĩnh.
3. **Guardrails**:
   - Employee-scoped flow: Yêu cầu header `X-Employee-Id` GUID hợp lệ.
   - Cấm hardcode secrets/tokens/API keys.
   - Cấm bypass auth/authz trong code.
4. **Edit-guard parity**: Mọi đường ghi thay thế cho CRUD chuẩn (bulk update, endpoint update từng tab, job nền) phải chạy đúng guard nghiệp vụ như luồng `BaseService.Update` — `ValidateCanEditAsync`, khoá sau duyệt (`ApprovedDate`), trạng thái WorkItem. Guard chỉ đặt trong `BeforeUpdateAsync` là chưa đủ; endpoint nào không đi qua đó phải gọi guard tường minh.
   - **Ngoại lệ có chủ đích**: luồng import Excel. Mỗi service tự quyết định và ghi rõ; không tự thêm guard vào luồng import đang chạy. Xem [backend-excel-import.md §11.1](file:///home/nguyentd/cogain/cogain-core/.agent/rules/backend-excel-import.md).

---

## 4. Data, EF Core & LINQ Optimization (BẮT BUỘC)

1. **Soft-delete**: Dùng `DeletedDate`. Khi kết hợp với Unique index, bắt buộc dùng Filtered Index: `.HasFilter("\"deleted_date\" IS NULL")`.
2. **Query Performance**:
   - Read-only: Dùng `.AsNoTracking()` cho lượng lớn dữ liệu.
   - Tránh N+1: Projection/include có chủ đích. Truyền `CancellationToken` xuyên suốt.
   - Tối ưu `IN` tập lớn: Dùng `arrayIds.Contains(x.Id)` (Array phải `.ToArray()`), tự động dịch thành một parameter `ANY(...)` trên PostgreSQL.
3. **gRPC Optimization**: Chỉ gọi gRPC khi list request thực sự có phần tử. Nếu rỗng, trả về response rỗng qua `Task.FromResult`.
4. **LINQ Performance**:
   - Dùng `.ToHashSet()` thay vì `.Distinct().ToList()` để tìm kiếm nhanh $O(1)$ qua `.Contains(...)`.
   - Distinct và lọc rỗng trên Value Type (Guid, int) TRƯỚC KHI gọi `.ToString()` để tránh rác bộ nhớ Heap.

---

## 5. ACID & Compensation Xuyên Service (BẮT BUỘC)

1. **ACID**: Mọi thao tác ghi dữ liệu nhiều bước (multi-step write) cùng một service bắt buộc phải wrap trong một transaction (`BeginTransactionAsync` -> `Commit` / `Rollback`).
2. **Cross-Service Reliability**: Với luồng ghi liên service (local DB + gRPC write/delete), bắt buộc chọn và thiết kế rõ:
   - Strong consistency: Compensation pattern.
   - Eventual consistency: Outbox/inbox pattern.
   - Long-running workflow: Saga pattern.
3. **Batch/Import Compensation**: Nếu gRPC remote chạy trước local DB commit, bắt buộc thiết kế hoàn tác remote khi local commit thất bại.
4. **Delete flow**:
   - `remote first -> local second`: Phải có compensation nếu local fail.
   - `local first -> remote second`: Phải có cơ chế ngăn chặn hoặc sửa orphaned remote state.

---

## 6. Quy Tắc Validation, Logging & Testing

1. **Logging**: Log Serilog có cấu trúc qua `ILogger`. Cấm nuốt lỗi im lặng.
2. **Validation**: Backend là nguồn sự thật cho toàn bộ validation nghiệp vụ.
3. **Testing**:
   - Thay đổi backend bắt buộc chạy unit/integration test trong `backend/tests/*`.
   - Các luồng liên quan đến tiền, quyền, inventory, pháp lý: Bắt buộc có test chứng minh các ràng buộc (invariants) không bị vỡ.
