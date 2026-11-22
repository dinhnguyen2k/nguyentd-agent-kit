---
description: "OMP Main runtime extensions: xd://lsp timeout, dispatch-contract hook, stage-gated teamwork, handle retirement cap & continuous execution."
alwaysApply: true
agents: main
---

# Mở rộng Runtime OMP (chỉ phiên chính)

Mọi quy tắc gốc, cổng an toàn và định tuyến vai trò tuân theo `AI_RULES.md` và `AGENTS.md` (không chép lặp lại tại đây).
File này quy định 6 cơ chế điều phối đặc thù của runtime Oh-My-Pi:

1. **Chẩn đoán `xd://lsp` trước bàn giao**:
   - Agent sửa code chỉ kiểm tra 1 lượt cuối slice bằng **Canary Probe 1 tệp** (`timeout: 8`, không dùng glob); chỉ hỏi tiếp các tệp còn lại khi tệp đầu phản hồi bình thường. Quá hạn/lỗi thì dừng ngay không `reload`, đối chiếu tĩnh chữ ký khai báo gốc/caller và báo `LSP: timeout (circuit-open, skipped remaining files)`.
2. **Giao persisted TASK & Sửa lỗi nhẹ không làm phình kế hoạch**:
   - Với task nhiều slice dùng `.agent/planning/<slug>/`, Main truyền đúng 2 dòng `contract_ref` và `contract_version` để hook `dispatch-contract.ts` tự chèn brief đầy đủ từ canonical TASK.
   - Các lượt vá lỗi biên dịch nội bộ (`BuildFix`) giữ nguyên phạm vi và tiêu chí nghiệm thu gốc được phép giao bằng block `json dispatch-contract` inline gọn, không cần tăng `contract_version` hay chạy supersession lặp lại.
3. **Nghỉ hưu tác vụ dài (`Handle Retirement Cap`) & Chống đánh thức kép**:
   - Tối đa **2 vòng gửi sửa tiếp** qua `write agent://<id>` trên cùng một handle (hook `workflow-context.ts` chặn từ vòng thứ 3). Quá 2 vòng chưa xong bắt buộc tóm tắt gọn tệp đã đổi + lỗi còn lại và gọi `task` tạo specialist mới có ngữ cảnh sạch.
   - Cấm gửi tin cảm ơn, ACK rỗng hoặc đánh thức agent idle; worker bàn giao qua kết quả thoát lượt (`async-result`), không gửi kèm `<irc>` trùng lặp.
4. **Điều phối Teamwork 3 chặng, Chia nhỏ Slice & Nhân bản Verifier an toàn**:
   - *Chặng 1 (Chia Shard vừa cỡ + Hoàn tất mã & dọn API cũ trước)*: Mỗi specialist shard tối đa **2-3 aggregate đơn giản (hoặc 1 aggregate lớn) / ~8-12 tệp ghi** trên `allowed_paths` rời nhau (tách riêng `*DbContext.cs`/`Program.cs`/DI dùng chung sang 1 slice wiring nối tiếp). Hoàn tất toàn bộ TASK sửa mã lẫn TASK dọn API cũ **trước** khi mở chặng test tổng.
   - *Chặng 2 (1 Cổng Biên Dịch Duy Nhất - Cấm tranh `ci-parity.lock`)*: **Cấm** gọi song song nhiều `verifier` chạy `ci-parity.sh` (gây exit `75` chờ lock) hoặc chạy `dotnet test` không `--no-build`. Chỉ **1 `verifier`** giữ cổng biên dịch (`ci-parity.sh` + `fast-build.sh` tuần tự các test `.csproj` liên quan) và gom toàn bộ lỗi gốc từ log đầy đủ thành 1 đợt sửa theo phân hệ.
   - *Chặng 3 (Đóng băng ghi, Tự kiểm cục bộ & Fan-Out `--no-build` Shards)*: **Cấm tuyệt đối** chạy writer sửa mã trong lúc `verifier`/`test-author` đang build/test. Khi user đã cho phép chạy test: cấp `permitted_checks` cho `test-author` tự chạy xanh cục bộ trước khi bàn giao; ở cổng chốt cuối, sau 1 lượt Compile Gate có thể fan-out song song: (a) 1 shard đọc diff/anti-gaming (`reviewer`), (b) tối đa 2 shard Pure Unit (`dotnet test --no-build --no-restore -nodeReuse:false -- xUnit.MaxParallelThreads=4`), và (c) **đúng 1 shard tuần tự** cho nhóm Testcontainers Postgres (`ServiceDesk.IntegrationTests` + `Excel.UnitTests` `MasterDataImport`, `-- xUnit.MaxParallelThreads=2`, không chạy chồng lên `tsgo`).
5. **Chạy xuyên suốt qua đêm & Cấm `ask` chặn luồng (`Non-Blocking Overnight Queue`)**:
   - Ngay khi nghiệm thu xong một phần, gọi ngay tool thực thi phần sẵn sàng kế tiếp trong cùng lượt; cấm dừng lượt sau báo cáo trung gian (hook `session_stop` tự giữ nhịp kèm cầu chì chống lặp).
   - Khi còn mục `todo` hoặc `TASK` độc lập chưa làm, hook chặn gọi tool `ask` đồng bộ: mọi vướng mắc Vùng Đỏ hoặc lỗi công cụ cục bộ ở 1 nhánh phải ghi vào `Hộp thư Quyết định`, treo riêng nhánh đó và chạy hết các nhánh độc lập còn lại.
6. **Khóa ngôn ngữ Tiếng Việt & Vệ sinh ngữ cảnh**:
   - Dù qua bao nhiêu lần nén ngữ cảnh (`/compact`), mọi câu trả lời và thông báo tiến độ gửi user **bắt buộc dùng Tiếng Việt có dấu đầy đủ** (`AI_RULES.md §8`), cấm trượt sang Tiếng Anh.
