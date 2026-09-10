# Clean Architecture, DDD & CQRS Patterns
<!-- last_synced: 2026-07-24 -->
<!-- source: dotnet/eShop, martinfowler.com, learn.microsoft.com/dotnet/architecture -->

## TL;DR
1. **Clean Architecture**: Domain → Application → Infrastructure → Presentation. Dependencies hướng vào trong.
2. **DDD Aggregate**: Cluster domain objects, đảm bảo consistency trong 1 transaction boundary.
3. **Bounded Context**: Chia domain phức tạp thành các ngữ cảnh riêng biệt → map tự nhiên với microservices.
4. **CQRS**: Tách read model (Query) và write model (Command). Chỉ dùng cho complex bounded contexts.
5. **Event Sourcing**: Lưu chuỗi events thay vì chỉ current state. Phù hợp cho audit trails.

---

## 1. Clean Architecture (Layered)

```
┌─────────────────────────────────┐
│         Presentation            │  ← Controllers, APIs
│    (depends on Application)     │
├─────────────────────────────────┤
│         Infrastructure          │  ← EF Core, gRPC clients, Redis
│    (implements interfaces)      │
├─────────────────────────────────┤
│          Application            │  ← Use cases, DTOs, Interfaces
│    (depends on Domain)          │
├─────────────────────────────────┤
│            Domain               │  ← Entities, Value Objects, Events
│      (no dependencies)          │
└─────────────────────────────────┘
```

### Nguyên tắc Dependency Inversion
- Domain layer **KHÔNG** phụ thuộc vào bất kỳ layer nào.
- Infrastructure implements interfaces định nghĩa trong Application/Domain.
- Dependencies luôn hướng **vào trong** (outer → inner).

---

## 2. DDD Core Concepts

### Aggregate & Aggregate Root
```csharp
// Aggregate Root — entry point duy nhất cho cluster
public class Order : EntityAuditBase<Guid>  // Aggregate Root
{
    private readonly List<OrderDetail> _details = [];
    
    public IReadOnlyCollection<OrderDetail> Details => _details.AsReadOnly();
    
    public void AddDetail(OrderDetail detail)
    {
        // Invariant validation tại aggregate root
        if (_details.Count >= 100)
            throw new DomainException("Order cannot have more than 100 details");
        _details.Add(detail);
    }
}
```

### Value Object
```csharp
// Value Object — so sánh bằng giá trị, không có identity
public record Money(decimal Amount, string Currency)
{
    public static Money Zero(string currency) => new(0, currency);
    public Money Add(Money other)
    {
        if (Currency != other.Currency) throw new DomainException("Currency mismatch");
        return this with { Amount = Amount + other.Amount };
    }
}
```

### Bounded Context
```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   HR Module  │  │  MasterData  │  │  ServiceDesk │
│              │  │              │  │              │
│  Employee    │  │  Product     │  │  Issue       │
│  Contract    │  │  Category    │  │  WorkItem    │
│  Department  │  │  Project     │  │  Drawing     │
└──────────────┘  └──────────────┘  └──────────────┘
     ↕ gRPC           ↕ gRPC            ↕ gRPC
```

---

## 3. CQRS Pattern

### Concept (Martin Fowler)
- **Command** (Write): Thay đổi state. Return void hoặc ID.
- **Query** (Read): Đọc state. Return data. KHÔNG thay đổi state.
- Tách model cho phép tối ưu read/write độc lập.

### Khi nào dùng CQRS
- ✅ Complex business rules cần write model khác read model.
- ✅ High-read workloads cần denormalized read views.
- ❌ **KHÔNG** dùng cho simple CRUD (overkill).

---

## 4. Event-Driven Patterns (từ eShop)

### Domain Events
```csharp
public class OrderCreatedEvent : IDomainEvent
{
    public Guid OrderId { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
}
```

### Integration Events (Cross-Service)
```csharp
// Publish qua EventBus (RabbitMQ)
public record OrderStatusChangedIntegrationEvent(
    Guid OrderId,
    EStatus OldStatus,
    EStatus NewStatus) : IntegrationEvent;
```

---

## 5. Martin Fowler Key Insights

1. **"Monolith First"**: Bắt đầu monolith, chỉ tách microservices khi hiểu rõ bounded contexts.
2. **CQRS chỉ cho complex contexts**: Không áp dụng CQRS cho toàn bộ hệ thống.
3. **Aggregate nên nhỏ**: Prefer smaller aggregates để giảm contention.
4. **Eventual Consistency**: Chấp nhận eventual consistency giữa bounded contexts.

---

## ⚠️ Cogain Adaptation Notes

> [!WARNING]
> **Pattern CQRS/MediatR từ eShop KHÔNG áp dụng trực tiếp vào Cogain.**

1. **Cogain KHÔNG dùng MediatR**: Service layer dùng `BaseService` + Hook pattern thay vì Command/Query handlers.
2. **CQRS concept áp dụng gián tiếp**: Cogain phân biệt read (GetPaged, GetById, GetDropdown) vs write (Create, Update, Delete) nhưng qua BaseService methods, không qua CQRS handlers.
3. **Bounded Context**: Cogain đã áp dụng — mỗi Module (HR, MasterData, ServiceDesk) là một bounded context riêng.
4. **Domain Events**: Cogain dùng gRPC integration events thay vì in-process domain events.
5. **DDD Aggregates**: Áp dụng concept aggregate root khi thiết kế Entity mới. Dùng `ReconcileCollections()` để đồng bộ child entities.
