---
name: merge-gate
description: Kiểm tra trước merge theo yêu cầu rõ ràng (on-demand) - review theo rubric D1-D10 và kiểm tra CI parity khi user cấp quyền.
---

# /merge-gate - Kiểm tra trước merge theo yêu cầu (On-Demand)

Chỉ kích hoạt khi user yêu cầu rõ ràng (`/merge-gate` hoặc yêu cầu review/kiểm tra trước merge).
Không tự động chặn hay tự động chạy sau mỗi task viết code thông thường.

## 1. Phạm vi và nguyên tắc

- **On-demand only**: Mặc định `main` nghiệm thu trực tiếp kết quả từ specialist bằng source evidence mà không tự động mở merge gate hay spawn agent review.
- **Read-only review**: Đối chiếu diff hiện tại với Rubric D1-D10 bên dưới và checklist tại `.agent/skills/code-reviewer/SKILL.md`. Chỉ spawn `reviewer` khi user yêu cầu rõ ràng hoặc phạm vi review độc lập được yêu cầu.
- **CI Parity (ON-DEMAND ONLY)**: Mặc định không chạy build/CI. Chỉ khi user yêu cầu đích danh kiểm tra CI/build (`run ci`, `build`, `verify`), chạy `.agent/scripts/ci-parity.sh` dưới role `verifier` hoặc `maintainer` (`AI_RULES.md` §2); guard R8 chặn build trực tiếp của main/worker.

## 2. Quy trình thực hiện khi được gọi

1. **Kiểm tra diff trên đĩa**: Xem `git diff --stat` và chi tiết vùng thay đổi, đối chiếu với Rubric D1-D10 bên dưới.
2. **Xử lý finding (nếu có quyền sửa)**: Nếu phát hiện lỗi trong phạm vi task đang mở và user cho phép sửa, điều phối specialist sở hữu sửa trực tiếp; nếu chỉ được yêu cầu review (`READ-ONLY INTENT`), trả danh sách finding kèm `<file>:<line>` và kịch bản hỏng cụ thể.
3. **Kiểm tra CI Parity (chỉ khi user yêu cầu rõ tên hành động)**:
   ```bash
   bash .agent/scripts/ci-parity.sh
   ```
   Script dùng cache fingerprint, chỉ kiểm tra target bị thay đổi (backend qua `fast-build.sh`, frontend qua `fast-check.sh`).
4. **Báo cáo kết quả**:
   - `pass`: Đạt các tiêu chí review D1-D10 (không ngụ ý đã chạy build/CI nếu user không yêu cầu validation; khi đó ghi `Validation: not run - not requested`).
   - `rework`: Có finding kỹ thuật cần xử lý kèm `<file>:<line>`.
   - `blocked-user`: Vướng mắc về nghiệp vụ, spec hoặc quyền thực thi cần user quyết định.

## 3. Rubric Review (D1-D10)

| # | Tiêu chí | Mức độ |
| --- | --- | --- |
| D1 | Toàn vẹn dữ liệu & tương thích hợp đồng/migration: không mất mát, không ghi dở dang, xử lý concurrency/retry an toàn | Blocker |
| D2 | Kỷ luật ranh giới & khớp hợp đồng BE ↔ FE: đúng `allowed_paths`, đúng schema/enum (`domain-parity`), không breaking API | Blocker |
| D3 | Tái sử dụng component/helper/hook sẵn có, không tự tạo convention thứ hai | Major |
| D4 | Không viết code đoán mò / fallback bịa đặt (`?? ''`, `x \|\| 0`, `as unknown as`, `catch {}`, fallback che lỗi) | Blocker |
| D5 | Đúng ranh giới kiến trúc (Clean Architecture, hook `BaseService`, không phụ thuộc vòng, không chạm DB service khác) | Major |
| D6 | Hiệu năng hợp lý: tránh N+1 query/request, tải dữ liệu có phân trang (`performance-decision-rules`) | Major |
| D7 | Invariant nghiệp vụ trọng yếu (tiền tệ, phân quyền, tồn kho, trạng thái workflow) được bảo toàn | Blocker |
| D8 | Xử lý lỗi tường minh: trả `Result.Failure(msg)` hoặc để TanStack Query/state lỗi xử lý, không nuốt exception | Major |
| D9 | Bảo mật, cấu hình, phân quyền endpoint/rate-limit và an toàn dữ liệu nhạy cảm | Blocker |
| D10 | Quản lý nợ kỹ thuật: bề mặt khó quay lui (schema DB, public contract, permission, tiền tệ) bắt buộc sửa ngay; vấn đề cục bộ ghi nhận vào `.planning/codebase/CONCERNS.md` | Minor |
