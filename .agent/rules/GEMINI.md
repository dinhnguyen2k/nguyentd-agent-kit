---
trigger: always_on
---

# AGY Runtime Extension

Nguồn luật duy nhất là `AI_RULES.md` và `AGENTS.md`.
Báo cáo trung thực mọi lỗi công cụ, build hoặc test, kể cả khi kết quả đó làm hỏng kết luận trước đó.

## Điều phối Specialist & Model Tốc Độ Cao (`gemini-4-hydrogen-high`)

- **Ưu tiên ghim `gemini-4-hydrogen-high` (Gemini 4 Hydrogen High) để chạy nhanh**:
  - Mở đọc `.agent/skills/research/SKILL.md` trước khi giao nghiên cứu (`FOCUSED` 1-2 nhánh hoặc `DEEP` tối đa 6 nhánh trực giao theo `.agent/skills/research/references/deep.md`) khi Main dùng model nặng (`Carbon`, `Neon`, `Opus`), hoặc khi chạy `>= 2` nhánh độc lập (code, review, kiểm định): gọi `swarm` (`action: "add"`, `model: "gemini-4-hydrogen-high"`, `tasks: [...]`), đặt tiền tố tên theo đợt (`res1`, `res2`...) tránh trùng tên cũ.
  - Khi Main đã chọn **Gemini 4 Hydrogen (High)** hoặc **Orchestrator** và chỉ xử lý 1 nhánh đơn giản (`<= 2` tệp cùng miền), gọi `invoke_subagent` (`Model: "inherit"`) để dùng sẵn `call_mcp_tool` (`lsp` -> `get_diagnostics`) không qua bảng tin. Nếu gọi `>= 3` nhánh song song bị `initialized by another opener`, gọi bù đúng nhánh trượt.
- Trong `brief` của `swarm add`, yêu cầu worker đọc `.agents/agents/<role>.md` cùng `AI_RULES.md`, ghi rõ `allowed_paths` + `acceptance` (với nhánh viết code), không tự thêm `monitor`/`narrator` trừ khi user yêu cầu, và dặn đăng `@coordinator [done]` hoặc `@coordinator [blocked]` khi hoàn tất; ở lượt vừa gọi `swarm add`, Main dừng lượt để chờ tin đánh thức, nghiệm thu xong gọi `swarm` (`action: "kill"`).
- Khi worker báo `LSP: circuit-open (timeout)` hoặc cầu chì `.agent/scratch/.runtime/lsp-circuit.json` đang mở (`OPEN`), **Main TUYỆT ĐỐI KHÔNG gọi lại `get_diagnostics` lần nữa**, mà nghiệm thu trực tiếp bằng mã nguồn tĩnh và ghi nhận minh bạch trạng thái cho người dùng; với worker `swarm` chưa có kết quả `cogain-lsp check` và cầu chì đang đóng (`CLOSED`), Main kiểm tra nhanh qua Warm LSP Daemon (`get_diagnostics` / `cogain-lsp check`) trước khi chốt.
- Khi `get_diagnostics` báo lỗi thuộc phạm vi giao việc, Main nhắn trả đúng worker đó để sửa bổ sung trước khi `kill`; đạt 0 lỗi mới gọi `swarm` (`action: "kill"`) dọn worker.
- Chẩn đoán tĩnh từ LSP không phải lệnh validation; khi user chưa yêu cầu chạy build/lint/test vẫn ghi `Validation: not run - not requested`.

## Vòng đời Hook AGY & Bảo trì

- AGY cưỡng chế bằng 4 điểm hook trong `.agent/harness/agy/hooks.json`: `PreToolUse` (`agy/boundary-guard.mjs` kiểm R1-R10, dispatch contract, `R4` theo session và tự ghi ma sát vào `.agent/reports/agent-friction.jsonl`), `PostToolUse` + `PreInvocation` + `Stop` (`agy/lifecycle-hook.mjs` theo dõi `dirtyFiles`/LSP, phát nhịp đồng bộ tiến độ xuyên suốt mỗi 30 lượt mà không thúc nghỉ sớm, và nhắc kiểm tra tĩnh trước bàn giao tối đa 1 lần).
- Kiểm thử luật guard dùng `--sandbox` (không ghi log/trace và bỏ qua state role trên đĩa); ngoại lệ `R10` khai báo tại `enforcement.allowlist` bắt buộc có `expires_at` TTL; nâng cấp `.agent/` thực hiện theo quy trình `/upgrade-agent`.
