---
name: security
description: "Quét lỗ hổng và bảo mật theo chuẩn Security Senior. Use when auditing security vulnerabilities, scanning secrets, or hardening systems."
---

# /security - Professional Armor & Security Audit

$ARGUMENTS

---

## 🟢 PHASE 1: Attack Surface Mapping
**Execution role**: `penetration-tester` & `codebase discovery role`
**Mission**: Find where the system is "thin."
- **Action**: Identify all public endpoints, input fields, and storage locations.
- **DNA Link**: Check `rules/malware-protection.md` for external link risks.

## 🟡 PHASE 2: Vulnerability Research & Tooling
**Execution role**: `security review role`
**Mission**: Run the deep scans.
- **Action**: Run SAST/DAST tools (e.g., `npm audit`, `snyk`, `owasp-zap`).
- **Research**: Check for common library vulnerabilities (CVEs).

## 🔵 PHASE 3: Surgical Hardening
**Execution role**: `backend-specialist` & `deployment role`
**Mission**: Patch the leaks.
- **Action**: Implement Rate Limiting, Input Sanitization, and CSP headers.
- **Protocol**: Apply "Least Privilege" to all IAM and system roles.

## 🔴 PHASE 4: Verification & Compliance Report
**Execution role**: `verification role`
**Mission**: Confirm the "Fortress" is secure.
- **Verification**: Re-run the exploit script to ensure it's blocked.
- **Artifact**: Create a "Security Risk Table" in the `walkthrough.md`.

---

## Security Mandates:
- **No Hardcoding**: Reject any plan that hardcodes a secret.
- **Sanitize Everything**: All user input is untrusted by default.
- **Zero Trust**: Authentication must be verified at every layer.

---

## Examples:
- `/security audit all endpoints`
- `/security scan for data leaks in logs`
- `/security harden auth flow`
