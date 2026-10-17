# EF Core Best Practices & Performance Guide
<!-- last_synced: 2026-07-31 -->

> **Tự động cập nhật**: 2026-07-31 11:03:22
> **Nguồn**: [Microsoft EF Core Documentation](https://learn.microsoft.com/ef/core/)

---

## ⚡ Standard EF Core Rules for Cogain
1. **AsNoTracking() cho Read-Only**: Tất cả truy vấn xem danh sách/chi tiết không sửa dữ liệu BẮT BUỘC dùng `AsNoTracking()`.
2. **Avoid N+1 Queries**: Luôn dùng `.Include()` hoặc Projection (`.Select()`) hợp lý.
3. **Soft Delete Filter**: Tự động lọc `DeletedDate == null` qua Query Filter hoặc `FilterSoftDeletedItems`.
4. **PostgreSQL 23505 (Duplicate Key)**: Bắt lỗi trùng khóa qua `HandleDuplicateKeyAsync` của `BaseService`.

---

## 📰 Bài Viết Mới Nhất về EF Core

### 1. [.NET 11 Preview 6 is now available!](https://devblogs.microsoft.com/dotnet/dotnet-11-preview-6/)
- **Ngày**: Tue, 14 Jul 2026 17:45:00 +0000
- **Tóm tắt**: Find out about the new features in .NET 11 Preview 6 across runtime, SDK, libraries, ASP.NET Core, .NET MAUI, C#, Entity Framework Core, F#, and container images.
The post .NET 11 Preview 6 is now ava...
