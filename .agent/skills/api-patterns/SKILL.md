---
name: api-patterns
description: Guides API shape, compatibility, versioning, errors, pagination, and contract trade-offs. Use when designing or changing an API contract; not for routine endpoint implementation that preserves an existing contract.
metadata:
  category: architecture
  version: 4.1.0-fractal
  layer: master-skill
---

# API Patterns

> API design principles and decision-making for 2025.
> **Learn to THINK, not copy fixed patterns.**

## 🎯 Selective Reading Rule

**Read ONLY files relevant to the request!** Check the content map, find what you need.

---

## 📑 Content Map

| File                  | Description                                 | When to Read                   |
| --------------------- | ------------------------------------------- | ------------------------------ |
| `api-style.md`        | REST, GraphQL, and RPC trade-offs           | Choosing API type              |
| `rest.md`             | Resource naming, HTTP methods, status codes | Designing REST API             |
| `response.md`         | Envelope pattern, error format, pagination  | Response structure             |
| `graphql.md`          | Schema design, when to use, security        | Considering GraphQL            |
| `trpc.md`             | TypeScript RPC contrast reference           | Explicit non-Cogain evaluation |
| `versioning.md`       | URI/Header/Query versioning                 | API evolution planning         |
| `auth.md`             | JWT, OAuth, Passkey, API Keys               | Auth pattern selection         |
| `rate-limiting.md`    | Token bucket, sliding window                | API protection                 |
| `documentation.md`    | OpenAPI/Swagger best practices              | Documentation                  |
| `security-testing.md` | OWASP API Top 10, auth/authz testing        | Security audits                |

---

## 🔗 Related Skills

| Need               | Skill                           |
| ------------------ | ------------------------------- |
| API implementation | `@[skills/backend-development]` |
| Data structure     | `@[skills/postgresql]`     |
| Security details   | `@[skills/security-hardening]`  |

---

## ✅ Decision Checklist

Before designing an API:

- [ ] **Asked user about API consumers?**
- [ ] **Chosen API style for THIS context?** Cogain defaults to REST plus gRPC unless an ADR says otherwise.
- [ ] **Defined consistent response format?**
- [ ] **Planned versioning strategy?**
- [ ] **Considered authentication needs?**
- [ ] **Planned rate limiting?**
- [ ] **Documentation approach defined?**

---

## ❌ Anti-Patterns

**DON'T:**

- Change API style without a consumer-driven reason
- Use verbs in REST endpoints (/getUsers)
- Return inconsistent response formats
- Expose internal errors to clients
- Skip rate limiting

**DO:**

- Choose API style based on context
- Ask about client requirements
- Document thoroughly
- Use appropriate status codes

---

## Script

| Script                     | Purpose                 | Command                                          |
| -------------------------- | ----------------------- | ------------------------------------------------ |
| `scripts/api_validator.py` | API endpoint validation | `python scripts/api_validator.py <project_path>` |
