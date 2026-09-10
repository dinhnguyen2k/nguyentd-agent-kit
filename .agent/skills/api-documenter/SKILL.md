---
name: api-documenter
description: 'Use when documenting or reviewing OpenAPI 3.1 contracts, endpoint examples, parameters, and response semantics.'
metadata:
  category: 'architecture'
  version: '4.1.0-fractal'
  layer: 'master-skill'
---

# 📄 API Documenter Master Kit

Create API documentation that is accurate against the current code and useful to internal consumers. For Cogain, backend source and generated Swagger/OpenAPI output outrank hand-written examples.

---

## 📑 Internal Menu

1. [OpenAPI 3.1 & Schema Design](#1-openapi-31--schema-design)
2. [Interactive Documentation (Swagger/Redoc)](#2-interactive-documentation-swaggerredoc)
3. [SDK Generation & Client Libraries](#3-sdk-generation--client-libraries)
4. [Developer Experience (DX) & Portals](#4-developer-experience-dx--portals)

---

## 1. OpenAPI 3.1 & Schema Design

- **Single Source of Truth**: Treat backend source and generated OpenAPI output as the source of truth; hand-written docs must match them.
- **Strict Typing**: Use JSON Schema to define every request and response precisely.
- **Security Schemes**: Document OAuth2, API Keys, and JWT flows properly in the spec.

---

## 2. Interactive Documentation (Swagger/Redoc)

- **Visual Clarity**: Organize endpoints by Tags (e.g., Auth, Payments, Users).
- **Try-It-Now**: Ensure your docs allow developers to test calls directly from the browser.
- **Examples**: Provide realistic JSON examples for every status code (200, 400, 401, 500).

---

## 3. SDK Generation & Client Libraries

- **Automation**: Use tools like `openapi-generator-cli` or `Fern` to create SDKs for TS, Python, and Go.
- **Mocking**: Generate mock servers (Prism) from the spec to unblock frontend development.
- **Validation**: Ensure generated SDKs match the latest API version.

---

## 4. Developer Experience (DX) & Portals

- **Tutorials**: Write "How-to" guides for common integration patterns.
- **Changelog**: Maintain a clear log of breaking changes and new features.
- **Landing Page**: Create a welcoming entry point for your API at `docs.yourproject.com`.

---

## 🛠️ Execution Protocol

1. **Verify Spec**: Run the internal validator to ensure OpenAPI integrity.
   ```bash
   # Use the repository's available OpenAPI validation or generation command when present.
   ```
2. **Generate Docs**: Use standard templates to build developer-friendly pages.
3. **Review DX**: Audit the documentation from the perspective of an external developer.
4. **Distribution**: Publish to the developer portal or internal hub.

---

_Merged and optimized from 3 legacy API documentation skills._
