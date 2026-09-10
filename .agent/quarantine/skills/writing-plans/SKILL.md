---
name: writing-plans
description: Use when documenting a multi-step Cogain implementation plan; use the local plan workflow and registered runtime profiles only.
metadata:
  version: "4.1.0-cogain"
---

# Cogain Plan Writing

Use `.agent/workflows/plan.md` and `plan-writing` for implementation plans. Keep
each task bounded with owner, file scope, dependencies, acceptance criteria, and
validation. A Task Manifest is required only when `/orchestrate` classifies the
work as governed.

Do not require external `superpowers` skills, agent types, commits, or task tools.
Use only profiles registered in `.agent/contracts/agent-registry.json`.
