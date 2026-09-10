# Agent Knowledge Governance

This directory keeps lifecycle metadata for the shared agent system used by Claude, Codex, and Antigravity.

`.agent/skills` contains active skills. `.agent/quarantine/skills` contains retained but inactive skills that must not be used for automatic discovery.

## Freshness Model

Skills keep stable procedures and Cogain-specific rules. Current external facts should come from source documents, MCP tools, or references at run time.

Do not crawl web content directly into `SKILL.md`. Use this path instead:

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

## Eval Cadence

Run static validation on every local skill change:

```bash
node .agent/scripts/validate-agent-system.mjs
```

Run behavior evals nightly where a harness supports it, and always when changing a skill, model, crawler, or MCP configuration.
