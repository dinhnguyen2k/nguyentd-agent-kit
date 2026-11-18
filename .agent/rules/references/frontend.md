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
Mục tiêu: import gọn, gom nhiều symbol cùng nguồn trên một dòng; chỉ tách subpath cho module nặng. Chưa refactor `frontend/shared`, nên barrel gốc vẫn là cách viết chuẩn cho module nhẹ.

| Loại import | Cách viết |
| --- | --- |
| Component nhẹ (`Container`, `CustomSelect`, `TreeTable`, `DebouncedInput`, `StatusTag`, `deepFilterTree`...) | Gom một dòng qua `@shared/components` |
| UI primitive (`Button`, `Input`, `Checkbox`, `Dialog`, `Combobox`...) | Gom một dòng qua `@shared/ui` |
| `ChartContainer`, `ChartTooltip`, `ChartLegend`, `Calendar`, `Sidebar`, `SidebarProvider` | Bắt buộc subpath `@shared/ui/chart`, `@shared/ui/calendar`, `@shared/ui/sidebar` |
| Editor tiptap (`RichTextEditor`, `NotionEditor`) | Bắt buộc subpath `@shared/components/tiptap/...`, ưu tiên `lazy()` tại route dùng |
| Hook, service, type, enum | Dùng barrel `@shared/hooks`, `@shared/services`, `@shared/types`, `@shared/enums` hoặc subpath đang có trong file; không ép đổi |

Ví dụ chuẩn:

```ts
import { Container, CustomSelect, DebouncedInput, StatusTag, TreeTable, deepFilterTree, sortTreeData } from '@shared/components';
import { Button, Checkbox, Dialog } from '@shared/ui';
import { ChartContainer } from '@shared/ui/chart';
```

- Trong một file, mỗi nguồn chỉ một câu import; không tách cùng nguồn ra nhiều dòng, không trộn barrel và subpath cho module nhẹ cùng nhóm.
- Khi import subpath, đọc kiểu export của file gốc trước: file `export default` (`StatusTag`, `DebouncedInput`, `DateRangeInput`, `ModifierInfo`, `DebouncedTextarea`) phải viết `import DebouncedInput from '@shared/components/custom/debounce-input'`; cấm `{ DebouncedInput }` vì file gốc không có named export đó. Symbol bị barrel đổi tên (`formatAttachmentBytes`, `BusinessProcessManagement`, `TreeTableGlobalFilterElementProps`, `TreeTableTitleProps`) chỉ tồn tại qua `@shared/components`.
- Không refactor import cũ ngoài phạm vi task; không sửa `index.ts` hay file gốc trong `frontend/shared/**` khi chưa có task kiến trúc riêng.
- Khi có barrel nhóm (ví dụ `@shared/components/custom`), rule này sẽ chuyển từ barrel gốc sang barrel nhóm; trước thời điểm đó không tự tạo barrel mới.

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
