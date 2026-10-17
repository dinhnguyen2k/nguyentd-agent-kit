---
name: performance
description: Tối ưu hóa tốc độ tải trang và hiệu năng cho ứng dụng PHP / MySQL
---

# /performance - Speed & Efficiency Optimization

$ARGUMENTS

---

## 🟢 PHASE 1: Baseline Profiling
**Execution role**: `orchestrator` & `verifier`
**Nhiệm vụ**: Đo lường hiện trạng hiệu năng ban đầu.
- Kiểm tra thời gian phản hồi máy chủ (TTFB - Time to First Byte) trên các trang chính (`index.php`, `tour-detail.php`).
- Phân tích Network Waterfall: dung lượng trang, số lượng request CSS/JS/hình ảnh.
- Ghi nhận các chỉ số Core Web Vitals (LCP, CLS, FID/INP).

## 🟡 PHASE 2: Bottleneck Identification
**Execution role**: `backend-specialist` & `frontend-specialist`
**Nhiệm vụ**: Xác định nút thắt cổ chai gây chậm hệ thống.
- **Backend / Database**:
  - Truy vấn MySQL chậm (thiếu index trên các cột `status`, `noi_bat`, `category_id`, `slug`).
  - Vấn đề N+1 query: Lặp câu lệnh query PDO trong vòng lặp `foreach` thay vì gộp truy vấn hoặc dùng `JOIN`.
  - Truy vấn `SELECT *` lấy thừa dữ liệu các trường text/blob lớn không cần thiết trong danh sách.
- **Frontend / Assets**:
  - Ảnh kích thước quá lớn, chưa nén hoặc chưa chuyển sang định dạng WebP trong `images/**`.
  - File CSS/JS chưa được tối ưu hoặc nạp chặn hiển thị (render-blocking).

## 🔵 PHASE 3: Surgical Optimization
**Execution role**: `backend-specialist` & `frontend-specialist`
**Nhiệm vụ**: Triển khai tối ưu hóa có trọng tâm:
- **Backend**:
  - Thêm index MySQL phù hợp cho các cột tìm kiếm và lọc.
  - Tối ưu hóa câu truy vấn PDO, dùng câu lệnh JOIN thay thế các truy vấn lồng nhau.
  - Tận dụng OPcache của PHP trên server.
- **Frontend**:
  - Thêm thuộc tính `loading="lazy"` cho hình ảnh dưới màn hình đầu tiên (below the fold).
  - Tối ưu cấu trúc CSS trong `css/**`, nạp script không đồng bộ (`defer` hoặc đặt ở cuối thẻ `body`).

## 🔴 PHASE 4: Delta Verification & Reporting
**Execution role**: `verifier`
**Nhiệm vụ**: Chứng minh hiệu quả sau tối ưu.
- So sánh thời gian tải trang và số lượng query trước vs sau khi tối ưu.
- Báo cáo kết quả và số liệu cụ thể trong `walkthrough.md`.

---

## Mục tiêu Hiệu năng:
- **TTFB**: < 300ms đối với môi trường server có CSDL.
- **LCP**: < 2.5s trên thiết bị di động.
- **Tối ưu CSDL**: Không có truy vấn N+1 lặp trong vòng lặp render PHP.

---

## Ví dụ:
- `/performance audit tour listing page speed`
- `/performance optimize mysql queries for search`
- `/performance compress and optimize images`
