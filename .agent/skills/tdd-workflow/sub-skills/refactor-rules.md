# REFACTOR Rules

- Preserve behavior and existing test expectations; green status requires observed, authorized test execution.
- Small incremental changes
- Do not commit unless the user explicitly requests it.

---

## 6. AAA Pattern

Every test follows:

| Step | Purpose |
|------|---------|
| **Arrange** | Set up test data |
| **Act** | Execute code under test |
| **Assert** | Verify expected outcome |

---

## 7. When to Use TDD

| Scenario | TDD Value |
|----------|-----------|
| New feature | High |
| Bug fix | High (write test first) |
| Complex logic | High |
| Exploratory | Low (spike, then TDD) |
| UI layout | Low |

---

## 8. Test Prioritization

| Priority | Test Type |
|----------|-----------|
| 1 | Happy path |
| 2 | Error cases |
| 3 | Edge cases |
| 4 | Performance |

---

## 9. Anti-Patterns

| ❌ Don't | ✅ Do |
|----------|-------|
| Skip the RED phase | Watch test fail first |
| Write tests after | Write tests before |
| Over-engineer initial | Keep it simple |
| Multiple asserts | One behavior per test |
| Test implementation | Test behavior |

---

## 10. AI-Augmented TDD