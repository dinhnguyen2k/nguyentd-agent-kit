---
trigger: model_decision
description: "When the user asks to fix bugs, analyze errors, investigate issues, run tests, or troubleshoot code."
---

# DEBUG.MD - Quy Trình Điều Tra & Sửa Lỗi Theo Bằng Chứng

## 1. Điều tra từ bằng chứng hiện có (`AI_RULES.md` §2, §9)
- Bắt đầu từ stack trace, thông báo lỗi, log hiện có, luồng code thực tế và chẩn đoán LSP thụ động.
- Bắt buộc đọc và đối chiếu `.planning/errors/ERRORS.md` ngay khi điều tra để kiểm tra lỗi hoặc mẫu lỗi tương tự đã từng xảy ra, kế thừa nguyên nhân gốc và tránh lặp lại sai lầm cũ.
- CẤM tự khởi động ứng dụng, tự viết script/test reproduce hay tự chạy lệnh build/lint/test trừ khi người dùng yêu cầu đích danh (`AI_RULES.md` §2).
- Với yêu cầu chỉ đọc (`inspect`, `analyze`, `xem`, `phân tích`), giữ nguyên mã nguồn và báo cáo nguyên nhân kèm tọa độ `path:line`.

## 2. Sửa đúng nguyên nhân gốc & Dọn dẹp
- Lần theo luồng gọi thực tế tới đúng nơi sở hữu hành vi để sửa nguyên nhân gốc, không chèn nhánh vá triệu chứng hoặc nuốt lỗi ở tầng ngoài.
- Kiểm tra các caller và nhánh biên dùng chung quy tắc bị lỗi để đảm bảo tính nhất quán.
- Xóa toàn bộ log tạm hoặc mã gỡ lỗi chỉ phục vụ điều tra trước khi bàn giao, nhưng giữ nguyên log nghiệp vụ/vận hành của hệ thống.

## 3. Regression Test & Nhật ký lỗi (`AI_RULES.md` §6, §9)
- Agent triển khai không tự viết hoặc sửa cây test; khi cần khóa hành vi bằng regression test, báo rõ nhu cầu trong báo cáo bàn giao để Main điều phối `test-author` khi được người dùng mở quyền.
- Nếu phát hiện test hiện hữu mâu thuẫn với đặc tả nghiệp vụ, dừng phần liên quan và báo `test-spec-conflict` để người dùng quyết định.
- Khi xử lý xong lỗi có tính hệ thống hoặc lặp lại, cập nhật `.planning/errors/ERRORS.md` theo định dạng chuẩn tại `.agent/rules/error-logging.md`.
