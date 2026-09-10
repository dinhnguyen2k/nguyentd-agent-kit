---
name: research
description: Investigate technical questions with minimum sufficient evidence from primary and relevant practitioner sources. Use for current facts, API behavior, production trade-offs, or reusable research notes.
metadata:
  category: "research"
  source: "https://github.com/mattpocock/skills (MIT License, Copyright (c) 2026 Matt Pocock)"
---

# Research

Produce a decision-useful answer, not a large source dump.

## Method

1. Turn the request into the smallest set of claims that would change the decision.
2. Search current web sources in small batches and open only sources that can resolve those claims.
3. Prefer primary owners: official docs, specifications, upstream source, first-party APIs, advisories and direct postmortems.
4. For production trade-offs, add relevant practitioner evidence from engineering blogs, talks and GitHub repos/issues/PRs/discussions.
5. Treat titles and popularity only as discovery signals; trust direct involvement, context, methodology and reproducible evidence.
6. Seek counterevidence for the recommendation.
7. Label material claims as `fact`, `reported experience`, `inference` or `open question`, with direct citations nearby.

Stop when key claims have direct support and additional independent sources no longer change the conclusion.
Expand only when evidence conflicts, context fit is weak, risk is high or a key claim remains unresolved.

## Execution cost

- Work locally by default.
- Use a background agent only when delegation is authorized and there is a broad, independent reading lane with a bounded question and no duplicated search.
- Prefer targeted page sections over full-page ingestion and summarize rather than copy.

## Output

- Return concise findings with limitations and confidence.
- For substantial standalone research, write one Markdown artifact using the repo convention.
- When nested inside another workflow, contribute to its designated artifact or return a bounded summary; do not create a duplicate artifact.
