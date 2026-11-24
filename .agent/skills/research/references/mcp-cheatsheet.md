# Bảng Tra Nhanh Tham Số MCP (Chống Tốn Lượt Đọc Schema Tải Lười)

Dùng trực tiếp các mẫu tham số chuẩn dưới đây với `call_mcp_tool` mà không cần mở đọc từng tệp `.json` mô tả schema của MCP server.

## 1. MCP `lsp` & `cogain-lsp` CLI (Shared Warm LSP Daemon: `tsgo` + `csharp-ls`)

- **Kiểm tra chẩn đoán tĩnh 1 tệp (`get_diagnostics`)**:
  - `ServerName`: `"lsp"`, `ToolName`: `"get_diagnostics"`, `Arguments`: `{ "file_path": "<đường_dẫn_tuyệt_đối>" }`.
  - Trong `swarm` hoặc shell nhanh: `cogain-lsp check <file1> [file2...]` (đồng bộ trực tiếp nội dung mới nhất trên đĩa, phản hồi mili-giây với `tsgo`).
- **Tìm định nghĩa / tham chiếu / bản cài đặt (`find_definition` | `find_references` | `find_implementation` | `get_incoming_calls`)**:
  - `ServerName`: `"lsp"`, `ToolName`: `"find_references"`, `Arguments`: `{ "file_path": "<đường_dẫn_tuyệt_đối>", "symbol_name": "<TênHàmHoặcKiểu>" }` (có thể kèm `"line": <số_dòng_1_based>`).
  - Trong `swarm` hoặc shell nhanh: `cogain-lsp def|refs <file> <symbol> [line]`.
- **Quy tắc thực chiến C# Roslyn (`csharp-ls`) & TS (`tsgo`)**:
  - Shared Warm Daemon giữ ấm sẵn `tsgo --lsp` (TS/TSX) và `csharp-ls` (`backend/Cogain.Lsp.slnf`), tự đồng bộ `didChange` theo `sha1` trên đĩa trước mọi truy vấn nên không bị trả cache cũ sau `edit_file`.
  - **Không** gọi `find_references` trực tiếp vào tên generic interface (`IAggregateRoot<TSelf>`); luôn gọi vào **tên member phi-generic** (`Shape`, `BuildIncomingGraph`) để lấy đủ 100% điểm tham chiếu toàn workspace.
  - Cầu chì `diagnostics` (`csharp`/`typescript`) tách riêng khỏi cầu chì tra cứu (`csharp-nav`/`typescript-nav`): nếu kiểm lỗi bị mở cầu chì (`[lsp-circuit-open]`), vẫn tra cứu symbol bình thường và chuyển phần kiểm lỗi sang đối chiếu tĩnh.

## 2. MCP `context7` (Tài liệu chính thức theo phiên bản)

1. **Bước 1 - Phân giải ID thư viện (`resolve-library-id`)**:
   - `ServerName`: `"context7"`, `ToolName`: `"resolve-library-id"`, `Arguments`: `{ "libraryName": "efcore", "query": "EF Core 8 change tracking owned collections" }`.
2. **Bước 2 - Truy vấn tài liệu (`query-docs`)**:
   - `ServerName`: `"context7"`, `ToolName`: `"query-docs"`, `Arguments`: `{ "libraryId": "/dotnet/entityframework.docs", "query": "global query filters soft delete navigation fixup" }`.

## 3. MCP `filesystem` & Quy tắc chống tràn bộ đệm (`> 10KB`)

- `filesystem` (`search_files` với `{ "path": "<thư_mục>", "pattern": "*Overtime*" }`) **chỉ khớp tên tệp**, không tìm chuỗi bên trong nội dung mã nguồn.
- Để tìm nội dung chuỗi nhanh nhất: dùng công cụ `Grep` nội tại (trên Claude/OMP/App) hoặc `rg -n "<mẫu>" <thư_mục>` chỉ đọc (khi runtime cấp lệnh đọc).
- **Tránh bẫy tràn bộ đệm**: Không gọi `filesystem:directory_tree` trên thư mục gốc và không gộp đọc quá 4 tệp lớn trong `filesystem:read_multiple_files`, vì đầu ra vượt `~10-20KB` sẽ bị ghi tràn ra tệp tạm khiến tốn gấp đôi lượt đọc lại. Luôn đọc khoanh vùng theo `StartLine` / `EndLine` (`<= 400` dòng mỗi đoạn khi đã biết vị trí).
