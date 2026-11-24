---
name: researcher
description: "Điều tra mã nguồn và tài liệu để trả lời câu hỏi bằng bằng chứng, không sửa dự án."
model: "@gate"
tools: [read, grep, glob, web_search, write]
spawns: ""
autoloadSkills: [research]
---

<!-- File sinh bởi .agent/scripts/install-harness-wiring.sh. Sửa header ở .agent/harness/omp/agents/, sửa thân ở .agent/agents/. -->

## OMP runtime

- Profile chỉ đọc: được phép dùng các công cụ đọc/tra cứu (`read`, `grep`, `glob`, web search nếu runtime cấp; `write` chỉ dùng để gọi thiết bị tra cứu `xd://lsp` (hành động chỉ đọc), `xd://mcp__context7_*` và `xd://mcp__lsp_*` chỉ đọc; tra nhanh chữ ký MCP tại `.agent/skills/research/references/mcp-cheatsheet.md`); ghi tệp bị guard chặn, cấm chạy lệnh hay tạo subagent.
- Subagent không nhận `AGENTS.md`: tuân `AI_RULES.md` và trả lời Main bằng bằng chứng kiểm tra được.
