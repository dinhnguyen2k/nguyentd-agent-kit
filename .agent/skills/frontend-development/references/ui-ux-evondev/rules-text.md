# Luật chữ, số, copy (T)

> Trích nguyên văn từ evondevKit `skills/ui-ux` commit `dff15b4` (MIT). Cogain override trong `frontend-development/SKILL.md` (mục "UI reference") thắng nội dung dưới đây.

<!-- nguồn: references/rules-type.md:9-14 -->
**T1. `antialiased` trên `body`.** Một dòng, đặt một lần, và nó đổi cảm giác của
cả trang: chữ mảnh hơn, sạch hơn, bớt cái vẻ nặng nề của font render mặc định.

```html
<body class="antialiased">
```

<!-- nguồn: references/rules-type.md:61-69 -->
**T8. Tiêu đề của một khối phải lớn hơn chữ lớn nhất bên trong khối, ít nhất một bậc.**

Tiêu đề card `text-base font-semibold` thì mục bên trong tối đa `text-sm`. Bằng
nhau là mắt không đọc ra đâu là nhãn của khối, đâu là nội dung, và cả khối trông
phẳng lì.

Cùng nguyên tắc cho độ đậm: tiêu đề khối `600`, mục bên trong tối đa `500`.

Thứ bậc đầy đủ của một trang app: **tên trang > tiêu đề khối > tên thẻ**.

<!-- nguồn: references/rules-type.md:112-129 -->
**T11. Không để dòng chữ dài quá 75 ký tự.** Mọi khối văn bản có `max-width`.

**Chặn ở khung ngoài, không chặn ở phần tử con nằm trong một khối tràn bề ngang.**
Câu trả lời accordion, dòng mô tả trong hàng có nền: `max-w-*` đặt trên chính nó thì
khối con hụt so với khối bọc, ai tô nền là lòi một mảng trống bên phải. Thu hẹp cả khung cho tới khi
dòng dài nhất ≤ 75 ký tự.

**Trần 75 ký tự là cho đoạn văn từ 3 dòng trở lên.** Chữ ngắn đọc một hơi (câu trả lời
FAQ 1–2 câu, mô tả một dòng) không tính: đừng thu hẹp cả khung vì nó, kẻo tiêu đề cùng
khung phải xuống dòng khi hàng còn trống.
Card rộng hết khung cũng tính.

**Chữ Việt: `max-w-[55ch]` ≈ 75 ký tự**, ở mọi cỡ chữ. `ch` là bề rộng số "0" (~9,5px ở
14px), còn ký tự Việt trung bình chỉ ~6,8px, nên `max-w-prose` (65ch) chứa ~90 ký tự và
`max-w-2xl` ở `text-sm` chứa ~99. Dùng `ch` chứ không dùng `max-w-lg`: nó co giãn theo cỡ
chữ, và không dính bẫy thang `--container-*` bị ghi đè (`tailwind-v4-traps.md`). Đã dính:
mô tả việc trong dòng thời gian chạy ~90 ký tự một dòng dù đã `max-w-prose`.

<!-- nguồn: references/rules-type.md:131-133 -->
**T12. Chữ dài luôn căn trái.** Không căn giữa mọi thứ.

---

<!-- nguồn: references/rules-type.md:137-143 -->
**T13. `min-w-0` cho mọi flex và grid item chứa nội dung động.**

Flex item và grid item mặc định có `min-width: auto`, tức **không chịu co nhỏ hơn
nội dung của nó**. Một con số `1.284.500`, một cái tên dài là đủ để cột nở ra,
lưới nở theo, cả trang tràn ngang.

Đây là **nguyên nhân số một của lỗi cuộn ngang**, và chỉ lộ ra ở màn hẹp.

<!-- nguồn: references/rules-type.md:145-168 -->
**T14. Tiêu đề một dòng thì cắt, câu giải thích thì xuống dòng.**

Chữ trong danh sách dày (dòng bảng, sidebar) dùng `truncate` kèm `min-w-0`. Tên mục trong
card lưới thì `line-clamp-2`, không cắt một dòng (`N12`). Nhưng dòng mô tả thì cho
xuống dòng, đừng cắt — mô tả bị cắt thì mất luôn lý do nó tồn tại.

**Tên file cắt giữa, giữ đuôi**: "Bao-cao-doanh…thu-quy-3.xlsx", vì đuôi file nói loại
file. **Phần giữ lại là vài ký tự cuối của tên (khoảng 8) cộng đuôi**, không chỉ mỗi đuôi:
cắt sát dấu chấm thì `…` dính `.xlsx` thành bốn chấm "doanh-thu….xlsx", đọc như lỗi
gõ, và mất luôn phần cuối tên, thường là chỗ phân biệt các bản
("…quy-3", "…ban-cuoi"). Trình quản lý tệp của hệ điều hành cắt kiểu này. Dấu `…` **dính liền** phần giữ lại, không chừa khoảng trắng trước đuôi.

**Dòng ghép nhiều mẩu thì thứ để so sánh đứng trước chữ có thể dài.** "Loại · diện tích"
mà loại là chữ người đăng tự gõ thì loại dài đẩy diện tích ra sau dấu `…`, mất đúng con số
người dùng dùng để chọn. Đặt mẩu ngắn, cố định lên trước ("210m² · Duplex…"), hoặc tách
span: mẩu cần giữ `shrink-0`, chỉ mẩu dài `truncate`.

**Chỉ hiện đủ tên khi tên thật sự bị cắt.** So chiều rộng thật rồi mới gắn `title` hay tooltip. **Đo bằng `Range`, không bằng `scrollWidth > clientWidth`**: hai số đó làm tròn về số nguyên, chữ rộng 182,4px trong khung 182px thì cả hai đều ra 182, trình duyệt vẫn cắt "quý" thành "q…" mà phép so báo không cắt. Cách đo: `range.selectNodeContents(el)`, so `range.getBoundingClientRect().width > el.getBoundingClientRect().width`;
gắn sẵn cho mọi hàng thì hàng ngắn cũng bật bong bóng, thành nhiễu. Bong bóng đó
cũng không được che hàng kế bên (`N8`).

<!-- nguồn: references/rules-type.md:185-197 -->
**T16. Số xếp cột dùng `tabular-nums`.** Bảng số liệu, cột tiền, cột phần trăm —
thiếu nó thì các chữ số rộng khác nhau và cột nhảy lung tung khi dữ liệu đổi.
Giờ, ngày xếp dọc một mép (cột giờ bên phải dòng thời gian, lịch sử) cũng là cột số.
**Font phải có `tnum` thì class mới có tác dụng.** Kiểm bằng cách đo "1" và "4": rộng khác
nhau là font không áp.
Cột căn phải lệch mép trái vài px thì chấp nhận; bảng tiền, bảng số thì báo người dùng
một dòng lúc giao, đổi font là việc của họ (`N10`).
**Số tiền kèm đơn vị là một khối không ngắt**: `whitespace-nowrap` trên cả "128.900.000 đ".
Hàng nhãn–giá trị hai đầu (`flex justify-between`, như khối Thanh toán) thì giá trị tiền
`shrink-0`, nhãn `min-w-0` co lại và xuống dòng; nhãn có phần phụ thì dán `&nbsp;` để ngắt sau
dấu `·` ("Tạm tính&nbsp;· 1&nbsp;sản&nbsp;phẩm" ra "Tạm tính ·" / "1 sản phẩm"). Đảo lại (nhãn
`shrink-0`, giá trị `wrap-anywhere`) thì ở 375px chữ "đ" rớt xuống dòng riêng; chỉ thêm
`nowrap` mà nhãn vẫn không co thì "đ" tràn ra ngoài khung.

<!-- nguồn: references/rules-type.md:199-215 -->
**T16b. Thời gian tương đối luôn kèm giờ tuyệt đối.** "5 giờ trước", "28 phút trước"
dễ đọc nhưng không dùng để đối chiếu được. Bọc trong `<time datetime>` và cho `title`
là giờ đầy đủ ("14:32 · 22/09/2026"), để rê chuột là biết chính xác. Nhật ký hệ thống,
dòng thời gian đơn hàng, nhật ký thao tác thì hiện thẳng giờ tuyệt đối, không tương đối:
ở đó người ta đang đối chiếu mốc thời gian chứ không lướt.

**Trong danh sách, mốc thuộc năm hiện tại thì bỏ năm**: `08:30 · 16/09`, không
`08:30 · 16/09/2026`. Mười hàng cùng đuôi `/2026` là một ý nhắc mười lần, và cột giờ rộng
thêm gần một nửa.
Khác năm thì ghi đủ `16/09/2025`; `title` và `datetime` luôn đủ. Copy tiếng Anh
thì tháng viết chữ (`T28`). **Bẫy:** `Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' })` bỏ năm thì ra `23-09` gạch ngang, không phải `23/09`; tự ghép ngày và tháng bằng `/`. Bỏ năm với
mốc trong năm nay là cách của các thành phần hiển thị thời gian phổ biến ("Sat, 31 Dec" nhưng "Wed, 26 Aug 2021", tra 27/09/2026). Một mốc đứng riêng làm trường dữ liệu ("Ngày tạo" trong khối nhãn và giá trị) thì giữ đủ năm.

**Mốc nằm giữa câu văn thì viết như câu nói, không dùng dấu `·`.** `08:30 · 16/09` là kiểu của
cột và dòng phụ; giữa câu nó đọc thành hai mẩu rời: "Dự kiến mở lại lúc 23:30 · 26/09/2026."
. Viết "lúc 23:30 hôm nay", "lúc 23:30 ngày mai", "lúc 08:00
ngày 28/09"; năm chỉ khi khác năm nay. Vẫn bọc `<time datetime>` đủ mốc.

<!-- nguồn: references/rules-type.md:217-221 -->
**T17. Mã và định danh dùng `font-mono`.** Mã đơn hàng, mã vận đơn, mã giảm giá, ID,
kể cả khi nằm giữa một câu mô tả. Nó nói
"đây là thứ để copy chính xác", không phải chữ để đọc.

---

<!-- nguồn: references/rules-type.md:225-230 -->
**T18. Không dấu gạch dài trong câu văn, ở mọi thứ tiếng.** Lộ ngay là AI viết (`T28`).

Luật này nói về **câu văn**. Ô không có giá trị trong bảng hay khối nhãn và giá
trị thì hiện `—` màu `text-muted`: đó là ký hiệu "trống", không phải dấu câu, và
dùng một ký hiệu cho mọi ô trống của app.

<!-- nguồn: references/rules-type.md:232-232 -->
**T19. Không emoji trong tiêu đề, câu chào, hay làm icon.** Icon theo `F15`.

<!-- nguồn: references/rules-type.md:234-236 -->
**T20. Không chữ hướng dẫn thừa.** Nút đã ghi "Lưu" thì đừng thêm dòng "Bấm để
lưu". Không viết chữ lặp lại thứ icon đã nói: có dấu tick rồi thì bỏ chữ "Có"
bên cạnh.

<!-- nguồn: references/rules-type.md:238-238 -->
**T21. Không badge kiểu "✨ AI-powered", "🚀 Fast", "New!".**

<!-- nguồn: references/rules-type.md:240-241 -->
**T22. Dòng phụ dưới nút phải mang thông tin riêng của từng mục.** Ba dòng giống
hệt nhau thì bỏ cả ba.

<!-- nguồn: references/rules-type.md:243-246 -->
**T23. Nhãn : giá trị thì nhãn xám, giá trị đậm, cùng một dòng.** "Ngày đặt:
Thứ tư 14/09". Đừng xuống dòng, đừng cho nhãn cùng màu với giá trị.

---

<!-- nguồn: references/rules-type.md:367-375 -->
**T30. Câu văn chạy nhiều dòng dùng `text-sm/6`, chữ một dòng trong control giữ dòng mặc định.**

Đoạn có thể chạy từ hai dòng trở lên (mô tả dưới tiêu đề modal, thân hộp xác nhận,
câu mô tả của banner, câu trên trang rỗng có mô tả) dùng `text-sm/6` (14px, dòng 24px).
Chữ tiếng Việt có dấu chồng hai tầng (`ệ`, `ở`, `ữ`): dòng 20px mặc định của `text-sm`
làm dấu dòng dưới chạm sát chân chữ dòng trên, đoạn đọc ra đặc. Chữ một dòng trong nút, ô nhập, dòng bảng, mục menu, badge giữ dòng
mặc định: ở đó chiều cao do control quyết, tăng dòng là nút phình. Khoảng giữa tiêu đề
và đoạn mô tả ngay dưới là `mt-2` (8px), không `mt-1`.
