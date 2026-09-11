# FOCUSED research

Use for a technical decision that can be resolved by no more than 3 decision-changing questions.
This is the default research level.

## Input contract

```yaml
mode: FOCUSED
decision: "One decision this research must support"
questions:
  - "No more than 3 questions that can change the decision"
known_context:
  - "Relevant facts already established"
constraints:
  - "Version, ecosystem, scope, or operational constraint"
exclude:
  - "Topics that must not be explored"
freshness: "current | time-bounded | timeless"
source_seeds:
  - "Optional direct URL or local source reference"
output: "comparison | recommendation | reusable-note"
```

Do not pass the full conversation, source tree, repository documentation, or previously opened pages.
Pass paths or short references first and load their content only when it can resolve an active question.

## Source policy

- Open no more than 6 relevant sources total and use at most 2 sources per claim by default.
- One source is sufficient when it directly resolves all active claims without material ambiguity.
- Treat this source budget as an upper bound, not a completion target.
- Prefer official documentation, specifications, upstream source, first-party APIs, advisories, and direct postmortems.
- For a material production trade-off, add 1 relevant practitioner source or counterexample when it can change the recommendation.
- Search in small batches and treat titles, snippets, and popularity only as discovery signals.
- Open targeted sections instead of full pages.
- Deduplicate URLs and do not reopen a source unless a new claim requires another section.
- Do not delegate ordinary focused research.

Expand only when evidence conflicts, context fit is weak, a key claim remains unresolved, or the brief explicitly authorizes expansion.
Record the reason before expanding.

## Retained context

Keep only the shared evidence ledger defined in the research entry skill.
Discard raw HTML, long quotations, navigation text, duplicate snippets, and complete tool responses after extraction when the harness allows it.

STOP when all decision-changing questions have direct support and another independent source is unlikely to change the recommendation.
