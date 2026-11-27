# UI Review Taxonomy (Cogain)

Tài liệu này quy định 3 mức phân hạng lỗi khi review giao diện trong `frontend/**`, bám sát hệ token tại `frontend/erp/src/index.css`, các primitive trong `frontend/shared/ui/` và thành phần bảng `CustomTable`.
Mọi nhận định review phải dựa trên bằng chứng đọc code, lệnh grep kèm `file:line`, hoặc kết quả `auditUiSurface` + ảnh chụp trình duyệt thật khi được phép kiểm thử trình duyệt; không suy diễn từ ảnh chụp giả định hay kết quả chưa chạy (`AI_RULES.md` §2).

## 1. Bảng phân hạng 3 mức

| Hạng | Căn cứ xác định | Ví dụ thực tế trong Cogain | Hành động mặc định |
| --- | --- | --- | --- |
| **Hỏng** | Vỡ bố cục, sai hành vi hoặc kẹt thao tác khiến người dùng không thể hoàn thành nghiệp vụ | Tràn/cuộn ngang cả trang do thiếu `min-w-0`; portal không gọi `getPortalContainer()` làm dropdown/modal lệch khỏi `#app-scale`; lộ chuỗi UUID/GUID kỹ thuật, `undefined`/`NaN` hoặc khóa i18n thô lên giao diện; trộn chọn bộ lọc trên toolbar với tự bật hộp thoại tạo mới; nhồi bảng rộng (`>= 9` cột / `tableMinWidth >= 1200`) kèm nhiều `Card` vào nửa dưới khung chia đôi hẹp hoặc dialog gây cuộn lồng nhau; chữ bị cắt mất nghĩa dữ liệu định danh quan trọng; vùng bấm quá nhỏ (< 24px); `QueryStateGate` kiểm tra `isLoading` trước `selected` gây treo loading; khai báo component con trong thân render gây mất focus hoặc treo tab | Bắt buộc sửa trước khi bàn giao |
| **Lệch hệ** | Dùng sai token, sai primitive hoặc phá vỡ khuôn mẫu dùng chung của Cogain | Tự dựng `<table>`, `<select>`, `<input type="number">` hoặc backdrop `position: fixed` thay cho `CustomTable` và `@shared/ui`; màn hình mới lệch cấu trúc tab/bộ lọc `TableToolbar` so với màn anh em cùng họ nghiệp vụ trong cùng app; viết cứng mã hex hoặc màu Tailwind mặc định thay token `--primary`, `--destructive`, `--border`, `--muted-foreground`; sai chiều cao `h-9`/`h-8` hoặc bo góc `rounded-md`; tự dựng cột `actions` thay prop `rowActions` hoặc bỏ `ActionStack` ở trang chi tiết; tự viết ô 2 dòng thay `DoubleLineCell`/`ColumnCode` hoặc thiếu `tabular-nums` căn phải trên cột tiền/số lượng; import barrel `@shared/components` hoặc `import * as LucideIcons` | Đề xuất sửa theo chuẩn repo tại `file:line` đối chiếu |
| **Gu** | Đúng token và component chuẩn, chỉ khác lựa chọn trình bày hoặc mật độ | Đổi thứ bậc variant giữa hai nút hợp lệ (`default` vs `outline`), điều chỉnh độ rộng cột mặc định hoặc `defaultColumnVisibility`, tinh chỉnh khoảng cách nhóm trường trong cùng quy chuẩn | Chỉ nêu gợi ý ngắn, ghi rõ là gu và không ép sửa |

## 2. Chuẩn Cogain không được báo nhầm là lỗi

Reviewer phải loại trừ các điểm thiết kế chủ đích của Cogain dưới đây để tránh báo lỗi sai:

- Vòng focus bàn phím `focus-visible:ring-[3px]` trên các primitive `@shared/ui` là chuẩn truy cập mặc định của Cogain, không yêu cầu gỡ bỏ.
- `Button` mặc định dùng `variant="default"`, nút `variant="destructive"` dùng nền đặc, giữ `transition-all` và `whitespace-nowrap`.
- `Card` giữ `shadow-sm` và dùng token `--card` / `--background` của `frontend/erp/src/index.css`.
- Chiều mũi tên sắp xếp trên header bảng giữ theo cài đặt hiện tại của `frontend/shared/components/custom-table.tsx`.
- Quy ước placeholder bắt đầu bằng `Nhập...` và ký hiệu `-` cho ô dữ liệu trống được giữ thống nhất.
- `DialogContent` và `SheetContent` có form nhập liệu chặn đóng khi bấm ra ngoài (`onPointerDownOutside={(e) => e.preventDefault()}`) là chủ đích bảo vệ dữ liệu đang nhập.
- Bảng tổng hợp trong `ReportSummaryTable` có `enablePagination={false}` và `enableSorting={false}` là thiết kế chuẩn của `frontend/shared/components/report-layout.tsx`, không coi là thiếu phân trang.

## 3. Tiêu chí kiểm tra nhanh cho từng loại màn hình

- **Màn danh sách CRUD**: dùng `MasterDetailLayout` + `TableToolbar` + `CustomTable`; cột mã dùng `ColumnCode`, cột tên + mã dùng `DoubleLineCell`, thao tác dòng dùng `rowActions`, `SearchSchema` dùng `.optional()` thay `.catch('')`.
- **Form chứng từ và modal**: dùng `Dialog` / `Sheet` chuẩn, `FormField` + `FormMessage`, `NumericInput` cho số, `LazyCombobox` có `selectedOption` khi edit, và schema Zod dùng `z.guid()` cho ID .NET.
- **Màn báo cáo kỳ lương**: dùng `ReportLayout`, `ReportPanel`, `ReportSummaryTable`, `ReportDetailTable`, `PayrollPeriodInput` và định dạng qua `@shared/lib`, không import chéo `_components`/`-components` của route khác.

## 4. Quy trình rà soát bằng code và grep

Khi phân tích **Lệch hệ**, luôn chỉ ra đường dẫn file chuẩn đang áp dụng đúng trong `frontend/shared/` hoặc `frontend/erp/src/index.css` làm đối chứng.
Chạy các lệnh grep chỉ đọc để phát hiện nhanh các điểm lệch hệ trước khi đọc sâu từng file:

```bash
# 1. Tìm barrel import @shared, import toàn bộ lucide-react, hoặc dùng font-mono
rg -n "from ['\"]@shared/(components|hooks|services)['\"]|\* as LucideIcons|font-mono" frontend/

# 2. Tìm mã màu hex cứng hoặc shadow/radius tự chế ngoài token trong TSX
rg -n "#[0-9a-fA-F]{3,8}|shadow-\[|rounded-\[" frontend/ --glob "*.tsx"

# 3. Tìm native input/table/select dễ bỏ qua shared component
rg -n "<table|<select|type=['\"]number['\"]" frontend/ --glob "*.tsx"

# 4. Tìm Zod .uuid() hoặc SearchSchema .catch('') dễ gây lỗi dữ liệu hoặc bẩn URL
rg -n "\.uuid\(|\.catch\(['\"]{2}\)" frontend/ --glob "*.ts*"
```

## 5. Nguyên tắc phạm vi khi báo cáo

- Nếu phát hiện mẫu lệch hệ cũ nằm ngoài các file trong phạm vi task, tách riêng thành mục tồn đọng để xử lý ở đợt dọn kỹ thuật thay vì tự ý mở rộng phạm vi sửa.
- Với mỗi finding xếp hạng **Hỏng** hoặc **Lệch hệ**, báo cáo phải ghi rõ hạng, `file:line` bị ảnh hưởng và `file:line` của mẫu chuẩn cần dùng lại.
- Không tự chạy `tsc`, `vite build`, `eslint`, `vitest` hoặc probe trình duyệt khi chưa có yêu cầu rõ của người dùng (`AI_RULES.md` §2).
