# UX Psychology Playbook

> Decision-first UX reference for product teams building both public products and internal enterprise systems.

---

## 0. Quick Start: Apply by Screen Type

Use this mapping first before reading any law details.

### List Page
- Keep visible filters <= 5 (hide advanced filters behind toggle).
- Keep primary actions fixed and easy to hit.
- Prefer table + bulk actions for internal systems.
- Highlight only one primary action per row or toolbar.

### Create Form
- If fields > 5, split into steps.
- Show inline validation immediately after blur.
- Keep one primary CTA (`Save` or `Submit`) and one secondary CTA (`Cancel`).
- Save draft automatically for long forms.

### Dashboard
- Show only top 3-5 KPI cards above the fold.
- Place critical KPI first and final CTA last (serial position effect).
- Keep chart legends short and tappable.
- Provide drill-down path from KPI to detail list.

### Mobile
- Minimum touch target: 44x44px.
- Sticky primary CTA for high-frequency tasks.
- Collapse optional content and advanced controls.
- Keep one major task per screen.

---

## 1. Priority (Most Impact -> Least)

Do not optimize everything at once. Prioritize in this order:

1. Cognitive Load
2. Hick's Law
3. Fitts' Law
4. Trust
5. Emotional Design

Why this order:
- If users are overloaded, they fail before they notice style.
- If choices are unclear, users stall before they click.
- If actions are hard to reach, users misclick.
- Trust affects completion and retention after usability is solved.
- Emotional polish amplifies, but does not replace, usability.

---

## 2. Decision Rules (When to Use)

Treat these as execution triggers.

| Trigger | Apply | Expected Effect |
|---------|-------|-----------------|
| User must choose > 5 options | Hick's Law + progressive disclosure | Faster decision, lower abandonment |
| Critical action (pay, submit, approve) | Fitts' Law + visual emphasis | Fewer misclicks |
| Form has > 5 fields | Step-based form + chunking | Higher completion rate |
| Screen looks busy or noisy | Cognitive load reduction first | Better scan speed |
| New user hesitation is high | Trust signals by flow stage | Higher conversion |
| Users complete tasks but do not return | Reflective emotional design | Better retention |
| API/UI response time varies by latency band | Performance UX states by threshold | Better perceived speed and less user anxiety |

---

## 3. Core UX Laws (With Practical Apply Blocks)

### Hick's Law

**Principle:** Decision time increases as number of choices grows.

```
Decision Time = a + b x log2(n + 1)
```

**When to use:**
- Option set > 5.
- User reports "not sure what to pick".
- Filter panel keeps expanding over time.

### Apply to Real Product

- List page: keep default visible filters <= 5; move advanced filters into drawer.
- Create form: split into 2-4 logical steps.
- Dashboard: show core KPIs only; hide secondary insights under expand.
- Mobile: use bottom sheet with top 3 common options + "More".

### Anti-pattern

- 10+ filters always open.
- Dropdown with 50 items and no search.
- All optional settings visible by default.

---

### Fitts' Law

**Principle:** Targets that are larger and closer are faster to hit.

```
MT = a + b x log2(1 + D/W)
```

**When to use:**
- Any critical CTA exists.
- Mobile usage is high.
- Misclick rate > 3%.

### Apply to Real Product

- List page: bulk action button pinned in toolbar, minimum 44px height.
- Create form: primary CTA aligned consistently and always visible near completion area.
- Dashboard: clickable KPI cards use full-card hit area, not tiny icon-only action.
- Mobile: sticky bottom CTA for submit/confirm tasks.

### Anti-pattern

- Primary and secondary CTAs same size and same color.
- Tiny 24px icon-only actions used for critical tasks.
- CTA below fold with no sticky alternative.

---

### Miller's Law

**Principle:** Working memory is limited; users process chunks better than long streams.

**When to use:**
- Dense content or dense forms.
- Long setup screens.
- Users repeatedly miss fields or instructions.

### Apply to Real Product

- List page: group filters into logical sets (time, status, owner, type).
- Create form: section fields in chunks of 3-5 with clear legends.
- Dashboard: group widgets by business goal, not by data source.
- Mobile: one block per scroll segment with explicit section headers.

### Anti-pattern

- 20 fields in one uninterrupted vertical form.
- Long paragraph instructions with no bullets.
- Mixing unrelated controls in one card.

---

### Von Restorff Effect

**Principle:** Distinct items are remembered and noticed faster.

**When to use:**
- Need to guide next best action.
- Complex pages with multiple competing actions.
- Priority status must be spotted fast.

### Apply to Real Product

- List page: only one primary action style in toolbar.
- Create form: highlight "Submit" only when form is valid.
- Dashboard: emphasize one key alert or bottleneck card.
- Mobile: use one accent color for key action only.

### Anti-pattern

- Two or more "primary" buttons with equal visual weight.
- Every card uses badge/highlight style.
- Red used for both urgency and neutral labels.

---

### Serial Position Effect

**Principle:** Users remember first and last items better than middle items.

**When to use:**
- Navigation and menu ordering.
- Onboarding or setup sequences.
- Long pages with repeated actions.

### Apply to Real Product

- List page: place highest-frequency tab first, destructive utility last.
- Create form: put critical fields first and confirmation summary last.
- Dashboard: first block = business-critical KPI, last block = action CTA.
- Mobile: top area for current status, bottom sticky area for final action.

### Anti-pattern

- Important menu items buried in middle.
- Confirmation hidden in middle of long page.
- Random section order based on implementation, not user flow.

---

## 4. Cognitive Load (Highest Priority)

### Working Rule

- Remove unnecessary choices before adding visuals.
- Prefer recognition over recall.
- Separate must-do from nice-to-have.

### Apply to Real Product

- List page: default to commonly used columns; allow optional column picker.
- Create form: show required fields first, advanced fields on expand.
- Dashboard: one screen should answer one operational question.
- Mobile: avoid dual-column content and hidden side effects.

### Anti-pattern

- Decorative UI that competes with task content.
- Unlabeled icons with hidden meaning.
- Multiple simultaneous alerts with no severity hierarchy.

---

## 5. Law Relationships (System-Level Thinking)

Use combined patterns instead of isolated optimization.

| Combination | Purpose | Example |
|-------------|---------|---------|
| Hick + Cognitive Load | Reduce decision friction | Hide advanced filters and preselect common default |
| Fitts + Emotional (Behavioral layer) | Increase confident action | Large reachable CTA with immediate success feedback |
| Trust + Reflective design | Improve long-term retention | Consistent policy transparency and reliable status history |
| Miller + Serial Position | Improve recall and completion | Chunk form and place key summary at the end |

Execution note:
- Optimize in dependency order: reduce load -> simplify choice -> improve hit area -> add trust -> add emotional polish.

---

## 6. Trust System (Flow-Based, Not Just Element List)

Static trust badges are not enough. Trust must be designed across user flow.

### Trust by Flow

| Stage | User Question | Trust Signal Needed | Example |
|-------|---------------|---------------------|---------|
| Landing / Entry | "Can I trust this system?" | Credibility | Company identity, uptime, audit note |
| List / Search | "Can I find accurate data?" | Clarity | Fresh timestamp, clear filter state, empty-state guidance |
| Detail / Review | "Is this data valid?" | Proof | Source, revision history, approver trail |
| Submit / Checkout | "Is this safe to commit?" | Security + confirmation | Permission label, lock icon, confirmation summary |
| Post-action | "Did it really work?" | Reliability | Success state, reference ID, undo path where possible |

### Apply to Internal System Flow

- Login: show environment and account context clearly.
- List: show last updated time and current filter context.
- Detail: show audit trail and who changed what.
- Submit/Approve: show permission scope and irreversible warning only when needed.

### Anti-pattern

- Trust signals only at login page.
- No timestamp on operational data.
- Success toast without persisted reference number.

---

## 7. Emotional Design (Don Norman, Practical Version)

### Three Levels

- Visceral: first impression (fast visual clarity).
- Behavioral: ease and confidence while using.
- Reflective: meaning, identity, and long-term memory.

### Apply to Real Product

- List page (Behavioral): immediate response for filter, sort, and bulk action.
- Create form (Behavioral): clear progress and save feedback.
- Dashboard (Visceral + Behavioral): clean hierarchy and stable status semantics.
- Mobile (Behavioral): tactile feedback and reduced accidental taps.

### Anti-pattern

- Nice visuals but no loading/empty/error feedback.
- Inconsistent status colors causing emotional confusion.
- Brand messaging with no functional reliability.

---

## 8. Persona Use Rules (Context-Driven)

Personas are not universal. Tie them to product type.

| Persona | Good Fit | Avoid / Limit |
|---------|----------|---------------|
| Gen Z | B2C mobile products, social flows, creator tools | Internal ERP where speed and precision dominate |
| Millennials | Consumer SaaS, comparison-heavy buying flows | Highly regulated forms requiring rigid structure |
| Gen X | Admin consoles, operational dashboards, data-heavy tools | Highly gamified interfaces |
| Baby Boomers | Service portals with strong assistance cues | Dense control panels with tiny actions |

Rule:
- For enterprise internal systems, role-based workflow matters more than age-based persona assumptions.

---

## 9. UX for Internal System Apps (Enterprise/Production)

This section is mandatory when designing ERP, production, or admin tools.

### Principles

- Speed over decoration.
- Clarity over novelty.
- Tables over cards for dense operational data.
- Bulk action over fancy micro-animations.
- Strong filter/search over visual effects.

### Pattern Defaults

- List screens: sticky filter bar + bulk actions + column settings.
- Create/Edit screens: step form only when field count is high or dependencies are complex.
- Approval screens: side-by-side compare old vs new values.
- Mobile internal app: focus on approve/reject/scan quick tasks, not full desktop parity.

### Anti-pattern

- Marketing-style hero sections in internal tools.
- Card-only layout for 50+ rows of operational data.
- Heavy animation that slows repeated daily tasks.

---

## 10. Performance UX (Perceived Speed)

UX is not just visual quality. It is also how fast the system feels.

### Latency Bands and Required UX State

| Response Time | User Perception | Required UX Behavior |
|---------------|-----------------|----------------------|
| < 100ms | Instant | No loader; keep interaction seamless |
| 100-500ms | Slight delay | Subtle loading (button spinner, shimmer, optimistic micro-feedback) |
| > 500ms to 2s | Noticeable wait | Explicit loading state (skeleton, disabled action, status text) |
| > 2s | High uncertainty | Progress indicator or step feedback ("Step 2/4", "% complete", queue status) |

### Apply to Real Product

- List page: keep last data visible while refreshing; show lightweight "Updating..." state.
- Create form: show inline pending state on submit button at 100-500ms; switch to explicit blocking state after 500ms.
- Dashboard: load KPI skeleton first, then chart; avoid blank canvas while waiting.
- Mobile: show sticky progress feedback for long operations to avoid perceived freeze.

### Anti-pattern

- Global full-screen spinner for every request.
- No state change until server responds (looks frozen).
- Same loading UI for 120ms and 5s waits.
- Long-running action without progress or retry guidance.

---

## 11. Measure UX (No Measurement = No Improvement)

Track these metrics by flow stage.

| Metric | Definition | Typical Trigger to Improve |
|--------|------------|----------------------------|
| Time to Complete | Median time from first input to successful submit | > baseline by 20% after release |
| Misclick Rate | Wrong-action clicks / total action clicks | > 3% on critical actions |
| Drop-off Rate | Started flow but did not complete | > 25% on create/checkout flow |
| Conversion Rate | Completed primary goal / started sessions | Downward trend over 2 releases |
| Rework Rate (Internal) | Records edited again within 24h due to mistakes | > 10% indicates clarity issues |
| Support Ticket Rate | UX-related tickets per 100 active users | Increasing trend post-change |

### Instrumentation Starter

- Log form start, step change, validation fail, submit success/fail.
- Track filter usage frequency on list pages.
- Capture where users abandon multi-step forms.
- Segment by device type (desktop/mobile) and role type.

---

## 12. Actionable UX Checklist (Before Release)

### Decision and Load

- [ ] Visible choices on key decision points <= 5 by default.
- [ ] Advanced options are collapsed behind an explicit control.
- [ ] No page has more than one primary CTA.
- [ ] Form with > 5 fields is chunked or step-based.

### Action Targets

- [ ] Primary CTA height >= 44px on touch devices.
- [ ] Critical CTA is reachable in current viewport (or sticky on mobile).
- [ ] Misclick-prone icon actions have labels or confirmation guard.

### Performance UX

- [ ] Flows expected < 100ms do not show unnecessary loader flicker.
- [ ] Flows in 100-500ms band use subtle loading feedback.
- [ ] Flows > 500ms show explicit loading state and prevent duplicate submit.
- [ ] Flows > 2s show progress indicator, step feedback, or queue status.

### Trust and Feedback

- [ ] Every operational list shows data freshness timestamp.
- [ ] Submit/approve action shows clear success confirmation with reference ID.
- [ ] Permission-sensitive action clearly indicates role/scope requirement.
- [ ] Loading, empty, error, and success states are all explicitly designed.

### Enterprise Fit

- [ ] High-frequency flows are optimized for keyboard and bulk actions.
- [ ] Dense data views use table layout by default unless card view is justified.
- [ ] Filters support real operational queries (status, date, owner, type).
- [ ] Animation does not delay repeated daily actions.

### Measurement

- [ ] Baseline metrics were captured before rollout.
- [ ] Post-release UX metrics are tracked for at least one full usage cycle.
- [ ] A rollback or iteration threshold is defined for poor metrics.

---

## 13. Summary Rule

If the team remembers only one thing:

1. Reduce cognitive load first.
2. Limit and structure choices.
3. Make critical actions easy to hit.
4. Build trust across the full flow.
5. Measure outcomes, then iterate.
