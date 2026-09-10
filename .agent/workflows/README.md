# Workflow Command Catalog

Mục tiêu: giúp khám phá workflow khi công cụ không có menu `/` native.

## Execution Roles

Tên role trong workflow là phase responsibility, không phải yêu cầu một agent profile riêng. Current agent thực hiện phase đó và chỉ delegate khi profile/tool thực sự tồn tại, việc song song có lợi, và task cho phép. Runtime agents được đăng ký tại `.agent/contracts/agent-registry.json`: `orchestrator`, `backend-specialist`, `frontend-specialist`, `test-author`, và `verifier`. `verifier` và `test-author` là subagent thật, xem `.agent/harness/README.md`. `AI_RULES.md` quyết định routing và luôn có ưu tiên cao hơn workflow.

## Cách gọi không cần Slash Menu

- `workflow list`
- `list workflows`
- `help workflow`
- `show workflows`
- `workflow <name>` (ví dụ: `workflow plan`)
- `run workflow <name>` (ví dụ: `run workflow debug`)

Tương đương slash command:

- `workflow plan` == `/plan`
- `run workflow api` == `run /api`

## Available Workflows

| Command           | Description                                                                                           |
| ----------------- | ----------------------------------------------------------------------------------------------------- |
| `api`             | Master API Design & Documentation following OpenAPI 3.1 standards.                                    |
| `audit`           | Sắp bàn giao khách? Kiểm tra lại toàn diện cho chắc theo chuẩn Auditor.                               |
| `blog`            | Personal or enterprise blogging system with Markdown support.                                         |
| `brainstorm`      | Bí ý tưởng? Dùng cái này để AI gợi ý theo chuẩn Senior.                                               |
| `compliance`      | Legal & Data Privacy Compliance (GDPR, HIPAA, SOC2).                                                  |
| `create`          | Muốn tạo tính năng mới hoặc dự án từ A-Z? Sử dụng bộ máy nhân sự chuyên nghiệp.                       |
| `debug`           | Gặp lỗi khó sửa? Để AI soi log và sửa giúp bạn theo quy trình chuyên nghiệp.                          |
| `deploy`          | Code xong rồi? Đẩy lên Server/Vercel thôi.                                                            |
| `document`        | Lười viết docs? Để AI tự viết cho chuyên nghiệp và đầy đủ.                                            |
| `enhance`         | Muốn sửa màu, thêm nút, sửa logic nhỏ? Vào đây.                                                       |
| `explain`         | In-depth code explanation, teaching, and knowledge transfer.                                          |
| `frontend-design` | Thiết kế frontend theo workflow orchestration: context -> UI spec -> build -> audit.                  |
| `log-error`       | Ghi lại lỗi vào Error Log để học tập và cải thiện                                                     |
| `mobile`          | native mobile application development and optimization.                                               |
| `monitor`         | Server và Pipeline có ổn không? Cài đặt giám sát ngay.                                                |
| `onboard`         | Người mới vào team? Hướng dẫn họ tự động.                                                             |
| `orchestrate`     | Route task theo AI_RULES sang backend-specialist, frontend-specialist, hoặc dual-domain flow khi cần. |
| `performance`     | Muốn web chạy mượt? Tối ưu tốc độ và hiệu năng theo chuẩn Performance Expert.                         |
| `plan`            | Chưa biết bắt đầu từ đâu? Lập kế hoạch theo chuẩn Senior Personnel.                                   |
| `portfolio`       | Personalized portfolio and professional landing page setup.                                           |
| `preview`         | Muốn xem trước web chạy thế nào? Bật Preview.                                                         |
| `realtime`        | Realtime communication integration with Socket.io, WebRTC, or SSE.                                    |
| `release-version` | Tự động cập nhật phiên bản và đồng bộ toàn bộ tài liệu hệ thống                                       |
| `security`        | Sợ bị hack? Quét lỗ hổng và bảo mật ngay theo chuẩn Security Senior.                                  |
| `seo`             | Muốn lên Top Google và AI Search? Tối ưu SEO/GEO ngay.                                                |
| `status`          | Dự án đang đến đâu rồi? Xem Dashboard báo cáo chuyên nghiệp.                                          |
| `test`            | Sợ bug khi sửa code? Viết test tự động theo chuẩn TDD Master.                                         |
| `ui-ux-pro-max`   | Thiết kế giao diện Visuals Premium với phong cách hiện đại                                            |
| `update`          | Kiểm tra và cập nhật phiên bản Antigravity IDE                                                        |
| `update-docs`     | Tự động cập nhật tài liệu khi có tính năng mới hoặc thay đổi hệ thống.                                |
| `visually`        | Visualize complex logic, architecture, and mindmaps.                                                  |

## Maintenance Note

Khi thêm/xóa workflow trong `.agent/workflows/*.md`, cập nhật file này để giữ command discovery chính xác.
