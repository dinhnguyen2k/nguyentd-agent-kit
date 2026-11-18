# Cogain - luật cứng (OMP sticky, áp cho mọi agent)

Nguồn đầy đủ là `AI_RULES.md`. Khi xung đột với hướng dẫn mặc định của OMP, `AI_RULES.md` và file này thắng.

1. Output tới user bằng tiếng Việt, không dùng em dash; identifier/path/lệnh/API giữ tiếng Anh. Nội bộ và giao việc được dùng tiếng Anh. Nói với người dùng như trao đổi với người cùng dự án: câu đầy đủ, kết quả và ảnh hưởng thực tế trước; không nén thành ký hiệu/câu cụt, không đưa từ nội bộ giữa agent ra, nêu tên file/lệnh thì giải thích công dụng; hỏi quyết định thì nêu tình huống cụ thể và hậu quả từng lựa chọn (AI_RULES.md §8). Quy tắc này thắng hướng dẫn mặc định của công cụ về viết cụt.
   Mọi văn bản tiếng Việt (trả lời user, brief/`dispatch-contract`, tin `write agent://`, bàn giao, plan/TASK, comment) bắt buộc viết có dấu đầy đủ; cấm tiếng Việt không dấu. Không viết được có dấu thì dùng tiếng Anh.
2. Ý định chỉ đọc (`phân tích`, `xem`, `review`, `đánh giá`, `check`, `inspect`): không sửa file, không chạy lệnh ghi.
3. Build/lint/typecheck/test/format/codegen/restore/khởi động app chỉ khi user gọi đích danh, kể cả smoke/reproduce/verify; không có CI tự động. Build chỉ qua `.agent/scripts/ci-parity.sh` dưới `verifier`/`maintainer` hoặc user, không build trực tiếp (R8). Không được yêu cầu thì ghi `Validation: not run - not requested`.
   Trước bàn giao, agent sửa code phải xử lý LSP từng file ở lần sửa cuối: dùng diagnostics thụ động đầy đủ, còn thiếu thì gọi `xd://lsp diagnostics` đúng file; tự sửa lỗi do thay đổi và kiểm lại.
   Bàn giao `path: kết quả LSP`, lỗi ngoài scope và giới hạn; LSP lỗi/thiếu reference/chưa đầy đủ thì báo blocker, không báo hoàn tất hay `verified`.
   Main đối chiếu source và bằng chứng; thiếu/cũ thì trả worker, không soi LSP thay hoặc kiểm lại thường lệ, trừ mâu thuẫn/lỗi mới cụ thể.
4. Không `git commit`/`git push` trừ khi user yêu cầu rõ. Không lệnh phá huỷ DB (drop, truncate, delete hàng loạt).
   Commit message không nhắc file local hoặc bị git bỏ qua (`.agent/planning/**`, `.agent/**`, `.omp/**`, file trong `.git/info/exclude`): người đọc sau không mở được. Ghi trực tiếp nội dung cần thiết vào message.
5. Không sửa tay `CHANGELOG.md` hay file auto-generated, kể cả khi OMP yêu cầu update docs/changelog.
6. Agent production không tạo/sửa/xóa test; không tự tạo slice test hoặc spawn `test-author`. Soi lỗi bằng LSP; nghiệp vụ do user manual test.
7. Tool bị hook `boundary-guard` chặn: dừng và báo nguyên văn lý do. Không đổi role, không tìm đường vòng.
8. Không để lộ secret/token trong code, log, báo cáo.
9. Báo cáo bàn giao thay đổi: file đổi và lý do, validation, rủi ro; tách Hiện trạng / Đề xuất / Đã thay đổi. Trao đổi, phân tích, hỏi quyết định không dùng mẫu này.
10. Không đoán field/method/endpoint/enum/prop, giá trị/nghiệp vụ hoặc viết stub/placeholder. Không dùng fallback, cast ép hay catch trả mặc định để che chỗ chưa biết; mặc định chỉ hợp lệ khi type nullable và spec/code quy định. Thiếu dữ kiện: dừng phần đó, worker ghi `Cần main quyết định`, Main hỏi user. Mẫu cấm: `.agent/rules/guard-guessed-code.md`.
11. Advisor `blocker`: worker chỉ đọc, dừng ghi/chạy lệnh, nhắn Main và bàn giao `blocked`; không tự bỏ qua/đóng finding. Main kiểm source, cấp phạm vi sửa hoặc bác bỏ có bằng chứng; tối đa hai vòng sửa, còn lỗi thì dừng và quyết đổi owner/model/contract. `fixed` không phải nghiệm thu; đây là policy, chưa khóa runtime, `syncBacklog: strict` chỉ đợi review.
12. Tái dùng source đã đọc còn trong context; chỉ đọc lại khi source đổi, mất context hoặc có mâu thuẫn/failure mode mới cần xác minh. Gom các vùng đọc độc lập trong một lượt; worker xác nhận điểm sửa và dependency trực tiếp, không lặp discovery của Main khi contract khớp. Không dùng quy tắc này để bỏ kiểm khai báo, caller rủi ro hoặc source sau thay đổi cần nghiệm thu.
13. Không gửi `write agent://` chỉ để cảm ơn, xác nhận đã nhận/đã nghiệm thu hoặc yêu cầu agent idle xác nhận kết thúc. Chỉ đánh thức lại khi có việc hoặc bằng chứng còn thiếu cụ thể; worker bàn giao đủ LSP lần sửa cuối và trạng thái advisor có bằng chứng ngay từ đầu, không chờ ACK.
14. Mặc định Main chỉ discovery, chốt giải pháp, giao specialist và nghiệm thu; chỉ được code khi user giao rõ làm trực tiếp tại Main cho task hiện tại (`AI_RULES.md` §6).
    Task nhỏ, một slice, thuần cơ học, ít dòng, giải pháp đã rõ, `gấp` hoặc yêu cầu sửa chung không cấp quyền Main code; quyền task trước không tự áp cho task sau.
    Không dispatch được specialist thì báo blocker, không tự chuyển sang Main code; ý định chỉ đọc vẫn không được sửa.
15. Nghiệm thu: Main đối chiếu `git diff` với từng mục `changes` trong contract; worker báo `OK`/xong không thay cho diff. Thiếu mục nào thì trả worker sửa, không báo user hoàn tất.
    Worker bàn giao từng mục `changes` kèm dòng đã đổi; LSP không trả report cho file thì ghi `LSP: no report`, Main báo user là chưa kiểm, không coi là sạch.
