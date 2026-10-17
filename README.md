# NguyenTD PHP Agent Kit

Bản local chuyển từ bộ Cogain/.NET/React sang PHP thuần, PDO MySQL, Composer/PHPMailer và HTML/CSS/JavaScript render phía server.
Không thêm Laravel, ORM, React hoặc build pipeline vào ứng dụng.
Không tự cài PHPUnit/PHPStan/CS Fixer; đọc runtime/dependency thực tế trước khi chọn công cụ.

## Dùng local bằng symlink

Cấu hình tại dự án Long Phát:

```text
.agent -> nguyentd-agent-kit/.agent
AGENTS.md -> nguyentd-agent-kit/AGENTS.md
AI_RULES.md -> nguyentd-agent-kit/AI_RULES.md
OPINION.md -> nguyentd-agent-kit/OPINION.md
CLAUDE.md / GEMINI.md / ANTIGRAVITY.md -> AGENTS.md
.claude/skills / .codex/skills / .agents/skills -> ../.agent/skills
```

`.agent/` là nguồn canonical; harness không giữ bản sao skill riêng.
Root `.gitignore` loại bộ kit, entry và harness local khỏi source ứng dụng.
Không commit/push trong quá trình chuyển đổi; bản này chưa được phát hành lên GitHub.
Nếu muốn xuất bản, tạo nhánh `php` trong repository bộ kit, review rồi push nhánh đó, không đẩy thẳng nhánh mặc định.
Symlink chỉ giúp công cụ tìm instruction/skill; không bảo đảm model tự tuân thủ mọi luật.
Claude dùng PreToolUse guard; Codex/Antigravity cần instruction và CLI guard, chưa có hard hook tương đương.
Sau khi nối, mở phiên công cụ mới nếu phiên hiện tại đã cache instructions.

Kiểm tra hoặc dựng lại wiring từ gốc dự án:

```bash
bash .agent/scripts/install-harness-wiring.sh --check
bash .agent/scripts/install-harness-wiring.sh
```

Script không ghi đè file harness thật đã tồn tại; conflict phải được xử lý chủ động.
Guard nhận project root từ `AGENT_PROJECT_DIR`, `CLAUDE_PROJECT_DIR` hoặc tìm từ working directory, nên `.agent` có thể là symlink.
Không xóa/di chuyển thư mục `nguyentd-agent-kit` khi root còn trỏ vào nó.
Runtime role/report nằm dưới `.agent/`; dùng cùng một kit qua symlink sẽ dùng chung state/report.

## Cài bản sao vào dự án khác

Cần Node.js và Bash, không cần Node để phục vụ ứng dụng PHP.
Tại root dự án đích:

```bash
node /path/to/nguyentd-agent-kit/bin/install.js
```

Installer sao chép `.agent`, `AGENTS.md`, `AI_RULES.md`, `OPINION.md`, rồi tạo entry/harness symlink.
Nó có thể ghi đè file canonical cùng tên: kiểm tra/sao lưu cấu hình cũ trước khi dùng.
Không dùng lệnh `npx` trỏ GitHub để lấy bản chuyển đổi này trước khi nhánh PHP được xuất bản.

## Routing

| Công việc | Owner |
| --- | --- |
| PHP request/admin, PDO, session/auth, form, upload, PHPMailer, Composer | `backend-specialist` |
| CSS/JS public và admin, images, layout template | `frontend-specialist` |
| Viết test PHP/JS khi dự án có runner | `test-author` |
| Nghiệm thu độc lập, read-only | `verifier` |
| Task cross-domain/rủi ro cao | `/orchestrate` |

PHP root/admin trộn logic và template chỉ có một writer; frontend bàn giao đề xuất presentation cho backend owner.
`php-development` chứa quy trình PHP/PDO/security; `mysql` chứa schema/index/transaction theo driver thực tế.
Skill .NET/Cogain cũ nằm trong quarantine, không auto-discovery.
Skill framework khác chỉ opt-in khi source/dependency chứng minh cần.
Catalog sinh từ inventory tại `.agent/SKILLS.md`; protocol tại `.agent/workflows/README.md`.

## Kiểm chứng bộ kit

Chạy từ root có các entry và `.agent`:

```bash
node .agent/scripts/validate-agent-system.mjs --write-catalog
node .agent/scripts/report-agent-context.mjs
```

Validator kiểm metadata, link/reference, registry/governance, eval coverage, context budget và harness skill links.
Behavior case trong `.agent/evals/cases/` là tình huống mong đợi, không phải chứng nhận model đã chạy đúng.
CLI guard có thể kiểm một lệnh hoặc đường ghi mà không thực thi hành động đó:

```bash
node .agent/scripts/agent-boundary-guard.mjs --check-command "vendor/bin/phpunit"
node .agent/scripts/agent-boundary-guard.mjs --check-write "tests/TourTest.php"
```

Role mặc định chặn cả hai ví dụ trên; quyền test chỉ do user cấp theo `.agent/rules/test-enforcement.md`.
Guard có fail-open-on-crash theo policy, không phải sandbox chống cố ý vượt quyền.

## Kiểm chứng ứng dụng PHP

Các command bên dưới chỉ dùng khi user yêu cầu và môi trường có công cụ tương ứng:

```bash
php -l index.php
composer validate
php -S 127.0.0.1:8000 -t .
```

`php -l` chỉ kiểm cú pháp; preview cần PHP CLI, extension và DB phù hợp, SMTP chỉ khi thử luồng mail đã được cho phép.
Không gửi mail thật hoặc dùng DB production để test.
Máy trạm hiện đã cài đặt PHP 8.3 CLI, Composer và các extension cần thiết (`pdo_mysql`, `mbstring`, `fileinfo`, `openssl`, `curl`, `gd`).

## Bằng chứng kiểm chứng bản chuyển đổi

- Validator: 81 active skills, 54 quarantined skills, 4 agent profiles, 32 workflow files, 7 eval-covered skills; 0 lỗi, 6 cảnh báo metadata/activation trigger trong skill generic.
- Context budget của backend/frontend/verifier đều đạt, không nới ngưỡng để bỏ qua lỗi.
- Smoke installer trên thư mục tạm: cài mới, entry symlink, harness wiring và validator đạt; thư mục tạm đã xóa.
- Guard: 32 tình huống CLI đạt; hook qua `.agent` symlink cho phép absolute path PHP đúng owner và từ chối ghi test.
- Môi trường runtime: PHP 8.3.6 CLI và Composer 2.7.1 đã được cài đặt và kiểm chứng qua `php -l index.php` và `composer validate`.
- Chưa chạy model behavior eval hoặc ứng dụng PHP vì chưa có môi trường/harness tương ứng.
