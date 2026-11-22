# Harness Wiring

Nguồn chung nằm ở `.agent/`.
Thư mục của từng harness chỉ chứa symlink trỏ về nguồn gốc (hoặc file profile sinh từ header mỏng + thân chung).
Không viết cấu hình thật vào `.claude/`, `.codex/`, `.agents/`, `.omp/`: sửa ở đó là mất đồng bộ ngay khi đổi công cụ.

Dựng lại toàn bộ symlink: `bash .agent/scripts/install-harness-wiring.sh`
Chỉ kiểm tra: `bash .agent/scripts/install-harness-wiring.sh --check`

## Cái gì chung, cái gì riêng

| Thành phần | Nguồn chung | Ghi chú |
| --- | --- | --- |
| Agent profile | `.agent/agents/*.md`, `.agent/harness/{omp,agy}/agents/*.md` | Cả 6 agent (`backend-specialist`, `frontend-specialist`, `test-author`, `verifier`, `researcher`, `reviewer`) dùng chung thân tại `.agent/agents/<name>.md`; Claude/Codex nối symlink, OMP/AGY ghép header mỏng qua installer |
| Skill | `.agent/skills/` | Symlink sang `.claude/skills`, `.agents/skills`, `.codex/skills` |
| Workflow | `.agent/workflows/` | Symlink sang `.claude/commands`, `.agents/workflows`, `.codex/workflows` |
| Rule miền | `.agent/rules/` | Symlink sang `.claude/rules`; tách rõ `glob`, `model_decision` và regex guard OMP |
| Rule gốc, entry file | `AI_RULES.md`, `AGENTS.md` (`OPINION.md` chỉ đọc khi cần) | `CLAUDE.md`, `GEMINI.md`, `ANTIGRAVITY.md`, `.agent/GEMINI.md` -> `AGENTS.md`; `.omp/RULES.md` -> `../AI_RULES.md` |
| Ranh giới agent | `.agent/contracts/agent-registry.json` | Cấu hình cho guard, không phải tài liệu suông |
| Bộ luật thực thi | `.agent/scripts/agent-boundary-guard.mjs` | Một engine, hai chế độ chạy (R1-R10) |
| Wiring riêng từng harness | `.agent/harness/<harness>/` | Chỉ chứa header mỏng, hook adapter và cấu hình không thể dùng chung |

## Treehouse: một nguồn policy cho các worktree

Allowlist nằm tại `SHARED_PATHS` và `LOCAL_LINKS` trong `.agent/scripts/treehouse_harness.py`, không chia sẻ nguyên `.agent`.
Rule/entry, workflow, nguồn OMP/AGY, registry và schema/validator của contract trỏ về repo gốc; `.omp` và `.agents` dùng liên kết tương đối tới nguồn chuẩn trong worktree.
Sửa qua bất kỳ symlink nào cũng sửa nguồn chung và ảnh hưởng mọi Treehouse đã nối, không cần watcher hoặc chạy lại sync.

Chuyển các Treehouse hiện có của cùng repo:
```bash
COGAIN_AGENT_ROLE=maintainer python3 .agent/scripts/treehouse_harness.py --all
```
Chỉ chạy khi user cho phép rõ ràng bước maintainer; biến role chỉ có hiệu lực cho lệnh này, không lưu role state.
Công cụ chỉ nhận linked worktree đang tồn tại dưới `~/.treehouse` và kiểm cùng Git common directory trước khi ghi.
Bản cũ được chuyển nguyên trạng vào `harness-shared-backup.*` cạnh thư mục worktree; lỗi nối sẽ thử khôi phục các đường dẫn đã thay của worktree đó và báo phần không khôi phục được.
Worktree đã nối đúng được giữ nguyên; không ghi đè file riêng hoặc generate profile.

Hook `~/.config/treehouse/hooks/sync_worktree.py` gọi công cụ này với `--worktree <path> --seed` khi repo có công cụ; repo khác giữ cách seed cũ.
Seed dùng `.worktreeinclude`, bỏ qua allowlist và runtime state ngay cả khi pattern chứa thư mục cha `.agent/**`, `.omp/**` hoặc `.agents/**`, không copy đè qua symlink.
File riêng chỉ seed khi còn thiếu; `.env` và generated profiles là bản riêng, không cập nhật lại bản đã có.
`.agent/planning`, `artifacts`, `reports`, `scratch`, `task-manifests` không chia sẻ và không seed từ repo gốc.
`agent-boundary-guard.mjs` và `agent-role.sh` vẫn là bản riêng vì xác định nơi lưu quyền/log theo vị trí script; registry dùng chung nhưng trạng thái quyền không dùng chung.

Nguồn repo gốc phải giữ nguyên vị trí; không xóa nguồn khi các worktree còn dùng.
Nội dung file được dùng chung ngay, nhưng phiên OMP đang mở không được bảo đảm tự nạp lại; dùng phiên mới để áp dụng policy/config mới.

## Mức cưỡng chế theo harness

Claude Code (`PreToolUse`), OMP (`tool_call`) và Antigravity / AGY (`PreToolUse`) đều có hook chạy trước tool.
Các harness còn lại dùng chung bộ luật qua CLI.

| Harness | Wiring | Mức cưỡng chế |
| --- | --- | --- |
| Claude Code | `.claude/settings.json -> ../.agent/harness/claude/settings.json`, `.claude/skills -> ../.agent/skills`, `.claude/rules -> ../.agent/rules`, `.claude/commands -> ../.agent/workflows`, `.claude/agents/{backend-specialist,frontend-specialist,test-author,verifier,researcher,reviewer}.md -> ../../.agent/agents/*.md` | **Cứng** (R1-R10): hook `PreToolUse` chặn trước khi tool chạy |
| OMP | `.omp/RULES.md -> ../AI_RULES.md`, `.omp/{WATCHDOG.md,WATCHDOG.yml,config.yml,lsp.json,rules,hooks}` symlink về `.agent/harness/omp/`, `.omp/agents/*.md` là file sinh | **Cứng** (R1-R10): hook `tool_call` gọi trực tiếp `evaluateBoundaryChecks` trong bộ nhớ (0 lần tạo tiến trình phụ, bắt cả nội dung `+` của `apply_patch`) |
| Antigravity (AGY) | `.agents/hooks.json -> ../.agent/harness/agy/hooks.json`, `.agents/{skills,workflows}` symlink về `.agent/{skills,workflows}`, `.agents/agents/*.md` là file sinh | **Cứng** (R1-R10 + vòng đời): `PreToolUse` lọc matcher và gọi trực tiếp `evaluateBoundaryChecks` (kèm kiểm dispatch contract và `R4` theo session); `PostToolUse`/`PreInvocation`/`Stop` chạy `agy/lifecycle-hook.mjs` |
| Codex | `.codex/{agents,skills,workflows}` symlink về `.agent/{agents,skills,workflows}` | Mềm: prose + CLI check khi được gọi |
| CI, git hook, script | không cần wiring | CLI mode, exit code 2 |

## CLI mode

Cùng registry, cùng luật, không phụ thuộc harness:

```bash
node .agent/scripts/agent-boundary-guard.mjs --check-command "dotnet test --filter X"
node .agent/scripts/agent-boundary-guard.mjs --check-write backend/tests/Foo.cs
node .agent/scripts/agent-boundary-guard.mjs --check-command "dotnet test" --role verifier
node .agent/scripts/agent-boundary-guard.mjs --sandbox --check-write frontend/erp/src/a.tsx --content "z.string().uuid()"
```

exit 0 là cho phép, exit 2 là bị chặn kèm lý do ở stderr.
Chế độ `--sandbox` bỏ qua `roleFile` trên đĩa và không ghi `boundary-guard.log` hay `last-hook-payload.json`, dùng để kiểm thử mẫu đúng/sai trong `.agent/evals/guard-fixtures.json`.
Luật thực thi gồm: R1 chạy test, R2 ghi cây test, R3 sửa file enforcement, R4 ranh giới ghi theo role, R5 credential literal trên dòng lệnh, R6 lệnh DB phá huỷ, R7 ghi file migration EF Core, R8 build/typecheck nặng chỉ chạy khi user yêu cầu (verifier, test-author, maintainer), R9 chạy lệnh migration EF Core, R10 chặn mẫu code vi phạm quy ước (và hỗ trợ miễn trừ có thời hạn `expires_at` tại `enforcement.allowlist` trong `agent-registry.json`).
R5/R6/R8/R9 khai báo bằng pattern và chạy trước các luật khác; R5 không in lệnh vào log.
R5 cho phép đọc password từ file cấu hình vào env ngay trong lệnh, ví dụ `PGPASSWORD="$(jq -r '.ConnectionStrings.DefaultConnection' <appsettings.json> | sed -E 's/.*Password=([^;]*).*/\1/')" psql ...`, hoặc dùng `~/.pgpass`; không echo/in giá trị.
Harness nào có cơ chế chạy lệnh trước mỗi tool call thì nối vào đây, không viết lại luật lần thứ hai.
Nâng cấp luật/skill/harness thực hiện theo chu trình 6 bước `/upgrade-agent` (`.agent/workflows/upgrade-agent.md`) từ hộp thư `.agent/reports/agent-friction.jsonl` và `node .agent/scripts/summarize-friction.mjs`.

## Subagent thật và nạp theo chế độ (Mode-Specific Loading)

Toàn bộ 6 vai trò chuẩn (`backend-specialist`, `frontend-specialist`, `test-author`, `verifier`, `researcher`, `reviewer`) dùng chung một thân hồ sơ gốc duy nhất tại `.agent/agents/<name>.md`.

Claude Code: nối đủ symlink `.claude/skills -> ../.agent/skills`, `.claude/rules -> ../.agent/rules`, `.claude/commands -> ../.agent/workflows`, và cả 6 subagent tại `.claude/agents/{backend-specialist,frontend-specialist,test-author,verifier,researcher,reviewer}.md -> ../../.agent/agents/*.md`.
Các vai trò cổng kiểm định và điều tra (`verifier`, `reviewer`, `researcher`) không khai báo `Edit`/`Write` trong `tools` nên runtime chặn ghi ngay từ cấp công cụ; các vai trò viết code/test (`backend-specialist`, `frontend-specialist`, `test-author`) chịu sự kiểm soát cứng của `agent-boundary-guard.mjs` theo `agent-registry.json`.

OMP: cả 6 vai trò (`backend-specialist`, `frontend-specialist`, `test-author`, `verifier`, `researcher`, `reviewer`) được sinh vào `.omp/agents/*.md` bằng cách ghép header mỏng tại `.agent/harness/omp/agents/<name>.md` với thân chung `.agent/agents/<name>.md` qua `install-harness-wiring.sh`.
- Nạp quy trình theo mode (mode-specific loading):
  - `reviewer`: chỉ kích hoạt khi user yêu cầu review tường minh; nạp `code-reviewer` (chủ sở hữu risk/checklist) và `clean-code`; chỉ nạp quy trình `code-review` khi review diff ở fixed point.
  - `verifier`: nạp `lint-and-validate`, `testing-patterns`, `requesting-code-review` gắn với task manifest.
  - `test-author`: nạp `testing-patterns`, `tdd-workflow` cho việc viết và sửa test.
  - `researcher`: nạp `research` cho điều tra mã nguồn và tài liệu chỉ đọc.
- Đăng ký và profile OMP mới chỉ có hiệu lực ở phiên mới; profile sinh ra không thay đổi phiên đang chạy.
- Lane `fast` và `standard` được bảo tồn cho công việc đơn giản/cục bộ mà không áp đặt quy trình manifest; lệnh validation chỉ chạy khi user yêu cầu đích danh.
- Kiểm tra CI bất biến qua `ci-parity.sh` (luật R8) chỉ chạy khi user yêu cầu rõ ràng (do `verifier`/`maintainer` hoặc user tự chạy).

AGY: cả 6 vai trò (`backend-specialist`, `frontend-specialist`, `test-author`, `verifier`, `researcher`, `reviewer`) được sinh vào `.agents/agents/*.md` bằng cách ghép header mỏng tại `.agent/harness/agy/agents/<name>.md` với thân chung `.agent/agents/<name>.md` qua `install-harness-wiring.sh`.
Các profile AGY bật `subagent: true`, giữ `model: inherit` và không khai báo cứng mảng `tools:` khác tên giữa Antigravity CLI và Antigravity App (như `call_mcp_tool`, `view_file`, `grep_search`) để tránh lỗi khởi tạo executor và kế thừa trọn vẹn MCP (`lsp`, `context7`, `filesystem`); ranh giới chỉ đọc của `verifier`, `reviewer`, `researcher` được cưỡng chế cứng qua hook `boundary-guard` (`R4-gate-readonly`).

## OMP

| File nguồn | Vai trò trên OMP |
| --- | --- |
| `.omp/RULES.md` (`omp/RULES.md`) | Symlink trỏ thẳng về `AI_RULES.md` (`.omp/RULES.md -> ../AI_RULES.md`, `.agent/harness/omp/RULES.md -> ../../../AI_RULES.md`), đi kèm mọi request kể cả subagent để dùng chung một nguồn luật duy nhất |
| `omp/rules/omp-routing.md` | Rule `alwaysApply: true`, `agents: main` giữ gọn các cơ chế đặc thù runtime OMP (`xd://lsp`, `contract_ref` + `contract_version`, xử lý `advisor` blocker và `/compact`); định tuyến và luật gốc tuân theo `AI_RULES.md` và `AGENTS.md` |
| `omp/hooks/pre/boundary-guard.ts` | Dịch `bash`/`edit`/`apply_patch`/`write`/`ast_edit`/`eval`/MCP filesystem sang payload `Bash`/`Write` (trích cả dòng `+` của `apply_patch` cho R10) rồi gọi trực tiếp `evaluateBoundaryChecks` trong bộ nhớ (cache registry theo `mtimeMs`, 0 lần `spawnSync`). Role subagent lấy từ `ctx.agent.name` |
| `omp/hooks/pre/dispatch-contract.ts` | Chặn `task` tới ba lane viết code khi thiếu recipe/evidence hoặc lệch TASK canonical; `write agent://<handle>` tới handle bất kỳ chỉ validate khi mang explicit contract (canonical hai dòng hoặc fence dispatch-contract), không chặn tin nhắn delta/hỏi đáp tự do |
| `omp/hooks/pre/workflow-context.ts` | Lưu decision events (`task`, `write`, `todo`, `plan_armed`) thành custom entry (`cogain.workflow`), chặn gọi `ask` đồng bộ khi còn nhánh độc lập, giới hạn tối đa 2 vòng `write agent://<id>` trên một handle (trần nghỉ hưu chống phình ngữ cảnh), ghim quy tắc Tiếng Việt + roadmap `TASK-*.md` chưa làm khi `session.compacting`, và nối `session_stop` vào `evaluateMainStopGate` |
| `omp/agents/*.md` | Header mỏng OMP (`model`, `advisor`, `autoloadSkills`, `tools`, `spawns`, `blocking`, `output`) và phần "OMP runtime" cho cả 6 agent, được `install-harness-wiring.sh` ghép với thân chung `.agent/agents/<name>.md` thành `.omp/agents/<name>.md` |
| `omp/WATCHDOG.md` | Hướng dẫn advisor: turn guard tập trung bề mặt vừa đổi và luật cứng, caller liên quan theo risk; Pre-handoff đánh giá toàn slice; finding gắn blocker/concern/nit với luật nguồn, không lặp finding đã xử lý hay phát PASS/status khi không có vấn đề; điểm không xác định được trả về main bằng note `CẦN MAIN QUYẾT:` |
| `omp/WATCHDOG.yml` | Roster advisor cho lane có advisor: `Turn guard` và `Pre-handoff` dùng `@advisor` -> Luna high; Turn guard review mỗi 8 turn theo bề mặt vừa đổi (`syncBacklog: off`, tự động miễn cho lượt vá ngắn `< 8` turn); Pre-handoff review nhanh phần thay đổi trước khi worker bàn giao (`reviewMode: agent-end`, `syncBacklog: strict`). Có roster thì OMP không tạo advisor mặc định |
| `omp/config.yml` | Project settings: `modelRoles` đặt `advisor`/`gate` là Luna high, `plan` là Opus high và `slow` dùng `@plan`; `verifier` dùng `@gate` để tách tải khỏi pool Anthropic của `main`; `compaction.thresholdTokens: 180000`; tắt `lsp.diagnosticsOnEdit` (chỉ kiểm 1 lượt cuối slice), tắt `task.speculativeLaunch`, bật advisor cho `backend-specialist`/`frontend-specialist`/`test-author`, đặt `task.softRequestBudget: 60` kèm `task.agentSoftRequestBudget` theo vai trò (`90` cho BE/FE specialist, `80` cho `test-author`, `60` cho `verifier`/`reviewer`, `65` cho `researcher`) và `edit.modelVariants` dùng `apply_patch` cho model GPT |
| `omp/lsp.json` | Language server: `csharp-ls` nạp solution lọc `backend/Cogain.Lsp.slnf` (33 project mã nguồn thật, loại 7 `*.Migrations.csproj`, fallback `backend/CogainSolution.sln`) với `warmupTimeoutMs: 60000`, dùng runtime 10 ở `~/.dotnet10` qua `DOTNET_ROOT_X64`, MSBuildLocator dùng SDK 8 ở `/usr/lib/dotnet` qua `DOTNET_ROOT`/`DOTNET_HOST_PATH`/`PATH` để khớp project `net8.0`; `typescript-language-server` bật `tsserver.useSyntaxServer: "auto"`; `idleTimeoutMs: 1800000` (30 phút); `eslint` tạm tắt; chẩn đoán LSP không phải lệnh validation (`AI_RULES.md` §2) |

Rule trong `.agent/rules/` dùng frontmatter kép để tương thích đồng thời với Antigravity, Claude Code và OMP.
Chỉ giữ `trigger: glob` cho các rule thực sự cần gắn tự động theo file code đang chạm (`backend.md`, `frontend.md`, `business.md`, `backend-pragmatic-solid.md`, `code-style-concise.md`, `testing-standard.md`...).
Các rule `solution-complexity`, `test-enforcement`, `domain-parity`, `security-compliance` được chuyển sang `model_decision` để chỉ nạp khi quyết định cần đến thay vì bơm thụ động vào mọi lượt.
Các rule `guard-*.md` bỏ `trigger: glob` để chỉ kích hoạt regex interrupt (`interruptMode: tool-only`) trên OMP ngay khi mẫu code vi phạm đang được viết, không bơm văn bản thụ động trên AGY và Claude Code.

Mọi LLM dùng chung duy nhất `AI_RULES.md` và `AGENTS.md` qua hệ thống symlink (`CLAUDE.md`, `GEMINI.md`, `ANTIGRAVITY.md`, `.agent/GEMINI.md` -> `AGENTS.md`; `.omp/RULES.md` -> `../AI_RULES.md`).
`AGENTS.md` chỉ tự import `AI_RULES.md`, còn `OPINION.md` chỉ đọc khi luật chưa chốt được quyết định.
Nguồn chưa đổi và đã có trong context thì không đọc lại.
Giảm nội dung nguồn không xóa lịch sử phiên đang mở hoặc tự chứng minh mức giảm token; dùng phiên mới để nạp lại context sạch.

Gate dispatch dùng block `json dispatch-contract` làm brief duy nhất theo `.agent/workflows/plan.md`, không thêm context pack hoặc checklist luật cho worker.
Với TASK canonical, Main chỉ cần truyền đúng hai dòng `contract_ref` và `contract_version`; hook trích block tự động, kiểm cả batch rồi trả `input` đầy đủ cho runtime trước khi worker chạy.
Inline contract vẫn dùng cho một slice không có TASK; block đã gửi mà lệch canonical bị chặn, không tự sửa scope/recipe/evidence.
Hook kiểm field bắt buộc, đường dẫn/khoảng dòng evidence, phạm vi file và nội dung trích TASK/version cho task lane viết code; continuation `write agent://<handle>` tới handle bất kỳ chỉ validate khi mang explicit contract (canonical hai dòng hoặc fence dispatch-contract), còn tin nhắn delta/hỏi đáp tự do không bị áp semantic gate.
Dispatch hook chỉ là structural check kiểm cấu trúc contract/evidence paths/version, không thực hiện semantic approval và không chứng minh evidence đúng ngữ nghĩa hay `mapping: null` được khai đúng.
Nếu `.omp/hooks` và `.omp/config.yml` đã nối đúng nguồn thì thay đổi này không cần generate profile; dùng phiên OMP mới để nạp hook/config, không coi phiên hiện tại đã được bảo vệ.

Chẩn đoán LSP trước bàn giao thuộc trách nhiệm worker theo `omp/rules/omp-routing.md` (`task.enableLsp: true` đã cấp tool).
Gating bằng chứng LSP trước bàn giao và gating chặn kết quả khi có advisor blocker (blocker-success gating) hiện vẫn là policy ràng buộc trách nhiệm, chưa có hook cưỡng chế ở runtime.
Main không lặp diagnostics của revision worker vừa bàn giao; thiếu bằng chứng thì trả đúng owner.
Đổi routing rule không cần generate profile; dùng phiên OMP mới để nạp.
Quyền Main code tuân theo `AI_RULES.md` §6: mặc định giao specialist, kể cả task nhỏ, một slice hoặc thay đổi thuần cơ học.
Chỉ user giao rõ làm trực tiếp tại Main cho task hiện tại mới cấp quyền; `gấp`, ít dòng, giải pháp đã rõ hoặc yêu cầu sửa chung không cấp quyền và quyền task trước không tự áp cho task sau.
Không dispatch được specialist thì báo blocker, không tự chuyển sang Main code.
Đây là policy routing, không phải hook khóa quyền ghi Main theo sự cho phép của user.
Main và worker tái dùng source còn trong context, gom vùng đọc độc lập và chỉ mở lại khi có lý do, nhưng không bỏ xác nhận declaration hoặc caller rủi ro.
Handoff gửi đủ LSP revision cuối và trạng thái advisor ngay lần đầu; Main không gửi ACK/closure rỗng tới agent idle và không lặp báo cáo cho user chỉ vì nhận lời xác nhận.
Đây là policy giảm vòng model/tool, không phải cache source hay hook cấm đọc; source đổi, mất context và failure mode mới vẫn phải được kiểm tra.

Hook `omp/hooks/pre/worker-checkpoint.ts` gửi passive context theo vai trò (ví dụ ở turn 45 và 70 trước `agentSoftRequestBudget: 90` của BE/FE specialist) để nhắc gom lô thao tác và chuẩn bị bàn giao.
Counter reset theo agent loop tại `agent_start` trong factory từng session, không dùng state module chung; không can thiệp main, scout hoặc advisor và không tự chạy validation.
Đây là cảnh báo gói milestone và chuẩn bị checkpoint, không phải lệnh tự dừng hay phép quy đổi turn sang context; worker tiếp tục nếu acceptance còn khả thi trong run, chỉ bàn giao partial/blocked khi có giới hạn runtime/context hoặc blocker thực tế, Main quyết continuation cùng owner.
Hook `omp/hooks/pre/workflow-context.ts` ghi nhận decision events khi Main thực thi thành công tool task/write, tái dựng state từ native branch và cung cấp contract hiện hành cùng các delta cho compaction mà không scan branch hay serialize full snapshot mỗi turn.
Nhắc nhở Main với user nói chuyện dễ hiểu theo `AI_RULES.md` §8, còn Main với agent trao đổi ngắn gọn, kỹ thuật được reinject ở lifecycle `before_agent_start` thay vì thêm rule tĩnh.
Hook này không chứng minh discovery đúng, không cưỡng chế chất lượng văn phong hay áp word cap và không tự đóng advisor finding.
Retry project giới hạn ba lần với backoff tối đa 30 giây và bật quota-aware fallback từ báo cáo đáng tin cậy; giữ nguyên chuỗi model đã chọn.
Không bảo đảm provider hồi phục hoặc loại được retry quota vĩnh viễn bằng cấu hình repo; thay đổi cần phiên mới và chưa có số đo latency sau rollout.
Đối chiếu `omp --version` trong lần rà soát trả `omp/18.13.1`; executable tại `~/.local/bin/omp` là ELF, không phải checkout source runtime.
[AdvisorRuntime 18.13.1](https://unpkg.com/@oh-my-pi/pi-coding-agent@18.13.1/src/advisor/runtime.ts) đã có quota latch sau khi host từ chối recovery; chưa xác nhận vì sao lỗi quota trong phiên EXCEL không kích hoạt chốt này, nên không coi `maxRetries: 3` là hard cap cho advisor.
[SessionAdvisors](https://unpkg.com/@oh-my-pi/pi-coding-agent@18.13.1/src/session/session-advisors.ts) không forward lifecycle lỗi advisor tới hook `message_end`; [AgentSession.abort](https://unpkg.com/@oh-my-pi/pi-coding-agent@18.13.1/src/session/agent-session.ts) không cung cấp thao tác abort riêng advisor qua extension context.
Không thêm hook `message_end`/`ctx.abort()` giả làm circuit breaker vì nó không chặn đúng vòng lỗi này và có thể hủy worker cha.
Project routing hiện đặt `reviewer`, `security-reviewer` và cả hai advisor roster qua `@advisor` -> Luna high; `plan`, `slow` và `tech-lead` dùng Opus high; scout dùng Luna high để thu evidence sơ bộ, Main vẫn tự kiểm tra source quyết định/caller rủi ro và giữ quyền kết luận.
Chính sách Codex cấp provider ưu tiên 11 tài khoản miễn phí hiện có (`priority: 100`) hơn 3 tài khoản Plus (`priority: 0`), nhưng Plus vẫn đủ điều kiện; reserve mặc định giữ nguyên 10%.
Đây là định tuyến best-effort: thứ hạng còn phụ thuộc tình trạng khả dụng, quota và các cửa sổ sử dụng.
Phiên được ghim tự động có thể chuyển sang tài khoản miễn phí khi quota còn ít nhất 20% theo ngưỡng reclaim; ghim do người dùng chọn rõ ràng không bị ghi đè.
Danh sách nhận diện là tĩnh, nên cần cập nhật khi thêm tài khoản hoặc thay đổi gói.
Giữ nguyên nhịp review, hướng dẫn roster và `syncBacklog` (Pre-handoff là `strict`); dùng phiên OMP mới để nạp policy/roster mà không cần generation, và lưu ý runtime model overrides vẫn có thể ưu tiên hơn cấu hình project.
Đây là cấu hình role selection, không phải runtime enforcement hay đảm bảo tuyệt đối về model do retry/fallback vẫn có thể chạy theo policy hiện có; không có số đo token savings.

### Blocker của advisor trên OMP

**Hiện tại chỉ có policy:** `AI_RULES.md`, `.omp/WATCHDOG.md` và `.omp/rules/omp-routing.md`.
Blocker trả Main; tối đa hai vòng sửa; finding sai phải được bác bỏ có bằng chứng; worker phớt lờ thì Main cancel run trước khi chuyển giao.
`syncBacklog: strict` chỉ đợi review; advisor im lặng, lỗi hoặc hết quota không phải PASS.
Dùng phiên OMP mới để nạp policy, không cần generate profile.

**Chưa có khóa cứng:** [source OMP 18.12.6](https://unpkg.com/@oh-my-pi/pi-coding-agent@18.12.6/src/session/session-advisors.ts) gắn `AdviseTool` trực tiếp, không qua hook verdict của repo; [extension API](omp://extensions.md) không phát `session_stop` cho subagent.
Hướng sửa là thêm blocker state do supervisor giữ tại `session-advisors.ts#routeAdvice`, chặn tool ghi/chạy lệnh và kết quả thành công ở cổng thực thi/`task/executor.ts`.
Main cấp phạm vi sửa; worker không tự mở khóa; trạng thái phải giữ qua resume, review phải khớp source hiện tại, lỗi advisor không được tự cho qua.
Không tự rollback side effect đã xảy ra; slice độc lập vẫn chạy.
Repo này không chứa source runtime OMP; cần checkout đúng phiên bản và quyền kiểm thử/build/cài riêng trước khi áp dụng khóa thật.

### Phân biệt Policy với Enforcement và Lộ trình Rollout

- **Structural enforcement**: `dispatch-contract.ts` chỉ kiểm cấu trúc brief/evidence của specialist lane; không phải semantic gate hay phê duyệt logic nghiệp vụ.
- **Context preservation**: `workflow-context.ts` lưu decision events qua native branch/compaction; không làm semantic approval hay state machine gate toàn task.
- **Policy thuần túy**: LSP evidence trước bàn giao và gating chặn khi có advisor blocker; ràng buộc trách nhiệm Main/worker, chưa có runtime enforcement.

**Lộ trình rollout ba đợt:**
1. *Đợt 1 - Policy*: Chuẩn hóa tài liệu, trách nhiệm và quy trình điều phối/review; nạp qua phiên OMP mới, không cần generation profile.
2. *Đợt 2 - Hook khả thi sau evidence runtime*: Bổ sung pre-tool hook khi có bằng chứng thực tế từ runtime OMP và extension API hỗ trợ.
3. *Đợt 3 - Eval được cho phép riêng*: Chạy offline evaluation và benchmark kiểm thử workflow khi được user yêu cầu đích danh.

### Tiêu chí Eval Workflow (Overtime - Chưa chạy)

Các tiêu chí đánh giá workflow dưới đây được ghi nhận từ quan sát Overtime để phục vụ offline evaluation trong tương lai; hiện **chưa chạy** và **không phải test production**:

| Tiêu chí eval (Overtime) | Expected agent behavior | Observable evidence |
| --- | --- | --- |
| Lookup defense | Kiểm tra uniqueness của mã nguồn, normalization (comparer/Trim), cùng ID vs khác ID và phân biệt helper duplicate Excel với lookup ambiguity trước khi thêm/bỏ guard; không khẳng định mã unique khi chưa chứng minh | Đã kiểm tra ràng buộc nguồn, constraint trong DB/code, cardinality và flow thực tế; không tự ý thêm guard/fallback suy đoán hoặc xóa guard cần thiết |
| Preview / submit budget rules | So sánh `PreviewBudgetAsync` và `CalculateRequiresBodReapprovalAsync`, đối chiếu nguồn ngân sách/chi phí, xử lý NotFound và lỗi MasterData; nhận diện khác biệt có chủ đích so với lệch ngoài ý muốn, không tự đổi semantics | Đã đọc cả hai flow và các nhánh lỗi liên quan; nêu rõ owner/reuse hoặc điểm Main cần chốt trong recipe trước khi dispatch/thực thi |
| Truncated source / overclaim | Chỉ khẳng định bảo toàn hành vi khi đã đọc đủ thân hàm/caller liên quan; output bị cắt thì đọc tiếp phần còn thiếu trước khi sửa/nghiệm thu | Có tool read bổ sung khoảng dòng bị thiếu trước khi khẳng định; không claim "giữ nguyên 100%" khi source bị truncate |
| LSP vs behavior | Phân biệt rõ chẩn đoán tĩnh (LSP) và kiểm chứng hành vi (runtime); không suy runtime đúng từ LSP sạch | Báo cáo ghi rõ LSP sạch thuộc static check; phần hành vi chưa chạy ghi `Validation: not run - not requested`, không claim verified |
| LOC move vs deletion | Phân biệt rõ xóa logic dư (dead/redundant code), chuyển logic sang nơi sở hữu (relocation/co-location) và formatting/style; không đóng đinh business uniqueness hoặc yêu cầu gom bất kể semantics | Báo cáo phân loại rõ LOC giảm do xóa, chuyển hay format; không ép tách hàm hoặc gom code vô nghĩa vì LOC |

**Metric đánh giá:**
- Escaped design defects
- Contract/discovery rework
- Introduced redundant/duplicate logic
- Unsupported completion claims

*(Bộ tiêu chí và metric này phục vụ đo lường eval khi được phép; không bịa số đo cụ thể, không thêm evaluator hoặc scripts vào runtime/repo).*

Subagent OMP nhận `AI_RULES.md` qua `.omp/RULES.md`, nhưng không nhận file context tên `AGENTS.md`; nội dung skill tới subagent qua `autoloadSkills` của profile, nên việc code phải giao cho specialist thay vì `task`/`sonic` chung.
Sửa header hoặc thân profile không tự cập nhật `.omp/agents/` hay context của phiên đang chạy.
Installer `bash .agent/scripts/install-harness-wiring.sh` cần user authorization riêng; không tự chạy generation từ yêu cầu sửa source, không sửa tay generated profiles.
Rollout bảo thủ dùng agent/phiên OMP mới sau generation; không hứa hot reload, behavior mới ở phiên hiện tại hoặc mức tiết kiệm context chưa đo.

## AGY

| File nguồn | Vai trò trên AGY |
| --- | --- |
| `agy/hooks.json` | Đăng ký 4 điểm hook: `PreToolUse` (Grouped matcher cho tool ghi/chạy lệnh + `invoke_subagent`/`swarm`), `PostToolUse` (Grouped), `PreInvocation` (Flat) và `Stop` (Flat). Chỉ nối symlink tại `.agents/hooks.json`, không đặt trùng ở `.agent/hooks.json` để tránh chạy hook hai lần |
| `agy/boundary-guard.mjs` | Hook `PreToolUse`: dịch `run_command`, `write_file`/`edit_file`, `call_mcp_tool` (`filesystem`), `mcp_filesystem_*`, `run_workflow` sang payload `Bash`/`Write` gọi `agent-boundary-guard.mjs` (kèm tra `agy-sessions.json` cho `R4`); kiểm `invoke_subagent`/`swarm add` tới specialist viết code phải có `allowed_paths` + `acceptance` và tự mở rộng 2 dòng `contract_ref`/`contract_version` qua `dispatch-contract.mjs` |
| `agy/lifecycle-hook.mjs` | Hook `PostToolUse`, `PreInvocation` và `Stop`: theo dõi `dirtyFiles` (`.cs`/`.ts`/`.tsx`) và trạng thái kiểm tra `lsp -> get_diagnostics` theo `conversationId` trong `.agent/scratch/.runtime/agy-sessions.json` (TTL 16h); phát nhịp đồng bộ tiến độ xuyên suốt mỗi 30 lượt (`PreInvocation`, giữ nguyên prompt cache ở các lượt khác); nhắc kiểm tra tĩnh trước bàn giao tối đa 1 lần ở `Stop` khi `!event.continuationActive` và tự ghi ma sát vào `.agent/reports/agent-friction.jsonl` |
| `agy/agents/*.md` | Header mỏng AGY (`model: inherit`, `subagent: true`, không khóa cứng mảng `tools:` lệch tên giữa CLI/App để kế thừa ổn định MCP `lsp`/`context7`/`filesystem`; ranh giới chỉ đọc của `verifier`/`reviewer`/`researcher` cưỡng chế qua `boundary-guard`) và phần "AGY runtime" cho cả 6 agent, được `install-harness-wiring.sh` ghép với thân chung `.agent/agents/<name>.md` thành `.agents/agents/<name>.md` |

Để dùng AGY ở chế độ full-accept tương tự OMP nhưng vẫn giữ guard chặn cứng, user bật Preset `Turbo` (hoặc `Auto`) qua `/permissions`, hoặc khởi chạy bằng `agy --dangerously-skip-permissions --mode auto`.
Frontmatter `agy/agents/*.md` giữ `model: inherit` vì bộ nạp custom agent của AGY chỉ chấp nhận 4 tier (`inherit`, `pro`, `flash`, `flash_lite`) và sẽ bỏ qua agent nếu ghi tên model cụ thể.
Theo `.agent/rules/GEMINI.md`, việc một nhánh cục bộ đơn giản ưu tiên gọi trực tiếp qua `invoke_subagent`, còn việc nhiều nhánh độc lập chạy song song hoặc cần ghim cứng `gemini-4-hydrogen-high` thì điều phối qua `swarm` (`action: "add"`, `model: "gemini-4-hydrogen-high"`) và `kill` worker sau khi nghiệm thu.
Kiểm tra LSP trên AGY áp dụng cơ chế Canary Probe 2 bước theo năng lực runtime và trạng thái cầu chì `.agent/scratch/.runtime/lsp-circuit.json`: nếu specialist có tool `call_mcp_tool` (subagent trực tiếp), worker thăm dò `get_diagnostics` trên đúng 1 tệp đầu tiên cuối slice theo hướng dẫn trong `agy/agents/*.md`, chỉ khi tệp đầu phản hồi bình thường mới gọi song song cho các tệp còn lại, còn Main đối chiếu mục `LSP:` với `git diff`. Nếu worker chạy qua `swarm` mà runtime không cấp `call_mcp_tool` VÀ cầu chì đang đóng (`CLOSED`), Main mới thăm dò `get_diagnostics` đúng 1 tệp đầu tiên trước khi gọi song song cho các tệp còn lại; trường hợp worker báo `LSP: circuit-open (timeout)` hoặc cầu chì đang mở (`OPEN`) / hook chặn `[lsp-circuit-open]`, **Main và worker TUYỆT ĐỐI KHÔNG gọi lại `get_diagnostics` hay `restart_server`** để tránh treo phiên, mà nghiệm thu trực tiếp bằng đối chiếu mã nguồn tĩnh và ghi nhận minh bạch trạng thái cho người dùng.
Khi kết quả `get_diagnostics` còn lỗi thuộc phạm vi slice (hoặc worker có tool nhưng thiếu `LSP:` khi cầu chì đang `CLOSED`), Main nhắn trả lại đúng worker đó qua `post_message` tag `@<name>` trước khi `kill` (hoặc `send_message`) để sửa bổ sung; nghiệm thu xong mới gọi `swarm` (`action: "kill"`).
Hook và danh sách subagent mới trong `.agents/` chỉ có hiệu lực đầy đủ khi mở phiên AGY mới sau khi chạy installer.
