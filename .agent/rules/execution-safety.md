---
trigger: glob
glob: "**/*"
description: "Quy tắc an toàn thực thi và chống mã độc: Kiểm tra dependency, cấm binary lạ, chống treo tool/loop vô hạn, và chính sách ON-DEMAND ONLY cho lệnh nặng."
---

# EXECUTION-SAFETY.MD - Quy Tắc An Toàn Thực Thi & Chống Mã Độc

> **Mục tiêu**: Ngăn chặn mã độc, bảo vệ dependencies và chống tình trạng Agent bị treo (hang), rơi vào vòng lặp vô hạn (infinite loop) khi thực thi.

---

## 🛡️ 1. Phòng Chống Mã Độc & Kiểm Soát Dependency

1. **Typosquatting Protection**: Kiểm tra kỹ tên package trước khi chạy lệnh cài đặt qua Composer hoặc npm. Khi được yêu cầu quét lỗ hổng, sử dụng `composer audit` hoặc `npm audit`.
2. **Cấm File Nhị Phân & Mã Thực Thi Lạ**: Cấm commit các file thực thi nhị phân (`.exe`, `.dll`, `.so`, `.sh`, `.bat`...) hoặc script không rõ nguồn gốc vào repository mà không có giải thích rõ ràng.
3. **URL & Script CDN Verification**: Không tự ý nhúng các liên kết CDN lạ hoặc script không đáng tin cậy vào giao diện web. Kiểm tra độ an toàn trước khi tích hợp vào mã nguồn.

---

## ⏱️ 2. Chống Treo Máy & Vòng Lặp Vô Hạn (Hang & Loop Prevention)

1. **Tool Call Repetition**: Cấm gọi cùng một Tool với cùng một tham số quá 3 lần liên tiếp nếu kết quả trả về không thay đổi. Phải thay đổi chiến thuật nếu tool thất bại.
2. **Recursive Depth Limit**: Giới hạn độ sâu khi đọc thư mục hoặc tìm kiếm file là **5 cấp**.
3. **HEAVY COMMANDS ARE ON-DEMAND ONLY**:
   - **DO NOT RUN** install, audit, build, lint, test, hoặc các lệnh tốn tài nguyên tương tự một cách tự động.
   - Người dùng phải yêu cầu rõ ràng trước khi chạy các lệnh nặng. Khi được phép, sử dụng bounded waits; không bao giờ chờ vô hạn.
4. **Step Timeout**: Mỗi bước thực thi (tool call) không kéo dài quá **60 giây**. Nếu một tiến trình con bị treo quá thời gian quy định mà không có output mới, Agent bắt buộc phải chủ động can thiệp (kill task/zombie process).
5. **Interactive UI**: Ưu tiên các cờ tự động (`--no-interaction`, `-y`). Nếu CLI yêu cầu tương tác người dùng và bị kẹt sau 2 lần thử, coi là bị treo và dừng tiến trình.
6. **IDEMPOTENT EXECUTION**: Một sự cho phép rõ ràng từ người dùng chỉ có giá trị cho một lần chạy duy nhất với phạm vi tương ứng của trạng thái mã nguồn hiện tại. Không chạy lại khi các file liên quan không thay đổi. Một lệnh thất bại không cấp quyền tự ý mở rộng phạm vi hoặc đổi sang lệnh nặng khác.

---

## 🛠️ 3. Quy Trình Phục Hồi Sự Cố (Error Recovery Protocol)

Khi phát hiện dấu hiệu bị TREO hoặc VÒNG LẶP:
1. **DỪNG**: Ngừng ngay hành động hiện tại.
2. **PHÂN TÍCH**: Kiểm tra log terminal gần nhất để tìm nguyên nhân gốc rễ.
3. **DỌN DẸP**: Xóa các file tạm, tắt các tiến trình con liên quan (zombie processes).
4. **BÁO CÁO**: Ghi nhận lỗi và báo cáo ngắn gọn, rõ ràng cho người dùng.
