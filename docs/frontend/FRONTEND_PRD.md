# Frontend PRD

Frontend-side product requirements, derived from [PRD.md](../product/PRD.md) §8. This file declares
**what the UI does**; the contract (data shapes) is
[FRONTEND_DATA_CONTRACTS.md](./FRONTEND_DATA_CONTRACTS.md); the screens are
[FRONTEND_PAGE_SPECIFICATIONS.md](./FRONTEND_PAGE_SPECIFICATIONS.md).

---

## 1. Scope & stance

- The frontend renders backend-contract data and **never recomputes** scores or metrics
  (BR-X2, [FRONTEND_DATA_CONTRACTS.md](./FRONTEND_DATA_CONTRACTS.md) §1).
- Before backend approval, the frontend runs on **mock data** exposing the same envelopes
  ([FRONTEND_MOCK_DATA_STRATEGY.md](./FRONTEND_MOCK_DATA_STRATEGY.md)).
- No automated frontend tests (ADR-007); verification is manual.
- Stack is **leading candidate** React + TS + Vite + Tailwind, not yet ratified
  ([ARCHITECTURE_DECISIONS.md](../architecture/ARCHITECTURE_DECISIONS.md) ADR-010).

## 2. Feature coverage

Every FR in [PRD](../product/PRD.md) §8 has a frontend surface:

| Area | Frontend responsibilities |
|---|---|
| Dashboard | latest result, competency accuracy (≥5 answered), top-3 weaknesses, recent history, pending actions |
| Try Out | notice-first, timer display + auto-submit trigger, navigate/flag, autosave, immediate score, unscored-on-block |
| Practice | competency+difficulty pick, untimed default, inline explanation |
| Generation | review screen (accept/edit/reject), progress + cancel, failure category display |
| Analytics | render `AnalyticsSnapshot` verbatim; sample-status badges |
| Personalised | weakness list w/ evidence, drill CTA, editable study plan |
| Question bank | list/filter, detail validations, lifecycle actions, duplicate clusters |
| AI config | provider list, test connection, masked-key display |
| Exam config | list w/ state badge, basis notice, four-value approval UI |

The mapping is [FEATURE_MATRIX.md](../product/FEATURE_MATRIX.md).

## 3. Hard rules

- **TWK/TIU** show `correct` as `Benar`/`Salah`/`— (tidak dijawab)` (`null`), never blur the
  unanswered into "salah".
- **TKP** never shows a "correct" answer or an answer key; it shows attained score
  (`earned/possible`).
- A `provisional` config that is **unapproved** is shown as locked/not-offered; the UI cannot start
  a session it does not offer (FR-E1/E2/E3).
- Provider keys are displayed as masked tail only; no key input is echoed back plaintext (FR-C6).

## 4. Non-functional (frontend slice)

- Responsive at phone width, 16 px side gutter, no horizontal scroll.
- Accessible ([FRONTEND_ACCESSIBILITY.md](./FRONTEND_ACCESSIBILITY.md)): keyboard, focus, ARIA, contrast.
- Deterministic location/route use ([FRONTEND_ROUTING.md](./FRONTEND_ROUTING.md)).

## 5. Out of scope

Fixed by [MVP_SCOPE.md](../product/MVP_SCOPE.md) §2 (e.g. automated frontend tests, accounts/roles).