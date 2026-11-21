---
trigger: model_decision
description: "When changing shared enums, nullable IDs, validation rules, or public DTO/API contracts across Backend and Frontend."
---

# DOMAIN-PARITY.MD - Nhất Quán BE ↔ FE

Tách từ `AI_RULES.md` để chỉ nạp khi thực sự chạm code hai đầu.

- BE là nguồn sự thật cho validation. FE phục vụ UX và phải đồng nhất rule, không được nới lỏng hay thêm rule riêng.
- Enum: BE và FE dùng chung giá trị số (`int`) và `EnumKey` (`Type.Name` trong `Shared.Enums`). BE bắt buộc gắn `[Description("...")]` cho từng member và dùng `IEnumLabelProvider` / `EnumLabelSnapshot` khi xử lý nhãn/options/parse (`backend.md §7`); FE hiển thị nhãn và options qua `useEnumLabel` / `useEnumOptions` (`@shared/hooks/master-data/use-enum-labels`), không hardcode text riêng.
- Nullable ID: chuỗi rỗng `""` ở FE phải chuyển thành `null`/`undefined` trước khi gửi BE.
- Đổi public contract ở BE thì kiểm tra consumer FE trước khi đổi, không để FE vỡ im lặng.
