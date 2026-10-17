# RESOURCES.md - Kho lưu trữ liên kết quan trọng

## 📦 Repositories Liên Quan
Lưu trữ danh sách các repo nguồn để tiện cho việc cập nhật hệ thống sau này.

### Core System
- **Google Antigravity Lab**: `https://github.com/Dokhacgiakhoa/antigravity-lab` (Repo hiện tại)
- **Google Antigravity Core**: `https://github.com/Dokhacgiakhoa/antigravity-ide` (Core CLI & Skills)

### 🚀 Agent Skills Standard (The Protocol)
- **Repository**: [HoangNguyen0403/agent-skills-standard](https://github.com/HoangNguyen0403/agent-skills-standard)
- **Role**: Foundation / Specification
- **Description**: Defines the folder structure (`SKILL.md`), Token Economy, and metadata format used by this IDE.

### 🧠 Anthropics Skills (The Intelligence)
- **Repository**: [anthropics/skills](https://github.com/anthropics/skills)
- **Role**: Skill Implementation / Upstream Source
- **Description**: Official repository from Anthropic containing production-ready skills for Claude.
    - **Key Document Skills**: PDF, DOCX, XLSX parsing.
    - **Creative Skills**: Art, Music, Design workflows.

### 🐘 PHP & Web Stack Official Documentation (Long Phát Application)
- **PHP Official Manual**: `https://www.php.net/manual/en/`
  - **PDO (PHP Data Objects)**: `https://www.php.net/manual/en/book.pdo.php` (Prepared statements, transaction management, driver options)
  - **Password Hashing**: `https://www.php.net/manual/en/book.password.php` (`password_hash`, `password_verify`)
  - **Session Management**: `https://www.php.net/manual/en/book.session.php` (`session_start`, session security)
  - **Security Best Practices**: `https://www.php.net/manual/en/security.php` (Input validation, SQL injection, XSS)
- **Composer Official Documentation**: `https://getcomposer.org/doc/` (Dependency management, autoloader, `composer.json`)
- **MySQL Reference Manual**: `https://dev.mysql.com/doc/refman/8.0/en/` (SQL syntax, indexing, transactions, utf8mb4 charset)
- **PHPMailer Repository & Docs**: `https://github.com/PHPMailer/PHPMailer` (SMTP integration, exception handling, email templates)
- **MDN Web Docs**: `https://developer.mozilla.org/`
  - **HTML Reference**: `https://developer.mozilla.org/en-US/docs/Web/HTML` (Semantic HTML5 markup)
  - **CSS Reference**: `https://developer.mozilla.org/en-US/docs/Web/CSS` (Responsive design, layout, styling)
  - **JavaScript Guide**: `https://developer.mozilla.org/en-US/docs/Web/JavaScript` (DOM manipulation, event handling, AJAX fetch)
  - **Web Security**: `https://developer.mozilla.org/en-US/docs/Web/Security` (CSP, HTTPS, CSRF, cookies)

### Official Documentation (The Source of Truth)
- **Antigravity Docs**: `https://antigravity.google/docs`
- **Agent Configuration**: `https://developers.google.com/antigravity/agent-configuration`
- **Model Context Protocol (MCP)**: `https://modelcontextprotocol.io/`
- **Gemini MCP Server**: `https://github.com/google-gemini/mcp-server`

### Antigravity Skills Ecosystem
- **Official MCP Servers**: `https://github.com/modelcontextprotocol/servers` (Testing, Search, Finance, Standard Blueprints)
  - *🚀 Đã rà soát cập nhật mới nhất từ upstream gồm các integrations mạnh mẽ:*
  - `AgentOps MCP`: `https://github.com/AgentOps-AI/agentops-mcp` (Cung cấp tracing và debug cho AI agents)
  - `AgentQL MCP`: `https://github.com/tinyfish-io/agentql-mcp` (Trích xuất dữ liệu có cấu trúc từ web)
  - `Apify MCP`: `https://github.com/apify/apify-mcp-server` (Cung cấp hàng ngàn API cho Web Scraping)
  - `Algolia MCP`: `https://github.com/algolia/mcp` (Quản lý Search Indices)
  - `Cloud Providers`: `Alibaba Cloud`, `AWS`, `Aiven` (Đã hỗ trợ quản lý tài nguyên mây nguyên bản)
- **Antigravity Skills Tutorial**: `https://github.com/rominirani/antigravity-skills` (Levels 1-5)
- **Antigravity Kit (VUDOVN)**: `https://github.com/vudovn/antigravity-kit`
- **Awesome Skills (Sickn33)**: `https://github.com/sickn33/antigravity-awesome-skills`
- **UI/UX Pro Max (NextLevelBuilder)**: `https://github.com/nextlevelbuilder/ui-ux-pro-max-skill`

### Community Skills Collections
- **MCP Server Registry (Glama)**: `https://glama.ai/mcp/servers`
- **Cursor Directory (Rules)**: `https://cursor.directory/`
- **System Prompts**: `https://github.com/mustvlad/ChatGPT-System-Prompts`
- **Vercel Agent Skills**: `https://github.com/vercel-labs/agent-skills/tree/main/skills`
- **Anthony Fu Skills**: `https://github.com/antfu/skills`
- **Search & Testing MCP**: `https://github.com/modelcontextprotocol/servers/tree/main/src/testing` (Playwright/Selenium)

### Advanced AI Frameworks & Agents
- **Microsoft AutoGen**: `https://github.com/microsoft/autogen` (v0.4+ Async/Event-driven Architecture)
- **LangGraph**: `https://github.com/langchain-ai/langgraph` (Distributed Execution & Subgraphs)
- **Microsoft Semantic Kernel**: `https://github.com/microsoft/semantic-kernel`
- **SuperAGI**: `https://github.com/TransformerOptimus/SuperAGI`

### Automation & Workflows
- **n8n**: `https://github.com/n8n-io/n8n`

### Prompts & Productivity Tools
- **Fabric (Daniel Miessler)**: `https://github.com/danielmiessler/fabric` (New: AI Safety Patterns)
- **Awesome ChatGPT Prompts**: `https://github.com/f/prompts.chat`

---

## 🔄 Hướng dẫn Cập nhật (Manual Update)
Khi cần cập nhật từ các nguồn trên, sử dụng lệnh git:
`git pull`
