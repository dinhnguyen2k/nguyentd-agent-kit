---
name: cogain-query-cache
description: Maintains Cogain TanStack Query keys, mutations, invalidation, and cache consistency. Use when adding or changing frontend query hooks, mutation success handlers, optimistic updates, or cross-view refresh behavior.
metadata:
  version: 1.0.0
  layer: project-skill
---

# Cogain Query Cache

Query keys are an internal contract between reads, mutations, and every screen that consumes the same server state.

## Start From Local Evidence

Inspect the target app's nearest hook and all uses of its base key. Do not copy a key convention from another app if the same domain already has a local owner.

Common current families include:

- detail: `[queryKey, id, ...shape]`
- paged list: ``[`${queryKey}s`, serializedParams]``
- all: ``[`${queryKey}-all`, serializedParams]``
- dropdown: ``[`${queryKey}-dropdown`, serializedParams]``

These are observed patterns, not permission to invent aliases. Preserve existing key strings during local changes unless migrating every producer and consumer.

## Mutation Procedure

1. List the views whose server truth changes: detail, paged list, all, dropdown, aggregates, and dependent domains.
2. Invalidate or update the narrowest stable key prefix for each affected view.
3. Avoid exact parameter-key invalidation when all parameter variants are stale.
4. Use optimistic updates only when rollback and concurrent mutation behavior are explicit.
5. Keep success toasts/navigation separate from cache correctness.

## Boundaries

- Do not use a UI label as a query key.
- Do not serialize unstable objects/functions into keys.
- Do not invalidate unrelated global caches to hide a missing dependency.
- Do not create duplicate singular/plural keys without checking existing consumers.
- Do not treat Zustand or component state as a replacement for server-state invalidation.

## Verification

- After create/update/delete, every affected open view converges to server truth without a full reload.
- Key prefixes match existing producers/consumers.
- Disabled queries and conditional IDs cannot trigger invalid requests.
- Target app lint/build and focused hook/component tests pass when available.
