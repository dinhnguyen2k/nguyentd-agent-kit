---
trigger: glob
glob: "**/*.{php,js,ts}"
description: "Machine-checkable guessed code (literal || fallbacks, chained ??, catch returning defaults, empty try/catch, placeholders). Interrupts the edit for every agent."
condition:
  - '\|\|\s{0,3}(0|''''|""|``|\[\]|\{\}|null|false)(?:\s|$|[;,)\]}])'
  - '\?\?[^;\n]{1,80}?\?\?'
  - 'catch\s{0,5}(\([^)]{0,200}\))?\s{0,5}\{\s{0,5}return\s{1,3}(null|false|0|\[\]|''''|"")'
  - 'catch\s{0,5}(\([^)]{0,200}\))?\s{0,5}\{\s{0,5}\}'
  - '(?i:\b(TODO|FIXME)\b[^\n]{0,40}\b(implement|later|placeholder|mock|fake))'
scope: "tool:edit(**/*.php), tool:write(**/*.php), tool:edit(**/*.js), tool:write(**/*.js)"
interruptMode: tool-only
---

# Guard: code đoán

Code vừa viết khớp mẫu thường dùng để che chỗ chưa xác định được (schema database, key mảng, nullability, giá trị, nghiệp vụ).
Rule này áp cho mọi agent, kể cả main, `task`, `sonic`.

| Mẫu | Vì sao sai | Cách sửa |
| --- | --- | --- |
| `$x \|\| 0`, `$x \|\| ''`, `$x \|\| []` | Đoán giá trị mặc định; `\|\|` còn nuốt `0`, `''`, `false` hợp lệ | Đọc schema/mảng thật; field không null thì dùng thẳng; nullable thì xử lý theo nghiệp vụ, dùng `??` chỉ khi spec/code có sẵn quy định giá trị mặc định |
| `$a['items'] ?? $b['items'] ?? []`, `$x['id'] ?? $x['Id'] ?? $x['code']` | Đoán shape array/response bằng nhiều ứng viên | Đọc schema DB/cấu trúc array thật, dùng đúng một key có thật |
| `catch (Exception $e) { return null/[]/false; }`, `catch (Throwable $e) {}` | Nuốt lỗi, trả dữ liệu giả cho caller hoặc đưa UI về trạng thái "không có dữ liệu" giống hệt trường hợp thật sự trống | Ghi log `error_log($e->getMessage())` và rethrow hoặc trả thông điệp lỗi rõ ràng cho caller; tuyệt đối không nuốt lỗi âm thầm |
| `TODO: implement`, `// Tạm thời return rỗng` | Placeholder trong code production | Làm thật, hoặc dừng và ghi phần còn thiếu trong báo cáo bàn giao |

Không xác định được schema cột, key của array hay quy tắc nghiệp vụ thì đọc nguồn trước; đọc rồi vẫn không rõ thì dừng phần đó và ghi `Cần main quyết định` (subagent) hoặc hỏi user bằng `ask` (main), không viết code đoán.
Trường hợp hợp lệ (biểu thức boolean, key mảng có thể không tồn tại và spec quy định giá trị fallback cụ thể): ghi `<file>:<line>` làm nguồn trong báo cáo bàn giao.
