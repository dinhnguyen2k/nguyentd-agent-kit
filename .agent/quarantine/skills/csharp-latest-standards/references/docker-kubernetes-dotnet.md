# Docker & Kubernetes for .NET Microservices
<!-- last_synced: 2026-07-24 -->
<!-- source: learn.microsoft.com + kubernetes.io + research -->

## TL;DR
1. **Multi-stage build**: Build stage + Runtime stage (`mcr.microsoft.com/dotnet/aspnet`).
2. **Non-root user**: KHÔNG chạy container as root.
3. **K8s Probes**: Liveness (`/health/live`) ≠ Readiness (`/health/ready`) — cấu hình riêng.
4. **Resource limits**: Luôn set cả requests và limits. Buffer 1.5-2x cho bursts.
5. **Graceful shutdown**: Handle `SIGTERM` đúng cách, drain connections trước khi stop.

---

## 1. Dockerfile Best Practices

```dockerfile
# Stage 1: Build
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY ["src/Services/HR/HR.API/HR.API.csproj", "Services/HR/HR.API/"]
RUN dotnet restore "Services/HR/HR.API/HR.API.csproj"
COPY src/ .
RUN dotnet publish "Services/HR/HR.API/HR.API.csproj" \
    -c Release -o /app/publish --no-restore

# Stage 2: Runtime (lean image)
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

# Non-root user
RUN adduser --disabled-password --no-create-home appuser
USER appuser

COPY --from=build /app/publish .
EXPOSE 8080
ENTRYPOINT ["dotnet", "HR.API.dll"]
```

---

## 2. Kubernetes Health Probes

```yaml
# deployment.yaml
spec:
  containers:
  - name: hr-api
    image: cogain/hr-api:latest
    ports:
    - containerPort: 8080
    
    # Startup probe: cho slow-starting apps
    startupProbe:
      httpGet:
        path: /health/live
        port: 8080
      failureThreshold: 30
      periodSeconds: 2
    
    # Liveness: chỉ check process alive
    livenessProbe:
      httpGet:
        path: /health/live
        port: 8080
      periodSeconds: 15
      failureThreshold: 3
    
    # Readiness: check dependencies (DB, Redis)
    readinessProbe:
      httpGet:
        path: /health/ready
        port: 8080
      periodSeconds: 10
      failureThreshold: 3
```

---

## 3. Resource Management

```yaml
resources:
  requests:
    cpu: "250m"      # Guaranteed minimum
    memory: "256Mi"
  limits:
    cpu: "500m"      # Hard ceiling (throttle khi vượt)
    memory: "512Mi"  # OOMKill khi vượt
```

### Sizing Strategy
- **requests** = average steady-state usage (monitor via `kubectl top`)
- **limits** = 1.5-2x requests (cho phép burst)
- Không bao giờ bỏ trống limits → tránh noisy neighbor

---

## 4. Configuration Management

```yaml
# ConfigMap cho non-sensitive config
apiVersion: v1
kind: ConfigMap
metadata:
  name: hr-api-config
data:
  ASPNETCORE_ENVIRONMENT: "Staging"
  ConnectionStrings__DefaultConnection: "Host=postgres;Database=hr"
---
# Secret cho sensitive data
apiVersion: v1
kind: Secret
metadata:
  name: hr-api-secrets
type: Opaque
data:
  Redis__Password: base64encoded==
```

---

## 5. Graceful Shutdown (.NET)

```csharp
// Program.cs — handle SIGTERM
var app = builder.Build();

app.Lifetime.ApplicationStopping.Register(() =>
{
    // Drain connections, flush logs
    Log.Information("Application shutting down gracefully...");
    Log.CloseAndFlush();
});
```

---

## ⚠️ Cogain Adaptation Notes

1. **Cogain dùng Docker Compose / On-premise**: Không phải Azure AKS. Áp dụng K8s principles cho infra hiện tại.
2. **Health Checks**: Dùng `Microsoft.Extensions.Diagnostics.HealthChecks` với PostgreSQL + Redis checks.
3. **Configuration**: Dùng `appsettings.{Environment}.json` + environment variables. Secrets qua K8s Secrets hoặc Vault.
