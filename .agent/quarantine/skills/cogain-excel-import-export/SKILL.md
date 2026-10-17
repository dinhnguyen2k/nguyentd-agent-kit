---
name: cogain-excel-import-export
description: Extends Cogain BaseService Excel import/export through supported hooks, ClosedXML conventions, validation, batch lookup, and compensation rules. Use for ImportFromExcel, ExportTemplateAsync, ExportDataAsync, templates, or spreadsheet mappings.
metadata:
  version: 1.0.0
  layer: project-skill
---

# Cogain Excel Import/Export

The base methods own orchestration. Derived services customize behavior through hooks.

## Mandatory Reading

Read `.agent/rules/backend-excel-import.md` for the current invariant set, then inspect the relevant methods in `BaseService.cs` and one nearby service with the same import/export shape.

## Orchestration Boundary

Do not override:

- `ImportFromExcel`
- `ExportTemplateAsync`
- `ExportDataAsync`

Use the narrow hook that owns parsing, reference preload, validation, entity preparation/save, byte generation, or filename selection. Confirm the exact hook signature in current source.

## Procedure

1. Define the import/export column contract once and verify symmetry.
2. Batch-load lookup/reference data before row processing; never make one DB/gRPC call per cell or row.
3. Parse cells into DTOs with row-aware errors; do not persist partially validated rows accidentally.
4. Preserve base transaction and result behavior.
5. If a remote write occurs before local commit, define compensation/reconciliation before implementation.
6. Generate templates/data through byte-generation and filename hooks rather than replacing upload/storage orchestration.

## Boundaries

- Import and export columns must remain symmetric unless the product contract explicitly distinguishes them.
- Do not hide validation failures by coercing invalid values to defaults.
- Do not trust spreadsheet MIME or extension alone; retain base validation.
- Do not add edit guards to existing import flows without an explicit business decision; `backend-excel-import.md` section 11.1 owns this exception.
- Do not emit secrets, internal audit fields, or unapproved identifiers into export files.

## Verification

- Template header, parser mapping, validation, and export mapping agree.
- At least one success and one row-level failure path are tested for meaningful changes.
- Large imports avoid per-row remote/data calls.
- Compensation or eventual-consistency ownership is documented for remote side effects.
