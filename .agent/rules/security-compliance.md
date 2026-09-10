---
trigger: glob
glob: '**/*.{cs,ts,js,py,go,tf,yaml,yml,json}'
---

# SECURITY-COMPLIANCE.MD - Quy Tắc Bảo Mật Và Tuân Thủ

> **Mục tiêu**: Đảm bảo an toàn thông tin hệ thống, phòng ngừa lỗ hổng bảo mật và tuân thủ các quy định pháp lý quốc tế (GDPR, PCI-DSS, SOC2).

---

## 🚫 1. Cấm Tuyệt Đối (Forbidden Actions)

1. **Hardcode Secrets**: Không bao giờ viết API Key, Password, Token trực tiếp trong code hoặc file cấu hình không mã hóa. Luôn dùng biến môi trường (`process.env` hoặc `Configuration`).
2. **Commit Token**: Đảm bảo `.env` và các file chứa secret nằm trong `.gitignore` trước khi commit.
3. **Phá Hủy Dữ Liệu**: Tuyệt đối không chạy lệnh xóa database thô (`DROP TABLE`, xóa file `.sqlite`...) trừ khi được người dùng yêu cầu rõ ràng và qua ba bước xác nhận.

---

## 🛡️ 2. Tiêu Chuẩn Code An Toàn (Coding Standards)

1. **SQL Injection**: Luôn sử dụng Parameterized Queries hoặc ORM hiện có của dự án (Cogain: EF Core). Tuyệt đối cấm nối chuỗi trực tiếp để tạo câu lệnh SQL.
2. **XSS (Cross-Site Scripting)**: Sanitize mọi dữ liệu đầu vào từ người dùng hoặc API. Dùng các thư viện như `dompurify` khi render HTML động.
3. **Authentication**: Luôn mã hóa/hash mật khẩu bằng các thuật toán mạnh (Bcrypt/Argon2).

---

## 🔒 3. Bảo Vệ Quyền Riêng Tư Dữ Liệu (GDPR/CCPA)

1. **PII Masking**: Dữ liệu định danh (SĐT, Email, CCCD...) KHÔNG bao giờ được ghi ra Log ở dạng Plain Text. Phải mã hóa hoặc Masking (Ví dụ: `ng***@gmail.com`) khi hiển thị.
2. **Quyền Được Quên**: Hệ thống cần hỗ trợ API `export_user_data` và `delete_user_data` khi có yêu cầu xóa tài khoản.

---

## 💳 4. An Toàn Giao Dịch & Kiểm Toán (PCI-DSS & SOC2)

1. **Card Data**: Cấm tuyệt đối lưu trữ số thẻ tín dụng (PAN) trực tiếp vào Database. Mọi giao dịch phải qua cơ chế Tokenization của các cổng thanh toán uy tín (Stripe/PayPal).
2. **Immutable Logs**: Log hệ thống phải được đẩy về nơi lưu trữ tập trung (Splunk/Datadog...) và có cơ chế bảo vệ chống sửa/xóa.
3. **Access Control**: Mọi truy cập vào Production DB phải được ghi nhật ký và kiểm soát chặt chẽ.
