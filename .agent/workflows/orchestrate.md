---
name: orchestrate
description: Route governed work to the right specialist with explicit ownership and independent evidence.
---

# /orchestrate - Explicit Lane Ownership

$ARGUMENTS

## Classification

| Tier | Conditions | Required process |
| --- | --- | --- |
| `fast` | One existing domain, local behavior, no risky label | Route directly; source + nearest test/pattern; source evidence, named checks only |
| `standard` | One owner, multiple local files, no risky label | Short task summary; selective context; source evidence, named checks only |
| `governed` | Cross-domain, public contract, migration, permission, money, inventory, production, parallel write, or long handoff | Task Manifest, disjoint ownership, source evidence, independent verifier when requested |

If a task can be handled as `fast` or `standard`, stop tier escalation here and
use the routed specialist. A formal plan, manifest, or extra agent is not a quality signal by
itself.
Fast/standard remain intentional standalone, user-owned lanes, not automatically governed.
Main coordinates specialists directly with concise `allowed_paths`, `Reuse`, and `Acceptance` and accepts source evidence without a mandatory review gate; this alone does not require a governed manifest or independent verifier.

- Main tự sửa thay đổi thuần cơ học khi đã có source trong context, biết chính xác vị trí/phép biến đổi và không đổi hành vi hoặc quyết định nghiệp vụ; không tạo TASK/worker riêng.
- Xác nhận lại source nếu đã thay đổi; không coi ít dòng là cơ học. Giao logic cho specialist; gửi delta nếu file đang thuộc worker.
- Giữ một owner cho cùng luồng/context; gom bước sửa thành checklist, không tạo worker theo từng method/finding.
- Chia luồng dài thành milestone có acceptance; chỉ nạp source cho milestone hiện hành và dependency trực tiếp.
- Khi runtime báo giới hạn context/request, checkpoint rồi quyết định continuation hoặc handoff; không suy phần trăm context từ request budget.

Read-only returns answer/citations without persisted artifacts absent explicit write permission.
Single-slice uses compact canonical contract/checkpoint only for handoff/resume or writer dispatch; multi-slice uses overview + TASK.
Scope/acceptance live only in canonical TASK; overview owns lifecycle/supersession and coordination/index state, updated only by the coordinator.
No repetitive PLAN, implementation_plan, walkthrough, or handoff.
Preserve unique user-requested product docs/runbooks/rollback/diagrams; requested research persists only in `.agent/artifacts`, never new reports/artifacts writes.

## Rules

1. Main chỉ dispatch sau khi đủ Điều kiện dispatch; giải quyết quyết định mở và nghiệm thu prerequisite trước slice phụ thuộc.
   Dispatch/packet theo protocol tại plan; worker chỉ nhận contract hiện hành, đọc source/pattern/tests theo risk và triển khai recipe.
   Source trái contract, thiếu symbol hoặc dependency không đáp ứng invariant thì trả Main; không redesign hoặc ghép acceptance từ TASK cha/lịch sử.
2. The worker returns source evidence and validation status. It runs a command only
   when the user explicitly authorized that action and scope.
3. The coordinator verifies returned source evidence against canonical TASK `allowed_paths`, `Reuse`, and `Acceptance`. Code review runs only when explicitly requested by the user; old packets/timestamps, blocked-user, or waived states do not certify pass.
4. When independent verification is active for governed work or explicitly requested, the read-only `verifier` checks the derived v2 manifest against canonical TASK and independently checks criteria, returning
   `pass`, `fail`, or `blocked` with evidence.
5. Rework bằng continuation đúng agent handle/session hiện hữu; không spawn mới rồi gắn lại tên owner.
   Chỉ gửi delta: finding, phần còn lại, source/version thay đổi và invariant cần giữ; không gửi lại toàn bộ assignment/lịch sử.
   Không resume được thì ghi nhận chuyển giao sang worker mới; không gọi đó là resume hoặc suy rằng có cache hit.
   On `blocked`, preserve the reason as a residual risk and request the missing authority/input.

For every lane, **DO NOT RUN build, lint, typecheck, format, restore, code generation,
tests, or browser checks automatically. ON-DEMAND ONLY.** Add a command to the
manifest only when the user explicitly requests that validation action by name.
The manifest, governed classification, or verifier role cannot grant permission on
the user's behalf. Otherwise report `implemented - validation not requested` and
perform only read-only source/criteria review.
No automatic CI or validation execution is permitted. When the user explicitly authorizes validation,
run only the named action/command (e.g. `php -l`, `composer validate`, `/test`) requested by the user.
Do not infer validation pass from unexecuted, blocked-user, or waived states.

## Supersession - chỉ đọc khi contract/lifecycle/source thay đổi

Đây là reference cho coordinator xử lý outstanding supersession, không phải nội dung phải sinh trong plan/TASK hoặc đưa cho worker.
Không tự kích hoạt review, generation hoặc publish khi chưa có quyền tương ứng.

1. **Detection**:
   - Contract change: prose, scope, acceptance, metadata hoặc allowed_paths trong TASK đổi -> tăng `contract_version` tại TASK và cập nhật `contract_versions[task_id]` tại lifecycle của overview.
   - Lifecycle change: status, blocker, next_action hoặc snapshot trong overview đổi -> tăng lifecycle revision/hash.
   - Source change: hash của sourcePaths tính bởi `computeSourceIdentity` không khớp hash ghi trong snapshot.
2. **Impact Analysis**:
   - Khi một trong ba yếu tố trên thay đổi, snapshot hiện tại bị invalidate ngay lập tức.
   - Task đang chạy (active) bị coi là stale/superseded; worker không được tiếp tục sửa trên contract cũ.
3. **Execution**:
   - Coordinator cập nhật trạng thái `superseded` cho packet cũ, ghi nhận lý do thay đổi.
   - Phát sinh snapshot/manifest v2 mới với version mới.
   - Handoff sang worker bằng delta: chỉ gửi phần thay đổi giữa contract mới và cũ, không gửi lại toàn bộ lịch sử.
