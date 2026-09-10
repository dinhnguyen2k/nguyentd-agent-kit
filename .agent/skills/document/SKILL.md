---
name: document
description: "Tự động viết tài liệu chuyên nghiệp và đầy đủ. Use when creating, generating, or updating comprehensive technical documentation."
---

# /document - Knowledge & Documentation System

$ARGUMENTS

---

## 🟢 PHASE 1: Codebase Extraction
**Execution role**: `codebase discovery role` & `documentation-writer`
**Mission**: Understand what needs explaining.
- **Action**: Extract Docstrings, Type Definitions, and API routes.
- **Action**: Identify "Knowledge Gaps" in current documentation.

## 🟡 PHASE 2: Logic & Structural Drafting
**Execution role**: `documentation-writer`
**Mission**: Create the narrative.
- **Protocol**: 
  - Why does this code exist? (Business Logic).
  - How do I use it? (Quick Start/Examples).
  - What are the risks? (Caveats/Notes).
- **Format**: Use GitHub Flavored Markdown (GFM) with appropriate Alerts.

## 🔵 PHASE 3: Surgical Update
**Execution role**: `documentation-writer`
**Mission**: Apply the knowledge.
- **Action**: Create or Update `README.md`, `API.md`, or code comments.
- **Standard**: Follow [documentation-templates](file:///skills/documentation-templates/SKILL.md).

## 🔴 PHASE 4: Clarity Audit & Sync
**Execution role**: `verification role` & `SEO review role`
**Mission**: Ensure the docs are discoverable and clear.
- **Verification**: Run `textlint` and check for broken links.
- **Artifact**: Create a unified `walkthrough.md` if this was a major doc update.

---

## Documentation Mandates:
- **No Stale Docs**: Documentation must match current code state.
- **AI-Ready**: Use structured headers to help other agents find context.
- **User-Centric**: Write for the persona appropriate for the file (Dev vs User).

---

## Examples:
- `/document this entire directory`
- `/document the authentication flow`
- `/document generate API reference`
