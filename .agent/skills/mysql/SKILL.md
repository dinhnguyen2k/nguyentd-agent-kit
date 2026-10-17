---
name: mysql
description: Thiết kế lược đồ, chỉ mục, tối ưu hóa truy vấn và bảo mật CSDL MySQL cho ứng dụng PHP qua PDO. Use when designing MySQL tables, writing or optimizing SQL queries, adding indexes, or troubleshooting MySQL performance.
metadata:
  category: engineering
  version: 1.0.0
  layer: project-skill
---

# MySQL Database Skill

Kỹ năng hướng dẫn thiết kế lược đồ, lập chỉ mục (indexing), tối ưu hóa câu truy vấn và quản lý tương tác với cơ sở dữ liệu MySQL thông qua driver PDO trong ứng dụng PHP.

## Use this skill when

- Thiết kế bảng mới hoặc chỉnh sửa cấu trúc bảng MySQL trong dự án.
- Viết, sửa đổi hoặc tối ưu hóa các câu truy vấn SQL (`SELECT`, `INSERT`, `UPDATE`, `DELETE`).
- Lập chỉ mục (INDEX) để tăng tốc độ truy vấn danh sách, phân trang hoặc lọc dữ liệu tour/đơn hàng.
- Phân tích hiệu năng câu truy vấn bằng `EXPLAIN`.
- Xử lý các vấn đề về bảng mã ký tự tiếng Việt (`utf8mb4`), khóa ngoại (foreign keys) và toàn vẹn dữ liệu.

## Do not use this skill when

- Thao tác thuần túy với PostgreSQL (dự án hiện tại dùng MySQL; PostgreSQL chỉ áp dụng dạng opt-in khi có yêu cầu đặc thù).
- Xử lý mã nguồn PHP không liên quan đến cơ sở dữ liệu -> sử dụng `php-development`.
- Vấn đề hạ tầng quản trị server máy chủ nâng cao ngoài phạm vi repo code.

---

## 1. Xác thực Driver & Kết nối PDO MySQL

Dự án sử dụng driver PDO MySQL kết nối qua DSN:
```php
$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
```

### Nguyên tắc bảo vệ thông tin đăng nhập:
- **TUYỆT ĐỐI KHÔNG** in ra terminal hoặc ghi vào log các biến nhạy cảm (`$host`, `$user`, `$pass`, `$db`).
- Khi viết script kiểm tra hoặc bắt ngoại lệ `\PDOException`, chỉ ghi thông điệp lỗi chung hoặc mã lỗi SQLSTATE, không hiển thị chuỗi kết nối chứa mật khẩu.
- Bảng mã bắt buộc: Luôn sử dụng `utf8mb4` kết hợp collation `utf8mb4_unicode_ci` để hỗ trợ đầy đủ tiếng Việt có dấu và biểu tượng cảm xúc.

---

## 2. Tiêu chuẩn Thiết kế Bảng (Schema Design Invariants)

Khi thiết kế bảng cho ứng dụng (ví dụ: `tours`, `categories`, `bookings`, `news`, `users`):

### 2.1. Khóa chính & Kiểu dữ liệu
- **Khóa chính (Primary Key)**: Luôn có khóa chính số nguyên tự tăng:
  - Bảng nghiệp vụ thông thường: `INT UNSIGNED AUTO_INCREMENT PRIMARY KEY`.
  - Bảng dữ liệu lớn (logs, giao dịch): `BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY`.
- **Dữ liệu tiền tệ**: Bắt buộc dùng `DECIMAL(12, 2)` hoặc `DECIMAL(15, 2)`. **CẤM** dùng `FLOAT` hoặc `DOUBLE` cho giá tour/tiền thanh toán vì sai số dấu phẩy động.
- **Chuỗi văn bản**:
  - Chuỗi ngắn có giới hạn: `VARCHAR(255)` hoặc kích thước cụ thể (`VARCHAR(100)`, `VARCHAR(50)`).
  - Nội dung bài viết, mô tả dài: `TEXT` hoặc `MEDIUMTEXT`.
- **Ngày tháng**:
  - Dùng `DATETIME` hoặc `TIMESTAMP` với `DEFAULT CURRENT_TIMESTAMP` cho `created_at`.
  - `updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`.
- **Ràng buộc NOT NULL**: Đặt `NOT NULL` cho các cột bắt buộc phải có giá trị nghiệp vụ (tiêu đề, giá, mã định danh); gán giá trị mặc định `DEFAULT` hợp lý.

### 2.2. Khóa ngoại & Ràng buộc toàn vẹn
- Các cột tham chiếu sang bảng khác (ví dụ `category_id`, `tour_id`) phải khai báo đúng kiểu dữ liệu với bảng đích (ví dụ `INT UNSIGNED`).
- Đặt ràng buộc khóa ngoại (Foreign Key) với hành vi thích hợp:
  - `ON DELETE RESTRICT` (mặc định an toàn): Không cho phép xóa danh mục khi vẫn còn tour liên kết.
  - `ON DELETE CASCADE`: Tự động xóa các bản ghi phụ thuộc khi bản ghi cha bị xóa (ví dụ xóa đơn hàng thì xóa chi tiết đơn hàng).

---

## 3. Chiến lược Lập Chỉ mục (Indexing Strategy)

Thiếu chỉ mục là nguyên nhân phổ biến nhất gây chậm ứng dụng PHP khi dữ liệu tăng dần.

### 3.1. Các cột BẮT BUỘC có Index
1. **Khóa ngoại**: Mọi cột `*_id` liên kết giữa các bảng đều phải được lập index.
2. **Cột lọc trạng thái thường xuyên**: Ví dụ cột `status` (`active`/`inactive`), `type` (`trong-nuoc`/`nuoc-ngoai`).
3. **Cột sắp xếp & phân trang**: Cột dùng trong `ORDER BY` như `created_at`, `price`, `id`.

### 3.2. Chỉ mục kết hợp (Composite Index)
Khi câu truy vấn thường xuyên lọc theo nhiều điều kiện đồng thời, sử dụng Composite Index tuân theo quy tắc **Leftmost Prefix**:
- Đặt các cột so sánh bằng (`=`) lên trước.
- Đặt các cột khoảng (`<`, `>`, `BETWEEN`, `LIKE`) hoặc sắp xếp (`ORDER BY`) ở sau.

*Ví dụ*:
Truy vấn: `SELECT * FROM tours WHERE type = 'trong-nuoc' AND status = 'active' ORDER BY created_at DESC LIMIT 10;`
Chỉ mục tối ưu:
```sql
CREATE INDEX idx_tours_type_status_created ON tours (type, status, created_at DESC);
```

---

## 4. Tối ưu hóa Câu truy vấn (Query Optimization)

### 4.1. Phân tích truy vấn với EXPLAIN
Khi nghi ngờ câu truy vấn chạy chậm, chạy `EXPLAIN` trên MySQL:
```sql
EXPLAIN SELECT id, title, price FROM tours WHERE category_id = 5 ORDER BY price ASC LIMIT 10;
```
Dấu hiệu cần tối ưu:
- `type: ALL`: Quét toàn bộ bảng (Table Scan) -> Cần bổ sung INDEX cho các cột trong `WHERE`.
- `Extra: Using filesort`: Phải sắp xếp ngoài bộ nhớ -> Cần đưa cột `ORDER BY` vào composite index.
- `Extra: Using temporary`: Tạo bảng tạm trên đĩa -> Cần tối ưu lại phép `JOIN` hoặc `GROUP BY`.

### 4.2. Tránh `SELECT *`
Chỉ chọn các cột cần thiết cho giao diện hiển thị:
```php
// KHÔNG NÊN: Lấy toàn bộ cột kể cả trường TEXT dung lượng lớn
$stmt = $pdo->query("SELECT * FROM tours");

// NÊN: Chỉ lấy các cột cần dùng cho danh sách
$stmt = $pdo->prepare("SELECT id, title, slug, price, duration, image FROM tours WHERE status = 'active' LIMIT :limit");
```

### 4.3. Phân trang an toàn với LIMIT và OFFSET
Khi bind tham số phân trang qua PDO, luôn ép kiểu số nguyên để tránh lỗi cú pháp MySQL:
```php
$stmt = $pdo->prepare("SELECT id, title, price FROM tours ORDER BY id DESC LIMIT :limit OFFSET :offset");
$stmt->bindValue(':limit', (int)$itemsPerPage, PDO::PARAM_INT);
$stmt->bindValue(':offset', (int)$offset, PDO::PARAM_INT);
$stmt->execute();
```

---

## 5. Danh mục Kiểm tra An toàn CSDL (DoD Checklist)

Trước khi hoàn tất bất kỳ thay đổi nào liên quan đến CSDL:
- [ ] Dữ liệu người dùng được truyền qua tham số bind của PDO, không bao giờ nối chuỗi SQL trực tiếp.
- [ ] Bảng và cột có kiểu dữ liệu phù hợp (tiền tệ dùng `DECIMAL`, ngày tháng dùng `DATETIME`).
- [ ] Khóa ngoại và các cột trong mệnh đề `WHERE` / `ORDER BY` đã được đánh chỉ mục.
- [ ] Xử lý giao dịch (`beginTransaction`/`commit`/`rollBack`) cho mọi chuỗi thao tác ghi nhiều bảng.
- [ ] Không rò rỉ thông tin đăng nhập CSDL trong log hay thông báo lỗi trả về cho client.
- [ ] Khi chạy kiểm thử tự động tương tác CSDL, bắt buộc sử dụng CSDL kiểm thử riêng biệt (dedicated test database), tuyệt đối không chạy script test phá hủy trên CSDL phát triển hay sản xuất.
