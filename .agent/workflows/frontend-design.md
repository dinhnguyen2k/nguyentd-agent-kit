---
name: frontend-design
description: "Thiết kế và hoàn thiện giao diện Frontend cho ứng dụng PHP (HTML/CSS/JS/Layout)"
---

# /frontend-design - Orchestrated Frontend Design System

$ARGUMENTS

---

## 🟢 PHASE 1: Context & Design Discovery
**Execution role**: `frontend-specialist`
**Nhiệm vụ**: Chốt bối cảnh và yêu cầu giao diện trước khi triển khai.
- Xác định luồng người dùng (user flow), cấu trúc trang, và độ ưu tiên responsive (mobile-first).
- Rà soát conventions của repo: Server-rendered HTML, template trong `layout/**` (header, footer, nav), styles tùy biến trong `css/**`, script trong `js/**`, ảnh trong `images/**`.
- Tránh đưa vào các framework/thư viện client-side phức tạp không phù hợp với kiến trúc PHP thuần hiện tại.
- Xác định hướng thiết kế trực quan và danh sách rủi ro (a11y/responsive/hiệu năng).

## 🟡 PHASE 2: Design Blueprint (UI Spec)
**Execution role**: `frontend-specialist` & `orchestrator`
**Nhiệm vụ**: Tạo blueprint có thể triển khai cụ thể.
- Output: `UI-SPEC-<slug>.md` (hoặc cập nhật spec giao diện liên quan).
- Bắt buộc nêu rõ:
  1. Cấu trúc layout và phân cấp thông tin (header, main container, sidebar, cards, footer).
  2. Phân chia file: file CSS trong `css/**`, file JS trong `js/**`, template dùng chung trong `layout/**`.
  3. Cơ chế render dữ liệu: biến PHP được nhúng vào vị trí nào, cách escape an toàn (`htmlspecialchars`).
  4. Điểm kiểm tra Accessibility (tương phản màu, alt text, focus state, keyboard navigation) và Responsive.
- **Gate**: Yêu cầu người dùng xác nhận blueprint trước khi tiến hành code.

## 🔵 PHASE 3: Implementation (Frontend Build)
**Execution role**: `frontend-specialist`
**Nhiệm vụ**: Xây dựng UI theo blueprint với các chỉnh sửa tối giản, an toàn.
- Tái sử dụng CSS class và cấu trúc layout đang có trong dự án.
- Tách biệt rõ ràng: CSS viết vào `css/**`, Javascript tương tác viết vào `js/**`, tránh inline style/script tràn lan.
- Khi chỉnh sửa file PHP hiển thị (presentation): Tuân thủ nguyên tắc single-owner qua handoff từ backend, đảm bảo không làm mất logic PHP hiện có.
- **CHÍNH SÁCH ON-DEMAND**: Tuyệt đối không tự ý chạy lint, build, kiểm tra browser tự động nếu người dùng chưa yêu cầu đích danh. Nếu không yêu cầu, báo cáo `Validation: not run - not requested`.

## 🔴 PHASE 4: Quality Audit & Handoff
**Execution role**: `verifier`
**Nhiệm vụ**: Kiểm định chất lượng giao diện trước khi bàn giao.
- Kiểm tra 4 yếu tố:
  1. Tính nhất quán trực quan (màu sắc, typography, khoảng cách padding/margin).
  2. Khả năng truy cập (A11y: semantic HTML, thẻ label form, aria attributes khi cần).
  3. Tính thích ứng đa màn hình (Mobile, Tablet, Desktop).
  4. Hiệu năng tải trang (tối ưu dung lượng ảnh, tránh blocking scripts).
- Output: `walkthrough.md` gồm:
  - Mục tiêu giao diện đã hoàn thành
  - Danh sách file thay đổi
  - Trạng thái validation và bằng chứng thực thi nếu có
  - Rủi ro tồn đọng (nếu có)

## 🟣 PHASE 5: Orchestrate Mode (Optional)
**Execution role**: `orchestrator`
**Trigger**: Khi người dùng yêu cầu điều phối song song hoặc tác vụ đụng chạm cả giao diện lẫn logic backend.
- Phân công việc độc lập:
  1. `frontend-specialist`: Thiết kế CSS, JS, layout template
  2. `backend-specialist`: Xử lý query dữ liệu CSDL MySQL, chuẩn bị biến dữ liệu
  3. `verifier`: Kiểm định giao diện và tính tương thích
  4. `test-author`: Kiểm thử luồng dữ liệu (khi được yêu cầu)
- Cập nhật `walkthrough.md`. Workflow hay orchestrator không thể tự ý cấp quyền validation thay cho người dùng.

---

## Output Format

```markdown
[OK] Frontend Design Completed

### Artifacts
- UI Spec: {path}
- Walkthrough: {path}

### Validation
- Status: {not run - not requested/pass/fail}
- Evidence: {command/result nếu đã chạy theo yêu cầu}

### Residual Risks
- {nếu có}
```

---

## Failure Gates (Block Completion)

- Không có `UI-SPEC-<slug>.md` hoặc tài liệu cập nhật tương đương khi làm thay đổi giao diện lớn.
- Không có `walkthrough.md`.
- Khẳng định `verified` mà không có bằng chứng thực thi lệnh theo yêu cầu.
- Tự ý đưa vào các build-tool nodejs bắt buộc làm thay đổi quy trình phát triển PHP thuần của dự án.
