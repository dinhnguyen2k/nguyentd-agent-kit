---
description: "Main-session routing: ownership, on-demand dispatch protocol, source acceptance, advisor blockers, and rework."
alwaysApply: true
agents: main
---

# Định tuyến subagent (chỉ phiên chính)

Main sở hữu discovery, quyết định giải pháp, giao việc và nghiệm thu từ source; worker triển khai contract đã chốt.

## Định tuyến và phạm vi

- **Làm trực tiếp tại phiên Main (chỉ khi user giao rõ):**
  - Main chỉ được code khi user giao rõ cho Main làm trực tiếp task hiện tại, ví dụ `làm trực tiếp phiên main`, `main làm luôn`, `không dùng subagent, tự sửa ở main`.
  - Khi được giao trực tiếp: Main thực hiện trong phiên hiện tại, không dispatch worker viết code thay mình trong phạm vi đó.
  - `sửa`/`fix`/`triển khai`, `task gấp`/`gấp`, task nhỏ, một slice, ít dòng, thay đổi thuần cơ học hoặc giải pháp đã rõ không cấp quyền Main code.
  - Quyền chỉ áp cho task/phạm vi được user giao; không kế thừa từ task trước và không biến ý định chỉ đọc thành quyền sửa.
  - Khi làm trực tiếp: Main tự đọc source, tự nạp và áp dụng skill miền liên quan (`skill://backend-development`, `skill://frontend-development`, `skill://cogain-baseservice-hooks`, `skill://csharp-latest-standards`, `skill://cogain-form-rhf-zod`, v.v.), sửa code trực tiếp qua `edit`/`write`.
  - Trước bàn giao: Main tự xử lý và báo cáo kết quả LSP diagnostics trên từng file sửa ở lần sửa cuối theo `.omp/RULES.md` mục 3.
  - Vẫn tuân thủ các luật an toàn: không đoán code, không tự ý chạy build/test/migration khi chưa có yêu cầu, không commit.
- **Định tuyến qua subagent (mặc định cho triển khai code):**
  - Khi user chưa giao Main code trực tiếp, giao specialist triển khai kể cả task nhỏ hoặc chỉ có một slice; Main giữ discovery, quyết định và nghiệm thu source.
  - Khi dispatch: Production `backend/**` → `backend-specialist`; `frontend/**` → `frontend-specialist`. Không giao hai cây này cho `task`/`sonic` vì thiếu skill Cogain.
  - Test → `test-author`, chỉ khi user yêu cầu đích danh; review → `reviewer`, chỉ khi user yêu cầu review tường minh; gate `/orchestrate` → `verifier`.
- Dữ kiện đơn giản Main tự tra (`LOOKUP`). Với quyết định cần nghiên cứu, mặc định giao một `researcher` (`FOCUSED`); xem `.agent/skills/research/SKILL.md` về phạm vi và ngân sách. Chỉ khi người dùng yêu cầu hoặc quy trình cho phép rõ `DEEP`, Main mới giao câu hỏi độc lập cho nhiều Researcher, với ngân sách tổng và từng nhánh được chốt trước. Researcher chỉ đọc, được tự chia câu hỏi trong phạm vi đã giao nhưng không tạo agent con hay giao lại cho người khác. Main giữ trách nhiệm thiết kế và quyết định, tái dùng phát hiện thay vì lặp nghiên cứu. Chỉ mở lại câu hỏi bị ảnh hưởng, ở cấp độ đã được phép và trong ngân sách còn lại, khi có bằng chứng mới cần xử lý. `scout` chỉ lập bản đồ repo. Nếu không có Researcher phù hợp hoặc không thể đọc nguồn an toàn, nêu rõ giới hạn; không giả định đã nghiên cứu.
- Không thể dispatch specialist thì báo blocker, không tự sửa code tại Main hoặc đổi sang agent không đúng miền.
- Không sửa file worker đang sở hữu. Một luồng/context giữ một owner; chỉ tách slice có vùng đọc/ghi độc lập, `allowed_paths` tách biệt và interface dùng chung chỉ đọc, đã ổn định.

## Giao việc

- Main trước hết scope ngắn gọn; khi thực sự cần discovery, dùng scout để thu thập vị trí source, câu hỏi còn mở và rủi ro trước phân tích sâu. Không tạo hai hop gate/scout bắt buộc, không gọi cho việc đã rõ hoặc đủ evidence, và không outsource quyết định giải pháp cấp cao của Main.
- Trước dispatch hoặc đổi contract, đọc phần liên quan tại `.agent/workflows/plan.md`: Main discovery, Solution Critic, Định cỡ và quyền thực thi, Contract thực thi, Điều kiện dispatch; chỉ nạp lại khi source đổi hoặc phần cần dùng không còn trong context. Protocol này sở hữu chi tiết, không chép lại vào rule hay brief.
- Main chốt tính khả thi và recipe từ evidence trước khi giao, không để worker thiết kế lại. Lane viết code nhận đúng một `json dispatch-contract` làm brief duy nhất: điểm sửa/cách sửa/reuse, `allowed_paths`, evidence `path:line`, mapping và dữ liệu thiếu đã xác minh, phần giữ nguyên, acceptance, checks/stop conditions.
- Một slice dùng contract inline, không tạo plan chỉ để đủ nghi thức. Nhiều slice/cross-domain/public contract dùng `.agent/planning/<slug>/`; OMP có thể nhận đúng hai dòng `contract_ref`/`contract_version` để hook trích brief đầy đủ từ TASK trước dispatch. Harness khác nhận block trực tiếp; không sửa brief độc lập với canonical.
- Đặt `name` CamelCase; kèm "chỉ nhắn Main khi bị chặn hoặc cần quyết, không gửi tin trạng thái". Không lặp workflow/luật/lịch sử/phương án đã loại; bàn giao chỉ kết quả, file, blocker/unresolved và phần chưa kiểm.
- Chỉ dispatch khi prerequisite đã được Main nghiệm thu; giao đồng thời các slice độc lập sẵn sàng. Nghiệm thu kết quả tới trước và giải phóng dependency ngay, không chờ cả lô. Slice sau nhận interface đã chốt và source cần dùng, không crawl lại discovery.
- Worker đọc đúng vị trí và dependency trực tiếp để sửa an toàn, không khảo sát lại khi source khớp; contract thiếu/lệch hoặc cần đổi thiết kế thì trả Main. Không bỏ rule/skill bắt buộc hoặc mở lại quyết định nếu thiếu source/requirement/failure mode mới ảnh hưởng correctness.
- Gom các vùng đọc độc lập vào một lượt; tái dùng nội dung còn trong context, chỉ đọc lại khi source đổi, mất context hoặc có bằng chứng mới cần xác minh.

## Nghiệm thu và rework

- Main kiểm source và báo cáo bàn giao, không tự gọi gate độc lập. Điểm `Cần main quyết định` mà luật/code chưa chốt thì hỏi user bằng `ask`; user đổi requirement không phải lỗi plan/implementation.
- LSP trước bàn giao thuộc worker theo `.omp/RULES.md` mục 3; thiếu bằng chứng hoặc còn lỗi do thay đổi thì trả worker trước nghiệm thu.
- Handoff đầu tiên có LSP revision cuối, trạng thái advisor có bằng chứng và finding mở; không hỏi lại dữ kiện đã nhận. Nghiệm thu xong thì trả user, không gửi ACK/closure tới agent idle hoặc đánh thức worker chỉ để xác nhận kết thúc.
- Rework bằng `write agent://<id>` tới đúng handle/session, chỉ gửi delta và invariant. Không resume được thì ghi nhận handoff sang worker mới, không gọi là resume/cache hit. Đổi nội dung thực thi phải cập nhật contract/version/lifecycle và supersede theo workflow trước khi giao; giữ phần đã nghiệm thu không bị ảnh hưởng.
- Luồng dài chia milestone có acceptance, chỉ nạp source hiện hành và dependency trực tiếp. Runtime báo giới hạn thì checkpoint và quyết continuation/handoff, không cố kéo dài hoặc đổi `task.softRequestBudget` thành phần trăm context.
- `wait` chỉ khi không còn việc hành động; xử lý ngay kết quả đầu tiên, không polling/đọc lại file/xen `todo` khi chờ. Đã giao câu hỏi cho scout thì không tự điều tra trùng; chỉ đọc thêm vị trí được chỉ và phần chưa kiểm.
- Brief scout bắt buộc: file/pattern đã quét, kết luận kèm `path:line`, phần chưa kiểm, độ tin cậy từng kết luận. Scout chỉ lập bản đồ repo; phát hiện của scout là evidence sơ bộ. Main kiểm tra source quyết định/caller rủi ro khi dùng kết quả đó, không lặp lại lượt tìm kiếm rộng. Với Researcher, Main chỉ kiểm tra bằng chứng then chốt cần cho quyết định và tái dùng findings. Chỉ chuyển bằng chứng mới cần xử lý; không yêu cầu xác nhận lại chỉ để đóng việc.

## Giám sát và context

- Main không có advisor; advisor chỉ gác `backend-specialist`, `frontend-specialist`, `test-author` theo `.omp/config.yml` và `.omp/WATCHDOG.yml`: Turn guard mỗi 3 turn trên delta tích lũy, Pre-handoff review toàn slice.
- Blocker theo `.omp/RULES.md` mục 11. Giữ finding/số vòng sửa trong contract/checkpoint; Main kiểm source và review lại trước nghiệm thu hoặc bác bỏ. Worker báo xong, advisor im lặng/lỗi hoặc `syncBacklog: strict` đã đợi không phải PASS.
- Worker phớt lờ blocker hoặc hai vòng sửa còn sai: cancel run, xác nhận đã dừng rồi mới đổi owner/model/contract; không tự rollback hoặc coi đổi model là hết lỗi. Giới hạn khóa runtime: `.agent/harness/README.md`, mục "Blocker của advisor trên OMP".
- `boundary-guard` chặn thì dừng và báo nguyên văn, không tìm đường vòng. Quyền validation theo `AI_RULES.md` và `.omp/RULES.md`, không được suy từ contract/advisor/workflow.
- User đổi module/mục tiêu không liên quan: nhắc `/compact` hoặc phiên mới trước khi làm.
- Lỗi lặp: đề xuất theo thứ tự hook/regex/AST → field contract → eval case → skill/rule. Không tự ghi skill/rule mới khi chưa được user duyệt (`.agent/knowledge/skill-governance.json` publishGate).
