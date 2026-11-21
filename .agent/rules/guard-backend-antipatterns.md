---
description: "Machine-checkable backend anti-patterns (empty catch, ad-hoc 401/403/409, hardcoded secrets). Interrupts the edit and injects the fix."
condition:
  - 'catch\s{0,5}(\([^)]{0,200}\))?\s{0,5}\{\s{0,5}\}'
  - '\b(Unauthorized|Forbid|Conflict)\s{0,3}\('
  - 'StatusCode\(\s{0,3}(401|403|409)\b'
  - '(?i)(password|secret|api_?key|access_?token)\s{0,3}=\s{0,3}"[^"\s]{8,}"'
scope: "tool:edit(backend/**/*.cs), tool:write(backend/**/*.cs)"
interruptMode: tool-only
---

# Guard: backend anti-pattern

Code vừa viết khớp một mẫu bị cấm. Sửa trước khi viết tiếp:

| Mẫu | Luật nguồn | Cách sửa |
| --- | --- | --- |
| `catch { }` hoặc `catch (Exception) { }` rỗng | `business.md` §6 | Log đủ context qua `ILogger` rồi trả `Result.Failure(msg)` hoặc để lỗi đi lên; không nuốt lỗi |
| `Unauthorized(...)`, `Forbid(...)`, `Conflict(...)`, `StatusCode(401/403/409)` cho lỗi nghiệp vụ | `backend.md` mục chuẩn trả về | Lỗi nghiệp vụ dùng `400 BadRequest` qua `Result.Failure(msg)`; 401/403 chỉ thuộc tầng auth/permission có sẵn |
| Gán chuỗi cứng cho `password`/`secret`/`apiKey`/`accessToken` | `backend.md` Guardrails, `security-compliance.md` | Đọc từ configuration/secret store; không để secret trong code |

Nếu đây là trường hợp hợp lệ (ví dụ middleware auth có sẵn trả 401), ghi rõ lý do trong báo cáo bàn giao.
