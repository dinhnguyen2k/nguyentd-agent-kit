---
name: brainstorm
description: "Nghiên cứu và phản biện nhiều phương án bằng hiện trạng hệ thống, nguồn chính thức và case thực chiến. Use for evidence-backed ideation or architecture decisions, not implementation."
---

# /brainstorm - Evidence-Backed Exploration

$ARGUMENTS

Chọn phương án phù hợp nhất với bối cảnh thật, không biến code hiện tại hoặc suy luận nội bộ thành best practice.
`AI_RULES.md` và quyền hiện tại vẫn có ưu tiên cao hơn skill.

## Workflow

### 1. Establish context

- Đọc source, test và doc gần nhất để xác định current behavior, constraint, invariant và boundary.
- Source hiện tại chỉ chứng minh hệ thống **đang làm gì**, không chứng minh cách đó đúng hoặc tối ưu.
- Xác định các claim cần kiểm chứng về correctness, security, performance, operability, scalability, maintainability và user impact.

### 2. Research Gate

- Trước khi tạo option, nạp và dùng `.agent/skills/research/SKILL.md`; không bỏ qua gate khi delegation không khả dụng.
- Set `mode: FOCUSED` by default and read only `.agent/skills/research/references/focused.md`.
- Before browsing, create one research brief with one decision, at most 3 decision-changing questions, relevant constraints, and explicit exclusions.
- If the request reduces to one isolated factual question, stop the brainstorm flow and route it to `mode: LOOKUP`.
- DO NOT escalate to `mode: DEEP` unless the user explicitly requests deep research.
- Với trade-off thực tế, yêu cầu cả primary evidence và case từ blog/talk/GitHub của practitioner trực tiếp xây dựng hoặc vận hành hệ thống tương tự.
- Dùng web để kiểm tra thông tin hiện hành, tìm counterexample và phân biệt `fact`, `reported experience`, `inference`, `open question`.
- Chỉ đọc [evidence-review.md](references/evidence-review.md) khi rủi ro cao, nguồn mâu thuẫn, credibility ảnh hưởng kết luận hoặc user yêu cầu nghiên cứu sâu.

### 3. Options and critique

- Tạo 2-3 option khác nhau thực chất; không ép đủ ba.
- Mỗi option phải có evidence ủng hộ/phản bác, context fit, Pros, Cons, Risks/Mitigations, Effort và Confidence.
- Phản biện failure mode; security/performance/scale; maintainability/observability/migration/rollback; user/developer experience; và nguy cơ cargo cult từ case khác bối cảnh.

### 4. Synthesis

- Ghi research, citation, evidence matrix, option analysis và recommendation vào một artifact Markdown chung theo convention repo.
- Chat chỉ đưa bảng rút gọn: Fit, Evidence strength, Risks, Reversibility, Effort và Confidence.
- Chọn một recommendation theo correctness, simplicity, robustness, maintainability.
- Nêu lý do thắng, điều kiện làm kết luận thay đổi và phần cần benchmark/POC.
- Hỏi user chọn option trước khi triển khai.

## Boundaries

- Không viết implementation code.
- Không dùng authority hoặc consensus giả để lấp evidence gap.
- Chỉ route `/orchestrate` khi user yêu cầu triển khai và đã chọn option.
- Chi tiết chỉ nằm trong artifact; chat không nhân đôi.
