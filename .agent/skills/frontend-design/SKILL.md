---
name: frontend-design
description: Develops a context-specific visual direction and interaction design for web UI. Use for explicit UI/UX design or substantial visual redesign; not for routine frontend implementation.
metadata:
  category: design
  version: 5.0.0
  layer: master-skill
---

# Frontend Design

Design from product context and the existing Cogain interface, not from universal style bans or trend checklists.

## Establish the Brief

Inspect the current screen, adjacent flows, shared primitives, and design tokens. Resolve audience, task priority, information density, brand constraints, accessibility, responsive targets, and implementation budget from existing evidence. Ask the user only for a missing choice that materially changes the result.

## Load References on Demand

- Color or palette: [color-system.md](color-system.md)
- Typography: [typography-system.md](typography-system.md)
- Motion: [animation-guide.md](animation-guide.md); use [motion-graphics.md](motion-graphics.md) only for explicit rich-motion work
- Effects and depth: [visual-effects.md](visual-effects.md)
- Unclear design direction: [decision-trees.md](decision-trees.md)
- User behavior/decision friction: [ux-psychology.md](ux-psychology.md)

Do not load every reference by default. Treat heuristic ratios, color psychology, trend labels, and “premium” indicators as optional lenses, not laws.

## Design Contract

Before implementation, make the consequential choices explicit:

- content hierarchy and primary action
- layout behavior across supported widths
- reuse/new shared primitives
- interaction, loading, empty, error, and permission-denied states
- accessibility and reduced-motion behavior
- visual tokens that intentionally differ from the existing product

## Boundaries

- Do not impose arbitrary color bans, animation quotas, radical layouts, or novelty at the expense of task completion.
- Do not replace an existing UI library without an explicit migration decision.
- Do not require a design ceremony for a local styling fix.
- Do not claim originality, accessibility, responsiveness, or visual quality without inspecting the rendered result when verification is requested/available.

## Verification

- The result fits the current product and user task.
- Interaction states and keyboard/focus behavior are covered.
- Target app lint/build passes.
- Visual/browser verification is reported only when actually performed.
