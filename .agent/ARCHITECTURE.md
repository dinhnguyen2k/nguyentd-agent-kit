# NguyenTD PHP Agent Architecture

Scope: PHP thuần, PDO MySQL, Composer/PHPMailer, HTML render phía server, CSS và JavaScript thuần.
Phiên bản PHP, extension, DB/SMTP config phải đọc từ môi trường/source, không suy ra từ bộ kit.
Bộ kit không nâng PHP, đổi framework hoặc sửa ứng dụng khi được cài.

## Canonical layers

- `AGENTS.md`: routing và context entry; entry harness trỏ về file này.
- `AI_RULES.md`: quyền thực thi, an toàn, thứ tự ưu tiên.
- `.agent/rules/`: invariant miền PHP, template, database, security.
- `.agent/contracts/`: role registry, task manifest, context budget, metrics.
- `.agent/agents/`: profile mỏng, giới hạn quyền và handoff.
- `.agent/skills/`: quy trình nạp theo nhu cầu; catalog sinh tại `.agent/SKILLS.md`.
- `.agent/workflows/`: protocol cho slash command.
- `.agent/knowledge/`: nguồn tin và vòng đời skill.
- `.agent/quarantine/skills/`: nội dung cũ giữ để tham khảo, không auto-discovery.
- `.agent/evals/cases/`: tình huống hành vi mong đợi, không phải bằng chứng model đã thực thi đúng.

Một concern có một owner; file khác trỏ về owner thay vì chép luật.

## Routing và ownership

| Miền | Role | Router |
| --- | --- | --- |
| PHP request, PDO, session/auth, POST, upload, email, Composer | `backend-specialist` | `backend-development` |
| HTML template, CSS, JS/DOM, responsive, accessibility | `frontend-specialist` | `frontend-development` |
| Test PHP/JS khi dự án có test runner | `test-author` | `testing-patterns` |
| Nghiệm thu độc lập, không sửa source/test | `verifier` | `lint-and-validate` |
| Điều phối governed work, không sửa source | `orchestrator` | `orchestrate` |

Write boundary máy đọc được nằm ở `.agent/contracts/agent-registry.json`.
`php-development` sở hữu quy trình PHP/PDO/form/session/upload/email; `mysql` sở hữu schema/index/transaction theo driver thực tế.
Generic React/Tailwind/PostgreSQL skill chỉ dùng khi source/dependency chứng minh stack đó tồn tại; không phải default.
Không sửa vendor, CKEditor hoặc file upload như source của dự án.

PHP trộn HTML và xử lý request không có ranh giới file backend/frontend tự nhiên.
Mỗi task phải chỉ định đúng một owner ghi file đó; frontend được giao phần trình bày, không tự đổi SQL/auth/POST.
Không chạy song song hai writer cùng file.

## Task lifecycle

| Tier | Context và gate |
| --- | --- |
| `fast` | Source đang sửa, pattern gần nhất; báo bằng chứng/giới hạn |
| `standard` | Thêm rule/skill thực sự thay đổi quyết định |
| `governed` | Manifest, ownership, verifier độc lập |

Governed task dùng `.agent/contracts/task-manifest.schema.json`.
Manifest nêu mục tiêu, allowed paths, acceptance, validation command và stop condition.
Validation vẫn theo quyền user trong `AI_RULES.md`; role verifier không tự cấp quyền chạy command.
Test-author không sửa production; implementer không sửa assertion để hợp thức hóa bug.

## Runtime enforcement

`.agent/scripts/agent-boundary-guard.mjs` đọc registry để chặn test command, ghi test, sửa cấu hình enforcement và ghi ngoài role boundary.
Claude có PreToolUse hook; Codex/Antigravity chỉ có CLI guard và instruction, không giả định có hard enforcement.
Role env `COGAIN_AGENT_ROLE` là tên kỹ thuật lịch sử còn dùng bởi guard/role script; không thể hiện stack ứng dụng.
Guard fail-open khi crash theo policy hiện có, không phải sandbox bảo mật và không chống được cố ý mạo danh role cùng process.

## Harness wiring

Nguồn canonical là `.agent/`; adapter là symlink, không fork skill theo harness.

```bash
bash .agent/scripts/install-harness-wiring.sh
bash .agent/scripts/install-harness-wiring.sh --check
```

Installer không ghi đè file harness thật đã tồn tại; báo conflict để chủ dự án xử lý.
Node installer sao chép luật, opinion, entry và `.agent/`, sau đó gọi script wiring.
Cần Node.js và Bash; PHP runtime không cần Node chỉ để phục vụ ứng dụng.

## Kiểm chứng và context

```bash
node .agent/scripts/validate-agent-system.mjs --write-catalog
node .agent/scripts/report-agent-context.mjs
```

Validator kiểm frontmatter, reference/link, registry, governance, eval coverage, context budget và harness skill links.
Catalog được sinh từ inventory thực tế, không ghi cứng số skill.
Context budget dùng file đi kèm kit, không phụ thuộc `.planning/codebase/` của repo cũ.
Byte/token estimate không phải usage thực; source/task/skill đã chọn và conversation không nằm trong estimate.

Static validation không chứng minh model làm đúng tình huống PHP.
Behavior cases cần chạy bằng harness/model đã cấu hình nếu muốn đánh giá quyết định agent.
`php -l` chỉ kiểm cú pháp; trang/form/admin flow cần runtime và DB phù hợp.
PHPUnit, PHPStan, CS Fixer hoặc JS test runner chỉ chạy khi đã được cài/cấu hình và user yêu cầu.
Không gửi mail thật hoặc thao tác dữ liệu production để smoke test.

## Knowledge lifecycle

Source/runtime và `AI_RULES.md` ưu tiên hơn ví dụ generic.
Nguồn ngoài đi qua evidence -> proposal -> eval -> human approval -> publish.
Ưu tiên PHP manual, Composer, MySQL, PHPMailer và MDN đúng phiên bản; MCP chỉ đọc và chỉ bật khi được cấu hình/duyệt.
Skill .NET/Cogain cũ nằm trong quarantine, không còn route mặc định.
