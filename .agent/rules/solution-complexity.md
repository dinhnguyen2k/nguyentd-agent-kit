---
trigger: glob
glob: "**/*"
description: "Nguyên tắc chọn giải pháp và kiểm soát độ phức tạp: Hiểu sâu, tái sử dụng tối đa, thay đổi tối thiểu, tránh over-engineering cho ứng dụng PHP."
---

# SOLUTION-COMPLEXITY.MD - Chọn Giải Pháp & Ngân Sách Độ Phức Tạp

> Tách từ `AI_RULES.md`. `AI_RULES.md` vẫn là nguồn sự thật cao nhất.

**Understand deeply, reuse aggressively, change minimally, and add complexity only when current requirements justify it.**

Trước khi viết code, đọc kỹ luồng xử lý bị chạm, kết nối CSDL trong `db.php`, template trong `layout/**` và pattern hiện có trong codebase. Chọn phương án đầu tiên đáp ứng đầy đủ yêu cầu hiện tại:

1. **YAGNI (You Aren't Gonna Need It)**: Không làm tính năng nếu nằm ngoài phạm vi yêu cầu hiện tại.
2. **Tái sử dụng tối đa**: Tái sử dụng code, hàm helper, kết nối CSDL `$pdo`, template layout hoặc pattern sẵn có trong repo khi phù hợp.
3. **Tận dụng năng lực chuẩn của ngôn ngữ**: Dùng hàm có sẵn trong PHP Standard Library và extension chuẩn (`PDO`, `mbstring`, `fileinfo`).
4. **Tận dụng nền tảng native**: Dùng HTML5, CSS chuẩn, Browser API và vanilla JavaScript phù hợp.
5. **Dùng dependency đã cài sẵn**: Tận dụng Composer package đã cài (`phpmailer/phpmailer`), không tự ý cài thêm package mới khi chưa có yêu cầu.
6. **Triển khai tối giản**: Chỉ sau đó mới viết mã mới với kích thước nhỏ nhất, rõ ràng, trực diện và dễ bảo trì.

---

## Các Nguyên Tắc Cốt Lõi

- **Minimal đúng bản chất**: Thay đổi nhỏ nhất để đảm bảo **tính đúng đắn (correctness)** và **bảo mật**, không phải là viết tắt hay bỏ qua các bước quan trọng. Tuyệt đối không giản lược validation, kiểm tra CSRF, escape HTML, kiểm tra session admin, upload safety hay PDO transaction khi luồng nghiệp vụ cần chúng.
- **Tránh trừu tượng hóa thừa thãi (No Accidental Complexity)**:
  - Trong ứng dụng PHP thủ tục và module hiện tại, không tự ý thêm các tầng kiến trúc phức tạp như Repository Pattern, UnitOfWork class, Service Container tự chế, Factory hay Interface nếu chỉ cần một câu truy vấn PDO an toàn và một đoạn code xử lý rõ ràng.
  - Tôn trọng cấu trúc hiện hữu của dự án (các file root `*.php`, module `admin/**`, `db.php`, `layout/**`).
- **Độ phức tạp thiết yếu (Essential Complexity)**:
  - Ràng buộc tham số SQL (Prepared Statements), kiểm tra CSRF token, contextual HTML escaping, xác thực quyền truy cập admin, transaction DB khi ghi nhiều bước là **độ phức tạp thiết yếu** bắt buộc phải có để bảo vệ hệ thống.
  - Các lớp bọc generic wrapper, helper thừa chỉ để "phòng khi tương lai cần" là **độ phức tạp ngẫu nhiên (accidental complexity)** cần loại bỏ.
- **Tiêu chuẩn lựa chọn**: Khi hai phương án đều đúng và an toàn, luôn chọn phương án có ít khái niệm hơn, ít file hơn, ít phụ thuộc hơn và dễ đọc hơn.
