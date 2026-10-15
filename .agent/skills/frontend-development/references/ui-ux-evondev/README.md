# UI/UX reference trích từ evondevKit

Nguồn: `https://github.com/evondev/evondevKit`, thư mục `skills/ui-ux`, commit `dff15b4` (01/10/2026), giấy phép MIT (`LICENSE`).
Nội dung là trích nguyên văn các luật đã chọn; mỗi khối có comment `<!-- nguồn: file:dòng -->` để đối chiếu bản gốc.
Đã tối ưu context: bỏ các ghi chú sự cố dạng "(đã dính ...)", rút `components/button.md` còn phần không bị override.
Trigger: bảng "UI reference" trong `../../SKILL.md` chỉ định đọc đúng một file theo việc đang làm; bản tóm tắt override ở đó là bản model đọc, bảng dưới đây là bản đầy đủ cho người.
Reviewer đọc `review-taxonomy.md` qua symlink `.agent/skills/code-review/references/ui-review-taxonomy.md`.

## Cogain override (thắng mọi nội dung trong thư mục này)

Nội dung nguồn viết cho dự án trống nên có gu riêng; trong Cogain các điểm dưới đây giữ cách Cogain.

| Luật nguồn | Cogain giữ |
| --- | --- |
| `I1`, nút mặc định là `outline` | `Button` mặc định `variant: 'default'` (`frontend/shared/ui/button.tsx`) |
| `I4`, nút nguy hiểm nền mờ `rose`, không đỏ đặc | `variant="destructive"` nền đặc `bg-destructive` |
| `I13`, `I14`, không vẽ vòng focus | Giữ `focus-visible:ring-[3px]` của primitive trong `frontend/shared/ui/` |
| `M1`, nền trang xám, card trắng | Token `--background`, `--card` của `frontend/erp/src/index.css` |
| `M7`, badge nền nhạt | Variant `Badge` hiện có (`frontend/shared/ui/badge.tsx`) |
| `M13`, `M15`, card không bóng | `Card` giữ `shadow-sm` |
| `F24`, không `transition-all` | `Button` giữ `transition-all` |
| `T15`, nhãn nút được xuống dòng | `Button` giữ `whitespace-nowrap` |
| `T25`, placeholder không lặp nhãn | Giữ quy ước placeholder "Nhập..." hiện có |
| `F1`, `F11`, bo 12px, control `h-10`/`h-11`, padding 20-24px | Thang Cogain: control `h-9` (`h-8` compact), `rounded-md`, mật độ ERP |
| Màu cụ thể trong ví dụ (`rose-*`, `emerald-*`, `bg-surface`, `bg-item-hover`, `--border-strong`, `shadow-modal`, `shadow-popover`) | Token Figma và token trong `frontend/erp/src/index.css`; không thêm token mới theo nguồn |
| Ô trống hiển thị dấu gạch dài | Dùng `-` |
| Mũi tên sắp xếp (`sortable-header.md`: lên là tăng dần) | Giữ hướng hiện tại của `custom-table.tsx` |
| `I22`, portal ra `document.body` | Portal qua `getPortalContainer()` như primitive hiện có |
| Probe, ảnh chụp, đo bằng trình duyệt (`probe.mjs`, "Probe báo...") | Không chạy; chỉ kiểm bằng đọc code, theo `AI_RULES.md` §2 |
| Dữ liệu giả, handler rỗng, wireframe | Không áp dụng; code production theo hợp đồng API |

Tham chiếu chéo tới luật không có trong thư mục này (ví dụ `M30`, `N8`, `budgets.md`, `layouts/app.md` mục khác) là luật chưa được chọn; không suy diễn nội dung của chúng.

## Bản đồ file

| File | Nội dung |
| --- | --- |
| `rules-core.md` | `S1`, `S2`, `S9`, "ráp, không vẽ lại"; `N1`, `N2`, `N9`, `N12`; `D2` |
| `rules-layout.md` | `F2`-`F5`, `F7`, `F9`, `F10`, `F25` |
| `rules-text.md` | `T1`, `T8`, `T11`-`T14`, `T16`, `T16b`, `T17`-`T23`, `T30` |
| `rules-interaction.md` | `I9`, `I11`, `I12`, `I19`-`I21`, `I23`, `I26`-`I31` |
| `responsive-tailwind.md` | `R3`, `R6`, `R8`, `R9`, `R11`; `W3`, `W4`, `W6`, `W7`, `W8`, `W10`, `W11` |
| `layout-page.md` | Đầu trang trong vùng nội dung; trang lỗi |
| `layout-form.md` | Form nhiều trường và nhiều bước; trạng thái lỗi, gợi ý, giới hạn ký tự, câu lỗi |
| `layout-overlay.md` | Hộp xác nhận; modal có nội dung; panel trượt; dropdown; popover lọc |
| `review-taxonomy.md` | `V1`: ba hạng lỗi khi soi UI |
| `components/*.md` | `breadcrumb`, `description-list`, `inline-edit`, `empty-state`, `file-upload`, `quantity-input`, `charts` nguyên file; `button` chỉ còn loading, nút icon, cảnh báo variant |
