---
name: document
description: "Tự động viết tài liệu chuyên nghiệp và đầy đủ. Use when creating, generating, or updating comprehensive technical documentation."
---

# /document - Knowledge & Documentation System

$ARGUMENTS

`AI_RULES.md` và quyền hiện tại có ưu tiên cao hơn skill.
Yêu cầu phân tích/review tài liệu chỉ trả lời trong chat với source citations, không sửa file hoặc tự lưu artifact.
Yêu cầu tạo/cập nhật product docs cho phép viết đúng tài liệu được yêu cầu, không mặc nhiên cấp quyền validation.

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
- **Action**: Create or update only the requested product docs, such as `README.md`, `API.md`, runbooks, diagrams, or code comments.
- **Boundary**: Preserve unique product documentation; do not hand-edit generated catalogs/profiles or `CHANGELOG.md`.
- **Standard**: Follow [documentation-templates](file:///skills/documentation-templates/SKILL.md).

## 🔴 PHASE 4: Clarity Audit & Sync
**Execution role**: `verification role` & `SEO review role`
**Mission**: Ensure the docs are discoverable and clear.
- **Verification**: Inspect clarity and source references without executing checks.
Run `textlint` or link-check commands only when the user explicitly requests that action.
Otherwise report `Validation: not run - not requested`.
- **Artifact ownership**: The requested product docs are the deliverable, not a reason to create a duplicate walkthrough, PLAN, implementation_plan, or handoff.
Single-slice uses a compact contract/checkpoint only when handoff/resume needs it; multi-slice uses `00-OVERVIEW.md` and canonical `TASK-*.md` according to `/plan`.
Governed manifests derive from TASK metadata and are not hand-edited.
Packets reference contract snapshot identity and supersession; only the coordinator updates overview lifecycle, and overview does not copy TASK acceptance.
Persist supporting research only when explicitly requested, in `.agent/artifacts/`, never `reports/artifacts`.

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
