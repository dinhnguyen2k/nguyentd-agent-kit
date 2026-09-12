---
trigger: model_decision
description: "When optimizing algorithms, solving N+1 queries, selecting data structures (hash/binary search/caching), or performance tuning."
---

# Performance-Decision-Rules - Quy Tắc Ra Quyết Định & Tối Ưu Hóa Thuật Toán

> **Mục tiêu**: Định hướng Agent cách phân tích, lựa chọn thuật toán và cấu trúc dữ liệu tối ưu nhất trước khi triển khai mã nguồn tại hệ thống `cogain-core`. Ngăn ngừa các vấn đề về hiệu năng (Query N+1, nghẽn luồng xử lý, rò rỉ bộ nhớ, treo DB).

---

## 🧭 1. MA TRẬN QUYẾT ĐỊNH (7 THUẬT TOÁN TỐI ƯU CỐT LÕI)

Agent BẮT BUỘC phải đối chiếu nghiệp vụ cần triển khai với 7 kỹ thuật tối ưu hóa sau:

### 1.1. Hashing (Dictionary / HashSet / Map / Set)
*   **Vấn đề:** Quét mảng lặp đi lặp lại hoặc các vòng lặp lồng nhau có độ phức tạp $O(n^2)$ hoặc $O(n)$ để tìm phần tử tồn tại/liên kết.
*   **Quy chuẩn áp dụng:**
    *   **Backend (.NET):** Dùng `Dictionary<TKey, TValue>` hoặc `HashSet<T>` để tra cứu trong $O(1)$.
    *   **Frontend (React/TS):** Dùng `Map` hoặc `Set` cho tra cứu nhanh (ví dụ: danh sách vai trò, danh sách phân quyền).
    *   **Import Excel (ClosedXML):** *BẮT BUỘC* truy vấn toàn bộ dữ liệu tham chiếu (MasterData, Projects, Employees...) ra trước vòng lặp, đưa vào Dictionary và tra cứu $O(1)$ khi xử lý dòng. Nghiêm cấm query DB hoặc gọi gRPC trong vòng lặp parse Excel.

### 1.2. Binary Search (Tìm kiếm nhị phân & B-Tree Index)
*   **Vấn đề:** Tìm kiếm phần tử trên tập dữ liệu lớn không có Index khiến CSDL phải thực hiện Table Scan ($O(n)$).
*   **Quy chuẩn áp dụng:**
    *   Khi thiết lập các trường tìm kiếm chính (ví dụ: `Code`, `DeletedDate`, `Status`), bắt buộc cấu hình Index trong file `Configuration.cs` của EF Core.
    *   Cấu hình Filtered Index cho cơ chế xóa mềm:
        ```csharp
        builder.HasIndex(x => x.Code)
               .HasFilter("\"deleted_date\" IS NULL")
               .IsUnique();
        ```
    *   Truy vấn phải đảm bảo đi qua các trường đã được đánh Index.

### 1.3. Prefix Sum (Mảng cộng dồn)
*   **Vấn đề:** Tính toán lũy kế / tổng tích lũy cho một khoảng thời gian hoặc một đoạn dữ liệu lặp đi lặp lại.
*   **Quy chuẩn áp dụng:**
    *   **CSDL:** Ưu tiên dùng Window Function của PostgreSQL (`SUM() OVER (ORDER BY)`) để tính lũy kế tại tầng DB thay vì kéo hết về memory rồi dùng vòng lặp cộng dồn.
    *   **Workflow SLA:** Khi tính thời gian xử lý còn lại tại mỗi bước duyệt của WorkItem, tiền xử lý và lưu trữ mốc thời gian tĩnh để truy xuất ngay trong $O(1)$.

### 1.4. Sliding Window (Cửa sổ trượt)
*   **Vấn đề:** Tính toán lại toàn bộ khoảng dữ liệu liên tục hoặc hiển thị danh sách khổng lồ làm nghẽn DOM / API.
*   **Quy chuẩn áp dụng:**
    *   **Frontend UI:** Đối với các bảng dữ liệu chi tiết lệnh sản xuất hoặc danh mục có số lượng dòng lớn (> 100), áp dụng kỹ thuật Virtual Scrolling (chỉ render các dòng hiển thị trong vùng nhìn thấy).
    *   **Rate Limiting:** Sử dụng Redis Sorted Set để triển khai sliding window giới hạn số lượng request API của Client theo thời gian thực (tránh brute force hoặc dồn ứ request).

### 1.5. Dynamic Programming & Memoization (Quy hoạch động & Caching)
*   **Vấn đề:** Tính toán lại các kết quả của các bài toán con lặp lại nhiều lần (ví dụ: phân bổ ngân sách, lập lịch sản xuất, tính toán sơ đồ cây tổ chức/phân quyền).
*   **Quy chuẩn áp dụng:**
    *   Sử dụng Redis (Cache phân tán) hoặc `MemoryCache` (Cục bộ tại API) cho các phép tính đắt đỏ.
    *   Thiết lập cơ chế tự động xóa/reset cache (Cache Eviction) khi dữ liệu nguồn thay đổi thông qua Redis Publish/Subscribe hoặc gRPC compensation.

### 1.6. Heap / Priority Queue (Hàng đợi ưu tiên)
*   **Vấn đề:** Quản lý công việc hoặc xử lý tác vụ tuần tự mà không có sự phân biệt về độ khẩn cấp (SLA).
*   **Quy chuẩn áp dụng:**
    *   Dùng `PriorityQueue<TElement, TPriority>` của .NET 8 để quản lý các tác vụ nền (background tasks) tại service như: gửi thông báo khẩn cấp duyệt WorkItem, xử lý lệnh sản xuất độ ưu tiên cao.
    *   Tránh việc sắp xếp lại toàn bộ danh sách mỗi lần chèn phần tử mới ($O(n \log n)$), thay vào đó chèn và lấy ra trong $O(\log n)$ qua Heap.

### 1.7. Pruning (Cắt tỉa & Tiền lọc)
*   **Vấn đề:** Duyệt qua các nhánh vô ích hoặc tải quá nhiều dữ liệu thừa từ DB.
*   **Quy chuẩn áp dụng:**
    *   **SQL Query:** Luôn đặt các điều kiện lọc `WHERE` chặt chẽ và sớm nhất có thể. Sử dụng `.Select()` để chỉ lấy các trường DTO cần thiết, không dùng `Select *` hoặc lấy nguyên Entity khi chỉ cần xem danh sách.
    *   **Workflow/Graph Traversal:** Khi duyệt tìm đường đi hoặc quyền hạn trong sơ đồ duyệt Workflow sâu, nếu một nút cha không thỏa mãn điều kiện, cắt tỉa ngay toàn bộ nhánh con của nút đó (`early exit`).

---

## ⚡ 2. RÀNG BUỘC KỸ THUẬT BẮT BUỘC (MANDATORY TECHNICAL GUIDELINES)

### 2.1. Backend C# & EF Core
1.  **AsNoTracking:** Luôn thêm `.AsNoTracking()` cho tất cả các câu truy vấn GET (Read-only) để tránh EF Core theo dõi trạng thái thực thể, giảm tải RAM và CPU.
2.  **Tránh Query N+1:** Tuyệt đối không dùng vòng lặp để truy vấn DB. Sử dụng `.Include()` (Eager Loading) hoặc gom danh sách IDs lại và query `WHERE Id IN (ids)` (Query Batching).
3.  **Split Queries:** Đối với các truy vấn kết hợp nhiều `.Include()` trên các collection lớn, sử dụng `.AsSplitQuery()` để tránh bị nhân dòng (Cartesian Explosion) ở SQL.
4.  **DbSet.AnyAsync() vs CountAsync():** Khi chỉ muốn kiểm tra sự tồn tại của dữ liệu, sử dụng `AnyAsync()` để Postgres trả về True/False ngay lập tức, tuyệt đối không dùng `CountAsync() > 0` hoặc `.ToListAsync()`.

### 2.2. Frontend React / Zustand / TanStack Query
1.  **Stable Query Keys:** Đảm bảo key của `useQuery` luôn nhất quán để tận dụng tối đa cơ chế cache của TanStack Query, tránh fetch lại dữ liệu không cần thiết.
2.  **Memoize Computations:** Sử dụng `useMemo` cho các hàm biến đổi dữ liệu, filter mảng phức tạp tại client, và `useCallback` cho các event handler truyền xuống component con để giảm re-render.
3.  **Clean State Updates:** Không cập nhật Zustand store hoặc Local state liên tục trong vòng lặp hoặc các sự kiện scroll/resize mà không có `debounce`/`throttle`.

