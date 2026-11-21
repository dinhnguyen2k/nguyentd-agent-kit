---
trigger: model_decision
description: "When touching authentication, permissions, raw SQL, HTML rendering, secrets/configuration, or logging PII."
---

# SECURITY-COMPLIANCE.MD - Bảo Mật & An Toàn Dữ Liệu Cogain

## 1. Bí mật cấu hình & An toàn cơ sở dữ liệu
- Không hardcode API key, password, token hoặc connection string trong code hay file cấu hình lưu trên Git; luôn đọc qua `IConfiguration` hoặc biến môi trường.
- Đảm bảo `.env` và các tệp chứa secret nằm ngoài phạm vi theo dõi của Git trước khi bàn giao.
- Cấm chạy lệnh hủy dữ liệu (`DROP`, `TRUNCATE`, `DELETE` hàng loạt) khi chưa có yêu cầu rõ ràng từ người dùng (`AI_RULES.md` §4).

## 2. Truy vấn, Phân quyền & Giao diện
- Mọi truy vấn cơ sở dữ liệu phải đi qua EF Core LINQ hoặc Parameterized Queries (`FromSqlInterpolated`); cấm nối chuỗi trực tiếp tạo câu lệnh SQL thô.
- Giữ kiểm tra xác thực và permission tại tầng API/Service theo cơ chế chuẩn của hệ thống; mật khẩu hoặc thông tin xác thực nhạy cảm phải băm bằng thuật toán mạnh (Bcrypt/Argon2).
- Khi bắt buộc render HTML động trên giao diện, phải làm sạch dữ liệu đầu vào (ví dụ qua `DOMPurify`) để chống XSS trước khi đưa vào DOM.

## 3. Bảo vệ PII trong Serilog & Báo cáo
- Không ghi secret, access token hoặc dữ liệu định danh cá nhân (CCCD, SĐT, email đầy đủ) ở dạng plain text vào Serilog, console hay báo cáo bàn giao; luôn che khuất (mask) trước khi ghi.
