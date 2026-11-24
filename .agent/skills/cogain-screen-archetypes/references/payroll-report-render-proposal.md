# Đề Xuất Tối Ưu Hiệu Năng Render Báo Cáo Kỳ Lương (Tài Liệu Tham Chiếu Mở)

> **Bản chất tài liệu**: Đây là **phương án đề xuất cơ sở đã được phê duyệt về mặt hướng tiếp cận**, dùng làm mốc tham chiếu kỹ thuật khi phân tích hoặc tối ưu các màn hình báo cáo kỳ lương và bảng dữ liệu lớn.
> Tài liệu này **không phải luật bắt buộc cứng nhắc**.
> Khi nghiên cứu sâu hơn trong tương lai phát hiện phương án mới tối ưu hơn, Agent phải đặt phương án cơ sở này và phương án mới lên bàn cân đối chiếu bằng số liệu thực nghiệm thay vì mặc định làm theo đề xuất cũ.
> **Trạng thái (2026-11-23)**: hạng mục A, B, C ở mục 2 đã có trong code (`CustomTable.enableVirtualization` bật mặc định trên `ReportSummaryTable`/`ReportDetailTable`, `columnSizing` khởi tạo lười, tooltip lười `onPointerEnter`, formatter cấp module trong `frontend/shared/lib/utils.ts`, `keepPreviousData` + `staleTime` + `isFilterPending` trong `use-report-queries.ts`); không đề xuất lại, chỉ dùng mục 1 và mục 3 làm mốc so sánh khi đo phương án mới.

## 1. Bằng Chứng Thực Nghiệm & Nguyên Nhân Gốc Đã Xác Minh

Số liệu đo trình duyệt thực tế (`1440x900`) trên hai màn hình `labor-order-payroll-report` (kỳ nặng có `35.000` dòng chi tiết, `228 - 1.200` dự án) và `team-loan-payroll-report` (kỳ nặng có `4.000` phiếu, `1.265` cặp tổ phát sinh chéo):

1. **Bảng tổng hợp (`ReportSummaryTable`) dựng toàn bộ DOM không ảo hóa + render kép khi mount**:
   - API `/summary` trả toàn bộ tập nhóm trong kỳ để đối chiếu tổng thể, trong đó ma trận cặp tổ `byPair` tăng bậc hai $O(T^2)$ theo số tổ giao dịch.
   - Khung nhìn thực tế trên màn hình chỉ chứa `7 - 11` dòng, nhưng `ReportSummaryTable` (`frontend/shared/components/report-layout.tsx`) tắt phân trang và dựng toàn bộ `> 1.200` dòng (`~30.930` phần tử DOM), gây khóa cứng luồng chính `5.834 ms` (tổng thời gian chờ giao diện `11.761 ms` dù dữ liệu đã tải sẵn `0ms` mạng, tăng `+84,5 MB` JS Heap) và kéo tốc độ cuộn dọc xuống `34 - 35 FPS`.
   - Trong `CustomTable` (`frontend/shared/components/custom-table.tsx`), khi `isActionPolicyEnabled === false`, `columnSizing` khởi tạo `{}` rồi gọi `setColumnSizing` trong `useEffect` ngay sau lần vẽ đầu (do cột `stt` và cột mũi tên khai báo `size`), ép toàn bộ bảng lớn chạy lại vòng render thứ hai ở mọi lần chuyển tab.
2. **Chi phí nhân bản $O(N \times M)$ trên từng dòng và từng ô**:
   - `createSummaryAffordanceColumn` (`frontend/shared/components/report-layout.tsx`) mount sẵn Radix `<Tooltip>` cho mọi dòng dù chưa rê chuột (`1.265` instance Popper/Trigger khởi tạo đồng thời).
   - `TableCellWithTooltip` khởi tạo state/callback và chạy `cn()` (`tailwind-merge`) hai lần mỗi ô (tại `custom-table.tsx` và `frontend/shared/ui/table.tsx`), kèm `transition-colors duration-300` trên mọi `<td>` và hiệu ứng `row-appear` làm trễ hiển thị 20 dòng đầu tới `700 ms`.
   - `formatVnd` và `formatNumber` (`frontend/shared/lib/utils.ts`) khởi tạo mới `new Intl.NumberFormat('vi-VN', ...)` trên từng ô thay vì dùng hằng khởi tạo sẵn ở cấp module.
   - `ColumnCode` gọi `useNavigate()` vô điều kiện dù màn hình truyền `onClick`; cột biên bản nghiệm thu ở báo cáo mượn tiền tổ cấp phát mảng `.map()` mới trên mỗi dòng và import trực tiếp từ `-components` nội bộ của route khác.
3. **Render lan truyền toàn trang & tính toán thừa các chiều đang ẩn**:
   - State thu gọn thẻ chỉ số KPI (`isMetricsExpanded`) đặt ở component trang gốc kết hợp các callback inline làm thao tác bấm thu gọn KPI (không đổi dữ liệu bảng) vẫn khóa luồng chính `728 - 1.380 ms`.
   - `onTableInstanceReady={setDetailTable}` kích hoạt thêm một vòng render toàn trang khi mở tab chi tiết và giữ lại tham chiếu bảng cũ sau khi tab chi tiết đã unmount.
   - Component tab tổng hợp tính `sumReportFields` và dựng `useMemo` cột cho cả 2 - 3 chiều cùng lúc dù chỉ hiển thị 1 chiều theo `viewMode`.
4. **Chuyển trang/lọc thiếu giữ dữ liệu tạm (`placeholderData`) và `staleTime`**:
   - `useReportSummaryQuery` và `useReportPageQuery` (`frontend/shared/hooks/use-report-queries.ts`) rơi về `undefined` khi chuyển sang trang chưa cache, buộc xóa trắng bảng -> dựng `TableSkeleton` -> dựng lại toàn bộ DOM.

## 2. Phương Án Đề Xuất Đã Phê Duyệt (Mốc Cơ Sở)

1. **Hạng mục A - Ảo hóa dòng thông minh trên HTML `<table>` & bỏ render kép lúc mount**:
   - Thêm prop tùy chọn tương thích ngược `enableVirtualization?: boolean` và `virtualRowEstimate?: number` vào `CustomTable` (chỉ kích hoạt khi bật cờ, không dùng `renderSubComponent`/`getRowCanExpand`, và số dòng vượt ngưỡng nhỏ như `> 40` dòng để không ảnh hưởng màn CRUD thường).
   - Dùng `@tanstack/react-virtual` sẵn có theo mẫu **2 dòng đệm đầu/cuối (`paddingTop` / `paddingBottom` spacer `<tr>`)** bên trong `<tbody>` kết hợp `measureElement` trên `TableRow` (`overscan: 8`), giữ nguyên `<colgroup>` `table-layout: fixed`, header `sticky top-0`, cột `sticky` trái/phải và `<tfoot> sticky bottom-0`.
   - Tự động tắt hiệu ứng `row-appear` khi ảo hóa đang hoạt động; bật sẵn `enableVirtualization` trên `ReportSummaryTable` và `ReportDetailTable`.
   - Khởi tạo lười `columnSizing` ngay trong `useState(() => ...)` từ `baseColumns` để triệt tiêu vòng render kép sau mount.
2. **Hạng mục B - `Tooltip` lười khi rê chuột & làm nhẹ Cell Primitives / Formatter**:
   - Tại `createSummaryAffordanceColumn`, **chỉ mount Radix `<Tooltip>` khi người dùng thực sự rê chuột vào ô (`onPointerEnter` hover-lazy giống cơ chế của `TableCellWithTooltip`)** thay vì mount sẵn cho toàn bộ các dòng ngay lúc render và không hạ cấp xuống `title` thuần để giữ trải nghiệm giao diện đồng nhất.
   - Đưa `Intl.NumberFormat` trong `formatVnd` và `formatNumber` lên hằng dùng chung cấp module.
   - Trong `TableCellWithTooltip`, đi nhánh nhẹ khi cột bật `wrapText` (không cần theo dõi cắt chữ ellipsis), giảm gọi trùng `twMerge`, bỏ `duration-300` trên mọi `<td>` và bọc `React.memo` cho dòng dữ liệu để click chọn 1 dòng không render lại toàn bảng.
   - Tách nhánh không gọi `useNavigate()` khi `ColumnCode` chỉ dùng `onClick`; chuyển component liên kết biên bản nghiệm thu ra thư mục component dùng chung hợp lệ của ứng dụng và nhận thẳng mảng gốc.
3. **Hạng mục C - Cô lập State thanh công cụ & làm mượt Cache truy vấn**:
   - Cô lập state đóng/mở khu vực chỉ số KPI, ổn định tham chiếu `columns`/`handleDrillDown`, bọc `React.memo` cho `ReportSummaryTable`/`ReportDetailTable`, chỉ tính `sumReportFields` và cột cho đúng `viewMode` đang mở, và dọn `detailTable` (`null`) khi tab chi tiết unmount.
   - Bổ sung `placeholderData: keepPreviousData` và `staleTime: 30_000` cho `useReportSummaryQuery` / `useReportPageQuery`.

## 3. Quy Tắc Đánh Giá Mở Với Các Đề Xuất Tối Ưu Sâu Hơn Trong Tương Lai

Khi nghiên cứu sâu hơn hoặc khi bối cảnh kỹ thuật thay đổi (ví dụ: ảo hóa hai chiều cả dòng lẫn cột cho bảng rất rộng, đổi cấu trúc lưới không dùng `<table>` truyền thống, đẩy tổng hợp/lọc nhóm lớn về máy chủ hoặc Web Worker, tách cửa sổ hiển thị theo lô, hoặc bật React Compiler), thực hiện đối chiếu công bằng giữa **Đề xuất cơ sở này** và **Đề xuất mới** trên 5 tiêu chí:

1. **Hiệu năng đo thực chứng trên trình duyệt**: So sánh trực tiếp thời gian khóa luồng chính (`ScriptDuration`, `RecalcStyle + Layout`, `Total Blocking Time`), tốc độ khung hình khi cuộn dọc/ngang và biến động bộ nhớ trên kỳ dữ liệu nặng (`>= 1.200` dòng tổng hợp, `100` dòng chi tiết x `20` cột).
2. **Độ toàn vẹn hiển thị & bất biến nghiệp vụ**: Giữ khớp tuyệt đối độ rộng cột giữa header - thân bảng - dòng tổng cộng `<tfoot>`, giữ đúng cột ghim `sticky` trái/phải kèm bóng đổ, và bảo toàn 5 bất biến báo cáo kỳ lương (mốc `HrConfirmedDate`, phiếu `Closed`, kỳ `16..15`, tổng toàn kỳ, xuất Excel stream độc lập giao diện).
3. **Bán kính ảnh hưởng & tương thích ngược**: Đánh giá rủi ro hồi quy lên hàng chục màn hình danh sách CRUD đang dùng chung `CustomTable` (chọn dòng, sửa kích thước cột, ẩn hiện/kéo thả thứ tự cột, dòng mở rộng con).
4. **Độ phức tạp kiến trúc & chi phí bảo trì**: Ưu tiên phương án ít khái niệm mới, ít phân mảnh tệp và dễ gỡ lỗi hơn theo `.agent/rules/solution-complexity.md` nếu hiệu năng thực tế tương đương.
5. **Khả năng lùi an toàn (Reversibility)**: Ưu tiên thiết kế đóng gói sau ranh giới component chuẩn (`ReportSummaryTable` / `ReportDetailTable` / `CustomTable`) để có thể nâng cấp hoặc thay thế mà không phải sửa lại từng màn hình báo cáo.
