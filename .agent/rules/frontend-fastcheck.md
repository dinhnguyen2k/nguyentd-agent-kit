---
trigger: model_decision
description: "When validating frontend changes, choosing between quick/full check, running or modifying frontend/fast-check.sh, or reporting frontend build results."
---

# FRONTEND-FASTCHECK.MD - Cổng Validation Frontend

> Tách từ `.agent/rules/frontend.md` mục 12.3 để không nạp vào mọi lần chạm file frontend.

Công cụ bắt buộc: `./frontend/fast-check.sh` (script local-only, nằm trong
`.git/info/exclude`, vô hình với Git và DevOps).

Tuyệt đối KHÔNG chạy `pnpm --filter <app> build` trực tiếp sau mỗi thay đổi nhỏ ở
local: nó chạy tsc cold + bundling production, rất nặng.

## Nấc 1 - Quick Mode

`./frontend/fast-check.sh <app> --quick` - đo thực tế **~5s** (tận dụng TypeScript
incremental cache). Đây là chế độ MẶC ĐỊNH trong lúc làm việc.

Giới hạn: CHỈ bắt lỗi type. Không bắt được import CSS/asset sai đường dẫn, CJS/ESM
export mismatch, hay lỗi resolve của TanStack Router. Đó là lỗi tầng Rollup, tsc mù
hoàn toàn.

## Nấc 2 - Full Mode (BẮT BUỘC trước khi báo cáo xong)

`./frontend/fast-check.sh <app>` (generate:routes + typecheck + vite build).

Thời gian phụ thuộc mạnh vào từng app: `erp` ~25s, `interactive` ~59s, lần build đầu
khi cache Vite còn nguội có thể lên ~112s. Đừng hứa với user một con số cố định; app
lớn thì chạy nền (`run_in_background`).

Đây là chốt chặn duy nhất bắt được lỗi import/CSS/asset/dynamic-import của Vite.
KHÔNG được báo "đã xong" nếu mới chỉ chạy `--quick`.

## Sửa shared hoặc trước khi push

`./frontend/fast-check.sh --all --quick` (song song toàn bộ 7 apps trên nhiều nhân
CPU). Bỏ `--quick` nếu muốn full build toàn bộ apps, chậm hơn đáng kể.

## Ghi chú kỹ thuật (đừng "tối ưu" ngược lại)

- `--incremental` truyền qua CLI, KHÔNG sửa `tsconfig.app.json` (file này Git đang
  theo dõi). `tsBuildInfoFile` đã có sẵn trong config nên cache hoạt động ngay.
- Vite build trong script chạy `--minify false` và ghi ra
  `node_modules/.tmp/fastcheck-dist`, nên KHÔNG đè `dist/` production và không làm
  bẩn git status. Bỏ minify không giảm khả năng bắt lỗi vì lỗi import/CSS/route xảy
  ra ở khâu resolve + bundle, trước minify.
- Log tsc/vite bị nuốt, chỉ in khi FAIL (warning của `@tanstack/router-plugin` rất
  ồn, ~87KB mỗi lần build). Khi PASS output chỉ còn vài dòng.
