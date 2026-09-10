---
trigger: glob
glob: "backend/**/*,frontend/**/*"
---

# DOMAIN-PARITY.MD - Nhất Quán BE ↔ FE

Tách từ `AI_RULES.md` để chỉ nạp khi thực sự chạm code hai đầu.

- BE là nguồn sự thật cho validation. FE phục vụ UX và phải đồng nhất rule, không được nới lỏng hay thêm rule riêng.
- Enum: BE và FE dùng chung giá trị số.
- Nullable ID: chuỗi rỗng `""` ở FE phải chuyển thành `null`/`undefined` trước khi gửi BE.
- Đổi public contract ở BE thì kiểm tra consumer FE trước khi đổi, không để FE vỡ im lặng.
