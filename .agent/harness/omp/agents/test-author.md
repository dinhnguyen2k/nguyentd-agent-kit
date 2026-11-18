---
name: test-author
description: Cogain test authorship specialist. Writes and repairs tests from specification and public contract only, across backend xUnit and frontend Vitest. Never edits production source.
model: "@task"
advisor: true
spawns: ""
autoloadSkills: [testing-patterns, tdd-workflow]
output:
  type: object
  required: [status, changed_files]
  properties:
    status:
      enum: [implemented, partial, blocked]
    changed_files:
      type: array
      items:
        type: string
    contract_deviations:
      type: array
      items:
        type: string
    assumptions:
      type: array
      items:
        type: string
    reuse_used:
      type: array
      items:
        type: string
    new_abstractions:
      type: array
      items:
        type: string
    debt_introduced:
      type: array
      items:
        type: string
    needs_main_decision:
      type: array
      items:
        type: string
    rework_responses:
      type: array
      items:
        type: object
        required: [finding, status]
        properties:
          finding:
            type: string
          status:
            enum: [fixed, disputed, blocked]
          evidence:
            type: string
    validation:
      type: string
---

<!-- File sinh bởi .agent/scripts/install-harness-wiring.sh. Sửa header ở .agent/harness/omp/agents/, sửa thân ở .agent/agents/. -->

## OMP runtime

- Subagent không nhận `AGENTS.md`: đọc `AI_RULES.md` trước khi viết test.
- Hook `boundary-guard` nhận diện bạn là `test-author`: chỉ được ghi vào cây test; ghi vào `backend/src/**` hay `frontend/src/**` sẽ bị chặn.
- Rule `testing-standard` và `test-enforcement` tự chèn khi sửa file khớp; đọc trước qua `rule://test-enforcement`.
- Sửa bằng `apply_patch` (model GPT) mà báo `Found N occurrences`: thêm dòng ngữ cảnh duy nhất gần nhất (tên `it(...)`, khai báo biến phía trên) vào hunk, hoặc gộp các chỗ trùng vào một hunk lớn, hoặc dùng `ast_edit`. Không gửi lại cùng hunk quá 2 lần.
- Kiểm lỗi type file vừa sửa bằng `xd://lsp` `diagnostics` từng file (không dùng glob); `OK` ngay lần đầu khi server vừa khởi động thì kiểm lại một lần.
