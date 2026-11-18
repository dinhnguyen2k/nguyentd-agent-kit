---
trigger: glob
glob: "**/*.{cs,ts,tsx}"
description: "Machine-checkable guessed code (literal || fallbacks, chained ??, as unknown as, non-null !., catch returning defaults, FirstOrDefault ?? new, placeholders). Interrupts the edit for every agent."
condition:
  - '\|\|\s{0,3}(0|''''|""|``|\[\]|\{\}|null|undefined|false|''[^''\n]{1,30}''|"[^"\n]{1,30}")(?:\s|$|[;,)\]}])'
  - '\?\?[^;\n]{1,80}?\?\?'
  - '\bas\s{1,3}unknown\s{1,3}as\b'
  - '[\w)\]]!\.\w'
  - 'catch\s{0,5}(\([^)]{0,200}\))?\s{0,5}\{\s{0,5}return\s{1,3}(null|undefined|default|false|0|\[\]|\{\}|''''|""|string\.Empty|new\b|Enumerable\.Empty)'
  - '\.catch\(\s{0,3}\([^)]{0,50}\)\s{0,3}=>\s{0,3}(null|undefined|\[\]|\{\}|''''|""|0|false)'
  - 'catch\s{0,5}(\([^)]{0,200}\))?\s{0,5}\{\s{0,5}\}'
  - 'catch\s{0,5}(\([^)]{0,200}\))?\s{0,5}\{[^}]{0,80}\bset[A-Z]\w{0,40}\(\s{0,3}(null|undefined|\[\]|\{\}|''''|""|false)\s{0,3}\)'
  - 'OrDefault(Async)?\([^;]{0,200}\)\s{0,3}\?\?\s{0,3}new\b'
  - 'NotImplementedException|(?i:\b(TODO|FIXME)\b[^\n]{0,40}\b(implement|later|placeholder|mock|fake))'
scope: "tool:edit(backend/**/*.cs), tool:write(backend/**/*.cs), tool:edit(frontend/**/*.ts), tool:write(frontend/**/*.ts), tool:edit(frontend/**/*.tsx), tool:write(frontend/**/*.tsx)"
interruptMode: tool-only
---

# Guard: code đoán

Code vừa viết khớp mẫu thường dùng để che chỗ chưa xác định được (shape, nullability, giá trị, nghiệp vụ).
Rule này áp cho mọi agent, kể cả main, `task`, `sonic`.

| Mẫu | Vì sao sai | Cách sửa |
| --- | --- | --- |
| `x \|\| 0`, `x \|\| ''`, `x \|\| []`, `x \|\| 'N/A'` | Đoán giá trị mặc định; `\|\|` còn nuốt `0`, `''`, `false` hợp lệ | Đọc DTO/type thật; field không nullable thì dùng thẳng; nullable thì xử lý theo nghiệp vụ, dùng `??` chỉ khi spec/code có sẵn quy định giá trị mặc định |
| `a.items \|\| b.items \|\| []`, `x.id ?? x.Id ?? x.code` | Đoán shape response bằng nhiều ứng viên | Đọc contract API/DTO, dùng đúng một field có thật |
| `as unknown as T`, `x!.y` | Ép type để code chạy qua chỗ chưa hiểu | Sửa type nguồn hoặc kiểm tra null tường minh |
| `catch { return null/[]/default; }`, `.catch(() => [])`, `catch {}`, `catch { setX(null) }` | Nuốt lỗi, trả dữ liệu giả cho caller hoặc đưa UI về trạng thái "không có dữ liệu" giống hệt trường hợp thật sự trống | Để lỗi đi lên hoặc trả `Result.Failure(msg)`; frontend để TanStack Query xử lý lỗi, hoặc giữ cờ `isError` và hiển thị trạng thái lỗi riêng |
| `FirstOrDefault(...) ?? new T()` | Tạo entity giả khi không tìm thấy | Không tìm thấy thì trả lỗi nghiệp vụ rõ ràng |
| `NotImplementedException`, `TODO: implement` | Placeholder trong code production | Làm thật, hoặc dừng và ghi phần còn thiếu trong báo cáo bàn giao |

Không xác định được shape, nullability hay quy tắc thì đọc nguồn trước; đọc rồi vẫn không rõ thì dừng phần đó và ghi `Cần main quyết định` (subagent) hoặc hỏi user bằng `ask` (main), không viết code đoán.
Trường hợp hợp lệ (biểu thức boolean, type khai báo nullable và spec quy định mặc định): ghi `<file>:<line>` làm nguồn trong báo cáo bàn giao.
