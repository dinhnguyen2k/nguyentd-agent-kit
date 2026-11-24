---
trigger: model_decision
description: "When designing, writing, or optimizing CLI scripts, lifecycle/guard hooks, background daemons, or developer tooling in .agent/** or scripts/** (choosing between Node.js .mjs and Rust/C/Go native binaries)."
---

# TOOLING-RUNTIME-CHOICE.MD - Chọn Ngôn Ngữ Cho Công Cụ & Hook (.mjs vs Native)

## Nguyên tắc cốt lõi

Chọn runtime theo **nút cổ chai thực tế** (khởi động lặp lại, CPU hay đồng bộ logic), không viết lại sang Rust/C theo cảm tính. Tôn trọng `AI_RULES.md` §3.1 và `solution-complexity.md`.

| Lớp công cụ | Lựa chọn chuẩn | Điều kiện áp dụng & Lý do |
| --- | --- | --- |
| **Tầng Não Luật, Hợp Đồng & Điều Phối** | **`.mjs` (Node.js ESM)** | `agent-boundary-guard.mjs`, `hook-evaluator.mjs`, `task-contract.mjs`, `sync-agent-kit.mjs`, `prune-agent-state.mjs`, `validate-agent-system.mjs`, `daemon.mjs`. Giữ **1 nguồn sự thật duy nhất** dùng chung trong bộ nhớ (OMP) và qua socket (AGY/Claude), tương thích 100% ECMAScript Regex (backreference/lookahead), sửa chạy ngay (`zero-build`), đồng bộ đa máy qua `nguyentd-agent-kit`. |
| **Đường Nóng Khởi Động Lặp Lại (`Hot-Spawn Shim`)** | **Native C (POSIX) hoặc Rust (`std`)** + dự phòng `.mjs` | Chỉ áp dụng khi tiến trình CLI mới bị gọi **`>= 50` lần/phiên** với ngân sách độ trễ **`< 5 ms`/lượt** (`PreToolUse`, `PostToolUse`, `PreInvocation`, `PostInvocation`). Vỏ mã máy **tuyệt đối không chứa luật nghiệp vụ**: chỉ nối `stdin`/`stdout` qua **Unix Domain Socket (`0600`)** tới Daemon giữ ấm sẵn trong RAM, và tự rơi an toàn về `node` (`.mjs` Lazy-Import) khi chưa biên dịch hoặc Daemon tắt. |
| **Quét & Biên Dịch CPU-bound Quy Mô Lớn (`> 1.000` tệp)** | **Công cụ Rust / Go biên dịch sẵn** | Dùng `rg` (Rust) để tìm kiếm văn bản toàn kho, `SWC` (Rust) để biên dịch Frontend, `tsgo` (Go) cho máy chủ kiểu TypeScript. Không viết bộ quét cây tệp hoặc phân tích cú pháp cỡ lớn bằng JS thuần. |

## Điều cấm

1. **Cấm nhân đôi nguồn luật**: Không viết lại bộ kiểm tra luật, Regex hoặc hợp đồng giao việc đang dùng `.mjs` sang Rust/C thành hai bản mã nguồn song song.
2. **Cấm phụ thuộc cài đặt nặng bắt buộc**: Mọi thành phần mã máy biên dịch cục bộ trong `.agent/` phải dùng trình biên dịch gọn sẵn có (`gcc`/`cc` POSIX) hoặc giữ cơ chế tự động rơi về `.mjs` để không ép cài toolchain `> 500 MB` mới chạy được bộ kit.
3. **Chứng minh bằng số đo trước khi tối ưu**: Trước khi thêm vỏ Native cho bất kỳ CLI mới nào, phải đo thực tế tần suất gọi trong phiên và `p50`/`p95` trên máy đích; chỉ thêm khi thời gian bật VM (`~35 ms`/lần) thực sự cộng dồn đáng kể.
