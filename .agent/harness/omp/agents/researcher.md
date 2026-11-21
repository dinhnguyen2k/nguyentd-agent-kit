---
name: researcher
description: "Điều tra mã nguồn và tài liệu để trả lời câu hỏi bằng bằng chứng, không sửa dự án."
model: "@gate"
tools: [read, grep, glob]
spawns: ""
autoloadSkills: [research]
---

<!-- File sinh bởi .agent/scripts/install-harness-wiring.sh. Sửa header ở .agent/harness/omp/agents/, sửa thân ở .agent/agents/. -->

## OMP runtime

- Profile chỉ đọc: không có quyền sửa tệp, chạy lệnh hay tạo subagent.
- Subagent không nhận `AGENTS.md`: tuân `AI_RULES.md` và trả lời Main bằng bằng chứng kiểm tra được.
