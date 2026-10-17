---
name: status
description: Báo cáo trạng thái và tiến độ tổng thể của dự án
---

# /status - Executive Project Dashboard

$ARGUMENTS

---

## 🟢 PHASE 1: Data Aggregation
**Execution role**: `orchestrator`
**Nhiệm vụ**: Thu thập thông tin tiến độ và hiện trạng dự án.
- Đọc các tài liệu tiến độ: `task.md`, `walkthrough.md`, và `ERRORS.md`.
- Kiểm tra `git status` và các commit gần nhất để nắm bắt các thay đổi mới.

## 🟡 PHASE 2: Health & Risk Assessment
**Execution role**: `orchestrator`
**Nhiệm vụ**: Đánh giá sức khỏe dự án.
- Các mục tiêu chính của tác vụ đã hoàn thành đến đâu?
- Có lỗi kỹ thuật tồn đọng trong `ERRORS.md` chưa được giải quyết dứt điểm không?
- Kế hoạch hiện tại có đang bám sát cấu trúc của dự án không?

## 🔵 PHASE 3: Dashboard Synthesis
**Execution role**: `orchestrator`
**Nhiệm vụ**: Tổng hợp bảng điều khiển trạng thái trực quan:
- Hiển thị danh sách các phân hệ chính (Frontend / Backend / Database / Admin).
- Thống kê tỷ lệ hoàn thành, số lượng file đã chỉnh sửa.

## 🔴 PHASE 4: Executive Reporting
**Execution role**: `verifier`
**Nhiệm vụ**: Báo cáo tổng kết súc tích cho người dùng:
- Tóm tắt ngắn gọn: Đã làm được gì, điểm nghẽn (nếu có), và bước tiếp theo cần triển khai.

---

## Chỉ báo Trạng thái (Status Indicators):
- 🟢 **Healthy**: Đang đi đúng hướng, không có blocker kỹ thuật.
- 🟡 **Warning**: Có rủi ro nhỏ, cần xác nhận thêm thông tin hoặc kiểm tra thêm.
- 🔴 **Blocked**: Thiếu thông tin bắt buộc, lỗi nghiêm trọng cần xử lý trước.

---

## Ví dụ:
- `/status`
- `/status focus on database and admin`
- `/status show recent errors`
