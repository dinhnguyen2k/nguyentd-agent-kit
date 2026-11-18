# Harness Wiring

Nguồn chung nằm ở `.agent/`. Thư mục của từng harness chỉ chứa symlink trỏ về đây.
Không viết cấu hình thật vào `.claude/`, `.codex/`, `.agents/`: sửa ở đó là mất đồng bộ ngay khi đổi công cụ.

Dựng lại toàn bộ symlink: `bash .agent/scripts/install-harness-wiring.sh`
Chỉ kiểm tra: `bash .agent/scripts/install-harness-wiring.sh --check`

## Cái gì chung, cái gì riêng

| Thành phần | Nguồn chung | Ghi chú |
| --- | --- | --- |
| Agent profile | `.agent/agents/*.md`, `.agent/harness/omp/agents/*.md` | Frontmatter theo chuẩn Claude Code/OMP, ghép qua installer |
| Skill | `.agent/skills/` | |
| Workflow | `.agent/workflows/` | |
| Rule, entry file | `AI_RULES.md`, `OPINION.md`, `AGENTS.md` | `CLAUDE.md`/`GEMINI.md`/`ANTIGRAVITY.md` là symlink của `AGENTS.md` |
| Ranh giới agent | `.agent/contracts/agent-registry.json` | Cấu hình cho guard, không phải tài liệu suông |
| Bộ luật thực thi | `.agent/scripts/agent-boundary-guard.mjs` | Một engine, hai chế độ chạy |
| Wiring riêng từng harness | `.agent/harness/<harness>/` | Chỉ chứa phần không thể chung được |

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
| Claude Code | `.claude/settings.json -> ../.agent/harness/claude/settings.json` | **Cứng**: hook chặn trước khi tool chạy |
| OMP | `.omp/*` symlink về `.agent/harness/omp/`, `.omp/agents/*.md` là file sinh | **Cứng**: hook `tool_call` chặn trước khi tool chạy |
| Antigravity (AGY) | `.agents/hooks.json -> ../.agent/harness/agy/hooks.json`, `.agents/{skills,workflows}` symlink, `.agents/agents/*.md` là file sinh | **Cứng** (R1-R3, R5-R9): hook `PreToolUse` chặn trước khi tool chạy; R4 theo worker dựa vào prompt/toolset trừ khi có `COGAIN_AGENT_ROLE` do stdin AGY chưa truyền `agent_name` |
| Codex | `.codex/{agents,skills,workflows}` symlink | Mềm: prose + CLI check khi được gọi |
| CI, git hook, script | không cần wiring | CLI mode, exit code 2 |

## CLI mode

Cùng registry, cùng luật, không phụ thuộc harness:

```bash
node .agent/scripts/agent-boundary-guard.mjs --check-command "dotnet test --filter X"
node .agent/scripts/agent-boundary-guard.mjs --check-write backend/tests/Foo.cs
node .agent/scripts/agent-boundary-guard.mjs --check-command "dotnet test" --role verifier
```

exit 0 là cho phép, exit 2 là bị chặn kèm lý do ở stderr.
Luật: R1 chạy test, R2 ghi cây test, R3 sửa file enforcement, R4 ranh giới ghi theo role, R5 credential literal trên dòng lệnh, R6 lệnh DB phá huỷ, R8 build/typecheck nặng chỉ chạy khi user yêu cầu (verifier, test-author, maintainer). R5/R6/R8 khai báo bằng pattern và chạy trước các luật khác; R5 không in lệnh vào log.
R5 cho phép đọc password từ file cấu hình vào env ngay trong lệnh, ví dụ `PGPASSWORD="$(jq -r '.ConnectionStrings.DefaultConnection' <appsettings.json> | sed -E 's/.*Password=([^;]*).*/\1/')" psql ...`, hoặc dùng `~/.pgpass`; không echo/in giá trị.
Harness nào có cơ chế chạy lệnh trước mỗi tool call thì nối vào đây, không viết lại luật lần thứ hai.

## Subagent thật và nạp theo chế độ (Mode-Specific Loading)

Claude Code: `verifier` và `test-author` được đăng ký thành subagent thật trong `.claude/agents/` bằng symlink.
Lý do chỉ hai seat này trên Claude Code: chúng cần **bộ quyền khác** chứ không chỉ khác lời dặn.
`verifier` khai báo `tools: Read, Grep, Glob, Bash` nên runtime không cấp Edit/Write, đó là ranh giới cứng duy nhất không thể lách bằng prompt.
`backend-specialist` và `frontend-specialist` cố tình không đăng ký riêng trên Claude Code: dùng chung bộ tool của main thread.

OMP: Danh sách specialist/gate (`backend-specialist`, `frontend-specialist`, `test-author`, `verifier`, `reviewer`) được sinh vào `.omp/agents/*.md` từ header `.agent/harness/omp/agents/` cộng thân `.agent/agents/` (riêng `reviewer` nằm trọn trong header OMP).
- Nạp quy trình theo mode (mode-specific loading):
  - `reviewer`: chỉ kích hoạt khi user yêu cầu review tường minh; nạp `code-reviewer` (chủ sở hữu risk/checklist) và `clean-code`; chỉ nạp quy trình `code-review` khi review diff ở fixed point.
  - `verifier`: nạp `lint-and-validate`, `testing-patterns`, `requesting-code-review` gắn với task manifest.
  - `test-author`: nạp `testing-patterns`, `tdd-workflow` cho việc viết và sửa test.
- Đăng ký và profile OMP mới chỉ có hiệu lực ở phiên mới; profile sinh ra không thay đổi phiên đang chạy.
- Lane `fast` và `standard` được bảo tồn cho công việc đơn giản/cục bộ mà không áp đặt quy trình manifest; lệnh validation chỉ chạy khi user yêu cầu đích danh.
- Kiểm tra CI bất biến qua `ci-parity.sh` (luật R8) chỉ chạy khi user yêu cầu rõ ràng (do `verifier`/`maintainer` hoặc user tự chạy).

AGY: Danh sách specialist/gate (`backend-specialist`, `frontend-specialist`, `test-author`, `verifier`, `reviewer`) được sinh vào `.agents/agents/*.md` từ header `.agent/harness/agy/agents/` cộng thân `.agent/agents/` (riêng `reviewer` nằm trọn trong header AGY).
Các profile AGY bật `subagent: true`, trong đó `verifier` và `reviewer` bị giới hạn danh sách `tools` chỉ đọc + terminal.

## OMP

| File nguồn | Vai trò trên OMP |
| --- | --- |
| `omp/RULES.md` | Luật cứng sticky, đi kèm mọi request kể cả subagent. Giữ ngắn; bản đầy đủ là `AI_RULES.md` |
| `omp/rules/omp-routing.md` | Rule `agents: main`: định tuyến, nghiệm thu, rework, advisor và vòng học; protocol discovery/contract/dispatch chỉ đọc khi cần tại `.agent/workflows/plan.md` |
| `omp/hooks/pre/boundary-guard.ts` | Dịch `bash`/`edit`/`write`/`ast_edit`/`eval`/MCP filesystem sang payload `Bash`/`Write` rồi gọi `agent-boundary-guard.mjs`. Role subagent lấy từ `ctx.agent.name` |
| `omp/hooks/pre/dispatch-contract.ts` | Chặn `task` tới ba lane viết code khi thiếu recipe/evidence hoặc lệch TASK canonical; `write agent://<handle>` tới handle bất kỳ chỉ validate khi mang explicit contract (canonical hai dòng hoặc fence dispatch-contract), không chặn tin nhắn delta/hỏi đáp tự do |
| `omp/hooks/pre/workflow-context.ts` | Lưu decision events (`tool_result` thành công của Main) thành custom entry (`cogain.workflow`) và tái dựng state trên native persisted branch; bảo toàn contract/deltas qua compaction; inject lifecycle giao tiếp ngắn gọn/dễ hiểu ở `before_agent_start` cho Main và subagent không phải advisor |
| `omp/agents/*.md` | Header OMP (`model`, `advisor`, `autoloadSkills`, `tools`, `spawns`, `blocking`, `output`) và phần "OMP runtime". Installer ghép với thân `.agent/agents/<name>.md` thành `.omp/agents/<name>.md` |
| `omp/WATCHDOG.md` | Hướng dẫn advisor: turn guard tập trung bề mặt vừa đổi và luật cứng, caller liên quan theo risk; Pre-handoff đánh giá toàn slice; finding gắn blocker/concern/nit với luật nguồn, không lặp finding đã xử lý hay phát PASS/status khi không có vấn đề; điểm không xác định được trả về main bằng note `CẦN MAIN QUYẾT:` |
| `omp/WATCHDOG.yml` | Roster advisor cho lane có advisor: `Turn guard` và `Pre-handoff` dùng `@advisor` → Luna high; Turn guard review mỗi 3 turn theo bề mặt vừa đổi (`syncBacklog: off`); Pre-handoff review toàn slice trước khi worker bàn giao (`reviewMode: agent-end`, `syncBacklog: strict`). Có roster thì OMP không tạo advisor mặc định |
| `omp/config.yml` | Project settings: `modelRoles` đặt `advisor` là Luna high, `plan` là Opus high và `slow` dùng `@plan`; reviewer/security-reviewer dùng `@advisor`, tech-lead dùng `@plan`, scout dùng Luna high để thu evidence sơ bộ. Main vẫn sở hữu kiểm chứng source và quyết định sâu; model Main theo role `default`/runtime overrides và không bị thay đổi bởi cấu hình này; các role/worker khác cùng fallback hiện có được giữ nguyên. `textVerbosity: low`; lọc skill ngoài phạm vi ERP; bật `lsp.diagnosticsOnEdit`; tắt `task.speculativeLaunch`; tắt advisor main, chỉ bật advisor cho `backend-specialist`/`frontend-specialist`/`test-author` (`task.agentAdvisor`); `task.softRequestBudget: 50`; `edit.modelVariants` cho model GPT dùng `apply_patch`. Object deep-merge với `~/.omp/agent/config.yml`, array thay thế. Prompt gọn hơn không đồng nghĩa giảm token transcript đã truyền vào context |
| `omp/lsp.json` | Language server. `csharp-ls` dùng runtime 10 ở `~/.dotnet10` qua `DOTNET_ROOT_X64`; MSBuildLocator dùng SDK 8 và reference packs ở `/usr/lib/dotnet` qua `DOTNET_ROOT`, `DOTNET_HOST_PATH` và `PATH`, tránh resolve project `net8.0` bằng bộ SDK 10 riêng thiếu packs. Build của repo vẫn dùng SDK 8. `eslint` tạm tắt vì server khởi động lỗi. Chẩn đoán LSP không phải lệnh validation (`AI_RULES.md` §2) |

Rule trong `.agent/rules/` dùng frontmatter kép: `trigger`/`glob` cho Antigravity, `description` + `condition` + `interruptMode` (hoặc `alwaysApply`) cho OMP.
`condition` dạng glob là TTSR: rule tự chèn khi agent sửa file khớp. `interruptMode: never` gắn rule vào kết quả tool, không ngắt lượt.
Rule `guard-*-antipatterns.md` dùng regex với `interruptMode: tool-only`: ngắt ngay khi code sai đang được viết.

`AGENTS.md` chỉ tự import `AI_RULES.md`; `OPINION.md` đọc khi luật chưa chốt quyết định.
Entry và sticky rule giữ yêu cầu cốt lõi; không chép lại workflow hoặc ví dụ dài; nguồn chưa đổi và đã có trong context thì không nạp lại.
Giảm nội dung nguồn không xóa lịch sử phiên hoặc chứng minh mức giảm token; dùng phiên mới để nạp lại context.

Gate dispatch dùng block `json dispatch-contract` làm brief duy nhất theo `.agent/workflows/plan.md`, không thêm context pack hoặc checklist luật cho worker.
Với TASK canonical, Main chỉ cần truyền đúng hai dòng `contract_ref` và `contract_version`; hook trích block tự động, kiểm cả batch rồi trả `input` đầy đủ cho runtime trước khi worker chạy.
Inline contract vẫn dùng cho một slice không có TASK; block đã gửi mà lệch canonical bị chặn, không tự sửa scope/recipe/evidence.
Nó kiểm field bắt buộc, đường dẫn/khoảng dòng evidence, phạm vi file và nội dung trích TASK/version cho task lane viết code; continuation `write agent://<handle>` tới handle bất kỳ chỉ validate khi mang explicit contract (canonical hai dòng hoặc fence dispatch-contract) để mở rộng hoặc kiểm tra tính hợp lệ, tin nhắn delta/hỏi đáp tự do không bị áp semantic gate. Dispatch hook chỉ là structural check kiểm contract structure/evidence paths/version; không thực hiện semantic approval, không chứng minh evidence đúng ngữ nghĩa hoặc `mapping: null` được khai đúng.
Nếu `.omp/hooks` và `.omp/config.yml` đã nối đúng nguồn thì thay đổi này không cần generate profile; dùng phiên OMP mới để nạp hook/config, không coi phiên hiện tại đã được bảo vệ.

LSP trước bàn giao thuộc worker theo `omp/RULES.md` mục 3; `task.enableLsp: true` đã cấp tool. Gating bằng chứng LSP trước bàn giao và gating chặn kết quả khi có advisor blocker (blocker-success gating) vẫn thiếu runtime enforcement; đây là policy ràng buộc trách nhiệm, chưa có hook cưỡng chế và không tuyên bố đã triển khai trên runtime.
Main không lặp diagnostics của revision worker vừa bàn giao; thiếu bằng chứng thì trả đúng owner.
Đổi sticky/routing rule không cần generate profile; dùng phiên OMP mới để nạp.
Quyền Main code theo `AI_RULES.md` §6 và sticky mục 14: mặc định giao specialist, kể cả task nhỏ, một slice hoặc thay đổi thuần cơ học.
Chỉ user giao rõ làm trực tiếp tại Main cho task hiện tại mới cấp quyền; `gấp`, ít dòng, giải pháp đã rõ hoặc yêu cầu sửa chung không cấp quyền và quyền task trước không tự áp cho task sau.
Không dispatch được specialist thì báo blocker, không tự chuyển sang Main code.
Đây là policy routing, không phải hook khóa quyền ghi Main theo sự cho phép của user.
Sticky `omp/RULES.md` mục 12-13 áp cho cả Main và worker: tái dùng source còn trong context, gom vùng đọc độc lập, chỉ mở lại khi có lý do; không bỏ xác nhận declaration hoặc caller rủi ro.
Handoff gửi đủ LSP revision cuối và trạng thái advisor ngay lần đầu; Main không gửi ACK/closure tới agent idle và không lặp báo cáo cho user chỉ vì nhận lời xác nhận.
Đây là policy giảm vòng model/tool, không phải cache source hay hook cấm đọc; source đổi, mất context và failure mode mới vẫn phải được kiểm tra.

Hook `omp/hooks/pre/worker-checkpoint.ts` gửi passive context cho ba lane viết code ở turn 30 và 40 trong mỗi run để gói phần còn lại trước `task.softRequestBudget: 50`.
Counter reset theo agent loop tại `agent_start` trong factory từng session, không dùng state module chung; không can thiệp main, scout hoặc advisor và không tự chạy validation.
Đây là cảnh báo gói milestone và chuẩn bị checkpoint, không phải lệnh tự dừng hay phép quy đổi turn sang context; worker tiếp tục nếu acceptance còn khả thi trong run, chỉ bàn giao partial/blocked khi có giới hạn runtime/context hoặc blocker thực tế, Main quyết continuation cùng owner.
Hook `omp/hooks/pre/workflow-context.ts` ghi nhận decision events khi Main thực thi thành công tool task/write, tái dựng state từ native branch và cung cấp contract hiện hành cùng các delta cho compaction (không scan branch hay serialize full snapshot mỗi turn); workflow-context bảo toàn decision events qua native branch/compaction, không semantic approval và không đóng vai trò state machine gate toàn task. Giao tiếp ngắn gọn, dễ hiểu, kết luận trước được reinject ở lifecycle `before_agent_start` cho Main↔user và Main↔agent thay vì thêm rule. Hook không chứng minh discovery đúng, không cưỡng chế chất lượng văn phong/áp word cap và không tự đóng advisor finding.
Retry project giới hạn ba lần với backoff tối đa 30 giây và bật quota-aware fallback từ báo cáo đáng tin cậy; giữ nguyên chuỗi model đã chọn.
Không bảo đảm provider hồi phục hoặc loại được retry quota vĩnh viễn bằng cấu hình repo; thay đổi cần phiên mới và chưa có số đo latency sau rollout.
Đối chiếu `omp --version` trong lần rà soát này trả `omp/18.13.1`; executable tại `/home/nguyentd/.local/bin/omp` là ELF, không phải checkout source runtime.
[AdvisorRuntime 18.13.1](https://unpkg.com/@oh-my-pi/pi-coding-agent@18.13.1/src/advisor/runtime.ts) đã có quota latch sau khi host từ chối recovery; chưa xác nhận vì sao lỗi quota trong phiên EXCEL không kích hoạt chốt này, nên không coi `maxRetries: 3` là hard cap cho advisor.
[SessionAdvisors](https://unpkg.com/@oh-my-pi/pi-coding-agent@18.13.1/src/session/session-advisors.ts) không forward lifecycle lỗi advisor tới hook `message_end`; [AgentSession.abort](https://unpkg.com/@oh-my-pi/pi-coding-agent@18.13.1/src/session/agent-session.ts) không cung cấp thao tác abort riêng advisor qua extension context.
Không thêm hook `message_end`/`ctx.abort()` giả làm circuit breaker: nó không chặn đúng vòng lỗi này và có thể hủy worker cha.
Project routing hiện đặt `reviewer`, `security-reviewer` và cả hai advisor roster qua `@advisor` → Luna high; `plan`, `slow` và `tech-lead` dùng Opus high; scout dùng Luna high để thu evidence sơ bộ, Main vẫn tự kiểm tra source quyết định/caller rủi ro và giữ quyền kết luận.
Chính sách Codex cấp provider ưu tiên 11 tài khoản miễn phí hiện có (`priority: 100`) hơn 3 tài khoản Plus (`priority: 0`), nhưng Plus vẫn đủ điều kiện; reserve mặc định giữ nguyên 10%.
Đây là định tuyến best-effort: thứ hạng còn phụ thuộc tình trạng khả dụng, quota và các cửa sổ sử dụng.
Phiên được ghim tự động có thể chuyển sang tài khoản miễn phí khi quota còn ít nhất 20% theo ngưỡng reclaim; ghim do người dùng chọn rõ ràng không bị ghi đè.
Danh sách nhận diện là tĩnh, nên cần cập nhật khi thêm tài khoản hoặc thay đổi gói.
Giữ nguyên nhịp review, hướng dẫn roster và `syncBacklog` (Pre-handoff là `strict`); dùng phiên OMP mới để nạp policy/roster. Không cần generation; runtime model overrides vẫn có thể ưu tiên hơn cấu hình project.
Đây là cấu hình role selection, không phải runtime enforcement hay đảm bảo tuyệt đối về model do retry/fallback vẫn có thể chạy theo policy hiện có; không có số đo token savings.

### Blocker của advisor trên OMP

**Hiện tại chỉ có policy:** `.omp/RULES.md` mục 11, `.omp/WATCHDOG.md` và `.omp/rules/omp-routing.md`.
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

Subagent OMP không nhận file context tên `AGENTS.md`. Nội dung skill chỉ tới subagent qua `autoloadSkills` của profile, nên việc code phải giao cho specialist, không giao cho `task`/`sonic`.
Sửa header hoặc thân profile không tự cập nhật `.omp/agents/` hay context của phiên đang chạy.
Installer `bash .agent/scripts/install-harness-wiring.sh` cần user authorization riêng; không tự chạy generation từ yêu cầu sửa source, không sửa tay generated profiles.
Với task agent-context-sizing, user đã cấp command này sau A/B/C; Main sở hữu điều phối installer và kiểm soát generated changes ngoài task, worker không chạy.
Rollout bảo thủ dùng agent/phiên OMP mới sau generation; không hứa hot reload, behavior mới ở phiên hiện tại hoặc mức tiết kiệm context chưa đo.

## AGY

| File nguồn | Vai trò trên AGY |
| --- | --- |
| `agy/hooks.json` | Đăng ký `PreToolUse` với `matcher: "*"` chạy `boundary-guard.mjs`. Chỉ nối symlink tại `.agents/hooks.json`, không đặt trùng ở `.agent/hooks.json` để tránh chạy hook hai lần |
| `agy/boundary-guard.mjs` | Dịch `run_command`, `write_file`/`edit_file`, `call_mcp_tool` (`filesystem`), `mcp_filesystem_*` và `run_workflow` sang payload `Bash`/`Write` rồi gọi `agent-boundary-guard.mjs`. Trả `{"decision": "deny"}` khi vi phạm R1-R3, R5-R9 và `{"decision": "allow"}` khi hợp lệ hoặc fail-open |
| `agy/agents/*.md` | Header AGY (`model: inherit`, `subagent: true`, giới hạn `tools` cho `verifier` và `reviewer`) và phần "AGY runtime". Installer ghép với thân `.agent/agents/<name>.md` thành `.agents/agents/<name>.md` (riêng `reviewer` nằm trọn trong header AGY) |

Để dùng AGY ở chế độ full-accept tương tự OMP nhưng vẫn giữ guard chặn cứng, user bật Preset `Turbo` (hoặc `Auto`) qua `/permissions`, hoặc khởi chạy bằng `agy --dangerously-skip-permissions --mode auto`.
Frontmatter `agy/agents/*.md` giữ `model: inherit` vì bộ nạp custom agent của AGY chỉ chấp nhận 4 tier (`inherit`, `pro`, `flash`, `flash_lite`) và sẽ bỏ qua agent nếu ghi tên model cụ thể.
Để Main tuỳ chọn model bất kỳ còn specialist luôn chạy `gemini-4-hydrogen-high`, `.agent/rules/GEMINI.md` quy định điều phối specialist qua `swarm` (`action: "add"`, `model: "gemini-4-hydrogen-high"`), nghiệm thu xong thì `kill` worker.
Kiểm tra LSP trên AGY áp dụng cơ chế 2 chốt: worker là bên trực tiếp chạy `call_mcp_tool` `lsp`/`get_diagnostics` một lượt cuối slice theo hướng dẫn trong `agy/agents/*.md`, còn Main không chạy LSP thay worker mà chỉ kiểm mục `LSP:` trong báo cáo bàn giao và đối chiếu với `git diff` theo `.agent/rules/GEMINI.md`.
Nếu thiếu kết quả `LSP:` hoặc còn lỗi thuộc phạm vi slice, Main trả lại đúng specialist qua `post_message` (hoặc `send_message`) để tự chạy LSP và sửa bổ sung trước khi báo hoàn tất.
Hook và danh sách subagent mới trong `.agents/` chỉ có hiệu lực đầy đủ khi mở phiên AGY mới sau khi chạy installer.

