# NguyenTD Agent Kit

Bộ kit giúp trợ lý lập trình biết khi nào nên trả lời ngay và khi nào cần tìm bằng chứng trước khi đề xuất thay đổi.
Bạn nói chuyện với một đầu mối là **Main** bằng lời bình thường, không cần nhớ tên các chế độ hay tự chia việc cho từng trợ lý.

## Từ câu hỏi đến quyết định

```mermaid
flowchart TD
    U["Bạn nêu việc cần giải quyết"] --> M{"Main cần biết gì để trả lời?"}
    M -->|"Một dữ kiện"| F["Main kiểm tra trực tiếp"]
    M -->|"Vị trí trong mã"| S["Main tìm hoặc nhờ Scout chỉ đúng chỗ"]
    M -->|"Căn cứ để chọn cách làm"| R["Researcher tách câu hỏi, đối chiếu nguồn và tìm phản ví dụ"]
    F --> A["Main trả lời và nói rõ căn cứ"]
    S --> A
    R --> A
    A -->|"Kết quả thực tế trái với dự kiến"| B{"Điều này có thể đổi quyết định không?"}
    B -->|"Có"| Q["Main mở lại đúng câu hỏi bị ảnh hưởng"]
    Q --> M
    B -->|"Không"| K["Giữ kết luận và nêu lý do"]
```

Ví dụ, bạn hỏi: *“Trang đơn hàng mở chậm. Có nên thêm bộ nhớ đệm không?”*
Thay vì mặc định đề xuất cache, Researcher cần tách hai câu hỏi: **thời gian đang mất ở đâu**, và **dữ liệu có được phép hiển thị chậm sau khi đơn hàng thay đổi không**?
Nếu sau đó bạn cho biết nhân viên vừa sửa đơn nhưng vẫn thấy trạng thái cũ, Main có lý do xem lại đề xuất cache mà không cần làm lại phần điều tra độ trễ.

Thông thường, nghiên cứu vận hành theo **3 nhịp liên hồi**: định hình trước khi làm (`FOCUSED` trong cửa sổ ngữ cảnh riêng của `Researcher`), vi-nghiên cứu có trần (`MICRO` tối đa 3 bước qua đồ thị mã nguồn `lsp` và tài liệu gốc `context7`) ngay khi thực thi lộ điểm lệch giả định hoặc điểm nghẽn hiệu năng, và hội tụ bằng bằng chứng ngoại sinh trước khi bàn giao.
Các quyết định kỹ thuật cục bộ và chi tiết khả nghịch (Vùng Xanh / Vùng Vàng) được tự nghiên cứu và tự chốt kèm bảng tóm tắt ngắn; chỉ các quyết định kiến trúc nghiệp vụ một chiều (Vùng Đỏ) mới đưa vào `Hộp thư Quyết định` (treo riêng nhánh bị vướng, tiếp tục chạy các nhánh độc lập khác).
Chỉ khi bạn yêu cầu nghiên cứu sâu hoặc quy trình dự án cho phép rõ ràng, Main mới chia các câu hỏi độc lập cho nhiều `Researcher` và chốt trước giới hạn tìm kiếm.
Researcher chỉ đọc và trả lời kèm nguồn; Main chịu trách nhiệm về khuyến nghị cuối cùng.
Nếu cùng một sai sót lặp lại ở nhiều việc, Main có thể đề xuất cải tiến cách làm và cách đánh giá; bộ kit không tự chạy nghiên cứu nền hay tự sửa quy tắc.

## Khởi tạo và cài đặt tự động 1 lệnh (Khuyên dùng)

Bạn có thể đứng trong bất kỳ thư mục dự án mới nào và chạy đúng **1 lệnh duy nhất** qua NPX:

```bash
npx -y github:dinhnguyen2k/nguyentd-agent-kit --update
```

Hoặc chỉ định đường dẫn từ bất kỳ đâu:

```bash
npx -y github:dinhnguyen2k/nguyentd-agent-kit --update --target /duong/dan/du-an
```

*(Nếu đã thiết lập alias trong shell, bạn chỉ cần gõ `agent-init` hoặc `agent-init /duong/dan/du-an`)*.

### Quy trình hợp nhất 1 bước tự động:
1. **Triển khai toàn diện bộ não Agent**: Cài đặt `.agent/`, các bộ quy tắc `AI_RULES.md`, `OPINION.md`, `AGENTS.md` và tạo sẵn liên kết chuyển tiếp `CLAUDE.md`, `GEMINI.md`, `ANTIGRAVITY.md`.
2. **Tự động đồng bộ Harness Wiring**: Chạy `install-harness-wiring.sh` để kết nối symlinks cho mọi công cụ AI đang dùng (`.claude`, `.gemini`, `.cursor`, `.vscode`, `.codex`, `.omp`).
3. **Kích hoạt tự động dịch vụ nâng cấp chạy ngầm (`agent-updater`)**: Tự động liên kết dự án vào bộ hẹn giờ `systemd --user`, bật bộ canh ngưỡng lỗi sớm nhân Linux (`agent-updater-watch.path`), gắn nhãn WezTerm status bar và dòng nhắc shell trong `~/.zshrc` mà không phải gõ thêm bất kỳ lệnh nào.

---

## Cài đặt thủ công qua Git Clone

Nếu muốn tải mã nguồn kit về máy trước:

```bash
git clone https://github.com/dinhnguyen2k/nguyentd-agent-kit.git ~/nguyentd-agent-kit
cd /duong/dan/toi/du-an
node ~/nguyentd-agent-kit/bin/install.js --update
```

*(Có thể thêm `--core` nếu chỉ muốn cài bản thu gọn `.agent-core` hoặc `--no-updater` nếu không muốn bật tiến trình chạy ngầm)*.

## Cài đầy đủ cho Cogain trên máy mới

Clone Cogain và bộ kit vào máy mới. Từ thư mục gốc của Cogain, chạy:

```bash
node ~/nguyentd-agent-kit/bin/install.js
```

Lệnh này thêm quy tắc, kỹ năng và cấu hình OMP gồm model, hook, giám sát và các trợ lý chuyên môn. Sau đó kết nối các công cụ:

```bash
bash .agent/scripts/install-harness-wiring.sh
```

Khai báo tài khoản OpenAI của bạn trong `auth.accountPolicies` tại `~/.omp/agent/config.yml`; bộ kit công khai không chứa thông tin tài khoản cá nhân. Chẩn đoán C# cần `csharp-ls` tại `~/.dotnet10/tools/csharp-ls` và .NET tại `/usr/lib/dotnet`, như khai báo trong `.agent/harness/omp/lsp.json`; nếu đường dẫn trên máy khác, hãy chỉnh tệp đó. Cuối cùng, mở một phiên OMP mới. Bộ cài không ghi đè các tệp đã có, vì vậy trên máy có bản cũ, hãy tự so sánh và thay các tệp xung đột.

## Khi cập nhật hoặc đồng bộ hai chiều

- **Chiều kéo bản mới từ kit về dự án / máy khác (`--update`):** Lấy bản kit mới rồi chạy kèm cờ `--update` (có thể thêm `--dry-run` để xem trước mà chưa ghi đĩa):
  ```bash
  git -C ~/nguyentd-agent-kit pull
  node ~/nguyentd-agent-kit/bin/install.js --update
  # Hoặc cho dự án chỉ cài bản rút gọn:
  node ~/nguyentd-agent-kit/bin/install.js --core --update
  ```
  Khi không có `--update`, bộ cài giữ chế độ an toàn chỉ thêm tệp còn thiếu và báo xung đột nếu tệp đã khác. Khi bật `--update`, bộ cài tự động sao lưu các tệp cũ bị thay đổi vào `.agent/scratch/kit-backups/<timestamp>/` (hoặc `.agent-core/.backups/<timestamp>/`), bảo toàn nguyên vẹn các thư mục/kỹ năng riêng của dự án và tự chạy lại `install-harness-wiring.sh`.
- **Chiều đẩy cải tiến từ dự án ngược lên kho kit (`sync-agent-kit.mjs`):** Từ thư mục gốc dự án, chạy:
  ```bash
  node .agent/scripts/sync-agent-kit.mjs --check
  node .agent/scripts/sync-agent-kit.mjs --commit "Mô tả ngắn gọn thay đổi" --push
  ```
  Kịch bản tự động lọc bỏ các thư mục trạng thái/bí mật và công cụ nội bộ dự án, chuẩn hóa liên kết cục bộ về tương đối, quét chặn rò rỉ khóa bí mật/tên miền nội bộ và chạy bộ kiểm định `validate-agent-system.mjs` đạt `0 error(s)` trước khi cho phép lưu lịch sử.
- **Quyền truy cập:** Kit không tự cấp quyền đọc máy, chạy lệnh hay lên mạng. Claude Code và OMP dùng công cụ được cấp; AGY phụ thuộc quyền đọc của phiên; Codex dùng công cụ từ phiên cha. Với Gemini CLI, đừng mặc định rằng công cụ sẽ tự nhận cấu hình Researcher.
- **Quy tắc riêng:** Giữ dữ liệu, cấu hình máy và chính sách nội bộ trong dự án. Nếu muốn xem hoặc đề xuất sửa phần dùng chung, bắt đầu từ [cách phối hợp](core/.agent-core/team.md) và [cách nghiên cứu](.agent/skills/research/SKILL.md).
