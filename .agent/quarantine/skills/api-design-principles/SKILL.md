---
name: api-design-principles
description: 'Use when establishing broad API design principles or reviewing API standards; prefer api-patterns for Cogain REST/gRPC contract changes.'
metadata:
  version: '4.1.0-fractal'
---

# API Design Principles

API design principles for contract clarity, compatibility, error semantics, and consumer usability. Cogain defaults to REST through ASP.NET Core and synchronous service contracts through gRPC; GraphQL is not a default architecture choice.

## Use this skill when

- Designing new REST APIs or approved GraphQL APIs
- Refactoring existing APIs for better usability
- Establishing API design standards for your team
- Reviewing API specifications before implementation
- Evaluating API paradigm changes through an explicit architecture decision
- Creating developer-friendly API documentation
- Optimizing APIs for specific use cases (mobile, third-party integrations)

## Do not use this skill when

- You only need implementation guidance for a specific framework
- You are doing infrastructure-only work without API contracts
- You cannot change or version public interfaces

## Instructions

1. Define consumers, use cases, and constraints.
2. Choose API style and model resources or types.
3. Specify errors, versioning, pagination, and auth strategy.
4. Validate with examples and review for consistency.

Refer to `resources/implementation-playbook.md` for detailed patterns, checklists, and templates.

## Resources

- `resources/implementation-playbook.md` for detailed patterns, checklists, and templates.

## 🧠 Knowledge Modules (Fractal Skills)

### 1. [implementation-playbook](./sub-skills/implementation-playbook.md)
