# Search và filter: tách đúng luồng

Chỉ nạp khi task chạm hành vi search/filter dùng `buildApiParams`; màn hình có sẵn bảng hoặc ô search không phải trigger.
Nguồn: `frontend/shared/lib/utils.ts` (`buildSearchCondition`, `buildApiParams`), `frontend/shared/types/base.types.ts` (`QueryParam`).

## Chọn luồng

| Input | Cấu hình API | Phép kết hợp |
| --- | --- | --- |
| Search tổng “Mã hoặc Tên” | Một `searchCondition`, map bằng `globalKeysSearch` | OR giữa các field, bọc ngoặc |
| Lọc từng cột | Param riêng trong `searchKeys` | AND giữa các cột có giá trị |
| Select, ID, trạng thái, khoảng ngày | `filterKeys`, `compares` | AND với nhau và nhóm search |
| Nhóm nghiệp vụ đặc biệt | `searchGroups`, `filterGroups` | Theo contract nhóm; xác nhận hook chuyển tiếp |

## Nối search tổng

Route schema, giá trị input và handler cùng dùng `searchCondition`; hook chuyển tiếp mapping tới builder, service nhận `filters`.
Mẫu cho các field API đã xác minh trong source:

```ts
globalKeysSearch: [
  { key: 'searchCondition', keySearch: 'name' },
  { key: 'searchCondition', keySearch: 'code' },
  { key: 'searchCondition', keySearch: 'displayCode' },
],
```

## Tránh dùng sai

- Không nhân từ khóa tổng vào nhiều param cột trong `searchKeys`: sẽ thành AND.
- Không thêm `searchCondition` vào `searchKeys`/`filterKeys` của API: không phải field entity và có thể làm builder loại mapping global.
  `useTableChange.filterKeys` chỉ tạo state bảng, không phải danh sách filter API.
- Không đổi `filters.join('&&')` thành OR: sẽ làm sai phép kết hợp với các bộ lọc độc lập.
- Input chỉ cập nhật param tương ứng; xóa từ khóa không xóa filter khác nếu contract không yêu cầu.
  Dùng quy ước xóa param hiện có; `useTableChange.updateFilters` reset về trang 1 khi không truyền `page`.
- `buildSearchCondition` dùng contains (`@=`); giá trị bọc ngoặc kép ở hai đầu chuyển thành bằng (`==`).
- Đọc route -> hook -> builder -> service để xác nhận forwarding, không suy từ type.
  Đối chiếu search riêng, filter riêng, kết hợp, xóa từ khóa và phân trang; khi lỗi, xét param URL và `filters` thực tế nếu có.
  Không coi biểu thức suy ra từ source là bằng chứng runtime.
