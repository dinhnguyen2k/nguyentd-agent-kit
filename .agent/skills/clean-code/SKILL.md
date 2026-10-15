---
name: clean-code
description: "Use when reviewing or refactoring code for clarity, duplication, over-engineering, failure modes, or maintainability."
metadata:
  category: "development"
  version: "4.3.0-fractal"
  layer: "master-skill"
---

# Clean Code - Pragmatic AI Coding Standards

> **CRITICAL SKILL** - Be **concise, direct, and solution-focused**.

`AI_RULES.md` and applicable domain rules take precedence over this skill and its linked modules.
Read-only intent permits inspection only; implementation permission covers only requested scope and `allowed_paths`, not validation execution.
Checklists and module headings do not grant execution, test ownership, or wider edit permission.

---

## Core Principles

| Principle | Rule |
|-----------|------|
| **SRP** | Single Responsibility - each function/class does ONE thing |
| **DRY** | Don't Repeat Yourself - extract duplicates, reuse |
| **KISS** | Keep It Simple - simplest solution that works |
| **YAGNI** | You Aren't Gonna Need It - don't build unused features |
| **Boy Scout** | Leave code cleaner than you found it |

> **These are heuristics, not laws.** Every one has a cost. Applying them blindly
> is its own anti-pattern — see [When The Rules Are Wrong](#when-the-rules-are-wrong).

Apply Boy Scout, SRP, DRY, size limits and cleanup only within the requested change and allowed paths.
Do not remove unrelated user changes or add refactors merely to satisfy a heuristic.

---

## When The Rules Are Wrong

> A reviewer who only quotes rules is a linter. Know the counter-force of each.

| Principle | Cost when over-applied | Prefer the opposite when |
|-----------|------------------------|--------------------------|
| **DRY** | Couples unrelated callers through a shared abstraction; one change breaks 5 features | The duplicates are *coincidental* (same shape today, different reasons to change). Duplicate until the 3rd occurrence proves the rule. |
| **SRP** | Shatters one workflow across 8 files; reading it needs 8 jumps | The "responsibilities" always change together and never get reused separately |
| **KISS** | Simple-now becomes a rewrite when the known-certain requirement lands | The complexity is *already funded*: a signed requirement, a hard constraint (concurrency, multi-tenant, auth) |
| **YAGNI** | Deletes seams that are cheap now and expensive later (interfaces at I/O edges, migration reversibility, versioned APIs) | Reversal cost is asymmetric — data loss, public contracts, stored formats. YAGNI applies to *features*, not to *irreversible decisions*. |
| **Small functions** | Indirection tax; logic becomes unfollowable | The steps are meaningless in isolation and always execute together |
| **Guard clauses** | 12 early returns hide the happy path | Conditions are genuinely a decision *tree*, not a filter chain |

> **Rule:** Name the trade-off you accepted, don't pretend there wasn't one.

---

## Naming Rules

| Element | Convention |
|---------|------------|
| **Variables** | Reveal intent: `userCount` not `n` |
| **Functions** | Verb + noun: `getUserById()` not `user()` |
| **Booleans** | Question form: `isActive`, `hasPermission`, `canEdit` |
| **Constants** | SCREAMING_SNAKE: `MAX_RETRY_COUNT` |

> **Rule:** If you need a comment to explain a name, rename it.

---

## Function Rules

| Rule | Description |
|------|-------------|
| **Small** | Max 20 lines, ideally 5-10 |
| **One Thing** | Does one thing, does it well |
| **One Level** | One level of abstraction per function |
| **Few Args** | Max 3 arguments, prefer 0-2 |
| **No Side Effects** | Don't mutate inputs unexpectedly |

---

## Code Structure

| Pattern | Apply |
|---------|-------|
| **Guard Clauses** | Early returns for edge cases |
| **Flat > Nested** | Avoid deep nesting (max 2 levels) |
| **Composition** | Small functions composed together |
| **Colocation** | Keep related code close |

---

## AI Coding Style

| Situation | Action |
|-----------|--------|
| User asks for feature | Implement the requested behavior within scope and hard rules |
| User reports bug | Inspect the real flow and evidence, then fix the root cause within scope |
| No clear requirement | Read available source/spec first; ask only for unresolved business, scope or policy decisions |
| Request has a flaw | State the failure scenario briefly; resolve technical choices from evidence and hard rules, not guessed assumptions |
| User reaffirms after pushback | Proceed within hard rules and established contracts; reaffirmation does not authorize guessing or extra execution |

Keep pushback concise and solution-focused.
Never invent symbols, fields, defaults or contracts not established by source/spec.
If required evidence is unavailable, stop that part and report the missing prerequisite to Main/user; continue reachable work that does not depend on it.

---

## Critique Ladder (Go Up, Not Just Down)

> Most reviews stop at level 4. The expensive mistakes live at levels 1-3.

| # | Level | The question to ask |
|---|-------|---------------------|
| **1** | **Problem** | Is this the real problem, or a symptom? What breaks for the user if we ship nothing? |
| **2** | **Requirement** | What's the actual invariant/rule? Which cases are undefined? Who decides? |
| **3** | **Design** | Where does this state live? Who owns it? What's the failure mode — partial write, retry, concurrent edit? Is it reversible? |
| **4** | **Implementation** | Naming, size, nesting, duplication (everything above in this file) |
| **5** | **Operation** | How do we know it broke in prod? Migration/rollback path? Cost at 100x data? |

**Escalation rule:** a level-3 flaw makes level-4 polish worthless. Report the highest
level you found first.

---

## How To Raise An Objection

**Weak (delete this):** "This could be cleaner", "consider using a factory", "not best practice".

**Strong — 4 parts, ~3 lines:**

```
[BLOCK] OvertimeRequestService.Approve() — line 88
Claim:   Status is read, then written without a version/row lock.
Break:   Two approvers click at once → second overwrites first, audit log loses one.
Fix:     Optimistic concurrency on RowVersion, or UPDATE ... WHERE Status = 'Pending'.
```

| Severity | Meaning | Action |
|----------|---------|--------|
| **BLOCK** | Data loss, security, wrong results, breaks a caller | Must fix before done |
| **FLAG** | Will hurt within weeks: hidden coupling, silent failure, N+1 | Fix now or record why not |
| **NOTE** | Taste, naming, structure | Mention once, don't insist |

**Rules of engagement:**
- Every claim needs a **concrete failure scenario** (inputs → wrong outcome). No scenario = it's a NOTE.
- Attack the code and the decision, never the person.
- Max ~3 NOTEs. Bikeshedding buries the BLOCK.
- If you can't name what breaks, you don't have an objection — you have a preference.

---

## Anti-Patterns (DON'T)

| ❌ Pattern | ✅ Fix |
|-----------|-------|
| Comment every line | Delete obvious comments |
| Helper for one-liner | Inline the code |
| Factory for 2 objects | Direct instantiation |
| utils.ts with 1 function | Put code where used |
| "First we import..." | Just write code |
| Deep nesting | Guard clauses |
| Magic numbers | Named constants |
| God functions | Split by responsibility |

These fixes are heuristics within scope, not automatic deletion rules.
Single-caller abstractions can preserve real I/O, testability or independent-change boundaries; weigh evidence and counter-forces before inlining.

---

## 🔴 Before Editing ANY File (THINK FIRST!)

**Before changing a file, ask yourself:**

| Question | Why |
|----------|-----|
| **What imports this file?** | They might break |
| **What does this file import?** | Interface changes |
| **What tests cover this?** | Tests might fail |
| **Is this a shared component?** | Multiple places affected |

**Quick Check:**
```
File to edit: UserService.ts
└── Who imports this? → UserController.ts, AuthController.ts
└── Do they need changes too? → Check function signatures
```

> 🔴 **Rule:** Inspect affected callers and migrate necessary dependent files within requested scope and `allowed_paths`.
> 🔴 **Never leave broken imports or missing updates.**
If a required caller update is outside the boundary, report the needed scope to Main/user before applying a breaking change; do not edit outside it or deliver a broken cutover.

Regression coverage remains mandatory for money, permissions, inventory and legal-record invariants under `AI_RULES.md` §9 and `.agent/rules/test-enforcement.md`.
Test authorship belongs to `test-author`, not the production-code writer; coordinate required coverage through Main from the same spec.
Test execution is on-demand under those rules and role boundaries, independently of authorship or coverage obligations.
Report `test-spec-conflict` and stop when a test contradicts the spec; do not weaken assertions to match implementation.
An advisor can inform choices but replaces neither clean-code review nor test duties.

---

## Summary

| Do | Don't |
|----|-------|
| Write code directly | Write tutorials |
| Let code self-document | Add obvious comments |
| Fix bugs immediately | Explain the fix first |
| Inline small things | Create unnecessary files |
| Name things clearly | Use abbreviations |
| Keep functions small | Write 100+ line functions |

> **Remember: The user wants working code, not a programming lesson.**

---

## 🔴 Self-Check Before Completing (MANDATORY)

**Before completing source work, review the changed source and affected flow:**

| Check | Question |
|-------|----------|
| ✅ **Goal met?** | Did I do exactly what user asked? |
| ✅ **Files edited?** | Are necessary updates complete within scope, with out-of-boundary dependencies escalated? |
| ✅ **Behavior supported?** | Does source/flow evidence support the requested behavior, and what remains unverified? |
| ✅ **Known errors?** | Did I address observed errors within scope and role, without running unrequested lint/typecheck/tests? |
| ✅ **Nothing forgotten?** | Any edge cases missed? |
| ✅ **Diff justified?** | Review actual changed source, not just the plan. Does every changed line trace back to the request? Remove only obsolete code/imports caused by this change within scope; weigh abstraction counter-forces and preserve unrelated changes. |
| ✅ **Decisions grounded?** | Are technical choices supported by evidence, with unresolved business/scope/policy decisions escalated rather than guessed? |
| ✅ **Coverage duty?** | Is required invariant/regression coverage accounted for through `test-author`, separately from execution permission? |
| ✅ **Highest level checked?** | Did I stop at style (L4) while an L2/L3 flaw stands? |
| ✅ **Concurrency & failure?** | Two users at once, retry, partial write, empty/null input? |
| ✅ **Reversible?** | Migration, stored format, public contract — can we undo this? |
| ✅ **Honest report?** | Distinguish source implemented from verified; claim verified only with actual authorized command/result evidence. Without a validation request, report `Validation: not run - not requested`. |

Fix source defects within scope before handing off; escalate blockers requiring another role, missing evidence or wider scope.
Unrequested validation is not a failed check and does not block completion of source work.
Do not wait for, run, or imply successful validation merely to satisfy this checklist.

---

## Verification Scripts (ON-DEMAND)

Run only the explicitly authorized action and scope under `AI_RULES.md` §2 and the applicable role/domain rules.
Script mappings identify relevant tools, not permission to execute them.
Do not run scripts automatically after editing or treat unrequested execution as a completion prerequisite.

## 🧠 Knowledge Modules (Fractal Skills)

Read modules only when their trigger fits the current task: critical review for failure-mode/design objections; script mapping for authorized validation selection; output/error/warning/passed modules for actual available results.
Do not auto-load or auto-run modules because their headings say MANDATORY.
If linked guidance conflicts with hard rules on scope, evidence, ownership or execution, follow the hard rules; do not amend sub-skills outside the assigned boundary.

### 0. [🔥 Critical Review Protocol](./sub-skills/critical-review-protocol.md) — failure-mode sweep, steel-manning, disagreement resolution
### 1. [Agent → Script Mapping](./sub-skills/agent-script-mapping.md)
### 2. [🔴 Script Output Handling (READ → SUMMARIZE → ASK)](./sub-skills/script-output-handling-read-summarize-ask.md)
### 3. [❌ Errors Found (X items)](./sub-skills/errors-found-x-items.md)
### 4. [⚠️ Warnings (Y items)](./sub-skills/warnings-y-items.md)
### 5. [✅ Passed (Z items)](./sub-skills/passed-z-items.md)
