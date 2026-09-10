# Harness Wiring

Nguồn chung nằm ở `.agent/`. Thư mục của từng harness chỉ chứa symlink trỏ về đây.
Không viết cấu hình thật vào `.claude/`, `.codex/`, `.agents/`: sửa ở đó là mất đồng bộ ngay khi đổi công cụ.

Dựng lại toàn bộ symlink: `bash .agent/scripts/install-harness-wiring.sh`
Chỉ kiểm tra: `bash .agent/scripts/install-harness-wiring.sh --check`

## Cái gì chung, cái gì riêng

| Thành phần | Nguồn chung | Ghi chú |
| --- | --- | --- |
| Agent profile | `.agent/agents/*.md` | Frontmatter theo chuẩn Claude Code, các harness khác đọc phần thân |
| Skill | `.agent/skills/` | |
| Workflow | `.agent/workflows/` | |
| Rule, entry file | `AI_RULES.md`, `OPINION.md`, `AGENTS.md` | `CLAUDE.md`/`GEMINI.md`/`ANTIGRAVITY.md` là symlink của `AGENTS.md` |
| Ranh giới agent | `.agent/contracts/agent-registry.json` | Cấu hình cho guard, không phải tài liệu suông |
| Bộ luật thực thi | `.agent/scripts/agent-boundary-guard.mjs` | Một engine, hai chế độ chạy |
| Wiring riêng từng harness | `.agent/harness/<harness>/` | Chỉ chứa phần không thể chung được |

## Mức cưỡng chế theo harness

Chỉ Claude Code có PreToolUse hook, nên chỉ ở đó ranh giới là cứng. Các harness còn lại dùng chung bộ luật qua CLI.

| Harness | Wiring | Mức cưỡng chế |
| --- | --- | --- |
| Claude Code | `.claude/settings.json -> ../.agent/harness/claude/settings.json` | **Cứng**: hook chặn trước khi tool chạy |
| Codex | `.codex/{agents,skills,workflows}` symlink | Mềm: prose + CLI check khi được gọi |
| Antigravity / Gemini | `.agents/{agents,skills,workflows}` symlink | Mềm: prose + CLI check khi được gọi |
| CI, git hook, script | không cần wiring | CLI mode, exit code 2 |

## CLI mode

Cùng registry, cùng luật, không phụ thuộc harness:

```bash
node .agent/scripts/agent-boundary-guard.mjs --check-command "dotnet test --filter X"
node .agent/scripts/agent-boundary-guard.mjs --check-write backend/tests/Foo.cs
node .agent/scripts/agent-boundary-guard.mjs --check-command "dotnet test" --role verifier
```

exit 0 là cho phép, exit 2 là bị chặn kèm lý do ở stderr.
Harness nào có cơ chế chạy lệnh trước mỗi tool call thì nối vào đây, không viết lại luật lần thứ hai.

## Subagent thật

`verifier` và `test-author` được đăng ký thành subagent thật trong `.claude/agents/` bằng symlink.
Lý do chỉ hai seat này: chúng cần **bộ quyền khác** chứ không chỉ khác lời dặn.
`verifier` khai báo `tools: Read, Grep, Glob, Bash` nên runtime không cấp Edit/Write, đó là ranh giới cứng duy nhất không thể lách bằng prompt.

`backend-specialist` và `frontend-specialist` cố tình **không** đăng ký: chúng dùng đúng bộ tool của main thread, spawn thêm chỉ tốn context mà không thêm ranh giới nào.

Đăng ký subagent chỉ có hiệu lực ở phiên mới, Claude Code đọc `.claude/agents/` lúc khởi động.
