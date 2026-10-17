---
trigger: model_decision
description: "When optimizing algorithms, solving N+1 queries, selecting data structures (hash/lookup/caching), or performance tuning for PHP and MySQL."
---

# PERFORMANCE-DECISION-RULES.MD - Quy Tắc Hiệu Năng & Tối Ưu Hóa Cho PHP & MySQL

> Mục tiêu: Định hướng Agent cách phân tích, lựa chọn cấu trúc dữ liệu và tối ưu hóa truy vấn CSDL trong hệ thống PHP + PDO MySQL. Ngăn ngừa các vấn đề: Query N+1, cạn kiệt bộ nhớ RAM (`memory_limit`), chậm CSDL do quét bảng toàn bộ (Table Scan), và tải dữ liệu dư thừa.

---

## 1. Ma Trận Tối Ưu Hóa Cốt Lõi

### 1.1. Hashing & Tra Cứu $O(1)$ Trong PHP
*   **Vấn đề:** Quét mảng lặp đi lặp lại hoặc các vòng lặp lồng nhau có độ phức tạp $O(n^2)$ để tìm phần tử liên kết.
*   **Quy chuẩn áp dụng:**
    *   Sử dụng mảng kết hợp (Associative Array) trong PHP để tra cứu nhanh theo khóa trong $O(1)$ qua `isset($map[$key])` hoặc `$map[$key] ?? null`.
    *   **Import / Xử lý dữ liệu hàng loạt:** *BẮT BUỘC* truy vấn toàn bộ dữ liệu tham chiếu (Danh mục, Tour, Khách hàng...) ra trước vòng lặp, đưa vào mảng kết hợp `$lookupMap[$code] = $id` và tra cứu trong $O(1)$ khi xử lý từng dòng. Nghiêm cấm chạy câu query PDO bên trong vòng lặp.

### 1.2. B-Tree Index & Truy Vấn MySQL
*   **Vấn đề:** Tìm kiếm phần tử trên tập dữ liệu lớn không có Index khiến MySQL phải thực hiện Full Table Scan ($O(n)$), gây nghẽn CPU và I/O đĩa.
*   **Quy chuẩn áp dụng:**
    *   Đảm bảo các trường tìm kiếm chính và lọc thường xuyên (ví dụ: `status`, `category_id`, `created_at`, `code`) đã được đánh Index trong MySQL.
    *   Các trường khóa ngoại (`FOREIGN KEY`) liên kết bảng bắt buộc phải có Index.
    *   Khi viết câu query phức tạp, sử dụng `EXPLAIN SELECT ...` để kiểm tra `type` và `key` xem MySQL có sử dụng Index hiệu quả hay không (tránh `type: ALL`).

### 1.3. Phòng Chống Truy Vấn N+1 (N+1 Query Prevention) - MUST
*   **Vấn đề:** Truy vấn danh sách cha, sau đó với mỗi bản ghi cha lại chạy thêm 1 câu query để lấy thông tin con (ví dụ: lấy 50 tour, sau đó chạy 50 câu query để lấy ảnh đại diện của từng tour).
*   **Quy chuẩn áp dụng:**
    *   **TUYỆT ĐỐI CẤM** gọi câu lệnh PDO `$stmt->execute()` bên trong vòng lặp `foreach` hoặc `while`.
    *   *Giải pháp 1 (JOIN)*: Kết hợp các bảng ngay trong câu lệnh `SELECT ... LEFT JOIN ...`.
    *   *Giải pháp 2 (Query Batching)*: Lấy toàn bộ danh sách cha, thu thập danh sách IDs (`$ids = array_column($tours, 'id')`), rồi chạy 1 câu query duy nhất:
        `SELECT * FROM tour_images WHERE tour_id IN (?, ?, ...)`. Sau đó dùng PHP nhóm lại theo `tour_id`.

### 1.4. Phân Trang (Pagination) Bảng Dữ Liệu Lớn - MUST
*   **Vấn đề:** Chạy `SELECT *` lấy toàn bộ hàng nghìn bản ghi vào bộ nhớ PHP làm vượt ngưỡng `memory_limit` và kéo dài thời gian tải trang.
*   **Quy chuẩn áp dụng:**
    *   Đối với mọi trang danh sách (bài viết, tour, liên hệ, ảnh), bắt buộc áp dụng phân trang với `LIMIT :limit OFFSET :offset`.
    *   Kết hợp câu lệnh phân trang với `ORDER BY` trên cột đã có Index (ví dụ `id` hoặc `created_at`) để MySQL tối ưu việc duyệt bản ghi.

### 1.5. Cắt Tỉa & Chọn Cột Cụ Thể (Pruning & Projection)
*   **Vấn đề:** Dùng `SELECT *` lấy cả những cột văn bản dài (`content`, `description`, `schedule_details`) khi chỉ cần hiển thị danh sách thẻ tóm tắt.
*   **Quy chuẩn áp dụng:**
    *   Chỉ chọn các cột cần thiết cho màn hình hiện tại:
        `SELECT id, title, thumbnail, price, status FROM tours WHERE status = 1 ORDER BY id DESC LIMIT 12`.
    *   Giảm tải đáng kể bộ nhớ RAM của PHP và băng thông mạng truyền tải giữa MySQL và máy chủ web.

### 1.6. Quản Lý Bộ Nhớ PHP (Memory Management)
*   **Vấn đề:** Đọc toàn bộ file ảnh, tài liệu hoặc file dữ liệu lớn vào một biến chuỗi làm sập tiến trình PHP (`Fatal error: Allowed memory size of ... bytes exhausted`).
*   **Quy chuẩn áp dụng:**
    *   Sử dụng cơ chế luồng (Streaming): Dùng `fopen()`, `fgetcsv()`, `readfile()`, `fpassthru()` khi đọc hoặc trả về file tải xuống.
    *   Khi xử lý batch dữ liệu lớn: Giải phóng biến trung gian bằng `unset($largeData)` và gán `$stmt = null` sau khi duyệt xong.

---

## 2. Ràng Buộc Kỹ Thuật Bắt Buộc

### 2.1. Backend PHP & PDO MySQL
1.  **Kiểm tra sự tồn tại bản ghi**: Khi chỉ muốn kiểm tra xem dữ liệu có tồn tại hay không, dùng `SELECT 1 FROM table WHERE ... LIMIT 1` và gọi `fetchColumn()`. Tuyệt đối không dùng `SELECT *` hoặc `COUNT(*)` trên toàn bảng rồi kiểm tra `> 0`.
2.  **Duyệt từng dòng với dữ liệu lớn**: Với các câu lệnh lấy số lượng bản ghi lớn để xử lý nền hoặc xuất file, dùng vòng lặp `while ($row = $stmt->fetch())` thay vì gọi `fetchAll()` nạp toàn bộ vào một mảng lớn trong RAM.
3.  **Prepared Statements**: Luôn dùng Prepared Statements để MySQL có thể tái sử dụng kế hoạch thực thi (execution plan) và đảm bảo an toàn tuyệt đối trước SQL Injection.

### 2.2. Frontend HTML, CSS & JavaScript
1.  **Hạn chế thao tác DOM liên tục**: Lưu cache các phần tử DOM vào biến thay vì gọi `document.querySelector()` lặp lại trong vòng lặp JavaScript.
2.  **Debounce các sự kiện nhanh**: Áp dụng debounce hoặc throttle cho các sự kiện kích hoạt liên tục như `scroll`, `resize`, hoặc `keyup` (khi người dùng gõ phím tìm kiếm tour/bài viết tức thì).
3.  **Tối ưu tải tài nguyên**: Đảm bảo hình ảnh được nén dung lượng hợp lý trước khi lưu và hiển thị; sử dụng thuộc tính `loading="lazy"` trên thẻ `<img>` cho các hình ảnh nằm ngoài khung nhìn đầu tiên (below the fold).
