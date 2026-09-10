# Agent → Script Mapping

| Agent | Script | Command |
|-------|--------|---------|
| **backend-specialist** | LINQ/collection scan | `python3 .agent/skills/backend-csharp-optimization/scripts/scan-linq.py` |
| **verifier** | Agent-system validation | `node .agent/scripts/validate-agent-system.mjs` |
| **verifier** | OpenAPI validation (when applicable) | `node .agent/skills/api-documenter/scripts/openapi_validator.js <file>` |
| **verifier** | TDD cycle helper (when applicable) | `node .agent/skills/tdd-master-workflow/scripts/tdd_cycle.js` |

Only scripts that exist in the repository are listed here. Frontend browser,
security, migration, and performance checks must use the target package's actual
commands or an explicitly added, validated script; do not invent a runner path.

---
