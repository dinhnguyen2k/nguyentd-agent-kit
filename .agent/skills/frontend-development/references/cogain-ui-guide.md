# Cogain UI Guide

Tài liệu này tổng hợp các quy ước giao diện chuẩn của Cogain, bám sát token trong `frontend/erp/src/index.css` và các component dùng chung trong `frontend/shared/`.
Ưu tiên số 1 luôn là tái sử dụng component trong `frontend/shared/` và tuân thủ `[skill:cogain-screen-archetypes]`.

## 1. Trạng thái dữ liệu và tương tác

- Mọi màn hình hoặc panel dữ liệu phải xử lý đủ bốn trạng thái: loading, empty, error và disabled.
- Panel chi tiết (như vùng detail của `MasterDetailLayout`) dùng `QueryStateGate` (`frontend/shared/components/query-state-gate.tsx`).
- Khi dùng `QueryStateGate`, bắt buộc kiểm tra `selected` trước `isLoading` vì TanStack Query v5 để query disabled ở `status === 'pending'` nên đảo thứ tự sẽ gây treo trạng thái tải vĩnh viễn.
- Khi cần hiển thị lỗi tải kèm nút thử lại tại chỗ, dùng `QueryErrorAlert` (`frontend/shared/components/query-error-alert.tsx`) với prop `onRetry`.
- Trạng thái rỗng của khối riêng dùng `Empty` (`frontend/shared/ui/empty.tsx`), còn bảng dùng prop `emptyMessage` của `CustomTable` (`frontend/shared/components/custom-table.tsx`).
- Khi chuyển trạng thái (loading, hover, chọn dòng, thông báo lỗi), không để bố cục xung quanh bị nhảy hoặc co giãn theo nội dung mới xuất hiện.
- Trạng thái loading trên nút thao tác giữ nguyên chiều rộng nút để không đẩy lệch các nút đứng cạnh.
- Nút disabled giữ `disabled:pointer-events-none disabled:opacity-50` chuẩn của `Button` (`frontend/shared/ui/button.tsx`).
- Khi nút disabled cần giải thích lý do qua tooltip, truyền prop `tooltip` trực tiếp cho `Button` (component tự bọc wrapper `cursor-not-allowed pointer-events-auto`) thay vì tự bọc thẻ ngoài.
- Mọi phần tử bấm được phải có `cursor-pointer` và phản hồi hover rõ ràng trên chính phần tử tương tác.
- Phần tử chỉ để đọc (như `ReportMetricCard` hoặc dòng tĩnh) không gắn nền hover gây hiểu nhầm là bấm được.

## 2. Bố cục, token và lồng khối

- Trang danh sách CRUD dùng `MasterDetailLayout` (`frontend/shared/components/master-detail-layout.tsx`) kết hợp `TableToolbar` (`frontend/shared/components/custom/table-toolbar.tsx`) và `CustomTable`.
- Trang báo cáo dùng `ReportLayout`, `ReportPanel`, `ReportSummaryTable`, `ReportDetailTable` và `ReportFilterChips` (`frontend/shared/components/report-layout.tsx`).
- Trang form hoặc trang chi tiết độc lập dùng `Container` (`frontend/shared/components/container.tsx`) với `variant="default"` cho màn bảng hoặc `variant="card"` cho form và chi tiết độc lập.
- Giữ nguyên hệ biến màu từ `frontend/erp/src/index.css` (`--background`, `--foreground`, `--card`, `--popover`, `--primary`, `--primary-hover`, `--destructive`, `--border`, `--input`, `--ring`, `--muted`, `--muted-foreground`).
- Không tự chế màu nền, mã hex cứng hoặc bóng đổ mới thay cho token hiện có.
- `Card` (`frontend/shared/ui/card.tsx`) giữ nguyên `shadow-sm`, viền chuẩn và nền `--card`.
- Không lồng quá hai tầng khối và không bọc `CustomTable` vào thêm một `Card` có padding thừa bên ngoài vì bảng đã có khung riêng.
- Đường chia giữa các nhóm trong menu hoặc card cần chạm sát mép khối hợp lý, tránh dùng margin âm thủ công lệch padding cha.
- Mọi flex item hoặc grid item chứa chữ dài, mã hoặc số động phải đặt `min-w-0` để không đẩy vỡ lưới và gây cuộn ngang cả trang.
- Tránh bẫy cuộn dọc lồng nhau: không bọc thêm vùng `overflow-y-auto` bên ngoài `MasterDetailLayout` hoặc bảng đã tự quản lý thanh cuộn riêng.
- Trên màn hình hẹp, ưu tiên cuộn ngang trong khung bảng hoặc ẩn bớt cột phụ qua `defaultColumnVisibility`, tuyệt đối không làm mất thao tác chính của dòng.

## 3. Chữ, số, ngày và ô trống

- Giữ font chữ hệ thống Gilroy khai báo trong `frontend/erp/src/index.css` với `antialiased` trên `body`.
- Không dùng `font-mono` trong giao diện app (theo `.agent/rules/references/frontend.md`).
- Mã chứng từ trong bảng dùng `<ColumnCode />` (`frontend/shared/components/column-code.tsx`) để đồng bộ kiểu link xanh hoặc plain text.
- Ô ghép hai dòng gồm tên và mã dùng `<DoubleLineCell />` (`frontend/shared/components/double-line-cell.tsx`).
- Tiêu đề ngắn một dòng trong ô bảng dùng `truncate` kèm `min-w-0`.
- Câu mô tả hoặc ghi chú nhiều dòng cho phép xuống dòng tự nhiên thay vì cắt cụt làm mất nội dung giải thích.
- Cột số, tiền tệ, phần trăm và cột ngày giờ xếp dọc bắt buộc gắn class `tabular-nums` để thẳng hàng giữa các dòng.
- Cột số và tiền căn phải (`text-right`), đồng thời giữ giá trị và đơn vị tiền tệ trên cùng một dòng (`whitespace-nowrap`).
- Định dạng tiền tệ, số lượng và ngày tháng phải gọi thống nhất `formatVndSafe`, `formatNumber` và `formatDate` từ `@shared/lib` (`frontend/shared/lib/utils.ts`).
- Ô không có giá trị trong bảng hoặc khối nhãn-giá trị hiển thị `-` (hoặc giá trị fallback thống nhất của component shared), không để ô trống hoàn toàn.
- Mốc thời gian trong bảng nhật ký hoặc lịch sử hiển thị ngày giờ tuyệt đối rõ ràng, tránh dùng giờ tương đối mơ hồ khi đối chiếu chứng từ.

## 4. Control, bộ lọc và form

- Giữ nguyên chuẩn kích thước và hình khối của `frontend/shared/ui/`: control cao `h-9` (mặc định) và `h-8` (compact `sm`), bo góc `rounded-md`, vòng focus `focus-visible:ring-[3px]`.
- `Button` giữ mặc định `variant="default"`, nút phá hủy dùng `variant="destructive"` nền đặc, giữ nguyên `transition-all` và `whitespace-nowrap`.
- Không thay đổi chiều mũi tên sắp xếp trên header của `frontend/shared/components/custom-table.tsx`.
- Ô chọn danh mục có phân trang từ API dùng `LazyCombobox` (`frontend/shared/components/lazy-combobox.tsx`).
- Khi sửa bản ghi hoặc hydrate từ URL/chi tiết, luôn truyền `selectedOption` vào `LazyCombobox` để hiển thị nhãn ngay lập tức trước khi người dùng mở dropdown.
- Bộ lọc nâng cao trên thanh công cụ dùng `FilterPopoverLayout` (`frontend/shared/components/filter-popover-layout.tsx`) kết hợp `FilterField`.
- Trường nhập số dùng `NumericInput` (`frontend/shared/ui/numeric-input.tsx`), không dùng native `<input type="number">`.
- Form dùng React Hook Form + `zodResolver` với các primitive trong `frontend/shared/ui/form.tsx` (`Form`, `FormField`, `FormItem`, `FormLabel`, `FormMessage`).
- Câu lỗi validate phải hiển thị ngay dưới ô nhập qua `FormMessage`; không đưa câu lỗi vào `placeholder` hay `tooltip`.
- Trong nhóm tab hoặc dialog form nhiều bước, giữ nguyên hiển thị lỗi rõ ở từng trường và không làm mất dữ liệu người dùng vừa nhập khi có lỗi từ server.
- Mọi `<label>` gắn đúng `htmlFor` trùng với `id` của control để bấm vào nhãn là focus đúng ô nhập.
- Giữ nguyên quy ước placeholder bắt đầu bằng `Nhập...` và khai báo đủ locale key `vi` / `en`.

## 5. Lớp nổi và thao tác dòng

- Hộp thoại và panel trượt phải dùng `Dialog` (`frontend/shared/ui/dialog.tsx`), `Sheet` (`frontend/shared/ui/sheet.tsx`), `PopConfirm` (`frontend/shared/components/pop-confirm.tsx`) hoặc `DeleteConfirm` (`frontend/shared/components/delete-confirm.tsx`).
- Cấm tự dựng backdrop bằng `position: fixed` vì sẽ mất focus trap, khóa cuộn nền và quản lý phím `Esc` của Radix.
- Mọi portal Radix (`DialogPortal`, `SheetPortal`, `Select`, `Popover`, `HoverCard`, `AlertDialog`) phải truyền container qua `getPortalContainer()` từ `@shared/lib`.
- Cơ chế `getPortalContainer()` giữ overlay nằm trong `#app-scale` (`frontend/erp/src/index.css`) để đồng bộ tỷ lệ zoom và không bị lệch tọa độ.
- `DialogContent` và `SheetContent` có form nhập liệu giữ mặc định `onPointerDownOutside={(e) => e.preventDefault()}` để bấm nhầm ra ngoài không làm mất dữ liệu đang nhập.
- Modal hoặc sheet chỉ đóng chủ động qua nút đóng, nút Hủy hoặc phím `Esc`.
- Thao tác trên dòng bảng `CustomTable` truyền qua prop `rowActions` (`RowActionsConfig` từ `@shared/components/custom/table-row-actions`).
- `RowActionsConfig` hỗ trợ `onView`, `onEdit`, `onDelete`, `canView`, `canUpdate`, `canDelete`, `editDisabledReason`, `deleteDisabledReason` và tự co số nút hiển thị theo bề rộng bảng (`maxVisible` mặc định 3, co còn 2 dưới 768px và 1 dưới 480px).
- Cấm tự dựng cột `id: 'actions'` và state `DeleteConfirm` riêng trong từng route danh sách.

## 6. Kỷ luật hiệu năng UI

- Cấm tuyệt đối `import * as LucideIcons from 'lucide-react'`; chỉ import đích danh từng icon cần dùng hoặc dùng `DynamicIcon` (`lucide-react/dynamicIconImports`).
- Cấm import qua barrel `@shared/components`, `@shared/hooks` hoặc `@shared/services`; phải import trực tiếp subpath file (ví dụ `@shared/components/custom-table`, `@shared/components/double-line-cell`).
- Cấm khai báo component con bên trong thân hàm render của component cha vì gây unmount và remount toàn bộ nhánh DOM mỗi lần render lại.
- Không mount sẵn `Tooltip` hoặc `Popover` trên hàng nghìn ô bảng khi chưa hover hoặc tương tác.
- Giữ callback, cột `useMemo` và bảng tra cứu `O(1)` ổn định để tránh khóa main thread khi render bảng dữ liệu lớn.
- Không gọi `console.log` dữ liệu mảng hoặc object kích thước lớn trên môi trường Production.
