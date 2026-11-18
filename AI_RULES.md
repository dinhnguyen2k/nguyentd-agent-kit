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
- **CẤM tự ý chạy lệnh nặng**: build, lint, typecheck, test, codegen, format chỉ chạy khi user nêu đích danh hành động (`run build`, `typecheck`, `run tests`, `/verify`).
- Không suy diễn quyền từ checklist, task tier hay thông lệ. User intent là quyết định.
- Chẩn đoán thụ động từ LSP không phải validation command và không dùng làm bằng chứng `Status: verified`. Không có yêu cầu validation thì ghi: `Validation: not run - not requested`.
- Cấm build trực tiếp (bị chặn bởi guard R8); `.agent/scripts/ci-parity.sh` chỉ chạy khi user yêu cầu rõ ràng.
- Cấm tự chạy app/build/test để reproduce bug trừ khi được yêu cầu đích danh.

## 3. Nguồn Sự Thật
Tin source code/runtime hơn doc, doc hơn best practice chung.
Doc mâu thuẫn với code: **báo cáo mâu thuẫn**, không tự ý chọn bên thắng.

## 4. Cổng An Toàn (Safety Gates)
- Cấm tự ý chạy `git commit`. Chỉ chạy khi user yêu cầu rõ ràng.
- Cấm lệnh phá huỷ DB (drop/truncate/delete hàng loạt) khi không có yêu cầu rõ ràng.
- Tuyệt đối không để lộ secret/token trong code, log, hay báo cáo.
- Thay đổi phải cục bộ nhỏ nhất và tương thích ngược.
- Ranh giới vai trò và quyền chạy test: `.agent/rules/test-enforcement.md`, cưỡng chế bằng hook chứ không bằng lời dặn.

## 5. Chọn Giải Pháp
Xếp hạng theo correctness, simplicity, robustness, maintainability.
Không lấy chi phí phát triển (số dòng diff, số bước, token) làm tiêu chí chọn phương án. Chi tiết: `.agent/rules/solution-complexity.md`.

## 6. Định Tuyến
- `backend/**` → `backend-development`; `frontend/**` → `frontend-development`.
- Test (`backend/tests/**`, `**/*.{test,spec}.*`, `**/__tests__/**`) → `test-author`. Tạm khóa tự động viết test: không tự tạo slice viết test hay spawn test-author; kiểm thử nghiệp vụ do user manual test trực tiếp.
- Keyword fallback: API/EF/gRPC/MassTransit → BE; component/route/tailwind/query → FE.
- Mặc định Main chỉ discovery, chốt giải pháp, giao specialist triển khai và nghiệm thu source; không tự viết/sửa/xóa code, kể cả task nhỏ, một slice hoặc thay đổi thuần cơ học.
- Main chỉ code trực tiếp khi user giao rõ cho Main làm trực tiếp task hiện tại, ví dụ `làm trực tiếp phiên main`, `main làm luôn`, `không dùng subagent, tự sửa ở main`.
  Yêu cầu `sửa`/`fix`/`triển khai`, mức độ `gấp`, ít dòng hoặc giải pháp đã rõ không cấp quyền Main code; quyền của task trước không tự áp cho task sau.
- Khi chưa có quyền Main code: `backend/**` → `backend-specialist`, `frontend/**` → `frontend-specialist`, kể cả một slice; không gọi thêm agent chỉ để đủ quy trình.
  Nếu không thể dispatch specialist thì báo blocker, không tự chuyển sang Main code.
- Review dùng skill hoặc reviewer khi user yêu cầu rõ; ý định chỉ đọc vẫn không cấp quyền sửa.
- Nhất quán BE ↔ FE (enum, nullable ID, public contract): `.agent/rules/domain-parity.md`.

## 7. Báo Cáo Cuối (bắt buộc)
Changed files / lý do từng thay đổi / validation status / rủi ro còn lại.
Chỉ ghi command và kết quả khi command thực sự đã chạy. Không có yêu cầu validation thì ghi: `Validation: not run - not requested`.
Phân biệt rõ: **Current behavior** / **Proposal** / **Changed**.

## 8. Quy Ước Đầu Ra
- Output cho người dùng bằng Tiếng Việt; identifier, API name, cú pháp code giữ Tiếng Anh.
- Mọi phiên, ngoài artifact: trình bày ngắn gọn, dễ hiểu, đi thẳng vào ý chính; cấm lan man, lặp ý hoặc diễn đạt khó hiểu.
- Comment/XML doc: Tiếng Việt.
- Không dùng em dash, dùng dấu gạch ngang thường `-`.
- File Markdown dài: mỗi câu hoàn chỉnh nằm trên một dòng riêng.
- Không sửa tay `CHANGELOG.md` hoặc file auto-generated.

## 9. Kỷ Luật Chất Lượng
- Code ngắn, rõ: giữ biểu thức/chuỗi gọi hàm dễ đọc trên một dòng; chỉ tách khi vượt giới hạn cấu hình hoặc logic phức tạp (`.agent/rules/code-style-concise.md`).
- Bug fix bắt đầu từ bằng chứng hiện có và code path thực tế; không tự ý khởi động app/build/test để reproduce.
- Thấy build fail, lint error, test fail/flaky trong tầm nhìn của task thì xử lý; đỏ trong cây test không thuộc quyền sửa của agent triển khai thì báo `test-spec-conflict`.
- Lỗi lặp lại có tính hệ thống đưa vào regression test hẹp nhất hoặc skill sở hữu nó, không nhét vào prompt toàn cục.
- Warning/hint thẩm mỹ chỉ sửa trên dòng đang chạm (`.agent/rules/code-style-concise.md`).
