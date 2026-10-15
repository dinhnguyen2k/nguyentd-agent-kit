# Luật khối và bố cục (F)

> Trích nguyên văn từ evondevKit `skills/ui-ux` commit `dff15b4` (MIT). Cogain override trong `frontend-development/SKILL.md` (mục "UI reference") thắng nội dung dưới đây.

<!-- nguồn: references/rules-form.md:34-35 -->
**F2. Lồng khối tối đa hai tầng.** Card lồng card lồng card là dấu hiệu chưa
quyết định cái gì chứa cái gì.

<!-- nguồn: references/rules-form.md:37-46 -->
**F3. Không mỗi mục một card.**

Nhiều mục cùng loại thì gom vào **một khối**, chia bằng đường kẻ. Bốn card trắng
giống hệt nhau xếp lưới thì mắt đọc ra bốn khối ngang hàng, không đọc ra một
danh sách.

Dòng tiêu đề của danh sách (icon + nhãn, số liệu bên phải) và dòng hành động cuối
("Xem tất cả") nằm **TRONG** khung, không nằm ngoài.

*Ngoại lệ: thẻ kanban*, vì nó là vật kéo thả được.

<!-- nguồn: references/rules-form.md:48-48 -->
**F4. Không bọc bảng vào card.** Bảng đã tự có khung bằng đường kẻ rồi: chính bảng là một khung trắng viền mảnh, không lồng thêm card có padding bên ngoài.

<!-- nguồn: references/rules-form.md:50-51 -->
**F5. Không chia đều ba cột chỉ vì có ba mục.** Bố cục theo mức quan trọng.
Widget quan trọng nhất chiếm nhiều cột hơn.

<!-- nguồn: references/rules-form.md:57-60 -->
**F7. Không hero chiếm nguyên màn hình.** Trong app thì vào là thấy việc — không
banner, không dòng chào mừng chiếm chỗ.

---

<!-- nguồn: references/rules-form.md:70-71 -->
**F9. Thẳng chân bằng `mt-auto` cho nút hành động.** Số dòng nội dung lệch nhau
là chuyện thường, nút vẫn phải cùng độ cao.

<!-- nguồn: references/rules-form.md:73-83 -->
**F10. Widget bị kéo cao hơn nội dung thì nội dung giãn theo.**

Card `row-span-2` thì cho nội dung nở bằng `flex-1` kèm `min-h`. Đừng đóng cứng
chiều cao rồi `mt-auto` đẩy xuống đáy — phần trên thành khoảng trống chết.

`mt-auto` chỉ dành cho **nút**, không dành cho khối nội dung.

*Cách kiểm:* widget nào có khoảng trống chết quá một phần ba chiều cao là nội
dung chưa giãn.

---

<!-- nguồn: references/rules-form.md:187-237 -->
**F25. Đường chia trong khối có padding phải tràn hết bề ngang, không thụt theo
padding.**

Dropdown, card, panel đều có `p-*` quanh nội dung. Đặt `<hr>` vào trong đó thì
nó thụt vào hai đầu, thành một đoạn gạch lơ lửng giữa khối — nhìn như vẽ hụt chứ
không như một vách ngăn.

Đường chia là thứ **chia khối**, nên nó phải chạm hai mép khối. Hai cách, chọn
theo cấu trúc:

Chọn cách theo **nền hover của mục có thụt vào so với mép khung hay không**:

```html
<!-- Cách 1 — menu, dropdown: mục hover thụt vào, cách mép khung một khe.
     Khung chỉ padding dọc; khe ngang nằm ở từng nhóm mục, vạch đứng giữa hai nhóm nên tự chạm mép. -->
<div class="rounded-2xl py-1">
  <div class="px-1">
    <button class="flex h-10 w-full items-center rounded-xl px-3">…</button>
  </div>
  <hr class="my-1 border-border" />
  <div class="px-1">
    <button class="flex h-10 w-full items-center rounded-xl px-3">…</button>
  </div>
</div>

<!-- Cách 2 — danh sách trong card: dòng tràn hết bề ngang, không thụt.
     Khung không padding ngang, padding nằm ở từng dòng. -->
<div class="py-1.5">
  <a class="block px-4 py-3">…</a>
  <hr class="border-border" />
  <a class="block px-4 py-3">…</a>
</div>
```

**Đừng dùng cách 2 cho menu.** Bỏ padding ngang của khung là nền hover chạm sát
mép, mất khe hở, và bo góc của mục với bo góc của khung không còn đồng tâm
(`M19`).

**Cách 1 không kéo vạch ra bằng `-mx-*`** (`N11`). Bản cũ để khung `p-2` rồi cho vạch
`-mx-2`: hai con số phải khớp nhau, đổi padding khung mà quên đổi âm lề là vạch lại hụt
hoặc tràn khỏi khung. Gom mục thành nhóm `px-*` thì không còn số nào phải khớp. Nhóm
chỉ là `<div>` trơn, không `role`: trình đọc màn hình vẫn thấy các `menuitem` là con của
`menu`. Đo 27/09/2026 trên 12 menu (tài khoản, ⋯ của thành viên, ⋯ của khoá API; 375 và
1280px): vị trí từng mục, từng vạch và chiều cao menu trùng từng pixel với bản `-mx-1`.

Cùng lý do, `divide-y` trên danh sách trong card cũng tràn hết bề ngang — xem
`references/components/card.md`.

Ngoại lệ duy nhất: đường chia **giữa các dòng của một danh sách** mà muốn bắt đầu
thẳng hàng với chữ (bỏ qua avatar bên trái). Cái đó là thụt có chủ ý, và phải
thụt đúng bằng chiều rộng avatar cộng gap, không phải bằng padding.
