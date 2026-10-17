# Hạng lỗi khi soi UI (V1)

> Trích nguyên văn từ evondevKit `skills/ui-ux` commit `dff15b4` (MIT). Project override trong `frontend-development/SKILL.md` (mục "UI reference") thắng nội dung dưới đây.

<!-- nguồn: references/review.md:130-250 -->
## V1. Mỗi dòng một hạng ⚑

| Hạng | Căn cứ | Ví dụ | Mặc định |
| --- | --- | --- | --- |
| **Hỏng** | Sai với mọi brand | Tương phản dưới 4.5:1 (chữ lớn 3:1), trang cuộn ngang, chữ bị cắt hay bị giấu mất nghĩa, vùng bấm dưới 24px, lớp nổi lòi khỏi màn, dialog cao quá màn mà không cuộn, rê chuột làm nhảy bố cục | Đề xuất sửa |
| **Lệch hệ** | Token và component **của chính dự án** | Ba kiểu bo góc nút, hai màu cho cùng một trạng thái, khoảng cách lẻ ngoài thang của họ, mã hex viết cứng gần giống token | Đề xuất sửa, theo hệ của họ |
| **Gu** | `principles.md` và luật skill | Sidebar có viền phải, badge nền đậm, nền rê đậm nhạt | Chỉ nêu, ghi "gu, tuỳ bạn", mặc định không chọn |

- **Lệch hệ phải chỉ ra được chỗ đúng trong dự án.** "Nút này bo 6px, bốn nút khác
  cùng loại bo 12px (`button.tsx:14`)" là Lệch hệ. Chỉ nói "nên bo 12px" mà không có
  chỗ nào của dự án làm thế thì đó là Gu.
- **Đếm giá trị ngoài thang không phải là Lệch hệ.** "Có 17 kiểu bo góc, gom về
  `sm` / `md` / `lg`" là đang áp thang lên dự án. Chỉ lệch khi **cùng vai mà khác
  nhau**: hai nút cùng loại đứng cạnh nhau, hai card trong cùng một lưới. Card khác loại
  (panel, thẻ số liệu, thẻ quảng bá) không cùng vai chỉ vì cùng là card, nên bo góc
  khác nhau giữa chúng không phải lỗi. Một giá trị ngoài token mà dùng đều cho một vai
  (mọi dialog bo 20px, mọi thẻ nổi bật bo 28px) là hệ của họ, dù file token không khai. Tìm mã hex viết cứng thì mỗi dòng ghi đúng vai và `file:line`: "xanh
  `#3b82f6` ở badge số đếm, trong khi xanh của hệ là token `primary` `#2563eb`".
- **Control gốc của trình duyệt chưa có kiểu là Lệch hệ ở mọi chế độ**, không cần trên
  màn có một bản đã có kiểu để so: `<select>` còn góc vuông, viền xám của trình duyệt,
  `<input type="range">` mặc định, ô nhập viền inset. Giữa một app đã có kiểu, chúng đọc
  ra là chỗ bị bỏ quên. Cột Sửa: dự án có component riêng thì dùng cái đó; chưa có thì
  dựng theo mẫu của skill (bảng "Ba chế độ"), tô bằng token của dự án. Select gốc đã
  được tô (bo góc, viền token, `appearance-none` với chevron riêng) thì ở chế độ soi không
  phải lỗi. Ở hai chế độ dựng lại, select gốc đã tô mà **hiện trên desktop** vẫn phải thay:
  bấm vào vẫn bung menu của hệ điều hành (`choice-controls.md`, Select). Probe liệt kê
  chúng ở dòng "Select gốc đã tô trên desktop".
- **Tìm Lệch hệ trong code bằng lệnh, đừng chỉ nhìn ảnh.** Hai màu đỏ gần giống nhau,
  bóng tự chế, bo góc lẻ trong một hộp thoại thì ảnh không cho thấy. Đọc token trong
  `@theme` hoặc `tailwind.config` trước, rồi grep:

  ```bash
  # màu bảng mặc định của Tailwind dùng cho vai đã có token (đỏ, xanh, xám chữ…)
  grep -rnoE "\b(bg|text|border|ring|from|to|fill|stroke)-(red|rose|blue|sky|green|emerald|amber|orange|slate|gray|zinc)-[0-9]{2,3}\b" \
    src app components --include='*.tsx' --include='*.jsx' 2>/dev/null | head -40
  # mã màu, bóng, bo góc viết cứng
  grep -rnoE "\[(#[0-9a-fA-F]{3,8}|rgba?\([^]]*\))\]|shadow-\[[^]]*\]|rounded-\[[^]]*\]" \
    src app components --include='*.tsx' --include='*.jsx' 2>/dev/null | head -60
  ```

  Dự án CSS thuần, CSS Modules, SCSS thì hai lệnh trên không ra gì. Chạy thêm, bỏ qua file
  token:

  ```bash
  # mã màu và bo góc viết cứng trong CSS, ngoài file token
  grep -rnE "#[0-9a-fA-F]{3,8}\b|rgba?\([0-9]|border-radius:\s*[0-9]" src \
    --include='*.css' --include='*.scss' --include='*.less' 2>/dev/null | grep -vE "tokens?\.|variables\.|theme\." | head -60
  # bảng màu viết cứng trong file TS / JS (map trạng thái → mã hex)
  grep -rnoE "['\"]#[0-9a-fA-F]{3,8}['\"]" src --include='*.ts' --include='*.tsx' --include='*.js' 2>/dev/null | head -30
  ```

  Kết quả trùng giá trị token (viết cứng `#2563eb` khi đã có token đó), hay lệch token
  một chút cho cùng vai (`#3b82f6` cạnh token xanh `#2563eb`), là Lệch hệ. Ghi vai và
  `file:line`, cùng gốc thì gộp. Giá trị lạ mà dùng đều cho một vai thì không (mục
  trên). Đã sót 30/09/2026 ở dự án mồi CSS Modules: nút chính một trang đè `#a3e635` thay
  token `#c6f432`, một card đè `border-radius: 8px` giữa các card 20px. Lượt tự mở trang chỉ
  chạy lệnh Tailwind nên không ra; lượt chỉ đưa ảnh lại bắt được cả hai bằng mắt.
- **Thứ bậc nút là Gu ở chế độ soi, không phải Lệch hệ.** Hai nút chính cạnh nhau trên một
  header, dù trang khác để một nút phụ: mỗi nút đúng token, đúng component, chọn nút nào là
  chính là quyết định sản phẩm. Ghi một dòng Gu (*"hai nút cùng nổi, không biết đâu là việc
  chính"*). Lệch hệ là **cùng vai mà khác giá trị** (màu, bo góc, cỡ, kiểu badge), không phải
  khác lựa chọn biến thể. Hai chế độ dựng lại thì vào dòng Cấu trúc "Tín hiệu tranh nhau"
  (`V1b`). Đã xếp nhầm Lệch hệ ở cả hai lượt, 30/09/2026.
- **Không bao giờ là lỗi**, trừ khi phạm luật đọc được ở hạng Hỏng: màu nhấn và màu
  brand, bo góc lớn hay nhỏ, font, bóng / gradient / glass dùng đều khắp dự án, mật
  độ dày hay thoáng, dự án nhiều màu hơn gu skill (đầu `principles.md`), khối màu đậm
  hay gradient của brand (thẻ ví, banner), icon và badge mỗi loại một màu. "Không phải lỗi"
  nghĩa là **không xếp Hỏng hay Lệch hệ, không tự sửa, không chọn sẵn**. Không có nghĩa là
  im lặng: trông xấu thì vẫn đề xuất, theo mục dưới.
- **Chỗ nào trông xấu thì đề xuất, dù là dáng hay nhận diện** ⚑ (chủ dự án chốt 29/09/2026).
  Soi từng khối bằng mắt, đặt cạnh mẫu gần nhất của skill: badge, font, nút, card, icon, ảnh,
  khoảng thở, bóng, gradient, màu trang trí, sidebar, header… Khối nào trông xấu thì có một
  dòng, chia theo loại:
  - **Dáng** (cỡ, độ đậm, bo góc, padding, viền, bóng, vị trí, mật độ): nhánh `U` và hai chế
    độ dựng lại **tự sửa** theo bảng "Dáng lấy từ skill" và dòng Gọn `V1c`; chế độ soi thì
    một dòng Gu kèm ảnh trước / sau.
  - **Nhận diện** (màu vai, font, logo, khối màu đậm của brand): không tự sửa, không chọn
    sẵn. Đề xuất một dòng (soi: Gu; dựng lại: dòng không chọn sẵn; nhánh `U`: mục "Còn
    thấy" của `U4`) kèm hướng cụ thể và ảnh trước / sau. Font thì nêu tên một hai font đã
    kiểm có subset `vietnamese` (`T5`). Màu thì ưu tiên hạ mức nhấn mà giữ sắc (pill đặc
    thành chữ màu không nền, chấm nhỏ) trước khi đề xuất đổi màu.
  - **Số lượng và thứ bậc** (cùng một thứ lặp ở mọi mục, thứ phụ nặng hơn thứ chính): nêu
    bằng số và vị trí, như "Thông tin không phân biệt được gì" và "Tín hiệu tranh nhau" ở
    `V1b`: *"8/8 thẻ có badge, 4 thẻ là 'Mới', mắt dừng ở badge trước giá. Chỉ giữ badge ở
    phòng khác đi."*

  **Lý do phải là thứ người dùng cuối vấp hoặc thấy**: đọc khó, mắt dừng sai chỗ, trông
  như bản nháp, lệch với phần còn lại của trang, gãy dấu tiếng Việt. "Không giống gu skill"
  hay "trông cũ" chưa phải lý do. Chấm dự án mồi: dòng đề xuất có lý do, không chọn sẵn,
  **không tính là báo nhầm**; xếp brand vào Hỏng / Lệch hệ hay tự sửa brand thì vẫn là báo nhầm.

  ⚠️ **Đảo luật 29/09/2026, đừng hồi sinh bản cũ:** bản 27/09 ghi mấy thứ trên "cũng không
  đưa vào hạng Gu", để chặn các dòng đòi đổi nhận diện ở dự án mồi. Nó chặn luôn thứ đáng nói:
  ở tim-phong-sua, 8/8 thẻ có badge, năm màu đè lên ảnh; badge, font, sidebar chữ đậm đều xấu
  mà không lượt soi hay dựng lại nào nêu, chủ dự án tự thấy rồi hỏi sao skill không đề xuất.
- **Gu tối đa năm dòng** ở chế độ soi, xếp cuối bảng. Hai chế độ dựng lại không giới hạn,
  nhưng Gu của một khối chính thì gom vào dòng Gọn của khối đó (`V1c`).

Probe báo không có nghĩa là lỗi Hỏng. Nhiều mục của probe đo theo gu skill, nên đổi
sang hạng theo bảng này. Những mục xếp Hỏng thì probe đã tự gom thành danh sách `P1`,
`P2`… ở cuối báo cáo (xem `V5`).

| Mục probe | Hạng |
| --- | --- |
| Trang tự cuộn khi vừa tải, cuộn ngang, lớp nổi lòi khỏi màn, lớp nổi mở bằng nút bị vỡ, rê chuột làm nhảy bố cục, tương phản chữ dưới ngưỡng, khung giấu mất chữ, chữ cắt còn quá ngắn, chữ trong nút xuống dòng, nhãn số đè lên đường biểu đồ, badge đè mất icon, khối bị bóp chiều cao, chữ cắt nuốt mất số, rê ra đúng màu mục đang chọn, rê vào ô đã chọn làm mất màu nhấn, scale / translate / rotate không chạy chuyển động (`W10`), hàng cuộn ngang chuột không tới được (`responsive.md`, sau `R10`), đường ngăn thẳng hàng mà khác màu (một đường nửa nhạt nửa đậm, sai với mọi brand) | Hỏng |
| Chỗ bấm dưới 32px | Mục có ghi "(dưới 24px)" là Hỏng, còn lại (24 tới 31px) là Gu |
| Hàng trong header / nav rớt dòng | Hỏng khi đè hay đẩy lệch khối khác, không thì Lệch hệ (so với cách hàng đó ở khổ khác). Xem ảnh mới quyết |
| Hàng nút trên header không đồng cỡ | Lệch hệ. Chế độ dựng lại thì vào dòng Gọn của header (`V1c`), theo "Nhóm nút bên phải thanh header" trong `layouts/app.md` |
| Hàng control lệch trên dưới, placeholder dài hơn ô, khối trông như ô nhập mà chữ xuống dòng, phân trang chỉ có nút chữ, thanh header trong suốt trên nền xám, vạch chia trong menu đậm hơn viền khung, khung / vạch lớp nổi đậm hơn token `--border`, vạch trái bị bo góc khung cắt, khung hộp thoại mờ lồng trong lớp nền mờ, cao gần bằng mà không bằng, đường ngăn hai cột kề nhau lệch, chữ cùng cột lệch mép, dấu ngăn cách không đều, control còn kiểu mặc định của trình duyệt, khung khai viền mà viền không thấy, khối cùng component bo góc khác nhau, Tab tới không thấy gì trong khi dự án vẽ vòng focus ở chỗ khác (ngoại lệ của `I13`), khối con biến mất lúc rê, lớp nổi có dải trống, lớp nổi bật tắt không chuyển động, control gốc trong lớp nổi (checkbox, radio, thanh trượt, ô tệp; select, ô ngày gốc đã tô thì theo dòng "Select gốc đã tô trên desktop"), viền trang trí đậm, thanh cuộn khác mẫu, sidebar chữ đậm hay mục sát nhau, số viết sai kiểu tiếng Việt | Lệch hệ |
| Nền rê gần như không thấy, nền rê tan vào nền ngoài khung hay trùng nền phía sau (gộp một dòng, ghi các nút; hai chế độ dựng lại thì tự sửa theo `components/button.md`), nền rê trùng màu viền của chính nút, viền đổi màu lúc rê, rê khác hình mục đang chọn, bấm xong còn dấu thừa, Tab tới còn vẽ vòng focus (`I13`: chế độ soi ghi một dòng Gu, hai chế độ dựng lại thì gỡ), bảng cuộn ngang mất cột, nhóm lựa chọn xếp lưới, số tiền ngắt dòng, số không thẳng hàng, nhãn số lòi ra ngoài vùng vẽ, dấu câu rơi xuống đầu dòng, chữ dưới 12px (gộp một dòng, ghi cỡ nhỏ nhất và chỗ; sửa lên ít nhất 12px), cột dính mà cuộn riêng, nội dung trôi giữa màn rộng (`layouts/app.md`), mục lặp dày chữ | Gu |
| Select gốc đã tô trên desktop, ô ngày / giờ gốc đã tô, kể cả trong lớp nổi | Chế độ soi: không vào bảng. Hai chế độ dựng lại: Lệch hệ, thay bằng Select dựng (từ 8 mục có ô tìm) và ô chọn ngày có popover lịch |
| Lỗi console | Không vào bảng. Ghi một dòng dưới bảng |

Nền rê yếu là Gu ở chế độ soi (chủ dự án chốt 30/09/2026): rê nhạt không làm hỏng việc gì, người
dùng vẫn bấm được, và đó là mặc định của shadcn. Chỉ rê làm **sai trạng thái** mới là Hỏng: rê ra
đúng màu mục đang chọn, rê vào ô đã chọn làm mất màu nhấn, rê làm nhảy bố cục. Probe vẫn đưa nền rê
yếu vào danh sách `P` (nhãn có "soi: Gu") vì lúc dựng, cổng 3 phải sửa hết. Ở bảng soi, mã đó lên
dòng Gu. ⚠️ Bản 28/09 xếp Hỏng; vòng 1 lịch khám ra ba dòng Hỏng chỉ vì nút ghost và dòng bảng
shadcn rê nhạt.

---

