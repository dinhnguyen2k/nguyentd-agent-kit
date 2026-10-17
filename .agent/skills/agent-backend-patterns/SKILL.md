---
name: agent-backend-patterns
description: Backend patterns for PHP/PDO procedural applications. Covers PDO prepared statements, input sanitization, CSRF, session auth, file uploads, PHPMailer, transaction boundaries, and MySQL query optimization. Use when writing, reviewing, or auditing PHP backend code.
metadata:
  version: "2.0.0-php"
---

# Backend Patterns (PHP / PDO / MySQL)

Patterns and review criteria for the PHP backend of this project. All examples reflect the actual conventions used in this repository — plain procedural PHP pages, `db.php` PDO MySQL connection, `admin/**` management scripts, and Composer PHPMailer — not framework abstractions.

## Stack facts (do not contradict these)

| Concern | What this repo actually uses |
| --- | --- |
| Runtime | Plain procedural PHP (`*.php`, `admin/**`), Apache/Nginx web server |
| Package manager | Composer with `phpmailer/phpmailer: ^6.10` (`vendor/autoload.php`) |
| Database | MySQL via PDO (`mysql:host=$host;dbname=$db;charset=$charset`) in `db.php` |
| Presentation | Server-rendered templates (`layout/header.php`, `layout/footer.php`) |
| Authentication | Native PHP sessions (`$_SESSION`), cookie-based, password hashing (`password_hash`, `password_verify`) |
| Data access | Direct PDO prepared statements (`$pdo->prepare()`, `bindValue()`, `execute()`) |
| Transactions | Explicit `$pdo->beginTransaction()`, `$pdo->commit()`, `$pdo->rollBack()` |
| File uploads | Native `$_FILES` with server-side MIME type verification and randomized file names |
| Email | `PHPMailer\PHPMailer\PHPMailer` via Composer autoload |

## Use this skill when

- Implementing or changing a backend script (`*.php`, `admin/**`).
- Reviewing or auditing a PHP backend diff or bugfix.
- Handling database queries, transactions, or schema updates with PDO MySQL.
- Implementing authentication, session checks, CSRF guards, or form handlers.
- Adding secure file upload logic or email dispatch via PHPMailer.

## Do not use this skill when

- The change is styling/client-script only -> use `agent-frontend-patterns` or `frontend-development`.
- You need deep MySQL schema or index tuning only -> use `mysql` or `database-optimizer`.
- You are writing automated tests -> use `testing-patterns`.

## Precedence

`AI_RULES.md` > `.agent/rules/backend.md` > this skill.
This skill shows *how* to implement those rules; it never overrides them.

## Audit checklist (fast pass)

### SQL & Data Safety
- [ ] Prepared statements used for 100% of dynamic queries; **zero** raw variable interpolation in SQL strings.
- [ ] `bindValue()` uses explicit PDO parameter types (`PDO::PARAM_INT` for LIMIT/OFFSET/IDs, `PDO::PARAM_STR` for strings).
- [ ] Multi-table writes wrapped in `try { $pdo->beginTransaction(); ... $pdo->commit(); } catch (\PDOException $e) { $pdo->rollBack(); }`.
- [ ] Database credentials read from configuration/environment; never printed or committed.

### Input, Output & Security
- [ ] Output escaping: all user/DB data printed in HTML passes through `htmlspecialchars($val, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')`.
- [ ] CSRF protection: POST requests validate `hash_equals($_SESSION['csrf_token'] ?? '', $_POST['csrf_token'] ?? '')`.
- [ ] Authentication: Admin pages (`admin/**`) verify session login state before rendering or processing actions.
- [ ] Session security: `session_regenerate_id(true)` invoked upon login; session cookie params set with `httponly: true` and `samesite: 'Lax'`.
- [ ] Passwords hashed with `password_hash($password, PASSWORD_DEFAULT)` and verified with `password_verify()`.

### File Uploads & External Services
- [ ] File uploads validate `error === UPLOAD_ERR_OK`, check file size against maximum limit.
- [ ] Server-side MIME validation via `finfo` / `FILEINFO_MIME_TYPE`, never trusting client `type` or raw extension.
- [ ] Uploaded files saved with unique randomized names into non-executable directories.
- [ ] PHPMailer errors logged without exposing SMTP credentials; email bodies properly sanitized.

### Code Organization
- [ ] Database instance reused via `require_once 'db.php'` or equivalent; no duplicate connection instances.
- [ ] Form submissions use PRG (Post-Redirect-Get) to prevent accidental resubmission on page refresh.
- [ ] Clean separation between presentation (`layout/**`) and data processing logic.

## Reference Routing

- Core PHP procedural procedures, session, uploads, PHPMailer -> [skill:php-development]
- MySQL schema design, indexing, and query optimization -> [skill:mysql]
- General clean code and refactoring principles -> [skill:clean-code]
- REST / JSON API response patterns -> [skill:api-patterns]
