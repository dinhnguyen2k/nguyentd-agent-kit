---
trigger: glob
glob: "**/*.{test,spec}.{js,ts,jsx,tsx,cs}"
description: "Testing standard for test/spec files: boundaries (AI_RULES.md §2, §4, §6, R1/R2), xUnit/Vitest/Playwright structure, and mocking."
condition: ["**/*.test.js", "**/*.test.ts", "**/*.test.jsx", "**/*.test.tsx", "**/*.spec.js", "**/*.spec.ts", "**/*.spec.jsx", "**/*.spec.tsx", "**/*Tests.cs", "**/*Test.cs"]
paths: ["**/*.test.js", "**/*.test.ts", "**/*.test.jsx", "**/*.test.tsx", "**/*.spec.js", "**/*.spec.ts", "**/*.spec.jsx", "**/*.spec.tsx", "**/*Tests.cs", "**/*Test.cs"]
interruptMode: never
---

# TESTING-STANDARD.MD - Quality Assurance Protocol

> **Nguồn sự thật**: `AI_RULES.md` §2, §4, §6 và `.agent/rules/test-enforcement.md`.

---

## ⛔ 0. Ranh Giới Vai Trò & Thực Thi (`ON-DEMAND ONLY`, `R1`/`R2`)

- **CẤM `backend-specialist` / `frontend-specialist` chạy test hoặc sửa test**:
  - Luật `R1`: `dotnet test`, `vitest`, `jest`, `playwright test`, `pnpm/npm/yarn test` chỉ dành cho `verifier` hoặc `test-author`, và **chỉ chạy khi người dùng yêu cầu rõ ràng (`ON-DEMAND ONLY`)**.
  - Luật `R2`: chỉ `test-author` được tạo hoặc sửa file trong `backend/tests/**`, `frontend/**/__tests__/**`, `*.test.*`, `*.spec.*`.
  - Theo `AI_RULES.md` §6, luồng tự động tạo/spawn `test-author` đang **tạm khóa**; kiểm thử nghiệp vụ do người dùng manual test trừ khi được yêu cầu đích danh.
- **Không tự ý chạy build/lint/test**: không có yêu cầu rõ ràng từ người dùng thì bàn giao kèm `Validation: not run - not requested`.

---

## 📐 1. The Testing Pyramid & Cogain Stack

1. **Unit Tests (70%)**:
   - Backend: **xUnit** + FluentAssertions + Moq + SQLite in-memory (`CoreDbTestBase`).
   - Frontend: **Vitest** + `@testing-library/react` + `jsdom` (không gọi IO/Network thật).
2. **Integration Tests (20%)**:
   - Backend: **xUnit** + PostgreSQL thật qua `IntegrationTestBase` (bắt buộc cho hành vi phụ thuộc DB như case-sensitivity, JSON column, `EF.Functions`).
3. **E2E Tests (10%)**:
   - Frontend: **Playwright** (kịch bản đăng nhập Authentik và luồng người dùng theo `.agent/skills/playwright-skill`), chạy chỉ khi người dùng yêu cầu.

---

## 📝 2. Naming & Structure

- **Frontend**: `*.test.ts(x)` hoặc `*.spec.ts(x)` đặt trong `__tests__/` hoặc `src/test/`.
- **Backend**: `*Tests.cs` đặt trong `backend/tests/{Service}.{UnitTests|IntegrationTests}/`.
- **Structure (Vitest)**:
  ```typescript
  describe('AuthService', () => {
    describe('login()', () => {
      it('should return token when credentials are valid', () => {
        // Arrange - Act - Assert
      });

      it('should throw 401 when password is wrong', () => {
        // Edge case
      });
    });
  });
  ```

---

## 🛠️ 3. Mocking Strategy

- **External Services**: Mock các 3rd-party API / gRPC / message broker bên ngoài; không gọi API thật trong unit test.
- **Database**: Unit test có thể mock repository hoặc dùng SQLite (`CoreDbTestBase`); integration test dùng PostgreSQL (`IntegrationTestBase`).
- **Chống test xanh giả**: Không hardcode fixture vào code production, không nới `catch`, không sửa/xóa assertion hay thêm `Skip` để ép test xanh; mâu thuẫn spec thì báo `test-spec-conflict`.
