---
name: plan
description: Main nghiên cứu, chốt giải pháp và giao contract thực thi gọn cho từng slice.
---

# /plan - Chốt trước, giao gọn

$ARGUMENTS

## Main discovery

1. Chốt yêu cầu, invariant và ngoài scope từ user/source/luật; chỉ hỏi nghiệp vụ hoặc đánh đổi repo không giải đáp được.
2. Trace flow thật tới điểm sở hữu hành vi; đọc source, nearest test/pattern và caller/consumer theo risk, không quét workspace hoặc load lại context đã có.
3. Xác minh file/symbol, signature và semantics của reuse bằng `path:line`; không suy khả năng của helper từ tên.
4. Chốt input/output, business key/default/enum/nullability, thứ tự và nhánh lỗi liên quan; với flow cần thiết, chốt transaction, compensation, tracking/replay và cancellation ownership.
5. Rà giả định, failure mode, scope thừa, compatibility và tác động user/vận hành theo risk; hoàn tất prerequisite trước khi giao slice phụ thuộc.

Main sở hữu tính khả thi và quyết định thiết kế cùng ranh giới rủi ro cao một lần; không dựng thêm planner chỉ để diễn giải lại quyết định của Main.
Mỗi luận điểm được chọn phải kết thúc bằng chỉ dẫn sửa cụ thể: sửa file/symbol nào, thay hành vi hoặc logic nào bằng cách nào và giữ nguyên điều gì.
Kết luận phân tích hoặc tên mục tiêu không thay thế được chỉ dẫn triển khai; Main chưa chuyển được giải pháp thành các bước sửa thì chưa giao worker.
Worker xác nhận source rồi implement, không nhận discovery còn mở.
Thiếu dữ kiện ảnh hưởng correctness thì Main nghiên cứu tiếp hoặc hỏi user, không dispatch để worker tự lấp.
Không tự mở review độc lập; chỉ delegate khi được phép và user yêu cầu rõ.

## Đầu ra tối thiểu

Chỉ giữ nội dung làm thay đổi hành động, giới hạn phạm vi, bảo toàn invariant hoặc giúp xác minh kết quả.
Không xuất nhật ký tìm hiểu, transcript, phương án đã loại, role/mission, review PASS, `n/a`, section rỗng hoặc lời giải thích lại luật đã nạp.
Không ép số task, số luận điểm, GitHub alerts, sơ đồ hay cấu trúc nhiều phase khi không có giá trị thực thi.

- **Quyết định**: một câu chốt cách làm; thêm một câu lý do và `path:line` khi cần bảo vệ lựa chọn.
- **Contract**: chỉ giao slice hiện hành với cách sửa đã chốt và ràng buộc cần cho worker.
- **Blocker/phần chưa kiểm**: chỉ ghi khi có; không gọi metadata/hash hợp lệ là hiểu đúng giải pháp hoặc `verified`.

Main giữ phân tích để chốt, không chuyển cả quá trình suy luận cho worker.
Không cắt error behavior, authorization, data integrity, cancellation, transaction consistency hay acceptance chỉ để plan ngắn hơn.

## Định cỡ và quyền thực thi

- Main tự sửa thay đổi thuần cơ học khi đã có source trong context, biết chính xác vị trí/phép biến đổi và không đổi hành vi hoặc quyết định nghiệp vụ; không tạo TASK/worker riêng.
- Xác nhận lại source nếu đã thay đổi sau lần đọc; không coi ít dòng là cơ học.
- Không sửa file worker đang sở hữu; gửi delta cho worker đó. Giao thay đổi logic cho specialist.
- Giữ một owner cho cùng luồng/context; gom các bước sửa thành checklist, không tạo worker theo từng method/finding.
- Chỉ tách worker khi độc lập về vùng đọc/ghi và không dùng chung core service lớn, transaction, lifecycle hoặc contract đang biến động.
- Chỉ cho phép dùng chung interface chỉ đọc đã chốt; giữ `allowed_paths` tách biệt và kiểm dependency trước dispatch.
- Chia luồng dài thành milestone có acceptance; chỉ nạp source cho milestone hiện hành và dependency trực tiếp.
- Khi runtime báo giới hạn context/request, checkpoint rồi quyết định continuation hoặc handoff; không cố kéo dài phiên hoặc suy phần trăm context từ request budget.

## Contract thực thi

TASK hoặc contract inline phải có `allowed_paths`, `Reuse`, `Acceptance`, file mẫu gần nhất và rule/skill liên quan.
Khi có persisted TASK, TASK canonical là nguồn duy nhất được sửa scope, acceptance và chỉ dẫn thực thi; assignment phải giao trực tiếp nội dung thực thi hiện hành của slice, kèm `contract_ref` và `contract_version` để truy nguồn.
Nội dung giao trực tiếp là bản trích từ TASK đúng version, gồm metadata cần thực thi và recipe liên quan, không phải contract thứ hai được sửa độc lập.
Không giao chỉ bằng đường dẫn, mã TASK hoặc câu “đọc TASK rồi triển khai”, kể cả khi đã gửi manifest/hash hợp lệ.
Khi không có persisted TASK (việc một slice), assignment tự ghi contract inline gọn.
Giao trực tiếp và TASK trong plan có cùng mức rõ ràng về cách sửa; phạm vi nhỏ chỉ giảm nghi thức và artifact, không chuyển phần thiết kế còn thiếu sang worker.
Gộp thành brief ngắn, không lặp cùng thông tin giữa metadata và prose:

1. **Điểm sửa**: file/symbol, hành vi hiện tại và hành vi đích; source citation sát bước liên quan.
2. **Thực hiện**: chỉ rõ thêm, thay hoặc bỏ logic nào tại từng điểm sửa, theo thứ tự thực thi cần thiết.
   Chốt điều kiện/nhánh xử lý, dữ liệu đi vào/đi ra, reuse path/signature/semantics và cách nối caller/consumer bị ảnh hưởng khi có.
   Với thay đổi contract hoặc dữ liệu, ghi shape/mapping cần đổi và cách xử lý lỗi liên quan, không để worker tự suy từ mục tiêu.
3. **Giới hạn**: phần giữ nguyên, thứ cấm tạo/đổi; dependency/Seams hoặc nợ được phép chỉ khi có.
4. **Đạt khi**: kết quả cụ thể cho luồng chính, nhánh biên/lỗi và invariant liên quan, quan sát được bằng đọc code; checks chỉ trong quyền user đã cấp.

Không giao chỉ bằng các câu như “sửa đúng nghiệp vụ”, “tối ưu”, “refactor cho sạch” hoặc “đồng bộ caller” khi chưa chỉ rõ thay đổi tương ứng.
Mức chi tiết phải đủ để worker triển khai mà không cần chọn lại giải pháp; không cần viết sẵn toàn bộ code hay áp đặt chi tiết cục bộ tương đương.
TASK hiện hành phải tự chứa đủ ràng buộc thực thi, không bắt worker mở overview, TASK cha hay lịch sử để ghép yêu cầu.
Nếu `json task-contract` đã ghi goal, paths, acceptance, dependencies, checks hoặc stop conditions thì prose chỉ bổ sung cách thực hiện, không chép lại danh sách đó.
Không copy nguyên type/proto/source khi có path/symbol; chỉ trích shape hoặc constraint cần tránh nhầm.
Không chép checklist luật chung vào mọi TASK; chỉ nêu ngoại lệ hoặc risk riêng của slice.

### Bàn giao context đủ để thực thi

Main chỉ rõ vị trí cần đọc bằng path + symbol hoặc khoảng dòng, kèm mục đích đọc ngay tại bước sửa/reuse tương ứng.
Bao gồm source cần sửa, định nghĩa reuse và test/pattern/caller trực tiếp cần cho việc xác nhận; không giao cả thư mục để worker tự tìm điểm bắt đầu.
Main ghi kết luận phụ thuộc đã xác minh và ràng buộc cần giữ, thay vì bắt worker đọc lại chuỗi discovery để tự rút ra cùng kết luận.
Với logic dễ hiểu sai, Main chốt thứ tự xử lý, mapping hoặc bảng điều kiện/pseudocode ngay trong bước sửa; chỉ dùng khi prose chưa đủ xác định cách triển khai.
Các chỉ dẫn này được soạn tại TASK canonical hoặc contract inline hiện có và giao ngay trong assignment; không tạo thêm context pack, schema hay bản sao source.

### Giao trực tiếp khi có nhiều task

Main phải chuyển kế hoạch thành assignment tự chứa cho từng worker, không chuyển việc tìm hiểu kế hoạch sang worker.
Ngay trong `tasks[].task`, giao đủ điểm sửa và cách sửa, `allowed_paths`, reuse với signature/semantics đã xác minh, phần giữ nguyên, acceptance, giới hạn checks và stop conditions của slice.
Thông tin dùng chung chỉ đặt một lần trong context mà worker thực sự nhận được; không bắt worker đi tìm ở assignment của worker khác.
Không gửi nguyên bộ plan hoặc nhiều TASK không thuộc slice; không rút gọn đến mức worker phải mở chúng để ghép yêu cầu.
Mỗi bước sửa kèm path + symbol/khoảng dòng và mục đích đọc; không chỉ liệt kê `source_paths` rồi yêu cầu worker tự tìm logic.
Với prerequisite đã nghiệm thu, giao kết luận/interface/shape đã chốt và vị trí source đã đổi cần dùng; worker không phải đọc lại TASK phụ thuộc hoặc lịch sử bàn giao để tự rút ra kết luận đó.
`contract_ref` phục vụ truy nguồn, đối chiếu version và kiểm tra identity theo protocol; không thay nội dung giao việc.
Worker không phải mở lại TASK chỉ để lấy yêu cầu đã có trong assignment; kiểm tra canonical bắt buộc của governed gate vẫn giữ nguyên.
Đọc source, type, caller/consumer và test/pattern trực tiếp vẫn bắt buộc theo risk; giao thẳng không có nghĩa cấm đọc source hoặc buộc sửa mù theo số dòng.
Worker chỉ mở rộng tra cứu khi gặp thiếu/mâu thuẫn cụ thể như quy định bên dưới, không crawl lại module, chuỗi TASK hoặc toàn bộ discovery.
Main đối chiếu assignment với TASK hiện hành trước dispatch; nếu thiếu acceptance, lệch version hoặc còn yêu cầu phải tự tìm hiểu thiết kế thì chưa giao.
Rework bằng continuation đúng agent handle/session hiện hữu; không spawn mới rồi gắn lại tên owner.
Không resume được thì ghi nhận chuyển giao sang worker mới; không gọi đó là resume hoặc suy rằng có cache hit.
Chỉ gửi delta: finding, phần còn lại, source/version thay đổi và invariant cần giữ; không gửi lại toàn bộ assignment/lịch sử hoặc chỉ nhắn “tiếp tục TASK”.
Nếu nội dung thực thi đổi, cập nhật TASK/version/lifecycle và supersede theo protocol trước khi giao lại, không sửa riêng assignment để tạo hai nguồn yêu cầu.

Worker đọc các vị trí đã chỉ để xác nhận source rồi sửa theo từng bước; không viết lại plan, khảo sát module, tìm thêm pattern hoặc so sánh giải pháp khi source khớp contract.
Đọc đủ thân hàm/type và ngữ cảnh trực tiếp cần để sửa an toàn, không coi khoảng dòng là giới hạn cứng hoặc bỏ qua rule/skill bắt buộc.
Chỉ mở rộng đọc khi có dấu hiệu cụ thể: symbol/signature không khớp, dependency trực tiếp chưa rõ, caller bị ảnh hưởng chưa có trong contract hoặc invariant có nguy cơ bị vi phạm.
Khi đó chỉ truy đúng dependency hoặc reference liên quan; nếu phát sinh quyết định thiết kế hay scope mới thì trả Main, không biến việc xác nhận thành discovery toàn bài toán.
Không đọc lại nội dung đã có trong context khi source không đổi và không có câu hỏi mới cần giải đáp.
Sau khi sửa, worker đối chiếu delta với acceptance và bàn giao kết quả; không tự mở vòng audit toàn module hoặc cải tiến ngoài contract.

Worker tự quyết chi tiết cục bộ tương đương như tên biến, guard clause và cấu trúc biểu thức.
Không mời worker đánh giá lại giải pháp, tìm phương án tốt hơn hoặc tự chọn business default, API, transaction/retry/compensation boundary hay abstraction mới.
Thiếu symbol, source trái contract, reuse không đáp ứng invariant hoặc cần vượt scope: dừng phần liên quan, trả Main `path:line`, expected/actual và điểm cần chốt; phần độc lập vẫn làm tiếp.
Đây là stop condition mặc định, không cần diễn giải lại ở nhiều section.

## Điều kiện dispatch

Tính sẵn sàng theo dependency, không phải số thứ tự TASK hay rào cản batch, quyết định thời điểm dispatch.
Main kiểm một lần trước khi giao slice:
- Prerequisite của slice đã hoàn tất và được Main nghiệm thu, đồng thời interface hoặc contract dùng chung đã ổn định.
- Khi thỏa mãn, dispatch đồng thời các slice độc lập đã sẵn sàng.
- Yêu cầu quyền sở hữu ghi tách biệt hoàn toàn và không phụ thuộc output khả biến của slice khác chưa hoàn thành.
- Khi một nhánh hoàn thành, Main nghiệm thu nhánh đó và giải phóng ngay các slice phụ thuộc vào nó mà không phải chờ các nhánh chạy song song khác chưa xong.
- Điểm sửa và cách làm có bằng chứng, reuse đáp ứng invariant và tác động tới caller đã được rà soát.
- Contract đã chỉ rõ cần sửa gì và sửa như thế nào tại từng điểm sửa; worker không phải tự chuyển luận điểm hoặc mục tiêu chung thành thiết kế.
- Assignment đã chứa trực tiếp brief thực thi đủ dùng; bỏ các đường dẫn TASK khỏi phần hướng dẫn vẫn xác định được cần sửa gì, ở đâu, bằng seam nào và đạt khi nào.
- Không còn quyết định mở ảnh hưởng correctness, acceptance đạt được trong scope, và một contract hiện hành đủ để làm mà không dựa vào lịch sử rework.

Đây thuần túy là điều phối thứ tự thực thi, không phải quyền merge hoặc deploy sai thứ tự, không bỏ qua quyền validation của user, và không bypass các bước kiểm canonical snapshot hay supersession.
Chưa đạt thì Main xử lý phần thiếu; checklist này không phải section phải sinh trong TASK, không thêm gate/agent/schema/status.
Quyết định đã chốt chỉ mở lại khi có source/requirement mới hoặc failure mode có bằng chứng làm mất correctness, không vì worker/advisor thấy một cách khác đẹp hơn.
Main sửa nguồn quyết định và contract bị ảnh hưởng trước khi giao tiếp; user đổi requirement không bị đánh đồng với lỗi plan/code.

## Artifact ownership

- Read-only/proposal: trả plan và citations trong chat; không persist khi chưa được phép ghi.
- Fast/standard hoặc một slice: contract gọn trong assignment; chỉ persist canonical contract/checkpoint khi handoff/resume cần, không tạo thư mục/manifest cho đủ mẫu.
- Nhiều slice, cross-domain hoặc public contract được phép persist: `.agent/planning/<slug>/00-OVERVIEW.md` và canonical `TASK-<NN>-<slug>.md`; không tạo thêm PLAN/walkthrough/handoff trùng nội dung.
- Overview chỉ giữ quyết định tổng thể, task index một dòng mỗi TASK, dependency/lifecycle/supersession và finding còn ảnh hưởng plan; không copy scope/acceptance hoặc log mọi phản biện/PASS.
- Coordinator alone sửa overview/index/lifecycle/review state; scope/acceptance chỉ sửa tại TASK canonical.
- Runbook/rollback/product docs/diagram user yêu cầu giữ tại owner phù hợp và link; nghiên cứu chỉ persist khi được yêu cầu trong `.agent/artifacts`, không tạo mới trong reports/artifacts.

Bàn giao chỉ nêu cách làm đã chốt, path artifact thực sự có, blocker và phần chưa kiểm; worker nhận trực tiếp nội dung thực thi của slice từ TASK hiện hành, không chỉ đường dẫn hoặc cả thư mục.
Không buộc mọi plan có Next Steps, Open Questions, review log hoặc sign-off khi không có thông tin mới.

## Quyết định có đánh đổi đáng kể

Chỉ phân tích khi phải chọn kiến trúc/public contract/storage/cache, transaction boundary, external call/consumer/job hoặc rủi ro production đáng kể.
Triển khai pattern/quyết định đã chốt không tự mở gate chỉ vì chạm risk surface.
Main ghi một lần tại overview (`D1`, `D2`, ...) hoặc chat/contract hiện có; TASK chỉ mang ràng buộc thực thi liên quan.
Nêu lựa chọn + lý do + đánh đổi/failure mode thực tế; vận hành/rollback và requirement gần nhất chỉ thêm khi làm thay đổi lựa chọn, không điền năm câu theo mẫu.
Không dựng abstraction cho requirement suy đoán; áp `.agent/rules/solution-complexity.md` và mục khớp risk surface trong `.agent/rules/architecture-review.md`.

## Canonical metadata và dispatch

Áp khi dùng persisted TASK, không đưa protocol này vào brief worker:
- Mỗi TASK có đúng một fence `json task-contract` theo `$defs.contract` của `.agent/contracts/task-manifest.schema.json`.
- Metadata canonical: `task_id`, `slice_id`, `contract_version`, `lifecycle_ref`, `goal`, `mode`, `owner`, `allowed_paths`, `source_paths`, `acceptance`, `dependencies`, `permitted_checks`, `stop_conditions`.
- Overview cùng thư mục có đúng một `json task-lifecycle` theo `$defs.lifecycle`, với `contract_versions` khớp TASK; overview không sở hữu scope/acceptance.
- `source_paths` bao phủ allowed paths và source bị ảnh hưởng, không gồm TASK/overview hoặc generated/runtime evidence được hash riêng.
- Reuse `readTaskContract(repoRoot, contractPath)`; governed manifest v2 dẫn xuất qua `deriveTaskManifest(contract)` hoặc `node .agent/scripts/task-contract.mjs manifest --contract <TASK> --output <manifest>` khi user cho phép generation, không sửa tay manifest hoặc dựng parser/schema thứ hai.
- Governed dispatch ghi dòng riêng `contract_ref: .agent/planning/<slug>/TASK-<slice>.md` trong `tasks[].task`, cùng version và nội dung thực thi trực tiếp theo mục trên; không dùng `contract_ref` thay assignment.
- Packet identity chỉ giữ task/slice/ref/version, contract/lifecycle hash và repo/worktree/source identity từ `computeSourceIdentity`; brief thực thi trong assignment là bản trích của TASK, không phải nguồn scope/acceptance thứ hai.
- Nội dung thực thi đổi, kể cả prose: tăng `contract_version` và đồng bộ lifecycle; contract/lifecycle/source đổi thì supersede packet cũ và phát snapshot mới, không resume implementation closed/blocked/archived/superseded.

Chỉ khi xử lý outstanding supersession, Main đọc mục **Supersession - chỉ đọc khi contract/lifecycle/source thay đổi** tại `.agent/workflows/orchestrate.md`.
Giữ nguyên inspection/approval/publish protocol; không load hoặc chép chi tiết này vào plan mới không có supersession.

Plan không cấp quyền code, validation, generation, installer, app hoặc commit; chỉ chạy hành động khi user nêu đúng tên và đúng role được phép.
