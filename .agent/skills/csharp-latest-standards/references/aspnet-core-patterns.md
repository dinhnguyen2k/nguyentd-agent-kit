# ASP.NET Core API Design & Architecture Patterns
<!-- last_synced: 2026-07-31 -->

> **Tự động cập nhật**: 2026-07-31 11:03:23
> **Nguồn**: [Microsoft ASP.NET Core Docs](https://learn.microsoft.com/aspnet/core/)

---

## 📌 Cogain BaseController Rules
- **Route Convention**: `api/v{version:apiVersion}/[controller]`
- **Authorization**: Yêu cầu thuộc tính `[Authorize]` trên Controller.
- **Standard Response**: Dùng `ApiResponse<T>` chuẩn hóa kết quả và mã lỗi.
- **Built-in CRUD**: Tận dụng endpoint CRUD từ `BaseController<>`. Chỉ bổ sung endpoint custom.

---

## 📰 Bài Viết Mới Nhất về ASP.NET Core

### 1. [Announcing .NET Modernization for Beginners](https://devblogs.microsoft.com/dotnet/announcing-dotnet-modernization-for-beginners/)
- **Ngày**: Thu, 16 Jul 2026 17:07:06 +0000
- **Tóm tắt**: A free, open-source, hands-on course that walks you through modernizing a real legacy ASP.NET application all the way to .NET 10 using the GitHub Copilot modernization agent, step by step.
The post An...

### 2. [.NET 11 Preview 6 is now available!](https://devblogs.microsoft.com/dotnet/dotnet-11-preview-6/)
- **Ngày**: Tue, 14 Jul 2026 17:45:00 +0000
- **Tóm tắt**: Find out about the new features in .NET 11 Preview 6 across runtime, SDK, libraries, ASP.NET Core, .NET MAUI, C#, Entity Framework Core, F#, and container images.
The post .NET 11 Preview 6 is now ava...
