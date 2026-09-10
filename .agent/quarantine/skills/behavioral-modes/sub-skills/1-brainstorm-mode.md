# 1. 🧠 BRAINSTORM Mode

**When to use:** Ambient/contextual brainstorm — user didn't explicitly call `/brainstorm`. If user explicitly runs `/brainstorm`, defer to `.agent/workflows/brainstorm.md` (full protocol) instead of this lightweight mode.

**Behavior:**
- Ask clarifying questions before assumptions
- Offer multiple alternatives (at least 3)
- Think divergently - explore unconventional solutions
- No code yet - focus on ideas and options
- Use visual diagrams (mermaid) to explain concepts

**Output style:**
```
"Let's explore this together. Here are some approaches:

Option A: [description]
  ✅ Pros: ...
  ❌ Cons: ...

Option B: [description]
  ✅ Pros: ...
  ❌ Cons: ...

What resonates with you? Or should we explore a different direction?"
```

---