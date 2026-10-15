# Bố cục form: nhiều trường, nhiều bước, lỗi, giới hạn ký tự

> Trích nguyên văn từ evondevKit `skills/ui-ux` commit `dff15b4` (MIT). Cogain override trong `frontend-development/SKILL.md` (mục "UI reference") thắng nội dung dưới đây.

<!-- nguồn: references/layouts/form.md:268-343 -->
## Form nhiều trường

**A. Một cột dọc** (mặc định, dưới 8 trường)

Nhãn nằm trên ô nhập, không nằm cạnh. Trường liên quan nhau thì gom nhóm, cách
nhóm khác bằng khoảng trắng lớn hơn, không bằng đường kẻ.

**B. Chia mục có tiêu đề** (từ 8 trường trở lên)

```
Thông tin cá nhân
[ô] [ô]
[ô           ]

Địa chỉ
[ô           ]
[ô] [ô] [ô]

              [Huỷ] [LƯU]
```

Nút hành động nằm cuối, căn phải, primary bên phải cùng.

**Ô tuỳ chọn ít người đụng tới** (mã, tuỳ chọn kỹ thuật, đều có mặc định): gom vào một
khu thu gọn "Cài đặt nâng cao" ở cuối các ô, dựng là dòng chữ có chevron, không khung, ô
bên trong thẳng cột với ô ngoài. Mẫu ở "Khu thu gọn trong form" trong
`../components/accordion.md`.

**C. Nhiều bước** (khi **các bước phụ thuộc nhau** hoặc là luồng làm một lần: onboarding, thanh toán, đăng ký hồ sơ. Form dài mà các phần độc lập thì dùng kiểu B có mục, như trang cài đặt — số trường nhiều không phải lý do chia bước)

Thanh bước ở trên, mỗi bước một màn, nút "Quay lại" và "Tiếp" ở đáy. Không dùng
nhiều bước cho form ngắn, nó chỉ làm chậm.

**Thanh các bước:**

```
(✓)━━━━━━━━━━━━━━━━(2)─────────────────(3)
Thông tin công ty   **Người liên hệ**   Xác nhận
```

| Trạng thái | Vòng `size-8 rounded-full` | Nhãn | Đường nối phía sau |
| --- | --- | --- | --- |
| Đã xong | nền `primary`, icon `check` `size-4` `primary-foreground` | `text-foreground` | `h-0.5 bg-primary` |
| Đang làm | `border-2 border-foreground bg-surface`, số `font-semibold` | `font-semibold text-foreground` | `h-0.5 bg-secondary` |
| Chưa tới | nền `bg-secondary`, số `text-muted` | `text-muted` | `h-0.5 bg-secondary` |
| Có lỗi | nền `bg-red-600`, chữ `!` `text-sm font-bold text-white` (ký tự, không icon) | `text-red-700`, câu lỗi `text-sm text-red-600` dưới nhãn | như trạng thái của nó |

- **Phần "chưa tới" dùng `--secondary`, không `--background`, không `--border`.** Thanh các bước thường đứng trên nền trang, ngoài card. Vòng `bg-background` trùng đúng màu nền trang nên tan mất, chỉ còn con số "3" lơ lửng cuối đường nối; `--border` (#f7f7f8) còn **sáng hơn** nền trang (#f4f4f6), đường nối và đoạn thanh mảnh chưa tới gần như vô hình. `--secondary` (#e7e8ec) đọc được cả trên nền trang lẫn trên card trắng.
- **Vòng lỗi là vòng đặc đỏ với dấu `!`, không phải vòng viền đỏ bọc icon `circle-alert`.** Icon đó tự có một vòng tròn, đặt vào vòng viền thành hai vòng lồng nhau, nhìn rối và nhỏ xíu. Vòng đặc cùng khuôn với bước đã xong (đặc + ký hiệu), chỉ đổi màu và ký hiệu.
- Dựng bằng `<ol>`, bước đang làm có `aria-current="step"`. Các bước `flex-1`, **riêng bước cuối `flex-none`** (không đường nối, không `pr`): hàng trải đúng từ mép trái tới mép phải của card bên dưới. Để bước cuối `flex-1` thì cột cuối chỉ có vòng và một chữ ngắn, hở một mảng bên phải, cả thanh lệch trái so với card.
- **Thanh ngang chỉ có nhãn, không mô tả dưới nhãn**, khi mỗi bước đã có tiêu đề và câu dẫn trong card (mặc định, xem "Khung một bước" dưới). Mô tả ở thanh cộng câu dẫn trong card là hai câu cho một ý, cách nhau 100px (`N3`). Đã dính 26/09/2026: thanh ghi "Có thể để trống, mời sau", câu dẫn ghi "Chưa cần thì để trống, mời sau ở trang Thành viên", nhãn ô ghi "Không bắt buộc": ba lần "không bắt buộc" trên một màn. Mô tả dưới nhãn chỉ dùng khi bên cạnh không có tiêu đề bước riêng (thường là thanh dọc bên trái form dài); khi đó `text-sm text-muted text-pretty`, cho xuống dòng, không `truncate`. Thiếu `text-pretty` là trơ một chữ ở dòng cuối.
- **Bước đã xong bấm được để quay lại** (vòng + nhãn là một nút, `cursor-pointer`, hover nhãn gạch chân). Bước chưa tới không bấm được. Có cho nhảy cóc tới bước chưa tới hay không là logic, người dùng quyết. **Đang gửi ở bước cuối thì các bước đã xong `disabled`** như nút "Quay lại": trông bấm được (rê vào gạch chân) mà bấm không đi đâu là nói sai.
- **Màn hẹp dưới `sm` thu gọn**, không cố nhét ba cột: một dòng "Bước 2 / 3" `text-sm font-medium tabular-nums` + một thanh mảnh `h-1` chia đoạn theo số bước. **Tên bước không ghi ở dòng này khi card ngay dưới đã có tiêu đề bước**: "Bước 1 / 3 · Thông tin workspace" rồi tiêu đề card "Thông tin workspace" cách 50px là lặp, cùng lý do đường dẫn không ghi trang đang đứng (`layouts/app.md`, đã dính 26/09/2026). Đoạn bước đã xong `bg-primary`, **đoạn bước đang làm `bg-primary/30`** (nửa đậm), chưa tới `bg-secondary`. Ba tầng như ba kiểu vòng ở màn rộng. Không tô đậm đủ đoạn đang làm: đứng ở bước cuối sẽ trông y như đã xong hết. Cũng không để đoạn đang làm xám như chưa tới: chữ ghi "Bước 2 / 3" mà thanh chỉ sáng một đoạn, đọc như thanh bị thiếu. **Ca có ghi tên bước** ("Bước 2 / 3 · Người liên hệ", khi bên dưới không có tiêu đề bước riêng): **tên được xuống dòng**, `text-pretty`, không `truncate`: tên bước là thứ người dùng cần đọc (`N8`), và đổi bước là đổi cả màn nên dòng chữ cao thêm một dòng không tính là nhảy (`N1`). Cụm "Bước 2 / 3 ·" `whitespace-nowrap` để không bị bẻ đôi. Mô tả ẩn. Không để các cột bước wrap thành hai hàng (`R6`). Có bước lỗi thì đoạn của bước đó đỏ, và **thêm một dòng `text-xs text-red-600` dưới thanh nói bước nào sai** ("Bước 1 còn thiếu mã số thuế"), bấm được để quay lại. Chỉ có đoạn đỏ mà không có chữ thì màn hẹp không biết sai ở đâu.
- Không quá 5 bước. Hơn nữa là form đang cần gộp bước lại.

**Khung một bước:**

```
Tạo workspace mới                      <- tên trang, một lần
(1)━━━━━━━━━━(2)──────────(3)           <- thanh các bước, chỉ nhãn
┌──────────────────────────────────┐
│ Thông tin workspace              │   <- h2 = nhãn bước, text-base font-semibold
│ Một câu dẫn nói điều chưa ai nói │   <- text-sm text-muted
│ [ô] [ô]                          │
│ ──────────────────────────────── │
│ [Huỷ | Quay lại]          [Tiếp] │
└──────────────────────────────────┘
```

- **Mỗi thông tin nói một lần.** Tên bước: thanh các bước (bản đồ cả luồng, như mục đang chọn ở sidebar) và tiêu đề card. Câu dẫn chỉ nói thứ chưa nằm ở chỗ khác: vì sao cần, dùng vào đâu, mời sau ở đâu. **"Không bắt buộc" chỉ ở cạnh nhãn ô** (mục "Đánh dấu trường bắt buộc"), không nhắc lại ở câu dẫn hay ở thanh.
- **Tiêu điểm**: mở trang thì con trỏ nằm sẵn ở ô đầu của bước 1 (`autoFocus`, cùng lý do màn đăng nhập ở trên). Sang bước khác thì đưa tiêu điểm lên `h2` (`tabIndex={-1}`, `outline-hidden`): trình đọc màn hình đọc tên bước mới, và ở màn hẹp trang về đầu bước thay vì đứng ở hàng nút dưới đáy.
- **Hàng nút đáy**: lối lùi bên trái, nút chính bên phải, `border-t border-border pt-5 mt-8`, cao bằng ô (`h-11 md:h-10`). Bước 1 lối lùi là "Huỷ" (rời luồng), các bước sau "Quay lại". Nút chính "Tiếp", bước cuối là động từ của cả luồng ("Tạo workspace", không "Hoàn tất"). Bấm "Tiếp" chỉ kiểm bước đang đứng; sai thì đứng lại, focus ô sai đầu tiên. Lùi về không mất gì đã điền.
- **Chặn bấm đúp ở nút chính**: nút cuối hiện đúng chỗ nút "Tiếp", bấm đúp "Tiếp" ở bước áp chót thì cú thứ hai gửi luôn khi người dùng chưa kịp đọc bước xác nhận. `onClick` bỏ qua `event.detail > 1` (Enter có `detail = 0`, không bị chặn).
- **Bước xác nhận chia nhóm theo bước, mỗi nhóm một link "Sửa"** ở mép phải tiêu đề nhóm, bấm về đúng bước đó. Đây là cách trang thanh toán nào cũng làm. Ở màn hẹp thanh các bước chỉ là dòng chữ và thanh mảnh, không bấm được, nên thiếu "Sửa" thì muốn sửa tên từ bước 3 phải bấm "Quay lại" hai lần qua bước 2. Nhóm là khối nhãn–giá trị (`../components/description-list.md`), tiêu đề nhóm **`text-sm font-semibold`**, link "Sửa" là link chữ `text-sm text-foreground/70` như `I7`, rê vào `text-foreground` + gạch chân, không nút viền. **Tiêu đề nhóm phải khác kiểu chữ giá trị**: giá trị trong khối nhãn–giá trị đã là `text-sm font-medium text-foreground`, tiêu đề nhóm cũng `font-medium` thì trùng hệt, ở màn hẹp (nhãn trên, giá trị dưới) "Thông tin workspace" đọc như một giá trị nữa. Không đổi sang chữ nhỏ xám: tiêu đề nhóm nhạt hơn nhãn con bên dưới là ngược thứ bậc. Không thêm đường kẻ giữa nhóm, khoảng trắng `gap-6` đủ tách. Sửa xong bấm "Tiếp" đi lại tuần tự như thường, không nhảy thẳng về bước xác nhận (nhảy thẳng là logic, người dùng quyết).

---

<!-- nguồn: references/layouts/form.md:345-433 -->
## Trạng thái lỗi

Lỗi hiện **dưới ô nhập**, không hiện trong placeholder, không hiện ở tooltip.

```
nhãn
[ô nhập                    ]   <- viền đỏ đặc; quầng đỏ mờ chỉ khi đang focus
Email này đã có người dùng     <- chữ đỏ, text-xs, ngay dưới ô
```

- Viền `red-500` đặc, ring `red-500/10` rất mờ. Không tô nền đỏ cả ô.
- Câu lỗi nói **cách sửa**, không nói "không hợp lệ". "Email này đã có người dùng" chứ không phải "Email không hợp lệ".
- **Câu lỗi không được trùng chữ với placeholder hay nhãn.** Trùng là dấu hiệu nó không mang thêm thông tin nào — xem mục dưới.
- **Ô tự điền theo ô khác** (đường dẫn theo tên, mã theo tên sản phẩm): ô nguồn trống thì **chỉ ô nguồn báo lỗi**, ô phụ thuộc để yên, vì gõ ô nguồn là ô kia tự có. Ô phụ thuộc chỉ báo lỗi khi người dùng đã tự sửa nó, hoặc khi ô nguồn có chữ mà giá trị sinh ra vẫn sai (quá ngắn, trùng). Đã dính 26/09/2026, `/workspaces/new`: bấm Tiếp khi trống ra hai dòng đỏ "Chưa nhập tên workspace" và "Chưa nhập đường dẫn", mà chỉ cần gõ tên là hết cả hai (`N3`).
- Gợi ý thời điểm (người dùng quyết): hiện lỗi sau khi rời ô hoặc bấm gửi, đừng hiện ngay ký tự đầu tiên. Skill chỉ lo lỗi **trông ra sao**, dựng nó như một trạng thái tĩnh của ô.
- **Sửa xong một ô thì câu lỗi mất, nhưng chỗ của nó ở lại** tới lần bấm gửi sau (`min-h-4` trên dòng dưới ô, bằng một dòng `text-xs`). Rút câu lỗi đi ngay thì mọi ô bên dưới nhảy lên 16px đúng lúc người dùng đang đưa chuột xuống ô kế tiếp (`N1`, đã dính 23/09/2026 ở form tạo công việc). Ô nào có sẵn dòng gợi ý thì không cần: gợi ý quay về đúng chỗ câu lỗi vừa rời.
- **Mặc định: chỉ lỗi tại chỗ, không banner tóm tắt.** Bấm gửi mà có lỗi thì cuộn tới và **focus ô lỗi đầu tiên**; mỗi ô sai viền đỏ + một câu dưới ô. Form trong sản phẩm (SaaS, công cụ làm việc) hầu hết làm vậy; hệ thiết kế cho dịch vụ công thì thêm hộp tóm tắt lỗi đầu trang có link tới từng ô, vì form của họ dài và người điền lần đầu, skill chỉ giữ ca đó cho form rất dài (ca 2 bên dưới; tra 27/09/2026). Banner liệt kê lỗi trên một form thường chỉ đọc lại đúng mấy câu đã nằm dưới từng ô: hai tín hiệu cho một ý (`N3`), và cả màn đỏ rực. Luật cũ "form dài hơn một màn thì có banner" sai, vì ở 375px form nào cũng dài hơn một màn.
- **Banner chỉ dùng cho hai ca:**
  1. **Lỗi không gắn với ô nào**: mất mạng, hết phiên, không có quyền, trùng dữ liệu phía máy chủ. Banner một dòng nói chuyện gì và làm gì tiếp, không liệt kê.
  2. **Form rất dài, chia nhiều mục có tiêu đề** (từ khoảng 12 trường, hoặc phải cuộn qua nhiều mục): lỗi ở mục cuối không thể thấy khi đang đứng ở đầu. Lúc đó banner liệt kê từng lỗi kèm link nhảy tới đúng ô, và **vẫn giữ** lỗi tại chỗ.

```html
<div role="alert" class="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
  <p class="text-sm font-medium text-red-700">Chưa gửi được, còn 3 chỗ cần sửa</p>
  <ul class="mt-2 space-y-1 text-sm text-red-600">
    <li><a href="#tieu-de" class="underline underline-offset-2 outline-hidden">Tiêu đề</a>, chưa điền</li>
  </ul>
</div>
```

Đây là chỗ duy nhất được tô nền đỏ. Ô nhập thì không bao giờ.

---

## Gợi ý và câu lỗi là hai thứ khác nhau

Một field có **ba** chỗ chứa chữ, mỗi chỗ một việc. Lẫn lộn chúng là lỗi hay gặp
nhất ở form, và nhìn ảnh chụp rất khó nhận ra vì "trông vẫn đủ chữ".

| Chỗ | Việc | Màu | Khi nào hiện |
| --- | --- | --- | --- |
| **Nhãn** | Ô này là gì | `--foreground` | Luôn |
| **Gợi ý** | Thứ người dùng chưa biết trước khi gõ | `--muted`, `text-xs` | Luôn |
| **Câu lỗi** | Vừa gõ sai cái gì, sửa thế nào | đỏ, `text-xs` | Chỉ khi sai |

**Dưới ô chỉ có MỘT dòng.** Có lỗi thì câu lỗi **thay chỗ** gợi ý, không đẩy gợi
ý xuống thành hai dòng chồng nhau.

### Ô có giới hạn ký tự

Gợi ý đã ghi "Tối đa 120 ký tự" thì ô phải cho thấy mình đang ở đâu so với mức đó.
Chỉ ghi mà không đếm thì người gõ câu 132 ký tự không biết mình vượt, tới lúc gửi mới
bị chặn.
Cách của các hệ thiết kế lớn:

- **Bộ đếm cùng dòng với gợi ý, căn phải**: `flex justify-between gap-3`, gợi ý trái, bộ
  đếm `shrink-0 text-xs text-muted tabular-nums` phải, ghi "98/120". Vẫn một dòng dưới ô.
- **Chỉ hiện khi đã gõ tới khoảng 80% giới hạn.** Dưới đó chỉ có gợi ý; đếm từ ký tự đầu
  là một con số nhảy liên tục ngay cạnh chỗ người ta đang nghĩ câu chữ.
- **Vượt thì bộ đếm đỏ** ("132/120", chữ đỏ như câu lỗi), gợi ý giữ nguyên. Bấm gửi mà
  vẫn vượt thì câu lỗi thay gợi ý và nói cách sửa: "Dài hơn 120 ký tự, bớt 12 ký tự".
- **Không `maxlength`.** Chặn cứng thì dán một câu dài bị cắt giữa chữ mà không ai báo,
  người dùng mất phần đuôi. Cho gõ và dán quá, rồi báo.
- Bộ đếm nằm trong `aria-describedby` của ô, cập nhật trong vùng `aria-live="polite"`.

### Ba câu hỏi trước khi viết một dòng chữ đỏ

1. **Câu này có trùng chữ với placeholder hoặc nhãn không?** Trùng thì bỏ. Placeholder ghi "Nhập mật khẩu của bạn" mà chữ đỏ dưới ô cũng ghi "Nhập mật khẩu của bạn" thì người dùng đọc hai lần cùng một câu, và vẫn không biết mình sai ở đâu.
2. **Nó nói người dùng LÀM GÌ tiếp, hay chỉ nói ô đang trống?** Mắt đã thấy ô trống rồi.
3. **Nó có phải lỗi không, hay là gợi ý bị tô nhầm màu đỏ?** "Nhập email bạn dùng để đăng nhập" là gợi ý — nó đúng cả khi người dùng chưa làm gì sai. Gợi ý thì xám và hiện sẵn, đừng đợi có lỗi mới đỏ lên.

### Ô trống thì viết gì

| Ô | Sai | Đúng |
| --- | --- | --- |
| Email | `Nhập email của bạn` *(trùng placeholder)* | `Chưa nhập email` |
| Mật khẩu | `Nhập mật khẩu của bạn` *(trùng placeholder)* | `Chưa nhập mật khẩu` |
| Email sai định dạng | `Email không hợp lệ` | `Email phải có dấu @` |
| Mật khẩu ngắn | `Mật khẩu không hợp lệ` | `Mật khẩu cần ít nhất 8 ký tự` |
| Sai thông tin đăng nhập | `Đăng nhập thất bại` | `Email hoặc mật khẩu chưa đúng` |

Dòng cuối là ca riêng: nói rõ sai cái nào **là lỗ hổng bảo mật** — người ngoài dò
được email nào có tài khoản. Nên ở đúng ca này thì mơ hồ là cố ý, và câu lỗi đặt
ở chỗ câu lỗi trên nút Đăng nhập (xem khung wireframe đăng nhập ở đầu file) chứ không dưới một ô cụ thể.
Sau lỗi này: **giữ email, xoá ô mật khẩu và đưa con trỏ vào đó**, khối lỗi `role="alert"`
để trình đọc màn hình đọc ngay. Người dùng gần như luôn gõ lại mật khẩu chứ không sửa
từng ký tự, và ô còn chấm tròn cũ thì họ phải bôi đen xoá trước (cách Google, GitHub,
Microsoft đều làm). Không tô đỏ ô nào, vì không biết ô nào sai. Gõ lại vào ô thì khối
lỗi vẫn đứng yên tới lần gửi sau, không biến mất giữa lúc gõ làm nút nhảy lên (`N1`).
