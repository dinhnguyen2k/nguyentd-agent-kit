# Frontend references

Chỉ đọc mục được router `.agent/rules/frontend.md` chỉ định trước khi sửa file.

## Chung
- Mỗi khai báo `import` bắt buộc một dòng, kể cả `import type` và nhiều symbol.
- Bắt buộc reuse `frontend/shared/components/` và `frontend/shared/ui/`; không dựng UI inline thay component shared.
- Đọc props/contract shared trước khi dùng; thiếu capability thì báo Main, không tự tạo implementation riêng.
- Không dùng `font-mono`; radius khối con phải nhỏ hơn khối cha.
- Quyền dùng `@shared/permission` và `useHasPermission`; `X-Employee-Id` do interceptor gán.
- Text dùng locale key đủ `vi`/`en`, không hardcode hoặc fallback text.
- Không tự chạy validation; tuân thủ `AI_RULES.md` §2 và `.agent/rules/frontend-fastcheck.md`.
- CẤM tách file quá nhỏ làm loãng source: không bóc tách sub-component, hook, helper chỉ dùng một lần sang file riêng; ưu tiên co-location (đặt chung trong cùng file hoặc module cha) để dễ tìm và bảo trì logic. Chỉ tách file khi có nhu cầu tái sử dụng thực tế (từ 2 nơi trở lên) hoặc khi file quá lớn và có ranh giới nghiệp vụ độc lập, rõ ràng.
- Code trong `frontend/shared/**` cấm import `@/...` của app; dùng đường dẫn tương đối hoặc `@shared/...`.
- Package mà `frontend/shared/**` import phải khai trong `frontend/shared/package.json` (`dependencies`, hoặc `peerDependencies` nếu app cung cấp instance), không dựa vào `package.json` gốc.
- Đổi bất kỳ `package.json` nào thì commit phải kèm `pnpm-lock.yaml` đã cập nhật; agent không ghi lockfile, user chạy `pnpm install` trước. Lockfile chưa khớp thì không push.

## Quy ước import module từ @shared
CẤM import qua barrel `@shared/components`, `@shared/hooks` (kể cả `@shared/hooks/master-data`), `@shared/services` (kể cả hậu tố `/index`).
Mọi component, hook và service dùng chung phải import trực tiếp từ subpath file định nghĩa để tối ưu đóng gói Vite và khớp bộ chặn `R10-no-shared-barrel`.

| Loại import | Cách viết chuẩn |
| --- | --- |
| Component dùng chung (`Container`, `CustomTable`, `CustomSelect`, `TreeTable`, `TableToolbar`, `MasterDetailLayout`, `QueryStateGate`...) | Import trực tiếp từ subpath định nghĩa (ví dụ `@shared/components/container`, `@shared/components/custom-table`, `@shared/components/custom/custom-select`, `@shared/components/custom/tree-table`, `@shared/components/custom/table-toolbar`, `@shared/components/master-detail-layout`, `@shared/components/query-state-gate`) |
| Component dùng `export default` (`StatusTag`, `DebouncedInput`, `DateRangeInput`, `ModifierInfo`, `DebouncedTextarea`) | Bắt buộc viết default import từ subpath gốc (`import StatusTag from '@shared/components/common/status-tag'`, `import DebouncedInput from '@shared/components/custom/debounce-input'`, `import DateRangeInput from '@shared/components/custom/date-range-input'`, `import ModifierInfo from '@shared/components/modifier-info'`, `import DebouncedTextarea from '@shared/components/custom/debounce-textarea'`); cấm viết named import `{ DebouncedInput }` |
| 4 symbol đổi tên (import trực tiếp qua subpath, không đi qua `@shared/components`) | `formatAttachmentBytes` từ `@shared/components/attachment-upload-item`; `TreeTableGlobalFilterElementProps`, `TreeTableTitleProps` từ `@shared/components/custom/tree-table`; `BusinessProcessManagement` từ `@shared/components/master-data/business-process` (hoặc `@shared/components/master-data/business-process/business-process-page`) |
| Hook và service | Import trực tiếp subpath file định nghĩa (ví dụ `@shared/hooks/use-audit-columns`, `@shared/hooks/master-data/use-enum-labels`, `@shared/services/...`) |
| UI primitive nhẹ (`Button`, `Input`, `Checkbox`, `Dialog`, `NumericInput`, `Combobox`...) | Gom một dòng qua `@shared/ui` (hoặc subpath `@shared/ui/...`) |
| `ChartContainer`, `ChartTooltip`, `ChartLegend`, `Calendar`, `Sidebar`, `SidebarProvider` | Bắt buộc subpath `@shared/ui/chart`, `@shared/ui/calendar`, `@shared/ui/sidebar` |
| Editor tiptap (`RichTextEditor`, `NotionEditor`) | Bắt buộc subpath `@shared/components/tiptap/...`, ưu tiên `lazy()` tại route dùng |
| Type, enum, helper, permission | Dùng `@shared/types/...` (hoặc `@shared/types`), `@shared/enums/...` (hoặc `@shared/enums`), `@shared/lib/...` (hoặc `@shared/lib`), `@shared/permission` |

Ví dụ chuẩn:

```ts
import StatusTag from '@shared/components/common/status-tag';
import { Container } from '@shared/components/container';
import { CustomTable } from '@shared/components/custom-table';
import { CustomSelect } from '@shared/components/custom/custom-select';
import DebouncedInput from '@shared/components/custom/debounce-input';
import { deepFilterTree, sortTreeData, TreeTable, type TreeTableTitleProps } from '@shared/components/custom/tree-table';
import { useAuditColumns } from '@shared/hooks/use-audit-columns';
import { Button, Checkbox, Dialog, NumericInput } from '@shared/ui';
import { ChartContainer } from '@shared/ui/chart';
```

- Mỗi nguồn import bắt buộc viết gọn trên một dòng (kể cả `import type` và khi gom nhiều symbol cùng subpath); không tách cùng một nguồn ra nhiều câu import.
- Khi import subpath, đọc kiểu export của file gốc trước để phân biệt named export và `export default`.
- Không tự refactor các dòng import cũ ngoài phạm vi task đang chạm.
- Không sửa `index.ts` hay tự tạo barrel mới trong `frontend/shared/**` khi chưa có task kiến trúc riêng.

## Index page
- Index page dạng bảng bắt buộc dùng `TableToolbar` shared; dùng search có sẵn của layout/toolbar, không dựng ô search riêng.
- `RowActions` dùng `RowActionButton` và xác nhận shared, đặt ngoài thân render nhưng có thể cùng file; không ép tách file riêng.
- Giữ columns, options và callback truyền xuống bảng ổn định khi memoization có tác dụng; không memo hóa hình thức.
- Enum và bộ hằng số giá trị (`enum`) đặt trong `frontend/shared/enums/` hoặc `frontend/shared/types/`; page/form chỉ import để so sánh/lọc giá trị, không liệt kê lại values.
- Hiển thị nhãn và options của enum BE (như `EStatus`, `EPriority`, `EBoardType`...): bắt buộc dùng `useEnumLabel(enumKey, value)` / `useEnumOptions(enumKey, { include? })` từ `@shared/hooks/master-data/use-enum-labels` (hoặc component chuẩn như `<StatusTag>`). Nếu cần lọc tập con giá trị (ví dụ Active/Inactive của `EStatus`), truyền `include: [...]`, map `{ label: o.label, value: String(o.value) }` vào `CustomSelect`/`Combobox`, và đưa vào dependency của `useMemo` nếu nằm trong cột bảng. Cấm hardcode nhãn enum bằng `t('common:isActive.*')` hay object `{ label, value }` tĩnh (chỉ dùng `??` làm fallback nếu cần khi bundle `enum` chưa nạp).

## Routes và forms
- Route dùng `createFileRoute`, search params dùng Zod + `zodValidator`.
- Thư mục không phải route dùng `_components`, `_hooks`, `_schema`, `_utils`.
- Không lạm dụng tạo hàng loạt file con lắt nhắt trong `_components`, `_hooks`, `_utils` nếu logic chỉ phục vụ nội bộ một màn hình/form; giữ logic tập trung để dễ theo dõi và bảo trì toàn bộ luồng.
- Form dùng React Hook Form + `zodResolver`; form/search schema đặt trong `*.schema.ts`.
- Schema có thông báo dịch dùng factory nhận `t: TFunction`; form type suy ra bằng `z.infer`.
- Đổi nguồn `RefDocumentSelector` qua `requestSourceContextChange` và reset trường phụ thuộc.
- Phiếu có nguồn cấu hình qua WorkItemCategory (`category_reference`) phải lấy dữ liệu phiếu nguồn từ `refDocData`/`isRefDocLoading` của `useRefDocSelector`.
  Không gọi thêm hook theo loại phiếu (`useProject`, `useSaleOrder`...) để fetch lại phiếu đã chọn.
  - Includes khai báo một lần qua `mappingIncludes` theo `catRef.refWorkItemCategory.code`; hằng includes đặt trong helper của module.
  - Sẵn sàng khi `refDocId` có giá trị, `!isRefDocLoading` và dữ liệu đúng shape (vd `Array.isArray(refDocData.details)`); không gate theo `isFetching`.
  - Không dựng khối lỗi/retry riêng cho phiếu nguồn; lỗi đã có toast toàn cục và query tự retry, chỉ hiển thị loading.
  - Tab/component con nhận `refDocData`, `isRefDocLoading` qua props optional từ form, không tự fetch lại.
  - Key xử lý chờ (autofill theo nguồn) gắn với `refDocId`, không gắn id theo loại phiếu.
  - Lọc combobox theo danh sách id dùng `id|=a,b`; không dùng `=in=` vì AutoFilter không hỗ trợ và bỏ qua điều kiện đó.
- Tiêu đề form (SheetTitle/DialogTitle) dùng `FormTitle` shared, không viết tay ternary `mode === 'create'`.

## Data flow và shared contracts
- Luồng `routes -> hooks -> services -> api-client`; route/component không gọi trực tiếp fetch/axios.
- Query/mutation đặt trong shared hooks; CRUD service dùng `createBaseService`; Zustand chỉ giữ client state.
- Type, enum (giá trị số khớp BE) đặt trong `frontend/shared/types/<domain>/` hoặc `frontend/shared/enums/`, export qua `index.ts`; app import từ `@shared/types` hoặc `@shared/enums`. Nhãn hiển thị và options động của enum dùng `useEnumLabel` / `useEnumOptions` (`@shared/hooks/master-data/use-enum-labels`), không khai báo bản dịch tĩnh trùng lặp.
- Không copy type/enum/options/hook sang app; app chỉ re-export hook shared, không viết wrapper chứa logic.
- Domain/API contract dùng TypeScript `interface`/`type`; không thêm Zod cho props nội bộ.

## Lookup và table
- FK danh sách dùng `useFkLookup` + batch `fetchByIds`; Select/Combobox dùng `useMasterTableDropdown`.
- Không gọi `useEntityByIdQuery` trong từng dòng/cell.
- Ưu tiên `ResizableWrapTable`; textarea trong table dùng `useAutoResizeTextareaRow`.
- Trường số dùng `NumericInput` shared, không dùng native `input type="number"`.
- Read-only phải tắt sortable behavior.

## Import/export
- Gom logic vào hook domain; export template bằng `useMutation` khi click, không tự tải bằng `useQuery`.
- Tên file: `Template_<Entity_Name>.xlsx`, `DataExport_<Entity_Name>.xlsx`.
