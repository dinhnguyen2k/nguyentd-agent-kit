# ORM Selection (2025)

> Choose ORM based on deployment and DX needs.

## Decision Tree

```
What's the context?
│
├── Cogain backend
│   └── Entity Framework Core
│
├── Edge deployment / Bundle size matters outside Cogain
│   └── SQL-like lightweight mapper/query builder
│
├── Best DX / Schema-first
│   └── Use only after an explicit non-Cogain architecture decision
│
├── Maximum control
│   └── Raw SQL with query builder
│
└── Python ecosystem
    └── SQLAlchemy 2.0 (async support)
```

## Comparison

| ORM                        | Best For                 | Trade-offs                                  |
| -------------------------- | ------------------------ | ------------------------------------------- |
| **EF Core**                | Cogain .NET services     | Requires careful query and migration review |
| **Lightweight TS mappers** | Edge, TypeScript         | Not a Cogain backend default                |
| **Kysely**                 | Type-safe SQL builder    | Manual migrations                           |
| **Raw SQL**                | Complex queries, control | Manual type safety                          |
