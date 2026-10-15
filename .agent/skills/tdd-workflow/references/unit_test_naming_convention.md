# Test Naming Convention (BDD Style)

Transferred from `tdd-master-workflow/sub-skills/unit_test_naming_convention.md`.
Preserve the local test suite naming convention; BDD prose and `should_[expected_behavior]_when_[condition]` are examples, not a mandatory rename.

Quy tắc đặt tên test dễ đọc, dễ hiểu theo phong cách Given-When-Then.

### Định dạng:
`it('should [kết quả mong muốn] when [điều kiện kích hoạt]', () => { ... })`

### Ví dụ:
- ✅ `it('should return 401 when token is missing', () => { ... })`
- ✅ `it('should calculate discount correctly when coupon is valid', () => { ... })`
- ❌ `it('test login', () => { ... })` (Quá mơ hồ)

### AAA Pattern (Arrange - Act - Assert)
- **Arrange**: Thiết lập dữ liệu và dependency phù hợp với seam đã duyệt; không mặc định mock.
- **Act**: Thực hiện hành động (gọi hàm cần test).
- **Assert**: So sánh kết quả thực tế với mong đợi.
