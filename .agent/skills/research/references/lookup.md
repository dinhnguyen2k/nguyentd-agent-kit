# LOOKUP research

Use for one bounded fact, API option, syntax, version, or current status.

## Input contract

```yaml
mode: LOOKUP
question: "One exact question"
product_version: "Relevant product or version, when known"
freshness: "current | time-bounded | timeless"
preferred_owner: "Primary source owner, when known"
output: "short-answer | reusable-note"
```

Do not pass the full conversation, repository documentation, or unrelated project context.

## Source policy

- Inspect up to 3 search results for discovery.
- Open 1 authoritative primary source and the smallest section that answers the question.
- Open at most 1 confirming source only when the primary source is ambiguous, incomplete, or version-sensitive.
- Do not seek practitioner evidence when an unambiguous primary source resolves the claim.
- Do not delegate.

## Retained context

Keep one compact finding with the claim, direct source, relevant fact, confidence, and any version caveat.
Discard search snippets and raw page content after extraction when the harness allows it.

STOP as soon as the authoritative source directly resolves the question.
