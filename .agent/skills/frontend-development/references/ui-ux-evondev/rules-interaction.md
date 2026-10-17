# Luật trạng thái và tương tác (I)

> Trích nguyên văn từ evondevKit `skills/ui-ux` commit `dff15b4` (MIT). Project override trong `frontend-development/SKILL.md` (mục "UI reference") thắng nội dung dưới đây.

<!-- nguồn: references/rules-state.md:150-168 -->
**I9. Mọi phần tử bấm được phải CÓ hover, và hover đó phải nhìn thấy được.**

Hai vế, hay sót vế đầu. Đổi màu xong tự hỏi: chênh lệch này có nhận ra khi liếc
không.

⚠️ **Nút `primary` là chỗ bị quên nhiều nhất.** Nó đã nổi sẵn nên nhìn tĩnh thấy
ổn, và người dựng bỏ qua. Nhưng nút chính của cả màn mà rê vào không phản hồi gì
thì nó là thứ duy nhất trong trang trông như ảnh chụp. Luôn có
`hover:bg-primary-hover` — token đã có sẵn trong `tokens.css`, không phải tự chế
màu.

**Vế ngược: thứ không bấm được thì không có nền rê.** Nền rê là lời hứa "bấm vào đây";
dòng chỉ để đọc mà rê vào tô nền thì người dùng bấm thử, không ra gì. Dòng chứa một nút
(như "Điểm danh") vẫn không phải dòng bấm được: hover nằm ở nút. Hai cách: bỏ hover, hoặc
cho cả dòng là link tới chi tiết. Ngoại lệ duy nhất: rê vào dòng để hiện nút ẩn
(`components/list-row.md`), nền rê báo nút đã hiện. Đã dính 01/10/2026 (dashboard trung tâm
ngoại ngữ): bảy dòng "Lớp hôm nay" `hover:bg-background`, không link, con trỏ thường;
card bên cạnh thì dòng là link, nên hai danh sách trông giống nhau mà một bên bấm được.
Probe báo "Nền rê trên khối không bấm được".

<!-- nguồn: references/rules-state.md:223-236 -->
**I11. Hành động trên dòng: ít thì hiện thẳng, nhiều thì gom vào nút ba chấm.**

| Số hành động của một dòng | Cách hiện |
| --- | --- |
| **1–2**, không có hành động nguy hiểm | Icon button `h-8` nằm thẳng trong dòng, cột cuối căn phải. Danh sách thì mờ lúc thường, hiện khi rê vào dòng. **Bảng thì luôn hiện**, chữ `text-muted`: bảng dài người ta dò theo cột, nút lúc có lúc không làm cột cuối nhảy |
| **Từ 3 trở lên**, hoặc có xoá | **Một** nút `MoreHorizontal` luôn hiện ở cột cuối, bấm ra dropdown. Hành động hay dùng nhất (thường là sửa) được phép nằm ngoài thêm một nút, cạnh dấu ba chấm |

Trong dropdown: mục thường ở trên, **xoá tách xuống cuối** sau một đường chia,
hover đỏ `rose` (`I4`). Nút ba chấm có `aria-label="Thao tác"`, và **chặn nổi bọt**
(`event.stopPropagation()`) khi cả dòng cũng bấm được để mở chi tiết — không thì
bấm ba chấm là nhảy luôn sang trang chi tiết.

Thiết bị không có chuột thì không có hover: nút ẩn-hiện-khi-rê phải kèm
`[@media(hover:none)]:opacity-100`, không thì trên điện thoại không bao giờ thấy.

<!-- nguồn: references/rules-state.md:238-240 -->
**I12. Hover, focus, chọn thì chỉ đổi màu.** Ngoại lệ: card hover được
`transition-all`. Khối nổi **mở và đóng** (modal, dropdown, panel, toast) thì có chuyển
động vào ra riêng, số ở mục "Chuyển động" cuối `layouts/overlay.md`.

<!-- nguồn: references/rules-state.md:438-446 -->
**I19. Mọi trang có dữ liệu đều cần đủ ba trạng thái: đang tải, rỗng, lỗi.**

Khung chờ phải **đúng hình** của nội dung sẽ hiện ra, không phải một vòng xoay
giữa màn. Khung chờ sai hình thì trang nhảy một cái lúc dữ liệu về, và đó là thứ
người dùng cảm nhận được dù không gọi tên được.

Xem `components/empty-state.md`.

---

<!-- nguồn: references/rules-state.md:450-458 -->
**I20. Modal có ô nhập thì bấm ra ngoài KHÔNG được đóng.**

Popup nào chứa `input` / `textarea` / `select` / rich-text / upload ảnh thì
backdrop **không** mang handler đóng. Đang điền dở mà con chuột lỡ click một cái
ra ngoài là mất sạch — không có nháp, không undo. Đóng bằng nút ✕ / Huỷ / Esc,
tức là phải cố ý.

- `e.target === e.currentTarget` **không phải cách vá**: nó chỉ chặn click bị bubble từ bên trong, còn click thẳng vào backdrop — đúng cái tay lỡ bấm — vẫn đóng. Xoá cả prop `onClick` đi.
- Gỡ dismiss thì **phải chắc còn đường đóng khác**. Dính thật ở một dự án: hai bottom sheet lấy backdrop làm lối ra DUY NHẤT, gỡ xong là khoá luôn người dùng trong sheet.

<!-- nguồn: references/rules-state.md:460-462 -->
**I21. Vẫn giữ dismiss cho thứ chỉ để đọc hoặc chọn.** Lightbox ảnh, xem chi
tiết đơn, roster, dropdown, menu, panel thông báo, drawer mobile. Đóng nhầm mấy
cái đó không mất gì.

<!-- nguồn: references/rules-state.md:469-473 -->
**I23. Dựng modal mới thì dùng khung dùng chung, đừng tự dựng backdrop bằng
`position: fixed`.** Khung dùng chung cho sẵn khoá tiêu điểm, trả tiêu điểm về
nút đã mở, khoá cuộn nền, và aria đúng chuẩn — tự dựng thì mất hết.

---

<!-- nguồn: references/rules-state.md:488-499 -->
**I26. Nhãn phải gắn vào ô, có `cursor-pointer`, và chỉ rộng bằng chữ.**

Ba thứ đi liền nhau, thiếu một cái là lỗi:

```html
<label for="email" class="w-fit cursor-pointer text-sm font-medium">Email</label>
<input id="email" />
```

- **`for` / `htmlFor` khớp `id`** — bấm vào chữ là ô nhận tiêu điểm. Không có thì nhãn chỉ là chữ trang trí, và trình đọc màn hình cũng không biết ô này tên gì.
- **`cursor-pointer`** — nhãn bấm được mà con trỏ vẫn là que gõ chữ thì không ai biết để mà bấm.
- **`w-fit`** — chỗ sót nhiều nhất. `<label>` là block, không có `w-fit` thì nó chiếm trọn chiều ngang. Bấm vào khoảng trắng trống bên phải chữ, cách chữ 300px, ô vẫn sáng lên. Người dùng bấm hụt ra ngoài mà thấy ô phản hồi thì tưởng mình bấm trúng cái gì đó.

<!-- nguồn: references/rules-state.md:501-509 -->
**I27. Ô mật khẩu phải có nút hiện/ẩn.** Không có thì người dùng gõ sai một ký tự
là phải xoá hết gõ lại, và đó là lý do rời form phổ biến nhất ở màn đăng nhập.

- Nút **chỉ có icon**, `absolute` trong ô, căn phải. Icon `Eye` / `EyeOff` theo `F15`.
- **Nút `size-10`, `right-1` căn giữa dọc** (`inset-y-0 my-auto`, không `-translate-y-1/2`: `N11`), icon `size-4` giữa nút. Icon đứng đúng chỗ cũ, chỉ vùng bấm to ra; vừa khít `pr-11` (4 + 40 = 44px). Nút ôm sát icon (`p-1`, 24px) thì trên điện thoại bấm trượt vào ô, bàn phím bật lên thay vì hiện mật khẩu. Không vòng focus (`I13`).
- **`type="button"`.** Quên thì nó mặc định là `submit` — bấm xem mật khẩu hoá ra gửi form.
- `aria-label` đổi theo trạng thái: "Hiện mật khẩu" / "Ẩn mật khẩu". Không phải một nhãn cố định.
- Chừa chỗ cho nút bằng padding phải trên chính ô (`pr-11`), đừng để chữ gõ dài chui xuống dưới icon.
- Mặc định là **ẩn**. Mở sẵn thì mật khẩu phơi ra trước mặt người đứng sau lưng.

<!-- nguồn: references/rules-state.md:511-547 -->
**I28. KHÔNG tắt gợi ý điền sẵn của trình duyệt. Khai báo cho nó đúng.**

Cái khung đen Chrome bật lên khi chạm vào ô email là **trình quản lý mật khẩu**,
không phải lỗi giao diện. Người dùng bấm một cái là điền xong cả form. Tắt nó đi
là ép người ta gõ tay mật khẩu 20 ký tự, và đẩy họ sang chỗ đặt mật khẩu dễ nhớ.

`autocomplete="off"` ở form đăng nhập còn bị Chrome, Safari, Firefox **cố tình
bỏ qua** — tắt không được, chỉ làm hỏng phần gợi ý chứ không tắt hẳn.

Việc phải làm là ngược lại: khai báo đủ để nó đoán đúng.

| Ô | `autocomplete` |
| --- | --- |
| Email / tên đăng nhập | `username` (hoặc `email`) |
| Mật khẩu, màn **đăng nhập** | `current-password` |
| Mật khẩu, màn **đăng ký** hoặc đổi mật khẩu | `new-password` |
| Mã OTP | `one-time-code` |

Mỗi ô cũng phải có `name`. Thiếu `name` thì trình duyệt không có gì để lưu, và
lần sau không gợi ý được.

**Form đặt mật khẩu mới không có ô email** (bước cuối luồng quên mật khẩu, đổi mật khẩu
qua link) thì thêm một ô ẩn mang tên tài khoản, ngay đầu form:

```html
<input type="email" name="username" autocomplete="username" value="an@congty.vn" hidden readonly />
```

Không có ô này thì trình quản lý mật khẩu lưu mật khẩu mới mà không biết của tài khoản
nào, hoặc lưu thành một mục mới bên cạnh mục cũ. Lần đăng nhập sau nó vẫn gợi ý mật khẩu
cũ, người dùng tưởng đổi chưa được.

Khung gợi ý **che mất ô ngay dưới** — đó là hành vi bình thường của trình duyệt,
nó tự đóng khi gõ hoặc khi rời ô. Đừng đẩy khoảng cách các trường ra xa để
"tránh" nó.

---

<!-- nguồn: references/rules-state.md:551-602 -->
**I29. Nền hover, vùng bấm và `cursor-pointer` phải nằm trên CÙNG MỘT phần tử,
và phần tử đó rộng hết hàng.**

Lỗi hay gặp nhất ở menu, sidebar và danh sách bấm được. Nền hover nằm ở phần tử
bọc ngoài, rộng cả hàng, còn phần tử bấm được (`<a>`, `<button>`) lại là inline,
chỉ ôm vừa khít chữ.

Hệ quả: rê chuột ngang qua hàng thì con trỏ **nhấp nháy**, qua chữ là bàn tay, qua
khoảng trống là mũi tên. Nền vẫn sáng cả hàng, nên người dùng tưởng bấm đâu cũng
được. Bấm vào khoảng trống thì **không có gì xảy ra**, và họ nghĩ app bị đơ.

```html
<!-- Sai: hover ở <li>, vùng bấm chỉ bằng chữ -->
<li class="flex h-10 items-center rounded-xl px-3 hover:bg-item-hover">
  <a href="/ho-so">Hồ sơ của bạn</a>
</li>

<!-- Đúng: <li> trơn, mọi thứ dồn vào <a> -->
<li>
  <a href="/ho-so" class="flex h-10 w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 hover:bg-item-hover">
    <i data-lucide="user" class="size-4 text-muted"></i>
    Hồ sơ của bạn
  </a>
</li>
```

**React với shadcn / Radix: bẫy `asChild`.** Đây là chỗ dính nhiều nhất trong
dự án Next:

```tsx
// Sai: Item có hover và rộng cả hàng, nhưng điều hướng nằm ở <Link> inline bên trong.
// Bấm vào khoảng trống của hàng thì menu đóng lại mà không đi đâu cả.
<DropdownMenuItem>
  <Link href="/ho-so">Hồ sơ của bạn</Link>
</DropdownMenuItem>

// Đúng: asChild để <Link> TRỞ THÀNH chính Item, thừa hưởng hover lẫn vùng bấm
<DropdownMenuItem asChild>
  <Link href="/ho-so" className="flex w-full cursor-pointer items-center gap-2.5">
    Hồ sơ của bạn
  </Link>
</DropdownMenuItem>
```

**Cách kiểm, mất năm giây:** rê chuột từ mép trái sang mép phải của hàng, thật
chậm. Con trỏ phải là bàn tay **suốt từ đầu tới cuối**. Đổi dù một lần là lỗi.

Áp cho: mục menu, link sidebar, dòng danh sách bấm được, tab, và card mà cả khối
bấm được. Padding của hàng đặt trên **phần tử bấm**, không đặt trên phần tử bọc,
vì padding cũng là vùng bấm.

`cursor-pointer` phải ghi tường minh trên `<button>` ở Tailwind v4 — xem `W7`.

<!-- nguồn: references/rules-state.md:604-655 -->
**I30. Không dùng `<details>` / `<summary>` cho bất cứ thứ gì mở/đóng.** Dựng bằng
`<button aria-expanded>` + khối trượt `grid-rows`.

`<details>` mở và đóng tức thì, không trình duyệt nào animate sẵn: bấm là nội dung
giật ra, bấm lần nữa là biến mất, cả trang bên dưới nhảy theo (`N1`). Cách vá bằng
`::details-content` + `interpolate-size` chỉ chạy trên Chrome; Safari và Firefox vẫn
giật. Đã dính 26/09/2026: FAQ trang giá dựng bằng `<details>` theo đúng spec cũ của
skill, chủ dự án bấm thử thấy "giật ra chứ không có animation như accordion".

Áp cho mọi thứ mở/đóng: accordion, FAQ, nhóm sidebar thu gọn, mục cây, "xem chi
tiết" trong dòng, khối bước công cụ trong chat. Cùng lý do, **không render có điều
kiện** (`{isOpen && …}`) hay `hidden` cho phần nội dung đó: cũng giật y như vậy.

Mẫu đầy đủ cho accordion (padding, hover, khung, cách kiểm) ở `components/accordion.md`.
Công thức lõi, giống nhóm sidebar (`layouts/app.md`):

```tsx
<button type="button" aria-expanded={isOpen} aria-controls={panelId} onClick={() => setIsOpen(!isOpen)}>
  {label}
  <ChevronDown className={cn("size-4 shrink-0 transition-transform duration-200 motion-reduce:transition-none", isOpen && "rotate-180")} aria-hidden />
</button>

<div
  id={panelId}
  inert={!isOpen}
  className={cn(
    "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
    isOpen && "grid-rows-[1fr]",
    !isOpen && "grid-rows-[0fr]",
  )}
>
  <div className="min-h-0 overflow-hidden">…</div>
</div>
```

- **`duration-200 ease-out`**, chevron xoay cùng nhịp. Không đo chiều cao bằng JS.
- **Khối đóng gắn `inert`**: Tab không lọt vào nội dung đã ẩn, trình đọc màn hình không đọc.
- **Có `motion-reduce:transition-none`.**
- **Nút mở/đóng tràn hết bề ngang khung trắng (accordion, FAQ) thì không tô nền hover**,
  chevron đậm lên thay nền. Ngoại lệ của `I10`, lý do và các cách đã thử ở
  `components/accordion.md`.
- **Nút và nội dung giữ padding cố định, không đổi theo trạng thái.** Nút `py-*` như nhau
  lúc mở và đóng; nội dung cùng `px` với nút, chỉ `pb`, nối tiếp padding dưới của nút.
  Không bớt `pb` của nút khi mở, không margin âm (`N11`): tô nền nút là chữ lệch hẳn về
  một mép.
- Đổi lại mất Ctrl+F tự mở khối chứa chữ (chỉ `<details>` có). Chấp nhận, như
  accordion của mọi thư viện component.

Grep một lượt khi dựng xong: `<details` và `<summary` phải ra 0.


---

<!-- nguồn: references/rules-state.md:659-674 -->
**I31. Bấm một nút làm chính dòng của nó biến mất thì tự chuyển focus.** Gỡ dòng
(đăng xuất thiết bị, xoá dòng không qua hộp xác nhận, thu hồi lời mời) làm nút đang có
focus rời DOM, và focus rơi về `<body>`: trình đọc màn hình đọc lại từ đầu trang, người
dùng bàn phím mất chỗ.

- Còn dòng sau: focus vào nút cùng loại ở dòng sau. Hết dòng sau thì dòng trước.
- Hết dòng có nút (hoặc gỡ hàng loạt): focus lên tiêu đề của khối (`tabIndex={-1}`,
  `outline-hidden`), hay ô trống / nút chính của trạng thái rỗng.
- Gỡ qua hộp xác nhận: hộp đóng thì trả focus theo đúng luật trên, không trả về nút mở
  hộp vì nút đó có thể đã mất (vd nút "Đăng xuất 4 thiết bị khác" ẩn khi không còn thiết
  bị khác).
- Đổi focus sau khi React đã gỡ dòng: `flushSync` rồi `focus()`, hoặc giữ id đích trong
  ref và focus trong `useEffect` khi danh sách đổi.

Đã dính 26/09/2026 ở trang bảo mật: đăng xuất một thiết bị và đăng xuất hàng loạt, cả
hai lần `document.activeElement` là `<body>`.
