---
name: requesting-code-review
description: Use before merging governed work or when an explicit independent review is requested.
metadata:
  version: "4.1.0-cogain"
---

# Cogain Independent Review

For governed work, pass the Task Manifest, diff, validation commands/results, and
residual risks to the registered read-only `verifier`.

The verifier returns `pass`, `fail`, or `blocked` with evidence mapped to each
acceptance criterion. It must not edit the source. A `fail` returns to the owning
worker for a bounded retry; a `blocked` result identifies the missing authority or
input. Local work uses self-validation unless the user asks for independent review.

Never treat a reviewer persona name, a commit SHA, or an external tool as required
unless it exists in the current registry/harness.
