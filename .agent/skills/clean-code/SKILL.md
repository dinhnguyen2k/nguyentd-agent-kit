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
| User asks for feature | Write it directly |
| User reports bug | Fix it, don't explain |
| No clear requirement | Ask, don't assume |
| Request has a flaw | Say it in 1-2 sentences, then **build it anyway** under stated assumptions |
| User reaffirms after pushback | That's their call. Proceed with the full request, no re-litigating. |

> Pushback is a sentence, not a negotiation. Never hold work hostage to an objection.

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

> 🔴 **Rule:** Edit the file + all dependent files in the SAME task.
> 🔴 **Never leave broken imports or missing updates.**

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

**Before saying "task complete", verify:**

| Check | Question |
|-------|----------|
| ✅ **Goal met?** | Did I do exactly what user asked? |
| ✅ **Files edited?** | Did I modify all necessary files? |
| ✅ **Code works?** | Did I test/verify the change? |
| ✅ **No errors?** | Lint and TypeScript pass? |
| ✅ **Nothing forgotten?** | Any edge cases missed? |
| ✅ **Diff justified?** | Read the actual diff, not the plan. Every changed line traces back to the request? Any single-caller abstraction, dead code, unused import, or block deletable with no behavior change — tag it FLAG/NOTE and cut it before reporting done. |
| ✅ **Assumptions stated?** | What did I decide on the user's behalf? Say it out loud. |
| ✅ **Highest level checked?** | Did I stop at style (L4) while an L2/L3 flaw stands? |
| ✅ **Concurrency & failure?** | Two users at once, retry, partial write, empty/null input? |
| ✅ **Reversible?** | Migration, stored format, public contract — can we undo this? |
| ✅ **Honest report?** | Untested = say "untested". Skipped = say skipped. No hedging both ways. |

> 🔴 **Rule:** If ANY check fails, fix it before completing.
> 🔴 **Never report "done" for work you did not verify.**

---

## Verification Scripts (MANDATORY)

> 🔴 **CRITICAL:** Each agent runs ONLY their own skill's scripts after completing work.

## 🧠 Knowledge Modules (Fractal Skills)

### 0. [🔥 Critical Review Protocol](./sub-skills/critical-review-protocol.md) — failure-mode sweep, steel-manning, disagreement resolution
### 1. [Agent → Script Mapping](./sub-skills/agent-script-mapping.md)
### 2. [🔴 Script Output Handling (READ → SUMMARIZE → ASK)](./sub-skills/script-output-handling-read-summarize-ask.md)
### 3. [❌ Errors Found (X items)](./sub-skills/errors-found-x-items.md)
### 4. [⚠️ Warnings (Y items)](./sub-skills/warnings-y-items.md)
### 5. [✅ Passed (Z items)](./sub-skills/passed-z-items.md)
