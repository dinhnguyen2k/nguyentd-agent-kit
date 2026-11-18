# Cogain Agent Entry

`AGENTS.md` là entry duy nhất; `CLAUDE.md`, `GEMINI.md`, `ANTIGRAVITY.md` là symlink của nó.
Luật (nguồn sự thật cao nhất): @AI_RULES.md

Chỉ đọc `OPINION.md` khi luật chưa chốt được quyết định; không tự nạp toàn bộ.
Harness hỗ trợ `@import` tự chèn luật trên; harness khác phải đọc `AI_RULES.md` trước khi làm.
Rule miền trong `.agent/rules/` nạp theo trigger; không đọc lại nội dung đã có trong context nếu source chưa đổi.

## Route

- Mặc định `backend/**`, API, EF, gRPC, database, broker -> `backend-specialist`
- Mặc định `frontend/**`, React, route, query, form, Tailwind -> `frontend-specialist`
- Main chỉ code khi user giao rõ làm trực tiếp tại Main cho task hiện tại theo `AI_RULES.md` §6; không có ngoại lệ tự động cho task nhỏ/cơ học/gấp.
- Không dispatch được specialist thì báo blocker, không tự chuyển sang Main code.
- Cross-domain hoặc rủi ro cao -> `/orchestrate`
- Dữ kiện đơn giản Main tự tra (`LOOKUP`). Nghiên cứu cần thiết mặc định giao một `researcher` (`FOCUSED`); xem `.agent/skills/research/SKILL.md` về phạm vi và ngân sách. Chỉ khi người dùng yêu cầu hoặc quy trình cho phép rõ `DEEP`, Main mới giao câu hỏi độc lập cho nhiều Researcher, với ngân sách tổng và từng nhánh chốt trước. Researcher chỉ đọc, được tự chia câu hỏi trong phạm vi đã giao nhưng không tạo agent con hay giao lại cho người khác. Main giữ quyền quyết định; chỉ mở lại câu hỏi bị ảnh hưởng, ở cấp độ đã được phép và trong ngân sách còn lại, khi có bằng chứng mới cần xử lý. `scout` chỉ lập bản đồ repo. Nếu không có Researcher phù hợp hoặc không thể đọc nguồn an toàn, nêu rõ giới hạn; không giả định đã nghiên cứu.
- Review code theo yêu cầu rõ ràng -> skill `code-reviewer` / `code-review` (hoặc `/merge-gate`, `/health` khi user gọi đích danh)

Ranh giới ghi: `.agent/contracts/agent-registry.json`, hook `.agent/scripts/agent-boundary-guard.mjs`.
Chỉ đọc `.agent/harness/README.md` khi sửa wiring; catalog `.agent/SKILLS.md` và `.agent/workflows/README.md` khi cần tra cứu.

## Context Policy

Đọc source đang sửa và test/pattern gần nhất; chỉ nạp thêm phần đổi được quyết định:

| Trigger | Load |
| --- | --- |
| Module mới, chưa rõ convention | `STRUCTURE.md`, `CONVENTIONS.md` |
| Cross-service, auth, cache, broker, gRPC | `ARCHITECTURE.md`, `INTEGRATIONS.md` |
| Hành vi rủi ro hoặc liên module | `CONCERNS.md` |
| Triển khai một miền | 1 router + tối đa 2 skill đổi được quyết định |

Cấm mở service/module khác chỉ để xem "bên đó làm thế nào" khi ranh giới đó không lỗi; cần convention thì đọc rule.
Task Manifest và verifier độc lập chỉ dành cho governed work dưới `/orchestrate`.

## Workflow

Khi user gọi workflow, đọc `.agent/workflows/<name>.md`; `AI_RULES.md` vẫn thắng khi xung đột.
Không có file thì báo rõ và tra `.agent/workflows/README.md`.

## Session Policy

Architecture mặc định QUICK ASK; mở rộng khi user yêu cầu hoặc quyết định có tác động lớn.
Mentor mode chỉ bật bằng `@mentor`; quyền validation, commit và test theo `AI_RULES.md`.

## Commit Messages

- Khi đã được phép commit, commit từng phần hoàn chỉnh đã nghiệm thu, không gộp các phần không liên quan.
- Commit message ngắn gọn, đủ ý: nêu rõ thay đổi gì và vì sao cần thay đổi.
- Không đưa LSP, cấu hình riêng, đường dẫn local hoặc vấn đề môi trường cá nhân vào commit message.
- Các thông tin kiểm tra và giới hạn môi trường chỉ ghi trong báo cáo bàn giao, không ghi trong commit message.
