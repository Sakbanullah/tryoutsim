# Frontend Page Specifications

Screen-by-screen spec. Data shapes are in
[FRONTEND_DATA_CONTRACTS.md](./FRONTEND_DATA_CONTRACTS.md); IA/routes are in
[FRONTEND_INFORMATION_ARCHITECTURE.md](./FRONTEND_INFORMATION_ARCHITECTURE.md). Requirements trace to
[PRD.md](../product/PRD.md) §8.

---

## 1. Dashboard (`/`)

| # | Element | Behaviour | FR |
|---|---|---|---|
| 1 | Latest session card | per-test `earned/possible`, accuracy/attainment, config state badge | D1 |
| 2 | Competency strength list | rows with integer % + raw counts, only ≥5 answered | D2 |
| 3 | Top-3 weaknesses | each with numeric evidence + drill CTA | D3 |
| 4 | Recent history | last sessions with mode + config badge | D4 |
| 5 | Pending actions | e.g. unreviewed drafts, unapproved config | D5 |

Empty state: no sessions → prompt to start a tryout or generate questions.

## 2. Try Out — start (`/tryout`)

| # | Element | Behaviour | FR |
|---|---|---|---|
| 1 | Config list | state badge; `official_verified`/`historical`/`provisional` | E1 |
| 2 | Basis notice | legal basis + pathway + tier, shown **before** start | T1, E2 |
| 3 | Start CTA | disabled for unoffered `provisional`; shows re-approve if invalidated | E3 |

## 3. Test runner (`/tryout/:id`)

| # | Element | Behaviour | FR |
|---|---|---|---|
| 1 | Countdown | client display; auto-submit is a server-clock concern | T2 |
| 2 | Question body + options | per-item; TKP shows weighted options, no "correct" affordance | T3 |
| 3 | Navigate + flag | prev/next, grid, flag toggle | T3 |
| 4 | Autosave | PATCH answers debounced | T4 |
| 5 | Submit confirm | counts unanswered items before submit | T5 |
| 6 | Result hand-off | on success → result route; on 409/422 → appropriate state | T6, T7 |

## 4. Result (`/tryout/:id/result`)

| # | Element | Behaviour | FR |
|---|---|---|---|
| 1 | Score summary | `Bucket`s per section + totals, integer only | T6 |
| 2 | Per-question | TWK/TIU `correct` Benar/Salah/—; TKP `null`, attained score | T6 |
| 3 | Blocked state | 409 → "not scored", reason summary from `changed[]` | T7 |

## 5. Practice (`/practice` + `/practice/:id`)

| # | Element | Behaviour | FR |
|---|---|---|---|
| 1 | Pick competency + difficulty | any level from taxonomy | P1 |
| 2 | Untimed default | soft timer optional, hidden otherwise | P2 |
| 3 | Same runner layout | identical to tryout runner | P3 |
| 4 | Inline explanation | shown after answering | P4 |

## 6. Question bank (`/questions` + `/questions/:id`)

| # | Element | Behaviour | FR |
|---|---|---|---|
| 1 | Filter list | test, competency, lifecycle, difficulty | Q1 |
| 2 | Detail validations | V-rule chips (pass/fail) | Q2 |
| 3 | Lifecycle actions | draft→active (gate), archive | Q3 |
| 4 | Bulk ops | select + archive/activate | Q4 |
| 5 | Duplicate clusters | flagged rows link to cluster | Q5 |

## 7. Generation (`/generation` + review)

| # | Element | Behaviour | FR |
|---|---|---|---|
| 1 | Config | competency + count, batch hint | G1 |
| 2 | Progress + cancel | per-batch status, cancel unsubmitted | G2 |
| 3 | Review screen | accept/edit/reject each draft, validation chips | G4, G3 |
| 4 | Failure categories | per-batch reason + retry | G6 |

## 8. Analytics (`/analytics`)

| # | Element | Behaviour | FR |
|---|---|---|---|
| 1 | Per-test cards | accuracy (TWK/TIU), attainment (TKP), MRT | A1 |
| 2 | Trend | ≥3 sessions line; `insufficient_data` otherwise | A2 |
| 3 | Difficulty matrix | per-cell sample rule shown | A3 |
| 4 | Sample-status badges | zero vs insufficient | A4 |
| 5 | Comparability gate | only same-config sessions compared | A5 |

## 9. AI config (`/ai`)

| # | Element | Behaviour | FR |
|---|---|---|---|
| 1 | Provider list | masked key (`keyLast4`), test CTA | C1, C2 |
| 2 | Model list/enter | refresh + manual add | C3 |
| 3 | Task→model map | per task dropdown | C4 |
| 4 | Capability flags | jsonMode/streaming/maxContext toggles | C5 |

## 10. Exam config (`/exam-configs/:id`)

| # | Element | Behaviour | FR |
|---|---|---|---|
| 1 | Basis list | tier + pathway + source | E2 |
| 2 | Approval UI | acks (warnings) + approve; four bound values shown as read-only | E3 |
| 3 | Invalidation state | `changed[]` summary if invalidated | E4 |

---

Exact layout/visual system: [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md). Component decomposition:
[FRONTEND_COMPONENT_ARCHITECTURE.md](./FRONTEND_COMPONENT_ARCHITECTURE.md).