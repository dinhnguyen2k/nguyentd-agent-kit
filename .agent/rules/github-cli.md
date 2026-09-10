---
trigger: model_decision
description: "When the task touches GitHub: pull requests, issues, releases, gh CLI, or GitHub API calls."
---

# GITHUB-CLI.MD - Gọi GitHub qua CLI

Ưu tiên `npx -y gh-axi <command>` thay cho `gh` thô: output TOON, tốn ít token hơn.
`gh-axi` bọc `gh`, nên `gh` vẫn phải được cài và đã đăng nhập.
`npx -y gh-axi --help` liệt kê lệnh; chỉ rơi về `gh` thô khi không có lệnh nào khớp.
