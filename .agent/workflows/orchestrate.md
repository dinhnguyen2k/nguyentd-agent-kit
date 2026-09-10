---
name: orchestrate
description: Route governed Cogain work to the right specialist with explicit ownership and independent evidence.
---

# /orchestrate - Governed Work Only

Use this workflow when the user explicitly asks for orchestration or the task is
cross-domain, high-risk, parallel, or likely to require a long handoff. Do not
invoke it for ordinary local work.

## 1. Classify Before Loading Context

| Tier | Conditions | Required process |
| --- | --- | --- |
| `fast` | One existing domain, local behavior, no risky label | Route directly; source + nearest test/pattern; self-validation |
| `standard` | One owner, multiple local files, no risky label | Short task summary; selective context; self-validation with evidence |
| `governed` | Cross-domain, public contract, migration, permission, money, inventory, production, parallel write, or long handoff | Task Manifest, disjoint ownership, independent verifier |

If a task can be handled as `fast` or `standard`, stop here and use the routed
specialist. A formal plan, manifest, or extra agent is not a quality signal by
itself.

## 2. Governed Task Contract

Create a manifest conforming to `.agent/contracts/task-manifest.schema.json`.
It must state the owner, allowed paths, acceptance criteria, validation commands,
stop conditions, risk labels, and evidence handoff.

- Parallel workers may run only with disjoint `allowed_paths`.
- Backend/frontend contract work is sequenced unless ownership is truly disjoint.
- No worker may merge, deploy, or execute destructive production actions.
- Require human approval for breaking, destructive, or product-decision changes.

## 3. Execute and Verify

1. Each worker reads only the manifest, target source, nearest tests, and the
   context triggered by the task.
2. The worker runs its narrowest validation and returns command evidence.
3. The read-only `verifier` independently checks the manifest criteria and returns
   `pass`, `fail`, or `blocked` with evidence.
4. On `fail`, return to the owning worker with one bounded retry. On `blocked`,
   preserve the reason as a residual risk and request the missing authority/input.

## Failure Conditions

Reject a governed result when any of these occur:

- an unregistered agent, command, script, or tool is required;
- write boundaries overlap without sequencing;
- manifest, validation result, or residual risk is missing;
- a verifier claims success without command/source evidence;
- a worker attempts a merge, deploy, or destructive action without authorization.
