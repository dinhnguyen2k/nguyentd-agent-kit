---
name: update-docs
description: "Tự động cập nhật tài liệu khi có tính năng mới hoặc thay đổi hệ thống. Use when syncing documentation with recent codebase changes."
---

# Documentation Sync

Procedure owner: `.agent/workflows/update-docs.md`.
Đọc và áp dụng workflow đó cùng `AI_RULES.md` và `.agent/rules/docs-update.md`, không tạo một quy trình artifact riêng trong adapter.

- Xem/review chỉ trả lời kèm nguồn trong chat; không ghi file nếu chưa có quyền ghi riêng.
- Cập nhật tài liệu sản phẩm được yêu cầu tại owner hiện có, giữ README song ngữ, API docs, hướng dẫn và runbook hữu ích.
- Không tạo summary/PLAN/implementation_plan/walkthrough/handoff trùng lặp.
- Một slice chỉ cần contract/checkpoint khi bàn giao/resume cần nó; nhiều slice dùng overview+TASK canonical theo `/plan`, governed derive manifest từ metadata TASK.
- Coordinator sở hữu overview lifecycle; scope/acceptance nằm trong TASK, packet giữ snapshot identity/supersession và gate/CI evidence bất biến.
- Research chỉ lưu theo yêu cầu tại `.agent/artifacts`, không tại `reports/artifacts`.
- Không sửa tay `CHANGELOG.md`, catalog/profile generated; không tự chạy install, codegen, validation, commit hoặc push.
- `update-docs.js` không có trong source hiện tại; catalog producer hiện có là `.agent/scripts/validate-agent-system.mjs --write-catalog`, cần quyền generation và static validation riêng.
- Bàn giao trong chat: changed files, lý do, nguồn, validation và rủi ro; khi chưa được yêu cầu ghi `Validation: not run - not requested`.
