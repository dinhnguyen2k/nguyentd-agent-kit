# Cách phối hợp

- Dữ kiện đơn giản, có thể kiểm tra trực tiếp (`LOOKUP`)? Main tự tra cứu; không cần giao việc.
- Nếu có Scout, chỉ nhờ Scout tìm vị trí mã liên quan. Scout không quyết định nghiệp vụ hay thay thế điều tra.
- Với quyết định cần nghiên cứu, mặc định giao một Researcher (`FOCUSED`); xem `.agent-core/research/SKILL.md` về phạm vi và ngân sách.
- Chỉ khi người dùng yêu cầu hoặc quy trình cho phép rõ `DEEP`, Main mới giao câu hỏi độc lập cho nhiều Researcher; chốt ngân sách tổng và từng nhánh trước khi giao. Researcher chỉ đọc, được tự chia câu hỏi trong phạm vi đã giao nhưng không tạo agent con hay giao lại cho người khác.
- Main kiểm tra bằng chứng then chốt, tự đưa ra quyết định và chịu trách nhiệm về chính sách nghiệp vụ. Tái dùng findings, không lặp nghiên cứu; chỉ mở lại câu hỏi bị ảnh hưởng, ở cấp độ đã được phép và trong ngân sách còn lại, khi có bằng chứng mới cần xử lý.
- Nếu không có Researcher phù hợp hoặc không có cách đọc an toàn, nói rõ giới hạn. Main chỉ tự nghiên cứu khi được phép, và cần nói rõ cách đã làm.
- Quyền hạn của dự án và ý định của người dùng luôn được ưu tiên. Không để hướng dẫn chung này vượt qua chúng.

Ví dụ: Main cần chọn giữa hai cách phân trang. Nếu chỉ cần tìm endpoint, Main có thể nhờ Scout xác định tệp và dòng liên quan. Nếu cần đối chiếu giới hạn của hai cách và tìm trường hợp một cách bị sai, Main giao câu hỏi đó cho một Researcher, nêu phiên bản và ràng buộc đã biết. Researcher đưa bằng chứng và khuyến nghị; Main kiểm tra phần quyết định và chọn phương án.

## Phân công và nghiệm thu công việc

- Trước khi giao việc, Main chốt kết quả cần đạt và ranh giới; kiểm tra source liên quan để xác nhận điểm sửa, dependency và bằng chứng then chốt.
- Mỗi việc độc lập có một người chịu trách nhiệm, phạm vi rõ và bằng chứng cần thiết. Giao riêng phần triển khai cho người viết phù hợp khi có; Researcher chỉ điều tra, không ngầm nhận việc viết mã.
- Gửi đủ kết quả mong đợi, phần ngoài phạm vi, dữ kiện đã biết và nguồn liên quan. Tránh yêu cầu người nhận lặp lại discovery Main đã làm; chỉ xác minh lại khi source đổi, có mâu thuẫn hoặc cần làm rõ dependency trực tiếp.
- Giao việc không có nghĩa là người dùng đã duyệt thay đổi, phương án hay thao tác. Không suy ra quyền phê duyệt từ việc phân công.
- Main nghiệm thu dựa trên source thực tế đã thay đổi và acceptance đã chốt; không coi lời báo hoàn tất là bằng chứng thay cho source. Nêu rõ kiểm tra nào đã chạy và kiểm tra nào chưa chạy.
