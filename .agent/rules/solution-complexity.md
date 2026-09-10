---
trigger: glob
glob: "**/*"
---

# SOLUTION-COMPLEXITY.MD - Chọn Giải Pháp & Ngân Sách Độ Phức Tạp

> Tách từ `AI_RULES.md` mục 3.1. `AI_RULES.md` vẫn là nguồn sự thật cao nhất.

**Understand deeply, reuse aggressively, change minimally, and add complexity only when current requirements justify it.**

Trước khi viết code, đọc flow bị chạm, nearest test và pattern hiện có. Chọn phương án đầu tiên đáp ứng đầy đủ yêu cầu hiện tại:
1. Không làm nếu ngoài scope hiện tại (YAGNI).
2. Reuse code, component, API, helper hoặc pattern trong repo khi contract và invariant tương thích.
3. Dùng capability có sẵn của framework/standard library.
4. Dùng platform native (HTML/CSS/browser API khi phù hợp).
5. Dùng dependency đã được cài đặt.
6. Chỉ sau đó mới viết implementation mới nhỏ nhất, rõ ràng và dễ bảo trì.

- Minimal là thay đổi **đúng boundary** và nhỏ nhất để đảm bảo correctness,
  không phải ít dòng hay ít file bằng mọi giá. Không giản lược validation,
  authorization, data integrity, accessibility, observability, cancellation,
  timeout, retry safety, idempotency hoặc transaction consistency khi flow cần chúng.
- Không thêm interface, Repository, UnitOfWork, factory, wrapper, hook, shared
  component hay dependency nếu chưa có lý do hiện tại rõ ràng: boundary thật,
  nhiều implementation/consumer, concern thay đổi độc lập, hoặc nhu cầu
  testability/vận hành đã xác minh. Tôn trọng architecture layer hiện hữu;
  không bypass chúng chỉ để diff nhỏ hơn.
- Với bug: xác lập và sửa root cause dựa trên evidence; đánh giá caller/consumer
  liên quan khi nguyên nhân có thể dùng chung. Deletion hoặc simplification là
  giải pháp hợp lệ nếu vẫn giữ contract và invariant.
- Trong distributed systems, partial failure, deadline/timeout, cancellation,
  retry có giới hạn, idempotency, transaction boundary và tracing có thể là
  **essential complexity**. Generic wrapper/pattern chỉ để "phòng khi cần" là
  **accidental complexity** trừ khi có nhu cầu lặp lại đã chứng minh.
- Khi hai phương án đều đúng và an toàn, chọn phương án có ít concepts, dependencies, files và moving parts hơn.
- Tiêu chí xếp hạng phương án (không lấy chi phí phát triển làm tiêu chí) nằm ở
  `AI_RULES.md` mục 5, luôn có hiệu lực kể cả khi file này chưa được nạp.
