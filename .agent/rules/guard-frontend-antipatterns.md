---
trigger: glob
glob: "frontend/**/*.{ts,tsx}"
description: "Machine-checkable frontend anti-patterns (native number input, any, disabled exhaustive-deps, console.log, manual X-Employee-Id). Interrupts the edit and injects the fix."
condition:
  - '<input[^>]{0,200}type=["'']number["'']'
  - ':\s{0,3}any\b'
  - '\bas\s{1,3}any\b'
  - 'eslint-disable[^\n]{0,80}react-hooks/exhaustive-deps'
  - 'console\.log\('
  - '["'']X-Employee-Id["'']'
scope: "tool:edit(frontend/**/*.ts), tool:write(frontend/**/*.ts), tool:edit(frontend/**/*.tsx), tool:write(frontend/**/*.tsx)"
interruptMode: tool-only
---

# Guard: frontend anti-pattern

Code vừa viết khớp một mẫu bị cấm. Sửa trước khi viết tiếp:

| Mẫu | Luật nguồn | Cách sửa |
| --- | --- | --- |
| `<input type="number">` | `frontend.md` §5 | Dùng `NumericInput` từ `@shared/ui` |
| `: any`, `as any` | `frontend.md` mục tự rà lỗi | Khai báo type thật; lấy type từ `@shared/types` |
| `eslint-disable ... react-hooks/exhaustive-deps` | `frontend.md` mục tự rà lỗi | Sửa dependency array cho đủ và stable (`useCallback`/`useMemo`), không tắt rule |
| `console.log(` | `code-quality.md` §1 | Xoá trước khi bàn giao |
| Gán tay header `X-Employee-Id` | `frontend.md` §8 | Để interceptor của `api-client` tự gán |

Nếu đây là trường hợp hợp lệ, ghi rõ lý do trong báo cáo bàn giao.
