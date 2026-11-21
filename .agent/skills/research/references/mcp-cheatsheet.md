# Bảng Tra Nhanh Tham Số MCP (Chống Tốn Lượt Đọc Schema Tải Lười)

Dùng trực tiếp các mẫu tham số chuẩn dưới đây với `call_mcp_tool` mà không cần mở đọc từng tệp `.json` mô tả schema của MCP server.

## 1. MCP `lsp` (Đồ thị ngữ nghĩa C# / TypeScript)

- **Kiểm tra chẩn đoán tĩnh 1 tệp (`get_diagnostics`)**:
  - `ServerName`: `"lsp"`, `ToolName`: `"get_diagnostics"`, `Arguments`: `{ "file_path": "<đường_dẫn_tuyệt_đối>" }`.
- **Tìm định nghĩa / tham chiếu / bản cài đặt (`find_definition` | `find_references` | `find_implementation` | `get_incoming_calls`)**:
  - `ServerName`: `"lsp"`, `ToolName`: `"find_references"`, `Arguments`: `{ "file_path": "<đường_dẫn_tuyệt_đối>", "symbol_name": "<TênHàmHoặcKiểu>" }` (có thể kèm `"line": <số_dòng_1_based>` khi trùng tên).
- **Quy tắc thực chiến C# Roslyn (`csharp-ls`)**:
  - Lần gọi đầu tiên khi máy chủ vừa nạp `backend/Cogain.Lsp.slnf` có thể mất 30-60 giây làm ấm; các lượt sau phản hồi trong 4-20 giây.
  - **Không** gọi `find_references` trực tiếp vào tên generic interface (`ISyncsChildren`); luôn gọi vào **tên method thành viên phi-generic** (`SyncChildren`, `BuildIncomingGraph`) để lấy đủ 100% điểm tham chiếu toàn workspace.
  - Nếu cầu chì LSP đang mở (`[lsp-circuit-open]`) hoặc quá hạn, dừng ngay không thử lại và chuyển sang đọc/tìm văn bản tĩnh.

## 2. MCP `context7` (Tài liệu chính thức theo phiên bản)

1. **Bước 1 - Phân giải ID thư viện (`resolve-library-id`)**:
   - `ServerName`: `"context7"`, `ToolName`: `"resolve-library-id"`, `Arguments`: `{ "libraryName": "efcore", "query": "EF Core 8 change tracking owned collections" }`.
2. **Bước 2 - Truy vấn tài liệu (`query-docs`)**:
   - `ServerName`: `"context7"`, `ToolName`: `"query-docs"`, `Arguments`: `{ "libraryId": "/dotnet/entityframework.docs", "query": "global query filters soft delete navigation fixup" }`.

## 3. MCP `filesystem` & Quy tắc chống tràn bộ đệm (`> 10KB`)

- `filesystem` (`search_files` với `{ "path": "<thư_mục>", "pattern": "*Overtime*" }`) **chỉ khớp tên tệp**, không tìm chuỗi bên trong nội dung mã nguồn.
- Để tìm nội dung chuỗi nhanh nhất: dùng công cụ `Grep` nội tại (trên Claude/OMP/App) hoặc `rg -n "<mẫu>" <thư_mục>` chỉ đọc (khi runtime cấp lệnh đọc).
- **Tránh bẫy tràn bộ đệm**: Không gọi `filesystem:directory_tree` trên thư mục gốc và không gộp đọc quá 4 tệp lớn trong `filesystem:read_multiple_files`, vì đầu ra vượt `~10-20KB` sẽ bị ghi tràn ra tệp tạm khiến tốn gấp đôi lượt đọc lại. Luôn đọc khoanh vùng theo `StartLine` / `EndLine` (`<= 400` dòng mỗi đoạn khi đã biết vị trí).
