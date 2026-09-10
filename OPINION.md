# NguyenTD's Opinions - Cách nghĩ và thứ tự ưu tiên

**Description:** Ghi chép cách suy nghĩ và ưu tiên của NguyenTD để chọn hướng xử lý khi rule chưa quy định.
Đây không phải rule; rule chính thức nằm ở `AI_RULES.md` và `.agent/rules/`.

## Xử lý lỗi khi resolve qua gRPC
- Dùng `try/catch` khi gRPC chỉ lấy dữ liệu phụ và nghiệp vụ có fallback. 
- Bắt `RpcException` ngay tại điểm gọi, log lỗi có cấu trúc rồi trả fallback. 
- Không bắt rộng `Exception`, không nuốt lỗi lập trình hoặc lỗi hủy request.
