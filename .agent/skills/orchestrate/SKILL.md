---
name: orchestrate
description: "Route governed Cogain work to the right specialist with explicit ownership and independent evidence. Use when orchestrating complex, cross-domain, or high-risk tasks between backend and frontend."
---

# /orchestrate - Explicit Lane Ownership

Use this workflow when the user explicitly asks for orchestration or the task is
cross-domain, high-risk, parallel, or likely to require a long handoff. Do not
invoke it for ordinary local work.

## 1. Classify Before Loading Context

| Tier | Conditions | Required process |
| --- | --- | --- |
| `fast` | One existing domain, local behavior, no risky label | Route directly; source + nearest test/pattern; source evidence, named checks only |
| `standard` | One owner, multiple local files, no risky label | Short task summary; selective context; source evidence, named checks only |
| `governed` | Cross-domain, public contract, migration, permission, money, inventory, production, parallel write, or long handoff | Derived manifest, disjoint ownership, source evidence, independent verifier when requested |

If a task can be handled as `fast` or `standard`, stop tier escalation here and
use the routed specialist. A formal plan, manifest, or extra agent is not a quality signal by
itself.
Fast/standard remain intentional standalone, user-owned lanes, not automatically governed.
Main coordinates specialists directly with concise `allowed_paths`, `Reuse`, and `Acceptance` and accepts source evidence without a mandatory review gate; this alone does not require a governed manifest or independent verifier.

- Mặc định giao specialist triển khai code theo `AI_RULES.md` §6, kể cả task nhỏ, một slice hoặc thay đổi thuần cơ học.
- Main chỉ code khi user giao rõ làm trực tiếp tại Main cho task hiện tại; `gấp`, ít dòng, giải pháp đã rõ hoặc yêu cầu sửa chung không cấp quyền, quyền task trước không tự áp cho task sau.
- Không thể dispatch specialist thì báo blocker, không tự chuyển sang Main code.
- Xác nhận lại source nếu đã thay đổi; gửi delta nếu file đang thuộc worker.
- Giữ một owner cho cùng luồng/context; gom bước sửa thành checklist, không tạo worker theo từng method/finding.
- Chia luồng dài thành milestone có acceptance; chỉ nạp source cho milestone hiện hành và dependency trực tiếp.
- Khi runtime báo giới hạn context/request, checkpoint rồi quyết định continuation hoặc handoff; không suy phần trăm context từ request budget.

Read-only returns answer/citations without persisted artifacts absent explicit write permission.
Single-slice uses compact canonical contract/checkpoint only for handoff/resume or writer dispatch; multi-slice uses overview + TASK.
Scope/acceptance live only in canonical TASK; overview owns lifecycle/supersession and coordination/index state, updated only by the coordinator.
No repetitive PLAN, implementation_plan, walkthrough, or handoff.
Preserve unique user-requested product docs/runbooks/rollback/diagrams; requested research persists only in `.agent/artifacts`, never new reports/artifacts writes.

## 2. Governed Task Contract

Reuse canonical TASK/overview contracts and helper interfaces documented in `.agent/workflows/plan.md` and `.agent/workflows/orchestrate.md`.
Exactly one `json task-contract` fence per TASK and one `json task-lifecycle` fence in same-directory overview follow `.agent/contracts/task-manifest.schema.json`; coordinator keeps version/lifecycle agreement.
`readTaskContract(repoRoot, contractPath)` and `deriveTaskManifest(contract)` in `.agent/scripts/task-contract.mjs` produce governed v2 snapshots from TASK metadata, never separately editable acceptance/scope. Never hand-edit a generated manifest.
The documented `manifest --contract <TASK> --output <manifest>` CLI requires user generation permission; no hand-editing generated manifests.

- Chỉ tách worker khi độc lập về vùng đọc/ghi và không dùng chung core service lớn, transaction, lifecycle hoặc contract đang biến động; chỉ cho phép dùng chung interface chỉ đọc đã chốt, giữ `allowed_paths` tách biệt.
- Backend/frontend contract work is sequenced unless ownership is truly disjoint.
- No worker may merge, deploy, or execute destructive production actions.
- Require human approval for breaking, destructive, or product-decision changes.

## 3. Execute and Verify

1. Main giao trực tiếp brief thực thi của slice trong `tasks[].task` theo `.agent/workflows/plan.md`, kèm dòng `contract_ref:` và `contract_version`; không chỉ yêu cầu worker đọc TASK.
   Brief trích đúng canonical version, gồm điểm sửa/cách sửa, phạm vi, reuse, acceptance và giới hạn; prerequisite được giao bằng kết luận đã nghiệm thu cùng vị trí source cần dùng.
   Worker đọc source/nearest tests/pattern và context bắt buộc để xác nhận, không ghép yêu cầu từ chuỗi TASK/overview/lịch sử; kiểm tra canonical identity của governed gate vẫn giữ nguyên.
   Packet snapshot carries task/slice/ref/version, contract/lifecycle hashes and repo/worktree/source identity from `computeSourceIdentity(repoRoot, sourcePaths)`, not a second source of scope/acceptance.
   Supersede packet when those inputs change; do not resume inactive, blocked, archived, or superseded implementation.
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
No automatic CI execution is permitted. When the user explicitly authorizes CI/build validation, `.agent/scripts/ci-parity.sh` is run under the `verifier` or `maintainer` role (`AI_RULES.md` §2); guard R8 blocks direct builds by main/worker.

## Failure Conditions

Reject a governed result when any of these occur:

- an unregistered agent, command, script, or tool is required;
- write boundaries overlap without sequencing;
- manifest, validation result, or residual risk is missing;
- a verifier claims success without command/source evidence;
- a worker attempts a merge, deploy, or destructive action without authorization.
