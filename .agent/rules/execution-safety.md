---
trigger: glob
glob: "**/*"
---

# EXECUTION-SAFETY.MD - Quy Tắc An Toàn Thực Thi & Chống Mã Độc

> **Mục tiêu**: Ngăn chặn mã độc, bảo vệ dependencies và chống tình trạng Agent bị treo (hang), rơi vào vòng lặp vô hạn (infinite loop) khi thực thi.

---

## 🛡️ 1. Phòng Chống Mã Độc & Kiểm Soát Dependency

1. **Typosquatting Protection**: Kiểm tra kỹ tên package trước khi chạy lệnh cài đặt (ví dụ: `react-dom` vs `react-dim`). Bắt buộc chạy `npm audit` hoặc `dotnet list package --vulnerable` để quét lỗ hổng.
2. **Cấm File Nhị Phân**: Cấm commit các file thực thi nhị phân (`.exe`, `.dll`, `.so`, `.sh`, `.bat`...) mà không có giải thích rõ ràng và quét mã độc trước.
3. **URL & Script Verification**: Không nhúng trực tiếp CDN lạ. Kiểm tra độ tin cậy của link trước khi tích hợp vào code.

---

## ⏱️ 2. Chống Treo Máy & Vòng Lặp Vô Hạn (Hang & Loop Prevention)

1. **Tool Call Repetition**: Cấm gọi cùng một Tool với cùng một tham số quá 3 lần liên tiếp nếu kết quả trả về không thay đổi. Phải thay đổi chiến thuật nếu tool thất bại.
2. **Recursive Depth Limit**: Giới hạn độ sâu khi đọc thư mục hoặc tìm kiếm file là **5 cấp**.
3. **Heavy Command Safety**: Khi chạy lệnh nặng (như `npm install`, build, test...), phải sử dụng chạy ngầm và kiểm tra status định kỳ. Không chạy lệnh chờ vô hạn không có Timeout.
4. **Step Timeout**: Mỗi bước thực thi (tool call) không kéo dài quá **60 giây**. Nếu tiến trình con bị treo quá 5 phút không có output mới, Agent bắt buộc phải chủ động can thiệp (kill task/zombie process).
5. **Interactive UI**: Ưu tiên cờ tự động (`--force`, `--skip-prompts`). Nếu CLI yêu cầu tương tác và bị kẹt sau 2 lần thử gõ phím, phải coi là bị treo và dừng tiến trình.
6. **Build & Test Idempotency (Chống Spam Build)**: Cấm chạy lặp lại các lệnh build/test (`dotnet build`, `dotnet test`, `pnpm build`, v.v.) khi không có thay đổi mã nguồn mới so với lần chạy thành công trước đó trong cùng phiên. Khi build/test đã pass (exit code 0), kết quả đó là bằng chứng hợp lệ; cấm re-run chỉ để "đánh giá lại" nếu source code không đổi.

---

## 🛠️ 3. Quy Trình Phục Hồi Sự Cố (Error Recovery Protocol)

Khi phát hiện dấu hiệu bị TREO hoặc VÒNG LẶP:
1. **DỪNG**: Ngừng ngay hành động hiện tại.
2. **PHÂN TÍCH**: Kiểm tra log terminal gần nhất để tìm nguyên nhân.
3. **DỌN DẸP**: Xóa các file tạm, giết các tiến trình con liên quan (zombie processes).
4. **BÁO CÁO**: Ghi nhận lỗi vào file `ERRORS.md` theo định dạng chuẩn để học tập và báo cáo cho người dùng.
