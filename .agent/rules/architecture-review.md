---
trigger: model_decision
description: "When the change touches a production risk surface: DB transaction boundary, external call (HTTP/gRPC/3rd-party), MassTransit publish or consume, background job/Hangfire, Redis cache, list endpoint pagination or index on a large table, public endpoint auth/rate limit, EF migration rollout, or infra config (docker-compose, Dockerfile, ocelot, terraform)."
---

# ARCHITECTURE-REVIEW.MD - Enterprise System Integrity

> Mục tiêu: review kiến trúc bám sát hệ thống hiện tại (.NET 8 microservices + Ocelot + gRPC + MassTransit + Redis + PostgreSQL + React SPA), tập trung vào rủi ro production và khả năng vận hành.

---

## 1. Review Scope And Priority

### 1.0 Scope Gate - Đọc trước
- Rule này nạp theo `model_decision`, không phải theo loại file.
Chỉ áp các mục tương ứng với **risk surface mà change thực sự chạm**, không chạy hết 15 mục cho mọi thay đổi backend.
- Mapping nhanh: transaction/write nghiệp vụ -> §5; gọi HTTP/gRPC/3rd-party -> §3; publish/consume MassTransit hoặc Hangfire -> §6; list/query bảng lớn -> §7; endpoint public -> §4, §8; migration -> §5, §13; docker-compose/Dockerfile/ocelot/terraform -> §9.
- Change không chạm risk surface nào (đổi mapping DTO, sửa validation message, rename, style) thì **không phát sinh finding từ file này**.
Im lặng là kết quả hợp lệ.
- Trần độ phức tạp vẫn là `.agent/rules/solution-complexity.md`.
Không đề xuất outbox, circuit breaker, saga hay queue cho flow chưa có nhu cầu hiện tại chỉ vì rule có liệt kê chúng.

- Ưu tiên kiểm tra các điểm dễ gây downtime hoặc mất dữ liệu:
   - External call (HTTP/gRPC/3rd-party) không timeout/retry/circuit breaker.
   - DB transaction bao external call hoặc kéo dài bất thường.
   - Event publishing không có Outbox/compensation khi cần tính nhất quán.
   - Background job/consumer không có retry policy và DLQ/failure tracking.
   - Public API thiếu rate limit, request size limit hoặc auth guard.
- Với repo này, luôn rà theo các thành phần hiện hữu:
   - Ocelot gateway.
   - ASP.NET Core APIs theo từng service.
   - gRPC nội bộ.
   - MassTransit (RabbitMQ/Kafka).
   - Hangfire/background workers.
   - Redis cache/backplane.
   - PostgreSQL + EF Core migrations.

---

## 2. Scalability And State Management

### 2.1 Stateless Service - MUST
- Cảnh báo nếu phát hiện:
   - Session/login state giữ trong process memory hoặc static mutable state.
   - Workflow quan trọng phụ thuộc local disk/local memory của một instance.
   - SignalR/WebSocket state không có scale-out strategy (Redis backplane hoặc tương đương).

### 2.2 Horizontal Scaling - MUST
- Cảnh báo nếu phát hiện:
   - Logic buộc chạy single instance nhưng không ghi rõ trade-off.
   - Scheduled job có thể chạy trùng ở nhiều replica mà không có distributed lock/idempotency.
   - Thiết kế phụ thuộc hostname/IP cố định.

---

## 3. Resilience And Fault Tolerance

### 3.1 Timeout - MUST
- Mọi external dependency call phải có timeout rõ ràng:
   - HTTP/gRPC.
   - Redis.
   - DB query command timeout.
   - Message broker interaction khi phù hợp.

### 3.2 Retry With Backoff - SHOULD
- Retry chỉ áp dụng cho lỗi transient.
- Cảnh báo nếu retry vô hạn hoặc retry lỗi nghiệp vụ (validation, duplicate key, business rule violation).

### 3.3 Circuit Breaker - MUST For Unstable Dependency
- Bắt buộc với 3rd-party hoặc internal dependency có nguy cơ fail dây chuyền.
- Cảnh báo nếu một dependency chết có thể làm nghẽn request queue/thread pool mà không có fallback/degrade.

### 3.4 Bulkhead And Graceful Degradation - SHOULD
- Cảnh báo nếu tác vụ nặng (import/export/report/sync) chạy thẳng trong HTTP request path.
- Ưu tiên queue/worker và fallback behavior cho tính năng không critical.

---

## 4. API Gateway And Traffic Control

### 4.1 Public API Rate Limiting - MUST
- Cảnh báo nếu endpoint public thiếu rate limiting theo IP/user/client.

### 4.2 Request Size Limit - MUST
- Cảnh báo nếu upload/body/import không giới hạn kích thước hoặc số lượng bản ghi.

### 4.3 Versioning And Compatibility - SHOULD
- Cảnh báo nếu API public có breaking change nhưng không version/deprecation strategy.

---

## 5. Data Consistency And Transaction Boundary

### 5.1 Transaction Boundary - MUST
- Cảnh báo nếu mở DB transaction rồi gọi external dependency trước khi commit.
- Transaction phải ngắn, tập trung phần DB write.

### 5.2 Idempotency - MUST For Critical Writes
- Áp dụng cho payment/order/import/webhook/consumer.
- Cảnh báo nếu retry có thể gây double-processing.

### 5.3 Outbox And Compensation - MUST/SHOULD By Context
- MUST khi DB write và event publish cần nhất quán nghiệp vụ.
- Cảnh báo nếu SaveChanges xong publish trực tiếp mà không có outbox/retry/compensation rõ ràng.

### 5.4 Saga/Workflow Reliability - SHOULD
- Với flow nhiều service, yêu cầu có saga/compensation hoặc equivalent strategy.

---

## 6. Queue And Background Processing

### 6.1 Long-running Task Offloading - MUST
- Import/export/sync/report/AI processing phải qua queue hoặc background worker.

### 6.2 Retry And DLQ - MUST For Important Async Flow
- Cảnh báo nếu message fail bị nuốt hoặc không có dead-letter/failure tracking/replay path.

### 6.3 Consumer Concurrency Control - SHOULD
- Cảnh báo nếu worker consume không giới hạn concurrency làm nghẽn DB/downstream API.

---

## 7. Database Scalability

### 7.1 Indexing And Query Shape - MUST
- Cảnh báo nếu query critical filter/order/join trên bảng lớn mà thiếu index phù hợp.

### 7.2 Pagination - MUST
- Cảnh báo nếu endpoint list trả full dataset hoặc paging sau khi load vào memory.

### 7.3 Connection Pool And Timeout - MUST
- Cảnh báo nếu thiếu giới hạn connection/query timeout hoặc giữ DbContext/transaction quá lâu.

---

## 8. Security And Configuration

### 8.1 Secret Management - MUST
- Cảnh báo nếu secret/token/password xuất hiện trong source/config/Dockerfile.

### 8.2 Least Privilege - MUST
- Cảnh báo nếu app dùng quyền DB/IAM quá rộng so với nhu cầu.

### 8.3 TLS And Certificate Hygiene - MUST For Production
- Cảnh báo nếu dùng HTTP plain cho traffic nhạy cảm hoặc tắt certificate validation.

---

## 9. Infrastructure And Operations

### 9.1 Immutable Infra - MUST
- Không chấp nhận vận hành production bằng sửa tay ngoài IaC/pipeline như cách mặc định.

### 9.2 Environment Parity - SHOULD
- Cảnh báo khi Staging thiếu thành phần Prod đang dùng (queue/cache/gateway) làm test mất ý nghĩa.

### 9.3 Resource Limits - MUST
- Cảnh báo nếu workload không có CPU/memory request-limit (hoặc cấu hình tương đương).

### 9.4 Autoscaling Readiness - SHOULD
- Khuyến nghị có policy scale cho service critical khi traffic biến động.

---

## 10. Observability And Incident Readiness

### 10.1 Structured Logging - MUST
- Mỗi request/job/message phải có correlation id/trace id.

### 10.2 Metrics - MUST
- Cần tối thiểu: request rate, error rate, latency p95/p99, queue depth, job failures, resource usage.

### 10.3 Distributed Tracing - SHOULD/MUST By Topology
- MUST khi flow đi qua nhiều service hoặc qua gRPC/message bus.

### 10.4 Alerting - MUST
- Cảnh báo nếu chỉ có dashboard mà thiếu alert chủ động cho lỗi critical.

---

## 11. Disaster Recovery

### 11.1 Backup Policy - MUST
- DB production phải có automated backup + retention + off-host/offsite storage.

### 11.2 Restore Drill - MUST
- Backup không có restore test định kỳ thì xem như chưa đáng tin.

### 11.3 RPO/RTO - MUST
- Hệ thống critical phải có RPO/RTO rõ và khớp với chiến lược HA/backup.

---

## 12. Microservice Boundary Checks

### 12.1 Service Boundary - MUST
- Cảnh báo nếu service boundary lệch business capability dẫn tới distributed monolith.

### 12.2 Data Ownership - SHOULD/MUST By Maturity
- Cảnh báo nếu service query trực tiếp DB/table của service khác.

### 12.3 Long Sync Call Chain - SHOULD
- Cảnh báo chuỗi call đồng bộ dài (Gateway -> A -> B -> C -> external) gây cộng dồn latency và lan truyền lỗi.

---

## 13. Severity Classification

### BLOCKER
- Secret hardcode.
- Public API thiếu auth/rate limit ở production.
- External call không timeout.
- Migration phá backward compatibility nghiêm trọng.
- Không có backup strategy cho production DB.
- Transaction bao external call gây lock/rủi ro downtime.
- Async flow quan trọng không có retry/DLQ/outbox.

### MAJOR
- Thiếu circuit breaker cho dependency critical.
- Thiếu health/readiness checks.
- Thiếu metrics/alert cốt lõi.
- Thiếu resource limit.
- Thiếu idempotency cho critical write API.
- Long-running task xử lý trong HTTP request.
- Query lớn thiếu index/pagination.

### MINOR
- Chưa có autoscaling/tracing đầy đủ.
- Environment parity chưa tốt.
- Cache chưa có stampede protection.
- Boundary module/service còn lỏng.

---

## 14. Required Review Output Format

Khi review, bắt buộc trả theo mẫu:

Finding:
Risk:
Evidence:
Severity:
Recommendation:
Suggested Fix:

Không dùng nhận xét chung chung kiểu "cần tối ưu kiến trúc" mà không có bằng chứng cụ thể theo file/code/config.

---

## 15. Practical Defaults (When Spec Is Incomplete)

- API service production: >= 2 replicas cho service critical.
- Public API: bật rate limit.
- External call: timeout + bounded retry + circuit breaker.
- DB: automated backup + restore drill định kỳ.
- Queue/job: retry + DLQ/failure table.
- Container/workload: resource requests/limits.
- Logs: structured + correlation id.
- Metrics: latency, error rate, throughput.
- DB migration: backward-compatible rollout (expand -> migrate -> switch -> contract).
- Long-running task: queue/worker.
- Critical write API: idempotency key hoặc equivalent dedup strategy.
