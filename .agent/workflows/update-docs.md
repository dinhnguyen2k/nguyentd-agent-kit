---
name: update-docs
description: Cập nhật và đồng bộ tài liệu khi có thay đổi cấu trúc hoặc tính năng mới
---

# /update-docs - Documentation Sync Workflow

$ARGUMENTS

---

## 🟢 PHASE 1: Change Detection
**Execution role**: `orchestrator`
**Nhiệm vụ**: Xác định các thay đổi cần cập nhật tài liệu.
- Rà soát các file đã thay đổi qua `git status` hoặc `git diff`.
- Kiểm tra các file tài liệu liên quan: `ARCHITECTURE.md`, `ARCHITECTURE.vi.md`, `README.md`, `workflows/README.md`, `SKILLS.md`.

## 🟡 PHASE 2: Content Synthesis
**Execution role**: `orchestrator`
**Nhiệm vụ**: Tổng hợp nội dung tài liệu mới.
- Mô tả rõ ràng mục đích, phạm vi và cách sử dụng của tính năng hoặc cấu trúc mới.
- Đảm bảo tính nhất quán với ngữ cảnh ứng dụng PHP / MySQL hiện tại.

## 🔵 PHASE 3: Surgical Update
**Execution role**: `orchestrator`
**Nhiệm vụ**: Cập nhật tài liệu một cách chuẩn xác:
- Cập nhật đúng các phần bị ảnh hưởng, giữ nguyên các phần không đổi để diff sạch.
- Đảm bảo các đường dẫn liên kết nội bộ trong tài liệu là chính xác.

## 🔴 PHASE 4: Integrity Audit
**Execution role**: `verifier`
**Nhiệm vụ**: Kiểm định tính chính xác của tài liệu.
- Xác nhận các lệnh, đường dẫn file và mô tả đều khớp với mã nguồn thực tế.
- Báo cáo danh sách các tài liệu đã được cập nhật.

---

## Quy tắc Đồng bộ Tài liệu:
- **Đúng thực tế**: Tài liệu phải phản ánh đúng hành vi code hiện tại, không mô tả tính năng giả định chưa có.
- **Diff sạch**: Chỉ chỉnh sửa các phần cần thiết, tránh format lại toàn bộ file gây ồn commit.

---

## Ví dụ:
- `/update-docs`
- `/update-docs sync new workflow additions`
- `/update-docs refresh architecture summary`
