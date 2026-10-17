# Agent → Script Mapping

| Agent | Script | Command |
|-------|--------|---------|
| **verifier** | Agent-system validation | `node .agent/scripts/validate-agent-system.mjs` |
| **verifier** | OpenAPI validation (when applicable) | `node .agent/skills/api-documenter/scripts/openapi_validator.js <file>` |
Only scripts that exist in the repository are listed here. Frontend browser,
security, migration, and performance checks must use the target package's actual
commands or an explicitly added, validated script; do not invent a runner path.

---
