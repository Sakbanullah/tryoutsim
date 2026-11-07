# Recommendation Service

Canonical source for the backend service that turns analytics into recommendations and study plan.
The rules are [RECOMMENDATION_ENGINE.md](../ai/RECOMMENDATION_ENGINE.md); this file is the service
surface and data hand-off.

---

## 1. Inputs

The service consumes `AnalyticsSnapshot` ([ANALYTICS_ENGINE.md](./ANALYTICS_ENGINE.md) §7) — never
raw answers, never re-derives metrics. It receives:

- per-competency accuracy (TWK/TIU) or attainment (TKP), each with `answeredCount`;
- sample-status flags (`zero_correct` / `zero_attainment` / `insufficient_data`).

## 2. Responsibilities

1. **Identify weaknesses** — reportable cells only: sample ≥ min, deficit from config mean
   (FR-L1, BR-L2).
2. **Attach evidence** — the numeric values, not adjectives (FR-L2).
3. **Match materials** — by `competencyId` (FR-L3); no material → explicit `no_material`.
4. **Build drills** — a targeted drill request reuses the question personality, not a new type
   (FR-L4).
5. **Propose study plan** — as a diff over the current plan; user edits are preserved, never
   overwritten (FR-L5/L6).

## 3. Service boundary

- **No scoring here.** The service cannot touch `ScoreResult` or thresholds; it only reads analytics
  outputs ([DATA_FLOW](../architecture/DATA_FLOW.md) §5).
- **No provider here.** Material generation would be a separate provider call at question-creation
  time, not inside this service.

## 4. Endpoint hand-off

Routes are in [API_ENDPOINTS.md](./API_ENDPOINTS.md) §7; response shapes in
[RECOMMENDATION_ENGINE.md](../ai/RECOMMENDATION_ENGINE.md). The service is stateless over the
analytics snapshot for any given read.