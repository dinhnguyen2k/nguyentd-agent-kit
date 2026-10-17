---
name: enhance
description: Nâng cấp, tinh chỉnh giao diện hoặc bổ sung logic nhỏ cho ứng dụng PHP
---

# /enhance - Incremental Feature Upgrade

$ARGUMENTS

---

## 🟢 PHASE 1: Impact Discovery
**Execution role**: `frontend-specialist` hoặc `backend-specialist`
**Nhiệm vụ**: Xác định phạm vi ảnh hưởng của thay đổi ("Blast Radius").
- Rà soát các file PHP, template trong `layout/**`, và style trong `css/**` bị tác động.
- Kiểm tra tính tương thích CSS và logic hiển thị hiện có.

## 🟡 PHASE 2: Enhancement Plan
**Execution role**: `orchestrator`
**Nhiệm vụ**: Lập kế hoạch thay đổi ngắn gọn.
- Tạo kế hoạch ngắn gọn trong `task.md`.
- Với các thay đổi lớn về trải nghiệm người dùng, có thể cân nhắc `/brainstorm` trước.

## 🔵 PHASE 3: Surgical Implementation
**Execution role**: `frontend-specialist` (giao diện, CSS, JS) hoặc `backend-specialist` (logic PHP, query)
**Nhiệm vụ**: Triển khai thay đổi tinh gọn và nhất quán:
- Tôn trọng phong cách thiết kế hiện tại của website (màu sắc chủ đạo, font chữ, layout container).
- Viết CSS vào file thích hợp trong `css/**`, JS vào `js/**`.
- Không làm gián đoạn các biến dữ liệu PHP đang được truyền vào template.

## 🔴 PHASE 4: Professional Verification
**Execution role**: `verifier` & `test-author`
**Nhiệm vụ**: Xác minh thay đổi.
- Kiểm tra hiển thị qua `/preview` (lưu ý điều kiện runtime PHP và database).
- Đảm bảo không phát sinh lỗi hiển thị hoặc lỗi cú pháp PHP.
- Cập nhật tài liệu thay đổi trong `walkthrough.md`.

---

## Nguyên tắc Nâng cấp:
- **Không phá vỡ (Non-Destructive)**: Thêm mới hoặc cải tiến mà không làm hỏng tính năng đang hoạt động.
- **Nhất quán UI**: Thành phần mới phải hài hòa với giao diện tổng thể của website Long Phát.
- **Tối giản**: Không đưa thêm framework hay thư viện nặng nề không cần thiết.

---

## Ví dụ:
- `/enhance add filter by price range in tour list`
- `/enhance update header hotline and social links`
- `/enhance add responsive mobile hamburger menu`
