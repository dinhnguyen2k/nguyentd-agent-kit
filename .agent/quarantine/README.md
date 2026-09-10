# Agent Skill Quarantine

This directory keeps inactive skills removed from `.agent/skills` discovery.

Quarantine is reversible: retained content can be mined later, but agents should not load these skills automatically. The current quarantine list and cleanup owners are defined in `.agent/knowledge/skill-governance.json`.

To restore a skill:

1. Rewrite it against the current Cogain stack and Agent Skills format.
2. Add or update routing and behavior evals.
3. Move it back under `.agent/skills`.
4. Run:

```bash
node .agent/scripts/validate-agent-system.mjs --write-catalog
```
