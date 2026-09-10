# Cogain Agent Entry

`AGENTS.md` là entry duy nhất; `CLAUDE.md`, `GEMINI.md`, `ANTIGRAVITY.md` là symlink của nó.
Đọc và áp dụng `AI_RULES.md` (luật) và `OPINION.md` (cách nghĩ khi luật im lặng) trước.
Rule miền trong `.agent/rules/` nạp theo trigger.

## Route

- `backend/**`, API, EF, gRPC, database, broker -> `backend-specialist`
- `frontend/**`, React, route, query, form, Tailwind -> `frontend-specialist`
- Cross-domain hoặc rủi ro cao -> `/orchestrate`

Vai trò và ranh giới ghi: `.agent/contracts/agent-registry.json`, cưỡng chế bằng `.agent/scripts/agent-boundary-guard.mjs`.
Wiring từng harness là symlink về `.agent/`: xem `.agent/harness/README.md`.
Catalog skill và workflow là động: đọc `.agent/SKILLS.md` và `.agent/workflows/README.md`, không chép danh sách vào file này.

## Context Policy

Đọc source đang sửa và test/pattern gần nhất trước. Chỉ nạp thêm khi nó đổi được quyết định:

| Trigger | Load |
| --- | --- |
| Module mới, chưa rõ convention | `STRUCTURE.md`, `CONVENTIONS.md` |
| Cross-service, auth, cache, broker, gRPC | `ARCHITECTURE.md`, `INTEGRATIONS.md` |
| Hành vi rủi ro hoặc liên module | `CONCERNS.md` |
| Triển khai một miền | 1 router + tối đa 2 skill đổi được quyết định |

Cấm mở service/module khác chỉ để xem "bên đó làm thế nào" khi ranh giới đó không lỗi; cần convention thì đọc rule.
Task Manifest và verifier độc lập chỉ dành cho governed work dưới `/orchestrate`.

## Workflow

Protocol nằm ở `.agent/workflows/<name>.md`.
Gặp `/plan`, `Run /test`, hay `workflow <name>`: đọc đúng file đó và coi nó là protocol của lượt; `AI_RULES.md` vẫn thắng khi xung đột.
Không có file thì nói rõ và liệt kê `.agent/workflows/README.md`.

## Session Policy

Không `git commit` trừ khi được yêu cầu rõ ràng.
Architecture mặc định QUICK ASK; mở rộng khi được yêu cầu hoặc khi quyết định có tác động lớn.
Mentor mode chỉ bật bằng `@mentor`.
Chạy test suite thuộc `verifier`, không thuộc agent triển khai: `.agent/rules/test-enforcement.md`.
