---
name: debug
description: "Gặp lỗi khó sửa? AI soi log và sửa theo quy trình chuyên nghiệp. Use when investigating bugs, analyzing error logs, or debugging complex issues."
---

# /debug - Action-Oriented Debugging Workflow

$ARGUMENTS

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
- **Action**: Ask the user to reproduce with the new instrumentation.

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

## 🔴 PHASE 4: Verification & Post-Mortem

**Execution role**: `testing role` & `verification role`
**Mission**: Ensure the "Bleeding" has stopped.

- **Action**: Run the failing test case to confirm FIX.
- **Reporting**: Add to `.planning/errors/ERRORS.md` only for a material new incident; create extra artifacts only when requested or useful for handoff.

---

## Output Format:

```markdown
## 🐞 Debug Report: [Bug Title]

### Root Cause

[One sentence explanation]

### The Fix

[Diff or explanation]

### Verification

- [ ] Test case passed
- [ ] No regression found
- [ ] Error logged in ERRORS.md
```

---

## Key Principles:

- **Evidence-First**: Don't guess, use the logs.
- **Regression-Aware**: Every fix must come with a test case to prevent it from returning.
- **Clean Fix**: Don't use "band-aid" fixes unless it's a critical production outage.
