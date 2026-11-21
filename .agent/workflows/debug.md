---
name: debug
description: Gặp lỗi khó sửa? Để AI soi log và sửa giúp bạn theo quy trình chuyên nghiệp.
---

# /debug - Action-Oriented Debugging Workflow

$ARGUMENTS

## Permission & Artifact Boundary

- Phân tích lỗi là read-only: trả lời kèm log/source `file:line`, không sửa code, thêm instrumentation hay ghi file nếu chưa được user cấp quyền rõ.
- **Khớp `AI_RULES.md` §2 (dòng 21)**: Mặc định điều tra bằng bằng chứng hiện có (stack trace, log, mô tả lỗi user cung cấp) và trace code path tĩnh. **CẤM tự khởi động app, chạy build hoặc chạy test để reproduce bug hay kiểm chứng sau sửa** trừ khi người dùng yêu cầu đích danh lệnh và phạm vi đó.
- Khi được yêu cầu sửa, single-slice chỉ cần compact contract/checkpoint nếu handoff/resume cần nó.
  Multi-slice dùng `.agent/planning/{task-slug}/00-OVERVIEW.md` và `TASK-*.md`; scope/acceptance chỉ editable trong TASK, coordinator sở hữu lifecycle/index/blocker/link evidence trong overview.
- Governed manifest được sinh từ `task-contract` metadata qua `.agent/scripts/task-contract.mjs`, không nhập tay bản sao.
  Packet mang contract version/hash và source snapshot identity; contract đổi thì phát packet mới và supersede packet cũ.
- Không tạo PLAN/implementation_plan/walkthrough/handoff lặp nội dung.
  Research chỉ persist khi user yêu cầu, tại `.agent/artifacts`, không ghi mới vào reports/artifacts.

---

## 🟢 PHASE 1: Forensic Discovery & RCA (The "Crime Scene")

**Skill**: `debug`
**Mission**: Isolate the exact point of failure and formulate a hypothesis from existing evidence and static code-path tracing.

- **Action**: Read the Stack Trace or Terminal Logs. Trace the code path statically to locate the failing `file:line`.
- **Action**: Use "The 5 Whys" to form a hypothesis about the root cause.
- **DNA Link**: Consult `rules/error-logging.md` to see if this is a known recurring issue.

## 🟡 PHASE 2: Strategic Instrumentation (If needed)

**Skill**: `debug`
**Mission**: Gather more evidence if the root cause is unclear.

- **Action**: Suggest strategic debug logging or inspection points.
- **Action**: Chỉ thêm instrumentation khi có quyền sửa và **chỉ reproduce (chạy app/build/test) khi user yêu cầu đích danh** (`AI_RULES.md` §2).
  Nếu chưa có evidence cần thiết, nêu giả thuyết và phần chưa xác thực; không tự mở rộng quyền.

## 🟠 PHASE 2.5: Fix Proposal & Risk Critique

**Execution role**: current routed specialist
**Mission**: Evaluate the proposed fix before touching any code.

- **Action**: The specialist proposes a fix.
- **Action**: Check regressions, edge cases, side effects, and whether the hypothesis is falsifiable.
- **Rule**: Do not proceed until material risk is mitigated or reported.

## 🔵 PHASE 3: Surgical Repair

**Execution role**: `backend-specialist` or `frontend-specialist`
**Mission**: Apply the targeted fix based on `debug` analysis.

- **Correction**: Apply the smallest root-cause fix; add defensive code only when it preserves the intended contract.
- **Gate**: Chỉ sửa khi user yêu cầu implementation; test do `test-author` sở hữu (`R2`, hiện đang tạm khóa tự động theo `AI_RULES.md` §6), không để production writer sửa test.

## 🔴 PHASE 4: Post-Fix Check & Post-Mortem

**Execution role**: `verifier` / `test-author` (chỉ khi user yêu cầu đích danh)
**Mission**: Hand off static evidence or run user-requested verification only.

- **Action**: Kiểm tra chẩn đoán tĩnh (LSP syntax/type/compile) trên file vừa sửa nếu môi trường hỗ trợ. **KHÔNG** tự khởi động app, chạy build hoặc chạy test sau khi sửa; chỉ `verifier`/`test-author` chạy test khi user yêu cầu đích danh (`R1`, `AI_RULES.md` §2). Nếu không có yêu cầu, ghi `Validation: not run - not requested`.
- **Reporting**: Trả debug evidence trong câu trả lời.
  Khi user yêu cầu ghi lỗi, dùng `.planning/errors/ERRORS.md` và `rules/error-logging.md` cho incident material mới; giữ log/root cause/fix và kết quả thực sự quan sát, không secret.
  Link evidence cần thiết từ overview hiện có, không tạo report lặp; gate/CI evidence giữ immutable, không sửa kết quả cũ.

---

## Output Format:

```markdown
## 🐞 Debug Report: [Bug Title]

### Root Cause

[One sentence explanation]

### The Fix

[Diff or explanation]

### Verification

[Chỉ ghi command/kết quả đã thực sự chạy, evidence file:line, giới hạn chưa xác thực và rủi ro còn lại]
[Nếu chưa được yêu cầu: Validation: not run - not requested]
[Error log: path khi được yêu cầu ghi, hoặc not written]
```

---

## Key Principles:

- **Evidence-First**: Don't guess, use the logs.
- **Regression-Aware**: Xác định regression case từ contract/evidence; giao test-author khi được phép sửa test, không ngầm cấp quyền chạy test.
- **Clean Fix**: Don't use "band-aid" fixes unless it's a critical production outage.
