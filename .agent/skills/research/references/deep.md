# DEEP research

Use only when the user explicitly requests deep research or an active governed workflow explicitly authorizes it.
Do not silently escalate to this level because a topic is broad or high-risk.

## Coordinator input contract

```yaml
mode: DEEP
decision: "One shared decision"
lanes:
  - id: "bounded-lane"
    question: "One question owned only by this lane"
    source_budget: 6
constraints:
  - "Shared constraints"
excluded_topics:
  - "Out-of-scope topics"
success_criteria:
  - "Evidence required to close the decision"
output: "comparison | recommendation | research-artifact"
```

Every lane must be independent and non-overlapping.
The manifest must set a finite lane count and source budget before searching.

## Researcher input contract

Each researcher receives only:

- The shared decision sentence.
- Its single lane question.
- Lane-specific constraints and exclusions.
- Known evidence relevant to that lane.
- A contract to return at most 5 findings, unresolved questions, limitations, and confidence.

DO NOT copy coordinator history, other lane sources, unrelated project context, or complete prior tool outputs into a researcher prompt.

## Source and handoff policy

- Use a background agent only when delegation is authorized and its lane can proceed without duplicated search.
- Apply the same primary-source preference and progressive retrieval rules as focused research within each lane.
- A lane stops before its budget is exhausted when its question is resolved.
- Each lane returns structured findings, not raw pages or tool transcripts.
- The coordinator receives only distilled lane findings and owns cross-lane comparison.
- Do not spawn nested research agents unless the active workflow explicitly authorizes that topology.

Expand a lane only when evidence conflicts, context fit is weak, or a success criterion remains unresolved.
Record the reason before expansion.

STOP when every success criterion has direct evidence and further independent sources are unlikely to change the conclusion.
