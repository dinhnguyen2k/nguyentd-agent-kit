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
- Before browsing, prepare one in-memory research brief with one decision, at most 3 decision-changing questions, relevant constraints, and explicit exclusions.
- Analysis returns an answer with citations; do not persist the brief, evidence ledger, or options automatically, including when the research skill suggests an artifact.
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

- Trả lời trong chat với citation và bảng so sánh: Fit, Evidence strength, Risks, Reversibility, Effort và Confidence.
- Chỉ khi user yêu cầu lưu nghiên cứu, ghi một artifact tại `.agent/artifacts/` chứa research, citation, evidence matrix, option analysis và recommendation độc nhất.
Không ghi vào `reports/artifacts`, không tự tạo PLAN, implementation_plan, walkthrough hoặc handoff lặp lại.
Nếu đã lưu theo yêu cầu, chat chỉ tóm tắt và dẫn tới artifact, không chép lại toàn bộ.
- Chọn một recommendation theo correctness, simplicity, robustness, maintainability.
- Nêu lý do thắng, điều kiện làm kết luận thay đổi và phần cần benchmark/POC.
- Hỏi user chọn option trước khi triển khai.

## Boundaries

- Không viết implementation code.
- Không dùng authority hoặc consensus giả để lấp evidence gap.
- Chỉ route `/orchestrate` khi user yêu cầu triển khai và đã chọn option.
- Giữ execution brief trong handoff, không tạo file mới nếu không cần resume.
Single-slice chỉ dùng compact contract/checkpoint khi cần handoff/resume; multi-slice dùng `00-OVERVIEW.md` và canonical `TASK-*.md` theo `/plan`.
Governed manifest được derive từ TASK metadata, không viết tay.
Packet dẫn tới contract snapshot identity và supersession; chỉ coordinator cập nhật overview lifecycle, overview không chép acceptance từ TASK.
- Không tự lưu analysis; artifact được yêu cầu giữ nội dung độc nhất, chat chỉ tóm tắt và dẫn nguồn.
