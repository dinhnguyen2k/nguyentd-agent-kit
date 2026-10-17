---
trigger: glob
glob: "tests/**,**/*Test.php,**/*.{test,spec}.{js,php},**/__tests__/**"
description: "Tiêu chuẩn kiểm thử cho ứng dụng PHP & JS: Unit test, Integration test với MySQL, Mocking PHPMailer SMTP và kiểm thử các ràng buộc bất biến."
---

# TESTING-STANDARD.MD - Tiêu Chuẩn Kiểm Thử Cho Ứng Dụng Web PHP & JS

> **Mục tiêu**: Đảm bảo chất lượng mã nguồn, tính chính xác của các tính năng nghiệp vụ và độ an toàn của hệ thống trước khi triển khai production.

---

## 📐 1. Mô Hình Kiểm Thử (Testing Pyramid)

1. **Unit Tests (Kiểm thử đơn vị)**:
   - Kiểm thử các hàm xử lý độc lập, logic tính toán giá tour, format dữ liệu, chuyển đổi tiền tệ, và các hàm làm sạch/xác thực dữ liệu (input validation).
   - Yêu cầu: Chạy nhanh, không kết nối CSDL thật hay dịch vụ bên ngoài.
2. **Integration Tests (Kiểm thử tích hợp CSDL)**:
   - Kiểm thử tương tác giữa mã nguồn PHP và CSDL MySQL qua PDO: câu lệnh Prepared Statements, giao dịch transaction commit/rollback, câu lệnh INSERT/UPDATE dữ liệu phức tạp.
   - Yêu cầu: CSDL test riêng biệt; rollback chỉ hỗ trợ cách ly test, không thay thế DB test vì DDL/commit nội bộ có thể thoát transaction.
3. **End-to-End / Luồng Nghiệp Vụ Cốt Lõi**:
   - Kiểm thử các luồng nghiệp vụ quan trọng nhất của ứng dụng: Đăng nhập admin, thêm/sửa tour du lịch, gửi form liên hệ tư vấn.

---

## 📝 2. Quy Tắc Đặt Tên & Cấu Trúc Kiểm Thử

*   **Vị trí file**: Đặt trong thư mục `tests/` với hậu tố `*Test.php` (hoặc `*.test.js` cho kiểm thử kịch bản client).
*   **Quy ước đặt tên hàm kiểm thử**: Đặt tên rõ nghĩa phản ánh điều kiện đầu vào và kết quả mong đợi:
    ```php
    // Ví dụ cấu trúc hàm kiểm thử trong PHP
    class TourPriceCalculatorTest extends TestCase
    {
        public function test_calculate_total_price_with_adult_and_child_returns_exact_amount(): void
        {
            $calculator = new TourPriceCalculator();
            $total = $calculator->calculate(priceAdult: 5000000, priceChild: 2500000, adults: 2, children: 1);
            $this->assertSame(12500000, $total);
        }

        public function test_calculate_price_throws_exception_when_price_is_negative(): void
        {
            $this->expectException(\InvalidArgumentException::class);
            $calculator = new TourPriceCalculator();
            $calculator->calculate(priceAdult: -100, priceChild: 0, adults: 1, children: 0);
        }
    }
    ```

---

## 🛠️ 3. Chiến Lược Giả Lập Dịch Vụ (Mocking Strategy)

*   **Dịch vụ gửi Mail (PHPMailer)**:
    - **TUYỆT ĐỐI CẤM** gửi email SMTP thật đến hộp thư khách hàng hoặc tài khoản máy chủ trong quá trình chạy kiểm thử.
    - Bắt buộc giả lập (mock) đối tượng PHPMailer hoặc cấu hình driver ghi mail ra file tạm/bộ nhớ để kiểm tra nội dung và địa chỉ người nhận.
*   **Cơ Sở Dữ Liệu MySQL**:
    - Dùng CSDL test riêng; transaction + rollback ở tearDown chỉ khi code không commit nội bộ và không có DDL implicit commit. Không chạy test trên DB production.

---

## 📊 4. Phạm Vi Bắt Buộc Có Kiểm Thử (High-Risk Invariants)

1. **Tính toán tiền tệ & Giá tour**: Bắt buộc kiểm thử các trường hợp biên (số lượng bằng 0, số lượng lớn, giảm giá, phụ thu) để đảm bảo không bị sai lệch số tiền hoặc phát sinh giá trị âm.
2. **Phân quyền & Session Admin**: Kiểm thử việc chặn truy cập trái phép khi session rỗng hoặc không có quyền admin.
3. **An toàn File Upload**: Kiểm thử việc từ chối các file có đuôi `.php`, `.exe` hoặc file giả mạo MIME type.
4. **CSRF Validation**: Kiểm thử việc từ chối các request POST thiếu token CSRF hoặc sai token.
