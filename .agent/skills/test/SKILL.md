---
name: test
description: "Viết test tự động theo chuẩn TDD Master. Use when creating automated unit/integration tests, verifying fixes, or setting up test coverage."
---

# /test - TDD & Verification Suite

$ARGUMENTS

---

## Quyền thực thi và artifact ownership

- Ý định chỉ đọc chỉ trả lời cùng citations, không ghi artifact nếu user chưa cấp riêng quyền ghi.
- Viết/sửa test thuộc `test-author`; chạy test/coverage thuộc `verifier` hoặc `test-author` khi user yêu cầu rõ hành động và scope.
- Không suy ra quyền chạy từ kế hoạch, risk level hay yêu cầu bàn giao; production writer không sửa test, test trái spec thì dừng với `test-spec-conflict`.
- Single-slice chỉ lưu compact contract/checkpoint nếu cần handoff/resume; multi-slice dùng `.agent/planning/{task-slug}/00-OVERVIEW.md` và `TASK-*.md`.
- Scope/acceptance chỉ nằm trong canonical TASK với metadata `task-contract`; reuse `.agent/scripts/task-contract.mjs`, không tạo parser riêng.
- Chỉ coordinator cập nhật overview lifecycle/state, không sao chép acceptance vào overview.
- Governed manifest được derive từ TASK metadata, không sửa tay; packet bàn giao mang contract snapshot identity và supersession để không dùng contract cũ.
- Kịch bản, command thực sự chạy, kết quả RED/GREEN, Pass/Fail, coverage và giới hạn kiểm chứng được trả trong câu trả lời hoặc liên kết evidence đã được phép lưu.
- Chỉ lưu nghiên cứu khi user yêu cầu tại `.agent/artifacts`; không tạo `implementation_plan.md`, `walkthrough.md` hay report lặp scope/acceptance.
- Không sửa immutable CI/validation evidence; dẫn đúng log/summary nguồn thực tế nếu có.

## 🟢 PHASE 1: Code Analysis & Edge Case Mapping
**Execution role**: `test-author`
**Mission**: Map the "Search Space" of potential bugs.
- **Action**: Identify all public functions, API routes, and logic branches.
- **Discovery**: Generate a "Gherkin" style list of test scenarios (Given/When/Then).

## 🟡 PHASE 2: Test Architecture & Mocking
**Execution role**: `test-author`
**Mission**: Build the testing base.
- **Action**: Configure mocks for DB, External APIs, and system clock.
- **Evidence**: Gắn scenarios và mocking strategy vào contract/checkpoint hiện có khi cần handoff, hoặc trả trực tiếp; không tạo Test Plan lặp TASK.

## 🔵 PHASE 3: Execution (The RED-GREEN Loop)
**Execution role**: `test-author` (viết test), `verifier` / `test-author` (chạy khi được phép)
**Mission**: Automate the verification.
- **Action**: Viết unit, integration tests trong scope được cấp; chỉ chạy khi có quyền execution riêng và test runner (như PHPUnit) thực sự đã được cài đặt trong project. Không bịa đặt kết quả chạy test khi chưa có test runner.
- **Audit**: Khi được phép chạy và có test runner, ghi bằng chứng RED rồi GREEN để xác nhận test; nếu chưa có test runner hoặc chưa được phép chạy, ghi nhận `Validation: not run - test runner not configured / not requested`.

## 🔴 PHASE 4: Coverage & Quality Sign-off
**Execution role**: `verifier`
**Mission**: Verify the safety net.
- **Action**: Đọc coverage evidence hiện có; chỉ chạy coverage khi user yêu cầu.
- **Evidence**: Trả Pass/Fail stats, coverage, command/scope đã chạy và rủi ro còn lại; nếu chưa được phép chạy ghi `Validation: not run - not requested`.

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
