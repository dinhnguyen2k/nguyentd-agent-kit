# Agent Knowledge Governance

This directory maintains lifecycle metadata for the shared agent system across Claude, Codex, Antigravity, and OMP. The machine-readable source of truth is `.agent/knowledge/skill-governance.json`.

`.agent/skills` contains active skills. `.agent/quarantine/skills` contains retained but inactive skills excluded from automatic discovery.

## Skill Lifecycle & Ownership

Skills define stable, repeatable procedures and Cogain-specific architectural invariants. Dynamic facts are retrieved at run time via source files or read-only tools.

Procedure consolidation maintains single ownership:
- TDD procedures are unified under `tdd-workflow`; test boundaries and mocking strategies are owned by `testing-patterns`.
- Code review is partitioned by intent: `code-reviewer` owns general risk assessment and checklists; `code-review` owns fixed-point two-axis diff reviews; `requesting-code-review` owns governed verifier handoffs.
- Retired and duplicate skills are excluded from active discovery and tracked in `skill-governance.json`.

## Freshness Model

Skills keep stable procedures and Cogain-specific rules. Current external facts should come from source documents, MCP tools, or references at run time.
External knowledge must never directly patch canonical skills. All updates follow this gate:

```text
evidence -> proposal -> eval -> human approval -> publish
```

1. Fetch from an allowlisted source and record provenance.
2. Classify source tier, relevant versions, and Cogain applicability.
3. Produce a proposal with citations.
4. Run static validation and behavior evals.
5. Publish only after human approval.

## Source Tiers

- `T0`: Cogain source code, tests, runtime config, `AI_RULES.md`.
- `T1`: official docs, specs, release notes, maintainer repositories.
- `T2`: official engineering blogs and security advisories.
- `T3`: identified expert/founder writing with verifiable technical evidence.
- `T4`: social/forum/feed content such as LinkedIn or Facebook.

`T3` and `T4` are discovery leads only. They can open research, but they must not directly patch skills.

## Eval Cadence & Model Evaluation

- **Local changes**: Run static validation:
  ```bash
  node .agent/scripts/validate-agent-system.mjs
  ```
  Use `--write-catalog` to regenerate `.agent/SKILLS.md` and validate simultaneously. No skill catalog count claims are made before authorized generation proves actual metadata.
- **Skill, model, crawler, or MCP changes**: Run static validation plus behavior evaluation against canonical cases in `.agent/evals/cases/` before publishing.
- **Evaluation sessions**: Routing and behavior evaluations run in isolated, read-only agent sessions with canonical case inputs; they do not invent ad-hoc shell runners or assume live profile activation.
- **Runtime profiles**: Generated harness profiles take effect only in a new session; live profiles in an active session are not modified dynamically.
