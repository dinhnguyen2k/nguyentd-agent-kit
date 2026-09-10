# 🤖 NguyenTD Agent Kit

Bộ não AI Agent toàn diện cho lập trình viên: **Rules**, **Opinion**, **Skills**, và **Workflows** tối ưu hóa cho Antigravity, Claude Code, Gemini CLI và GitHub Copilot.

---

## ⚡ Cài đặt nhanh vào bất kỳ dự án nào (Chỉ 1 lệnh)

Mở terminal tại thư mục gốc của dự án mới và chạy một trong hai cách sau:

### Cách 1: Dùng `npx degit` (Khuyên dùng - Siêu tốc 2 giây)
```bash
npx degit dinhnguyen2k/nguyentd-agent-kit . --force
```

### Cách 2: Dùng `npx github` (Tự động hóa hoàn toàn)
```bash
npx github:dinhnguyen2k/nguyentd-agent-kit
```

> [!TIP]
> **Thêm phím tắt (alias) vào `~/.zshrc` hoặc `~/.bashrc`**:
> ```bash
> alias agent-init="npx -y degit dinhnguyen2k/nguyentd-agent-kit . --force"
> ```
> Về sau, cứ `cd` vào source code bất kỳ và gõ:
> ```bash
> agent-init
> ```
> là toàn bộ bộ não AI được trang bị sẵn sàng trong tích tắc!

---

## 📦 Thành phần bao gồm

```text
nguyentd-agent-kit/
├── AI_RULES.md               # 📜 Luật cốt lõi (Nguồn sự thật, thứ tự ưu tiên, an toàn)
├── OPINION.md                # 💡 Cách nghĩ & thứ tự ưu tiên khi rule im lặng
├── AGENTS.md                 # 🤖 Cổng entry point điều hướng agent
├── GEMINI.md -> AGENTS.md    # Symlink cho Gemini CLI
├── CLAUDE.md -> AGENTS.md    # Symlink cho Claude Code
├── ANTIGRAVITY.md -> AGENTS  # Symlink cho Antigravity
└── .agent/
    ├── skills/               # 92 chuyên môn (clean-code, tdd, react, dotnet, git...)
    ├── rules/                # Bộ quy tắc kiểm soát chất lượng, bảo mật, performance
    ├── workflows/            # Các kịch bản chạy việc tự động (/plan, /test, /debug...)
    ├── agents/               # Cấu hình chuyên gia (backend, frontend, architect...)
    ├── contracts/            # Ranh giới phân quyền & registry
    ├── harness/              # Hook wiring cho các harness
    └── scripts/              # Các script hỗ trợ tự động hóa
```

---

## 🛡️ Nguyên tắc hoạt động
1. **`AI_RULES.md` là tối thượng**: Mọi quyết định kỹ thuật tuân theo thứ tự ưu tiên trong `AI_RULES.md`.
2. **`OPINION.md` định hướng**: Khi luật chưa quy định hoặc có nhiều giải pháp tương đương, ý kiến và gu kỹ thuật trong `OPINION.md` sẽ được áp dụng.
3. **92 Skills chuyên biệt**: Agent tự động nạp đúng skill khi chạm vào miền kỹ thuật tương ứng.
