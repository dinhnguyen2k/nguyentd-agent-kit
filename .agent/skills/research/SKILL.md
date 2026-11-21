---
name: research
description: Investigate technical questions with minimum sufficient evidence from primary and relevant practitioner sources. Use for current facts, API behavior, production trade-offs, or reusable research notes.
metadata:
  category: "research"
  source: "https://github.com/mattpocock/skills (MIT License, Copyright (c) 2026 Matt Pocock)"
---

# Nghiên cứu Liên hồi & Hội tụ Bằng chứng

Chỉ tìm những gì giúp chốt phương án tối ưu theo `AI_RULES.md` §3 & §5. Ưu tiên nguồn sự thật trực tiếp, dừng ngay khi đủ căn cứ.

## 1. Thứ tự ưu tiên nguồn sự thật & 3 Nhịp nghiên cứu

Tra cứu theo đúng thứ tự độ tin cậy giảm dần:
1. **Đồ thị mã nguồn sống & Mẫu chuẩn nội bộ**: dùng công cụ ngữ nghĩa `lsp` (`find_definition`, `find_references`, `find_implementation`, `get_incoming_calls`, `get_diagnostics`) + `.agent/contracts/archetype-exemplars.json` + tối đa 2 tệp chuẩn cùng phân hệ khi ngoài archetype đã đăng ký.
2. **Tài liệu chính thức của thư viện/framework**: dùng MCP `context7` (`resolve-library-id`, `query-docs`) cho đúng phiên bản `.NET 8`, `EF Core`, `React 19`, `TanStack`, `Vite`, `Zod` trước khi tìm web chung.
3. **Thực chiến & Phản chứng bên ngoài**: dùng `search_web` đã khử riêng tư khi cần đánh đổi vận hành, giới hạn sản xuất hoặc phản ví dụ.

Nghiên cứu vận hành liên hồi ở **3 nhịp** thay vì khóa cứng một lần đầu giờ:
- **Nhịp 1 (Định hình)**: chốt quyết định cần hỗ trợ, bất biến và phương án ban đầu có bằng chứng; chỉ đẩy câu hỏi thuộc **Vùng Đỏ** (`AI_RULES.md` §3) vào `Hộp thư Quyết định`, còn Vùng Xanh/Vàng phải tự tra cứu và tự chốt.
- **Nhịp 2 (Vi-nghiên cứu giữa chừng - `Mid-Flight Micro-Research`)**: kích hoạt ngay khi thực thi gặp 1 trong 4 tín hiệu thực chứng: (a) lệch chữ ký/type/nullability thực tế, (b) lộ tác dụng phụ ẩn (transaction, cache, child-sync, snapshot, auth), (c) hành vi biên thư viện chưa rõ, (d) lộ điểm nghẽn hiệu năng (N+1, cấp phát thừa).
- **Nhịp 3 (Hội tụ bằng chứng ngoại sinh)**: đối chiếu phương án trước bàn giao theo thang `correctness > simplicity > robustness > maintainability`.

## 2. Chọn cấp độ & 4 Chốt chặn chống sa lầy (`Anti-Rabbit-Holing`)

Mặc định dùng `FOCUSED` cho nghiên cứu độc lập và `MICRO` cho vi-nghiên cứu giữa chừng:

| Cấp độ | Dùng khi | Giới hạn cứng |
| --- | --- | --- |
| `MICRO` | Phát sinh 1 trong 4 tín hiệu lệch giả định khi đang lập kế hoạch hoặc viết mã | Tối đa 3 bước tra cứu có mục tiêu (`lsp`/`context7`/source) cho mỗi sự kiện kích hoạt; nâng lên `FOCUSED` chỉ khi phát hiện chuỗi nhân quả liên dịch vụ |
| `LOOKUP` | Một dữ kiện cụ thể, tùy chọn API, cú pháp, phiên bản hoặc trạng thái hiện tại | Main tự tra: 1 câu hỏi; tối đa 3 kết quả tìm kiếm; mở 1 nguồn chính + tối đa 1 nguồn xác nhận |
| `FOCUSED` | Một quyết định có tối đa 3 câu hỏi ảnh hưởng đến lựa chọn | Một `researcher` sở hữu trong cửa sổ ngữ cảnh riêng (chống làm nhiễu Main); tối đa 3 câu hỏi logic và 6 nguồn bên ngoài cho quyết định đó |
| `DEEP` | Người dùng yêu cầu rõ nghiên cứu chuyên sâu hoặc quy trình cho phép rõ | Main chia câu hỏi độc lập không chồng lấn cho các `researcher` với ngân sách tổng và từng nhánh chốt cứng trước khi chạy |

Chỉ đọc hướng dẫn của cấp độ tương ứng khi cần chi tiết:
- `LOOKUP`: [references/lookup.md](references/lookup.md)
- `FOCUSED`: [references/focused.md](references/focused.md)
- `DEEP`: [references/deep.md](references/deep.md)

**4 Chốt chặn định lượng bắt buộc**:
1. **Cấm đổi thiết kế không có bằng chứng ngoại sinh mới**: không mở vòng đổi phương án nếu không chỉ ra được `file:line` mới, lỗi chẩn đoán tĩnh hoặc đặc tả gốc chứng minh điểm yếu thật.
2. **Cổng lợi suất bằng 0 (`Zero-Marginal-Evidence`)**: dừng tra cứu ngay khi 2 bước liên tiếp không mang lại ràng buộc kỹ thuật mới làm đổi thứ hạng phương án.
3. **Ưu thế phương án tối giản đương nhiệm (`Hysteresis`)**: giữ nguyên phương án $A$ trừ khi bằng chứng mới chứng minh $A$ sai/vi phạm bất biến hoặc phương án $B$ đơn giản hơn rõ rệt.
4. **Cô lập nhiễu tra cứu**: `researcher` hấp thụ toàn bộ dữ liệu dò tìm thô và chỉ trả về cho Main bản chắt lọc có trích dẫn, không chép HTML thô hay log tìm kiếm dài.

## 3. Ghi bằng chứng & Bàn giao

- Với mỗi nhận định quan trọng, ghi ngắn gọn: nhận định, phát hiện, nguồn trực tiếp (`tệp:dòng` hoặc URL), loại bằng chứng (`fact`, `reported-experience`, `inference`, `open-question`), mức độ chắc chắn và giới hạn.
- Phân biệt rõ điều được bằng chứng hỗ trợ, điều suy ra và điều kiện thực tế nào sẽ khiến khuyến nghị bị đảo ngược.
- `researcher` chỉ trả kết quả trong hội thoại cho Main, không tự lưu hay tạo artifact; Main chỉ lưu tại `.agent/artifacts/` khi người dùng yêu cầu.
- Khi cùng một khoảng trống tri thức hoặc bẫy thư viện phải tra cứu lặp lại `>= 2` lần, ghi nhận vào `.agent/reports/agent-friction.jsonl` để kết tinh thành luật `R10`, mẫu trong `archetype-exemplars.json` hoặc `OPINION.md` ở phiên `/upgrade-agent`.
