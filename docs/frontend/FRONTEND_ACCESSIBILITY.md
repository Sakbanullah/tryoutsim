# Frontend Accessibility

Accessibility contract for the UI. Baseline, not optional.

---

## 1. Standards

- WCAG 2.1 AA for contrast, keyboard, focus, and semantics.
- Semantic HTML first; ARIA only where native semantics are insufficient.

## 2. Non-negotiable behaviours

| Concern | Requirement |
|---|---|
| Keyboard | All interactive elements reachable and operable via keyboard alone; visible focus (no `outline: none` without a replacement) |
| Focus order | logical DOM order; modals trap focus and return it on close |
| Timers | countdown conveyed via text (not colour/motion alone); auto-submit announced via `aria-live` |
| Colour | state never colour-only ([DESIGN_SYSTEM](./DESIGN_SYSTEM.md) §3) — text/icon always accompany |
| Forms | labelled inputs (`label`/`aria-label`); errors linked via `aria-describedby` |
| Tables/data | numeric cells preserve raw counts (`72% (18/25)`), not bare percentages |
| Motion | reduced-motion respected; no essential info conveyed by motion alone |

## 3. Domain specifics

- **TKP answer key**: no "correct" affordance; the post-answer disclosure avoids implying
  right/wrong, and reaches screen readers via text (attained score), not icon only.
- **Blocked result** (`changed[]`): the re-approve causes are readable text, not a raw hash dump.
- **Preflight errors** (`errors[]`): each `path`/`message` rendered per-form-field and associated.

## 4. Verification

Manual only (ADR-007, no automated frontend tests): keyboard pass, screen-reader pass, contrast
check against [DESIGN_SYSTEM](./DESIGN_SYSTEM.md) §2 tokens, at phone width
([FRONTEND_PRD](./FRONTEND_PRD.md) §4). A failure here blocks the frontend gate.