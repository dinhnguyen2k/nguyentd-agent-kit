---
name: research
description: Investigate technical questions with minimum sufficient evidence from primary and relevant practitioner sources. Use for current facts, API behavior, production trade-offs, or reusable research notes.
metadata:
  category: "research"
  source: "https://github.com/mattpocock/skills (MIT License, Copyright (c) 2026 Matt Pocock)"
---

# Research

Produce a decision-useful answer from the smallest high-signal context.
Do not optimize for the number of searches, sources, agents, or tokens consumed.

## 1. Normalize the request

Define the decision, only the questions that can change it, relevant constraints, explicit exclusions, freshness, and expected output before searching.
DO NOT inject the full conversation, repository documentation, source tree, or previously opened pages by default.
Pass paths or short references first, then load content only when it can resolve an active question.

## 2. Select one research level

`FOCUSED` is the default.
Source budgets are upper bounds, not completion targets.
Stop early when sufficient evidence already exists.

| Level | Use when | Default input and source limit |
| --- | --- | --- |
| `LOOKUP` | One bounded fact, API option, syntax, version, or current status | One question; inspect up to 3 discovery results; open 1 primary source and at most 1 confirming source |
| `FOCUSED` | A technical decision with up to 3 decision-changing questions | Up to 3 questions; open at most 6 relevant sources total; use at most 2 sources per claim by default |
| `DEEP` | The user explicitly requests deep research, or an active governed workflow explicitly authorizes it | A bounded lane manifest with an explicit lane count and source budget; no open-ended browsing |

Routing rules:

```text
IF one bounded factual question:
  USE LOOKUP

ELSE IF the decision can be resolved by up to three questions:
  USE FOCUSED

ELSE IF DEEP research is explicitly authorized:
  USE DEEP

ELSE:
  REDUCE the request to FOCUSED and report any unresolved research need
```

DO NOT silently escalate from `LOOKUP` or `FOCUSED` to `DEEP`.
Risk alone permits stronger evidence requirements, not unlimited research or delegation.

## 3. Load one level contract

After routing, read exactly one matching reference:

- `LOOKUP`: [references/lookup.md](references/lookup.md)
- `FOCUSED`: [references/focused.md](references/focused.md)
- `DEEP`: [references/deep.md](references/deep.md)

DO NOT load the other level references.

## 4. Retain evidence, not pages

Keep a compact evidence ledger:

```yaml
- claim: "Decision-changing statement"
  finding: "One to three sentence distilled finding"
  source: "Direct URL or local source reference"
  evidence_type: "fact | reported-experience | inference | open-question"
  confidence: "high | medium | low"
  limitation: "Relevant caveat or null"
```

Do not retain raw HTML, long quotations, duplicate snippets, navigation text, or full search responses after extraction.
Structured notes are the handoff boundary between research steps and between agents.

## 5. Stop condition

STOP when every decision-changing claim has direct support and another independent source is unlikely to change the conclusion.
Do not consume the remaining source budget after the stop condition is met.

## 6. Output

- Return concise findings with direct citations, limitations, confidence, and unresolved questions.
- Label material claims as `fact`, `reported experience`, `inference`, or `open question`.
- For substantial standalone research, write one Markdown artifact using the repo convention.
- When nested inside another workflow, contribute to its designated artifact or return a bounded summary.
- Do not create a duplicate artifact or repeat the full evidence ledger in chat.
