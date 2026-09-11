---
trigger: model_decision
description: "When validating frontend changes, choosing between quick/full check, running or modifying frontend/fast-check.sh, or reporting frontend build results."
---

# FRONTEND-FASTCHECK.MD - ON-DEMAND ONLY

> Tách từ `.agent/rules/frontend.md` mục 12.3 để không nạp vào mọi lần chạm file frontend.

`./frontend/fast-check.sh` is optional and local-only.

**DO NOT RUN THIS SCRIPT AUTOMATICALLY. ON-DEMAND ONLY.**

- Run it only when the user explicitly requests frontend typecheck or build validation.
- An agent, skill, workflow, handoff checklist, governed task, or changed route/shared
  file must not activate it by inference.
- Always pass the target app explicitly. Do not infer scope from the dirty worktree.
- Do not use `--all` unless the user explicitly requests all frontend apps.
- **IDEMPOTENT:** do not repeat the same mode for unchanged relevant inputs.

## Nấc 1 - Quick Mode

`./frontend/fast-check.sh <app> --quick` - incremental TypeScript typecheck.

Giới hạn: CHỈ bắt lỗi type. Không bắt được import CSS/asset sai đường dẫn, CJS/ESM
export mismatch, hay lỗi resolve của TanStack Router. Đó là lỗi tầng Rollup, tsc mù
hoàn toàn.

## Nấc 2 - Full Mode

`./frontend/fast-check.sh <app>` (typecheck + Vite build).

Chỉ dùng full mode khi người dùng yêu cầu build/validation có kiểm tra import, CSS,
asset hoặc module resolution. Thời gian phụ thuộc mạnh vào từng app: `erp` ~25s,
`interactive` ~59s, lần build đầu khi cache Vite còn nguội có thể lên ~112s.

Full mode bắt được lỗi import/CSS/asset/dynamic-import của Vite. Nó không phải điều
kiện để báo implementation đã hoàn tất.

## Route Generation

`./frontend/fast-check.sh <app> --routes` chỉ dùng khi route tree hoặc router config
thay đổi và người dùng yêu cầu validation. `--quick` không tự generate routes.

`--all` là lựa chọn explicit cho người dùng. Agent không tự dùng `--all` vì thay đổi
shared hoặc vì không xác định được target app.

## Ghi chú kỹ thuật (đừng "tối ưu" ngược lại)

- `--incremental` truyền qua CLI, KHÔNG sửa `tsconfig.app.json` (file này Git đang
  theo dõi). `tsBuildInfoFile` đã có sẵn trong config nên cache hoạt động ngay.
- Vite build trong script chạy `--minify false` và ghi ra
  `node_modules/.tmp/fastcheck-dist`, nên KHÔNG đè `dist/` production và không làm
  bẩn git status. Bỏ minify không giảm khả năng bắt lỗi vì lỗi import/CSS/route xảy
  ra ở khâu resolve + bundle, trước minify.
- Log tsc/vite bị nuốt, chỉ in khi FAIL (warning của `@tanstack/router-plugin` rất
  ồn, ~87KB mỗi lần build). Khi PASS output chỉ còn vài dòng.
