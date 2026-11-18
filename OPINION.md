# NguyenTD's Opinions - Cách nghĩ và thứ tự ưu tiên

**Description:** Ghi chép cách suy nghĩ và ưu tiên của NguyenTD để chọn hướng xử lý khi rule chưa quy định.
Đây không phải rule; rule chính thức nằm ở `AI_RULES.md` và `.agent/rules/`.

## Xử lý lỗi khi resolve qua gRPC
- Phân tách rõ các tầng lỗi, không nuốt lỗi:
  - **Lỗi nghiệp vụ (`!response.Success`)**: Phải trả đúng lỗi/thông điệp nghiệp vụ từ service đích (`response.Message`), không được lẳng lặng trả fallback rỗng làm sai lệch hoặc ẩn dữ liệu.
  - **Lỗi giao thức gRPC (`RpcException`)**: Bắt riêng, ghi log mã lỗi và trả về chi tiết status/detail của gRPC để client/caller biết rõ service nào gặp sự cố.
  - **Lỗi hệ thống khác (`Exception`)**: Bắt 2 vòng để log và trả lỗi hệ thống, tránh crash unhandled nhưng tuyệt đối không nuốt âm thầm.
- Dùng `try/catch` khi gRPC lấy dữ liệu phụ và nghiệp vụ có fallback hợp lệ, nhưng không được biến fallback thành nơi che giấu lỗi dịch vụ.

## Tối ưu Collection & Zero-Allocation với gRPC Protobuf
- **Không dùng `.ToList()` hay clone mảng khi dữ liệu đã là collection in-memory**:
  - Dữ liệu dạng danh sách trả về từ Protobuf (`RepeatedField<T>`) bản chất đã là một in-memory collection hoàn chỉnh (cài đặt sẵn `IReadOnlyList<T>`, `IList<T>`, `IEnumerable<T>`).
  - **Cấm gọi `.ToList()` hoặc clone `[.. field]`** khi chỉ cần đọc hoặc trả về cho caller duyệt. Việc gọi `.ToList()` tạo ra heap allocation và copy phần tử hoàn toàn vô nghĩa.
  - **Ưu tiên khai báo kiểu trả về là `IReadOnlyList<T>`** (hoặc `IReadOnlyCollection<T>`) ở các hàm helper query/fetch và trả thẳng `RepeatedField<T>` để đạt **zero-allocation** (zero-copy).
  - Khi danh sách rỗng, dùng collection expression `[]` (tránh `new List<T>()`).

## Format code: ưu tiên gọn trên một dòng

- **Biểu thức ngắn giữ nguyên một dòng**: điều kiện JSX, ternary, chuỗi `??` — đừng bẻ dòng khi đọc một dòng vẫn rõ.
- **C#**: ưu tiên expression-bodied method (`=>`) khi thân hàm chỉ có một biểu thức; dọn hint `Use expression body for method` trong file đang sửa.
- Khi `??` buộc phải xuống dòng, đặt vế sau **thẳng hàng** với vế trước, không thụt thêm một cấp.
- **Comment chỉ giữ phần "tại sao" không suy ra được từ code**, tối đa ~2 dòng.
  Không viết JSDoc nhiều đoạn, không thuật lại điều code đã nói (`// Notify parent nếu có callback`), không kể lịch sử bug trong comment.
- **Không tự ý reformat dòng mình không sửa logic.**
  Diff có thay đổi format lạ thì để yên hoặc hỏi; tuyệt đối không `git checkout --` lên file đang có thay đổi chưa commit.

## Frontend: Giữ logic tập trung, cấm tách file quá nhỏ làm loãng source

- **Cấm tách file quá nhỏ (anti micro-files / anti-fragmentation)**: Tuyệt đối không bóc tách các sub-component, local hook, helper nhỏ ra nhiều file riêng lẻ nếu chỉ dùng cho một màn hình hay một component duy nhất.
- **Tập trung logic (Co-location)**: Logic của một màn hình/form nên nằm tập trung trong cùng file hoặc module cha để dễ theo dõi toàn bộ luồng; việc tách vụn ra hàng chục file con làm loãng source code, người bảo trì sau này rất khó tìm kiếm và trace logic.
- **Điều kiện tách file**: Chỉ tách ra file riêng khi thực sự được tái sử dụng ở nhiều nơi khác nhau (reuse), hoặc khi file trở nên quá dài và component được tách có ranh giới rõ ràng, độc lập.

## EF Core Migration: Cấm tuyệt đối viết tay, chỉ tạo qua add-migration

- **Cấm tuyệt đối viết tay migration**: Tuyệt đối không được tự gõ hoặc tạo thủ công file `.cs` migration.
- **Chỉ dùng qua add-migration**: Bắt buộc phải dùng `./dev.sh add-migration <Service> <MigrationName>` để EF Core tự sinh file migration và ModelSnapshot chuẩn xác.
- **Cấm sửa file migration đã sinh**: Tuyệt đối không sửa tay file migration hay snapshot để "lách" lỗi; nếu sai sót bắt buộc phải sửa từ Entity hoặc Fluent API Configuration rồi sinh lại.
