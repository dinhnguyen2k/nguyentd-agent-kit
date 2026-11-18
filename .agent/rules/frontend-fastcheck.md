---
trigger: model_decision
description: "When validating frontend changes, choosing between quick/full check, running or modifying frontend/fast-check.sh, or reporting frontend build results."
---

# FRONTEND-FASTCHECK.MD - ON-DEMAND ONLY

> Tách từ `.agent/rules/frontend.md` mục 12.3 để không nạp vào mọi lần chạm file frontend.

`./frontend/fast-check.sh` is optional and local-only.

**DO NOT RUN THIS SCRIPT AUTOMATICALLY. ON-DEMAND ONLY.**

Khi user yêu cầu kiểm tra CI/build, `.agent/scripts/ci-parity.sh` (dưới role `verifier`/`maintainer` theo `AI_RULES.md` §2) gọi script này và suy target từ diff theo rule `changes:` của CI.
Agent triển khai gọi trực tiếp bị guard R8 chặn; user muốn tự kiểm thì chạy trong terminal hoặc mở role `verifier`.

- Run it only when the user explicitly requests frontend typecheck or build validation.
- An agent, skill, workflow, handoff checklist, governed task, or changed route/shared
  file must not activate it by inference.
- Always pass the target app explicitly. Do not infer scope from the dirty worktree.
- Do not use `--all` unless the user explicitly requests all frontend apps.
- **IDEMPOTENT:** do not repeat the same mode for unchanged relevant inputs.

## Nấc 1 - Quick Mode

`./frontend/fast-check.sh <app> --quick` - typecheck bằng `tsgo` (mặc định) hoặc `tsc --incremental` khi thêm `--tsc`.

- Mặc định dùng `tsgo` (`@typescript/native-preview`, bản preview TypeScript 7), ghim version trong biến `TSGO_CMD`, chạy qua `pnpm dlx`, không có trong `package.json`.
- Đo bizdoc 2026-11-16: `tsgo` 24s so với `tsc` 2:22, cùng 0 lỗi; RAM ~4,25 GB mỗi app nên `--all` chạy tuần tự.
- CI vẫn chạy `tsc -b`, là kết quả chính thức. Kết quả `tsgo` lệch CI thì chạy lại với `--tsc` để đối chiếu.

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

## LSP không thay được build

- Script `build` của app chạy `tsc -b` rồi mới `vite build`; Vite (esbuild) không kiểm type, nên chạy riêng `vite build` không tái hiện được lỗi TS.
- Khi user báo lỗi build và cho phép chạy, dùng `--quick` cho lỗi type, full mode khi lỗi ở tầng Vite/Rollup.
- LSP chỉ kiểm file được mở, không thấy file không ai mở (ví dụ `__tests__`) mà `tsc -b` vẫn kiểm.
- Diagnostics LSP theo glob chỉ chờ ~400ms mỗi file, single-file ~10s; kết quả `OK`/`no issues` lúc server còn nạp project không phải bằng chứng sạch. Kiểm từng file và kiểm lại khi lần đầu trả `OK` ngay sau khởi động.

## Route Generation

`./frontend/fast-check.sh <app> --routes` chỉ dùng khi route tree hoặc router config
thay đổi và người dùng yêu cầu validation. `--quick` không tự generate routes.

`--all` là lựa chọn explicit cho người dùng. Agent không tự dùng `--all` vì thay đổi
shared hoặc vì không xác định được target app.

## Ghi chú kỹ thuật (đừng "tối ưu" ngược lại)

- `--incremental` của nhánh `--tsc` truyền qua CLI, KHÔNG sửa `tsconfig.app.json` (file này Git đang
  theo dõi). `tsBuildInfoFile` đã có sẵn trong config nên cache hoạt động ngay.
- Nhánh `tsgo` chạy `--incremental false` (đúng lệnh đã đo), không dùng chung `tsbuildinfo` với `tsc`.
- Vite build trong script chạy `--minify false` và ghi ra
  `node_modules/.tmp/fastcheck-dist`, nên KHÔNG đè `dist/` production và không làm
  bẩn git status. Bỏ minify không giảm khả năng bắt lỗi vì lỗi import/CSS/route xảy
  ra ở khâu resolve + bundle, trước minify.
- Log tsc/vite bị nuốt, chỉ in khi FAIL (warning của `@tanstack/router-plugin` rất
  ồn, ~87KB mỗi lần build). Khi PASS output chỉ còn vài dòng.
