# Procedures by Ecosystem

#### PHP
1. **Cú pháp (Syntax check):** `php -l <path-to-file.php>` (khi môi trường có `php` CLI và user yêu cầu xác thực).
2. **Composer:** `composer validate --no-check-publish` (kiểm tra tính hợp lệ của `composer.json`).
3. **Kiểm thử (Unit tests):** `vendor/bin/phpunit` (chỉ khi PHPUnit được cài đặt và cấu hình; không chạy khi chưa có test runner).
4. **Khi chưa có runtime:** Nếu môi trường chưa cài `php` CLI, ghi rõ `Validation: not run - runtime not installed` và thẩm định logic qua đọc code.

#### Node.js / TypeScript
1. **Lint/Fix:** `npm run lint` or `npx eslint "path" --fix`
2. **Types:** `npx tsc --noEmit`
3. **Security:** `npm audit --audit-level=high`

#### Python
1. **Linter (Ruff):** `ruff check "path" --fix` (Fast & Modern)
2. **Security (Bandit):** `bandit -r "path" -ll`
3. **Types (MyPy):** `mypy "path"`

## The Quality Loop - Only After Explicit Validation Authorization
1. **Write/Edit Code**
2. **Run Audit:** `npm run lint && npx tsc --noEmit`
3. **Analyze Report:** Check the "FINAL AUDIT REPORT" section.
4. **Fix & Repeat:** Submitting code with "FINAL AUDIT" failures is NOT allowed.

## Error Handling
- If `lint` fails: Fix the style or syntax issues immediately.
- If `tsc` fails: Correct type mismatches before proceeding.
- If no tool is configured: Check the project root for `.eslintrc`, `tsconfig.json`, `pyproject.toml` and suggest creating one.

---
**Strict Rule:** Do not claim a validation passed unless the command actually ran and
passed. Implementation may be handed off as `implemented - validation not requested`.

---

## Scripts

| Script | Purpose | Command |
|--------|---------|---------|
| `scripts/lint_runner.py` | Unified lint check | `python scripts/lint_runner.py <project_path>` |
| `scripts/type_coverage.py` | Type coverage analysis | `python scripts/type_coverage.py <project_path>` |
