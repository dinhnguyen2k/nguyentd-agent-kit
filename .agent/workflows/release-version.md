---
name: release-version
description: Tự động cập nhật phiên bản và đồng bộ toàn bộ tài liệu hệ thống
---

# /release - Quy trình Phát hành Phiên bản

## Quyền thực thi và artifact

Đọc `AI_RULES.md` trước khi thực hiện release.
Yêu cầu xem/review chỉ trả lời kèm nguồn trong chat, không ghi file nếu chưa có quyền ghi riêng.
Yêu cầu tăng version không tự cấp quyền install, generation, validation, commit, tag hoặc push; mỗi hành động cần quyền rõ ràng tương ứng.
Không sửa tay `CHANGELOG.md`, catalog hoặc profile auto-generated.
Không tạo PLAN, implementation_plan, walkthrough, handoff hoặc summary trùng lặp.
Một slice chỉ cần contract/checkpoint gọn khi phải bàn giao/resume; nhiều slice dùng overview+TASK theo `/plan`.
Scope/acceptance thuộc TASK canonical, coordinator cập nhật overview lifecycle; governed derive manifest bằng metadata/parser TASK hiện có.
Packet giữ contract snapshot identity/supersession và tham chiếu gate/CI evidence bất biến.
Giữ release notes, tài liệu sản phẩm và rollback/runbook độc nhất khi user yêu cầu tại owner phù hợp, không biến chúng thành báo cáo tiến độ thứ hai.
Research chỉ lưu theo yêu cầu tại `.agent/artifacts`, không tạo `reports/artifacts`.

## 1. Xác định target và nguồn phiên bản

Đọc target release, version mong muốn và source phiên bản thực tế trước khi sửa.
`package.json` ở root có trường `version`, nhưng không mặc định đó là version của mọi sản phẩm trong monorepo.
Chỉ cập nhật các nguồn phiên bản và tài liệu thuộc target đã được xác định, theo Semantic Versioning khi contract release áp dụng.
Nếu target/version chưa xác định được từ repo và yêu cầu, hỏi user thay vì tự chọn mức tăng.

## 2. Dùng producer thực tế, không giả định Auto-Release Engine

`.agent/scripts/auto-release.js`, `VERSION` và `MASTER_GUIDE.md` không có trong source hiện tại.
Không gọi lệnh cũ, dựng script thay thế hoặc tuyên bố mọi version đã tự đồng bộ.
Đọc producer release của target nếu có; thiếu producer cần thiết thì báo prerequisite còn thiếu, không giả lập kết quả.
Đồng bộ tài liệu được yêu cầu theo `.agent/workflows/update-docs.md`.
Catalog có producer riêng `node .agent/scripts/validate-agent-system.mjs --write-catalog`, chỉ chạy khi được phép generation và static validation, không dùng nó như release engine.
Không sửa tay CHANGELOG ngay cả khi release notes được yêu cầu; dùng producer đã xác minh và được phép, hoặc trả nội dung đề xuất trong chat khi thiếu producer.

## 3. Bàn giao và xuất bản

Báo trong chat changed files, lý do, nguồn phiên bản, validation thực chạy và rủi ro/prerequisite còn lại.
Không bịa thống kê, kết quả script hoặc trạng thái phát hành.
Không tự commit, tag hoặc push; chỉ thực hiện từng hành động khi user yêu cầu rõ.
Khi chưa có quyền validation, ghi `Validation: not run - not requested`.
