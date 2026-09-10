---
trigger: glob
glob: "backend/**/*"
---

# BACKEND-PRAGMATIC-SOLID.MD - Pragmatic SOLID Rule

> Mục tiêu: áp dụng SOLID thực dụng cho backend .NET, tránh cực đoan, ưu tiên đơn giản, dễ đọc, dễ mở rộng.

## 1. Core Principle

1. Chọn thiết kế đơn giản nhất giải quyết tốt bài toán hiện tại.
2. Chỉ thêm abstraction khi có áp lực thay đổi thực tế.
3. Tránh over-engineering và "pattern worship".

## 2. Abstraction Gate (Bắt buộc trước khi tách interface/strategy/factory)

Chỉ introduce abstraction khi có ít nhất một điều kiện đúng:

1. Có nhiều implementation hiện tại hoặc rất gần.
2. Conditional logic (`if/switch`) đang tăng rõ rệt.
3. Dependency là boundary bên ngoài (DB/cache/http/gRPC/message bus/file system/clock).
4. Cần testability ở boundary thật sự.
5. Một class có nhiều lý do thay đổi độc lập.

Nếu tất cả đều `không`: giữ code concrete.

## 3. SOLID as Tool, Not Religion

1. SRP: tách khi có nhiều lý do thay đổi thật, không tách theo cảm tính.
2. OCP: mở rộng khi có biến thể thực tế, không chuẩn bị cho giả định xa.
3. LSP/ISP: giữ abstraction nhỏ gọn, không tạo "god interface".
4. DIP: ưu tiên ở boundary quan trọng, không one-class-one-interface mặc định.

## 4. Anti-Overengineering Bans

Không được:
1. Tạo interface không có giá trị thay thế rõ ràng.
2. Tạo factory/strategy cho một behavior cố định duy nhất.
3. Chia một flow đơn giản thành quá nhiều lớp nhỏ.
4. Tối ưu cho yêu cầu giả định chưa có bằng chứng.

## 5. Required Explanation Style

Khi đề xuất code/refactor backend, luôn nêu rõ:
1. Tại sao thiết kế hiện tại đủ đơn giản.
2. Tại sao có/không áp dụng SOLID mạnh tay.
3. Thành phần nào giữ concrete có chủ đích.
4. Extension points nào để mở rộng khi complexity tăng.

## 6. Concrete Examples

Tham chiếu ví dụ trực tiếp:
- `.agent/skills/backend-pragmatic-solid/references/pragmatic-solid-examples.md`

## 7. Diff Self-Check (Trước Khi Báo Cáo Xong)

| Check | Câu hỏi |
|-------|---------|
| ✅ **Diff justified?** | Đọc diff thật, không đọc plan. Mọi interface/factory/strategy/wrapper mới trong diff này có pass ít nhất 1 điều kiện ở mục 2 (Abstraction Gate) không? Nếu không pass điều kiện nào — inline lại thành concrete trước khi báo cáo xong. |
