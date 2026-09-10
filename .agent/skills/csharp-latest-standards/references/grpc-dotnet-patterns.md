# gRPC .NET Performance Patterns
<!-- last_synced: 2026-07-24 -->
<!-- source: learn.microsoft.com/aspnet/core/grpc + research -->

## TL;DR
1. **Channel reuse** → Dùng gRPC Client Factory, KHÔNG tạo channel mới mỗi lần gọi.
2. **Deadlines** → Luôn set deadline. Truyền `CancellationToken` xuyên suốt.
3. **Empty list guard** → Kiểm tra list rỗng trước khi gọi gRPC, trả về `Task.FromResult` nếu rỗng.
4. **Retry** → Dùng built-in retry policy với exponential backoff cho `StatusCode.Unavailable`.
5. **Compensation** → Khi gRPC remote chạy trước local DB commit → PHẢI có hoàn tác (rollback remote).

---

## 1. Channel & Connection Management

### Reuse Channels (BẮT BUỘC)
```csharp
// GOOD — đăng ký qua DI, channel được tái sử dụng tự động
services.AddGrpcClient<ProductService.ProductServiceClient>(o =>
{
    o.Address = new Uri("https://product-service:5001");
})
.ConfigurePrimaryHttpMessageHandler(() => new SocketsHttpHandler
{
    EnableMultipleHttp2Connections = true,  // Cho phép mở nhiều HTTP/2 connections
    KeepAlivePingDelay = TimeSpan.FromSeconds(60),
    KeepAlivePingTimeout = TimeSpan.FromSeconds(30)
});
```

### Anti-pattern: Tạo channel mới mỗi lần
```csharp
// BAD — tạo channel mới = TCP/TLS/HTTP2 handshake mỗi lần
var channel = GrpcChannel.ForAddress("https://service:5001");
var client = new ProductService.ProductServiceClient(channel);
```

---

## 2. Deadlines & Cancellation

### Luôn set Deadline (BẮT BUỘC)
```csharp
// GOOD — set deadline 5 giây
var deadline = DateTime.UtcNow.AddSeconds(5);
var response = await client.GetProductAsync(
    new GetProductRequest { Id = productId.ToString() },
    deadline: deadline,
    cancellationToken: cancellationToken
);
```

### Propagate CancellationToken
```csharp
// GOOD — trong service implementation
public override async Task<ProductResponse> GetProduct(
    GetProductRequest request,
    ServerCallContext context)
{
    // Truyền CancellationToken từ context xuống DB query
    var product = await _repository
        .FindByCondition(p => p.Id == Guid.Parse(request.Id))
        .AsNoTracking()
        .FirstOrDefaultAsync(context.CancellationToken);
    // ...
}
```

---

## 3. Empty List Guard (BẮT BUỘC — Cogain Rule)

```csharp
// GOOD — kiểm tra rỗng TRƯỚC KHI gọi gRPC
public async Task<List<CategoryDto>> GetCategoriesByIdsAsync(
    List<Guid> ids, CancellationToken ct)
{
    if (ids is not { Count: > 0 })
        return [];  // Collection expression C# 12

    var request = new GetCategoriesRequest();
    request.Ids.AddRange(ids.Select(id => id.ToString()));
    
    var response = await _categoryClient.GetCategoriesAsync(request, cancellationToken: ct);
    return _mapper.Map<List<CategoryDto>>(response.Categories);
}
```

---

## 4. Retry Policy

### Built-in Retry với Exponential Backoff
```csharp
// GOOD — cấu hình trong DI
services.AddGrpcClient<ProductService.ProductServiceClient>(o =>
{
    o.Address = new Uri("https://product-service:5001");
})
.ConfigureChannel(o =>
{
    o.ServiceConfig = new ServiceConfig
    {
        MethodConfigs =
        {
            new MethodConfig
            {
                Names = { MethodName.Default },
                RetryPolicy = new RetryPolicy
                {
                    MaxAttempts = 3,
                    InitialBackoff = TimeSpan.FromMilliseconds(200),
                    MaxBackoff = TimeSpan.FromSeconds(2),
                    BackoffMultiplier = 2,
                    RetryableStatusCodes = { StatusCode.Unavailable }
                }
            }
        }
    };
});
```

---

## 5. Interceptors

### Logging Interceptor (cross-cutting)
```csharp
public class LoggingInterceptor : Interceptor
{
    private readonly ILogger<LoggingInterceptor> _logger;

    public LoggingInterceptor(ILogger<LoggingInterceptor> logger) => _logger = logger;

    public override AsyncUnaryCall<TResponse> AsyncUnaryCall<TRequest, TResponse>(
        TRequest request,
        ClientInterceptorContext<TRequest, TResponse> context,
        AsyncUnaryCallContinuation<TRequest, TResponse> continuation)
    {
        _logger.LogInformation("gRPC call: {Method}", context.Method.FullName);
        return continuation(request, context);
    }
}
```

---

## 6. Protobuf Best Practices
1. **KHÔNG BAO GIỜ thay đổi field numbers** trong `.proto` files đã release — phá vỡ binary compatibility.
2. **Proto response type KHÔNG được thay đổi** — nếu cần thêm field, chỉ ADD field mới với number mới.
3. **Streaming** cho data sets lớn — tránh message đơn quá lớn (> 1MB).

---

## ⚠️ Cogain Adaptation Notes

1. **Compensation Pattern (BẮT BUỘC)**:
   - Khi gRPC write chạy trước local DB commit → PHẢI thiết kế hoàn tác remote khi local fail.
   - Trường `IsCommand` phải được truyền qua contract.
   ```csharp
   // Cogain pattern: compensation scope
   try
   {
       // Step 1: gRPC remote create
       var remoteResult = await _categoryClient.CreateAsync(remoteDto, ct);
       
       // Step 2: local DB commit
       await _unitOfWork.CommitAsync(ct);
   }
   catch
   {
       // Step 3: compensate — rollback remote
       await _categoryClient.DeleteAsync(
           new DeleteRequest { Id = remoteResult.Id, IsCommand = true }, ct);
       throw;
   }
   ```

2. **Include string case-sensitive**: Cogain dùng comma-separated include strings. Phải viết đúng chữ hoa/thường.

3. **gRPC Contracts location**: `BuildingBlocks/Contracts/Protos/` — tất cả `.proto` files nằm chung một nơi.
