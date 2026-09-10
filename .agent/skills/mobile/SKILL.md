---
name: mobile
description: "Native mobile application development and optimization. Use when developing, optimizing, or debugging mobile applications."
---

## 📱 Quy trình Phát triển Di động

> Scope warning: Cogain currently registers no mobile runtime agent or mobile
> skill. Do not dispatch `mobile-developer`; pause and request an approved mobile
> profile/project boundary before executing this workflow.

Tối ưu hóa mã nguồn cho môi trường Mobile (React Native / Expo / Flutter).

### 1. Thiết kế Mobile-First
- Chuyên gia: `mobile-developer`.
- Áp dụng `mobile-design` skill và `web-design-guidelines`.
- Kiểm tra Touch Targets, Safe Areas và Accessibility.

### 2. Tối ưu Hiệu suất
- Kiểm tra kích thước bundle, lazy loading image.
- Tối ưu hóa bộ nhớ và pin.

### 3. Kiểm thử đa thiết bị (Emulator/Simulator)
- QA: `qa-automation-engineer`.
- Chạy test trên các độ phân giải màn hình khác nhau.

### 4. Chuẩn bị Store
- Cấu hình Metadata, Screenshots và App Icons.
- Kiểm tra các yêu cầu của App Store / Play Store.

// turbo
`npx expo prebuild`
