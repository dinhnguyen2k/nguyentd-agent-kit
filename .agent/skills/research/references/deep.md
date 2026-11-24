# Nghiên cứu DEEP (Tối đa 6 Nhánh Trực Giao)

Chỉ dùng `DEEP` khi người dùng yêu cầu rõ nghiên cứu chuyên sâu hoặc gặp bài toán kiến trúc/liên phân hệ/lỗi phức tạp được quy trình cho phép.
Main điều phối, chốt phạm vi và giữ quyền quyết định; `researcher` chỉ đọc/tra cứu theo góc nhìn được giao, không tạo agent con.

## 1. Thang mở nhánh linh hoạt & Chốt phạm vi (`1 -> 2-3 -> 6 nhánh`)

Không ép mở 6 nhánh cho câu hỏi cục bộ nhỏ: giữ `LOOKUP`/`MICRO` (`<= 3` bước tại Main) cho dữ kiện đơn, `FOCUSED` (`1-2` nhánh) cho bài toán đơn miền hoặc liên miền hẹp, và chỉ mở tối đa **6 nhánh song song** cho `DEEP`.

Trước khi chạy, Main khóa cứng phạm vi:
- Một quyết định chung cần hỗ trợ và điều kiện hoàn tất có thể quan sát được.
- Các góc nhìn không chồng lấn, phạm vi loại trừ và phụ thuộc (nhánh phụ thuộc phải chạy sau).
- Ngân sách nguồn hữu hạn cho từng nhánh và toàn đợt; cấm tự đặt lại ngân sách hay âm thầm mở rộng phạm vi.

## 2. Bộ 6 Góc nhìn trực giao chuẩn (`6 Orthogonal Lanes`)

Với bài toán nghiệp vụ ERP/Microservices, chia tối đa 6 nhánh theo 6 trục sau để tránh tìm trùng nguồn:

1. **Nhánh 1 - Nghiệp vụ & Bất biến Backend**: `BaseService`, `AggregateShape`, `WorkItem`, trạng thái chứng từ và quy tắc miền gốc.
2. **Nhánh 2 - Giao dịch, Dữ liệu & Liên dịch vụ**: ranh giới DB transaction, đồng bộ snapshot ngoài giao dịch, gRPC, message broker, Redis cache và hiệu năng truy vấn (`N+1`, index).
3. **Nhánh 3 - Giao diện, Form & Đồng bộ hai đầu (BE - FE)**: component dùng chung, React Hook Form/Zod (`z.guid()`), query cache, khớp enum và giá trị null/rỗng.
4. **Nhánh 4 - Khuôn mẫu chuẩn & Tiền lệ nội bộ**: đối chiếu `.agent/contracts/archetype-exemplars.json` cùng mã chuẩn và lịch sử gần nhất cùng phân hệ để tái sử dụng.
5. **Nhánh 5 - Tài liệu gốc & Thực chiến bên ngoài**: đặc tả đúng phiên bản thư viện/framework và bài học vận hành ngoài (`search_web` đã khử sạch thông tin nội bộ dự án).
6. **Nhánh 6 - Phản biện & Trường hợp biên (`Devil's Advocate`)**: chuyên tìm bằng chứng bác bỏ giả thuyết ban đầu, rà `.planning/errors/ERRORS.md`, rủi ro tương thích ngược và dữ liệu lịch sử.

*(Với chủ đề hạ tầng, công cụ hoặc điều phối không thuộc nghiệp vụ ERP, Main ánh xạ tương đương sang tối đa 6 góc nhìn độc lập không chồng lấn).*

## 3. Điều phối đa nền tảng & Trần nén đầu ra

- **Trần đầu ra mỗi nhánh**: tối đa **5 phát hiện (`<= 220` từ)**, ghi rõ loại bằng chứng (`fact`, `reported-experience`, `inference`, `open-question`), mức độ chắc chắn, giới hạn và nguồn trực tiếp (`tệp:dòng` hoặc URL), giữ tổng đầu vào 6 nhánh về Main dưới `~2.400` token. Không chép trang tài liệu thô hay lịch sử hội thoại.
- **Antigravity (`agy`)**: khởi chạy đồng thời qua 1 lệnh `swarm` (`action: "add"`, `name: "res<đợt>"`, `model: "gemini-4-hydrogen-high"`, `tasks: [...]`, yêu cầu đọc `.agents/agents/researcher.md` và báo `@coordinator [done]`) để tránh lỗi tranh chấp DB khi gọi `>= 3` `invoke_subagent`; thu đủ báo cáo thì gọi `swarm` (`action: "kill"`).
- **OMP & Claude Code**: gọi song song các subagent `researcher` theo cơ chế gốc; khi thiếu một nhánh trên CLI do tranh chấp phiên, chỉ gọi bù đúng nhánh bị trượt ở lượt sau.

## 4. Main Đối chiếu chéo & Ra quyết định

- **Đối chiếu phản biện**: đặt phát hiện của `Nhánh 1-5` cạnh phản chứng từ `Nhánh 6`; không cộng phiếu theo đa số mà kiểm chứng trực tiếp bằng `lsp`/`context7` tại mọi điểm bất đồng.
- **Thứ tự trọng tài**: `runtime source > đặc tả gốc > báo cáo bên ngoài`, cùng mức mạnh bằng chứng (`fact` > `inference`).
- **Cổng dừng (`Zero-Marginal-Evidence` & `Hysteresis`)**: dừng ngay khi đủ căn cứ, hết ngân sách hoặc 2 bước liên tiếp không thêm ràng buộc đổi thứ hạng phương án; giữ phương án đương nhiệm trừ khi có `file:line` hoặc spec bác bỏ trực tiếp.
