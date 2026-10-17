---
name: seo
description: Tối ưu hóa công cụ tìm kiếm (SEO) và tìm kiếm AI (GEO) cho website PHP
---

# /seo - Strategic Visibility & SEO/GEO Optimization

$ARGUMENTS

---

## 🟢 PHASE 1: Semantic Discovery
**Execution role**: `orchestrator`
**Nhiệm vụ**: Đánh giá hiện trạng SEO trên các trang web PHP.
- Rà soát các thẻ meta trong `layout/header.php` và các file trang (`index.php`, `tour-detail.php`, `blog-detail.php`, `visa-detail.php`).
- Kiểm tra cơ chế sinh động tiêu đề trang (`<title>`), thẻ meta description, thẻ canonical URL.
- Kiểm tra tính đầy đủ của thuộc tính `alt` cho hình ảnh tour, bài viết trong `images/**`.

## 🟡 PHASE 2: Technical & Structured Data Audit
**Execution role**: `verifier`
**Nhiệm vụ**: Kiểm tra các yếu tố kỹ thuật và dữ liệu có cấu trúc:
- Thẻ OpenGraph (`og:title`, `og:description`, `og:image`, `og:url`) cho việc chia sẻ mạng xã hội.
- Cấu trúc dữ liệu JSON-LD (Schema.org): `TouristTrip`, `Product`, `Article`, hoặc `LocalBusiness`.
- Thẻ meta robots, sitemap XML và robots.txt nếu có.

## 🔵 PHASE 3: Surgical Content & Template Optimization
**Execution role**: `frontend-specialist` (với sự hỗ trợ dữ liệu từ `backend-specialist`)
**Nhiệm vụ**: Triển khai tối ưu vào template PHP:
- Đảm bảo mỗi trang chỉ có một thẻ `<h1>` duy nhất mang từ khóa trọng tâm.
- Tạo cấu trúc biến PHP cho SEO trong từng trang:
  ```php
  $pageTitle = htmlspecialchars($tour['ten_tour'] ?? 'Du Lịch Long Phát');
  $pageDescription = htmlspecialchars($tour['mo_ta_ngan'] ?? '');
  ```
- Nhúng schema JSON-LD chuẩn vào `layout/header.php` hoặc cuối trang.
- Sử dụng HTML5 semantic (`<main>`, `<article>`, `<section>`, `<nav>`, `<aside>`).

## 🔴 PHASE 4: Visibility Gating & Sign-off
**Execution role**: `verifier`
**Nhiệm vụ**: Xác nhận tính toàn vẹn của mã SEO.
- Kiểm tra cú pháp JSON-LD không bị lỗi.
- Đảm bảo các thẻ meta không bị vỡ do ký tự tiếng Việt đặc biệt (luôn escape đúng).
- Cập nhật báo cáo tối ưu SEO vào `walkthrough.md`.

---

## Tiêu chí SEO:
- **Ngữ nghĩa chuẩn**: HTML rõ ràng, dễ phân tích cho cả Google bot và AI Search crawlers.
- **Tự động hóa an toàn**: Dữ liệu động từ CSDL MySQL được format và escape chuẩn xác.
- **Thân thiện di động**: Tối ưu tốc độ tải và responsive layout.

---

## Ví dụ:
- `/seo audit tour detail metadata`
- `/seo add schema json-ld for tour packages`
- `/seo optimize blog detail for ai search`
