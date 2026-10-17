---
trigger: model_decision
description: "When validating frontend and PHP UI changes, choosing between PHP syntax lint, browser/DOM checks, and asset path verification."
---

# FRONTEND-FASTCHECK.MD - ON-DEMAND ONLY (Kiểm Tra Giao Diện & Template PHP)

> Mục tiêu: Hướng dẫn các phương thức kiểm tra giao diện server-rendered PHP, CSS, JS an toàn và có sẵn trong dự án.
>
> ⚠️ **CẤM TUYỆT ĐỐI**: Không bao giờ gợi ý, tìm kiếm hoặc chạy script hư cấu `./frontend/fast-check.sh`. Script đó không tồn tại trong hệ thống.

---

## 1. Nguyên Tắc ON-DEMAND ONLY (BẮT BUỘC)

1. **KHÔNG CHẠY TỰ ĐỘNG**:
   - Tuyệt đối không tự ý chạy các lệnh lint, validate, browser check hoặc test tự động sau khi sửa code.
   - Các từ khóa như `fix`, `implement`, `xong`, `đã sửa` hoặc trạng thái bàn giao bình thường **KHÔNG** cấp quyền chạy lệnh kiểm tra.
2. **Chỉ chạy khi có yêu cầu rõ ràng**:
   - Chỉ thực thi lệnh kiểm tra khi người dùng nêu đích danh yêu cầu như: `lint`, `check cú pháp`, `verify`, `kiểm tra giao diện`.
3. **Tính Idempotent**:
   - Khi đã được yêu cầu kiểm tra, chỉ chạy lệnh đúng 1 lần cho trạng thái mã nguồn hiện tại. Không lặp lại cùng một lệnh khi code chưa thay đổi.

---

## 2. Các Công Cụ Kiểm Tra Thực Tế Trong Dự Án

### Nấc 1: Kiểm Tra Cú Pháp PHP Template (`php -l`)
- **Mục đích**: Phát hiện lỗi cú pháp, thiếu dấu chấm phẩy, quên đóng ngoặc trong file PHP view/template.
- **Lệnh**: `php -l <path/to/file.php>` (ví dụ: `php -l layout/header.php` hoặc `php -l admin/tour/index.php`).
- **Điều kiện môi trường runtime**:
  - Lệnh này **chỉ thực hiện được khi CLI `php` đã được cài đặt trên môi trường/máy chủ**.
  - Nếu môi trường chưa có binary `php` (ví dụ trong container rút gọn chỉ có Node.js), Agent **KHÔNG ĐƯỢC** gọi lệnh `php` dẫn đến lỗi `command not found`, mà chuyển sang rà soát cú pháp tĩnh bằng mắt/đọc file.

### Nấc 2: Kiểm Tra Đường Dẫn Tài Nguyên Tĩnh (Asset Path Verification)
- **Mục đích**: Phát hiện liên kết hỏng (404) của file CSS, JavaScript, hình ảnh hoặc font chữ.
- **Cách thực hiện**:
  - Đọc file PHP template và rà soát các thẻ:
    - `<link rel="stylesheet" href="...">`
    - `<script src="...">`
    - `<img src="...">`
  - Đối chiếu đường dẫn với các tệp thực tế nằm trong `css/`, `js/`, `images/`, `uploads/`. Đảm bảo đường dẫn chính xác cho cả trang root và trang con trong `admin/`.

### Nấc 3: Kiểm Tra Trình Duyệt & Console (Browser & DOM Check)
- **Mục đích**: Kiểm tra giao diện render thực tế trên trình duyệt và các lỗi JavaScript tại console.
- **Cách thực hiện**:
  - Kiểm tra DOM tree được sinh ra từ PHP có thẻ HTML hợp lệ, không bị lồng thẻ sai quy cách.
  - Mở Developer Tools Console kiểm tra xem có lỗi JavaScript runtime, lỗi cú pháp hoặc cảnh báo thư viện (như jQuery, CKEditor) hay không.

---

## 3. Trạng Thái Bàn Giao (Handoff Status)

- Sau khi hoàn thành sửa đổi mã nguồn: `Status: implemented`.
- Khi người dùng không yêu cầu chạy kiểm tra: `Validation: not run - not requested`.
- Khi người dùng yêu cầu kiểm tra và đã có kết quả cụ thể: `Status: verified`.
- **TUYỆT ĐỐI KHÔNG** chặn bàn giao mã nguồn chỉ vì chờ đợi một bước kiểm tra không được yêu cầu.
