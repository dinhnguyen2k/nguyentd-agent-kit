---
trigger: model_decision
description: "When reviewing code quality, naming conventions, refactoring anti-patterns, or writing clean production-grade code."
---

# CODE-QUALITY.MD - Engineering Excellence

> **Mục tiêu**: Đảm bảo mã nguồn luôn đạt chất lượng "Production-Grade" ngay từ dòng code đầu tiên.

> **Backend (C#)**: style theo `.editorconfig` áp dụng cho file và `.agent/rules/code-style-concise.md`.

---

## 🚫 1. Anti-Patterns (Cấm Tuyệt Đối)

1.  **Console Logs**: Không commit `console.log`, `print()` vào nhánh chính (trừ file debug tạm thời).
2.  **Magic Numbers**: Không dùng số cứng trong logic. Hãy đưa ra CONSTANT.
3.  **Any Type**: Hạn chế tối đa dùng `any` trong TypeScript. Hãy define type rõ ràng.
4.  **Vertical Bloat**: xem `.agent/rules/code-style-concise.md` (nạp tự động theo glob khi chạm file code). Không lặp lại luật ở đây.

---

## ✅ 2. Best Practices (Khuyên Dùng)

1.  **Naming Convention**:
    *   Variable/Function: `camelCase` (e.g., `userProfile`)
    *   Class/Component: `PascalCase` (e.g., `UserProfile`)
    *   Constant: `SCREAMING_SNAKE_CASE` (e.g., `MAX_RETRIES`)
    *   File: frontend `kebab-case` (e.g., `user-profile.ts`); C# `PascalCase` trùng tên type chính (e.g., `UserProfileService.cs`)

2.  **Comments**:
    *   Giải thích "TẠI SAO", không giải thích "CÁI GÌ".
    *   Dùng JSDoc/DocString cho các hàm public.

3.  **Error Handling**:
    *   Không nuốt lỗi (silent fail). Chỉ bắt lỗi ở ranh giới có xử lý thật: log đủ context rồi trả lỗi theo pattern hệ thống (`.agent/rules/business.md` §6).
    *   Không bọc `try/catch` mặc định quanh mọi `async`/`await`; để lỗi không xử lý được đi lên middleware/interceptor.

4.  **Độ dài hàm và trách nhiệm**:
    *   Độ dài là tín hiệu để rà soát trách nhiệm, mức trừu tượng và flow điều khiển; không đặt ngưỡng dòng cứng để ép tách hàm tự động.
    *   Chỉ tách khi có boundary hoặc trách nhiệm có nghĩa; không chia vụn code thành các hàm con chỉ để đạt LOC, tránh indirection tax và phân mảnh luồng đọc.
    *   Xem xét các đánh đổi tại `skill://clean-code` (§When The Rules Are Wrong - Small functions) và nguyên tắc thiết kế thực dụng tại `.agent/rules/backend-pragmatic-solid.md` (§2 Abstraction Gate, §3 SOLID as Tool).

5.  **Concise Syntax & Modern Idioms**: chủ sở hữu duy nhất là
    `.agent/rules/code-style-concise.md`, gồm cả ngoại lệ Primary Constructor với
    `BaseService`. Không chép lại ở đây để tránh hai bản trôi lệch nhau.
---

## 🧪 3. Testing Requirements

1.  **Nghĩa vụ test**: theo `.agent/rules/test-enforcement.md`.
2.  **Quyền viết test**: agent viết code production không tạo hay sửa test; test thuộc `test-author` (`.agent/contracts/agent-registry.json` R2).
