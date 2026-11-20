---
name: plan
description: Main nghiên cứu, chốt giải pháp và giao contract thực thi gọn cho từng slice.
---

# /plan - Chốt trước, giao gọn

$ARGUMENTS
## Quyền sở hữu và vòng đời điều phối

- **Quyền sở hữu**: `AI_RULES.md` nắm quyền thực thi và an toàn; rule miền nắm chuẩn kỹ thuật; `plan` điều phối tiến trình; contract quyết định phạm vi và recipe cho task; worker thi hành đúng recipe; watchdog đưa finding có bằng chứng.
- **Trạng thái nghiệp vụ điều phối** (không đổi schema lifecycle hoặc gán enum mới):
  1. *Tư vấn* -> *Chốt thiết kế*: khi requirement của user, proposal của Main và approved scope được phân định rõ ràng.
  2. *Chốt thiết kế* -> *Triển khai*: khi recipe khả thi, đã xác minh seam reuse và caller/error branch, thỏa mãn điều kiện dispatch.
  3. *Triển khai* -> *Nghiệm thu*: khi worker hoàn tất sửa theo contract, cung cấp LSP revision cuối và trạng thái advisor.
  4. *Nghiệm thu* -> *Bàn giao*: khi đạt hai câu hỏi nghiệm thu (đúng contract và thiết kế đủ đơn giản), không còn blocker.
  5. *Bàn giao*: hoàn tất khi nêu đủ file thay đổi, blocker và phần chưa kiểm.


## Main discovery

1. Chốt yêu cầu, invariant và ngoài scope từ user/source/luật; lấy hành vi và contract hiện hữu làm baseline. Main được tư vấn phương án tốt hơn có evidence/tradeoff; tách bạch requirement của user, proposal của Main và approved scope, không tự mở scope.
   Không coi phần user chưa mô tả là quyền tự thêm dữ liệu bắt buộc, đổi default, định dạng, thao tác hoặc public contract.
   Chỉ hỏi nghiệp vụ hoặc đánh đổi repo không giải đáp được; nếu source mâu thuẫn luật/doc thì báo mâu thuẫn, không tự chọn baseline.
2. Trace flow thật tới điểm sở hữu hành vi; trước dispatch trace owner thực sự, đọc source, nearest test/pattern và caller/consumer theo risk, không quét workspace hoặc load lại context đã có.
   Gom các vùng source độc lập vào cùng lượt đọc; khi nội dung còn trong context, không đọc lại cùng vùng chỉ để xác nhận lần nữa.
   Chỉ mở lại vùng đó khi source đổi, nội dung không còn trong context hoặc có mâu thuẫn/failure mode mới; worker xác nhận các điểm sửa và dependency trực tiếp, không chạy lại khảo sát toàn module.
3. Xác minh file/symbol, signature và semantics của reuse tại khai báo gốc bằng `path:line` trước dispatch; dùng LSP cho definition/type/reference khi có.
   Kiểm kiểu input/output, tham số, field thực tế và điều kiện gọi cần cho điểm sửa; chỉ đọc caller/implementation trực tiếp khi declaration chưa chứng minh semantics.
   Không suy khả năng của helper từ tên, shape từ lời kể hoặc giao trước rồi mới kiểm chứng seam đã khẳng định trong contract.
4. Chốt input/output, business key/default/enum/nullability, thứ tự và nhánh lỗi liên quan.
   Rà soát các caller cùng quy tắc và nhánh lỗi; chỉ chốt khi khả thi.
   Mapping phải dựa trên DTO/type, FK và flow đã đọc: phân biệt ID của thực thể nguồn với ID của dòng đích, quan hệ 1:1/1:N và khóa giữ các dòng trùng công đoạn.
   Không dùng field dự phòng, ID thay thế hoặc default khi chưa có contract quy định; thiếu bằng chứng thì chưa dispatch.
   Với flow cần thiết, chốt transaction, compensation, tracking/replay và cancellation ownership.
   Trước khi giao viết tính năng, màn hình, luồng duyệt hoặc báo cáo mới: bắt buộc đối chiếu `[skill:cogain-screen-archetypes]` và chốt đủ 5 bất biến nghiệp vụ (nếu mã nguồn chưa tường minh thì phải hỏi gọn người dùng trước khi giao code):
   (1) Trạng thái vòng đời hợp lệ được tính số liệu (`EWorkItemStatus.Closed` so với trạng thái bảng nội bộ);
   (2) Mốc thời gian hiệu lực nghiệp vụ (`HrConfirmedDate` so với `CreatedDate` hoặc `ExecutionDate`);
   (3) Quy tắc cắt kỳ thời gian và helper chuẩn (`AttendanceReportPeriod` / `PayrollReportQueryHelper` so với `PeriodId`);
   (4) Khuôn mẫu giao diện/dịch vụ chuẩn theo `[skill:cogain-screen-archetypes]` (cấm chép helper nội bộ từ `_components`/`-components` của route khác);
   (5) Cách xử lý dữ liệu cũ chưa có trường mới.
5. Hoàn tất prerequisite trước khi giao slice phụ thuộc; phản biện phương án theo phase **Solution Critic** bên dưới trước implement/dispatch.

Main sở hữu tính khả thi và quyết định thiết kế cùng ranh giới rủi ro cao một lần; không dựng thêm planner chỉ để diễn giải lại quyết định của Main.
Main chịu trách nhiệm chọn giải pháp đủ đơn giản, không chỉ soạn contract đủ để worker thi hành.
Trước khi chốt recipe, tuân thủ `rule://solution-complexity`, `rule://backend-pragmatic-solid` và `skill://clean-code`: bỏ phần không cần cho yêu cầu hiện tại (YAGNI), tái dùng nơi đã sở hữu hành vi, dùng capability có sẵn của framework/thư viện, rồi mới thêm implementation mới; interface/wrapper mới bắt buộc qua Abstraction Gate (`backend-pragmatic-solid` §2).
Không chuyển logic phòng thủ chưa có nhu cầu được chứng minh vào helper chung chỉ để gọi đó là reuse.
Khi gom một quy tắc nghiệp vụ, trace các nơi cùng quyết định quy tắc đó trong flow bị ảnh hưởng, không chỉ các đoạn có hình thức giống nhau; đối chiếu input, điều kiện gọi và nhánh lỗi trước khi gom. Khác biệt nghiệp vụ có chủ đích phải được giữ, khác biệt chưa rõ phải được chốt trước dispatch.
Mỗi luận điểm được chọn phải kết thúc bằng chỉ dẫn sửa cụ thể: sửa file/symbol nào, thay hành vi hoặc logic nào bằng cách nào và giữ nguyên điều gì.
Kết luận phân tích hoặc tên mục tiêu không thay thế được chỉ dẫn triển khai; Main chưa chuyển được giải pháp thành các bước sửa thì chưa giao worker.
Worker xác nhận source rồi implement, không nhận discovery còn mở.
Thiếu dữ kiện ảnh hưởng correctness thì Main nghiên cứu tiếp hoặc hỏi user, không dispatch để worker tự lấp.
Không tự mở review độc lập; chỉ delegate review khi user yêu cầu rõ.
Dispatch specialist triển khai code theo mặc định tại `AI_RULES.md` §6, không cần user yêu cầu chia việc riêng.

## Solution Critic - Phản biện trước triển khai

Sau research và đề xuất giải pháp, Main tự phản biện một lượt theo bốn góc dưới đây trước khi implement hoặc dispatch.
Việc nhỏ rà ngắn, rủi ro cao mới đào sâu; thay đổi thuần cơ học không cần dựng phase riêng.
Không ép sinh bốn phương án, không tự mở agent review độc lập.

| Góc | Cần xác định |
| --- | --- |
| Đúng và đủ | Đúng root cause, bao phủ caller/luồng nghiệp vụ, edge/failure case và regression; giả định nào chưa có bằng chứng? |
| Chất lượng thiết kế | Đúng convention, reuse và boundary theo `rule://backend-pragmatic-solid` và `skill://clean-code`; coupling/abstraction có cần thiết, có overengineering hoặc tách file làm khó tìm logic? |
| Bảo trì và tech debt | Áp `rule://solution-complexity`: có duplicate cùng lý do thay đổi, workaround, dependency ẩn; thay đổi nghiệp vụ gần nhất có bằng chứng sẽ khó ở đâu? |
| Độ tin cậy và kiểm chứng | Theo risk: security, performance, concurrency, data consistency, timeout/dependency failure; cách kiểm chứng, debug/observability và rollout/rollback khi liên quan? |

- Rà bằng tình huống input/state -> kết quả quan sát được cho luồng chính và nhánh biên/lỗi bị ảnh hưởng, không dùng nhãn “DRY/clean/đúng nghiệp vụ” thay acceptance.
  Chọn tình huống theo thay đổi thực tế: dữ liệu thiếu/trùng/mơ hồ, quyền bị từ chối, kết quả async đã cũ hoặc lỗi giữa nhiều bước; không bắt mọi task điền tất cả nhóm rủi ro.
- Finding phải có bằng chứng `path:line` hoặc giả định chưa xác minh, tình huống cụ thể, hậu quả và hướng xử lý; không kết tội chỉ vì chưa SOLID/DRY hoặc dựng abstraction cho tương lai suy đoán.
  Không cần bug runtime mới được báo rủi ro bảo trì cụ thể (như sửa cùng quy tắc ở nhiều nơi, error semantics lệch, sai owner, coupling).
- **CHẶN**: sai nghiệp vụ, vi phạm luật cứng hoặc thiếu dữ kiện ảnh hưởng correctness; chưa được implement/dispatch.
- **CẦN SỬA**: rủi ro thiết kế/bảo trì có tình huống cụ thể; Main sửa phương án hoặc chốt đánh đổi có bằng chứng trước triển khai, không dùng đánh đổi để bỏ qua luật cứng hay acceptance.
- **GỢI Ý**: sở thích không có failure mode cụ thể; không chặn và không mở rộng scope.
- Chỉ ghi finding và thay đổi quyết định trong chat/contract hiện có, không sinh báo cáo riêng hay bốn mục PASS rỗng; không có finding thì tiếp tục.
- Main cập nhật recipe/contract sau phản biện; chỉ rà lại phần bị ảnh hưởng khi có thay đổi hoặc bằng chứng mới, không tranh luận lặp.
- Cách kiểm chứng không phải quyền thực thi: không tự chạy test/build/app hoặc mở quyền validation.

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

- Mặc định Main discovery, chốt giải pháp, giao specialist triển khai và nghiệm thu source, kể cả task nhỏ, một slice hoặc thay đổi thuần cơ học.
- Main chỉ code trực tiếp khi user giao rõ cho Main làm trực tiếp task hiện tại theo `AI_RULES.md` §6; không tạo TASK/worker riêng cho phạm vi đã được giao trực tiếp.
  Main tự nạp skill miền liên quan và tự xử lý LSP trước bàn giao.
- Yêu cầu sửa chung, `gấp`, ít dòng hoặc giải pháp đã rõ không cấp quyền Main code; không kế thừa quyền từ task trước.
  Không thể dispatch specialist thì báo blocker, không tự chuyển sang Main code.
- Xác nhận lại source nếu đã thay đổi sau lần đọc.
- Không sửa file worker đang sở hữu; gửi delta cho worker đó.
- Giữ một owner cho cùng luồng/context; gom các bước sửa thành checklist, không tạo worker theo từng method/finding.
- Chỉ tách worker khi độc lập về vùng đọc/ghi và không dùng chung core service lớn, transaction, lifecycle hoặc contract đang biến động.
- Chỉ cho phép dùng chung interface chỉ đọc đã chốt; giữ `allowed_paths` tách biệt và kiểm dependency trước dispatch.
- Chia luồng dài thành milestone theo dependency và điểm rủi ro, không theo số file/method; giữ một owner khi còn cùng context, transaction hoặc service.
  Main xác minh declaration và tính khả thi của seam trước khi giao phần nghiệp vụ phụ thuộc; milestone không thay discovery còn thiếu bằng worker viết thử.
  Mỗi milestone có acceptance quan sát được và checkpoint trong contract hiện có; nghiệm thu phần prerequisite trước khi mở phần phụ thuộc.
  Không tạo worker/artifact riêng hoặc để lại scaffold chỉ để đủ milestone; chỉ nạp source cho milestone hiện hành và dependency trực tiếp.
  Checkpoint giữ requirement, contract version, decisions, unresolved, source evidence và unverified; dùng artifact hiện có chỉ khi cần resume, không tạo state store hoặc template mới.
- Khi runtime báo giới hạn context/request, checkpoint rồi quyết định continuation hoặc handoff; không cố kéo dài phiên hoặc suy phần trăm context từ request budget.
  OMP có hook `worker-checkpoint.ts` nhắc ở turn 30 và 40, trước soft request budget 50; đây là tín hiệu chủ động, không phải số đo context hay khóa runtime.
  Cảnh báo mốc 40 không đồng nghĩa handoff bắt buộc hoặc tự dừng; worker không từ chối bước cần thiết nếu acceptance còn khả thi trong run. Chỉ bàn giao `partial`/`blocked` khi gặp giới hạn runtime/context hoặc blocker thực tế, kèm file/symbol còn lại, LSP ở lần sửa cuối và finding mở; không mở thêm nhánh discovery mới rồi đợi bị hủy.

## Contract thực thi

Contract xác định file/symbol, cách sửa, reuse có bằng chứng và acceptance; pattern/rule chỉ nêu khi thay đổi quyết định triển khai.
Khi có persisted TASK, TASK canonical là nguồn duy nhất được sửa scope, acceptance và chỉ dẫn thực thi; assignment phải giao trực tiếp nội dung thực thi hiện hành của slice, kèm `contract_ref` và `contract_version` để truy nguồn.
Nội dung giao trực tiếp là bản trích từ TASK đúng version, gồm metadata cần thực thi và recipe liên quan, không phải contract thứ hai được sửa độc lập.
Không giao chỉ bằng đường dẫn, mã TASK hoặc câu “đọc TASK rồi triển khai”, kể cả khi đã gửi manifest/hash hợp lệ.
Riêng OMP có thể nhận đúng hai dòng `contract_ref` và `contract_version`: hook tự đọc TASK hiện hành, trích và kiểm block trước khi giao brief đầy đủ cho worker.
Không kèm prose hoặc recipe thứ hai trong dạng rút gọn; harness không có hook này vẫn phải nhận block trực tiếp.
Khi không có persisted TASK (việc một slice), assignment tự ghi contract inline gọn.
Giao trực tiếp và TASK trong plan có cùng mức rõ ràng về cách sửa; phạm vi nhỏ chỉ giảm nghi thức và artifact, không chuyển phần thiết kế còn thiếu sang worker.
Gộp thành brief ngắn, không lặp cùng thông tin giữa metadata và prose:

Lane viết code nhận đúng một fence `json dispatch-contract` trong brief thực thi sau pre-dispatch hook, theo `$defs.dispatch` của `.agent/contracts/task-manifest.schema.json`.
Block này là brief thực thi, không phải metadata đính kèm một bản brief lặp lại:
- `allowed_paths`: phạm vi ghi.
- `changes[]`: `file` cụ thể, `instruction` chốt symbol/cách thêm-thay-bỏ/reuse/nhánh xử lý, `evidence[]` là `path:line` hoặc `path:start-end` cho source cần đọc ngay tại bước đó.
  Khi override hook hoặc dùng API/type/helper/component có sẵn, evidence phải gồm khai báo gốc liên quan, không chỉ dòng sử dụng hoặc file cần sửa.
  Instruction nêu signature/shape hoặc điều kiện cần giữ nếu có nguy cơ nhầm; symbol mới phải được chỉ rõ là phần cần tạo, không trình bày như reuse đã tồn tại.
  `mapping` là `null` khi bước sửa không đổi mapping; nếu có, ghi `source`, `target` bằng field/type đã xác minh, `cardinality` (1:1/1:N/N:1/N:N), `identity` (FK/khóa dòng, quy tắc giữ trùng/thứ tự) và `missing` (xử lý null/thiếu theo contract nào).
  Quyết định có mapping dựa trên delta thực tế, không dựa tên file hoặc loại task.
- `preserve`: chỉ thêm khi có invariant hoặc phần phải giữ nguyên cần nêu riêng.
- `acceptance`: kết quả quan sát được cho luồng chính, nhánh biên/lỗi liên quan; mapping 1:N phải chỉ rõ các dòng và identity cần bảo toàn, không chỉ “hiển thị đúng”.
  Mỗi tiêu chí phải được đáp ứng bởi bước sửa hoặc hành vi nguồn được giữ nguyên có bằng chứng; không để acceptance đòi sửa file ngoài `allowed_paths` hoặc phụ thuộc quyết định chưa chốt.
- `permitted_checks`: chỉ các hành động user đã cho phép đích danh, mặc định không được cấp quyền và ghi `[]`.

Main phải kiểm evidence thực sự chứng minh mapping, không chỉ trỏ tới file tồn tại.
Hai dòng dùng cùng ID công đoạn chưa chắc là một dòng nghiệp vụ; không dedup hoặc đổi khóa trước khi xác minh cardinality và identity.
Thiếu quy tắc cho dữ liệu vắng thì chốt với user/source trước, không giao worker tự chọn fallback.

Không giao chỉ bằng các câu như “sửa đúng nghiệp vụ”, “tối ưu”, “refactor cho sạch” hoặc “đồng bộ caller” khi chưa chỉ rõ thay đổi tương ứng.
Main chịu trách nhiệm chốt cách làm; contract chưa sẵn sàng nếu worker còn phải chọn nguồn dữ liệu, mapping, hành vi hoặc thiết kế để hoàn thành.
Không cần viết sẵn toàn bộ code; worker chỉ tự quyết chi tiết cục bộ tương đương, không đổi hành vi.
TASK hiện hành phải tự chứa đủ ràng buộc thực thi, không bắt worker mở overview, TASK cha hay lịch sử để ghép yêu cầu.
Khi có TASK, recipe nằm ở `execution` trong `json task-contract`; prose không sở hữu thêm recipe/scope và không chép lại metadata.
Block dispatch trích `allowed_paths`, các field của `execution`, `acceptance`, `permitted_checks` đúng version; không sao chép thêm một bản hướng dẫn bằng prose.
Không copy nguyên type/proto/source khi có path/symbol; chỉ trích shape hoặc constraint cần tránh nhầm.
Không chép checklist luật chung vào mọi TASK; chỉ nêu ngoại lệ hoặc risk riêng của slice.

### Bàn giao context đủ để thực thi

Main chuyển kết quả discovery đã có thành chỉ dẫn thực thi trong contract; không chỉ giao danh sách file hoặc kết luận tổng quát rồi để worker tìm lại cách nối luồng.
Tận dụng evidence đã có trong context, không crawl lại chỉ để soạn handoff; chỉ đọc bổ sung khi còn thiếu dữ kiện ảnh hưởng correctness hoặc source đã đổi.
Main chỉ rõ vị trí cần đọc bằng đường dẫn đầy đủ tương đối từ root repo + symbol hoặc khoảng dòng, kèm mục đích đọc ngay tại bước sửa/reuse tương ứng.
Không chỉ ghi tên file ngắn rồi để worker suy thư mục; có path trong `source_paths` không thay cho chỉ dẫn tại bước sử dụng.
Bao gồm source cần sửa, định nghĩa reuse và test/pattern/caller trực tiếp cần cho việc xác nhận; không giao cả thư mục để worker tự tìm điểm bắt đầu.
Với mỗi seam reuse, Main ghi kết luận đã xác minh: symbol nhận/trả gì, đáp ứng invariant nào, gọi hoặc map tại đâu và phần giữ nguyên liên quan.
Kèm vị trí pattern trực tiếp cho nhánh lỗi, cancellation hoặc lifecycle nếu bước sửa cần chúng, không để worker tự quét module tìm convention mà Main đã đọc.
Worker vẫn đọc source để xác nhận signature và ngữ cảnh sửa, nhưng không phải chứng minh lại lựa chọn reuse hoặc đọc lại chuỗi discovery để tự rút ra cùng kết luận.
Task chạm state/effect, async resolution hoặc cache thì Main chốt thứ tự xử lý, scope, cleanup và dữ liệu cần giữ ở đúng nhánh liên quan.
Chỉ dùng bảng điều kiện/pseudocode khi prose chưa đủ xác định cách triển khai; task không chạm các luồng này không phải mô tả chúng.
Các chỉ dẫn này được soạn tại TASK canonical hoặc contract inline hiện có và giao ngay trong assignment; không tạo thêm context pack hoặc bản sao source.

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
Rework và resume theo mục **Nghiệm thu và rework** bên dưới; giao delta trực tiếp, không tạo một nguồn yêu cầu khác với TASK hiện hành.

Worker đọc các vị trí đã chỉ để xác nhận source rồi sửa theo từng bước; không viết lại plan, khảo sát module, tìm thêm pattern hoặc so sánh giải pháp khi source khớp contract.
Đọc đủ thân hàm/type và ngữ cảnh trực tiếp cần để sửa an toàn, không coi khoảng dòng là giới hạn cứng hoặc bỏ qua rule/skill bắt buộc.
Trước lần ghi đầu tiên sử dụng một seam, đối chiếu declaration/type thực tế với recipe: signature, field/prop và nullability liên quan; không coi contract hoặc gate hợp lệ là bằng chứng symbol tồn tại.
Tái dùng kết quả xác nhận khi source không đổi; đây là xác nhận cục bộ, không phải discovery lại hay quyền chạy build/typecheck.
Chỉ mở rộng đọc khi có dấu hiệu cụ thể: symbol/signature không khớp, dependency trực tiếp chưa rõ, caller bị ảnh hưởng chưa có trong contract hoặc invariant có nguy cơ bị vi phạm.
Khi đó chỉ truy đúng dependency hoặc reference liên quan; nếu phát sinh quyết định thiết kế hay scope mới thì trả Main, không biến việc xác nhận thành discovery toàn bài toán.
Không đọc lại nội dung đã có trong context khi source không đổi và không có câu hỏi mới cần giải đáp.
Sau khi sửa, worker đối chiếu delta với acceptance và bàn giao kết quả; không tự mở vòng audit toàn module hoặc cải tiến ngoài contract.

Worker tự quyết chi tiết cục bộ tương đương như tên biến, guard clause và cấu trúc biểu thức.
Không mời worker đánh giá lại giải pháp, tìm phương án tốt hơn hoặc tự chọn business default, API, transaction/retry/compensation boundary hay abstraction mới.
Thiếu symbol, source trái contract, reuse không đáp ứng invariant hoặc cần vượt scope: dừng phần liên quan, trả Main `path:line`, expected/actual và điểm cần chốt; phần độc lập vẫn làm tiếp.
Khi phát hiện trong cùng phân hệ đã có helper hoặc component chuẩn thuộc `[skill:cogain-screen-archetypes]` mà contract bỏ sót hoặc bắt import chéo nội bộ route khác (`_components`/`-components`), worker phải dừng và báo ngay cho Main kèm `path:line` trước khi tự chế hoặc sao chép code.
Đây là stop condition mặc định, không cần diễn giải lại ở nhiều section.

## Điều kiện dispatch

Tính sẵn sàng theo dependency, không phải số thứ tự TASK hay rào cản batch, quyết định thời điểm dispatch.
Main kiểm một lần trước khi giao slice:
- Prerequisite của slice đã hoàn tất và được Main nghiệm thu, đồng thời interface hoặc contract dùng chung đã ổn định.
- Khi thỏa mãn, dispatch đồng thời các slice độc lập đã sẵn sàng.
- Yêu cầu quyền sở hữu ghi tách biệt hoàn toàn và không phụ thuộc output khả biến của slice khác chưa hoàn thành.
- Khi một nhánh hoàn thành, Main nghiệm thu nhánh đó và giải phóng ngay các slice phụ thuộc vào nó mà không phải chờ các nhánh chạy song song khác chưa xong.
- Điểm sửa và cách làm có bằng chứng tại declaration liên quan, reuse đáp ứng invariant và tác động tới caller đã được rà soát.
- Contract đã chỉ rõ cần sửa gì và sửa như thế nào tại từng điểm sửa; worker không phải tự chuyển luận điểm hoặc mục tiêu chung thành thiết kế.
- Assignment đã chứa trực tiếp brief thực thi đủ dùng; bỏ các đường dẫn TASK khỏi phần hướng dẫn vẫn xác định được cần sửa gì, ở đâu, bằng seam nào và đạt khi nào, mở được đúng source/reuse/pattern từ bước sửa mà không phải tìm lại đường dẫn hoặc convention.
- Không còn quyết định mở ảnh hưởng correctness, acceptance đạt được trong scope, và một contract hiện hành đủ để làm mà không dựa vào lịch sử rework.

Đây thuần túy là điều phối thứ tự thực thi, không phải quyền merge hoặc deploy sai thứ tự, không bỏ qua quyền validation của user, và không bypass các bước kiểm canonical snapshot hay supersession.
Chưa đạt thì Main xử lý phần thiếu; checklist này không phải section phải sinh trong TASK và không cần thêm agent/status.
Quyết định đã chốt chỉ mở lại khi có source/requirement mới, failure mode có bằng chứng làm mất correctness, hoặc bằng chứng mới về rủi ro bảo trì cụ thể làm mất cơ sở quyết định (như cùng quy tắc sửa nhiều nơi, error semantics lệch, sai owner, coupling); không mở lại vì tranh luận sở thích hay cách làm khác chỉ mang tính cảm tính. Không tự ý mở rộng scope; Main quyết định điều chỉnh nguồn quyết định và contract bị ảnh hưởng trước khi giao tiếp; user đổi requirement không bị đánh đồng với lỗi plan/code.

OMP dùng `hooks/pre/dispatch-contract.ts` để chặn `task` tới ba lane viết code khi thiếu block/field, evidence không tồn tại hoặc vượt số dòng, điểm sửa ngoài scope, hoặc bản trích lệch TASK/version.
Continuation `write agent://<handle>` tới handle bất kỳ chỉ validate khi mang explicit contract (canonical hai dòng hoặc fence dispatch-contract) để mở rộng hoặc kiểm tra tính hợp lệ; tin nhắn delta/hỏi đáp tự do không bị áp semantic gate.
`task.speculativeLaunch: false` bảo đảm kiểm cả batch trước khi worker khởi chạy. Hook `hooks/pre/workflow-context.ts` ghi nhận decision events khi Main thực thi thành công tool task/write, tái dựng state từ native persisted branch và cung cấp contract hiện hành cùng các delta cho compaction (không ghi nhận failed requests làm dispatch).
Phân biệt gate structural với gate semantic: dispatch hook kiểm tra cấu trúc contract, schema, field bắt buộc và sự tồn tại/khoảng dòng của evidence (structural gate); nó không chứng minh ý nghĩa evidence, không thẩm định chiều sâu thiết kế hay phát hiện Main khai sai `mapping: null` (semantic gate). Gate và hook không cấp quyền validation; trách nhiệm discovery, rework và nghiệm thu của Main giữ nguyên.
## Nghiệm thu và rework

Main đối chiếu source tại điểm sửa, caller liên quan và acceptance hiện hành; báo cáo worker, contract hợp lệ và advisor im lặng không thay bằng chứng này.
Nghiệm thu gồm hai câu hỏi riêng:
1. Implementation có đúng contract đã giao?
2. Thiết kế sau sửa có đủ đơn giản, không còn logic dư, duplicate cùng lý do thay đổi, wrapper không cần thiết hoặc sai nơi sở hữu hành vi không (dẫn `rule://solution-complexity`, `rule://backend-pragmatic-solid`, `skill://clean-code`)?
Đúng contract chưa đủ để nghiệm thu nếu chính recipe tạo ra các vấn đề trên; recipe sai thuộc trách nhiệm của Main, xử lý như finding contract/discovery, không đẩy trách nhiệm thiết kế sang worker.
Không cần bug runtime mới được báo rủi ro bảo trì cụ thể: các vấn đề như cùng quy tắc phải sửa nhiều nơi, error semantics lệch giữa các tầng, sai owner hoặc coupling bất hợp lý là lý do hợp lệ để Main điều chỉnh recipe.
Với log hoặc scaffolding chỉ phục vụ điều tra do task thêm vào, Main xác định phần cần giữ cho vận hành và yêu cầu bỏ phần không còn cần trước bàn giao; không xóa log nghiệp vụ/vận hành chỉ để giảm dòng.
Chỉ kết luận trên phần source đã đọc đủ; output bị cắt hoặc thiếu thân hàm/caller liên quan thì phải đọc phần còn thiếu trước khi khẳng định đã bảo toàn hành vi.
LSP của revision cuối do worker bàn giao là nguồn chẩn đoán; Main không gọi lại cùng file nếu source chưa đổi và không có mâu thuẫn cụ thể.
Thiếu hoặc cũ thì trả đúng worker bổ sung, không mở một vòng audit/diagnostics khác thay worker.
Handoff đầu tiên phải nêu file đổi, LSP ở revision cuối, finding còn mở và trạng thái advisor có bằng chứng; chưa nhận được review thì ghi `not available`, không suy thành PASS.
Main chỉ yêu cầu bổ sung phần thực sự thiếu để nghiệm thu, không nhắn agent idle hỏi lại trạng thái đã bàn giao.
Sau nghiệm thu, cập nhật trạng thái tại Main và trả kết quả cho user; không gửi tin xác nhận đóng việc tới worker, không yêu cầu ACK và không lặp báo cáo cuối khi chỉ nhận lời xác nhận.
Phần đã nghiệm thu giữ nguyên trừ khi có source/requirement mới, failure mode cụ thể hoặc bằng chứng mới về rủi ro bảo trì cụ thể làm mất cơ sở quyết định; không mở lại vì tranh luận sở thích; Main quyết định điều chỉnh.
Không đóng toàn task chỉ vì milestone hoặc delta sửa lỗi đã xong; acceptance chưa đạt phải còn được giữ trong contract hiện hành hoặc ghi blocker.
Tách bạch ba mức độ bằng chứng:
- Source: đối chiếu mã nguồn tĩnh đã đọc đủ ngữ cảnh.
- LSP: chẩn đoán cú pháp, type, references từ language server; không suy ra runtime đúng từ LSP sạch.
- Runtime: chạy thực tế để kiểm chứng hành vi; chỉ thực hiện khi user cho phép đích danh.
Chưa chạy hành vi thì ghi phần chưa kiểm và `Validation: not run - not requested`, không suy runtime đúng từ source hay sự im lặng của advisor.
Không dùng LSP sạch hoặc advisor không có finding để khẳng định “giữ nguyên 100%”, “clean hết” hay tương đương nghiệp vụ đã được chứng minh.
Nếu báo số dòng giảm, phân biệt rõ: xóa logic dư (dead code/overkill), chuyển logic sang nơi sở hữu (relocation/co-location) và thay đổi formatting/style; không dùng LOC làm mục tiêu hoặc bằng chứng chất lượng/hiệu năng, không ép tách hàm tự động theo LOC.

Trước khi giao sửa tiếp, phân loại finding từ bằng chứng:
- **Implementation**: source sai so với contract hợp lệ; Main chốt điểm sửa và giữ nguyên invariant, không redesign cả luồng.
- **Contract/discovery**: recipe thiếu/sai, reuse không đáp ứng invariant hoặc acceptance không thể đạt trong scope; Main giải quyết phần thiếu trước khi giao tiếp.
- **Requirement change**: user làm rõ hoặc đổi hành vi so với baseline; cập nhật yêu cầu, không tính thành lỗi worker nếu implementation đúng contract trước đó.

Rework bằng continuation đúng agent handle/session hiện hữu; không spawn mới rồi gắn lại tên owner.
Không resume được thì ghi nhận chuyển giao sang worker mới; không gọi đó là resume hoặc suy rằng có cache hit.
Chỉ gửi delta: finding với expected/actual và evidence, điểm sửa/cách sửa, mapping thay đổi, source/version và invariant cần giữ; không gửi lại toàn bộ lịch sử hoặc chỉ nhắn “tiếp tục TASK”.
Nếu nội dung thực thi đổi, cập nhật TASK/version/lifecycle và supersede theo protocol trước khi giao lại, không sửa riêng assignment để tạo hai nguồn yêu cầu.
Khi resume hoặc source/requirement/luật liên quan đổi, đối chiếu lại phần contract bị ảnh hưởng trước dispatch; bỏ hoặc thay chỉ dẫn cũ trái quyết định mới, không ghép recipe từ nhiều version.
Không quét lại mọi plan lịch sử hoặc sửa evidence bất biến; chỉ cập nhật contract cần thực thi.
Finding lặp lại phải giữ nguyên evidence và số vòng sửa trong checkpoint hiện có; không gửi lại cùng yêu cầu mơ hồ hoặc coi đổi worker/model là đã xử lý nguyên nhân.
Giữ cổng advisor blocker và giới hạn hai vòng sửa theo `.omp/RULES.md` mục 11; không dùng phân loại finding để bỏ qua luật cứng.

## Artifact ownership

- Read-only/proposal: trả plan và citations trong chat; không persist khi chưa được phép ghi.
- Fast/standard hoặc một slice: contract gọn trong assignment; chỉ persist canonical contract/checkpoint khi handoff/resume cần, không tạo thư mục/manifest cho đủ mẫu.
- Nhiều slice, cross-domain hoặc public contract được phép persist: `.agent/planning/YYYY-MM-DD-<slug>/00-OVERVIEW.md` và canonical `TASK-<NN>-<slug>.md`; không tạo thêm PLAN/walkthrough/handoff trùng nội dung.
- Checkpoint giữ requirement, contract version, decisions, unresolved, source evidence và unverified ngay trong overview hoặc TASK hiện có; dùng artifact hiện có chỉ khi cần resume, không tạo state store hoặc template mới.
- Folder plan mới BẮT BUỘC bắt đầu bằng ngày tạo theo định dạng `YYYY-MM-DD-<slug>`, lấy ngày hiện tại của môi trường làm việc để dễ lọc và sắp xếp theo ngày.
  Giữ nguyên tiền tố ngày khi cập nhật hoặc resume; không tự đổi tên folder plan cũ.
- Tiền tố ngày chỉ áp dụng cho tên folder; giữ nguyên tên file bên trong như `00-OVERVIEW.md` và `TASK-<NN>-<slug>.md`.
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
- Metadata canonical: `task_id`, `slice_id`, `contract_version`, `lifecycle_ref`, `goal`, `mode`, `owner`, `allowed_paths`, `source_paths`, `acceptance`, `dependencies`, `permitted_checks`, `stop_conditions`; TASK giao lane viết code thêm `execution` gồm `changes` và `preserve` khi cần.
- `execution` được hash cùng metadata; giữ tương thích đọc TASK cũ, nhưng muốn dispatch mới phải bổ sung recipe và tăng version/lifecycle đúng protocol.
- Overview cùng thư mục có đúng một `json task-lifecycle` theo `$defs.lifecycle`, với `contract_versions` khớp TASK; overview không sở hữu scope/acceptance.
- `source_paths` bao phủ allowed paths và source bị ảnh hưởng, không gồm TASK/overview hoặc generated/runtime evidence được hash riêng.
- Reuse `readTaskContract(repoRoot, contractPath)`; governed manifest v2 dẫn xuất qua `deriveTaskManifest(contract)` hoặc `node .agent/scripts/task-contract.mjs manifest --contract <TASK> --output <manifest>` khi user cho phép generation, không sửa tay manifest hoặc dựng parser/schema thứ hai.
- Dispatch có TASK ghi hai dòng riêng `contract_ref: <đường dẫn TASK thực tế>` và `contract_version: <số nguyên>` trong `tasks[].task`; OMP tự trích block khi đầu vào chỉ có hai dòng này, harness khác nhận thêm block trực tiếp theo mục trên.
  Plan mới dùng `.agent/planning/YYYY-MM-DD-<slug>/TASK-<slice>.md`, plan cũ giữ đường dẫn hiện có; worker luôn nhận recipe đầy đủ, không chỉ đường dẫn.
- Packet identity chỉ giữ task/slice/ref/version, contract/lifecycle hash và repo/worktree/source identity từ `computeSourceIdentity`; brief thực thi trong assignment là bản trích của TASK, không phải nguồn scope/acceptance thứ hai.
- Nội dung thực thi đổi, kể cả prose: tăng `contract_version` và đồng bộ lifecycle; contract/lifecycle/source đổi thì supersede packet cũ và phát snapshot mới, không resume implementation closed/blocked/archived/superseded.

Chỉ khi xử lý outstanding supersession, Main đọc mục **Supersession - chỉ đọc khi contract/lifecycle/source thay đổi** tại `.agent/workflows/orchestrate.md`.
Giữ nguyên inspection/approval/publish protocol; không load hoặc chép chi tiết này vào plan mới không có supersession.

Plan không cấp quyền code, validation, generation, installer, app hoặc commit; chỉ chạy hành động khi user nêu đúng tên và đúng role được phép.
