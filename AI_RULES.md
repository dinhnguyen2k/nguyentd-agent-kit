# AI_RULES.md - Core Rules

## 1. Ưu tiên

`AI_RULES.md` > `.agent/rules/` > `.agent/skills/` > `AGENTS.md` > mặc định agent.
`OPINION.md` chỉ áp dụng khi luật im lặng.
Source/runtime chứng minh hành vi thật; doc mâu thuẫn source thì báo và đối chiếu yêu cầu, không coi lỗi cũ là chuẩn đúng.

## 2. Quyền thực thi

- Xem/phân tích/review: chỉ đọc, không sửa hoặc chạy build/lint/test/format/codegen.
- Proposal: chỉ đề xuất; implementation khi user yêu cầu sửa/chuyển đổi/triển khai hoặc tương đương.
- Sửa đúng scope, không tự cài dependency, đổi framework hay deploy production.
- Validation on-demand: chỉ chạy hành động/scope user yêu cầu rõ như `php -l`, `composer validate`, `/test`, preview.
- Checklist, handoff và loại file không tự cấp quyền validation.
- Test suite thuộc `verifier`/`test-author`; chỉ `test-author` ghi test theo `.agent/rules/test-enforcement.md`.

## 3. An toàn và thiết kế

- Không tự commit, phá DB, migrate production, gửi mail thật hoặc gọi dịch vụ tính phí.
- Không lộ DB/SMTP credential, `.env`, cookie/session/token trong chat/log.
- Không sửa `vendor/**`, CKEditor bên thứ ba hoặc nội dung upload để vá ứng dụng.
- Giữ URL/form contract/dữ liệu hiện có; migration có kế hoạch riêng.
- Không nuốt lỗi, thêm fallback giả hoặc làm yếu assertion để báo xanh.
- Ưu tiên correctness, simplicity, robustness, maintainability.
- Mặc định PHP thuần/PDO, không bắt buộc MVC, ORM, repository/service layer hoặc framework.
- Kiểm PHP version, extension, Composer lock trước API mới; không bịa sẵn PHPUnit/PHPStan/CS Fixer/Node build/Docker.
- Prepared statement cho giá trị, allowlist identifier, escape đúng context, auth/CSRF tại server cho đường ghi.
Chi tiết ở rule miền và `php-development`.

## 4. Routing

- PHP/PDO/session/auth/admin/POST/upload/PHPMailer/Composer -> `backend-development`.
- HTML template/CSS/JS/DOM/responsive -> `frontend-development`.
- Schema/index/transaction MySQL -> `mysql` sau khi xác nhận driver.
- Test PHP/JS -> `test-author`; PHP trộn template và logic chỉ có một writer.
- Chỉ spawn khi có phần độc lập đủ lớn hoặc user yêu cầu.
Registry: `.agent/contracts/agent-registry.json`; form/JSON parity: `.agent/rules/domain-parity.md`.

## 5. Chất lượng và bàn giao

Bug bắt đầu từ request path và bằng chứng có sẵn; thực thi theo §2.
Test hẹp cho invariant tiền/quyền/dữ liệu/lỗi hồi quy, không test wording/copy wiring.
Lỗi trong scope báo hoặc xử lý đúng owner; không chạy suite tìm việc ngoài scope.
Báo changed files/lý do, validation và rủi ro; chỉ ghi command/kết quả đã chạy.
Phân biệt inspection, syntax check, test, runtime/browser; `php -l` không chứng minh E2E.
Chưa chạy: `Validation: not run - not requested`; thiếu DB/runtime phải nói rõ.
Phản hồi tiếng Việt; identifier/API tiếng Anh; comment/PHPDoc tiếng Việt khi cần giải thích invariant.
Không dùng em dash; Markdown mỗi câu một dòng; không sửa tay file auto-generated.
