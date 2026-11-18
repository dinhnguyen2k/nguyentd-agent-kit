---
name: debug
description: Gặp lỗi khó sửa? Để AI soi log và sửa giúp bạn theo quy trình chuyên nghiệp.
---

# /debug - Action-Oriented Debugging Workflow

$ARGUMENTS

## Permission & Artifact Boundary

- Phân tích lỗi là read-only: trả lời kèm log/source `file:line`, không sửa code, thêm instrumentation hay ghi file nếu chưa được user cấp quyền rõ.
- Không tự chạy reproduction, khởi động app, build, lint, typecheck, test, format hoặc codegen.
  Chỉ thực hiện hành động user đã nêu tên và trong scope được cấp; lỗi user báo là bằng chứng, không chạy lại chỉ để xác nhận.
- Khi được yêu cầu sửa, single-slice chỉ cần compact contract/checkpoint nếu handoff/resume cần nó.
  Multi-slice dùng `.agent/planning/{task-slug}/00-OVERVIEW.md` và `TASK-*.md`; scope/acceptance chỉ editable trong TASK, coordinator sở hữu lifecycle/index/blocker/link evidence trong overview.
- Governed manifest được sinh từ `task-contract` metadata qua `.agent/scripts/task-contract.mjs`, không nhập tay bản sao.
  Packet mang contract version/hash và source snapshot identity; contract đổi thì phát packet mới và supersede packet cũ.
- Không tạo PLAN/implementation_plan/walkthrough/handoff lặp nội dung.
  Research chỉ persist khi user yêu cầu, tại `.agent/artifacts`, không ghi mới vào reports/artifacts.

---

## 🟢 PHASE 1: Forensic Discovery & RCA (The "Crime Scene")

**Skill**: `debugging-master`
**Mission**: Isolate the exact point of failure and formulate a hypothesis.

- **Action**: Read the Stack Trace or Terminal Logs. Locate the failing file:line.
- **Action**: Use "The 5 Whys" to form a hypothesis about the root cause.
- **DNA Link**: Consult `rules/error-logging.md` to see if this is a known recurring issue.

## 🟡 PHASE 2: Strategic Instrumentation (If needed)

**Skill**: `debugging-master`
**Mission**: Gather more evidence if the root cause is unclear.

- **Action**: Suggest strategic debug logging, or breakpoint placement.
- **Action**: Chỉ thêm instrumentation khi có quyền sửa và chỉ reproduce khi user cấp quyền thực thi cụ thể.
  Nếu chưa có evidence cần thiết, nêu giả thuyết và phần chưa xác thực; không tự mở rộng quyền.

## 🟠 PHASE 2.5: Fix Proposal & Risk Critique

**Execution role**: current routed specialist
**Mission**: Evaluate the proposed fix before touching any code.

- **Action**: The specialist proposes a fix.
- **Action**: Check regressions, edge cases, side effects, and whether the hypothesis is falsifiable.
- **Rule**: Do not proceed until material risk is mitigated or reported.

## 🔵 PHASE 3: Surgical Repair

**Execution role**: `backend-specialist` or `frontend-specialist`
**Mission**: Apply the targetted fix based on `debugging-master`'s analysis.

- **Correction**: Apply the smallest root-cause fix; add defensive code only when it preserves the intended contract.
- **Gate**: Chỉ sửa khi user yêu cầu implementation; test do `test-author` sở hữu, không để production writer sửa test.

## 🔴 PHASE 4: Verification & Post-Mortem

**Execution role**: `testing role` & `verification role`
**Mission**: Ensure the "Bleeding" has stopped.

- **Action**: Chỉ chạy failing test khi user yêu cầu chạy test đó; nếu không, ghi `Validation: not run - not requested`.
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
