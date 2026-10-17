# Martin Fowler — Microservices & DDD Wisdom
<!-- last_synced: 2026-07-24 -->
<!-- source: martinfowler.com -->

## TL;DR
1. **Monolith First**: Hiểu domain trước, tách microservices sau.
2. **CQRS chỉ cho complex contexts**: Đừng áp dụng khắp nơi.
3. **Bounded Context**: Ranh giới ngữ cảnh = ranh giới service = ranh giới team.
4. **Small Aggregates**: Aggregate nhỏ → ít contention → scale tốt hơn.
5. **Evolutionary Design**: Ưu tiên hệ thống có thể thay đổi, không phải hệ thống "hoàn hảo".

---

## 1. Microservices Principles (Fowler)

### Smart Endpoints, Dumb Pipes
- Logic nghiệp vụ nằm trong service, KHÔNG nằm trong message broker.
- Message broker (RabbitMQ) chỉ làm nhiệm vụ transport.

### Decentralized Data Management
- Mỗi service sở hữu database riêng.
- KHÔNG chia sẻ database giữa các services.
- Đồng bộ dữ liệu qua events (eventual consistency).

### Design for Failure
- Service downstream có thể fail bất kỳ lúc nào.
- Circuit Breaker pattern (Polly) cho external calls.
- Retry với exponential backoff.
- Graceful degradation: trả về cached data khi service khả dụng không cao.

---

## 2. Key Fowler Patterns

### Strangler Fig
- Migrate từ monolith sang microservices dần dần.
- Route traffic: requests mới → new service, requests cũ → legacy.
- Không rewrite Big Bang.

### Tolerant Reader
- Consumers chỉ đọc fields mình cần, bỏ qua fields không biết.
- Cho phép evolve API mà không break consumers.

### Consumer-Driven Contract
- Consumer định nghĩa contract → Provider test against consumer expectations.
- Phát hiện breaking changes trước khi deploy.

---

## 3. DDD Insights

### Aggregate Design Rules
1. **Protect invariants** trong aggregate boundary.
2. **Design small aggregates** — tránh God Aggregate.
3. **Reference other aggregates by ID**, không by direct object reference.
4. **Update one aggregate per transaction**.
5. **Use eventual consistency** across aggregates.

### Ubiquitous Language
- Domain experts và developers dùng cùng thuật ngữ.
- Code phản ánh ngôn ngữ domain, không phải technical jargon.

---

## 4. Anti-Patterns (Fowler Warns)

| Anti-Pattern | Vấn đề | Giải pháp |
|---|---|---|
| Distributed Monolith | Microservices nhưng tightly coupled | Tách đúng bounded contexts |
| Shared Database | Services share DB → coupling ẩn | Mỗi service có DB riêng |
| CQRS Everywhere | Overkill cho simple CRUD | Chỉ dùng cho complex domains |
| Premature Microservices | Tách trước khi hiểu domain | Monolith First approach |

---

## ⚠️ Cogain Adaptation Notes

1. **Cogain đã là microservices**: "Monolith First" KHÔNG áp dụng — hệ thống đã tách thành HR, MasterData, ServiceDesk, WorkFlow, ERP, BusinessDoc.
2. **Decentralized Data**: Mỗi module Cogain có DbContext riêng — đã tuân thủ.
3. **Cross-service communication**: Cogain dùng gRPC (synchronous) + Compensation pattern. Chưa có EventBus (RabbitMQ) — cân nhắc cho tương lai.
4. **Small Aggregates**: Entity Cogain nên tập trung vào aggregate root với child collections nhỏ. Dùng `ReconcileCollections()` cho đồng bộ.
