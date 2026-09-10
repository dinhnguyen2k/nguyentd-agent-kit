---
trigger: glob
glob: "**/*.{cs,csproj,sql,ts,tsx,proto}"
---

# BUSINESS.MD - Quy Tắc Nghiệp Vụ Cogain

> Mục tiêu: Chuyển từ guideline mang tính khẩu hiệu sang rule nghiệp vụ có thể thực thi và kiểm chứng theo codebase hiện tại.

---

## 0. Ưu Tiên Và Phạm Vi

1. `AI_RULES.md` là source of truth. Rule này chỉ mở rộng cho domain nghiệp vụ.
2. Khi conflict giữa tài liệu và code đang chạy:
   - ưu tiên behavior thực tế trong source code + `AI_RULES.md`
   - nêu rõ conflict, không tự suy diễn
3. Scope áp dụng:
   - `backend/src/**`, `backend/tests/**`
   - `frontend/*/src/**`, `frontend/shared/**`

---

## 1. Nguồn Chân Lý Nghiệp Vụ

1. Backend là nơi chốt nghiệp vụ cuối cùng; frontend validation chỉ phục vụ UX.
2. Không để quyết định nghiệp vụ cốt lõi chỉ nằm ở UI.
3. Database phải tham gia enforce invariant quan trọng (PK/UK/FK/CHECK/NOT NULL) khi phù hợp.
4. Mọi flow `create/update/delete` phải xem xét tác động chéo BE/FE/DB trước khi kết luận hoàn tất.

---

## 2. Quy Tắc Thiết Kế Nghiệp Vụ Theo Repo

1. Luồng API ưu tiên pattern đang dùng trong repo:
   - `Result<T>`, `Result`, `PagedResult<T>`
2. Controller giữ mỏng; orchestration nghiệp vụ đặt ở service layer.
3. Permission dùng semantics `Resource.Action`, không dùng chuỗi quyền tự phát.
4. Employee-scoped authorization phải bám luồng `X-Employee-Id` hiện có, fail-closed khi thiếu/sai.
5. Không bỏ qua tầng service/repository hiện hữu để “đi đường tắt” thao tác dữ liệu.

---

## 3. Quy Tắc Giao Dịch, Nhất Quán Và Liên Dịch Vụ

1. Các bước phải thành công cùng nhau trong cùng service thì đặt trong cùng transactional boundary.
2. Không công bố thành công trước khi commit bền vững.
3. Liên dịch vụ:
   - đồng bộ: gRPC
   - bất đồng bộ: MassTransit (RabbitMQ/Kafka)
4. Không coupling giữa service bằng shared database.
5. Cross-service workflow không dùng distributed transaction; cân nhắc idempotency/outbox/inbox/compensation khi cần.

---

## 4. Invariant Bắt Buộc

1. Trừ khi business spec nói khác, phải giữ các invariant mặc định:
   - account balance không âm
   - ID là duy nhất
   - xóa customer không để lại orphan orders
2. Với entity soft-delete và unique:
   - bắt buộc filtered unique index cho bản ghi chưa xóa
   - ví dụ: `.HasFilter("\"deleted_date\" IS NULL")`
3. Không phá ngữ nghĩa workflow/work-item hiện có (step/action/status) khi chưa đánh giá impact đầy đủ.

---

## 5. Rule Về Dữ Liệu Nhạy Cảm (Tiền, Kho, Quyền, Pháp Lý)

1. Không dùng `float/double` cho phép tính tiền; ưu tiên kiểu chính xác (`decimal` hoặc equivalent).
2. Mọi thay đổi chạm vào tiền, tồn kho, phân quyền, hồ sơ pháp lý phải có test chứng minh invariant không vỡ.
3. Không xóa mềm hay xóa cứng tùy tiện nếu làm sai lịch sử nghiệp vụ; phải theo chiến lược đã định của domain.

---

## 6. Audit, Logging, Và Lỗi Nghiệp Vụ

1. Không dùng `catch { }` rỗng để nuốt lỗi nghiệp vụ.
2. Khi bắt lỗi nghiệp vụ, phải:
   - log đủ context để truy vết
   - trả lỗi có chủ đích theo pattern hệ thống
3. Thay đổi trạng thái quan trọng nên log được “ai làm gì, khi nào, trên đối tượng nào”.

---

## 7. Các Pattern Bị Cấm

1. Đặt business rule chỉ ở frontend rồi bỏ validate backend.
2. Bỏ qua permission/ownership check để “đi nhanh”.
3. Trả response lệch chuẩn wrapper hệ thống khi không có lý do tương thích rõ ràng.
4. Sửa schema production trực tiếp không thông qua migration.
5. Tạo thuật ngữ nghiệp vụ mới trái với naming/domain hiện có mà không map rõ vào glossary hiện hành.

---

## 8. Cổng Kiểm Tra Trước Khi Hoàn Tất

1. Kiểm tra impacted scope:
   - service/backend module nào bị chạm
   - frontend screen/hook/service nào phụ thuộc
2. Chạy validation tối thiểu theo scope:
   - build + test project backend liên quan
   - lint/build app frontend liên quan (nếu contract/permission/UI flow bị ảnh hưởng)
3. Nếu không chạy được validation:
   - nêu rõ phần chưa verify
   - nêu lý do
   - nêu bước verify tiếp theo
