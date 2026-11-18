---
name: security
description: Sợ bị hack? Quét lỗ hổng và bảo mật ngay theo chuẩn Security Senior.
---

# /security - Professional Armor & Security Audit

$ARGUMENTS

## Permission & Output Contract

- Audit/analyze is read-only: return findings and requested risk tables with source citations in chat; do not edit files or persist artifacts without explicit write permission.
- Hardening requires explicit implementation permission; scans, exploit execution, and validation commands require separate authorization naming the action and scope.
- Reuse existing evidence first; this workflow does not authorize SAST/DAST, dependency audits, app startup, build, lint, tests, or attacks against any environment.
- For authorized implementation, a single slice uses a compact contract/checkpoint only when handoff/resume needs it; multi-slice work reuses `.agent/planning/{task-slug}/00-OVERVIEW.md` and canonical `TASK-*.md` contracts from `/plan`.
- Scope and acceptance live only in TASK contracts; governed work derives its manifest from canonical TASK metadata/parser, not a second narrative plan.
- Handoff packets reference the contract snapshot identity and supersession; only the coordinator updates overview lifecycle state, and gate/CI evidence remains immutable.
- Do not create duplicate PLAN, implementation_plan, walkthrough, or handoff narratives.
- Preserve requested risk evidence and unique remediation runbooks/rollback instructions at their existing owner and link them; persist research only when explicitly requested in `.agent/artifacts`, never new `reports/artifacts`.
- Redact secrets and sensitive exploit data from outputs and persisted evidence.

---

## 🟢 PHASE 1: Attack Surface Mapping
**Execution role**: `penetration-tester` & `codebase discovery role`
**Mission**: Find where the system is "thin."
- **Action**: Identify all public endpoints, input fields, and storage locations.
- **DNA Link**: Check `rules/malware-protection.md` for external link risks.

## 🟡 PHASE 2: Vulnerability Research & Tooling
**Execution role**: `security review role`
**Mission**: Run the deep scans.
- **Action**: Inspect existing SAST/DAST evidence; run tools (e.g., `npm audit`, `snyk`, `owasp-zap`) only with explicit authorization for that action and scope.
- **Research**: Check for common library vulnerabilities (CVEs).

## 🔵 PHASE 3: Surgical Hardening
**Execution role**: `backend-specialist` & `deployment role`
**Mission**: Patch the leaks.
- **Action**: With implementation permission, apply Rate Limiting, Input Sanitization, or CSP headers to evidenced risks within the approved scope.
- **Protocol**: Evaluate "Least Privilege" for affected IAM and system roles; change them only within explicit implementation permission.

## 🔴 PHASE 4: Verification & Compliance Report
**Execution role**: `verification role`
**Mission**: Confirm the "Fortress" is secure.
- **Verification**: Run an exploit script only when explicitly authorized for the target and action; distinguish observed mitigation evidence from unverified claims.
- **Output**: Return the requested Security Risk Table with severity, affected source, evidence, remediation, and remaining uncertainty; no mandatory `walkthrough.md`.
- **Validation**: Report only checks actually run; otherwise state `Validation: not run - not requested`.

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
