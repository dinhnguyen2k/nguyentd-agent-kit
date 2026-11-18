# Nghiên cứu FOCUSED

Dùng `FOCUSED` cho một quyết định có thể được hỗ trợ bằng tối đa 3 câu hỏi ảnh hưởng đến lựa chọn. Đây là cấp độ mặc định. Một Researcher phụ trách toàn bộ việc tìm hiểu. Researcher có thể chia câu hỏi trong phạm vi được giao, nhưng không giao cho agent khác và không tự chuyển sang `DEEP`.

## Chốt câu hỏi

Main nêu quyết định cần hỗ trợ, dữ kiện đã biết, ràng buộc, nội dung cần loại trừ, độ mới cần thiết và dạng kết quả mong muốn. Chia quyết định thành 1–3 câu hỏi logic khi chúng giúp tìm bằng chứng rõ hơn. Tùy quyết định, các câu hỏi có thể xem xét trạng thái hiện tại, lựa chọn hoặc bằng chứng trái chiều; đây chỉ là ví dụ, không phải nhóm bắt buộc hay các bước cố định.

Với mỗi câu hỏi, ghi ngắn gọn:

- Câu hỏi cụ thể cần trả lời.
- Bằng chứng cần tìm để trả lời.
- Điều kiện quan sát được để xem câu hỏi đã đủ căn cứ.

Đừng gửi cả hội thoại hay toàn bộ kho mã; chỉ đưa tham chiếu ngắn trước. Đừng tìm lại phần đã được kiểm tra.

## Quy tắc về nguồn

- Một Researcher sở hữu việc tìm hiểu từ đầu đến cuối. Các câu hỏi là những lăng kính logic cho cùng một quyết định, không phải các nhóm nghiên cứu độc lập.
- Có thể dùng chung nguồn giữa các câu hỏi. Tổng cộng mở tối đa 6 nguồn liên quan cho quyết định này, tính gộp tất cả câu hỏi và các lượt tìm hiểu tiếp theo; không đặt lại ngân sách khi đổi câu hỏi hay lượt.
- Ưu tiên tài liệu chính thức, đặc tả, mã nguồn upstream, API của bên cung cấp, cảnh báo và báo cáo hậu kiểm trực tiếp.
- Với đánh đổi vận hành quan trọng, thêm nguồn từ người thực hành hoặc phản ví dụ nếu điều đó có thể làm thay đổi khuyến nghị.
- Tìm theo nhóm nhỏ. Tiêu đề, đoạn trích và mức phổ biến chỉ giúp chọn nguồn để xem, không thay thế bằng chứng.
- Mở đúng phần cần thiết, loại URL trùng và không mở lại nguồn trừ khi cần kiểm tra phần khác.

## Ghi chú và điểm dừng

Ghi ngắn gọn nhận định, phát hiện, nguồn trực tiếp, loại bằng chứng (`fact`, `reported-experience`, `inference`, `open-question`), mức độ chắc chắn và giới hạn.

Dừng khi có đủ bằng chứng để Main quyết định hoặc khi hết ngân sách. Nếu bằng chứng mâu thuẫn, không có sẵn hoặc chưa đủ, nêu rõ điều đó và giới hạn; không tự mở rộng phạm vi, giao thêm người hay bịa tiến độ. Bàn giao gồm khuyến nghị, bằng chứng trái chiều hoặc giới hạn, điểm chưa giải quyết và điều kiện khiến quyết định cần được xem xét lại. Main quyết định; Researcher chỉ trả kết quả trong chat, không tự lưu hay tạo artifact.
