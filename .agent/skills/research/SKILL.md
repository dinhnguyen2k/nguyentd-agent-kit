---
name: research
description: Investigate technical questions with minimum sufficient evidence from primary and relevant practitioner sources. Use for current facts, API behavior, production trade-offs, or reusable research notes.
metadata:
  category: "research"
  source: "https://github.com/mattpocock/skills (MIT License, Copyright (c) 2026 Matt Pocock)"
---

# Nghiên cứu

Chỉ tìm những gì giúp Main chọn cách làm. Ưu tiên ít nguồn có bằng chứng tốt; đừng tìm cho đủ số lượng.

## 1. Chốt câu hỏi

Trước khi tìm, làm rõ quyết định cần hỗ trợ và những câu hỏi có thể làm thay đổi quyết định đó. Nắm các dữ kiện đã biết, ràng buộc, nội dung không cần tìm, độ mới cần thiết và dạng kết quả mong muốn.
Đừng đưa toàn bộ hội thoại, kho mã hay trang đã mở vào ngữ cảnh. Gửi đường dẫn hoặc tham chiếu ngắn trước; chỉ đọc thêm khi cần trả lời câu hỏi.

## 2. Chọn cấp độ

Mặc định dùng `FOCUSED`. Các giới hạn nguồn dưới đây là mức tối đa, không phải chỉ tiêu; dừng sớm khi đã đủ bằng chứng.

| Cấp độ | Dùng khi | Giới hạn mặc định |
| --- | --- | --- |
| `LOOKUP` | Một dữ kiện cụ thể, tùy chọn API, cú pháp, phiên bản hoặc trạng thái hiện tại | Một câu hỏi; xem tối đa 3 kết quả tìm kiếm; mở 1 nguồn chính và tối đa 1 nguồn xác nhận |
| `FOCUSED` | Một quyết định kỹ thuật có tối đa 3 câu hỏi ảnh hưởng đến quyết định | Tối đa 3 câu hỏi; mở tổng cộng tối đa 6 nguồn liên quan; thường không quá 2 nguồn cho mỗi nhận định |
| `DEEP` | Người dùng yêu cầu rõ nghiên cứu chuyên sâu, hoặc quy trình có kiểm soát cho phép rõ ràng | Phạm vi, số nhánh và ngân sách nguồn phải được chốt trước; không tìm không giới hạn |

`LOOKUP` là việc nhỏ, Main tự tra cứu tại chỗ. Với `FOCUSED`, nếu cần so sánh nhiều nguồn, Main có thể giao trọn câu hỏi cho một Researcher, nếu dự án cho phép. Researcher không tự mở rộng sang `DEEP`. Chỉ dùng `DEEP` khi được yêu cầu hoặc cho phép rõ ràng.

Nếu câu hỏi vượt quá ba điểm có thể làm đổi quyết định mà chưa được cho phép nghiên cứu `DEEP`, thu hẹp về `FOCUSED` và nêu rõ điều chưa giải quyết. Rủi ro có thể đòi hỏi bằng chứng mạnh hơn, nhưng không cho phép tìm kiếm hay giao việc không giới hạn.

## 3. Làm theo hướng dẫn cấp độ

Chỉ đọc hướng dẫn của cấp độ đã chọn:

- `LOOKUP`: [references/lookup.md](references/lookup.md)
- `FOCUSED`: [references/focused.md](references/focused.md)
- `DEEP`: [references/deep.md](references/deep.md)

Không đọc hướng dẫn của các cấp độ còn lại.

## 4. Ghi bằng chứng

Với mỗi nhận định quan trọng, ghi ngắn gọn nhận định, phát hiện, nguồn trực tiếp, loại bằng chứng, mức độ chắc chắn và giới hạn liên quan:

```yaml
- claim: "Decision-changing statement"
  finding: "One to three sentence distilled finding"
  source: "Direct URL or local source reference"
  evidence_type: "fact | reported-experience | inference | open-question"
  confidence: "high | medium | low"
  limitation: "Relevant caveat or null"
```

Đừng giữ HTML thô, trích dẫn dài, đoạn trùng lặp, nội dung điều hướng hay toàn bộ kết quả tìm kiếm. Ghi chú ngắn là phần bàn giao giữa các bước và người tham gia.

## 5. Khi nào dừng

Dừng khi các nhận định có thể làm đổi quyết định đã có bằng chứng trực tiếp và khó có khả năng nguồn độc lập khác làm thay đổi kết luận. Đừng dùng hết ngân sách nguồn nếu không cần.

## 6. Bàn giao

- Trả lời ngắn gọn trong hội thoại, có nguồn, giới hạn, mức độ chắc chắn và câu hỏi còn bỏ ngỏ.
- Phân biệt rõ `fact`, `reported-experience`, `inference` và `open-question`.
- Researcher chỉ trả kết quả trong chat; không tự lưu hay tạo artifact. Main hoặc người có quyền chỉ lưu khi người dùng yêu cầu.
