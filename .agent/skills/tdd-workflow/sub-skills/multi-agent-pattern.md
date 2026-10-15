# Multi-Agent Pattern

| Agent | Role |
|-------|------|
| test-author | Write tests for the agreed contract (RED); own all actual test-file edits |
| Production writer | Implement the agreed behavior (GREEN) and behavior-preserving refactoring |
| Authorized verifier | Execute only explicitly authorized checks and report observed results |

---

The approved specification is the source of expected behavior, not an existing test that contradicts it.
Report `test-spec-conflict` rather than changing production behavior to satisfy a conflicting test.
Do not spawn agents solely because this table lists roles; follow repository delegation rules.