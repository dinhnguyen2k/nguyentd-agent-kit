---
name: orchestrate
description: Route governed Cogain work to the right specialist with explicit ownership and independent evidence.
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
| `governed` | Cross-domain, public contract, migration, permission, money, inventory, production, parallel write, or long handoff | Task Manifest, disjoint ownership, source evidence, independent verifier when requested |

If a task can be handled as `fast` or `standard`, stop tier escalation here and
use the routed specialist. A formal plan, manifest, or extra agent is not a quality signal by
itself.
Fast/standard are intentional standalone, user-owned lanes, not implicitly governed.
Do not add a governed manifest, independent verifier, or multi-slice plan merely to satisfy writer dispatch boundaries.

Ở bậc `fast`/`standard` (một nhánh cục bộ), Main không nạp toàn bộ `.agent/workflows/plan.md` mà giao trực tiếp gói 6 mục gọn cho specialist và nghiệm thu trên bằng chứng mã nguồn mà không cần cổng review bắt buộc:
1. `Mục tiêu & Acceptance`: kết quả quan sát được cần đạt cho luồng chính và nhánh biên/lỗi.
2. `Contract/bất biến đã khóa`: signature, DTO, enum/nullability và hành vi phải giữ nguyên.
3. `Tọa độ path:line & allowed_paths`: danh sách tệp được phép ghi kèm tọa độ khai báo/điểm sửa.
4. `Bằng chứng đã xác minh`: các seam tái sử dụng và điều kiện gọi Main đã kiểm tại ranh giới.
5. `Ngoài phạm vi & skill cần nạp`: phần cấm chạm, giới hạn lệnh kiểm tra và skill miền cần đọc.
6. `Mẫu bàn giao`: tệp đã sửa, chẩn đoán LSP lượt cuối, trạng thái Validation và rủi ro còn lại.

Main chỉ mở `.agent/workflows/plan.md` khi tạo mới/mở rộng màn hình, luồng duyệt, báo cáo (để khóa 5 bất biến nghiệp vụ theo `[skill:cogain-screen-archetypes]`), hoặc khi bước sang bậc `governed` / nhiều slice; worker nhận quyết định đã chốt, không nhận lịch sử suy luận hay discovery còn mở.

Read-only returns answer and source citations only, no files absent explicit write permission.
Single-slice persistence is a compact canonical contract/checkpoint only when handoff/resume or writer dispatch needs it; multi-slice uses overview + TASK.
Only the coordinator updates overview lifecycle/supersession/index/review state; scope/acceptance are editable only in canonical TASK and must not be copied into the overview.
No repetitive PLAN, implementation_plan, walkthrough, or handoff.
Keep unique user-requested product docs, runbooks, rollback and diagrams at their appropriate owner.
Research persists only when requested in `.agent/artifacts`, not reports/artifacts.

## 2. Governed Task Contract

Reuse `.agent/workflows/plan.md` canonical TASK/overview pattern and `.agent/contracts/task-manifest.schema.json` `$defs.contract` / `$defs.lifecycle`.
Follow its metadata/packet protocol; use `readTaskContract` and `deriveTaskManifest` from `.agent/scripts/task-contract.mjs`, not a second parser or editable manifest contract.
Do not repeat scope/acceptance/checks between canonical metadata and prose; generation still needs explicit user authorization.

- Parallel workers may run only with disjoint `allowed_paths` and without coupling to an unsettled Red-Zone business invariant.
- Backend/frontend contract work is sequenced unless ownership is truly disjoint.
- No worker may merge, deploy, or execute destructive production actions.
- Require human approval for breaking, destructive, or Red-Zone product-decision changes (`AI_RULES.md` §3): package any Red-Zone question with evidence-backed recommendation into `Hộp thư Quyết định`, suspend only that blocked branch (and direct dependents), and continue executing ready independent branches without halting the whole run.

## 3. Execute and Verify

1. Main chỉ dispatch sau khi đủ Điều kiện dispatch; giải quyết quyết định mở và nghiệm thu prerequisite trước slice phụ thuộc.
   Dispatch/packet theo protocol tại plan; worker chỉ nhận contract hiện hành, đọc source/pattern/tests theo risk và triển khai recipe.
   Source trái contract, thiếu symbol hoặc dependency không đáp ứng invariant thì trả Main; không redesign hoặc ghép acceptance từ TASK cha/lịch sử.
2. The worker returns source evidence and validation status. It runs a command only
   when the user explicitly authorized that action and scope.
3. The coordinator verifies returned source evidence against canonical TASK `allowed_paths`, `Reuse`, and `Acceptance`. Code review is performed only when explicitly requested by the user (using `code-reviewer` / `code-review` or optional read-only `reviewer`).
4. When independent verification is active for governed work or explicitly requested, the read-only `verifier` checks a derived v2 manifest against canonical TASK and independently checks its criteria, returning
   `pass`, `fail`, or `blocked` with evidence.
5. On implementation `fail` against a valid contract, return to the owning worker with one bounded retry within scope.
   Thiếu/mâu thuẫn contract hoặc lỗi thiết kế được trả Main để nghiên cứu phần thiếu, chốt giải pháp và cập nhật contract/version/lifecycle theo protocol hiện có trước khi giao tiếp.
   Không yêu cầu worker hoặc advisor redesign trong vòng retry; chỉ giao phần còn thiếu/bị ảnh hưởng, không điều tra lại nguyên bài toán.
   On `blocked`, preserve the reason as a residual risk and request the missing authority/input.
   User đổi requirement được ghi riêng, không đánh đồng với lỗi plan hoặc implementation.

For every lane, **DO NOT RUN build, lint, typecheck, format, restore, code generation,
tests, or browser checks automatically. ON-DEMAND ONLY.** Add a command to the
manifest only when the user explicitly requests that validation action by name.
The manifest, governed classification, or verifier role cannot grant permission on
the user's behalf. Otherwise report `implemented - validation not requested` and
perform only read-only source/criteria review.
No automatic CI execution is permitted. When the user explicitly authorizes CI/build validation,
`.agent/scripts/ci-parity.sh` is run under the `verifier` or `maintainer` role (`AI_RULES.md` §2); guard R8 blocks every direct build by main/worker.
Do not infer CI pass from unexecuted, blocked-user, or waived states.

## Failure Conditions

Reject a governed result when any of these occur:

- an unregistered agent, command, script, or tool is required;
- write boundaries overlap without sequencing;
- manifest, validation result, or residual risk is missing;
- a verifier claims success without command/source evidence;
- a worker attempts a merge, deploy, or destructive action without authorization.

## Supersession - chỉ đọc khi contract/lifecycle/source thay đổi

Đây là reference cho coordinator xử lý outstanding supersession, không phải nội dung phải sinh trong plan/TASK hoặc đưa cho worker.
Không tự kích hoạt review, generation hoặc publish khi chưa có quyền tương ứng.

Fresh process đọc toàn bộ outstanding set bằng `node .agent/scripts/task-contract.mjs inspect-supersession --contract <TASK> [--contract <TASK> ...]`.
Lệnh chỉ xuất inspection JSON, không tạo checkpoint, refresh state, pin nguồn hoặc cho phép redispatch.
Module tương ứng là `inspectTaskSupersession(repoRoot, contractRefs)`.
Inspection bind raw predecessor state digest, exact old/new subjects, metadata hiện tại, baseline dispatch có thật, source union cũ/mới và entries cần review.
Metadata cũ chỉ được trả khi hash canonical hoặc lifecycle hiện tại khớp identity cũ; giá trị `null` là lịch sử chỉ có hash, không phải baseline được tạo lại.
Version giảm hoặc canonical hash đổi khi version giữ nguyên bị reject; lifecycle-only đổi vẫn phải khớp lifecycle version và active contract.

Coordinator (`orchestrator` hoặc `maintainer`) ghi explicit checkpoint tại `.agent/reports/merge-gate/checkpoints/*.md` với đúng một fence `json gate-supersession`, không dùng pass record hoặc caller boolean để thay approval.
Schema seam chính thức trong helper là `SUPERSESSION_APPROVAL_FIELDS`; `readTaskSupersessionApproval(repoRoot, approvalRef, inspection)` kiểm exact fields, exact inspection, nguồn/state còn hiện hành, path và symlink.
Checkpoint gồm `approval_version: 1`, `owner: "orchestrator"` (hoặc `"maintainer"`), `model_degraded: false`, `independent_review: true`, `inspection` nguyên object review, `reason` không rỗng và `source_authorization`.
`source_authorization` bắt buộc đúng 3 keys `['authorized_mutations', 'kind', 'user_words']`, với `kind` là `"user-approved-current-source-review"` (hoặc `"coordinator-rework-within-delegated-scope"` khi điều phối viên tự nâng phiên bản để bổ sung caller/delta hợp lệ nằm trọn trong mục tiêu đã được người dùng ủy quyền), `user_words` trích nguyên yêu cầu gốc/lời cho phép của người dùng, và mảng `authorized_mutations` gồm các item `{ path, provenance, sha256? }` với path repo-relative đã chuẩn hoá, provenance không rỗng và sha256 64-hex tuỳ chọn.
Khi `baseline_kind` là `dispatch-backed`, `authorized_mutations` bắt buộc bao phủ đầy đủ toàn bộ `mutation_paths` và `newly_reviewed_paths`; trường hợp `hash-only` duy trì mảng hợp lệ nhưng không bắt buộc liệt kê toàn bộ file lịch sử.
Helper không biến inspection thành approval khi chưa có checkpoint hợp lệ.

Sau checkpoint approval, fresh process chạy `node .agent/scripts/task-contract.mjs publish-supersession --approval <checkpoint> --contract <TASK> [--contract <TASK> ...]`.
Module chính thức là `publishTaskSupersession(repoRoot, contractRefs, approvalRef)`; `verifyTaskSupersession(repoRoot, contractRefs)` chỉ kiểm integrity, không publish.
Publish re-read full set, source và approval dưới shared bounded lock, ghi immutable `transition-<approval-sha256>.json` trước atomic state publication.
Proof giữ exact predecessor state, original dispatch/freeze links, old/new metadata và subjects, source entries/delta và approval bytes hash/provenance.
Retry dùng nguyên approval và exact reviewed source; không đổi checkpoint, không chạy dispatch/freeze hoặc sửa runtime thủ công để phục hồi interrupted publish.
Mọi record/verdict/CI binding reset toàn set, historical evidence giữ nguyên; freeze cũ bị invalidated và cần completion/freeze mới trước CI.
Completion và CI kiểm full subject set/source union, dependency mutations sau current-source review vẫn bị chặn.
Expansion không tự cho quyền mutation: checkpoint phải explicitly review/pin exact current entries và dependency provenance với nguyên user authorization; khi không có authorization thì không publish.
Hash-only history không tạo dispatch snapshots giả và không dùng task-specific legacy whitelist để publish.
