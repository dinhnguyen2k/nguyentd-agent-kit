---
trigger: glob
glob: 'backend/src/Services/**/*.Import*.cs,backend/src/Services/**/*.Export*.cs'
---

# Backend Excel Import/Export Rules

> Scope: Excel import/export trong `backend/src/Services/**`.

## 0. Hook-Only Architecture (BẮT BUỘC — Ưu Tiên Cao Nhất)

Không override method orchestration của `BaseService`; chỉ tùy biến qua hook.

### Các method CẤM override trong class con:

| Method gốc                                 | Lý do cấm                                               |
| ------------------------------------------ | ------------------------------------------------------- |
| `ImportFromExcel` / `ImportFromExcelAsync` | BaseService sở hữu parse → validate → persist → result. |
| `ExportTemplateAsync`                      | BaseService sở hữu upload/result/file name.             |
| `ExportDataAsync`                          | BaseService sở hữu upload/result/file name.             |

### Các hook Import được phép override:

```
BaseService.ImportFromExcel pipeline:
  ┌─ Validate file format
  ├─ CustomParseExcelToDtosAsync()      ← HOOK: Đọc Excel, map DTO trung gian, gán state
  ├─ LoadImportReferencesAsync()        ← HOOK: Query DB/gRPC lấy reference (Dictionary cache O(1))
  ├─ ValidateImportDtosAsync()          ← HOOK: Validate + phân loại toCreate/toUpdate/toDelete
  ├─ PrepareImportEntitiesAsync()       ← HOOK: Trả về tuple đã chuẩn bị từ bước Validate
  ├─ BeforeImportPersistAsync()         ← HOOK: Logic trước khi persist (nếu có)
  ├─ Persist (BaseService tự xử lý)
  └─ AfterImportPersistAsync()          ← HOOK: Logic sau khi persist thành công (nếu có)
```

### Các hook Export được phép override:

```
Export pipeline:
  ├─ GetExportTemplateFileName()        ← HOOK: Tên file mẫu
  ├─ GetExportDataFileName()            ← HOOK: Tên file xuất
  ├─ GenerateTemplateBytesAsync()       ← HOOK: Tạo byte[] file mẫu
  └─ GenerateExportDataBytesAsync()     ← HOOK: Tạo byte[] file dữ liệu
```

### Vi phạm — REJECT ngay lập tức:

1. Viết `public override async Task<...> ImportFromExcel(...)` trong class con.
2. Copy logic từ `BaseService.ImportFromExcel` rồi sửa trong class con.
3. Gọi trực tiếp `_repository.AddAsync`, `_unitOfWork.SaveChangesAsync` trong luồng import thay vì dùng hook.
4. Bỏ qua hook `ValidateImportDtosAsync` và tự viết validation inline.
5. Tự tạo method import mới (ví dụ: `CustomImport`, `MyImportFromExcel`) rồi bypass pipeline chuẩn.

> **Nếu BaseService thiếu hook cần thiết**: Báo cáo cho người dùng và đề xuất mở rộng BaseService thêm hook mới. KHÔNG bao giờ workaround bằng cách override method gốc.

## 1. Structure

1. Logic lớn tách `partial class`: `{Entity}Service.Import.cs`, `.Import.Parsing.cs`, `.Import.Lookups.cs`, `.Export.cs`.
2. Không gom parse, lookup, validate, persist và workbook generation vào một method.
3. Main flow phải tuyến tính: validate → parse → collect/resolve lookup → validate references → persist → result.

## 2. Header And Sheet Constants

1. Không hardcode tên header hoặc sheet rải rác trong code.
2. Tạo static class `{Entity}Headers`; header arrays phải build từ constants đó.

3. Tên sheet chính và sheet reference phải gom vào static class riêng hoặc cùng nhóm constants:
   - sheet chính: `OrderSheetName`, `DetailSheetName`, `ProjectSheetName`
   - sheet reference: dùng prefix `Data_...`
4. Legacy header name chỉ thêm alias tại resolver, không lặp mapping ở nhiều nơi.

## 3. Parsing Rules

1. Parsing row chỉ đọc cell và tạo parsed row object; không gọi DB/gRPC trong parsing method.
2. Parsed row records phải giữ field dạng raw code/string trước khi resolve ID.
3. Không parse cùng một sheet bằng nhiều convention khác nhau trong nhiều method.
4. Column index phụ thuộc header động phải resolve qua helper như `ResolveColumnIndex`, không dùng magic number nếu header có khả năng thay đổi.
5. Khi field bắt buộc thiếu, thêm lỗi có sheet + dòng + field rõ ràng.
6. Date import phải normalize về format gRPC/backend thống nhất, ví dụ `yyyy-MM-dd`, sau khi parse thành công.

## 4. Lookup Collection Rules

1. Không viết nhiều đoạn `SelectMany(...).Distinct(...).ToList()` lặp lại cho từng loại code/ID.
2. Gom input vào object như `ImportLookupCodes`, dùng `HashSet<string>(StringComparer.OrdinalIgnoreCase)` cho code và `HashSet<Guid>` cho ID.

3. Collect lookup input trong một method riêng, ví dụ `CollectImportLookupCodes(...)`.
4. Dùng `HashSet` ngay từ đầu.
5. Không tạo intermediate list lớn như `allDetails.ToList()` nếu chỉ dùng để lấy lookup input; duyệt trực tiếp `entities -> Details`.
6. Helper thêm code phải bỏ qua null/blank.

## 5. Lookup Resolution Rules

1. Tạo object output cho lookup result, ví dụ `ResolvedImportLookups` hoặc `ResolvedExportLookups`.
2. Main flow không nên giữ 8-10 biến lookup rời rạc như `uoms`, `products`, `services`, `models`.
3. Lookup method phải tự short-circuit khi input rỗng, hoặc caller phải dùng helper/task wrapper rõ ràng.
4. Không gọi DB/gRPC khi set lookup rỗng.
5. Resolve gRPC/DB lookup độc lập thì chạy parallel bằng `Task.WhenAll`.
6. Mọi missing reference phải gom lỗi trước khi persist; không để import chạy nửa chừng rồi mới fail vì thiếu lookup.
7. Missing-code validation phải dùng comparer phù hợp:
   - code: `StringComparer.OrdinalIgnoreCase`
   - ID: `Guid` exact match

## 6. Export Template Rules

1. Template sheet order phải ổn định và rõ ràng.
2. Data validation phải reference sheet `Data_...`, không dùng tên mơ hồ như `DS ...`.
3. Khi đổi header order, phải cập nhật đồng bộ:
   - header arrays
   - parsing cell indexes
   - data validation columns
   - export write columns
4. Reference sheet headers cũng dùng constants, ví dụ `Headers.Code`, `Headers.Name`.
5. Protected/reference sheets không được chứa secret hoặc hardcoded credential mới. Nếu phải protect workbook, dùng pattern hiện có và không tăng phạm vi secret.

## 7. Transaction And Cross-Service Reliability

1. Import flow có local DB + remote gRPC write phải có transaction boundary rõ.
2. Nếu remote create/update chạy trước local commit, phải có compensation hoặc reconcile strategy.
3. Không dùng `local transaction + remote write` mà không có rollback/compensation path.
4. Khi return success, local commit phải đã hoàn thành.
5. Không swallow exception trong import; log đủ file name, sheet/row context nếu có.
6. Với import có thể lên hàng trăm/hàng ngàn dòng, không gọi create/lifecycle từng row nếu có batch path. Ưu tiên:
   - bulk local insert trong một transaction có chủ đích.
   - batch gRPC theo chunk.
   - track compensation cho từng remote item đã tạo thành công.
   - fail toàn bộ import nếu batch WorkItem lỗi mà flow yêu cầu all-or-nothing.

## 8. Validation

1. **DO NOT RUN build automatically. ON-DEMAND ONLY.** Nếu user yêu cầu build,
   dùng project Services bị ảnh hưởng với scope nhỏ nhất.

2. Nếu build thường fail do generated/zone files hoặc workspace artifact, ghi rõ command thay thế và warning còn lại.
3. Với thay đổi mapping/header/lookup, cần kiểm tra thủ công hoặc test case cho:
   - file rỗng
   - missing required header/cell
   - duplicate code
   - missing lookup reference
   - existing record update/upsert
   - new record create
4. Không claim import/export đúng nếu chỉ build pass mà chưa verify workbook/template behavior.

## 9. Naming Guide

Use responsibility-first names: `ImportLookupCodes`, `ExportLookupIds`, `ResolvedImportLookups`, `ResolvedExportLookups`, `Parsed{Sheet}Row`, `{Entity}Headers`, and `{Entity}ExportSheets`.

## 10. Anti-Patterns

Reject these patterns in new or modified import/export code:

1. Replacing or bypassing BaseService orchestration.
2. Direct repository/UoW persistence from a derived import flow instead of its supported save/preparation hooks.
3. Repeated inline header/sheet strings or magic column indexes.
4. Repeated list materialization/`Distinct()` chains for lookup collection.
5. DB/gRPC calls inside parsing or row loops.
6. Persisting before lookup validation completes.
7. Rollback that ignores remote side effects.
8. Exceptions without file/sheet/row context.

## 11. Upsert Safety (BẮT BUỘC)

> Bổ sung 2026-08-22 sau audit `ProductionOrderService`. Các quy tắc dưới đây áp dụng cho mọi luồng import có nhánh **update bản ghi đã tồn tại**.

1. **Edit-guard ở nhánh update — quyết định có chủ đích, không mặc định**: Import upsert có chạy guard nghiệp vụ (`ValidateCanEditAsync`, khoá sau duyệt kiểu `ApprovedDate`) hay không là **lựa chọn của chủ sở hữu nghiệp vụ**, phải ghi rõ trong service. Không tự ý thêm guard vào luồng import đang chạy, cũng không mặc định là đã có.
   - Tiền lệ đã chốt: `ProductionOrderService.ImportFromExcel` **cố ý không** kiểm tra `ApprovedDate` — đã import thì chấp nhận ghi đè (quyết định 2026-08-22).
2. **Giữ nguyên correlation Id khi map**: Id tạm do bước parse sinh ra để liên kết cha–con trong cùng file (ví dụ `localSemiId`) phải được giữ nguyên khi map DTO → entity. Cấm `Id = Guid.NewGuid()` trong mapper/mapping method vì sẽ làm con trỏ tới bản ghi không tồn tại. Dùng `Id = dto.Id ?? Guid.NewGuid()`.
3. **Tra cứu theo Code phải an toàn soft-delete**: Trước khi `ToDictionary(x => x.Code)` trên kết quả DB, xác nhận entity có `HasQueryFilter` loại bỏ `DeletedDate`; nếu không có, phải lọc tường minh `.Where(x => x.DeletedDate == null)`. Luôn dùng `GroupBy(...).ToDictionary(g => g.Key, g => g.First())` để tránh `ArgumentException` khi trùng key.
4. **Đồng bộ comparer C# ↔ SQL**: `HashSet<string>(StringComparer.OrdinalIgnoreCase)` KHÔNG có hiệu lực khi set đó được dịch thành `IN (...)` trên PostgreSQL (so sánh case-sensitive). Khi lọc code trên DB phải chuẩn hoá cả hai vế (`x.Code.ToUpper()` + set đã upper) hoặc dùng `EF.Functions.ILike`, và ghi rõ đánh đổi index.
5. **Chống trùng khoá trong cùng file**: Bắt buộc kiểm tra trùng mã ở sheet header trước khi persist (dùng `ExcelImportHelpers.CheckDuplicateCode`), báo lỗi theo dòng thay vì để DB ném unique violation.
6. **Không suy diễn loại chứng từ từ cột nhãn tự do**: Nếu loại chứng từ tham chiếu có thể suy ra từ chính mã chứng từ (tra trong tập Dự án / Đơn hàng / …), không thêm cột "Loại chứng từ" và không viết hàm alias kiểu `IsProjectRef` / `IsSalesOrderRef` so khớp chuỗi tiếng Việt. Suy ra từ mã; nếu mã trùng ở nhiều loại thì báo lỗi mơ hồ theo dòng.
7. **Validation không được chết**: Nếu lookup toàn cục đã fail-fast cho một loại mã, thì thông báo lỗi theo dòng cho cùng loại mã đó là code chết. Chọn MỘT tầng báo lỗi — ưu tiên tầng theo dòng vì có `sheet + dòng + mã lệnh`.
8. **Cột đã validate phải được dùng**: Mọi cột đã collect/validate trong import phải được gán vào entity. Cột chỉ để validate rồi vứt (hoặc bị ghi đè ngay sau đó bởi giá trị default) là lỗi Data Symmetry — xoá cột hoặc dùng giá trị.
