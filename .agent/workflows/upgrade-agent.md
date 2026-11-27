---
name: upgrade-agent
description: Quy trình 6 bước chuẩn cho Phiên Nâng Cấp Hệ Thống Agent Riêng, chuyển hóa ma sát thực chiến thành guard/exemplar và tỉa gọn tài liệu.
---

# /upgrade-agent - Chu Trình Chống Outmeta

$ARGUMENTS

Chỉ chạy trong **Phiên Nâng Cấp Hệ Thống Agent Riêng** khi người dùng yêu cầu nâng cấp `.agent/`, rule, skill hoặc harness.
Phiên làm tính năng thường (Luồng 1) KHÔNG sửa `.agent/**`; mọi ma sát gặp phải chỉ ghi vào `.agent/reports/agent-friction.jsonl` để xử lý tập trung ở phiên này.

Trong workspace cô lập của `agent-updater`, dùng quyền phiên đã cấp và chỉ đối chiếu các nguồn nối liên kết.
Không dọn state/log, cài wiring, đồng bộ Agent Kit hay đổi quyền phiên từ workspace này; chạy kiểm tra catalog và ghi `UPGRADE_SUMMARY.json` theo yêu cầu của công cụ.

## Quy Trình 6 Bước Chuẩn

1. **Mở quyền `maintainer` (tạm thời trong phiên bảo trì)**:
   - Người dùng mở cổng: `.agent/scripts/agent-role.sh maintainer` (hoặc cấp quyền `maintainer` cho phiên nâng cấp).
2. **Dọn rác quá 10 ngày, tổng hợp ma sát & kiểm toán độ trôi 3 chiều**:
   - Chạy `node .agent/scripts/prune-agent-state.mjs --days 10` để dọn sạch phân tích, plan và log quá 10 ngày (giữ nguyên `.planning/codebase/` và `.planning/errors/ERRORS.md`).
   - Chạy `node .agent/scripts/summarize-friction.mjs` để đọc `.agent/reports/agent-friction.jsonl`, `.agent/reports/boundary-guard.log` và `enforcement.allowlist` trong `.agent/contracts/agent-registry.json`.
   - Rà soát độ trôi giữa **Code thực tế ↔ Tài liệu/Rule/Skill ↔ Khuôn mẫu** (`.agent/contracts/archetype-exemplars.json`): xử lý allowlist đã/sắp hết hạn `expires_at`, rule bị nghi chặn nhầm và tài liệu lỗi thời.
   - Báo cáo ma sát gồm cả log lịch sử: đối chiếu ngày, mã hiện tại và mẫu hồi quy trước khi sửa luật.
   - Với ca đọc bị báo là ghi, xác định harness, tên công cụ và đối số đã khử bí mật để kiểm tra lớp ánh xạ; riêng đường dẫn trong log `DENY` không đủ căn cứ để nới quyền.
3. **Chuyển xuống Code & Tỉa bớt Chữ**:
   - Đưa các lỗi cú pháp/tĩnh lặp lại (regex/AST/path) xuống `R10` trong `.agent/contracts/agent-registry.json` và `.agent/scripts/agent-boundary-guard.mjs`.
   - Bắt buộc bổ sung cặp mẫu đúng (`valid`) và mẫu sai (`invalid`) vào `.agent/evals/guard-fixtures.json` rồi kiểm nhanh bằng `--sandbox`.
   - Tỉa gọn prose trùng lặp trong `SKILL.md` / `rules/` / `agents/`, chỉ giữ tham chiếu ngắn tới `R10` hoặc `archetype-exemplars.json`, bảo đảm dưới ngưỡng `.agent/contracts/context-budget.json`.
4. **Kiểm tra toàn hệ thống & đồng bộ catalog**:
   - Chạy `node .agent/scripts/validate-agent-system.mjs --write-catalog` (xác nhận `0 error(s)`, kiểm đủ `guard-fixtures.json`, `allowlist`, `archetype-exemplars.json` và `context-budget.json`).
5. **Đồng bộ wiring harness, worktree & kho Agent Kit**:
   - Chạy `bash .agent/scripts/install-harness-wiring.sh` và `COGAIN_AGENT_ROLE=maintainer python3 .agent/scripts/treehouse_harness.py --all` (khi có Treehouse worktree).
   - Chạy `node .agent/scripts/sync-agent-kit.mjs` để tự động lọc khử riêng tư, đồng bộ sang `~/nguyentd-agent-kit` và kiểm định độc lập trên kho kit (chỉ thêm `--commit "<thông điệp>" --push` khi người dùng yêu cầu đẩy lên GitHub).
6. **Đóng quyền `maintainer` & mở phiên mới**:
   - Chạy `.agent/scripts/agent-role.sh clear` để quay về `implementer` và mở phiên làm việc mới để harness nạp hook/profile mới.
