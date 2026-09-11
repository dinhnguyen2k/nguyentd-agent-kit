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

- Load `.agent/skills/research/SKILL.md` before web research.
- Set `mode: FOCUSED` by default and read only `.agent/skills/research/references/focused.md`.
- Before browsing, create one research brief with one decision, at most 3 decision-changing questions, relevant constraints, and explicit exclusions.
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

## 🔵 PHASE 4: Synthesis

- **Action**: Từ 3 bản tóm tắt nhận được, tổng hợp bảng so sánh A/B/C.
- **Trong chat**: chỉ hiển thị bảng rút gọn (không viết lại toàn bộ lý luận của Phase 2+3).
- **Artifact**: Ghi bản đầy đủ (Pros/Cons/Risks/Effort chi tiết) vào 1 file markdown tại thư mục artifacts (ví dụ `brainstorm_options.md`) — đây là nơi DUY NHẤT chứa bản chi tiết, tránh nhân đôi nội dung giữa chat và file.

## 🔴 PHASE 5: Recommendation & Handoff

- **Action**: Đưa ra **1 đề xuất chuyên môn** tốt nhất, giải thích ngắn gọn lý do so với 2 option còn lại.
- **Action**: Hỏi user chọn Option nào (A/B/C).

## 🟣 PHASE 6: Orchestrated Execution (Optional)

**Trigger**: Khi user nói `orchestrate`, `triển khai luôn`, hoặc task cần nhiều specialist làm việc song song.

- **Input bắt buộc**: Option đã chọn, scope boundaries, risk checkpoints (lấy từ Phase 4).
- **Execution**: Route sang lệnh `/orchestrate` với Option đã chọn làm execution brief.

---

## Brainstorming Rules:

- **No Code**: Focus strictly on architecture, logic, and trade-offs. Do not write implementation code.
- **Honest Tradeoffs**: Don't hide complexity or sugar-coat risks.
- **No fake personas**: Use structured review lenses locally; delegate only when it creates real independent work.
- **Write once**: Chi tiết đầy đủ chỉ nằm trong artifact file; chat chỉ hiện bản rút gọn.
- **User-Centric**: Tailor solutions to the user's specific context.

---

## Examples:

- `/brainstorm state management strategy`
- `/brainstorm database schema for social media`
- `/brainstorm UI design system for mobile`
