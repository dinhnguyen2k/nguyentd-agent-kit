---
trigger: glob
glob: "backend/**/*,frontend/**/*"
---

# TEST-ENFORCEMENT.MD - Bắt Buộc Có Test

> Tách từ `AI_RULES.md` mục 9. `AI_RULES.md` vẫn là nguồn sự thật cao nhất.
> File này nói về nghĩa vụ chạy/viết test khi đổi code production.
> Chuẩn viết test xem `.agent/rules/testing-standard.md`.

## 1. Khi nào phải chạy test và ranh giới Agent

- **Phân định vai trò:** Việc chạy test suite (`dotnet test`) và kiểm chứng tự động thuộc về Agent nghiệm thu (`verifier`).
- **Trong task phân tích hoặc task triển khai cục bộ/đơn giản:**
  - Agent triển khai (`backend-specialist` / implementer) **TUYỆT ĐỐI CẤM** tự ý chạy `dotnet test`.
  - Chỉ được phép chạy `dotnet build <project>` để xác nhận biên dịch không lỗi cú pháp.
  - Cấm tự tiện chạy test làm phiên làm việc kéo dài bất hợp lý (treo máy, tốn token, phát sinh lỗi từ test không liên quan).
- **Khi nào mới kích hoạt Verifier và chạy test:**
  - CHỈ KHI người dùng có yêu cầu rõ ràng gọi `verifier` hoặc chỉ định chạy test suite.
  - Hoặc trong quy trình `/orchestrate` đối với các task lớn chạm nhiều service/cross-domain đã được lập kế hoạch phân công cho `verifier`.
- **Quy tắc chặn spam build (Build Idempotency)**: Chỉ build đúng 1 lần cho một lượt xác thực. Nếu build đã thành công và không có file source nào thay đổi thêm, cấm tuyệt đối việc gọi lại `dotnet build` hay `dotnet test` để "đánh giá lại". Kết quả build xanh trước đó là bằng chứng hợp lệ.

### Cưỡng chế ở runtime, không phải lời dặn

Ba luật dưới đây do PreToolUse hook `.agent/scripts/agent-boundary-guard.mjs` thực thi (wiring tại `.claude/settings.json`), đọc cấu hình từ `.agent/contracts/agent-registry.json`:

| Rule | Chặn gì | Role được phép |
| --- | --- | --- |
| R1 | Lệnh chạy test suite: `dotnet test`, `vitest`, `jest`, `playwright test`, `npm/pnpm/yarn test` | `verifier`, `test-author` |
| R2 | Ghi vào cây test, qua Edit/Write hoặc qua shell (`sed -i`, `cp`, `mv`, `>`, `git checkout`) | `test-author` |
| R3 | Sửa chính file cấu hình enforcement (registry, guard, settings) | `maintainer` |

`verifier` và `test-author` là subagent thật trong `.claude/agents/`, nên `verifier` không được cấp Edit/Write ở tầng runtime.
Harness không có hook (Codex, Antigravity, CI) dùng chung bộ luật qua CLI: `node .agent/scripts/agent-boundary-guard.mjs --check-command "<cmd>"`, exit 2 là bị chặn.

Role mặc định là `implementer`, chặt nhất. Người dùng mở cổng bằng `! .agent/scripts/agent-role.sh verifier`, hiệu lực 8 giờ rồi tự hết hạn.
Khai báo cho đúng một lệnh thì đặt `COGAIN_AGENT_ROLE=verifier` ở đầu dòng lệnh; cách này luôn hiện trong transcript nên không giấu được.
Agent bị chặn thì dừng và báo lại, tuyệt đối không tự chạy lệnh mở cổng cho chính mình. Mọi lần chặn và mọi lần đổi role đều ghi vào `.agent/reports/boundary-guard.log`.

## 2. Tách quyền viết test (chống test xanh giả)

Agent viết code production **không được viết test cho chính code đó**, vì nó sẽ
mã hoá hành vi nó vừa tạo ra, kể cả hành vi sai. Việc viết test thuộc về
`test-author` (xem `.agent/contracts/agent-registry.json`, mục `invariants`).

- Cấm sửa/xoá assertion, thêm `Skip`, hay chỉnh expected value cho khớp output
  quan sát được, chỉ để build xanh.
- Test mâu thuẫn spec → dừng, báo `test-spec-conflict`, để user quyết.
- `test-author` chạy **song song** với specialist (write path rời nhau), không
  waterfall. Cả hai nhận cùng một spec và không thấy output của nhau khi đang chạy,
  đó chính là cơ chế giữ test độc lập.
- `verifier` kiểm tra biên bằng checksum, không bằng `git diff`: cây test cố tình
  nằm ngoài git (`.git/info/exclude`) nên `git diff` không thấy chúng.

Chặn ghi test chỉ bịt **1 trong 4** đường gian lận. Ba đường còn lại nằm ngay
trong `backend/src/**` (vùng ghi hợp lệ của specialist) nên checksum không thấy:

1. Hardcode giá trị fixture vào code production, hoặc nhánh rẽ theo đúng input mà chỉ test truyền vào.
2. Override so sánh/`Equals`/`GetHashCode` cho assertion luôn đúng.
3. Giữ state ẩn (đếm lần gọi) để cùng input trả kết quả khác nhau giữa các lần.
4. Early return, nuốt exception, hoặc nới `catch` để lỗi thật thành pass.

`verifier` phải đọc diff implementation, không chỉ nhìn kết quả xanh. Kết luận
dựa trên diff và task manifest, không dựa trên màu xanh của test. Điểm nào còn
tranh cãi thì đưa vào `residual_risks` và hỏi user, đừng tự quyết.

## 3. Red hồi tố (bù cho việc chạy song song)

Chạy song song thì không ai chứng kiến pha Red. `verifier` dựng lại: `git stash`
phần `backend/src`, chạy test mới trên code cũ, **bắt buộc phải đỏ**. Test nào xanh
trên cả code cũ lẫn code mới thì không kiểm chứng được gì → loại (`vacuous-test`).

## 4. SQLite ≠ PostgreSQL

Unit test chạy SQLite in-memory, production chạy PostgreSQL. Case-sensitivity của
so sánh chuỗi, xử lý ngày/giờ, JSON column và `EF.Functions` đều có thể khác nhau
⇒ test xanh trên SQLite vẫn có thể hỏng trên Postgres. Hành vi nào phụ thuộc ngữ
nghĩa của DB thì phải có integration test chạy Postgres thật, không được coi unit
test SQLite là đủ.
