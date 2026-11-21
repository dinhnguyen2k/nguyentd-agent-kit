---
trigger: model_decision
description: "When bumping service versions, changing gRPC .proto/API contracts, or updating RequiredServiceVersions and REQUIRED_BACKEND_VERSIONS."
---

# SYSTEM-UPDATE.MD - Quy Trình Tương Thích Phiên Bản BE gRPC & FE

## 1. Kiểm tra tương thích Contract (`.proto` & DTO)
- Các service Backend và ứng dụng Frontend trong `cogain-core` triển khai độc lập theo tag riêng (`<service>-api-vX.Y.Z`, `<app>-web-vX.Y.Z`), không nâng một phiên bản chung toàn hệ thống.
- **Backward-compatible (Patch/Minor)**: chỉ thêm field hoặc RPC mới với field number mới, không xóa/đổi kiểu/đổi field number cũ, và các field validation mới phải là optional hoặc có giá trị mặc định an toàn.
- **Breaking change (bắt buộc tăng MAJOR)**: xóa field, đổi kiểu, đổi field number hoặc đổi hành vi RPC/DTO không tương thích ngược; phải báo trước cho các bên phụ thuộc và cân nhắc giữ tương thích ngược tạm thời trước khi cắt bỏ.

## 2. Đồng bộ cấu hình phiên bản phụ thuộc (`README.md`)
- **Backend gọi RPC/field mới của service khác**: tra tag mới nhất của service đích và cập nhật `RequiredServiceVersions` trong `backend/src/Services/<Service>/<Service>.API/appsettings.json` của đúng service đang sửa để job CI `check-version:*` kiểm soát sàn và trần MAJOR.
- **Frontend dùng API/field mới của Backend**: cập nhật `REQUIRED_BACKEND_VERSIONS` trong `frontend/<app>/src/lib/required-backend-versions.ts` của đúng ứng dụng FE đang sửa (không dùng chung một tệp cho mọi app).
- **Checklist Merge Request**: chỉ đánh dấu các service/app thực sự có thay đổi mã nguồn cần gắn tag mới (nếu sửa `frontend/shared/` thì đánh dấu tất cả app FE bị ảnh hưởng).

## 3. Cổng an toàn Git & Phát hành (`AI_RULES.md` §2, §4)
- TUYỆT ĐỐI KHÔNG tự ý chạy `git commit`, `git tag` hay `git push` khi chưa có yêu cầu rõ ràng từ người dùng.
- Sau khi cập nhật mã nguồn và cấu hình phiên bản, báo cáo rõ mức thay đổi contract cùng danh sách service bị ảnh hưởng để người dùng quyết định bước phát hành.
