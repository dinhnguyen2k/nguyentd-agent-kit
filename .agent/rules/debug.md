---
trigger: model_decision
description: "When the user asks to fix bugs, analyze errors, investigate issues, run tests, or troubleshoot code."
---

# DEBUG.MD - Systematic QA & Fix Protocol

> **Mục tiêu**: Điều tra, Sửa lỗi và Kiểm thử trong một luồng thống nhất.

---

## 🕵️ 1. INVESTIGATION (Sherlock Mode)

1. **Stack Trace**: Đừng đoán. Đọc log dòng đầu tiên.
2. **Reproduce**: Viết một script/test nhỏ để tái hiện lỗi.
3. **Isolate**: Tắt sác module xung quanh để khoanh vùng nghi phạm.
4. **Error Log Review (Rà soát file lỗi)**: Trước và trong khi điều tra, BẮT BUỘC đọc và rà soát file `.planning/errors/ERRORS.md` để kiểm tra lỗi hoặc pattern tương tự đã từng xảy ra chưa, đối chiếu Root Cause và Fix Applied trước đó để kế thừa hoặc tránh lặp lại lỗi.

---

## 🧪 2. TESTING STRATEGY (The Guard)

1. **TDD Lite**: Viết test case đỏ (fail) trước khi sửa code.
2. **Unit Test**: Test logic hàm lẻ.
3. **Integration**: Test luồng API -> DB.

---

## 🛠️ 3. FIXING PROTOCOL (Surgeon Mode)

1. **Root Cause**: Sửa nguyên nhân, không sửa triệu chứng.
2. **Regression Check**: Chạy lại bộ test cũ để đảm bảo không phá hỏng cái khác.
3. **Cleanup**: Xóa mọi log debug sau khi xong.
4. **Update Error Log**: Sau khi xử lý xong lỗi hoặc phát hiện lỗi có tính hệ thống/lặp lại, ghi nhận ngay vào `.planning/errors/ERRORS.md` theo format chuẩn của `.agent/rules/error-logging.md`.

---

## 📝 4. REPORTING

- Format: `[Lỗi] -> [Nguyên nhân] -> [Giải pháp] -> [Phòng ngừa]`.
