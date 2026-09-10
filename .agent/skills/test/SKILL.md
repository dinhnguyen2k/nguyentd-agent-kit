---
name: test
description: "Viết test tự động theo chuẩn TDD Master. Use when creating automated unit/integration tests, verifying fixes, or setting up test coverage."
---

# /test - TDD & Verification Suite

$ARGUMENTS

---

## 🟢 PHASE 1: Code Analysis & Edge Case Mapping
**Execution role**: `testing role`
**Mission**: Map the "Search Space" of potential bugs.
- **Action**: Identify all public functions, API routes, and logic branches.
- **Discovery**: Generate a "Gherkin" style list of test scenarios (Given/When/Then).

## 🟡 PHASE 2: Test Architecture & Mocking
**Execution role**: `testing role`
**Mission**: Build the testing base.
- **Action**: Configure mocks for DB, External APIs, and system clock.
- **Artifact**: Write a Test Plan in the `implementation_plan.md`.

## 🔵 PHASE 3: Execution (The RED-GREEN Loop)
**Execution role**: `qa-automation-engineer`
**Mission**: Automate the verification.
- **Action**: Write and run unit, integration, and E2E tests.
- **Audit**: Every test must fail at least once (verify the test is valid).

## 🔴 PHASE 4: Coverage & Quality Sign-off
**Execution role**: `verification role`
**Mission**: Verify the safety net.
- **Action**: Check code coverage metrics.
- **Artifact**: Report Pass/Fail stats in the final `walkthrough.md`.

---

## Patterns of Excellence:
- **One Assertion**: Each test tests one thing.
- **Fast Feedback**: Unit tests should run in <1s.
- **Hermeticity**: Tests must not share state or depend on network.

---

## Examples:
- `/test auth service`
- `/test coverage src/utils`
- `/test fix failed tests`
