---
trigger: glob
glob: "frontend/**/*"
---

# FRONTEND.MD - Quy Tắc Miền Frontend Cogain

> Mục tiêu: Tối giản hóa context và chuẩn hóa các quy tắc giao diện (React 19 + Vite + TanStack + shared package).

---

## 0. Ưu Tiên Và Phạm Vi
1. `AI_RULES.md` là source of truth cao nhất. Rule này chỉ là extension cho frontend domain.
2. Scope áp dụng: `frontend/*/src/**`, `frontend/shared/**`, các file config frontend.

---

## 1. Stack Công Nghệ
- Core: React 19 + TypeScript + Vite.
- Routing/Query: TanStack Router + TanStack Query.
- State/Style: Zustand + TailwindCSS + Radix UI + shared package `@shared/*`.
- Cấm sử dụng pattern/framework khác (như Next.js App Router) trừ khi được yêu cầu rõ.

---

## 2. Quy Tắc Layering (BẮT BUỘC)
1. Luồng dữ liệu: `routes -> hooks -> services -> api-client`.
2. Component/Route: Cấm gọi trực tiếp fetch/axios. Phải qua hooks/services.
3. React Query: Đặt `useQuery`/`useMutation` trong hooks.
4. Services: Định nghĩa bằng `createBaseService` từ `@shared/services/base-service`.
5. Global State: Dùng Zustand ở `src/stores/**` cho local state. Cấm lưu server data vào Zustand.

---

## 3. Routing & Search Params (BẮT BUỘC)
1. Tạo route: Dùng `createFileRoute`.
2. Search params: Validate bằng `zod` + `zodValidator`.
3. Sau khi đổi route: Phải chạy lệnh regenerate route tree: `pnpm --filter <app> generate:routes`.

---

## 4. Quy Tắc Form, Input & Căn Lề Layout (BẮT BUỘC)
1. **Form Flow**: Dùng `react-hook-form` + `zodResolver`.
2. **RefDocumentSelector**:
   - Layout chuẩn: `className="space-y-0 w-full"` và `gridClassName="grid grid-cols-[1fr_1.5fr] gap-x-1.5 items-end px-0 w-full"`.
   - Logic: Khi thay đổi dữ liệu, luôn cập nhật trong `requestSourceContextChange` và reset toàn bộ trường phụ thuộc về rỗng.
3. **Căn Lề Động Cho Lỗi Form**:
   - Đặt định vị absolute cho thông báo lỗi: `<FormMessage className="absolute bottom-0 left-0" />`.
   - Thêm padding-bottom động cho `FormItem` dựa trên trạng thái lỗi của hàng để tránh so le hàng: `className={relative transition-all duration-200 ${isRowHasError ? 'pb-5' : 'pb-0'}}`.
4. **DatePicker/Dropdown**: Nút xóa `X` đặt bên trái `CalendarIcon`, không đè lên icon.

---

## 5. Ràng Buộc UI Component Cốt Lõi (BẮT BUỘC)
1. **Trường Số**: Bắt buộc dùng `NumericInput` từ `@shared/ui`. Cấm dùng native `input type="number"`.
2. **Textarea trong Table**: Bắt buộc dùng `useAutoResizeTextareaRow` từ `@shared/hooks`. Cấm bỏ qua.
3. **ScrollArea (Radix UI)**: Phải bọc trong container có chiều cao cố định (ví dụ `h-[200px]`), ScrollArea nhận class `h-full w-full`. Cấm dùng `max-h` trực tiếp trên ScrollArea trong flex/grid layout.

---

## 6. Quy Tắc Table & Data Listing (BẮT BUỘC)
1. **ResizableWrapTable**: Bắt buộc ưu tiên sử dụng cho mọi table.
2. **Cột Checkbox/Action (width < 60px)**: Căn giữa tuyệt đối bằng `headerClassName: 'px-0'` và `cellClassName: 'px-0 text-center'`.
3. **useMemo Dependency cho Columns**:
   - Bắt buộc khai báo đầy đủ các state/props/functions sử dụng bên trong các callback (`cell`, `header`, `accessorFn`) vào dependency array để tránh stale closure.
   - Đặc biệt chú ý các state động (như `isReadOnly`, `options`, `collapsedRowIds`).

---

## 7. Hiệu Năng Drag-and-Drop Frontend
1. **Item nhẹ**: Cấm đặt control nặng, dropdown lớn hoặc portal content trực tiếp trong item đang kéo.
2. **Selector đóng**: Giữ Combobox/Dropdown đóng khi kéo, chỉ lazy-render popover khi click mở.
3. **DnD Kit**: Dùng `SortableContext`, `verticalListSortingStrategy`, `KeyboardSensor` và transform CSS.
4. **Trì hoãn Validation**: Cập nhật order/form field một lần duy nhất khi kết thúc kéo (drop) với `shouldValidate: false`.
5. **Read-only**: Tắt hoàn toàn sortable behavior trong chế độ read-only.

---

## 8. Auth, Permission & API Client
1. **Quyền hạn**: Kiểm tra bằng `@shared/permission` và `useHasPermission`. Cấm bypass permission.
2. **X-Employee-Id**: Để interceptor của `api-client` tự động gán, cấm gán thủ công từng request.
3. **Đa ngôn ngữ**: Bắt buộc dùng `t('namespace:key', 'FallbackText')` của `react-i18next`. Cấm hardcode text hiển thị.

---

## 9. Tiêu Chuẩn Import/Export Master Data
1. **Export Template**: Bắt buộc dùng `useMutation` kích hoạt khi click (cấm dùng `useQuery` tải tự động).
2. **Tên File**: Theo chuẩn `Template_<Entity_Name>.xlsx` (mẫu) và `DataExport_<Entity_Name>.xlsx` (dữ liệu).
3. **Gom Hook**: Tập trung logic import/export trong hook theo domain (ví dụ `useProductModel`).

---

## 10. Quy Tắc Tra Cứu Thực Thể (Entity Lookup) & Phòng Chống N+1 API Calls (BẮT BUỘC)
1. **useEntityByIdQuery (Đơn lẻ)**: 
   - **Phạm vi**: CHỈ DÙNG cho màn hình Detail View, Header Card, InfoField đơn lẻ khi chỉ cần tra cứu 1–3 foreign keys độc lập.
   - **CẤM**: Nghiêm cấm gọi `useEntityByIdQuery` bên trong các dòng/cột của Table, Data Grid, hoặc List lặp để tránh kích hoạt hàng chục request đơn lẻ gây nghẽn mạng (N+1 Waterfall Requests).
2. **useFkLookup (Hàng loạt / Batch)**: 
   - **Phạm vi**: BẮT BUỘC DÙNG cho màn hình Danh sách, Table, Grid nhiều dòng để gom toàn bộ FK IDs từ các rows và gọi batch `fetchByIds` 1 lần duy nhất cho toàn bộ trang.
3. **useMasterTableDropdown**: Dùng cho Select/Combobox/Dropdown lựa chọn options.

---

## 11. Quy Tắc Quản Lý Shared Types, Hooks & Zod Schemas (BẮT BUỘC)
1. **Shared Types (@shared/types)**:
   - **Định vị tập trung**: Mọi Domain Entity, API DTO, Request/Response payload, Filter Params type phục vụ các dịch vụ backend hoặc dùng cho nhiều màn hình/app **BẮT BUỘC** phải được định nghĩa trong `frontend/shared/types/<domain>/` (ví dụ `master-data/`, `servicedesk/`, `hrm/`) và re-export tại `frontend/shared/types/index.ts`.
   - **Cấm Duplicate**: Nghiêm cấm tạo file type trùng lặp, copy-paste giữa các app con (`bizdoc`, `erp`, `hrm`, `interactive`). Các app con chỉ được import từ `@shared/types` hoặc re-export lại từ `@shared/types` nếu cần backward compatibility.
2. **Shared Hooks (@shared/hooks)**:
   - Mọi Custom Hook xử lý dữ liệu hoặc logic UI tái sử dụng (CRUD queries/mutations, FK batch lookup, master dropdown, copy/paste row values, auto-resize textarea, export template, upload file) **BẮT BUỘC** phải đưa ra `frontend/shared/hooks/`.
3. **Kiến Trúc Zod Schema vs TypeScript Types**:
   - **Form Schema & Search Params (UI Validation)**:
     - Viết Zod schema trong file `*.schema.ts` riêng biệt (ví dụ `production-order-form.schema.ts`).
     - **Schema Factory Pattern**: Bắt buộc bọc Zod schema trong hàm nhận `t: TFunction` (ví dụ `createProductionOrderFormSchema = (t: TFunction) => z.object({...})`) để thông điệp lỗi tự động dịch theo ngôn ngữ người dùng hiện tại (i18n).
     - **Inferred Form Types**: Export kiểu dữ liệu form trực tiếp qua `z.infer<ReturnType<typeof createSchema>>` để đảm bảo Single Source of Truth cho Form Validation, tránh type drift.
   - **Domain Entity & API DTOs (Data Contracts)**:
     - Khai báo dưới dạng TypeScript `interface` / `type` thuần túy trong `@shared/types/` để đạt hiệu năng compile tối đa và không làm phình runtime bundle size.
     - Không lạm dụng Zod schema cho props nội bộ giữa các React component thuần túy.

---

## 12. Frontend Execution Gate

### 12.1. Viết Code Theo Lint (BẮT BUỘC)
1. `eslint.config.js` và `tsconfig.eslint.json` của app là source of truth.
   Khi bắt đầu chạm một app mới, hoặc khi config lint thay đổi, đọc config trước khi code;
   không copy một checklist cũ nếu nó mâu thuẫn với config.
2. Trước khi kết thúc edit, tự rà các lỗi phổ biến của config hiện tại:
   - Không để import, biến, parameter hoặc expression không dùng; xóa thay vì prefix/hack.
   - Không dùng `any`, type assertion hoặc non-null assertion để che lỗi type nếu chưa có
     invariant được chứng minh.
   - Hook phải tuân thủ Rules of Hooks; dependency array đầy đủ và stable, không tắt
     `react-hooks/exhaustive-deps` để né lỗi.
   - Giữ module component/route phù hợp Fast Refresh; tách constant/helper không liên quan
     khỏi component module khi warning thực sự xảy ra.
   - Không thêm `eslint-disable`/`@ts-ignore` trừ khi không có giải pháp đúng hơn; scope
     nhỏ nhất, nêu lý do và rule bị disable.

### 12.2. ON-DEMAND ONLY - HARD RULE

1. **DO NOT RUN lint, typecheck, route generation, Vite build, browser checks, or
   tests automatically.**
2. Run a frontend validation command only when the user explicitly requests that
   validation action by name, such as `lint`, `typecheck`, `build`, `/test`, or `/verify`.
3. `fix`, `implement`, `finish`, `done`, `check`, governed classification, changed
   routes, shared files, or handoff requirements do not authorize validation.
4. When validation is explicitly requested, use the exact requested scope. Do not
   expand from one app to all apps unless the user explicitly requests `--all`.
5. **IDEMPOTENT:** run each approved validation command at most once for the same
   source state. Do not rerun it when relevant inputs have not changed.

### 12.3. Handoff Status

- Source changes complete: `Status: implemented`.
- No explicit validation request: `Validation: not run - not requested`.
- Validation command completed with evidence: `Status: verified`.
- **DO NOT block implementation handoff while waiting for an unrequested validation.**

Các mode validation opt-in và cách chọn scope nằm tại
`.agent/rules/frontend-fastcheck.md`.
