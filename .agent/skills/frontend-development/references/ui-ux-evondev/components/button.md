# Button

> Rút gọn từ `references/components/button.md` (evondevKit `dff15b4`).
> Đã bỏ phần variant, hover, nút xoá vì dự án giữ cấu trúc UI hiện có (xem `../README.md`).
> Trong ví dụ, `variant="primary"` của nguồn tương ứng `variant="default"` của dự án.

## Đang xử lý (loading)

<!-- nguồn: references/components/button.md:54-67 -->
```tsx
<Button variant="primary" aria-disabled={isSending || undefined} aria-busy={isSending || undefined}
  onClick={(event) => { if (isSending) event.preventDefault(); }}>
  {isSending ? <LoaderCircle className="size-4 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden /> : <Send className="size-4 shrink-0" aria-hidden />}
  Gửi lời mời
</Button>
```

- Spinner **thế chỗ icon**, cùng `size-4`, chữ giữ nguyên. Nút không đổi bề rộng, hàng nút không xô. **Nút chỉ chữ** (không icon để thế chỗ): nút `relative`, chữ thêm `invisible` để vẫn giữ bề rộng, spinner `absolute inset-0 m-auto` nằm giữa.
- Không đổi chữ sang "Đang gửi…": chữ dài ngắn khác nhau là nút co giãn. Đổi thì phải giữ `min-w` bằng bản cũ.
- **Đang xử lý thì chặn bấm bằng `aria-disabled` + `preventDefault` trong `onClick`, KHÔNG đặt `disabled`.** Nút `disabled` bị trình duyệt tước tiêu điểm: người dùng bàn phím bấm Enter xong rơi về `<body>`, lúc xong việc phải Tab lại từ đầu trang. Chặn ở `onClick` là chặn luôn Enter trong ô nhập, vì submit ngầm của form cũng đi qua cú click của nút submit. Nên cài một lần trong component `Button` (prop `isLoading`), đừng viết lại ở từng trang.
- Nút đang xử lý **không mờ** như nút khoá thường, chỉ spinner nói đang chạy, con trỏ `cursor-progress`. Mờ đi thì đọc ra là "bấm không được vì sai gì đó". Class gốc vẫn giữ `disabled:not-aria-busy:opacity-50` cho dự án nào lỡ đặt `disabled` lúc đang xử lý.

## Nút chỉ có icon

<!-- nguồn: references/components/button.md:120-134 -->
Vuông, cao **bằng đúng** nút chữ đứng cạnh nó, và luôn có `aria-label`.
Chênh chiều cao với ô nhập hay nút chữ bên cạnh dù chỉ một bậc là nhìn ra ngay.

## Cảnh báo

<!-- nguồn: references/components/button.md:138-143 -->
Một bản `Button` ở project cũ đã phình lên **8 variant, 3 size** và một variant `glow` dùng ba lớp radial gradient.
Đó là ví dụ ngược.
Muốn thêm variant mới thì phải trả lời được: nó khác các variant đang có ở chỗ nào, và vì sao chúng không làm được việc đó.
