---
name: release-version
description: Quy trình chuẩn bị và phát hành phiên bản mới cho bộ kit / dự án
---

# /release-version - Quy trình Phát hành Phiên bản

Workflow này hướng dẫn các bước đồng bộ tài liệu, kiểm định hệ thống và phát hành phiên bản mới an toàn, có kiểm soát.

## 📋 Khi nào sử dụng

- Khi muốn đánh dấu mốc phiên bản mới theo chuẩn Semantic Versioning (Major.Minor.Patch).
- Trước khi tạo git tag hoặc tạo release chính thức.

## ⚙️ Quy trình thực hiện

### Bước 1: Xác định phiên bản mới
- **Execution role**: `orchestrator`
- Xác định số phiên bản tiếp theo (ví dụ: `1.0.0`, `1.0.1`, `1.1.0`).

### Bước 2: Rà soát và Cập nhật Changelog
- **Execution role**: `orchestrator`
- Liệt kê các tính năng mới, lỗi đã sửa, hoặc cải tiến trong chu kỳ này qua `git log`.
- Cập nhật file `CHANGELOG.md`:
  - `### Added`: Các tính năng mới thêm vào.
  - `### Changed`: Các thay đổi cấu trúc hoặc luồng xử lý.
  - `### Fixed`: Các lỗi đã được khắc phục.

### Bước 3: Kiểm định Hệ thống (Verification)
- **Execution role**: `verifier`
- Kiểm tra tính hợp lệ của hệ thống agent kit:
  ```bash
  node .agent/scripts/validate-agent-system.mjs
  ```
- Kiểm tra trạng thái git diff để đảm bảo không có file rác, file log hoặc credentials bị commit sót.

### Bước 4: Review, Commit & Tag
- **Execution role**: `orchestrator`
- Xác nhận lại toàn bộ thay đổi qua `git diff --staged`.
- Commit với thông điệp chuẩn: `release: v<version>`.
- Tạo tag phiên bản: `git tag -a v<version> -m "Release v<version>"`.

---

## Lợi ích:
- Đảm bảo lịch sử phát hành rõ ràng, minh bạch và dễ dàng rollback khi cần thiết.
