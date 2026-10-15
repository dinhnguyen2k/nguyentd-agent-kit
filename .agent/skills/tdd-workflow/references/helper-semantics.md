# Legacy Helper Semantics and Provenance

The legacy helper script `tdd_cycle.js` from `tdd-master-workflow/scripts/tdd_cycle.js` was removed during consolidation because its entire behavior was four `console.log` calls describing RED, GREEN, REFACTOR and cycle completion without authoring tests, implementing code, refactoring files, invoking a test runner, or inspecting outcomes.
The printed `OK` and completion text were illustrative only, not verified results.
It was never a validation gate or evidence of completed TDD, and no replacement stub is provided.
Validation and test execution require explicit user authorization under `AI_RULES.md`.

The source master skill identifies itself as merged and optimized from seven legacy TDD and testing skills, without listing those sources or a standalone license.
The naming reference preserves the repository-provided content; no additional upstream license or authorship is invented.
The `tdd` source declares https://github.com/mattpocock/skills, MIT License, Copyright (c) 2026 Matt Pocock.
That attribution is retained in the owner metadata and transferred behavior, mocking and seam references.
No standalone TDD license file was present in the source directories.

The retired `tdd` and `tdd-master-workflow` entries are consolidated into canonical `tdd-workflow`.
They are not active aliases or executable authority for the canonical procedure.
