# Responsive (R) và bẫy Tailwind v4 (W) đã chọn

> Trích nguyên văn từ evondevKit `skills/ui-ux` commit `dff15b4` (MIT). Project override trong `frontend-development/SKILL.md` (mục "UI reference") thắng nội dung dưới đây.

<!-- nguồn: references/responsive.md:16-20 -->
**R3. Không để phần tử rớt hàng lẻ.** Wrap mà còn dư một cái đứng một mình ở hàng dưới thì đọc ra là lỗi, không phải là thiết kế.

- **Cụm nút thì không bao giờ rớt hàng.** Tìm cách giữ trên một hàng: rút chữ, giảm `px`, hạ chiều cao. Không được nữa thì cho cả cụm xuống một cột, mỗi nút một hàng đầy đủ, chứ đừng để hai nút trên một nút dưới.
- **Lưới có số cột lẻ thì đi thẳng từ 1 lên số cột đó**, bỏ qua bậc giữa: `grid-cols-1 lg:grid-cols-3`, đừng chèn `sm:grid-cols-2` vì 3 mục chia 2 cột sẽ thành 2 trên 1 dưới.
- **Số cột chẵn thì wrap thoải mái**, 4 mục chia 2 cột ra 2 hàng đều nhau, không ai lẻ loi.

<!-- nguồn: references/responsive.md:34-60 -->
**R6. Ngoại lệ của R1 và R2: thứ tự tuyến tính thì không được wrap.** Board trạng thái, các bước quy trình, dòng thời gian, hàng chip lọc, hàng tab đều thuộc loại này. Xếp thành hai hàng thì mắt đọc theo hình chữ Z và mất dòng chảy; bốn chip ở 375px thì ba cái một hàng và một cái rớt xuống đứng lẻ, nhìn như lỗi. Cho cuộn ngang trong khung, mỗi phần tử `shrink-0`, cột kanban `w-[248px] grow max-w-[320px]` (vì sao thì xem `layouts/app.md`).

**Chip đang lọc (bấm để gỡ) không phải thứ tự tuyến tính**, nên không thuộc R6: từ `sm` trở lên cho `flex-wrap`, đặt thành một hàng riêng dưới thanh lọc, "Xoá lọc" nằm cuối và luôn thấy. Dưới `sm` mới cuộn ngang, và "Xoá lọc" đứng **ngoài** khung cuộn (`shrink-0`), không nằm cuối hàng cuộn. Nằm trong khung cuộn thì nhiều chip là "Xoá lọc" khuất theo, đúng nút cần nhất lại không thấy.

**Lề của vùng cuộn đặt trên hàng bên trong, không đặt trên khung cuộn.** Padding bên phải của khung `overflow-x-auto` bị nhiều trình duyệt bỏ qua khi cuộn tới cuối, nên phần tử cuối dính sát mép trong khi phần tử đầu vẫn có lề.

```html
<!-- Sai: cột cuối dính mép -->
<div class="overflow-x-auto px-3"><div class="flex gap-4">...</div></div>

<!-- Đúng: khối cha chỉ padding dọc, các khối khác tự mang lề, khung cuộn chạm mép -->
<section class="py-3 sm:py-5">
  <h2 class="px-3 sm:px-5">…</h2>
  <div class="overflow-x-auto"><div class="flex gap-4 px-3 sm:px-5">...</div></div>
</section>
```

Không kéo khung cuộn ra bằng `-mx-3 sm:-mx-5` bù padding của cha (`N11`): đổi padding cha mà
quên số âm là khung cuộn hụt hoặc lòi. Đo 27/09/2026 board kanban `/dashboard/tasks` 375 và
1280px, cuộn ở đầu và ở cuối: hai bản trùng từng pixel. Nhiều khối liền nhau không cuộn thì
gom vào một `<div class="px-3 sm:px-5">`. Khối nằm giữa khung trang và khung cuộn mà có `max-w-*` thì
nới `max-w` thêm đúng phần lấn ra hai bên, không thì các khối anh em hẹp lại (đo 27/09/2026, cột
`max-w-2xl` ở khu cài đặt: công tắc dịch 16px khi quên nới).

Cách khác cũng được: chèn phần tử đệm cuối hàng, `<div class="w-3 shrink-0 sm:w-5" aria-hidden="true"></div>`.

---

<!-- nguồn: references/responsive.md:64-74 -->
**R8. Chữ GÕ ĐƯỢC không bao giờ xuống dưới 16px ở mobile.** `input`, `textarea`,
`select` — dưới 16px thì iOS **tự phóng to cả trang** khi chạm vào ô, và không
tự thu lại. Người dùng đang điền form bỗng thấy trang nhảy một cái rồi lệch hẳn.

```html
<input class="text-base md:text-sm" />
```

Đây là **ngoại lệ của `R7`**: chữ chỉ để đọc trong card thì hạ về `text-sm` ở
mobile, chữ gõ được thì không. Luật này nói **cỡ chữ**, không nói chiều cao: ô
vẫn `h-11 md:h-10`, xem `budgets.md`.

<!-- nguồn: references/responsive.md:76-98 -->
**R9. Bảng ở màn hẹp thì cuộn ngang, đừng bóp cột.** Đây là lỗi hay gặp nhất với bảng: để nguyên `<table>` co lại theo bề rộng màn, kết quả là mỗi ô chỉ còn vài chục pixel, chữ vỡ ba bốn dòng, cột nọ dính cột kia, đọc không ra gì.

```html
<!-- Khung trang py-4 sm:py-6, các khối khác px-4 sm:px-6 (R6); khung cuộn không padding cha để kéo ra -->
<div class="overflow-x-auto">
  <div class="min-w-[44rem] px-4 sm:px-6">
    <table class="w-full">…</table>
  </div>
</div>
```

- **`min-w`** cho khối bọc bảng, đủ để mọi cột thở. Không có nó thì bảng vẫn co.
- **`whitespace-nowrap`** cho ô ngày tháng, số, trạng thái, **tên người**. Tên người xuống dòng thì cột co còn một chữ ("Nguyễn / Anh / Tuấn"), cắt đuôi thì mất tên gọi (`layouts/app.md`, bảng nhóm theo trạng thái). Chỉ mô tả, tiêu đề dài mới cho xuống dòng.
- Lề đặt trên **khối bên trong**, không đặt trên khung cuộn. Xem R6.
- Cuộn ngang thì **bắt buộc** ghim cột nhận diện (thường là cột đầu) bằng `sticky left-0` kèm nền `--surface`, cột ghim không quá ~40% khung. Cột đầu rộng hơn thế (tên + email) thì đừng cuộn: **dưới `sm`, bảng quản lý thành danh sách dòng** (`layouts/app.md`, mục Bảng dữ liệu). Cuộn mà không ghim thì cuộn một nhịp là mất tên, các ô còn lại không biết của ai.

Đây là ngoại lệ hợp lệ của R1, cùng loại với R6: cuộn trong khung chứ không phải cả trang.

**Ở desktop, phải cuộn ngang là dấu hiệu thừa cột, không phải lỗi bề ngang.** Thử theo
thứ tự: gộp cột (email xuống dưới tên trong cùng một ô), bỏ cột phụ, hoặc đẩy nó sang
drawer chi tiết. Đếm cột trước khi dựng: bảng trong khung app còn ~970px ở 1280px khi
sidebar mở, quá 6 cột là bắt đầu chật.

<!-- nguồn: references/responsive.md:166-174 -->
**R11. Màn hẹp được ẩn cột phụ, không được mất hành động chính của dòng.** Ẩn badge, ẩn nút trên
dòng (`hidden sm:inline-flex`) và ẩn panel chi tiết (`hidden lg:block`) cùng lúc thì ở 375px bấm
dòng không ra gì, việc chính của màn không làm được trên điện thoại. Mỗi thứ ẩn đi phải có lối
khác: bấm dòng mở panel thành trang hay sheet từ dưới, nút chính vào menu ⋯ của dòng, hay nút
thu còn icon. Đã dính 30/09/2026, wireframe hàng chờ lịch hẹn: nút "Đã đến" ẩn dưới `sm`, panel
ẩn dưới `lg`, lễ tân cầm điện thoại không tiếp đón được ai, trong khi khung lý do ghi "đọc tốt
trên điện thoại".

---

<!-- nguồn: references/tailwind-v4-traps.md:50-74 -->
## W3. Biến CSS cũ trùng namespace Tailwind = utility hỏng câm

Nối tiếp `W2`, nhưng nguy hiểm hơn vì **không hề báo lỗi**.

Ở một dự án thật, file token cũ có:

```css
:root { --container-md: 720px; --container-lg: 1040px; --container-xl: 1200px; }
```

`--container-*` đúng là namespace Tailwind v4 dùng cho thang `max-w-*`. Token cũ
nạp trong `layer(base)`, `@theme` phát vào layer `theme` — **base thắng theme**.
Kết quả: **mọi `max-w-md/lg/xl` trong cả dự án chạy sai giá trị**, không ai biết:

| Class | Đáng ra | Thực tế |
| --- | ---: | ---: |
| `max-w-md` | 448px | 720px |
| `max-w-lg` | 512px | 1040px |
| `max-w-xl` | 576px | **1200px** |

Chỉ lộ ra khi chủ dự án nhìn ảnh chụp và hỏi *"sao ô nhập không ngắn lại?"* —
code có `max-w-xl`, DOM có `max-w-xl`, mà ô vẫn full width.

Kết cục: xoá luôn 3 token + 3 class đi kèm, vì grep ra **0 chỗ dùng** trong toàn
bộ dự án. **Code chết mà vẫn kịp phá cả thang `max-w-*`.**

<!-- nguồn: references/tailwind-v4-traps.md:102-109 -->
## W4. Thiếu class màu viền thì Tailwind v4 để `border-color: currentColor`

Nút chữ đen mà quên khai màu viền sẽ ra **viền gần đen**, không phải viền nhạt.

Thấy một cái viền đậm bất thường thì kiểm chỗ này trước, đừng đi sửa mã hex của
token viền.

---

<!-- nguồn: references/tailwind-v4-traps.md:125-137 -->
## W6. iOS Safari tự phóng to ô nhập có `font-size` dưới 16px

Và **không bao giờ thu lại**. Ép 16px ở màn hẹp để chặn:

```css
@media (max-width: 768px) {
  input, textarea, select { font-size: 16px !important; }
}
```

`!important` ở đây là cần thật: nó phải thắng được cả `style={{ fontSize }}` inline
rải trong các composer và trình soạn thảo. Đây là một trong số rất ít chỗ
`!important` có lý do chính đáng — và lý do đó phải được ghi ngay trên nó.

<!-- nguồn: references/tailwind-v4-traps.md:139-174 -->
## W7. Tailwind v4 cho `<button>` con trỏ mũi tên, không phải bàn tay

v3 để `<button>` hiện bàn tay. **v4 đổi preflight về `cursor: default`**, theo
đúng hành vi gốc của trình duyệt. `<a href>` thì vẫn là bàn tay.

Nên trong **cùng một menu**, mục là `<a>` hiện bàn tay còn mục là `<button>`
(ví dụ "Đăng xuất") hiện mũi tên. Người dùng rê chuột dọc menu thấy con trỏ đổi
qua đổi lại, trong khi code trông không sai chỗ nào.

Hai cách, chọn một cho cả dự án:

```css
/* Cách 1: trả lại hành vi v3 cho toàn app — một chỗ, không sót */
@layer base {
  button:not(:disabled),
  [role="button"]:not([aria-disabled="true"]) {
    cursor: pointer;
  }
}
```

```html
<!-- Cách 2: ghi tường minh trên từng nút -->
<button class="cursor-pointer">…</button>
```

**Cách 1 an toàn hơn khi refactor**, vì không phải đi sót từng nút. Cách 2 hợp
khi dự án đã quen ghi `cursor-pointer` khắp nơi. Đừng trộn hai cách: nửa dự án dựa
vào base, nửa ghi tay, thì lúc bỏ một trong hai sẽ không biết chỗ nào còn phụ
thuộc.

**Cách phát hiện:** trong `package.json` có `"tailwindcss": "^4`, và grep ra
`<button` không kèm `cursor-pointer` mà trong CSS base cũng không có dòng
`cursor: pointer` nào.

---

<!-- nguồn: references/tailwind-v4-traps.md:176-183 -->
## W8. `ring-*` chỉ có một lớp bóng

`ring-1`, `ring-2`, `ring-inset` cùng ghi vào **một** lớp bóng (`--tw-ring-shadow`). Skill
không vẽ vòng focus (`I13`) nên thường không đụng nhau. Dự án trả vòng focus lại (`I14`) thì
viền trạng thái (đang chọn, đang bật) vẽ bằng `inset-ring-*` (lớp bóng riêng của v4) hoặc
`border`, không `ring-*`; `ring-*` để dành cho vòng focus của `I14`. Viền chọn bằng `ring-*` thì
Tab tới là vòng focus **thay** viền chọn, không cộng vào.

<!-- nguồn: references/tailwind-v4-traps.md:216-227 -->
## W10. `scale-*`, `translate-*`, `rotate-*` không chạy theo `transition-[transform]` ⚑

Tailwind v4 ghi `scale-95`, `-translate-y-1`, `rotate-180` vào thuộc tính CSS **riêng**
`scale`, `translate`, `rotate`, không vào `transform`. Viết `transition-[opacity,transform]`
hay `transition-[transform,color]` thì ba thuộc tính đó **nhảy thẳng**, chỉ `opacity` và màu
chạy: menu co lại 95% và nhích lên 4px ngay khung đầu rồi mới mờ, nhìn như giật; mũi tên
accordion lật ngược tức thì.

- Dùng `transition-transform` (v4 gồm `transform, translate, scale, rotate`), hoặc ghi đúng tên:
  `transition-[opacity,scale,translate]`, `transition-[rotate,color]`.
- Probe báo mục "Scale / translate / rotate không chạy chuyển động" (hạng Hỏng).

<!-- nguồn: references/tailwind-v4-traps.md:230-241 -->
## W11. `not-sr-only` trả `white-space` về `normal`, nuốt `whitespace-nowrap` cùng thẻ

`not-sr-only` không chỉ gỡ `sr-only`: nó ghi lại `position`, `width`, `height`, `padding`,
`margin`, `overflow`, `clip-path` **và `white-space: normal`**. Viết
`sr-only whitespace-nowrap @4xl:not-sr-only` thì từ `@4xl` utility có variant đứng sau trong
CSS, `normal` thắng, chữ lại xuống dòng. Đặt `nowrap` ở ô cha cũng vô ích: thẻ con đã khai
`normal` thì không kế thừa nữa.

- Ẩn theo chiều ngược lại: `whitespace-nowrap @max-4xl:sr-only` (bề rộng nào không ẩn thì không
  cần `not-sr-only`). Cùng lý do, padding / margin khai trên thẻ đó cũng bị `not-sr-only` xoá.
- Probe báo mục "Cột chữ của bảng bị ép xuống dòng".

