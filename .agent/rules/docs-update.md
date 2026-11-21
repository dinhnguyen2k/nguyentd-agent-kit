---
trigger: model_decision
description: "When updating documentation, adding new skills, workflows, rules, or agents to sync docs with codebase."
---

# DOCS-UPDATE.MD - Đồng Bộ Tài Liệu & Hệ Thống Agent

## 1. Khi thêm mới, cập nhật hoặc cách ly Skill
- Skill hoạt động đặt tại `.agent/skills/<name>/SKILL.md` với `name` khớp tên thư mục và `description` nêu rõ điều kiện kích hoạt.
- Khi cách ly skill sang `.agent/quarantine/skills/<name>`, cập nhật `.agent/knowledge/skill-governance.json` (`name`, `reason`, `ownerAfterCleanup`) và gỡ các tham chiếu `[skill:<name>]` cũ.
- Cập nhật kịch bản eval trong `.agent/evals/cases/*.json` (bắt buộc với skill `cogain-*`) cùng các bảng định tuyến liên quan (`.agent/skills/<router>/SKILL.md`, `.agent/agents/*.md`).
- CẤM sửa tay `.agent/SKILLS.md` (`AI_RULES.md` §8); chỉ chạy `node .agent/scripts/validate-agent-system.mjs --write-catalog` để cập nhật catalog khi được phép.

## 2. Khi đổi Workflow, Agent hoặc Harness Wiring
- Khi thêm hoặc xóa workflow trong `.agent/workflows/*.md`, cập nhật bảng tra cứu tại `.agent/workflows/README.md`.
- Không sửa trực tiếp cấu hình trong `.claude/`, `.codex/`, `.agents/` hay `.omp/`; mọi thay đổi phải thực hiện ở nguồn chung `.agent/` (`AGENTS.md`, `.agent/agents/*.md`, `.agent/harness/<harness>/`).
- Khi đổi agent profile, hook hoặc harness wiring, cập nhật `.agent/harness/README.md` (kèm `.agent/contracts/agent-registry.json` nếu đổi danh sách/quyền agent) và chạy `bash .agent/scripts/install-harness-wiring.sh` khi được cấp quyền.

## 3. Cổng an toàn Tài liệu & Git (`AI_RULES.md` §2, §4, §8)
- CẤM sửa tay `CHANGELOG.md` hoặc các tệp sinh tự động khác.
- Chỉ chạy `git commit` khi người dùng yêu cầu rõ ràng.
