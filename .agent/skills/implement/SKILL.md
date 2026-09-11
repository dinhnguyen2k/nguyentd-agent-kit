---
name: implement
description: "Implement a piece of work based on a spec or set of tickets."
disable-model-invocation: true
metadata:
  category: "engineering"
  source: "https://github.com/mattpocock/skills (MIT License, Copyright (c) 2026 Matt Pocock)"
---

Implement the work described by the user in the spec or tickets.

Use /tdd where possible, at pre-agreed seams.

**DO NOT RUN typechecking, lint, build, tests, or other validation automatically.**
Run only the validation action explicitly requested by the user and do not expand its scope.

Use `/code-review` only when the user explicitly requests review.

**DO NOT COMMIT unless the user explicitly requests a commit.**
