---
name: brainstorm
description: Bí ý tưởng? Dùng cái này để Hội đồng AI gợi ý và phản biện theo chuẩn Senior.
---

# /brainstorm - Multi-Option Strategic Exploration

$ARGUMENTS

> Đây là protocol brainstorm khi user gọi `/brainstorm` tường minh. `AI_RULES.md` và quyền delegation hiện tại vẫn có ưu tiên cao hơn workflow.

---

## 🟢 PHASE 1: Domain Discovery

- Inspect only the source/docs needed to identify current behavior, constraints, and affected boundaries.
- Use an explorer subagent only when codebase discovery is substantial, independently scoped, and delegation is available/authorized.

## 🟠 RESEARCH MODE GATE

- Main giao một câu hỏi nghiên cứu có phạm vi rõ ràng cho `researcher` sẵn có khi cần so sánh nguồn, xử lý bằng chứng mâu thuẫn hoặc tìm phản ví dụ; không tự lặp lại nghiên cứu đó. Dữ kiện đơn giản Main tự tra; nếu không có Researcher phù hợp hoặc không thể đọc nguồn an toàn, nêu rõ giới hạn và không giả định đã nghiên cứu.
- Load `.agent/skills/research/SKILL.md` before web research.
- Set `mode: FOCUSED` by default and read only `.agent/skills/research/references/focused.md`.
- Before browsing, prepare one in-memory research brief with one decision, at most 3 decision-changing questions, relevant constraints, and explicit exclusions.
- Analysis returns an answer with citations; do not persist the brief, evidence ledger, or options automatically, including when the research skill suggests an artifact.
- If the request reduces to one isolated factual question, stop this workflow and route it to `mode: LOOKUP`.
- DO NOT escalate to `mode: DEEP` unless the user explicitly requests deep research.
- Source budgets are upper bounds, not completion targets; stop as soon as the decision-changing claims have sufficient evidence.

## 🟡 PHASE 2+3: Ideation & Self-Critique

- Develop 2-3 materially distinct options. Parallelize one option per agent only when the option lanes are independent and delegation is justified:
  - **Option A**: Conservative/Safe.
  - **Option B**: Modern/Aggressive.
  - **Option C**: Creative/Out-of-the-box.
- Evaluate each option through three lenses:
  1. Fatal flaws / edge-case / over-engineering (góc nhìn skeptic).
  2. Vi phạm giới hạn hệ thống: performance, security, cost, scalability (góc nhìn constraint).
  3. Trải nghiệm người dùng: tốc độ, độ phức tạp khi dùng (góc nhìn user).
- Output: concise Pros / Cons / Risks with mitigation / Effort.
- If subagents are used, synthesize their bounded summaries; the coordinator owns the final comparison.

### Design Decision Gate (bắt buộc cho mỗi option)

Một option chưa trả lời được 5 câu này thì chưa đủ tư cách vào bảng so sánh Phase 4.
Mỗi câu 1-2 dòng, không có thì ghi `n/a` kèm lý do.

1. **Why this design** - vì sao chọn nó thay vì phương án đơn giản hơn liền kề.
2. **What are the trade-offs** - mất gì để đổi lấy gì (latency, consistency, cost, vận hành).
3. **What can break** - failure mode cụ thể, không phải rủi ro chung chung.
4. **How do we operate it** - tín hiệu nào cho biết nó hỏng trên production, rollback ra sao.
5. **How does it evolve** - requirement gần nhất đã biết có phá nó không.

- Câu 5 bị chặn trần bởi `.agent/rules/solution-complexity.md`: kiểm tra thiết kế **không khoá đường mở rộng**, không phải dựng sẵn abstraction cho nhu cầu chưa tồn tại.
Một option ghi điểm ở câu 5 bằng cách thêm generic layer là dấu hiệu over-engineering, phải bị bắt ở lens 1.
- Option chạm risk surface production (transaction, external call, broker, job, bảng lớn, endpoint public, migration) thì soi thêm bằng mục tương ứng trong `.agent/rules/architecture-review.md`.

## 🔵 PHASE 4: Synthesis

- **Action**: Tổng hợp các option đã phân tích thành bảng so sánh, kèm evidence, citation, confidence và câu hỏi còn mở.
- **Trong chat**: Trả lời đủ để user quyết định, gồm trade-off và recommendation có bằng chứng.
- **Persistence**: Chỉ khi user yêu cầu lưu nghiên cứu, ghi một artifact tại `.agent/artifacts/` chứa research, citations và option analysis độc nhất.
Không ghi vào `reports/artifacts`, không tự tạo PLAN, implementation_plan, walkthrough hoặc handoff lặp lại.
Nếu đã lưu theo yêu cầu, chat chỉ tóm tắt và dẫn tới artifact, không chép lại toàn bộ.

## 🔴 PHASE 5: Recommendation & Handoff

- **Action**: Đưa ra **1 đề xuất chuyên môn** tốt nhất, giải thích ngắn gọn lý do so với 2 option còn lại.
- **Action**: Hỏi user chọn Option nào (A/B/C).

## 🟣 PHASE 6: Orchestrated Execution (Optional)

**Trigger**: Chỉ khi user yêu cầu triển khai và đã chọn option; nhu cầu nhiều specialist không tự cấp quyền viết.

- **Input bắt buộc**: Option đã chọn, scope boundaries, risk checkpoints (lấy từ Phase 4).
- **Execution**: Route sang lệnh `/orchestrate` với Option đã chọn làm execution brief.
- **Ownership**: Giữ brief trong handoff, không tạo file mới nếu không cần resume.
Single-slice chỉ dùng compact contract/checkpoint khi cần handoff/resume; multi-slice dùng `00-OVERVIEW.md` và canonical `TASK-*.md` theo `/plan`.
Governed manifest được derive từ TASK metadata, không viết tay.
Packet dẫn tới contract snapshot identity và supersession; chỉ coordinator cập nhật overview lifecycle, overview không chép acceptance từ TASK.

---

## Brainstorming Rules:

- **No Code**: Focus strictly on architecture, logic, and trade-offs. Do not write implementation code.
- **Honest Tradeoffs**: Don't hide complexity or sugar-coat risks.
- **No fake personas**: Use structured review lenses locally; delegate only when it creates real independent work.
- **Write once, only when requested**: Không tự lưu analysis; artifact được yêu cầu giữ nội dung độc nhất, chat chỉ tóm tắt và dẫn nguồn.
- **User-Centric**: Tailor solutions to the user's specific context.

---

## Examples:

- `/brainstorm state management strategy`
- `/brainstorm database schema for social media`
- `/brainstorm UI design system for mobile`
