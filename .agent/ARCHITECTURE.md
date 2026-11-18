# Cogain Agent Architecture

**Updated:** 2026-10-05  
**Scope:** coding agents for the Cogain .NET 8 microservices and React/Vite monorepo

## Goal

Give an agent the smallest high-signal context that changes its decisions. Repository facts stay in rules/codebase docs, repeatable procedures stay in skills, and specialist profiles only route work.

## Canonical Layers

```text
Entry (AGENTS/CLAUDE/GEMINI)
  -> AI_RULES.md                         global invariants and precedence
  -> .agent/rules/{backend,frontend}.md path/domain invariants
  -> .agent/contracts/*                  agent registry and task handoff contracts
  -> .agent/agents/*.md                  role, routing, evidence policy
  -> .agent/skills/*/SKILL.md            task procedure loaded on demand
  -> .agent/knowledge/*                  skill lifecycle, freshness, MCP policy
  -> .agent/quarantine/skills/*          retained but inactive skill content
  -> references/scripts/source code      conditional detail and executable checks
  -> .agent/evals/cases/*.json           observable behavior expectations
```

One concept has one owner. Other files link to that owner instead of copying it.

## Runtime Agent Registry

The machine-readable source for available runtime agents is
`.agent/contracts/agent-registry.json`. A role mentioned in a workflow is not an
agent unless it is registered there and has a profile (except the control-plane
`orchestrator`, which is the current coordinator).

| Agent | Kind | Write boundary |
| ----- | ---- | -------------- |
| `orchestrator` | control | none |
| `backend-specialist` | worker | `backend/**` (excludes tests) |
| `frontend-specialist` | worker | `frontend/**` (excludes tests) |
| `test-author` | worker | `backend/tests/**`, `frontend/**/__tests__/**`, `frontend/**/*.{test,spec}.{ts,tsx}` |
| `verifier` | gate | none (read-only tools) |
| `reviewer` | gate | none (read-only tools; opt-in on explicit user request) |

Test authorship is strictly separated from production code: workers writing production
source never modify test files (rule R2). Test suites are restricted to `test-author` and
`verifier` (rule R1).

Security, database, performance, documentation, and release are conditional
capabilities. They become separate agents only when a distinct permission boundary
and an independent evaluation justify the additional coordination cost.

## Task Lifecycle

Classify work before loading broad context or adding coordination:

| Tier | Default context and gate |
| --- | --- |
| `fast` | Source + nearest test/pattern; self-validation |
| `standard` | Selective rule/skill/context; self-validation with evidence |
| `governed` | Task Manifest, explicit ownership, independent verifier |

Fast and standard lanes are preserved for routine, low-risk work without manifest
overhead. Validation commands run only on explicit user request.

Only governed work follows the manifest contract in
`.agent/contracts/task-manifest.schema.json`:

```text
TRIAGED -> PLANNED -> IMPLEMENTING -> VALIDATING -> REVIEWING -> READY
                                      \-> FAILED -> IMPLEMENTING (bounded retry)
```

Single-slice work keeps a compact contract or checkpoint. Multi-slice work tracks
structured lifecycle in `.agent/planning/{task-slug}/00-OVERVIEW.md` and slice contracts
in `TASK-*.md` with `task-contract` blocks (validated by `.agent/scripts/task-contract.mjs`).
Governed task manifests are derived from canonical TASK metadata rather than edited by hand.

Task checkpoints and verification:
- CI verification runs only on explicit user request via `.agent/scripts/ci-parity.sh` (rule R8).
- Explicit task-contract checkpoints (`gate-supersession` / `gate-completion`) are owned by `orchestrator`/`maintainer`.
- Parallel work requires disjoint write paths. The verifier is read-only and returns `pass`,
  `fail`, or `blocked` with command evidence; it never repairs the source under review.

## Context Budget

Context cost is a quality and latency constraint. The tracked budget is
`.agent/contracts/context-budget.json`; run
`node .agent/scripts/report-agent-context.mjs` before and after policy changes.
The report measures static bytes and estimates tokens conservatively. Runtime token
usage, tool calls, validation outcome, and rework must be recorded when the harness
exposes them; byte estimates are a fallback, not a billing metric.

## Runtime Routing & Mode-Specific Loading

Routing maps evidence to specialists without unconditional skill preloading:

| Evidence / Scope                                       | Agent                  | Mode-specific procedure loading                            |
| ------------------------------------------------------ | ---------------------- | ---------------------------------------------------------- |
| `backend/**`, C#, EF Core, API, DB, gRPC, broker       | `backend-specialist`   | `backend-development`; decision skills on demand           |
| `frontend/**`, React, route, query, form, Tailwind, UI | `frontend-specialist`  | `frontend-development`; decision skills on demand          |
| Test authoring, test repair, regression coverage       | `test-author`          | `testing-patterns`, `tdd-workflow`                         |
| Governed verification, invariant checks                | `verifier`             | `lint-and-validate`, `testing-patterns`, `requesting-code-review` |
| Opt-in diff review, risk and checklist audit (user request) | `reviewer`         | `code-reviewer`, `clean-code`; diff review on demand       |
| Cross-service or cross-app decision                    | Primary domain specialist; Main coordinates cross-domain contracts |
Specialists load minimal context: one baseline router plus one or two decision-changing
skills. Diff-review workflows (`code-review`) are loaded on demand for fixed-point diffs,
not unconditionally for design, decision, or health modes.

## Project-Native Owners

| Concern                                   | Owner                        |
| ----------------------------------------- | ---------------------------- |
| BaseService lifecycle and extension seams | `cogain-baseservice-hooks`   |
| Excel import/export                       | `cogain-excel-import-export` |
| Aggregate child synchronization           | `cogain-child-sync`          |
| TanStack Query cache consistency          | `cogain-query-cache`         |
| React Hook Form/Zod boundaries            | `cogain-form-rhf-zod`        |
| Recurring repository failures             | `cogain-agent-gotchas`       |

Generic skills remain available for transferable knowledge, but they do not override current source code or project-native owners.

## Knowledge Lifecycle

`.agent/knowledge/skill-governance.json` records cleanup decisions, source trust tiers, crawler policy, MCP pilot policy, and eval cadence. Skills should keep stable procedures; current external facts should come from source references or read-only MCP tools at run time.

External knowledge follows this gate:

```text
evidence -> proposal -> eval -> human approval -> publish
```

LinkedIn, Facebook, forum, and feed content are discovery leads only. They must be corroborated against Cogain source/rules or official documentation before any skill change.

Quarantined skills live under `.agent/quarantine/skills`. They are kept for review/mining, but they are not part of active discovery.

## Multi-Harness Layout

`.agent/` is canonical. Harness directories use links and generated wiring rather than copied trees:

- `.agents/skills -> ../.agent/skills`
- `.codex/skills -> ../.agent/skills`
- `.claude/skills -> ../.agent/skills`
- `.claude/agents/{verifier,test-author}.md` (subagents with runtime tool restrictions)
- `.omp/agents/*.md` (generated from `.agent/harness/omp/agents/` headers and `.agent/agents/` bodies via `.agent/scripts/install-harness-wiring.sh`)

New harness profiles take effect only in a new session; live profiles in an active session are not dynamically modified.

## Quality Gates

Run:

```bash
node .agent/scripts/validate-agent-system.mjs
```

The validator checks skill frontmatter/names, local reference links, cross-skill references, specialist skill dependencies, eval coverage, prompt-size warnings, and harness links. Use `node .agent/scripts/validate-agent-system.mjs --write-catalog` after adding/removing a skill to regenerate `.agent/SKILLS.md` and validate. No catalog count claim is made before authorized generation proves actual metadata.

Behavior cases live in `.agent/evals/cases/`. Static validation proves the package is connected; behavior evals prove instructions improve decisions. Model and routing evaluations run in isolated agent sessions using canonical cases before publishing changes to skills, models, or MCP configuration.
## Design Decisions

- Concision is not minimal knowledge: keep non-obvious project procedures, but disclose detailed references only when needed.
- File size is a diagnostic, not a target. Do not inflate a skill to match another repository's average KB.
- More agents are not inherently better. Use the two domain specialists by default; introduce an additional role only when independent evaluation or a distinct permission boundary proves useful.
- External library skills should be version-aligned and explicitly trusted. TanStack Intent may be adopted after reviewing its allowlist and generated changes; it is not run automatically by an agent.
- MCP starts with Microsoft Learn and GitHub read-only. Add other MCP servers only after scoped review; do not give MCP tools production write authority or direct canonical skill-write authority.

These decisions align with Anthropic's context-engineering guidance, Microsoft Agent Framework progressive disclosure, Addy Osmani's skill anatomy/eval conventions, Aaron Stannard's retrieval-led .NET skills, and TanStack Intent's versioned package knowledge:

- https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- https://www.anthropic.com/engineering/building-effective-agents
- https://learn.microsoft.com/en-us/agent-framework/agents/skills
- https://github.com/addyosmani/agent-skills/blob/main/docs/skill-anatomy.md
- https://github.com/Aaronontheweb/dotnet-skills
- https://tanstack.com/intent/latest/docs/overview
