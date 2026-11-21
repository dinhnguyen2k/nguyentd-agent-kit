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
- Dữ kiện đơn giản Main tự tra (`LOOKUP`). Nghiên cứu chuyên môn mặc định giao `researcher` (`FOCUSED`) theo chu trình **Nghiên cứu liên hồi 3 nhịp** (Định hình -> Vi-nghiên cứu khi lệch giả định -> Hội tụ bằng chứng ngoại sinh) tại `.agent/skills/research/SKILL.md` (ưu tiên `lsp` + `archetype-exemplars.json` -> `context7` -> `search_web`). Chỉ khi user yêu cầu hoặc quy trình cho phép rõ `DEEP`, Main mới chia nhiều nhánh `researcher` độc lập với ngân sách hữu hạn chốt trước. Researcher chỉ đọc, không tạo agent con; Main giữ quyền quyết định và chỉ mở lại câu hỏi khi có bằng chứng ngoại sinh mới.
- Review code theo yêu cầu rõ ràng -> skill `code-reviewer` / `code-review` (hoặc `/merge-gate`, `/health` khi user gọi đích danh)
- Trước khi giao specialist tạo mới hoặc mở rộng màn hình danh sách/form, luồng duyệt hoặc báo cáo: Main đối chiếu `.agent/skills/cogain-screen-archetypes/SKILL.md` và tự xác minh 5 bất biến nghiệp vụ theo `.agent/workflows/plan.md` từ source + `archetype-exemplars.json` + tiền lệ cùng phân hệ; chỉ điểm thực sự thuộc Vùng Đỏ chưa có tiền lệ mới đưa vào `Hộp thư Quyết định` (treo riêng nhánh đó, tiếp tục các nhánh độc lập khác).

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

Không quét tràn service/module khác khi ranh giới đó không lỗi: ưu tiên đọc rule và các tệp mẫu đã duyệt trong `.agent/contracts/archetype-exemplars.json`; khi bài toán nằm ngoài các archetype đã đăng ký và rule chưa quy định, được mở tối đa 2 tệp chuẩn cùng phân hệ/service để xác minh tiền lệ thực tế thay vì đoán mò hoặc dừng hỏi user.
Task Manifest và verifier độc lập chỉ dành cho governed work dưới `/orchestrate`.

## Workflow

Khi user gọi workflow, đọc `.agent/workflows/<name>.md`; `AI_RULES.md` vẫn thắng khi xung đột.
Không có file thì báo rõ và tra `.agent/workflows/README.md`.

## Session Policy

Vận hành xuyên suốt (`Human-on-the-Loop`) theo phân tầng Vùng Xanh - Vàng - Đỏ tại `AI_RULES.md` §3: tự nghiên cứu và tự hội tụ mọi quyết định kỹ thuật/khả nghịch, chỉ treo nhánh dính Vùng Đỏ hoặc lỗi công cụ/worktree cục bộ mà không dừng các nhánh độc lập, và nối tiếp ngay sang hạng mục sẵn sàng kế tiếp trong cùng lượt thay vì báo cáo tiến độ rồi dừng.
Mentor mode chỉ bật bằng `@mentor`; quyền validation, commit và test theo `AI_RULES.md`.
Phiên làm tính năng (Luồng 1) không tự sửa `.agent/**`; ma sát rule/skill/harness được hook tự ghi hoặc ghi ngắn vào `.agent/reports/agent-friction.jsonl` để kết tinh tập trung trong phiên `/upgrade-agent`.

## Commit Messages

- Khi đã được phép commit, commit từng phần hoàn chỉnh đã nghiệm thu, không gộp các phần không liên quan.
- Commit message ngắn gọn, đủ ý: nêu rõ thay đổi gì và vì sao cần thay đổi.
- Không đưa LSP, cấu hình riêng, đường dẫn local hoặc vấn đề môi trường cá nhân vào commit message.
- Các thông tin kiểm tra và giới hạn môi trường chỉ ghi trong báo cáo bàn giao, không ghi trong commit message.
