---
name: debug
description: Điều tra và xử lý lỗi ứng dụng PHP theo quy trình chuyên nghiệp
---

# /debug - Action-Oriented Debugging Workflow

$ARGUMENTS

---

## 🟢 PHASE 1: Forensic Discovery & RCA (Khám nghiệm Hiện trường)
**Kỹ năng**: `debugging-master`, `php-development`
**Nhiệm vụ**: Xác định chính xác vị trí lỗi và hình thành giả thuyết nguyên nhân gốc.
- **Hành động**: Đọc PHP Error Log, PDO Exception message, hoặc Browser Console logs. Xác định rõ `file:dòng`.
- **Hành động**: Dùng phương pháp "5 Whys" để tìm nguyên nhân gốc rễ (ví dụ: sai tên cột CSDL, thiếu session_start, biến rỗng, thiếu autoload Composer).
- **Tham khảo**: Kiểm tra `ERRORS.md` xem đây có phải lỗi tái phát không.

## 🟡 PHASE 2: Strategic Instrumentation (Nếu cần thiết)
**Kỹ năng**: `debugging-master`
**Nhiệm vụ**: Thu thập thêm dữ liệu nếu chưa rõ nguyên nhân gốc.
- **Hành động**: Đặt log nội bộ có chủ đích (`error_log()` trong PHP) để kiểm tra giá trị biến trước điểm lỗi.
- **Lưu ý**: Tuyệt đối không log mật khẩu CSDL hoặc thông tin đăng nhập nhạy cảm. Xóa bỏ log debug sau khi hoàn tất.

## 🟠 PHASE 2.5: Fix Proposal & Risk Critique
**Execution role**: `backend-specialist` hoặc `frontend-specialist`
**Nhiệm vụ**: Đánh giá bản sửa trước khi sửa code.
- Đề xuất giải pháp sửa tận gốc với mức thay đổi tối thiểu.
- Đánh giá rủi ro hồi quy (regression), các trường hợp biên (edge cases), và tính tương thích với cấu trúc procedural hiện tại.

## 🔵 PHASE 3: Surgical Repair
**Execution role**: `backend-specialist` (lỗi logic PHP/PDO/MySQL) hoặc `frontend-specialist` (lỗi CSS/JS/Layout)
**Nhiệm vụ**: Áp dụng bản sửa chữa đúng trọng tâm.
- Sửa đúng nguyên nhân, không dùng giải pháp tạm thời (như dùng toán tử dập lỗi `@` để che giấu PHP notice).

## 🔴 PHASE 4: Verification & Post-Mortem
**Execution role**: `test-author` & `verifier`
**Nhiệm vụ**: Xác minh lỗi đã được xử lý triệt để.
- **Kiểm tra**: Chạy kiểm tra cú pháp `php -l <file>` hoặc kịch bản kiểm tra tương ứng khi có yêu cầu.
- **Ghi nhận**: Ghi lại sự cố mới vào `ERRORS.md` nếu là lỗi nghiêm trọng hoặc có tính học hỏi cao.

---

## Output Format:

```markdown
## 🐞 Debug Report: [Tên Lỗi / Sự cố]

### Root Cause
[Một câu giải thích rõ nguyên nhân gốc]

### The Fix
[Mô tả thay đổi hoặc code diff]

### Verification
- [ ] Lỗi không còn tái phát
- [ ] Không phát sinh lỗi hồi quy
- [ ] Cập nhật ERRORS.md (nếu là lỗi mới quan trọng)
```

---

## Nguyên tắc Cốt lõi:
- **Dựa trên Bằng chứng**: Không đoán mò, dựa vào thông báo lỗi và log thực tế.
- **Fix Đúng > Fix Nhanh**: Sửa đúng bản chất, không che giấu triệu chứng.
- **An toàn Dữ liệu**: Thao tác sửa chữa không làm hỏng dữ liệu MySQL hiện có.
