# Luật nền: phạm vi (S), nguyên tắc (N), bảng trạng thái (D2)

> Trích nguyên văn từ evondevKit `skills/ui-ux` commit `dff15b4` (MIT). Cogain override trong `frontend-development/SKILL.md` (mục "UI reference") thắng nội dung dưới đây.

<!-- nguồn: SKILL.md:263-265 -->
**S1. Không tự đẻ thêm section.** Đề bài có mấy khối thì dựng đúng mấy khối.
Skeleton vẽ ba card thì giao ba card, không tự thêm header, bảng so sánh, câu
hỏi thường gặp, footer.

<!-- nguồn: SKILL.md:267-268 -->
**S2. Chữ "làm cho hoàn chỉnh" không phải giấy phép thêm nội dung.** Nó chỉ có
nghĩa là dựng xong phần được giao.

<!-- nguồn: SKILL.md:312-313 -->
**S9. Dùng thư viện component sẵn có của dự án.** Xem câu 2 ở mục 0. Người dùng
nói rõ dùng thư viện nào thì **theo họ, đừng cãi**.

<!-- nguồn: SKILL.md:445-456 -->
**Dựng một trang là RÁP, không phải vẽ lại.** Trên trang có phần tử nào nằm
trong bảng trên thì mở đúng file đó và chép công thức, kể cả khi nó chỉ là một
nút nhỏ ở góc. Không tự nặn biến thể "cho hợp trang này": cùng một badge mà bảng
một kiểu, drawer một kiểu là hai app ghép lại (`D1`, `D2`). Trang cần một phần
tử chưa có file thì theo luồng **"Dựng một thứ chưa có mẫu"** ở cuối
`references/principles.md`: mượn khuôn gần nhất, dựng cả ca biên, probe tự sửa, soi
năm câu bằng mắt, lúc giao nói một dòng *"X chưa có mẫu đã duyệt, mình mượn khuôn của Y"*.

**Code mẫu đã duyệt** (chỉ mở sau khi chốt loại màn hình, luật `S11`):
`references/layouts/app-kanban.html`

---

<!-- nguồn: references/principles.md:50-81 -->
**N1. Đổi trạng thái thì giao diện không nhảy chỗ, không co giãn.**

Người dùng bấm, rê chuột, chuyển trang, dữ liệu về: mọi thứ **xung quanh** chỗ vừa
đổi phải đứng yên. Hai cách giữ: chừa sẵn chỗ cho trạng thái lớn nhất, hoặc đổi
bằng màu và opacity thay vì thêm bớt phần tử. Số tự đổi (đồng hồ đếm ngược, phần trăm,
bộ đếm) luôn `tabular-nums`.

Đã dính: tab thêm viền lúc chọn làm cả hàng xô (tab luôn có `border`); nav phân
trang đổi số ô theo trang (luôn 7 ô); select "Mỗi trang" trôi theo chuỗi đếm;
spinner chèn vào nút làm nút phình (spinner thay chỗ icon); cột % lệch vì nút
cuối hàng rộng hẹp khác nhau (cột hành động `w-20`); lịch 5 hay 6 hàng (luôn 6);
khung chờ sai hình (`I19`); thanh cuộn chiếm chỗ lúc hiện (`I18`); đổi độ đậm
chữ tab lúc chọn; câu lỗi OTP chèn vào đẩy nút Xác nhận tụt khỏi con trỏ (dòng
lỗi giữ chỗ sẵn khi nó nằm giữa ô và nút bấm); câu lỗi hay lý do khoá thay chỗ mô tả
`text-sm` mà xuống `text-xs`, hàng cài đặt co lại lúc bật tắt (câu thay chỗ giữ cỡ của câu nó thay).

**Giữ chỗ là để khớp với phần tử bên cạnh**, không phải để giữ hình. Không có
gì bên cạnh (màn hẹp xếp một cột, cả hàng cùng thiếu) thì bỏ chỗ giữ, để không
thành khoảng trắng vô nghĩa.

**Sang hẳn màn khác thì không tính** (đổi bước form, đổi trang): cả màn đã thay,
không còn gì "bên cạnh" để giữ. Đừng `truncate` chữ cần đọc chỉ để giữ chiều cao
qua các màn.

**Mở/đóng có chủ ý đẩy phần bên dưới** (accordion, nhóm thu gọn) thì không giữ chỗ
được, nên phải **trượt**, không giật: `grid-rows` 0fr ↔ 1fr, không `<details>`, không
render có điều kiện (`I30`).

*Phép thử:* bật lần lượt từng trạng thái, nhìn **phần tử bên cạnh**, không nhìn
phần tử vừa đổi. Có cái nào xê dịch dù 1px không?

---

<!-- nguồn: references/principles.md:83-107 -->
**N2. Mỗi trạng thái đều được dựng, và liếc là phân biệt được.**

Liệt kê trạng thái trước khi dựng: thường, rê chuột, focus bàn phím (chỉ ô nhập và
mục menu; phần còn lại không vẽ vòng focus theo `I13`), đang chọn, khoá, đang tải,
rỗng, lỗi, xong, và **ca biên** (không có gì, một cái, rất dài, rất nhiều). Mỗi trạng
thái một ví dụ tĩnh (`SKILL.md` phạm vi). Hai trạng thái khác nghĩa thì phải khác hình rõ
ràng.

Đã dính: xong mà thanh vẫn đen đầy như đang chạy (xong là emerald); trang đang
chọn trông như ô input; nút phụ trông như bị khoá (`I8`); hôm nay và ngày đang
chọn lẫn nhau (chữ đậm + chấm, khác nền đặc); một trang và 0 dòng vẫn hiện đủ
control chết; bước lỗi không có hình riêng; tệp bị từ chối vì quá cỡ vẫn có rãnh thanh tiến độ rỗng, đọc như "đang chờ chạy"; khung tải tệp bị khoá cùng nền với lúc đang kéo tệp vào; thanh bước thu gọn tô đậm cả đoạn đang
làm nên "đang ở bước cuối" giống "đã xong hết", sửa thành để xám thì "Bước 2 / 3"
lại đọc như thanh thiếu (đang làm là tầng thứ ba, nửa đậm).

Ngoại lệ có tên: dòng bảng **đã chọn** và dòng **đang rê chuột** cùng một nền mờ, vì
hai trạng thái đã tách bằng checkbox đã tick (chủ dự án chốt 23/09/2026, `I10`). Hình
khác nhau không nhất thiết phải là nền khác nhau. Ngoại lệ này **chỉ cho dòng bảng tick
checkbox**. Sidebar và cây thư mục không có checkbox nên đang chọn đậm hơn rê một bậc: rê
`hover:bg-item-hover`, đang chọn `bg-secondary` + `font-medium`, không màu nhấn, không viền
(chủ dự án chốt 29/09/2026).

*Phép thử:* che chữ đi, chỉ nhìn hình. Còn nói được đây là trạng thái nào không?

---

<!-- nguồn: references/principles.md:259-280 -->
**N9. Mọi thao tác đi được bằng chuột, bằng phím, và bằng tay trên điện thoại.**

Bấm được thì có hover và `cursor-pointer` trên đúng phần tử bấm, vùng bấm rộng
hết hàng (`I9`, `I29`). Tab tới được; không vẽ vòng focus (`I13`, chủ dự án chốt). Không có
hover trên màn chạm thì thứ ẩn-hiện-khi-rê phải luôn hiện (`I11`). Thứ chọn được
thì chọn được bằng nhiều đường, không chỉ một cử chỉ. `aria-*` cho thứ chỉ nói
bằng hình (`aria-pressed`, `aria-current`, `role="progressbar"`).

**Thứ bấm được mà hình nhỏ hơn 32px** (nút chữ giữa câu "Thử lại", "Gửi lại", nút icon `size-7`
cạnh một giá trị) **giữ hình, nới vùng bấm bằng `relative before:absolute before:-inset-*`** cho
tới ~32–40px, không phóng to hình: to hình thì đẩy lệch hàng và nặng hơn việc của nó. Số âm ở đây
buộc phải giữ (`N11`). Nếu hai vùng nới chạm nhau thì tách thứ đó ra hàng riêng trước. Đã dính ba
chỗ trong một ngày (27/09/2026): nút sao chép 28px, "Gửi lại · Huỷ" 18px, "Thử lại" 16px; công thức
từng chỗ ở `components/description-list.md`, `layouts/app.md` (Hồ sơ), `components/file-upload.md`.

Đã dính: bánh xe giờ chỉ cuộn mới chọn được, và cuộn khựng giữa chừng; chỉ có
mũi tên ‹ › để đổi tháng, đi xa là mỏi tay (tiêu đề bấm ra lưới tháng/năm).

*Phép thử:* rút chuột ra, dùng Tab + Enter + mũi tên đi hết màn. Rồi mở trên điện
thoại. Có chỗ nào kẹt không?

---

<!-- nguồn: references/principles.md:337-364 -->
**N12. Chữ trong một khối có thứ bậc, có nhịp, và tên không bị cắt cụt** ⚑.

Áp cho **mọi khối lặp**: card tin đăng, card việc làm, card sản phẩm, dòng danh sách, ô
lưới, kể cả kiểu chưa có mẫu. Không cần mẫu riêng cho từng kiểu, ba câu này là đủ:

1. **Thang chữ trong khối chênh nhau một bậc.** Tối đa ba cỡ chữ, thứ to nhất chỉ hơn tên
   mục một bậc của thang (`budgets.md`): tên `text-sm` thì giá, số chính `text-base`
   `font-semibold`, không nhảy lên `text-lg`, `text-xl`. Thứ bậc còn lại nói bằng độ đậm
   và màu. Giá to gấp rưỡi tên thì card đọc như bảng giá, tên thành chữ phụ. Ngoại lệ: card
   số liệu, nơi con số chính là cả khối (`components/charts.md`).
2. **Nhịp theo nhóm: trong nhóm gần, giữa nhóm xa.** Gom chữ thành nhóm theo nghĩa (giá +
   tên; diện tích · khu vực · mốc gần; thời gian đăng). Dòng trong một nhóm cách **4px
   (`gap-1`)**, không `gap-0.5`: 2px thì hai dòng dính nhau, nhất là dòng có dấu tiếng Việt
   (chủ dự án chốt 30/09/2026). Giữa các nhóm 8–12px, khoảng từ chữ tới mép khối không nhỏ
   hơn khoảng giữa nhóm. Mọi dòng cách đều nhau là không có nhóm, mắt đọc thành một cục chữ.
3. **Tên để nhận ra mục không cắt cụt.** Khối lặp mà mỗi mục là một khối riêng (card trong
   lưới) thì tên `line-clamp-2`; `truncate` một dòng chỉ cho danh sách dày (dòng bảng,
   sidebar, `T14`). Tên cắt sau hai mươi mấy ký tự ("Cho thuê phòng trọ khép kín …") là
   mất đúng thứ người dùng đọc để chọn (`N8`).

Đã dính 29/09/2026, tim-phong-sua: card phòng giá 18px trên tên 14px, ba nhóm chữ cách đều
4–5px, tên cắt một dòng. Không lượt nào nêu, vì skill chỉ có mẫu cho khối đã biết; chủ dự án
chốt: đừng viết thêm mẫu cho từng kiểu, viết phép thử chung.

*Phép thử:* probe mục "KHỐI LẶP" (card có ảnh: chữ to nhất so với tên, khoảng giữa các dòng,
tên cắt một dòng). Khối không ảnh thì tự soi ba câu trên bằng ảnh chụp.

---

<!-- nguồn: references/system.md:42-69 -->
## D2. Một bảng ánh xạ trạng thái duy nhất

`todo` / `doing` / `done`, mức ưu tiên, vai trò — khai **một chỗ** thành cặp
*nhãn + màu*, dùng y hệt ở mọi bề mặt.

Cấm board dùng badge nền màu còn bảng dùng chấm tròn. Cùng một trạng thái mà hai
hình dạng thì người dùng phải học hai lần.

```
STATUS = {
  todo:   { nhãn: "Cần làm",   màu: xám,      icon: "circle" },
  doing:  { nhãn: "Đang làm",  màu: xám,      icon: "circle-dot" },
  review: { nhãn: "Chờ duyệt", màu: hổ phách, icon: "circle-ellipsis" },
  done:   { nhãn: "Xong",      màu: xanh lá,  icon: "circle-check" },
}
```

Màu vẫn theo `M4`: đây là trạng thái thật, nên được dùng màu. Bốn tông và hình
badge lấy đúng bảng trong `M7`; "Đang làm" xám chứ không hổ phách, vì hổ phách là
"cần chú ý" và xanh để dành cho "xong" (bản cũ ghi hổ phách, lệch `M7`). Hai trạng
thái cùng tông thì tách bằng icon, bảng icon cũng ở `M7`.

**Trạng thái làm tiêu đề thì cùng một hình ở mọi view.** Hàng nhóm của bảng và đầu
cột kanban là **icon + tên + số đếm**, không pill; trạng thái làm giá trị một ô thì
mới là pill. Bảng nhóm dùng pill còn kanban chỉ chữ trơn là cùng một trạng thái hai
hình.

---
