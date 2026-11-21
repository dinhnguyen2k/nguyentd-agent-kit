---
name: api
description: "Master API Design & Documentation following OpenAPI 3.1 standards. Use when designing, documenting, or reviewing REST and gRPC API contracts."
---

## 🛠️ Quy trình Thiết kế và Tài liệu hóa API

Quy trình này giúp bạn xây dựng hệ thống API chuyên nghiệp, bảo mật và dễ tích hợp.

### Quyền thực thi & Artifact
- Thiết kế/review chỉ đọc: trả lời trong chat kèm dẫn nguồn; không tạo file nếu user chưa yêu cầu lưu.
- Khi user yêu cầu ghi đặc tả hoặc tài liệu API, cập nhật đúng tài liệu sản phẩm trong scope; không mặc định sửa README hoặc docs toàn dự án.
- Single-slice chỉ lưu contract/checkpoint gọn khi cần handoff/resume; multi-slice dùng `00-OVERVIEW.md` và `TASK-*.md` theo `/plan`, không tạo thêm PLAN, implementation_plan, walkthrough hoặc handoff lặp nội dung.
- Scope/acceptance thuộc TASK canonical; governed manifest được dẫn xuất từ metadata TASK bằng parser hiện có, không sửa tay.
- Packet handoff giữ identity của contract snapshot và supersession; chỉ coordinator cập nhật lifecycle overview, không chép lại acceptance hoặc sửa gate/CI evidence bất biến.

### 1. Phân tích & Đặc tả (Design)
- Sử dụng công cụ `api-patterns` và `api-documenter`.
- Đặc tả theo OpenAPI 3.1; chỉ tạo/cập nhật `swagger.yaml` hoặc `openapi.json` khi user yêu cầu ghi, ưu tiên nguồn đặc tả hiện có.
- Định nghĩa các luồng: Authentication (JWT/OAuth2), Error Handling (Standard codes).

### 2. Triển khai Logic (Implementation)
- Worker: `backend-specialist`.
- Áp dụng `api-standards` từ kho DNA.
- Thực hiện Dependency Injection và Separation of Concerns.

### 3. Kiểm định & Bảo mật (Security Check)
- Auditor: `security review role`.
- Kiểm tra các lỗi phổ biến: SQL Injection, Broken Object Level Authorization (BOLA).
- Validate Input/Output theo schema.

### 4. Công bố (Documentation)
- Giữ tài liệu API, ví dụ tích hợp và hướng dẫn sử dụng độc nhất khi user yêu cầu trong scope; kết quả review không cần báo cáo file riêng.
- Không sửa tay `CHANGELOG.md`, catalog/profile hoặc tài liệu auto-generated.
- Chỉ chạy generation, validation, build hoặc test khi user yêu cầu đúng hành động; quyền sửa đặc tả không cấp quyền chạy các lệnh này.
