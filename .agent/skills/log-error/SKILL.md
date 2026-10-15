---
name: log-error
description: "Ghi lại lỗi vào Error Log để học tập và cải thiện. Use when documenting bugs, recording troubleshooting steps, or updating ERRORS.md."
---

# /log-error - Ghi nhận lỗi theo yêu cầu

Workflow này hướng dẫn Agent cách ghi lại lỗi một cách có hệ thống.

## Quyền ghi và artifact

- `/log-error` hoặc yêu cầu rõ ràng ghi/cập nhật error log cấp quyền ghi entry theo `.agent/rules/error-logging.md`.
- Inspect/review lỗi chỉ trả lời kèm evidence và citation, không tự ghi log, backup hay report.
- `ERRORS.md` là error log nghiệp vụ độc nhất, không thay bằng PLAN, walkthrough hoặc handoff lặp lại nội dung.
- Quyền ghi log không cấp quyền sửa code, cài dependency, chạy validation hay tạo rule/test.
- Giữ entry cũ, che secret và dữ liệu nhạy cảm; không suy đoán nguyên nhân hay command evidence.

## 📋 Các bước thực hiện

1. **Phát hiện lỗi**:
   - Lỗi có thể đến từ: Test fail, Build error, Runtime exception, Logic bug
   - Đọc error message/stack trace đầy đủ

2. **Phân loại lỗi**:
   - **Type**: Xác định loại (Syntax/Logic/Integration/Runtime/Agent/Process)
   - **Severity**: 
     - `Critical`: Hệ thống không chạy được
     - `High`: Tính năng chính bị hỏng
     - `Medium`: Tính năng phụ có vấn đề
     - `Low`: Lỗi nhỏ, không ảnh hưởng nhiều

3. **Thu thập thông tin**:
   - File và dòng code gây lỗi
   - Agent nào đang làm việc
   - Thời gian xảy ra lỗi
   - Error message chi tiết

4. **Ghi vào ERRORS.md**:
   - Chỉ khi có quyền ghi, mở error log theo vị trí trong `.agent/rules/error-logging.md`
   - Append entry mới theo format chuẩn (xem `error-logging.md`)
   - Lưu file

5. **Thông báo người dùng**:
   - Báo đường dẫn entry đã ghi; chỉ nói đang sửa nếu user đã cấp quyền sửa

6. **Giải quyết lỗi**:
   - Áp dụng fix chỉ trong scope được cấp quyền
   - Chỉ chạy test hoặc validation khác khi user gọi đúng tên hành động
   - Cập nhật Status theo bằng chứng thực tế; không coi chưa kiểm chứng là đã verified
   - Không chạy validation thì ghi `Validation: not run - not requested`

7. **Học từ lỗi**:
   - Nếu lỗi lặp lại >= 2 lần: đề xuất rule, regression test hoặc checklist tại owner phù hợp
   - Chỉ ghi thay đổi khi được cấp quyền; test thuộc `test-author`

## 💡 Ví dụ

Khi gặp lỗi import:
```
Error: Cannot find module 'react-bootstrap/Alert'
```

Khi user yêu cầu ghi log, entry chưa xác định root cause có thể là:
```markdown
## [2026-02-02 11:25] - Missing Import for React Bootstrap Alert

- **Type**: Integration
- **Severity**: High
- **File**: `src/components/Dashboard.jsx:5`
- **Agent**: frontend-specialist
- **Root Cause**: Chưa xác định; cần đối chiếu import và dependency hiện có
- **Error Message**: 
  ```
  Cannot find module 'react-bootstrap/Alert'
  ```
- **Fix Applied**: Chưa áp dụng
- **Prevention**: Luôn kiểm tra `package.json` trước khi import thư viện mới
- **Status**: Investigating
```

---

**Lưu ý**: Phát hiện lỗi không tự cấp quyền ghi artifact hoặc thực thi lệnh.
