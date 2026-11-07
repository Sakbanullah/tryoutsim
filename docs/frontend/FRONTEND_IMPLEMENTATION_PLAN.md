# Frontend Implementation Plan

Deferred implementation plan. Nothing here runs yet — it is executed only after the frontend gate
opens ([DEVELOPMENT_ROADMAP](../roadmap/DEVELOPMENT_ROADMAP.md) Gate 2).

---

## 1. Gating

- This plan activates **only** on explicit user approval of the documentation set, and then engages
  the mock-data path before backend (frontend-first).
- No automated frontend tests (ADR-007). Verification is the manual checklist in
  [FRONTEND_ACCESSIBILITY.md](./FRONTEND_ACCESSIBILITY.md) §4 plus my own read-through.

## 2. Order (dependency-first)

1. Scaffold (candidate React + TS + Vite + Tailwind) + design-token layer ([DESIGN_SYSTEM](./DESIGN_SYSTEM.md)).
2. Data contracts as types + mock data layer ([FRONTEND_DATA_CONTRACTS](./FRONTEND_DATA_CONTRACTS.md),
   [FRONTEND_MOCK_DATA_STRATEGY](./FRONTEND_MOCK_DATA_STRATEGY.md)).
3. UI primitives ([FRONTEND_COMPONENT_ARCHITECTURE](./FRONTEND_COMPONENT_ARCHITECTURE.md) §2).
4. Shell + routing ([FRONTEND_ROUTING](./FRONTEND_ROUTING.md)).
5. Feature screens in dependency order: dashboard → tryout runner → result → practice → question bank
   → generation → analytics → AI config → exam config → study plan.
6. Manual verification pass → **frontend gate decision**.

## 3. What is fixed vs chosen

| Fixed (contract) | Chosen at implementation |
|---|---|
| routes, data shapes, screens, no-recompute rule | router lib, CSS approach within Tailwind, exact file layout |
| no premature state/query library | when/if a library is added (triggers in [FRONTEND_STATE_MANAGEMENT](./FRONTEND_STATE_MANAGEMENT.md) §4) |
| mock returns real envelopes incl. errors | mock fixture content |

## 4. Explicit non-goals here

- No backend implementation (Gate 3 only).
- No provider/network calls from the frontend (mock layer only until backend approved).
- No scope additions ([MVP_SCOPE](../product/MVP_SCOPE.md) §2).

## 5. Open before start

None blocking: the stack remains Proposed until approval; the plan states the leading candidate
explicitly and re-confirms at gate time rather than assuming it.