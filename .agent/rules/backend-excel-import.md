---
trigger: glob
glob: "**/*{excel,import,export,spreadsheet,csv}*.php"
description: "Quy tắc import/export dữ liệu bảng tính (CSV, Excel) trong PHP: kiểm tra dung lượng, streaming theo dòng, tra cứu $O(1)$, PDO transaction và chống CSV injection."
---

# BACKEND-EXCEL-IMPORT.MD - Quy Tắc Import/Export Dữ Liệu Bảng Tính Trong PHP

> Mục tiêu: Chuẩn hóa quy trình import và export dữ liệu bảng tính (CSV hoặc Excel) trong ứng dụng PHP, đảm bảo an toàn bộ nhớ, hiệu năng truy vấn CSDL và bảo mật.
> 
> *Lưu ý phụ thuộc*: Hiện tại ứng dụng chưa cài đặt thư viện bảng tính như `phpoffice/phpspreadsheet` (Composer chỉ có `phpmailer/phpmailer ^6.10`). Ưu tiên xử lý định dạng CSV qua các hàm chuẩn của PHP (`fgetcsv`, `fputcsv`). Chỉ sử dụng Excel (`.xlsx`) khi người dùng yêu cầu rõ ràng và đã cài đặt thư viện tương ứng.

---

## 1. Xác Thực Định Dạng & Dung Lượng File Đầu Vào

1. **Kiểm tra file upload**:
   - Xác thực đuôi file hợp lệ (`.csv` hoặc `.xlsx`).
   - Kiểm tra MIME type thực tế bằng `finfo_file` (ví dụ `text/csv`, `text/plain`, hoặc `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`).
   - Giới hạn dung lượng tối đa (ví dụ không quá 5MB - 10MB) để tránh làm cạn kiệt bộ nhớ PHP (`memory_limit`).
2. **Xác thực Header dòng tiêu đề**:
   - Luôn đọc và kiểm tra dòng header đầu tiên của file trước khi duyệt dữ liệu.
   - So khớp các cột bắt buộc. Nếu thiếu cột quan trọng, dừng ngay (fail-fast) và thông báo lỗi rõ ràng cho người dùng.

---

## 2. Hiệu Năng & Bộ Nhớ: Xử Lý Theo Dòng (Streaming)

1. **Không nạp toàn bộ file lớn vào bộ nhớ**:
   - Với file CSV: Dùng `fopen()` kết hợp vòng lặp `while (($row = fgetcsv($handle, 4096, ',')) !== false)` để đọc từng dòng.
   - Luôn đóng con trỏ file (`fclose($handle)`) trong khối `finally` hoặc sau khi xử lý xong.
2. **Gom tra cứu tham chiếu trước vòng lặp (Lookups $O(1)$) - MUST**:
   - **TUYỆT ĐỐI CẤM** chạy câu truy vấn PDO `SELECT` bên trong vòng lặp đọc từng dòng của file (gây lỗi truy vấn $N+1$, làm treo server khi file có hàng nghìn dòng).
   - *Cách làm đúng*:
     - Thu thập toàn bộ các mã/ID tham chiếu (ví dụ: mã danh mục, mã tour, mã khách hàng) từ file hoặc truy vấn toàn bộ danh mục hiện có vào một mảng băm PHP:
       `$categoryMap = ['TOURN_01' => 1, 'TOURN_02' => 2];`
     - Trong vòng lặp đọc từng dòng, tra cứu ID qua mảng băm: `$catId = $categoryMap[$rowCode] ?? null;` (đạt độ phức tạp $O(1)$).

---

## 3. Quản Lý Giao Dịch CSDL (PDO Transactions)

1. **Transaction an toàn cho toàn bộ đợt Import**:
   - Đợt import nhiều dòng dữ liệu BẮT BUỘC phải bọc trong một PDO transaction:
     ```php
     $pdo->beginTransaction();
     try {
         $stmt = $pdo->prepare('INSERT INTO tours (title, price, category_id) VALUES (?, ?, ?)');
         while (($row = fgetcsv($handle)) !== false) {
             // Validate dòng dữ liệu
             $stmt->execute([$row[0], $row[1], $row[2]]);
         }
         $pdo->commit();
     } catch (\Throwable $e) {
         if ($pdo->inTransaction()) {
             $pdo->rollBack();
         }
         throw $e;
     }
     ```
2. **Batch Insert khi dữ liệu lớn**:
   - Với số lượng bản ghi lớn, có thể gom nhóm insert theo từng batch (ví dụ 100 - 500 bản ghi mỗi câu lệnh) để tối ưu hóa thời gian thực thi.

---

## 4. Báo Lỗi Chi Tiết Theo Dòng (Error Reporting)

1. **Thông tin lỗi cụ thể**:
   - Khi phát hiện dữ liệu không hợp lệ ở một dòng, thông báo lỗi phải nêu rõ: **Số thứ tự dòng**, **Tên cột/trường bị sai**, và **Lý do lỗi cụ thể** (ví dụ: `Dòng 15: Giá tour không phải là số hợp lệ`, `Dòng 24: Mã danh mục 'ABC' không tồn tại`).
2. **Chiến lược xử lý lỗi**:
   - Mặc định áp dụng *All-or-Nothing*: Nếu có bất kỳ dòng nào sai dữ liệu nghiệp vụ nghiêm trọng, rollback toàn bộ và thông báo danh sách các dòng lỗi để người dùng sửa file trước khi import lại.

---

## 5. An Toàn Bảo Mật & Chống CSV/Formula Injection

1. **Chống CSV Injection khi Export**:
   - Khi xuất dữ liệu ra file CSV mà các trường có nguồn gốc từ người dùng nhập, nếu ô dữ liệu bắt đầu bằng các ký tự công thức (`=`, `+`, `-`, `@`), phần mềm bảng tính (Excel/Calc) có thể tự động thực thi mã lệnh nguy hiểm.
   - Bắt buộc xử lý: Nếu ký tự đầu tiên là một trong các ký tự trên, hãy thêm một dấu nháy đơn `'` ở đầu chuỗi (ví dụ: `"'=" . $value`) trước khi ghi ra file.
2. **Chống Path Traversal**:
   - File tải lên phải được lưu với tên ngẫu nhiên an toàn trong thư mục tạm, không dùng lại tên gốc từ client để tránh tấn công ghi đè file hệ thống.
