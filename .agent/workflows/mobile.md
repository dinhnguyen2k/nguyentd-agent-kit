---
name: mobile
description: Tối ưu hóa hiển thị di động (Responsive Mobile Web) cho ứng dụng PHP
---

## 📱 Quy trình Tối ưu Giao diện Di động (Responsive Web)

> **Cảnh báo phạm vi**: Dự án hiện tại là ứng dụng Web PHP hiển thị giao diện phía server, không có dự án mobile native (React Native / Flutter / iOS / Android) riêng biệt. Quy trình này tập trung vào việc đảm bảo giao diện web tương thích hoàn hảo trên thiết bị di động (Mobile Web Responsive).

### 1. Thiết kế Mobile-First
- **Execution role**: `frontend-specialist`
- Đảm bảo thẻ `<meta name="viewport" content="width=device-width, initial-scale=1.0">` có mặt trong `layout/header.php`.
- Tối ưu kích thước vùng chạm (Touch Targets tối thiểu 44x44px cho buttons và links).
- Sử dụng CSS Media Queries linh hoạt trong `css/**` cho các breakpoint phổ biến (Mobile < 768px, Tablet 768px - 1024px).

### 2. Tối ưu Hiệu năng trên Mạng Di động
- **Execution role**: `frontend-specialist`
- Tối ưu hóa kích thước hình ảnh banner, tour thumbnail trong `images/**` (dùng WebP, lazy loading `loading="lazy"`).
- Giảm thiểu dung lượng file CSS và JS tải về client.

### 3. Kiểm thử Tương thích
- **Execution role**: `verifier`
- Kiểm tra hiển thị trên các độ phân giải màn hình khác nhau qua DevTools.
- Đảm bảo thanh điều hướng mobile (menu hamburger) đóng/mở mượt mà, không tràn ngang (horizontal overflow).
