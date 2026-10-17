# Modern C# Language Features (C# 12 → 14)
<!-- last_synced: 2026-07-31 -->

> **Tự động cập nhật**: 2026-07-31 11:03:22
> **Nguồn**: [Microsoft Learn — What's new in C#](https://learn.microsoft.com/dotnet/csharp/whats-new/)

---

## 🚀 C# 12 Key Features
- **Primary Constructors**: `public class Service(ILogger logger)` (Không dùng cho `BaseService` con).
- **Collection Expressions**: `int[] arr = [1, 2, 3];` và spread operator `[..listA, ..listB]`.
- **Ref Readonly Parameters**: Tối ưu hiệu năng truyền tham số struct lớn.

## 🚀 C# 13 Key Features
- **`params` Collections**: Hỗ trợ `params IEnumerable<T>` và `params ReadOnlySpan<T>`.
- **New Lock Object**: `System.Threading.Lock` giúp khóa luồng nhanh và an toàn hơn.
- **Field-backed properties preview**: Bắt đầu thử nghiệm từ khóa `field`.

## 🚀 C# 14 Key Features (Preview)
- **`field` Keyword**: Truy cập trực tiếp backing field trong property accessor.
- **`?.=` Null-conditional Assignment**: Gán giá trị an toàn khi target không null.
- **Extension Members**: Định nghĩa extension properties và operators.

---

## 📰 Tin Tức & Bài Viết Mới về Ngôn Ngữ C#

### 1. [Announcing v2.0 of the official MCP C# SDK](https://devblogs.microsoft.com/dotnet/announcing-v20-of-the-official-mcp-csharp-sdk/)
- **Ngày**: Tue, 28 Jul 2026 22:00:00 +0000
- **Tóm tắt**: MCP C# SDK v2.0 implements the 2026-07-28 specification with a stateless-first protocol, standardized HTTP headers, and Multi Round-Trip Requests for interactive tools, all while staying backward comp...

### 2. [.NET 11 Preview 6 is now available!](https://devblogs.microsoft.com/dotnet/dotnet-11-preview-6/)
- **Ngày**: Tue, 14 Jul 2026 17:45:00 +0000
- **Tóm tắt**: Find out about the new features in .NET 11 Preview 6 across runtime, SDK, libraries, ASP.NET Core, .NET MAUI, C#, Entity Framework Core, F#, and container images.
The post .NET 11 Preview 6 is now ava...

### 3. [.NET 11 Preview 5 is now available!](https://devblogs.microsoft.com/dotnet/dotnet-11-preview-5/)
- **Ngày**: Tue, 09 Jun 2026 18:30:00 +0000
- **Tóm tắt**: Find out about the new features in .NET 11 Preview 5 across the .NET runtime, SDK, libraries, ASP.NET Core, .NET MAUI, C#, Entity Framework Core, and more!
The post .NET 11 Preview 5 is now available!...

### 4. [.NET at Microsoft Build 2026: Must watch sessions](https://devblogs.microsoft.com/dotnet/dotnet-at-microsoft-build-2026/)
- **Ngày**: Mon, 08 Jun 2026 17:15:00 +0000
- **Tóm tắt**: Catch up on all the .NET sessions from Microsoft Build 2026 covering .NET 11, union types in C#, AI building blocks, the agentic web, .NET MAUI, and more!
The post .NET at Microsoft Build 2026: Must w...

### 5. [Improving C# Memory Safety](https://devblogs.microsoft.com/dotnet/improving-csharp-memory-safety/)
- **Ngày**: Thu, 21 May 2026 16:08:00 +0000
- **Tóm tắt**: The `unsafe` keyword is being redesigned to mark caller-facing contracts rather than just syntax. Safety obligations between callers and callees become visible and reviewable. The model is motivated b...

### 6. [.NET 11 Preview 4 is now available!](https://devblogs.microsoft.com/dotnet/dotnet-11-preview-4/)
- **Ngày**: Tue, 12 May 2026 22:25:49 +0000
- **Tóm tắt**: Find out about the new features in .NET 11 Preview 4 across the .NET runtime, SDK, libraries, ASP.NET Core, .NET MAUI, C#, Entity Framework Core, and more!
The post .NET 11 Preview 4 is now available!...
