---
trigger: glob
glob: "**/*.php"
---

# BACKEND-PRAGMATIC-SOLID.MD - Pragmatic SOLID Cho PHP Backend

> Mục tiêu: Áp dụng nguyên lý SOLID thực dụng cho backend PHP (procedural scripts, admin CRUD, PDO helpers), tránh cực đoan và over-engineering, ưu tiên sự đơn giản, trực diện, dễ đọc và dễ bảo trì.

---

## 1. Core Principle

1. Chọn thiết kế đơn giản nhất giải quyết trọn vẹn bài toán hiện tại của ứng dụng PHP.
2. Chỉ thêm abstraction (class, interface, layer) khi có áp lực thay đổi hoặc biến thể thực tế.
3. Tránh "pattern worship" - không biến một trang PHP CRUD đơn giản thành kiến trúc đa tầng cồng kềnh.

---

## 2. Abstraction Gate (Bắt buộc trước khi tách class / interface / factory)

Chỉ đưa thêm abstraction vào code PHP khi có ít nhất một điều kiện sau thỏa mãn:

1. Có từ 2 implementation thực tế đang hoạt động hoặc chuẩn bị triển khai ngay (ví dụ: hỗ trợ 2 cổng thanh toán khác nhau, hoặc 2 driver gửi mail khác nhau).
2. Logic rẽ nhánh (`if/switch-case`) đang tăng nhanh và lặp lại ở nhiều file.
3. Dependency là ranh giới bên ngoài cần cô lập (hệ thống thanh toán, API bên thứ ba, filesystem đặc thù).
4. Cần khả năng kiểm thử độc lập (testability) tại ranh giới thực sự khi có yêu cầu viết test.
5. Một module/hàm có nhiều lý do thay đổi hoàn toàn độc lập với nhau.

**Nếu tất cả điều kiện trên đều KHÔNG thỏa mãn: Giữ code concrete (viết script thủ tục rõ ràng hoặc hàm helper trực diện với PDO).**

---

## 3. SOLID Thực Dụng Trong PHP

1. **SRP (Single Responsibility)**: Tách hàm hoặc file khi có nhiều lý do thay đổi thực tế. Trong một file PHP xử lý form, việc tách biệt phần validate dữ liệu và phần render giao diện là hợp lý, nhưng không cần thiết phải tách thành 5 class riêng biệt.
2. **OCP (Open/Closed)**: Mở rộng qua cấu hình hoặc mảng cấu hình tham số thay vì viết thừa kế trừu tượng phức tạp cho tính năng chưa có biến thể.
3. **LSP & ISP (Liskov & Interface Segregation)**: Giữ hàm và class nhỏ gọn; nếu dùng interface, chỉ định nghĩa các phương thức thực sự cần thiết cho client.
4. **DIP (Dependency Inversion)**: Áp dụng ở ranh giới phụ thuộc quan trọng (như dịch vụ gửi mail, cổng thanh toán). Không áp dụng one-class-one-interface một cách máy móc cho mọi câu lệnh CSDL.

---

## 4. Các Mẫu Chống Over-Engineering (BỊ CẤM)

**Không được:**
1. Tạo interface/abstract class khi chỉ có duy nhất một implementation và không có kế hoạch mở rộng cụ thể.
2. Tách một luồng PHP CRUD đơn giản (nhận input -> validate -> câu lệnh PDO -> render/redirect) thành quá nhiều tầng (DTO, Request, Controller, Service, Repository, Mapper, Entity).
3. Tạo Factory, Strategy, hoặc Service Container tự chế chỉ để thực hiện một hành vi cố định duy nhất.
4. Viết code phòng ngừa cho các giả định xa vời mà không có yêu cầu nghiệp vụ hiện tại.

---

## 5. Phong Cách Giải Thích Khi Đề Xuất Code

Khi đề xuất giải pháp hoặc refactor mã nguồn PHP, luôn nêu rõ:
1. Tại sao thiết kế hiện tại đủ đơn giản và giải quyết được yêu cầu.
2. Thành phần nào được giữ concrete và trực diện có chủ đích.
3. Điểm mở rộng (extension points) nào có thể nâng cấp khi độ phức tạp nghiệp vụ thực tế tăng lên.

---

## 6. Diff Self-Check (Trước Khi Hoàn Tất)

| Check | Câu hỏi tự kiểm tra |
|---|---|
| ✅ **Diff justified?** | Đọc diff thực tế. Mọi class, interface, wrapper hay factory mới trong diff này có vượt qua ít nhất 1 điều kiện ở **Mục 2 (Abstraction Gate)** không? Nếu không, hãy inline lại thành hàm concrete hoặc câu lệnh PDO trực tiếp trước khi bàn giao. |
