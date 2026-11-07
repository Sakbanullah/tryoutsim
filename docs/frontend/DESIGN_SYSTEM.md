# Design System

Visual/tone system for the frontend. Design tokens are defined once, referenced everywhere; this is
a source of truth for tokens, not a code dump. No CPNS/institutional branding — the app is a neutral
study aid, never impersonating a real body ([FRONTEND_PRD](./FRONTEND_PRD.md)).

---

## 1. Principles

1. **Numbers, not adjectives** — the UI states counts/percentages verbatim from analytics.
2. **States over chrome** — lifecycle/approval states are badges with shared semantics.
3. **Accessible by default** — contrast, focus, keyboard all baseline
   ([FRONTEND_ACCESSIBILITY.md](./FRONTEND_ACCESSIBILITY.md)).
4. **Calm exam tone** — limited palette, no decoration, fast scan.

## 2. Colour tokens

Defined on `:root`, redefined for dark mode. Colours as tokens, not hex littered in components.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#ffffff` | `#0f1115` | page background |
| `--surface` | `#f6f7f9` | `#181b20` | cards |
| `--text` | `#1a1d23` | `#e6e8ec` | primary text |
| `--text-muted` | `#59616d` | `#9aa3af` | secondary |
| `--border` | `#e2e5ea` | `#2a2f38` | dividers |
| `--accent` | `#1f6feb` | `#4d8ff7` | primary action |
| `--success` | `#1a7f37` | `#3fb950` | correct / verified |
| `--danger` | `#cf222e` | `#f85149` | wrong / error / block |
| `--warning` | `#9a6700` | `#d29922` | provisional / caution |
| `--info` | `#0550ae` | `#79c0ff` | historical / neutral-info |

Contrast: text on bg meets WCAG AA; `--warning`/`--danger` are never the sole carrier of meaning
(paired with text/icon).

## 3. State badge semantics (shared)

| State | Token | Meaning |
|---|---|---|
| `official_verified` | success | verified current authority |
| `historical` | info | verified past |
| `provisional` (approved) | warning | in-progress acceptance |
| `provisional` (unapproved) | muted + lock icon | not offered |

The same badge component is used on config list, dashboard card, result header — one meaning
everywhere (DRY for semantics).

## 4. Typography & spacing

- Family: system stack (no web font dependency unless required).
- Scale: `xs/sm/base/lg/xl`, base 16 px. Side gutter 16 px at phone width
  ([FRONTEND_PRD](./FRONTEND_PRD.md) §4).
- No horizontal page scroll at any supported width.

## 5. Data-numeric display

- Percentages always integer `%` **with** raw counts beside (`72% (18/25)`), mirroring
  `MetricValue` ([FRONTEND_DATA_CONTRACTS.md](./FRONTEND_DATA_CONTRACTS.md)).
- `insufficient_data` uses a neutral dash + "data belum cukup", never a fake 0.

## 6. Boundary

This is design, not implementation; tokens are the contract. Implementation framework is
[FRONTEND_IMPLEMENTATION_PLAN.md](./FRONTEND_IMPLEMENTATION_PLAN.md).