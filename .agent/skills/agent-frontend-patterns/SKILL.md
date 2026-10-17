---
name: agent-frontend-patterns
description: Provides frontend techniques for plain CSS, vanilla JavaScript, DOM events, UI components, and layout templates. Use when frontend-development routes to specific UI/client techniques.
metadata:
  version: "2.0.0-php"
---

# Frontend Patterns (HTML / CSS / Vanilla JavaScript)

Techniques and conventions for the presentation layer of this project: server-rendered PHP templates (`layout/**`), CSS stylesheets (`css/**`), and client-side JavaScript (`js/**`).

## Stack facts (do not contradict these)

| Concern | What this repo actually uses |
| --- | --- |
| Template engine | PHP server-rendered HTML templates (`layout/header.php`, `layout/footer.php`) |
| Styling | Plain CSS files in `css/**`, standard responsive CSS (flexbox, grid, media queries) |
| Scripting | Vanilla JavaScript in `js/**`, DOMContentLoaded, event listeners, fetch/AJAX |
| Assets | Static assets in `images/**`, uploaded media in `uploads/**` |
| Framework policy | No frontend framework mandate; React/Tailwind are opt-in only if explicit project dependencies require them |

## Use this skill when

- Designing or modifying layout templates (`layout/**`) and responsive page sections.
- Writing or refactoring vanilla JavaScript for interactive UI (modals, sliders, tabs, form validation).
- Styling components with clean, maintainable CSS in `css/**`.
- Enhancing client-side user experience without heavy dependencies.

## Do not use this skill when

- Writing PHP backend logic, database queries, or server-side auth -> use `php-development` or `backend-development`.
- Explicit visual design exploration from scratch -> use `frontend-design`.
- Comprehensive UI/UX audits and guidelines -> use `ui-ux-pro-max`.

## Scope Boundary

- Server-side form handling, CSRF validation, and backend persistence are owned by [skill:php-development].
- Client-side validation uses native HTML5 validation and vanilla JavaScript; server remains authoritative for all validation.
- Visual direction is owned by [skill:frontend-design] and activates only for explicit design work.
- Use existing CSS and vanilla JS patterns; do not introduce React, Vue, Next.js, or npm bundlers unless explicitly requested by project dependencies.

## Key Frontend Conventions

### 1. Template Structure & Component Layout
- Keep templates clean: `layout/header.php` defines `<head>`, navigation, and open container tags.
- `layout/footer.php` closes containers, includes footers, and loads closing scripts.
- Page scripts (`*.php`) render specific page body content inside the layout container.
- Always escape dynamic PHP variables output into HTML attributes or text with `htmlspecialchars()`.

### 2. Vanilla JavaScript Best Practices
- Wait for DOM ready: `document.addEventListener('DOMContentLoaded', () => { ... });`.
- Use event delegation for dynamic lists and tables.
- Use `fetch()` for asynchronous requests (e.g. dynamic tour filter, booking submission):
  ```javascript
  async function submitBooking(formData) {
    try {
      const response = await fetch('api/booking.php', {
        method: 'POST',
        body: formData,
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.message);
      // Update UI
    } catch (err) {
      console.error('Lỗi đặt tour:', err);
      alert('Đã xảy ra lỗi, vui lòng thử lại.');
    }
  }
  ```

### 3. Responsive CSS Patterns
- Mobile-first CSS: base styles for mobile, `@media (min-width: 768px)` and `@media (min-width: 1024px)` for desktop.
- Semantic class names: `.tour-card`, `.tour-grid`, `.booking-form`, `.btn-primary`.
- CSS custom properties (`:root`) for color palette and spacing consistency.

## Verification

- The selected technique solves an observed UI problem and matches local CSS/JS conventions.
- Accessibility and responsive behavior on mobile/desktop are preserved.
- No syntax errors in client-side scripts.
