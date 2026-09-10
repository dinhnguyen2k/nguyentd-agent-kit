# Database Scaling & Partitioning

- **Horizontal partitioning**: Table partitioning, range/hash/list partitioning
- **Vertical partitioning**: Column store optimization, data archiving strategies
- **Sharding strategies**: Application-level sharding, database sharding, shard key design
- **Read scaling**: Read replicas, load balancing, eventual consistency management
- **Write scaling**: Write optimization, batch processing, asynchronous writes
- **Cloud scaling**: Auto-scaling databases, serverless databases, elastic pools

## Hard Usage Notes

- Always classify workload before proposing scaling strategy: `OLTP`, `Report/Analytics`, `Background Job`.
- Require 1-3 representative queries for impacted access patterns.
- Do not partition/shard by default; justify with observed bottleneck or growth target.
- For OLTP hot paths, require execution-plan evidence and index support before proposing partitioning.
