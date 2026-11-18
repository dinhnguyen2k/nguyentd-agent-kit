---
trigger: glob
glob: "**/*.{cs,ts,tsx,js,jsx}"
description: "Code style for C#/TS edits: follow .editorconfig/.prettierrc, concise one-line forms, one-line doc comments."
condition: ["**/*.cs", "**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"]
interruptMode: never
---

# Code style

- Khi sửa code, đọc `.editorconfig` áp dụng cho file, kể cả override trong thư mục con; dùng đúng giá trị và severity, không tự đặt style trái cấu hình.
- Viết đúng style ngay trên phần thay đổi và rà diff trước khi bàn giao; không bắt buộc chạy formatter mỗi phiên hoặc sau mỗi lần sửa.
- Chỉ chạy formatter khi người dùng yêu cầu; giới hạn file trong phạm vi tác vụ, loại migration và generated files.
- Xử lý warning/error trên dòng đang chạm; suggestion/silent không bắt buộc dọn và không phải lý do sửa lan cả file/project.
- Ưu tiên code dễ đọc; không đổi cú pháp nếu làm mất ý nghĩa hoặc thay đổi hành vi, comparer hay collection semantics.
- Mặc định viết logic ngắn gọn, ít tầng lồng và ít dòng thừa; áp dụng cho toàn bộ phần code đang thêm/sửa, không chỉ `if/else`.
- Giữ phép gán, `return`, lời gọi hàm, ternary, lambda, LINQ/fluent chain, literal và JSX ngắn trên một dòng nếu dễ đọc và không vượt `max_line_length`/`printWidth`; không tự xuống dòng theo từng toán tử, đối số, prop hoặc bước gọi đơn giản.
- Với nhánh hoặc vòng lặp chỉ có một câu lệnh, bỏ `{}` và viết cùng dòng khi cú pháp, cấu hình và tính rõ ràng cho phép; không giữ block chỉ vì thói quen. Giữ `{}` khi có nhiều câu lệnh, cú pháp/lint bắt buộc hoặc bỏ block gây nhập nhằng như `dangling else`.
- C# ưu tiên expression body cho member một biểu thức; dùng guard clause, ternary, null-coalescing hoặc switch expression khi thể hiện trực tiếp cùng logic và giảm nhánh/lồng không cần thiết.
- Không tạo biến trung gian, helper hoặc nhánh `if/else` chỉ để chuyển tiếp hay gán một giá trị đơn giản; giữ lại khi giúp đặt tên ý nghĩa, tránh tính lặp hoặc cần cho debug/side effect. Không nén nhiều câu lệnh độc lập vào một dòng.
- Chỉ tách dòng khi vượt giới hạn cấu hình hoặc biểu thức thực sự khó đọc; không đánh đổi correctness, thứ tự thực thi, short-circuit, nullability hay khả năng hiểu logic để giảm số dòng.
- Prettier giữ nguyên object literal đã xuống dòng (có newline sau `{`) nên chạy formatter không tự rút ngắn; muốn gọn phải gom tay rồi mới format lại.
- Doc comment tối đa một dòng (`///` hoặc `/** */`) và chỉ viết khi WHY không hiển nhiên; tránh `<summary>` nhiều dòng kèm `<para>`.
- Với C# kế thừa `BaseService`, chỉ đổi sang primary constructor khi đã kiểm tra source và chứng minh constructor shape an toàn.
- `CS1998` là diagnostic cần kiểm tra logic async, không xử lý như hint thẩm mỹ.
- Trước bàn giao, bắt buộc rà phần code vừa thêm/sửa để bỏ block, nhánh, biến và xuống dòng không cần thiết theo các tiêu chí trên; LSP sạch hoặc formatter chạy thành công không thay thế việc rà này.
