# UI Visual Gate (Kiểm Định Giao Diện 2 Chặng)

Dùng khi tạo mới hoặc mở rộng màn hình, trang chi tiết, form, hộp thoại hoặc báo cáo Frontend để kiểm chứng giao diện đạt chuẩn trước khi nghiệm thu.

## 1. Kiến trúc E2E 2 Chặng

1. **Chặng 1 - `UI Visual Gate` (chạy ngay sau khi code xong FE, độc lập Backend)**:
   - Nếu API Backend trên môi trường dev đã sẵn sàng thì mở trang thật.
   - Nếu Backend/DB chưa sẵn sàng hoặc thiếu dữ liệu biên, dùng `mockApiStates(page, handlers)` trong `../lib/ui-visual-audit.js` để giả lập trên bộ nhớ trình duyệt (tuyệt đối không sửa mã nguồn ứng dụng) đủ 4 trạng thái: `loading`, `empty`, `normal` và `stress` (tên rất dài, số tiền lớn, 15+ dòng chi tiết, thông báo lỗi).
2. **Chặng 2 - `Business E2E` (chạy sau khi Backend và DB migration đã lên môi trường dev)**:
   - Tập trung kiểm tra luồng nghiệp vụ đầu cuối, công thức tính toán, phân quyền và chặn sửa sau phát hành.

## 2. Hai Lớp Kiểm Định Bắt Buộc Ở Chặng 1

Chạy trên tối thiểu 2 kích thước khung nhìn máy tính (`1440x900` và `1280x800`), gồm danh sách, khung xem nhanh, dialog/sheet và trang chi tiết.

### Lớp 1 - Quét hình học & văn bản DOM tự động (`auditUiSurface`)

Gọi `auditUiSurface(page)` hoặc `captureSideBySideEvidence(page, ...)` từ `../lib/ui-visual-audit.js`:

- Bắt buộc `pass === true` (`brokenCount === 0` và `systemDriftCount === 0`):
  - Không lộ chuỗi UUID/GUID thô, `undefined`, `NaN`, `[object Object]` hay khóa dịch i18n thô lên màn hình.
  - Không tràn ngang toàn trang (`scrollWidth > innerWidth`) và không tràn dialog/sheet vượt khung nhìn.
  - Không có 2 vùng cuộn dọc lồng nhau gây kẹt thao tác.
  - Không nhồi bảng rộng (`>= 9` cột) vào khung chia đôi thấp (`< 420px`) gây tràn ngang lớn.
  - Không dùng thẻ `<select>` hoặc `<table>` HTML thô ngoài component chuẩn của hệ thống.

### Lớp 2 - Đọc & Chấm Điểm Ảnh Chụp Đặt Cạnh Màn Mẫu (`Side-by-Side Screenshot Critique`)

Ảnh chụp không dùng để minh họa suông. Agent kiểm định bắt buộc mở đọc trực tiếp các tệp ảnh `.png` vừa chụp (`exemplar-*.png` và `target-*.png`) và đối chiếu theo `../../frontend-development/references/ui-review-taxonomy.md` trên 5 tiêu chí:

1. **Cấu trúc khung & thanh công cụ**: đồng nhất tab, bộ lọc bước duyệt/trạng thái trên `TableToolbar` với màn mẫu anh em; không trộn thao tác chọn bộ lọc với tự bật modal tạo mới.
2. **Mật độ hiển thị**: khung chia đôi dưới hoặc dialog phải thoáng, không nhồi nhiều `Card` kèm bảng quá rộng.
3. **Định dạng bảng & số liệu**: cột mã dùng `ColumnCode`, tên + mã dùng `DoubleLineCell`, cột số/tiền gắn `tabular-nums` căn phải.
4. **Hành động & lớp nổi**: trang chi tiết gom nút vào `ActionStack`; hộp thoại/bảng lịch sử mở đúng `Sheet`/`Dialog` nằm gọn trong khung nhìn.
5. **Giá trị trống**: hiển thị `-` đồng nhất, không để ô trống hoặc lộ mã kỹ thuật.

Hễ còn lỗi hạng **Hỏng** hoặc **Lệch hệ** trên báo cáo DOM hoặc ảnh chụp thì trả về sửa ngay, cấm bàn giao sớm.

## 3. Lưu ý Cho Verifier

- Giữ nguyên cấu hình `allowed_paths: []` trong nhiệm vụ kiểm định; ghi script kiểm tra tạm vào `/tmp/playwright-ui-gate-<slug>.js` qua shell và chạy từ `.agent/skills/playwright-skill` (`node run.js /tmp/playwright-ui-gate-<slug>.js`), xóa script tạm sau khi xong.
