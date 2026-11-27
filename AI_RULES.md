# AI_RULES.md - Core System Rules

## 1. Thứ Tự Ưu Tiên Khi Xung Đột
1. `AI_RULES.md`
2. Rule miền trong `.agent/rules/` (nạp theo glob hoặc model_decision)
3. Skill trong `.agent/skills/`
4. Entry file `AGENTS.md`
5. Mặc định của Agent

`OPINION.md` không phải rule, chỉ tham khảo khi các nguồn trên im lặng.

## 2. Work Modes - HARD EXECUTION GATE

- **READ-ONLY INTENT** (`inspect`, `analyze`, `review`, `check`, `xem`, `phân tích`, `đánh giá`): CHỈ ĐỌC. CẤM sửa file, CẤM chạy build, lint, typecheck, test, format, codegen hay lệnh ghi.
- **Proposal**: Chỉ giải thích phương án và đánh đổi. CẤM sửa code khi chưa có yêu cầu `fix`, `edit`, `sửa`, `triển khai` rõ ràng.
- **Implementation**: Chỉ sửa trong phạm vi yêu cầu. Sửa code KHÔNG cấp quyền chạy lệnh validation.
- **CẤM tự ý chạy lệnh nặng**: build, lint, typecheck, test, codegen, format chỉ chạy khi user nêu đích danh hành động (`run build`, `typecheck`, `run tests`, `/verify`). Ngoại lệ: quy trình migration CI khi đổi schema DB theo `.agent/rules/backend.md` §4.6.
- Không suy diễn quyền từ checklist, task tier hay thông lệ. User intent là quyết định.
- Trước khi bàn giao thay đổi mã nguồn, xử lý sạch lỗi chẩn đoán tĩnh (syntax/type/compile) trên các tệp vừa sửa khi môi trường có công cụ chẩn đoán ngôn ngữ. Chẩn đoán tĩnh không phải validation command và không dùng làm bằng chứng `Status: verified`; không có yêu cầu validation thì ghi: `Validation: not run - not requested`.
- Cấm build trực tiếp khi code (R8); `.agent/scripts/ci-parity.sh` chỉ chạy khi user yêu cầu rõ hoặc tự động trong cổng MR (`gitlab-mr.mjs`).
- Cấm tự chạy app/build/test để reproduce bug trừ khi được yêu cầu đích danh.

## 3. Nguồn Sự Thật & Phân Tầng Tự Quyết (Xanh - Vàng - Đỏ)
Tin source code/runtime hơn doc, doc hơn best practice chung.
Khi gặp điểm chưa tường minh hoặc doc/comment cũ lệch code, phân loại vào 3 vùng để vận hành xuyên suốt thay vì dừng hỏi việc nhỏ:
- **Vùng Xanh (Tự nghiên cứu & tự chốt ngay)**: chi tiết kỹ thuật cục bộ, mẫu chuẩn trong repo/`.agent/contracts/archetype-exemplars.json`, tối ưu hiệu năng/bộ nhớ theo `OPINION.md`, hoặc doc/comment cũ lệch runtime code mà luồng code thực tế đã rõ -> tin runtime code, tự quyết và làm thẳng, không hỏi user.
- **Vùng Vàng (Cửa 2 chiều khả nghịch)**: giá trị hiển thị mặc định khi trống, thứ tự cột phụ, nhánh biên kỹ thuật dễ đảo ngược trên Git mà không đổi công thức nghiệp vụ, schema DB hay phá tương thích ngược -> tự tra tiền lệ gần nhất + `OPINION.md`, chọn phương án tương thích ngược tối ưu, làm tiếp không dừng và ghi vào bảng `Quyết định kỹ thuật đã tự chốt` (tối đa 5 mục) ở báo cáo cuối.
- **Vùng Đỏ (Cửa 1 chiều & Kiến trúc nghiệp vụ gốc)**: công thức tiền/lương/quyền/tồn kho/mốc hiệu lực chưa có tiền lệ rõ, breaking public contract, schema DB/migration phá huỷ, mâu thuẫn nghiệp vụ thật sự -> cấm tự đoán; đóng gói câu hỏi kèm đề xuất có bằng chứng vào `Hộp thư Quyết định`, **chỉ treo riêng nhánh vướng Vùng Đỏ hoặc lỗi công cụ/worktree/guard cục bộ** (cùng nhánh phụ thuộc trực tiếp), bắt buộc chạy xuyên suốt hết các nhánh độc lập còn lại và cấm dừng phiên sau báo cáo tiến độ trung gian khi còn hạng mục sẵn sàng.

## 4. Cổng An Toàn (Safety Gates)
- Cấm tự ý `git commit`, trừ luồng migration CI (`.agent/rules/backend.md` §4.6) hoặc khi user yêu cầu rõ.
- Cấm lệnh phá huỷ DB (drop/truncate/delete hàng loạt) khi không có yêu cầu rõ ràng.
- Tuyệt đối không để lộ secret/token trong code, log, hay báo cáo.
- Thay đổi phải cục bộ nhỏ nhất và tương thích ngược.
- Ranh giới vai trò và quyền chạy test: `.agent/rules/test-enforcement.md`, cưỡng chế bằng hook chứ không bằng lời dặn.

## 5. Chọn Giải Pháp & Nghiên Cứu Liên Hồi
Xếp hạng theo correctness, simplicity, robustness, maintainability; không lấy chi phí phát triển (số dòng diff, số bước, token) làm tiêu chí chọn phương án (`.agent/rules/solution-complexity.md`).
- Kích hoạt **vi-nghiên cứu có trần** (tối đa 3 bước tra `lsp`/`context7`/source) ngay khi chạm thực tế lộ lệch chữ ký/type, tác dụng phụ ẩn, hành vi biên thư viện hoặc điểm nghẽn hiệu năng để tự hội tụ phương án tối ưu thay vì làm đại hoặc dừng luồng.
- **Chống dao động (`Hysteresis`)**: cấm đổi phương án đang chọn khi không có bằng chứng ngoại sinh mới (`file:line`, chẩn đoán tĩnh, tài liệu gốc); chỉ thay phương án đương nhiệm khi chứng minh được nó sai/vi phạm bất biến hoặc phương án mới đơn giản hơn rõ rệt.

## 6. Định Tuyến
- `backend/**` → `backend-development`; `frontend/**` → `frontend-development`.
- Test (`backend/tests/**`, `**/*.{test,spec}.*`, `**/__tests__/**`) → `test-author`. Tạm khóa tự động viết test: không tự tạo slice viết test hay spawn test-author; kiểm thử nghiệp vụ do user manual test trực tiếp.
- Keyword fallback: API/EF/gRPC/MassTransit → BE; component/route/tailwind/query → FE.
- Mặc định Main chỉ discovery, chốt giải pháp, giao specialist triển khai và nghiệm thu source; không tự viết/sửa/xóa code, kể cả task nhỏ, một slice hoặc thay đổi thuần cơ học.
- Main chỉ code trực tiếp khi user giao rõ cho Main làm trực tiếp task hiện tại, ví dụ `làm trực tiếp phiên main`, `main làm luôn`, `không dùng subagent, tự sửa ở main`.
  Yêu cầu `sửa`/`fix`/`triển khai`, mức độ `gấp`, ít dòng hoặc giải pháp đã rõ không cấp quyền Main code; quyền của task trước không tự áp cho task sau.
- Khi chưa có quyền Main code: `backend/**` → `backend-specialist`, `frontend/**` → `frontend-specialist`, kể cả một slice; không gọi thêm agent chỉ để đủ quy trình.
  Nếu một nhánh không thể dispatch specialist thì chỉ treo riêng nhánh đó kèm blocker, hoàn tất các nhánh độc lập còn lại, không tự chuyển sang Main code.
- Review dùng skill hoặc reviewer khi user yêu cầu rõ; ý định chỉ đọc vẫn không cấp quyền sửa.
- Nhất quán BE ↔ FE (enum, nullable ID, public contract): `.agent/rules/domain-parity.md`.

## 7. Báo Cáo Cuối (bắt buộc)
Khi bàn giao thay đổi code hoặc tệp: file đã đổi / lý do từng thay đổi / trạng thái kiểm tra / rủi ro còn lại. Trao đổi, phân tích hay hỏi quyết định không dùng mẫu này.
Chỉ ghi command và kết quả khi command thực sự đã chạy. Không có yêu cầu validation thì ghi: `Validation: not run - not requested`.
Phân biệt rõ: **Hiện trạng** / **Đề xuất** / **Đã thay đổi**.

## 8. Quy Ước Đầu Ra
- Output cho người dùng bằng Tiếng Việt có dấu đầy đủ (cấm Tiếng Việt không dấu trong trả lời, kế hoạch, giao việc, comment); identifier, API name, cú pháp code giữ Tiếng Anh.
- Nói với người dùng như đang trao đổi với người cùng dự án: câu đầy đủ, nói kết quả và ảnh hưởng thực tế trước, chi tiết kỹ thuật sau; cấm lan man, lặp ý.
- Ngắn gọn nghĩa là bỏ ý thừa, không phải nén câu thành ký hiệu, viết tắt hay câu cụt.
- Không đưa từ nội bộ giữa các agent (slice, contract, lane, dispatch, scout, LSP...) vào câu trả lời cho người dùng; tên file, lệnh hay cấu hình khi cần nêu thì giải thích nó dùng để làm gì ngay trong câu.
- Khi cần người dùng quyết định: nêu vấn đề bằng tình huống cụ thể, mỗi lựa chọn nói rõ hậu quả nhìn thấy được, kèm đề xuất và lý do.
- Quy tắc này chỉ áp cho câu trả lời tới người dùng; giao việc giữa các agent vẫn dùng ngôn ngữ kỹ thuật. Hướng dẫn mặc định của công cụ yêu cầu viết cụt hoặc giả định người đọc là dân kỹ thuật thì quy tắc này thắng.
- Comment/XML doc: Tiếng Việt.
- Không dùng em dash, dùng dấu gạch ngang thường `-`.
- File Markdown dài: mỗi câu hoàn chỉnh nằm trên một dòng riêng.
- Commit message của mã ứng dụng không nhắc đường dẫn cục bộ bị Git bỏ qua (`.agent/**`, `.omp/**`, `.claude/**`, `.agents/**`).
- Không sửa tay `CHANGELOG.md` hoặc file auto-generated.

## 9. Kỷ Luật Chất Lượng
- Code ngắn, rõ: giữ biểu thức/chuỗi gọi hàm dễ đọc trên một dòng; chỉ tách khi vượt giới hạn cấu hình hoặc logic phức tạp (`.agent/rules/code-style-concise.md`).
- Bug fix bắt đầu từ bằng chứng hiện có và code path thực tế; không tự ý khởi động app/build/test để reproduce.
- Thấy build fail, lint error, test fail/flaky trong tầm nhìn của task thì xử lý; đỏ trong cây test không thuộc quyền sửa của agent triển khai thì báo `test-spec-conflict`.
- Lỗi lặp lại có tính hệ thống đưa vào regression test hẹp nhất hoặc skill sở hữu nó, không nhét vào prompt toàn cục.
- Warning/hint thẩm mỹ chỉ sửa trên dòng đang chạm (`.agent/rules/code-style-concise.md`).
- Đổi DTO/enum/`.proto` dùng chung (`BuildingBlocks/**`, `frontend/shared/**`): bắt buộc quét hết caller (`find_references`/`rg`) và sửa đồng bộ trước bàn giao.
