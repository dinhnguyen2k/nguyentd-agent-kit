# AI_RULES.md - Core System Rules

## 1. Thứ Tự Ưu Tiên Khi Xung Đột
1. `AI_RULES.md`
2. Rule miền trong `.agent/rules/` (nạp theo glob hoặc model_decision)
3. Skill trong `.agent/skills/`
4. Entry file `AGENTS.md`
5. Mặc định của Agent

`OPINION.md` không phải rule nên không có hạng trong danh sách trên.
Chỉ đọc khi các nguồn trên im lặng hoặc để hai lựa chọn đều hợp lệ; luật đã nói rõ thì theo luật.

## 2. Work Modes - HARD EXECUTION GATE

- **READ-ONLY INTENT:** `inspect`, `analyze`, `review`, `check`, `xem`, `phân tích`,
  `đánh giá`, or equivalent wording means **INSPECT ONLY. DO NOT EDIT. DO NOT RUN
  BUILD, LINT, TYPECHECK, TEST, FORMAT, CODEGEN, OR ANY MUTATING COMMAND.**
- **Proposal:** explain options and trade-offs only. **DO NOT EDIT** unless the user
  explicitly asks to `fix`, `edit`, `change`, `implement`, `sửa`, `chỉnh`, or equivalent.
- **Implementation:** edit only the requested scope. Edit permission does not grant
  validation permission. Follow the active domain validation rule.
- A generic request such as `check this`, `finish it`, `make it done`, or `xem giúp`
  is not permission to run validation commands.
- Validation permission must name the intended action, for example `run build`,
  `typecheck`, `lint`, `run tests`, `/test`, or `/verify`.
- **DO NOT infer permission from handoff requirements, skill checklists, task tier,
  changed file types, or common engineering practice. User intent wins.**

## 3. Nguồn Sự Thật
Biết hệ thống đang chạy gì thì tin source code/runtime hơn doc, doc hơn best practice chung. Đó là thứ tự về sự thật, không phải đúng sai — code chạy đúng như đã viết không có nghĩa code viết đúng.
Doc mâu thuẫn với code: **báo cáo mâu thuẫn**, không tự chọn bên thắng. Nghi ngờ trước, đối chiếu spec/business rule rồi mới kết luận ai sai.

## 4. Cổng An Toàn (Safety Gates)
- Cấm tự ý chạy `git commit`. Chỉ chạy khi user yêu cầu rõ ràng.
- Cấm lệnh phá huỷ DB (drop/truncate/delete hàng loạt) khi không có yêu cầu rõ ràng.
- Tuyệt đối không để lộ secret/token trong code, log, hay báo cáo.
- Thay đổi phải cục bộ nhỏ nhất và tương thích ngược.
- Ranh giới vai trò và quyền chạy test: `.agent/rules/test-enforcement.md`, cưỡng chế bằng hook chứ không bằng lời dặn.

## 5. Chọn Giải Pháp
Xếp hạng theo correctness, simplicity, robustness, maintainability.
**Không lấy chi phí phát triển làm tiêu chí chọn phương án**: không tối ưu cho số dòng diff, số bước làm, hay ngân sách token.
Phương án đúng mà tốn công hơn thì vẫn chọn, nói rõ đánh đổi thay vì âm thầm hạ chuẩn. Chi tiết: `.agent/rules/solution-complexity.md`.

## 6. Định Tuyến
- `backend/**` → `backend-development`; `frontend/**` → `frontend-development`
- Test (`backend/tests/**`, `**/*.{test,spec}.*`, `**/__tests__/**`) → `test-author`
- Keyword fallback: API/EF/gRPC/MassTransit → BE; component/route/tailwind/query → FE
- Spawn subagent chỉ khi task quá lớn, song song được, hoặc user yêu cầu rõ. Routing sang agent và write boundary: `AGENTS.md`.
- Nhất quán BE ↔ FE (enum, nullable ID, public contract): `.agent/rules/domain-parity.md`.

## 7. Báo Cáo Cuối (bắt buộc)
Changed files / lý do từng thay đổi / validation status / rủi ro còn lại.
Chỉ ghi command và kết quả khi command thực sự đã chạy.
Nếu user không yêu cầu validation, ghi đúng `Validation: not run - not requested`.
Phản hồi phân biệt rõ: **Current behavior** / **Proposal** / **Changed**.

## 8. Quy Ước Đầu Ra
- Output cho người dùng bằng Tiếng Việt là được, còn lại đều cho phép dùng Tiếng Anh.
- Comment/XML doc: Tiếng Việt. Identifier, API name, cú pháp code: Tiếng Anh.
- Không dùng em dash. Dùng dấu gạch ngang thường `-`.
- File Markdown dài: mỗi câu hoàn chỉnh nằm trên một dòng riêng.
- Không sửa tay `CHANGELOG.md` hoặc bất kỳ file nào được đánh dấu auto-generated.

## 9. Kỷ Luật Chất Lượng
- Bug fix bắt đầu từ bằng chứng E2E hiện có hoặc inspection đường đi thật của người dùng.
  **DO NOT start an app, build, lint, typecheck, or test to reproduce a bug unless the user explicitly requests that execution.**
  Nếu chưa tái hiện được trong quyền đã cấp, báo rõ phần chưa được xác thực thay vì tự mở rộng quyền.
- Thấy build fail, lint error, test fail, test flaky **trong tầm nhìn của task** thì xử lý, không bỏ qua vì "không phải lỗi của mình".
  Đây không phải giấy phép đi chạy test suite để tìm màu đỏ, và đỏ trong cây test không thuộc quyền sửa của agent triển khai: báo `test-spec-conflict` rồi dừng.
- Test bắt buộc cho invariant về tiền, quyền, tồn kho và hồ sơ pháp lý: `.agent/rules/test-enforcement.md`.
- Lỗi lặp lại có tính hệ thống thì đưa vào regression test hẹp nhất hoặc skill sở hữu nó, không nhét vào prompt toàn cục.
- Warning hay hint thẩm mỹ chỉ sửa trên dòng đang chạm (`.agent/rules/code-style-concise.md`).
