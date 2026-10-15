---
name: visually
description: "Visualize complex logic, architecture, and mindmaps. Use when drawing diagrams, flowcharts, or visual architecture graphs."
---

## 👁️ Quy trình Trực quan hóa Tri thức

Chuyển đổi code và logic trừu tượng thành sơ đồ dễ hiểu (Mermaid / SVG).

### Quyền thực thi & Artifact
- Phân tích/vẽ sơ đồ chỉ đọc: trả Mermaid và giải thích trong chat kèm dẫn nguồn; không lưu file nếu user chưa yêu cầu.
- Khi user yêu cầu lưu sơ đồ, giữ artifact diagram độc nhất tại đích được yêu cầu; không mặc định sửa README hoặc docs toàn dự án.
- Single-slice chỉ lưu contract/checkpoint gọn khi cần handoff/resume; multi-slice dùng `00-OVERVIEW.md` và `TASK-*.md` theo `/plan`, không tạo thêm PLAN, implementation_plan, walkthrough hoặc handoff lặp nội dung.
- Scope/acceptance thuộc TASK canonical; governed manifest được dẫn xuất từ metadata TASK bằng parser hiện có, không sửa tay.
- Packet handoff giữ identity của contract snapshot và supersession; chỉ coordinator cập nhật lifecycle overview, không chép lại acceptance hoặc sửa gate/CI evidence bất biến.

### 1. Phân tích Mã nguồn
- Chuyên gia: `code-archaeologist`.
- Quét dự án để tìm ra các module cốt lõi và mối liên hệ qua lại.

### 2. Vẽ Sơ đồ (Render)
- Tạo sơ đồ Flowchart, Sequence hoặc Class Diagram.
- Trả Mermaid trong chat mặc định; chỉ xuất SVG hoặc nhúng vào tài liệu được user yêu cầu khi có quyền ghi tại đích đó.
- Chỉ chạy renderer/generation hoặc validation khi user yêu cầu đúng hành động; không tự chạy lệnh hoặc sửa tay artifact auto-generated.

### 3. Giải thích Kỹ thuật
- Phụ tá: `debugger` hoặc `documentation-writer`.
- Đưa ra bối cảnh (Context) cho từng khối logic ngay cùng sơ đồ; không tạo báo cáo narrative riêng lặp lại diagram.
