---
name: release-version
description: "Tự động cập nhật phiên bản và đồng bộ toàn bộ tài liệu hệ thống. Use when releasing a new version, bumping version numbers, and syncing docs."
---

# Release Version

Procedure owner: `.agent/workflows/release-version.md`.
Đọc workflow đó và `AI_RULES.md` trước khi thực hiện; adapter không tạo quy trình artifact hoặc release engine riêng.

- Xem/review chỉ trả lời kèm nguồn trong chat; không ghi file nếu chưa có quyền ghi riêng.
- Xác định target, version mong muốn và source thực tế; không mặc định version root áp dụng cho toàn monorepo hoặc tự chọn mức tăng.
- `auto-release.js`, `VERSION`, `MASTER_GUIDE.md` không có trong source hiện tại; không gọi lệnh cũ, dựng script thay thế hoặc giả lập kết quả release.
- Đồng bộ tài liệu được yêu cầu theo `.agent/workflows/update-docs.md`, giữ release notes và rollback/runbook độc nhất tại owner phù hợp.
- Không sửa tay `CHANGELOG.md`, catalog/profile generated; thiếu producer CHANGELOG thì nêu prerequisite hoặc trả đề xuất trong chat, không ghi tay.
- Không tự install, generation, validation, commit, tag hoặc push; yêu cầu tăng version không cấp các quyền này.
- Một slice chỉ cần contract/checkpoint khi bàn giao/resume cần nó; nhiều slice dùng overview+TASK canonical theo `/plan`, governed derive manifest từ metadata/parser TASK.
- Coordinator sở hữu overview lifecycle; scope/acceptance nằm trong TASK, packet giữ snapshot identity/supersession và gate/CI evidence bất biến.
- Không tạo PLAN/implementation_plan/walkthrough/handoff/summary trùng lặp; research chỉ lưu khi được yêu cầu tại `.agent/artifacts`, không tại `reports/artifacts`.
- Catalog producer `.agent/scripts/validate-agent-system.mjs --write-catalog` cần quyền generation và static validation riêng, không phải release engine.
- Bàn giao trong chat: changed files, lý do, nguồn version, validation và rủi ro; khi chưa được yêu cầu ghi `Validation: not run - not requested`.
