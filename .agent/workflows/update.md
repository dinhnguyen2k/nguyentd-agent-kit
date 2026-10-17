---
name: update
description: Kiểm tra và cập nhật bộ kit / mã nguồn từ kho lưu trữ Git
---

# /update - Quy trình Cập nhật Bộ Kit & Mã Nguồn

Quy trình này hướng dẫn cách kiểm tra và đồng bộ an toàn các bản cập nhật từ kho lưu trữ Git từ xa.

## 📋 Các bước thực hiện

1. **Kiểm tra trạng thái cục bộ**:
   - Chạy `git status` để kiểm tra các thay đổi đang dở dang (uncommitted changes).
   - Nếu có file đang sửa, đề xuất stash hoặc commit trước khi cập nhật: `git stash`.

2. **Kiểm tra bản cập nhật từ xa**:
   - Lấy thông tin mới từ remote: `git fetch`.
   - Xem trước các thay đổi mới: `git log HEAD..@{u} --oneline`.

3. **Thực hiện cập nhật (Khi được người dùng đồng ý)**:
   - Kéo cập nhật về nhánh hiện tại:
     ```bash
     git pull
     ```
   - Nếu trước đó có stash: `git stash pop` và giải quyết xung đột (conflict) nếu có.

4. **Kiểm tra tính toàn vẹn hệ thống**:
   - Chạy script kiểm định cấu trúc agent kit:
     ```bash
     node .agent/scripts/validate-agent-system.mjs
     ```
   - Thông báo kết quả cập nhật cho người dùng.
