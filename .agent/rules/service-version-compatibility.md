---
trigger: glob
glob: "{**/*appsettings*.json,**/*.proto,**/required-backend-versions.ts,.gitlab/**}"
---

# SERVICE-VERSION-COMPATIBILITY.MD - Quy Trình Kiểm Soát Tương Thích Version (BE gRPC + FE)

> **Mục tiêu**: Ngăn chặn rủi ro lệch contract / version giữa các Microservice Backend (gRPC) và các ứng dụng Frontend khi deploy độc lập.
> **Lưu ý Token**: Rule này chỉ kích hoạt khi đụng tới file cấu hình version (`appsettings.json`, `required-backend-versions.ts`, `.proto`, `.gitlab/**`). Khi code tính năng thông thường, rule này KHÔNG tốn token context.

---

## 1. Phía Backend (gRPC Service-to-Service): CI/CD Gate

### 1.1. Khai báo Version sàn phụ thuộc
Mỗi service Backend tự khai trong `appsettings.json` (mục `RequiredServiceVersions`) phiên bản tối thiểu cần có ở các service mà nó gọi qua gRPC:
```json
"RequiredServiceVersions": {
  "MasterData": "1.0.34",
  "HR": "1.0.23",
  "ERP": "1.0.10"
}
```

### 1.2. CI/CD Gate (`.gitlab/ci/publish.yml`)
Job `check-version:<caller>:<dependency>:<env>` sẽ gọi `GET /version` của service bị gọi để kiểm tra 2 chiều trước khi build image:
- **Sàn**: Phiên bản đang chạy thật $\ge$ Version yêu cầu trong `RequiredServiceVersions` (nếu thấp hơn $\rightarrow$ **Chặn build**).
- **Trần (MAJOR)**: Cùng MAJOR version (nếu bên bị gọi đã lên MAJOR mới mà bên gọi chưa cập nhật $\rightarrow$ **Chặn build**).

### 1.3. Quy ước SemVer (BẮT BUỘC)
- **CHỈ BUMP MAJOR** (ví dụ `1.x.x` $\rightarrow$ `2.0.0`) khi có **Breaking Change**:
  - Xóa field, đổi kiểu dữ liệu, đổi RPC method/parameters, đổi number trong `.proto`.
  - Thay đổi hành vi nghiệp vụ phá vỡ tính tương thích ngược.
- **BUMP MINOR/PATCH** (ví dụ `1.0.30` $\rightarrow$ `1.0.31`): Khi thêm mới method/field optional, fix bug, tối ưu hiệu năng (luôn Backward-Compatible).

---

## 2. Phía Frontend: Runtime Warning

### 2.1. Khai báo Version Backend yêu cầu
Mỗi app FE khai báo riêng trong `src/lib/required-backend-versions.ts`:
```typescript
export const REQUIRED_BACKEND_VERSIONS: Record<string, string> = {
  BusinessDocument: '1.0.15',
  CRM: '1.0.10',
  ERP: '1.0.10',
  HR: '1.0.23',
  MasterData: '1.0.34',
  ServiceDesk: '1.0.30',
};
```

### 2.2. Cơ chế Hook `useBackendVersionWatch`
- Mount tại `MainLayout` của từng app FE.
- Kiểm tra mỗi 5 phút + khi focus lại tab:
  - Nếu BE đang chạy thấp hơn version yêu cầu hoặc lệch MAJOR $\rightarrow$ Báo toast vàng cảnh báo không tương thích.
  - Nếu BE vừa deploy phiên bản mới trong lúc tab đang mở $\rightarrow$ Báo toast vàng nhắc người dùng reload trang (F5).

---

## 3. Quy Tắc Cảnh Báo Local & Tạo Commit Khi Có Thay Đổi

Khi Agent hoặc Developer chuẩn bị commit / push code có liên quan đến gRPC hoặc API Contract:
1. **Không chặn cứng thao tác**: Vẫn chấp nhận đẩy code bình thường.
2. **Cho phép tách Commit riêng**: Khuyến khích tách phần update `RequiredServiceVersions` / `REQUIRED_BACKEND_VERSIONS` thành 1 commit riêng hoặc gom gọn gàng để dễ track trong MR.
3. **BẮT BUỘC Hiển thị Khung Cảnh Báo Nổi Bật (Big Warning Banner)**:
   Agent PHẢI xuất thông báo cảnh báo trực quan để Developer nắm rõ trước khi push:

```markdown
> [!WARNING]
> ### ⚠️ CẢNH BÁO TƯƠNG THÍCH VERSION LIÊN SERVICE
> - **Service đang sửa**: `<Tên Service/App>`
> - **Thay đổi gRPC / API Contract**: `<Mô tả ngắn gọn>`
> - **Tính chất**: `[Backward-Compatible (Minor/Patch)]` HOẶC `[Breaking Change (Major)]`
> - **Kiểm tra RequiredServiceVersions**: Đã khớp với version sàn của dependency chưa?
> - **Lưu ý Tag Release**: Khi tag release, chỉ bump Patch/Minor nếu không breaking để tránh bị CI/CD chặn!
```
