---
name: update-docs
description: Tự động cập nhật tài liệu khi có tính năng mới hoặc thay đổi hệ thống.
---

# /update-docs - Documentation Sync

$ARGUMENTS

## Quyền thực thi và artifact

- Đọc `AI_RULES.md` và `.agent/rules/docs-update.md`; checklist không cấp quyền chạy script hoặc commit.
- Yêu cầu xem/review chỉ trả lời trong chat kèm nguồn, không ghi file nếu chưa có quyền ghi riêng.
- Khi user yêu cầu cập nhật, chỉ sửa tài liệu sản phẩm trong phạm vi được yêu cầu; giữ README song ngữ, hướng dẫn, API docs và runbook hữu ích tại owner hiện có.
- Không tạo thêm PLAN, implementation_plan, walkthrough, handoff hoặc summary lặp lại nội dung đã có.
- Một slice chỉ cần contract/checkpoint gọn khi phải bàn giao hoặc resume.
- Nhiều slice dùng `.agent/planning/{task-slug}/00-OVERVIEW.md` và `TASK-*.md` theo `/plan`; scope/acceptance chỉ sửa trong TASK canonical, overview chứa quyết định thiết kế tổng thể và index/lifecycle do coordinator cập nhật.
- Lane governed dùng parser/metadata TASK canonical để derive manifest, không chép acceptance vào overview.
- Packet bàn giao tham chiếu snapshot identity và supersession của contract, giữ gate/CI evidence bất biến.
- Research chỉ lưu khi được yêu cầu tại `.agent/artifacts`, không tạo `reports/artifacts`.

## 1. Phát hiện thay đổi

**Execution role**: `codebase discovery role`

Đọc source liên quan trong `.agent/skills/`, `.agent/agents/`, `.agent/workflows/` và tài liệu hiện có.
Đối chiếu mô tả, link và số liệu với source thực tế, không lấy số liệu cũ làm bằng chứng.

## 2. Cập nhật đúng owner

**Execution role**: `documentation-writer`

Dùng checklist docs-update để chọn đúng section cần sửa trong README/hướng dẫn hiện có, không cập nhật mọi guide một cách máy móc.
Không sửa tay `CHANGELOG.md`, catalog hoặc profile auto-generated.
`.agent/scripts/update-docs.js` không có trong source hiện tại, không gọi hoặc dựng script thay thế.
Producer catalog hiện có là `node .agent/scripts/validate-agent-system.mjs --write-catalog`; chỉ chạy khi user cho phép generation và static validation, vì command thực hiện cả hai.
Không tự chạy install, codegen, validation, commit hoặc push từ yêu cầu sửa docs.

## 3. Bàn giao

**Execution role**: `verification role`

Báo trong chat các file đã đổi, lý do, nguồn đối chiếu, validation thực chạy và rủi ro còn lại.
Không khẳng định link/stats đã được validation nếu chưa chạy kiểm tra được phép.
Khi chưa có quyền validation, ghi `Validation: not run - not requested`.
