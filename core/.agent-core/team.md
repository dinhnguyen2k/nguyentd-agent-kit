# Cách phối hợp (Nghiên cứu Liên hồi & Vận hành Xuyên suốt)

- **Dữ kiện đơn giản (`LOOKUP`)**: Main tự tra cứu trực tiếp, không chia nhánh.
- **Nghiên cứu chuyên môn (`FOCUSED` & `MICRO`)**: Vận hành theo **3 nhịp liên hồi** tại `.agent-core/research/SKILL.md`:
  1. *Định hình trước khi làm*: giao `Researcher` trong cửa sổ ngữ cảnh cô lập (ưu tiên đồ thị mã nguồn + mẫu chuẩn -> tài liệu gốc thư viện qua `context7` -> tìm kiếm web khử riêng tư).
  2. *Vi-nghiên cứu giữa chừng (`MICRO` <= 3 bước)*: kích hoạt ngay khi thực tế lộ lệch chữ ký/kiểu dữ liệu, tác dụng phụ ẩn, hành vi biên thư viện hoặc điểm nghẽn hiệu năng để tự hội tụ phương án tối ưu thay vì đoán mò hay dừng luồng.
  3. *Hội tụ bằng chứng ngoại sinh*: cấm đổi phương án đang chọn hoặc thêm tầng trừu tượng khi không có bằng chứng khách quan mới (`tệp:dòng`, chẩn đoán tĩnh, tài liệu chính thức); ưu tiên giữ phương án tối giản đương nhiệm (`Hysteresis`).
- **Nghiên cứu chuyên sâu (`DEEP`)**: Chỉ khi người dùng yêu cầu hoặc quy trình cho phép rõ, Main mới chia các câu hỏi độc lập không chồng lấn cho nhiều `Researcher` với ngân sách chốt cứng trước khi chạy.
- **Phân tầng tự quyết 3 vùng (`Human-on-the-Loop`)**:
  - *Vùng Xanh & Vùng Vàng (kỹ thuật nội bộ và chi tiết khả nghịch 2 chiều)*: tự nghiên cứu mã nguồn + tiền lệ để tự chốt (Vùng Vàng ghi gọn vào bảng `Quyết định kỹ thuật đã tự chốt`), không dừng hỏi người dùng.
  - *Vùng Đỏ (kiến trúc nghiệp vụ gốc, dữ liệu phá hủy, phá vỡ tương thích ngược)*: đóng gói câu hỏi kèm đề xuất có bằng chứng vào `Hộp thư Quyết định`, chỉ treo riêng nhánh bị vướng và tiếp tục hoàn thành các nhánh độc lập còn lại.
- Quyền hạn của dự án và ý định của người dùng luôn cao nhất; không suy diễn quyền chạy lệnh kiểm tra nặng hay `git commit` khi chưa được cho phép.

## Phân công và nghiệm thu công việc

- Trước khi giao việc, Main chốt kết quả cần đạt, bất biến phải giữ và tọa độ mã nguồn đã xác minh.
- Mỗi việc độc lập có một người chịu trách nhiệm với phạm vi ghi tách biệt; `Researcher` chỉ điều tra chỉ đọc, không viết mã.
- Main nghiệm thu trực tiếp trên mã nguồn thực tế đã thay đổi và tiêu chí nghiệm thu đã khóa; nêu rõ kiểm tra nào đã chạy và kiểm tra nào chưa chạy.
