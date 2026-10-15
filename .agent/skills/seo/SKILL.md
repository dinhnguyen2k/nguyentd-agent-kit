---
name: seo
description: "Tối ưu SEO/GEO để lên Top Google và AI Search. Use when optimizing meta tags, search engine visibility, or structured data."
---

# /seo - Strategic Visibility & GEO Optimization

$ARGUMENTS

## Quyền thực thi và artifact

- Yêu cầu audit/check/inspect chỉ trả lời findings và dẫn chứng trong chat, không sửa nội dung hoặc tạo file nếu chưa có quyền ghi riêng.
- Chỉ thực hiện Phase 3 khi user yêu cầu triển khai; quyền sửa không cấp quyền chạy validation.
- Một slice chỉ cần contract/checkpoint gọn khi handoff/resume cần nó; nhiều slice dùng `.agent/planning/{task-slug}/00-OVERVIEW.md` và `TASK-*.md` theo `/plan`.
- Scope/acceptance thuộc TASK canonical; overview chỉ index/link, chỉ coordinator cập nhật lifecycle.
- Lane governed dẫn xuất manifest từ metadata TASK bằng parser canonical, không sửa tay manifest hoặc sao chép acceptance.
- Packet handoff tham chiếu identity của contract snapshot và quan hệ supersession; không tạo thêm PLAN, implementation_plan, walkthrough hoặc handoff chỉ để lặp lại contract.
- Giữ Search Visibility Report hoặc tài liệu sản phẩm độc nhất khi user yêu cầu rõ, tại path được cấp quyền.
- Research chỉ persist khi được yêu cầu, trong `.agent/artifacts`, không ghi mới vào `reports/artifacts`.

---

## 🟢 PHASE 1: Semantic Discovery
**Execution role**: `SEO review role` & `codebase discovery role`
**Mission**: Map the "Search Landscape."
- **Action**: Identify target keywords and "Search Intent."
- **Action**: Audit current Meta Tags, Headers, and Alt text.
- **DNA Link**: Check `rules/seo-fundamentals.md`.

## 🟡 PHASE 2: Technical & GEO Audit
**Execution role**: `SEO review role`
**Mission**: Optimize for AI Search (GEO).
- **Checks**:
  - High-density information?
  - Cited sources and authority?
  - JSON-LD / Schema richness?
  - Core Web Vitals impact?

## 🔵 PHASE 3: Surgical Content Optimization
**Execution role**: `documentation-writer` & `frontend-specialist`
**Mission**: Implement the findings.
- **Action**: Update Page Titles, Descriptions, and Semantic HTML.
- **Action**: Inject structured data (Schema.org).

## 🔴 PHASE 4: Visibility Gating
**Execution role**: `verification role`
**Mission**: Certify the "Search-Ready" status.
- **Verification**: Chỉ chạy Lighthouse SEO audit khi user yêu cầu đúng hành động này; chưa chạy thì không chứng nhận "Search-Ready".
- **Output**: Trả findings, dẫn chứng và validation status trong chat; chỉ lưu Search Visibility Report khi user yêu cầu rõ, không tự tạo `walkthrough.md`.

---

## SEO Objectives:
- **100/100**: Target Lighthouse SEO score.
- **GEO-Ready**: Content must be high-signal for AI crawlers.
- **Accessible**: Semantic HTML is good for both bots and humans.

---

## Examples:
- `/seo audit product page`
- `/seo optimize blog post for AI search`
- `/seo check schema.org implementation`
