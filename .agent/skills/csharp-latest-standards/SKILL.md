---
name: csharp-latest-standards
description: 'Use when checking whether C#/.NET guidance is current and applicable to Cogain .NET 8 backend work before adopting newer language or framework patterns.'
metadata:
  category: 'engineering'
  version: '2.1.0'
  layer: 'project-skill'
---

# .NET and C# Freshness Gate

Cogain backend currently targets .NET 8. Treat newer C#, .NET, EF Core, ASP.NET Core, or gRPC guidance as evidence to verify, not as an automatic migration target.

## Use This Skill When

- A task proposes adopting new .NET/C# syntax or framework behavior.
- A reference claims a newer Microsoft API, EF Core feature, or ASP.NET Core pattern is now recommended.
- You need to decide whether external .NET guidance applies to current Cogain backend code.

Do not use this skill for routine backend edits that are already covered by `backend-development`, `cogain-baseservice-hooks`, `cogain-child-sync`, or `postgresql`.

## Decision Rules

1. Check Cogain truth first: project files, `TargetFramework`, package versions, source code, tests, and `AI_RULES.md`.
2. Bind advice to actual versions. For this repo, default to `.NET 8` and current package references unless code proves otherwise.
3. Prefer official Microsoft docs, release notes, and maintainer repositories for current facts.
4. Treat blog/social/expert posts as discovery leads until corroborated by official docs or Cogain source.
5. Do not update `SKILL.md` or reference files directly from crawler output. Follow `.agent/knowledge/skill-governance.json`.

## Reference Routing

Read only the relevant reference:

| Context                                            | Reference                                |
| -------------------------------------------------- | ---------------------------------------- |
| EF Core, LINQ, query behavior, PostgreSQL provider | `references/efcore-best-practices.md`    |
| ASP.NET Core controllers, middleware, DI, auth     | `references/aspnet-core-patterns.md`     |
| gRPC or proto compatibility                        | `references/grpc-dotnet-patterns.md`     |
| C# syntax newer than the repo baseline             | `references/csharp-whats-new.md`         |
| Clean Architecture or DDD trade-offs               | `references/clean-architecture-ddd.md`   |
| Docker guidance for .NET services                  | `references/docker-kubernetes-dotnet.md` |
| Azure architecture guidance                        | `references/azure-well-architected.md`   |

If a reference has stale metadata or contradicts source code, report the mismatch and use official docs as runtime evidence.

## Cogain Constraints

- Do not use primary constructors for classes inheriting `BaseService` unless source code proves the constructor shape is safe.
- Do not replace Cogain BaseService hooks with CQRS/MediatR patterns without an explicit architecture decision.
- Do not adopt preview language features in production code unless the project is configured for them and the owner approves.
- Do not claim a newer standard is applicable until build/test evidence or official version evidence supports it.

## Freshness Workflow

Crawler scripts under `scripts/` are proposal inputs only. Before publishing any change:

1. Record source URL, source version or hash, fetched date, and applies-to version.
2. Compare against Cogain source and package/runtime versions.
3. Run static validation and relevant behavior evals.
4. Publish only after human approval.
