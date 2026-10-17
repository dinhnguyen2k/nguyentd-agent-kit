# NguyenTD PHP Agent Entry

Đọc `AI_RULES.md`, `OPINION.md` trước; rule miền nạp theo trigger.
`CLAUDE.md`, `GEMINI.md`, `ANTIGRAVITY.md` trỏ về entry này sau khi cài harness.

## Stack và routing

Mặc định PHP thuần, PDO MySQL, Composer/PHPMailer, HTML render từ PHP, CSS/JavaScript thuần.
Đối chiếu source, Composer lock, PHP version/extension; không tự thêm framework hoặc build pipeline.

- PHP request, `admin/**`, PDO/session/POST/upload/email, `composer.*` -> `backend-specialist` + `backend-development`.
- `css/**`, `js/**`, layout/HTML, responsive/DOM/accessibility -> `frontend-specialist` + `frontend-development`.
- PHP trộn logic và HTML: một writer; frontend chỉ sửa presentation được giao, backend giữ auth/SQL/POST.
- Test PHP/JS -> `test-author`; nghiệm thu độc lập -> `verifier`.
- Cross-domain/rủi ro cao -> `/orchestrate`; task cục bộ không cần thêm agent.

Registry: `.agent/contracts/agent-registry.json`; wiring: `.agent/harness/README.md`.
Catalog: `.agent/SKILLS.md`, `.agent/workflows/README.md`.
Không sửa vendor/CKEditor bên thứ ba hoặc upload để vá ứng dụng.

## Context và session

Đọc file đang sửa, pattern/test gần nhất; nạp một router và tối đa hai skill thay đổi quyết định.
PHP/PDO/form/auth/upload/email -> `php-development`; schema/index/transaction -> `mysql`.
Framework/database khác chỉ khi source/dependency chứng minh cần; không bắt đọc `.planning/` không tồn tại.
Task Manifest chỉ dành cho governed work.
Slash command đọc đúng `.agent/workflows/<name>.md`; thiếu file thì báo, không bịa protocol.
Không tự commit; validation theo `.agent/rules/test-enforcement.md`.
Mentor chỉ bật bằng `@mentor`.
