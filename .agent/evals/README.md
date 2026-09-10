# Agent Skill Evals

Cases under `cases/` describe observable decisions, not required wording. They are portable inputs for Claude, Codex, Gemini, or another harness.

Each case contains:

- `skills`: skill package to expose to the evaluating agent
- `query`: realistic task prompt
- `expected_behavior`: decisions/evidence that must appear in the work
- `forbidden_behavior`: regressions that fail the case

`node .agent/scripts/validate-agent-system.mjs` validates the case schema and confirms every `cogain-*` skill has coverage. Model execution remains harness-specific; compare behavior with and without the skill when changing a high-impact procedure.

## Cadence

- Local skill changes: run static validation.
- Skill, model, crawler, or MCP changes: run static validation and behavior cases before publishing.
- Nightly automation: run behavior cases across Claude, Codex, Antigravity, or whichever harnesses are available.

Behavior cases should test decisions, not wording. Social/web knowledge cases must enforce the governance rule that T3/T4 sources are discovery leads only.
