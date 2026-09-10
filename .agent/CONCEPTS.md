# Agent System Concepts

## Rule

Invariant or policy that applies automatically to its declared scope. Rules answer “what must remain true.” Put the highest-priority repository rules in `AI_RULES.md` and path/domain extensions in `.agent/rules/`.

## Specialist

A small role-and-routing profile under `.agent/agents/`. A specialist identifies relevant truth sources, selects skills, and defines evidence expectations. It is not a copied textbook or a mandatory multi-agent process.

## Skill

An on-demand procedure under `.agent/skills/<name>/SKILL.md`. Its description controls discovery; the body changes task decisions; references and scripts provide conditional detail. One concern has one owning skill.

## Workflow

An explicitly invoked or risk-justified protocol under `.agent/workflows/`. Workflows coordinate multi-step/high-risk tasks and should remain thin wrappers around rules and skills.

## Eval

A realistic behavior case under `.agent/evals/cases/`. Evals specify observable expected and forbidden decisions, not exact wording. Static validation checks wiring; model runs compare behavior with and without the skill.
