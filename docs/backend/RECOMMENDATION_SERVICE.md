# Recommendation Service

Canonical source for the backend service that turns analytics into recommendations and the learning
sequence.
The rules are [RECOMMENDATION_ENGINE.md](../ai/RECOMMENDATION_ENGINE.md); this file is the service
surface and data hand-off.

---

## 1. Inputs

The service consumes `AnalyticsSnapshot` ([ANALYTICS_ENGINE.md](./ANALYTICS_ENGINE.md) §6) — never
raw answers, never re-derives metrics. It receives:

- per-competency and per-test accuracy (TWK/TIU) or attainment (TKP), each a `MetricValue` with
  `percent`, `answeredCount` and `sessionCount`;
- `testMean` — the user's own mean per test, which is the ranking basis (RECOMMENDATION_ENGINE §2);
  the service never computes it from the competency cells;
- sample-status flags (`zero_correct` / `zero_attainment` / `insufficient_data`).

## 2. Responsibilities

1. **Identify strengths and weaknesses** — reportable cells only: sample ≥ min, deficit from `testMean`
   (FR-L1, BR-L2). The set is **closed before any model is called** (BR-L3).
2. **Attach evidence** — the numeric values, not adjectives: counts, gap, difficulty mix, coverage,
   response time, consistency, trend (FR-L2).
3. **Match materials** — by `competencyId` from the **material bank**, which exists in MVP
   ([MATERIAL_SPECIFICATION](../examination/MATERIAL_SPECIFICATION.md)): returns `available`
   (approved), `draft_available` (exists, unapproved) or `none` plus the generate action. *(Supersedes
   DB-1's `no_material`/`no_verified_basis` absence envelope.)*
4. **Build drills** — a targeted drill request creates a `submateri` package with
   `repeatPolicy: 'allow_repeat'` and starts a session from it (FR-L4,
   [PACKAGE_SPECIFICATION](../product/PACKAGE_SPECIFICATION.md) §6).
5. **Order the sequence** — deterministic order by weakness rank, then optionally reordered and
   explained (FR-L5/L6). No user-editable plan is stored, because a standalone Rencana Belajar feature is
   not in MVP ([RECOMMENDATION_ENGINE](../ai/RECOMMENDATION_ENGINE.md) §7).
6. **Optionally order and explain** — call the `analysis` task with the closed weakness set. The output is
   validated as a permutation of the input ids plus explanation text; anything else is discarded
   ([RECOMMENDATION_ENGINE](../ai/RECOMMENDATION_ENGINE.md) §6). If the call fails, the deterministic
   list is returned unchanged.

## 3. Service boundary

- **No scoring here.** The service cannot touch `ScoreResult` or thresholds; it only reads analytics
  outputs ([DATA_FLOW](../architecture/DATA_FLOW.md) §5).
- **No invented weakness.** The service does not create a competency cell the analytics snapshot does
  not report.
- **No metric recomputation.** Deficit, ranking and coverage come from analytics; the service ranks and
  maps only.
- **Provider use is optional and last.** The AI ordering/explanation step is the final step and never on
  the critical path of a result screen ([AI_PROVIDER_ARCHITECTURE](../ai/AI_PROVIDER_ARCHITECTURE.md) §4).

## 4. Endpoint hand-off

Routes are in [API_ENDPOINTS.md](./API_ENDPOINTS.md) §11; response shapes in
[RECOMMENDATION_ENGINE.md](../ai/RECOMMENDATION_ENGINE.md). The service is stateless over the
analytics snapshot for any given read.