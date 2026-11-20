---
name: status
description: "Xem Dashboard báo cáo trạng thái dự án chuyên nghiệp. Use when checking project status, summarizing recent tasks, or reporting progress."
---

# /status - Executive Project Dashboard

$ARGUMENTS

## Read-only Boundary

- `/status` chỉ đọc và trả dashboard kèm citations `file:line`/linked evidence trong câu trả lời.
  Không tạo hoặc cập nhật report, TASK, overview, manifest, error log hay artifact nếu user chưa cấp quyền ghi riêng.
- Không chạy app/build/lint/typecheck/test/format/codegen/CI để suy ra health.
  Phân biệt trạng thái được index ghi nhận với kết quả đã quan sát; thiếu evidence thì ghi chưa xác thực, không suy thành passed.

---

## 🟢 PHASE 1: Data Aggregation
**Execution role**: `product-owner` & `codebase discovery role`
**Mission**: Gather the "Pulse" of the project.
- **Action**: Đọc `.agent/planning/{task-slug}/00-OVERVIEW.md` của scope hiện có, theo index tới TASK và linked evidence.
  TASK là nguồn scope/acceptance; overview sở hữu lifecycle/index/blocker/link evidence và chỉ coordinator cập nhật.
  Với single-slice chưa có overview, dùng compact contract/checkpoint hiện có nếu có, không tạo planning file chỉ để báo status.
- **Action**: Đối chiếu `task-lifecycle`, contract version/hash và source snapshot identity của packet/evidence; snapshot superseded hoặc historical không chứng minh trạng thái hiện tại.
  Governed manifest là view sinh từ TASK metadata qua `.agent/scripts/task-contract.mjs`, không sửa hay nhập lại metadata.
- **Action**: Đọc error log khi index link hoặc user yêu cầu recent errors.
  Đọc linked gate/CI evidence immutable; `.agent/reports/ci-parity/logs/<run-id>/summary.json` là bằng chứng run, last-run chỉ là pointer.
  Không đòi `task.md`/`walkthrough.md` và không sửa evidence cũ.
- **Action**: Chỉ dùng git history làm bối cảnh thay đổi, không lấy số commit làm bằng chứng hoàn thành acceptance.

## 🟡 PHASE 2: Logic & Health Assessment
**Execution role**: `product-owner`
**Mission**: Analyze the "Vitals."
- **Checks**:
  - Are milestones being hit?
  - Is technical debt (ERRORS.md) increasing?
  - Is the plan still aligned with the goal?

## 🔵 PHASE 3: Dashboard Synthesis
**Execution role**: `product-owner`
**Mission**: Create a visual overview.
- **Action**: Trình bày dashboard Markdown trong câu trả lời, badge/progress chỉ dựa trên canonical index và evidence đã đọc.

## 🔴 PHASE 4: Professional Reporting
**Execution role**: `integration role`
**Mission**: Deliver the "Executive Summary."
- **Artifact**: A concise, professional message to the User summarizing current state and next immediate steps.
- **Boundary**: Dashboard mặc định không persist.
  Nếu user yêu cầu research persistence, dùng `.agent/artifacts`, không ghi mới vào reports/artifacts; không tạo PLAN/implementation_plan/walkthrough/handoff lặp canonical contract.

---

## Status Indicators:
- 🟢 **Healthy**: On track, no blockers.
- 🟡 **Warning**: Minor delays or increasing errors.
- 🔴 **Blocked**: Critical dependencies or major bugs.

---

## Examples:
- `/status`
- `/status focus on infrastructure`
- `/status show recent errors`
