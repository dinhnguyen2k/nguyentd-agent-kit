# NguyenTD Agent Kit

Bộ khung agent dùng được với nhiều harness, giữ nguyên luật và cách làm riêng của dự án. Nội dung chia thành ba phần: vai trò và cách phối hợp dùng chung; chính sách riêng của từng dự án, không tự động đưa vào kit; và hồ sơ mỏng theo từng công cụ để nối cấu hình với hướng dẫn dùng chung.

## Cài phần cốt lõi vào dự án

Clone kit riêng, rồi chạy installer từ thư mục dự án cần dùng. Ví dụ:

```bash
git clone https://github.com/dinhnguyen2k/nguyentd-agent-kit.git ~/nguyentd-agent-kit
cd /path/to/your-project
node ~/nguyentd-agent-kit/bin/install.js --core
```

`--core` chép nội dung `core/` vào thư mục hiện tại và bốn tài liệu research vào `.agent-core/research/`:

```text
.agent-core/
├── team.md
├── researcher.md
└── research/
    ├── SKILL.md
    └── references/
        ├── lookup.md
        ├── focused.md
        └── deep.md
```

`team.md` hướng dẫn Main phân công và nghiệm thu công việc; `researcher.md` là hướng dẫn dùng chung cho Researcher. Cấu hình của mỗi harness chỉ dẫn tới các tệp này. OMP có quy tắc mỏng chỉ áp dụng cho Main, yêu cầu đọc `.agent-core/team.md`; hãy bắt đầu phiên mới để OMP nạp quy tắc. Những hồ sơ harness khác cũng chỉ làm nhiệm vụ nối tới hướng dẫn dùng chung. Nội dung nguồn nằm trong `core/` và `.agent/skills/research/` của bản clone kit.

Installer chỉ tạo tệp hoặc thư mục còn thiếu. Tệp trùng khớp được giữ nguyên; tệp khác nội dung, liên kết khác đích hoặc thư mục bị chặn được báo lỗi, không ghi đè. Các tệp độc lập khác vẫn được cài. Nếu dự án đã có tệp điều hướng như `AGENTS.md`, installer giữ nguyên tệp đó. Hãy tự thêm dòng này vào tệp hiện có:

```markdown
Đọc `.agent-core/team.md` để biết khi nào giao việc cho Researcher.
```

Sau khi cài hoặc cập nhật, hãy bắt đầu phiên agent mới để công cụ nạp cấu hình và hướng dẫn mới. Khi có xung đột, xem báo cáo installer, tự đối chiếu nội dung dự án với kit và chỉ xử lý từng tệp sau khi đã quyết định nội dung nào cần giữ. Chạy lại installer an toàn với tệp đã trùng khớp. Khi cập nhật thủ công, chỉ chọn các hướng dẫn dùng chung và hồ sơ công cụ phù hợp; không đồng bộ hoặc đẩy các tệp runtime, cấu hình cục bộ, dữ liệu hay chính sách riêng của dự án lên kit. Việc kéo nội dung từ kit vào dự án cũng không thay thế việc giữ nguyên và rà soát chính sách hiện có.

## Các vai trò

- **Scout** tìm hiểu nhanh cấu trúc và mã liên quan, sau đó bàn giao phát hiện ngắn gọn.
- **Researcher** điều tra câu hỏi kỹ thuật theo phương pháp trong `.agent-core/research/`, ưu tiên nguồn có căn cứ và kết luận dùng được.
- **Main** nắm yêu cầu, giữ ngữ cảnh dự án, định tuyến công việc và tổng hợp kết quả từ các vai trò.

Researcher phù hợp khi cần điều tra kỹ thuật và tổng hợp bằng chứng; Scout phù hợp cho việc dò tìm nhanh trong repo. Main vẫn chịu trách nhiệm kết luận cuối cùng.

## Runtime và quyền

Khả năng thực thi phụ thuộc harness và cấu hình người dùng:

- **Claude Code** và **OMP** có thể dùng công cụ local và web theo quyền đã cấp.
- **AGY** có thể làm việc với tài nguyên local theo khả năng và quyền của runtime.
- **Codex** dùng các công cụ mà phiên cha cung cấp.
- **Gemini CLI** không được giả định có sẵn khả năng nạp native các adapter của kit; hãy dùng cấu hình phù hợp với runtime thực tế.

Các vai trò và hướng dẫn không tự cấp quyền truy cập. Hãy kiểm tra quyền của harness trước khi giao thao tác filesystem, shell, mạng hoặc các hành động có tác động.

## Cài bộ đầy đủ kiểu cũ

Chỉ khi chủ động muốn cài bộ tệp hướng dẫn và cấu hình công cụ kiểu cũ, chạy installer không có đối số từ thư mục dự án:

```bash
node ~/nguyentd-agent-kit/bin/install.js
```

Chế độ này tách biệt với `--core`; chỉ dùng khi bạn chủ động muốn cài bộ cấu hình kiểu cũ.
