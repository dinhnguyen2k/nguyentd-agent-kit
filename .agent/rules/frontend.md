---
trigger: glob
glob: "frontend/**/*"
description: "Router FE: đọc reference phù hợp trước lần sửa đầu tiên của từng file."
condition: ["frontend/**/*"]
paths: ["frontend/**/*"]
interruptMode: never
---

# Frontend

Trước lần sửa đầu tiên của từng file, đọc đúng mục trong `.agent/rules/references/frontend.md`, không nạp toàn bộ reference.

| File đang chạm | Mục phải đọc |
| --- | --- |
| Mọi file FE | Chung, Quy ước import module từ @shared |
| Index page/danh sách bảng | Index page |
| Route, form, schema | Routes và forms |
| Type, enum/options, hook, service | Data flow và shared contracts |
| Lookup, table control | Lookup và table |
| Import/export dữ liệu Excel | Import/export |
| Import module, shared UI/component | Quy ước import module từ @shared |
