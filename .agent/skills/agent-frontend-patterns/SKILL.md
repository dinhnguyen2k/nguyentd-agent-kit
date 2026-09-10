---
name: agent-frontend-patterns
description: Provides generic React component composition, memoization, code-splitting, virtualization, and accessibility techniques. Use when frontend-development routes to a specific technique; do not use Next.js-only examples in Cogain Vite apps.
metadata:
  author: affaan-m
  version: 5.0.0
---

# React Technique References

Load only the reference that matches the current design problem:

- [Composition over inheritance](sub-skills/composition-over-inheritance.md)
- [Compound components](sub-skills/compound-components.md)
- [Render props](sub-skills/render-props-pattern.md)
- [Context and reducer](sub-skills/context-reducer-pattern.md)
- [Debouncing](sub-skills/debounce-hook.md)
- [Measured memoization](sub-skills/memoization.md)
- [Code splitting and lazy loading](sub-skills/code-splitting-lazy-loading.md)
- [Virtualization](sub-skills/virtualization-for-long-lists.md)
- [Keyboard navigation](sub-skills/keyboard-navigation.md)
- [Focus management](sub-skills/focus-management.md)

## Scope Boundary

- TanStack Query and server-state consistency are owned by [skill:cogain-query-cache].
- Forms and validation boundaries are owned by [skill:cogain-form-rhf-zod].
- Visual direction is owned by [skill:frontend-design] and activates only for explicit design work.
- Use existing Cogain libraries and Vite patterns; this skill does not authorize Next.js, Framer Motion, or a new state library.

## Verification

- The selected technique solves an observed problem and matches a local component pattern.
- Accessibility and behavior are preserved.
- Memoization/virtualization/performance claims have evidence.
