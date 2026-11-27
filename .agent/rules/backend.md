---
trigger: glob
glob: 'backend/**/*'
description: "Cogain backend domain rules: BaseService hooks, Result<T> error contract, permissions, EF Core/gRPC performance, logging."
condition: ["backend/**/*"]
paths: ["backend/**/*"]
interruptMode: never
---

# BACKEND.MD - Quy Tắc Miền Backend Cogain

## 0. Ưu Tiên Và Phạm Vi

1. `AI_RULES.md` là source of truth cao nhất. Rule này chỉ là extension cho backend domain.
2. Scope áp dụng: `backend/src/**`, `backend/tests/**`, các file config backend.

## 1. Kiến Trúc Bắt Buộc

1. **Kiến trúc lớp**: Mỗi service tuân thủ 4 lớp: `API -> Services -> Repositories -> Data`.
2. **Shared logic**: Dùng `backend/src/BuildingBlocks/*` (`Contracts`, `Infrastructure`, `Shared`).
3. **Gateway**: Định cấu hình thông qua `OcelotApiGw`.
4. **BaseService Hooks**: Cấm override phương thức gốc của `BaseService`. Bắt buộc tùy biến qua các hook (`BeforeCreateAsync`, `AfterMapperAsync`, `BeforeUpdateAsync`...).
5. **Excel Import/Export**: Xem quy tắc chi tiết tại [.agent/rules/backend-excel-import.md](backend-excel-import.md).
6. **Cơ chế Snapshot cho chức năng mới**: Triển khai chức năng mới bắt buộc làm theo cơ chế snapshot chuẩn (`[SnapshotReference]` + `AggregateShape` + `AggregateSnapshotService`, xem `docs/adr/0003-aggregate-write-pipeline.md`) khi tham chiếu dữ liệu liên service. Cấm fetch hoặc gán code/name thủ công trong luồng ghi.
7. **AutoMapper Expression**: Trong `*MappingProfile*.cs`, `opt.MapFrom(...)` nhận `Expression<Func<...>>` - cấm dùng `is ... or/and` (`CS8122`, bị chặn bởi `R10`).

## 2. API Contract & Response Pattern

1. **Chuẩn trả về**: Dùng `Result<T>`, `Result`, `PagedResult<T>`.
2. **Lỗi Nghiệp vụ**: Bắt buộc dùng `400 BadRequest` (gọi `Result.Failure(msg)`). Cấm dùng `401`, `403`, `409` tùy tiện để tránh làm lỗi cơ chế interceptor ở Frontend.
3. **gRPC qua core**: Bắt buộc dùng `GrpcLookupFetchHelpers.FetchResultAsync` (`backend/src/BuildingBlocks/Infrastructure/Services/Import/GrpcLookupFetchHelpers.cs`) cho unary RPC có `Success`/`Message`; response phải implement `IGrpcStatusResponse` (partial class tại `backend/src/BuildingBlocks/Contracts/Protos/GrpcStatusResponse.cs`, không sửa `.proto` sinh tự động). Core xử lý `Success`, logging, chuyển lỗi thành `Result` và truyền cancellation - cấm lặp `try/catch` hay wrapper kiểm tra null/`Success` ở service; caller tạo request, deadline, kiểm tra `Result` và lỗi nghiệp vụ trả `Result.Failure(msg)` (không tự chọn `5xx`, không nuốt lỗi trả default/rỗng). Thiếu trường hợp mới thì mở rộng helper tại đúng owner.
4. **Không bọc luồng ghi bằng `catch (Exception)`**: Cấm `catch (Exception)` quanh `base.Create`/`base.Update`/`SaveChangesAsync`/`CreateWithWorkItemAsync`. `GlobalExceptionHandlerMiddleware` đã log và trả thông điệp chuẩn kèm mã tham chiếu (kể cả `DbUpdateException` qua `PostgresErrorFormatter`); catch chung sẽ nuốt các thông điệp đó.

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
   - **Ngoại lệ có chủ đích**: luồng import Excel. Mỗi service tự quyết định và ghi rõ; không tự thêm guard vào luồng import đang chạy. Xem [backend-excel-import.md §11.1](backend-excel-import.md).

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
5. **CẤM snapshot code/name cho quan hệ cùng DB**: Cấm tạo/lưu bản sao code/name dưới mọi tên field khi entity tham chiếu nằm cùng database (kể cả DTO ghi, mapping, CRUD/import); chỉ lưu khóa ngoại ID và resolve qua navigation/projection/lookup trên DTO đọc. Không tự ý xóa cột snapshot cũ hoặc tạo migration khi chưa có yêu cầu riêng.
6. **EF Core Migration & CI**: Cấm tự viết/sửa tay migration hoặc snapshot; chỉ tạo/gỡ qua `./dev.sh add-migration|remove-migration` (sai thì sửa Entity/Configuration, `remove-migration` rồi sinh lại). **Cấm chạy hoặc nhắc user chạy `update-db` lên DB dev dùng chung** - DB áp tự động qua GitLab CI (`migrate:<service>-api:dev` trong `.gitlab/ci/migrate.yml`).
   - **Quy trình bắt buộc khi đổi schema**: Nghiệm thu Entity/Configuration xong, Main đóng băng ghi backend, chạy `add-migration` (1 lần/service, kiểm drift), tự `git commit` riêng phạm vi thay đổi + migration trên nhánh tính năng, tạo MR vào `develop` (qua `gitlab-mr.mjs`, tự động qua cổng biên dịch cục bộ trước khi push/merge), tự động merge và giám sát pipeline `migrate:<service>-api:dev` pass xanh mới tính là xong (specialist không tự chạy).
   - Dừng báo ngay (không ép merge, không bỏ qua lỗi) nếu có drift ngoài phạm vi, ở nhánh bảo vệ, conflict/chặn merge, cổng biên dịch fail, hoặc pipeline build/migrate fail.
7. **Default cột non-null mới**: Giá trị khởi tạo C# không thành default DB (EF sinh `defaultValue: 0`). Cột enum/bool/số có default nghiệp vụ khác `default(T)` phải khai báo `HasDefaultValue(...)` trong Configuration trước `add-migration`.

## 5. ACID & Compensation Xuyên Service (BẮT BUỘC)

1. **ACID**: Mọi thao tác ghi dữ liệu nhiều bước (multi-step write) cùng một service bắt buộc phải nằm trong một transaction mở qua execution strategy, vì mọi `DbContext` đều bật `EnableRetryOnFailure`:
   - Có gRPC ghi WorkItem: `_workItemLifecycleService.ExecuteCompensatedTransactionAsync(scopeName, async scope => ...)`; lambda trả `Result.Failure` thì helper tự rollback DB và compensate remote.
   - Chỉ ghi DB: `_unitOfWork.ExecuteInTransactionAsync(async () => ...)`; gọi lồng thì tự join transaction đang mở.
   - **CẤM** gọi `_unitOfWork.BeginTransactionAsync`/`CommitTransactionAsync`/`RollbackTransactionAsync` hoặc `Database.BeginTransactionAsync` trực tiếp: `SaveChangesAsync` sẽ ném `InvalidOperationException ... 'NpgsqlRetryingExecutionStrategy' does not support user-initiated transactions`.
   - Lambda có thể bị chạy lại khi lỗi transient: gRPC không idempotent (chuyển bước, auto-return) đặt sau commit, ngoài lambda.
   - Không để lại code transaction dạng comment; gỡ thì xoá hẳn, kể cả `try/catch` chỉ còn `throw;` hoặc `try { }` rỗng.
2. **Cross-Service Reliability**: Với luồng ghi liên service (local DB + gRPC write/delete), bắt buộc chọn và thiết kế rõ:
   - Strong consistency: Compensation pattern.
   - Eventual consistency: Outbox/inbox pattern.
   - Long-running workflow: Saga pattern.
3. **Batch/Import Compensation**: Nếu gRPC remote chạy trước local DB commit, bắt buộc thiết kế hoàn tác remote khi local commit thất bại.
4. **Delete flow**:
   - `remote first -> local second`: Phải có compensation nếu local fail.
   - `local first -> remote second`: Phải có cơ chế ngăn chặn hoặc sửa orphaned remote state.

## 6. Quy Tắc Validation, Logging & Testing

1. **Logging**: Log Serilog có cấu trúc qua `ILogger`. Cấm nuốt lỗi im lặng.
2. **Validation**: Backend là nguồn sự thật cho toàn bộ validation nghiệp vụ.
3. **Testing**:
   - Thay đổi backend bắt buộc chạy unit/integration test trong `backend/tests/*`.
   - Các luồng liên quan đến tiền, quyền, inventory, pháp lý: Bắt buộc có test chứng minh các ràng buộc (invariants) không bị vỡ.

## 7. Quy Tắc Enum, Nhãn Động & Description Metadata (BẮT BUỘC)

1. **Định nghĩa Enum trong `Shared.Enums`**:
   - Underlying type bắt buộc là `int`; tên kiểu (`Type.Name`, dùng làm `EnumKey`) không được trùng giữa các namespace vì `EnumLabelCatalog` dùng làm khóa duy nhất.
   - Bắt buộc gắn `[Description("...")]` (`System.ComponentModel`) tiếng Việt có dấu, rõ nghĩa cho **tất cả** member (làm nhãn mặc định cho `vi`).
   - Nếu cần nhãn tiếng Anh mặc định hoặc alias Excel cũ: khai báo đồng bộ trong `backend/src/BuildingBlocks/Infrastructure/Localization/EnumLabels/en.json` và `aliases.json` (đúng `EnumKey` và tên member).
2. **Lấy nhãn, options và parse runtime qua `IEnumLabelProvider` / `EnumLabelSnapshot`**:
   - Trong service/import/export, inject `IEnumLabelProvider` (`await _enumLabelProvider.GetAsync(ct)` hoặc `GetDefaultAsync(ct)`) để lấy `EnumLabelSnapshot` theo thứ tự ưu tiên: `override(c) -> static(c) -> override(vi) -> [Description] -> member name`.
   - Lấy nhãn: `labels.Label(enumValue)`; lấy danh sách options: `labels.Options<TEnum>()` / `labels.Labels<TEnum>()`; parse chuỗi nhập vào: `labels.TryParse<TEnum>(text, out var value)`.
   - Với `EStatus` trong Excel import/template: dùng `StatusImportParser.TryParse(...)` và `StatusImportParser.Options(...)`.
   - Chỉ dùng `enumValue.GetDescription()` (`Shared.Extensions.EnumExtensions`) ở chỗ thuần tĩnh không có DI hoặc không cần override theo ngôn ngữ/runtime.
3. **Cấm**:
   - Cấm định nghĩa enum member thiếu `[Description("...")]`, khác underlying `int`, hoặc trùng tên `Type.Name`.
   - Cấm tự viết `switch/case`, `if/else` hoặc map chuỗi thủ công để dịch/parse enum khi đã có `IEnumLabelProvider` và `EnumExtensions`.
