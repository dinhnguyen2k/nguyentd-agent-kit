# Bố cục trang: đầu trang, trang lỗi

> Trích nguyên văn từ evondevKit `skills/ui-ux` commit `dff15b4` (MIT). Cogain override trong `frontend-development/SKILL.md` (mục "UI reference") thắng nội dung dưới đây.

<!-- nguồn: references/layouts/app.md:470-513 -->
### Đầu trang trong vùng nội dung

```
Khách hàng  ›  Khách hàng doanh nghiệp          <- chỉ các cấp CHA, là link
Công ty TNHH Minh Phát              [⤓ Xuất file] [+ Tạo đơn hàng]
Khách hàng từ 3/2024, 18 đơn hàng, doanh thu 1.284.500.000 đ
```

```tsx
<header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
  {/* flex-1: khối chữ lấy hết chỗ còn lại, không co theo dòng dài nhất */}
  <div className="min-w-0 flex-1">
    <Breadcrumb items={parents} />{/* ../components/breadcrumb.md; hàng h-8 đã chừa khoảng, tên không mt */}
    <h1 className="text-xl font-semibold text-balance">{title}</h1>
    <p className="mt-1 max-w-[55ch] text-sm text-pretty text-muted">{description}</p>
  </div>
  <div className="flex shrink-0 gap-2">{actions}</div>
</header>
```

- **Đường dẫn chỉ ghi các cấp cha, không ghi trang đang đứng.** Tên trang nằm ngay dưới, ghi lại là lặp ("Cài đặt › Thành viên" rồi "Thành viên"). Ghi một chữ khác tên trang còn tệ hơn: "Khách hàng › Hồ sơ" trên đầu "Công ty TNHH Minh Phát", người đọc không biết mình đang ở đâu. Hình, đường dài, màn hẹp: `../components/breadcrumb.md`.
- **Đường dẫn đặt ở MỘT chỗ.** App đã có đường dẫn trên thanh header `h-16` thì đầu trang không lặp lại, chỉ còn tên, mô tả, nút.
- **Một trang đúng một `<h1>`, và tên trang chỉ ghi MỘT chỗ.** Hai `<h1>` thì trình đọc màn hình không biết trang này tên gì; không `<h1>` nào thì cũng vậy. Chia theo loại trang:
  - **Trang không có đầu trang riêng** (danh sách, bảng quản lý, tổng quan, kanban): tên trên thanh header `h-16` **chính là `<h1>`**, giữ nguyên cỡ chữ của thanh (`text-base font-semibold`, cỡ chữ không đổi theo thẻ; 700 chỉ cho trang trình diễn, `T2`). Vùng nội dung không lặp lại tên; nút chính ("+ Thêm khách hàng") nằm cuối hàng công cụ cạnh ô tìm.
    - **Hàng công cụ không vừa một hàng mà tách hai thì nút chính lên cuối hàng TRÊN** (`ml-auto`,
      `shrink-0`), thẳng mép phải vùng nội dung; ô tìm, lọc xuống hàng dưới. Đừng để hàng dưới
      `flex` trơn nối nút chính sau ô lọc: nút lơ lửng giữa hàng, không thẳng với khối nào. Dưới `sm` giữ xếp dọc, nút chính rộng hết ở cuối: đưa lên hàng trên thì chữ ngày gãy dòng.
    - **Có điều hướng ngày** (lịch, lịch hẹn, báo cáo theo ngày) thì cụm `‹ [Hôm nay] ›` theo đúng
      mục "Lịch công việc" bên dưới: ‹ › là `ghost` chỉ icon, chỉ "Hôm nay" có viền. Ba ô viền
      cạnh nhau là ba khối nặng cho một việc phụ.
  - **Trang có đầu trang riêng** (chi tiết bản ghi, form tạo, trang có mô tả hay nút riêng cho bản ghi): `<h1>` là tên trong đầu trang; thanh header chỉ ghi **cấp cha** ("Khách hàng" là link), bằng `<p>`/`<nav>`, không ghi lại tên trang.
  - Khung app nhận tên trang từ route rồi tự chọn thẻ: có đầu trang riêng thì `<p>`, không thì `<h1>`. Đừng để mỗi trang tự nhớ.
- **Tên trang `text-xl`**, trang chi tiết của một bản ghi (khách hàng, đơn, dự án) thì `text-lg` (`budgets.md`; `T9` chỉ cho nội dung lặp lại như bài viết, sản phẩm). Không `text-2xl`, `text-3xl`: đó là cỡ hero (`budgets.md`). `text-balance` để tên dài xuống dòng đều.
- **Khối chữ `min-w-0 flex-1`.** Thiếu `flex-1` thì khối co theo dòng dài nhất (thường là đường dẫn), mô tả bị ép xuống dòng ở nửa khung dù bên phải còn trống.
- **Tên trang `font-semibold`, không `tracking-tight`** ở cỡ `lg`/`xl`. Tên trang là chữ đậm nhất vùng nội dung; nhạt hơn tiêu đề khối bên dưới là đảo thứ bậc.
- **Mô tả `max-w-[55ch] text-pretty`**: đủ rộng để một câu ngắn nằm một dòng, câu dài vẫn dưới 75 ký tự mỗi dòng (`T11`). Bản cũ `max-w-2xl` ghi là dưới 75 nhưng ở `text-sm` thực tế ~99 ký tự.
- **Nút bên phải, bám mép trên** (`sm:items-start`), `shrink-0`. Tối đa một nút `primary` (hành động chính của trang, `I3`), còn lại nút viền có icon (`I1`). Từ nút thứ ba thì gom vào nút `MoreHorizontal`.
- **Màn hẹp**: nút xuống dưới chữ, căn trái, giữ trên một hàng, không để hai nút trên một nút dưới (`../responsive.md`).
- Không có mô tả, không có nút thì đầu trang chỉ còn tên, không chừa chỗ trống.

---

<!-- nguồn: references/layouts/app.md:890-951 -->
## Trang lỗi (404, 403, 500, bảo trì)

Rà lần đầu 26/09/2026 ở `/errors/states`. Bốn trang, **hai chỗ đặt** theo việc khung app còn
dựng được không:

| Trang | Đặt ở đâu | Việc chính (nút đặc) | Lối phụ |
| --- | --- | --- | --- |
| 404 trong app (đã đăng nhập) | **trong khung app**, sidebar và header giữ nguyên | Về trang tổng quan | Quay lại trang trước (chỉ khi có trang trước) |
| Bản ghi không tìm thấy (khách, đơn… id sai hoặc đã xoá) | trong khung app, cùng khối với 404 | Về danh sách của loại bản ghi đó ("Về danh sách khách hàng") | Quay lại trang trước (chỉ khi có trang trước) |
| 403 | trong khung app | Gửi yêu cầu cấp quyền | Về trang tổng quan; dòng cuối "Bạn đang đăng nhập bằng … · Đổi tài khoản" |
| 500 của một trang (khung vẫn chạy) | trong khung app | Tải lại trang | Về trang tổng quan; dòng cuối mã lỗi `font-mono` + nút sao chép |
| 404 khi chưa đăng nhập, 500 làm sập cả app, bảo trì | **đứng riêng**: cùng khối như trong khung, thêm logo căn giữa ở trên; **không card** | 404: về trang chủ / đăng nhập. 500: Tải lại trang. Bảo trì: không nút đặc, "Tải lại trang" là nút viền | — |

- **Người đã đăng nhập gặp lỗi thì vẫn ở trong app.** Bỏ khung app đi là bỏ luôn đường ra: muốn
  sang trang khác phải bấm đúng một nút trên card. Các hướng dẫn thiết kế trang 404 đều giữ
  thanh điều hướng của site, và router lồng nhau dựng trang not-found **bên trong** layout cha.
  Header ghi tên lỗi ("Không tìm thấy trang"), không ghi tên trang cũ, không đường dẫn.
- **Route bắt mọi đường dẫn trong khung app phải có trang.** `{ path: "*" }` không `element`
  thì khung dựng vùng nội dung trống, header vẫn ghi "Tổng quan": người dùng tưởng trang đang
  tải. Lưới router bắt ở cấp gốc chỉ phủ đường dẫn
  ngoài khung.
- **Khối trong khung: không card, căn giữa, chữ căn giữa** như khối lỗi tải
  (`../components/empty-state.md`): `mx-auto max-w-md pt-16 pb-16 text-center sm:pt-24`, nằm
  thẳng trên nền trang. Nút `h-11 md:h-10`, dưới `sm` rộng hết và xếp dọc (nút đặc trên), từ
  `sm` co theo chữ, đứng ngang, căn giữa, nút đặc trước. Thử 26/09/2026 ở 1280 và 375px.
- **Đứng riêng cũng là khối đó, không card.** Trang `min-h-screen bg-background px-4 pt-24
  sm:pt-40`, logo (`ProductBrand`) căn giữa ở trên, tiêu đề cách logo `mt-8`; chữ, nút, khoảng
  cách giống hệt bản trong khung. Trang lỗi không phải form: bản trước mượn card màn xác thực
  (nút `h-12` rộng hết card) thì trang 404 chỉ có một thanh đen 400px là thứ nặng nhất màn, và đặt
  cạnh bản trong khung thì một loại trang ra hai khuôn khác hẳn nhau (`N5`; đã dính 26/09/2026,
  lượt hai, chủ dự án thấy "xấu xấu"). Các bộ component trang 404 phổ biến cũng là trang trơn,
  không card. `M29` (một card giữa trang trống) chỉ còn cho màn xác thực và onboarding một khối.
- **404 có dòng mã "404" nhỏ mờ trên tiêu đề**: `text-sm font-medium text-muted tabular-nums`,
  tiêu đề `mt-1`. Các bộ component trang 404 phổ biến đều có dòng này; "404" là chữ người dùng
  nhận ra và gõ đi tìm. 403, 500, bảo trì không có (500 đã có mã lỗi riêng ở dòng cuối, hai mã
  là thừa).
- **Tiêu đề `text-xl font-semibold`** (`T2`), không `font-bold`. Không icon to, không hình minh
  hoạ, không đỏ: người dùng không có gì phải sửa (`M30`).
- **Câu dẫn nói vì sao và làm gì tiếp**, một hai câu. 404: "Đường dẫn có thể bị gõ sai, hoặc
  trang đã được chuyển sang chỗ khác." 403: nêu tên trang (`font-medium text-foreground`) và ai
  được vào. 500: "Lỗi nằm ở phía hệ thống, không phải do bạn." Bảo trì: giờ mở lại, viết theo
  kiểu câu văn (`T16b`: "lúc 23:30 hôm nay", không "23:30 · 26/09/2026").
- **403: xin quyền và tài khoản đang dùng.** Vào nhầm tài khoản là lý do hay gặp nhất, nên dòng
  cuối nói email đang đăng nhập và có link "Đổi tài khoản", như trang "cần quyền truy cập" của
  bộ văn phòng trực tuyến lớn. Email giữa câu thì dấu chấm đi theo `EmailText` `suffix`, và cả
  email là một khối: vừa một dòng thì xuống dòng nguyên cụm, không bẻ đôi sau `@`
  (`../components/description-list.md`). **"Đổi tài khoản" đứng một dòng riêng** dưới câu
  (`mx-auto mt-1 flex h-8 w-fit items-center px-1.5`), không nối sau email: nối sau thì dòng email + link rộng 448px, rộng
  nhất khối (câu dẫn 439px, tiêu đề 310px), chân nặng hơn đầu. Tách dòng thì chân còn ~270px.
- **403 đã gửi: đổi cả tiêu đề và câu dẫn, không nhét dòng chữ xanh vào chỗ nút.** Tiêu đề "Đã
  gửi yêu cầu", câu dẫn "Bạn sẽ nhận email khi **<tên>** chấp nhận yêu cầu.", hàng nút chỉ còn
  "Về trang tổng quan" (vẫn nút viền, giữ kiểu theo vai); dòng tài khoản giữ nguyên. Tiêu đề
  `tabIndex={-1}`, gửi xong chuyển tiêu điểm vào đó (`I31`). Bộ văn phòng trực tuyến lớn cũng
  đổi cả màn thành "Request sent" + câu hẹn email. Bản trước để ô nút ẩn giữ chỗ và dòng "✓ Đã gửi
  yêu cầu" nằm giữa ô đó: chữ ngắn hơn nút, cả hàng lệch tâm 16px sang phải, trông như thiếu một
  nút.
- **"Quay lại trang trước" chỉ khi có trang trước trong app.** Mở thẳng bằng link (tab mới) thì
  nút này đưa người dùng ra khỏi app hoặc không làm gì; ẩn đi. React Router: `location.key ===
  "default"` là trang đầu của phiên.

---
