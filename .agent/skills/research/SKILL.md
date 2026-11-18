---
name: research
description: Investigate technical questions with minimum sufficient evidence from primary and relevant practitioner sources. Use for current facts, API behavior, production trade-offs, or reusable research notes.
metadata:
  category: "research"
  source: "https://github.com/mattpocock/skills (MIT License, Copyright (c) 2026 Matt Pocock)"
---

# Nghiên cứu

Chỉ tìm những gì giúp Main chọn cách làm. Ưu tiên ít nguồn có bằng chứng tốt; đừng tìm cho đủ số lượng.

## 1. Chốt quyết định

Trước khi tìm, diễn đạt yêu cầu thành quyết định cần hỗ trợ, dấu hiệu cho thấy quyết định thành công và điều chính không nằm trong phạm vi. Tách điều đã quan sát, giả định và ràng buộc còn thiếu. Chỉ hỏi lại khi câu trả lời có thể làm đổi quyết định; nếu không, nêu rõ giả định và tiếp tục trong phạm vi an toàn.

Đừng đưa toàn bộ hội thoại, kho mã hay trang đã mở vào ngữ cảnh. Gửi đường dẫn hoặc tham chiếu ngắn trước; chỉ đọc thêm khi cần trả lời câu hỏi.

## 2. Chọn cấp độ

Mặc định dùng `FOCUSED`. Các giới hạn nguồn dưới đây là mức tối đa, không phải chỉ tiêu; dừng sớm khi đã đủ bằng chứng.

| Cấp độ | Dùng khi | Giới hạn mặc định |
| --- | --- | --- |
| `LOOKUP` | Một dữ kiện cụ thể, tùy chọn API, cú pháp, phiên bản hoặc trạng thái hiện tại | Một câu hỏi; xem tối đa 3 kết quả tìm kiếm; mở 1 nguồn chính và tối đa 1 nguồn xác nhận |
| `FOCUSED` | Một quyết định có tối đa 3 câu hỏi ảnh hưởng đến lựa chọn | Một Researcher sở hữu toàn bộ việc tìm hiểu; tối đa 3 câu hỏi logic và 6 nguồn liên quan cộng dồn qua mọi lượt; thường không quá 2 nguồn cho mỗi nhận định |
| `DEEP` | Người dùng yêu cầu rõ nghiên cứu chuyên sâu hoặc quy trình có kiểm soát cho phép rõ ràng | Main chỉ định câu hỏi độc lập cho từng nhánh và chốt trước tổng ngân sách, số nhánh cùng ngân sách hữu hạn của từng nhánh; không tìm không giới hạn |

`LOOKUP` là việc nhỏ, Main tự tra cứu, không chia nhánh. Với `FOCUSED`, Main giao việc tìm hiểu cho một Researcher; Researcher chỉ đọc và có thể tự chia câu hỏi trong phạm vi được giao, nhưng không tạo agent con hay giao việc tiếp. Với `DEEP`, chỉ dùng khi người dùng yêu cầu rõ nghiên cứu chuyên sâu hoặc quy trình có kiểm soát cho phép rõ ràng. Main giao các câu hỏi độc lập với ngân sách hữu hạn đã chốt; Researcher chỉ nghiên cứu và bàn giao bằng chứng, Main giữ quyền quyết định.

Nếu câu hỏi vượt quá ba điểm có thể làm đổi quyết định mà chưa được cho phép nghiên cứu `DEEP`, thu hẹp về `FOCUSED` và nêu rõ điều chưa giải quyết. Rủi ro có thể đòi hỏi bằng chứng mạnh hơn, nhưng không cho phép tìm kiếm hay giao việc không giới hạn.

Với câu hỏi không tầm thường, một “nhánh” là một câu hỏi cụ thể có thể làm đổi quyết định, không phải một chủ đề rộng. Có thể hỏi “Hiện giờ điều gì đang gây ra độ trễ?”, “Phương án B có giảm độ trễ mà vẫn giữ dữ liệu mới không?” hoặc “Bằng chứng mạnh nhất nào cho thấy phương án A sẽ thất bại?”. Đây là ví dụ gợi ý, không phải các bước bắt buộc. Với mỗi câu hỏi đã chọn, nêu bằng chứng cần có và dấu hiệu đủ để kết luận. Nêu người chịu trách nhiệm và quan hệ phụ thuộc khi có liên quan.

## 3. Làm theo hướng dẫn cấp độ

Chỉ đọc hướng dẫn của cấp độ đã chọn:

- `LOOKUP`: [references/lookup.md](references/lookup.md)
- `FOCUSED`: [references/focused.md](references/focused.md)
- `DEEP`: [references/deep.md](references/deep.md)

Không đọc hướng dẫn của các cấp độ còn lại.

## 4. Ghi bằng chứng

Với mỗi nhận định quan trọng, ghi ngắn gọn nhận định, phát hiện, nguồn trực tiếp, loại bằng chứng (`fact`, `reported-experience`, `inference` hoặc `open-question`), mức độ chắc chắn và giới hạn liên quan.

Đừng giữ HTML thô, trích dẫn dài, đoạn trùng lặp, nội dung điều hướng hay toàn bộ kết quả tìm kiếm. Ghi chú ngắn là phần bàn giao giữa các bước và người tham gia.

## 5. Khi nào dừng

Dừng khi các nhận định có thể làm đổi quyết định đã có bằng chứng trực tiếp và khó có khả năng nguồn độc lập khác làm thay đổi kết luận. Đừng dùng hết ngân sách nguồn nếu không cần.

## 6. Bàn giao

- Trả lời ngắn gọn trong hội thoại, có nguồn, giới hạn, mức độ chắc chắn và câu hỏi còn bỏ ngỏ.
- Phân biệt điều được bằng chứng hỗ trợ, điều suy ra và điều chưa biết. Nêu bằng chứng nào có thể làm đổi quyết định và tiêu chí nào sẽ khiến khuyến nghị bị đảo ngược.
- Researcher chỉ trả kết quả trong chat; không tự lưu hay tạo artifact. Main hoặc người có quyền chỉ lưu khi người dùng yêu cầu.
- Khi bàn giao, nêu kết quả quan sát được nào sẽ củng cố hoặc bác bỏ lời khuyên. Nếu về sau người dùng hoặc bên gọi cung cấp kết quả thực tế, đối chiếu kết quả dự kiến với kết quả quan sát; chỉ mở lại câu hỏi bị ảnh hưởng nếu bằng chứng mới thuộc phạm vi và ngân sách đã được phép, rồi báo rõ điều gì thay đổi hoặc vì sao không thay đổi. Không tự nghiên cứu nền hay mở rộng ngân sách.
- Chỉ dùng ghi chú cũ đã được cho phép nếu ghi chú có sẵn và còn phù hợp; không khẳng định có bộ nhớ tự động giữa các phiên.

## 7. Cải tiến có căn cứ

Một lần sửa lời khuyên là hiệu chỉnh cho trường hợp đó, không tự nó chứng minh cần đổi quy trình. Chỉ đề xuất thay đổi quy trình lặp lại khi có bằng chứng về vấn đề tái diễn và cách so sánh trên một nhiệm vụ tương tự, chẳng hạn giữ chất lượng và nguồn dẫn nhưng giảm lượt đọc trùng hoặc bỏ sót phản ví dụ. Luồng quản trị là bằng chứng -> đề xuất -> đánh giá được cho phép -> người dùng phê duyệt -> công bố. Chỉ người có thẩm quyền mới lưu thay đổi khi được yêu cầu; không chạy đánh giá hay ghi tự động, không đặt lịch hoặc tự cập nhật.

Ví dụ: ban đầu, tài liệu chính thức cho thấy chế độ lưu đệm phù hợp nên khuyến nghị bật. Sau đó, người dùng báo rằng bản cập nhật dữ liệu phải hiện ngay và kết quả thực tế bị cũ. Đây là bằng chứng mới có thể đảo khuyến nghị: đối chiếu độ trễ cho phép với thời gian lưu đệm, rồi mở lại riêng câu hỏi về chế độ lưu đệm trong ngân sách đã duyệt. Nếu yêu cầu mới xác nhận dữ liệu phải hiện tức thì, thu hẹp hoặc rút khuyến nghị ban đầu; không tự mở nghiên cứu các lựa chọn khác ngoài phạm vi.
