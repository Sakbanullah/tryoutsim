# Frontend Mock Data Strategy

How the frontend runs without a backend, frontend-first. The mock layer must be indistinguishable
from the backend **at the contract level** ([FRONTEND_DATA_CONTRACTS.md](./FRONTEND_DATA_CONTRACTS.md)),
not in content.

---

## 1. Goal

- Every endpoint is mockable with the exact envelopes (success + error) in
  [API_SPECIFICATION](../backend/API_SPECIFICATION.md) / [FRONTEND_DATA_CONTRACTS](./FRONTEND_DATA_CONTRACTS.md).
- The mock **never implements scoring** — it returns canned `ScoreResult`s consistent with the
  `correct`/`correctCount`/attainment semantics, so the UI renders real claims but computes nothing.

## 2. Contract parity rule

The mock's `ApiError` union must include `PREFLIGHT_FAILED`, `APPROVAL_INVALID`,
`APPROVAL_VERSION_MISMATCH`, `THRESHOLD_CONFIG_INVALID` with the exact `changed[]`/`errors[]` shape so
the error mapper is exercised **before** the backend exists. These are triggered by fixture toggles
(a flag "simulate blocked approval"), never silently.

## 3. Fixture discipline

- Ship three config fixtures mirroring the real shipped states (`historical`, `provisional`
  unapproved, `official_verified` other-pathway) so the state-badge/approval UI is exercised
  ([MVP_SCOPE](../product/MVP_SCOPE.md) §3).
- TWK/TIU fixtures include a `null` (unanswered) item to exercise the `—` render rule.
- TKP fixtures carry per-option weights and **no** `correct` — exercising the no-key disclosure.
- One fixture cell per analytics sample status (`zero_correct`, `zero_attainment`,
  `insufficient_data`) to exercise the badge mapping.

## 4. Boundaries

- Mock data does not impersonate a real authority/product; content is clearly synthetic study
  material.
- The mock layer is removable in one seam (the Data client swap) — the UI never branches on "is mock"
  ([FRONTEND_STATE_MANAGEMENT](./FRONTEND_STATE_MANAGEMENT.md) §2).

## 5. Hand-off

When the backend is approved (Gate 3), the mock layer is deleted and the Data client points at
`/api/v1` — no component changes ([FRONTEND_IMPLEMENTATION_PLAN](./FRONTEND_IMPLEMENTATION_PLAN.md) §5).