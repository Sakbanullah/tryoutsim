# API Endpoints

Endpoint inventory. Contract and envelope details are in
[API_SPECIFICATION.md](./API_SPECIFICATION.md); this file is the path/method/status table. All paths
are relative to `/api/v1`.

Status legend: `200` success · `201` created · `204` no content · `400` `VALIDATION_FAILED` ·
`404` `NOT_FOUND` · `409` `CONFLICT` / `APPROVAL_INVALID` / `APPROVAL_VERSION_MISMATCH` /
`THRESHOLD_CONFIG_INVALID` · `422` `PREFLIGHT_FAILED` · `426` `CONTRACT_MISMATCH` ·
`429` `RATE_LIMITED` · `502` `PROVIDER_UNAVAILABLE` · `504` `PROVIDER_TIMEOUT`.

---

## 1. Bootstrap / app state

| Method | Path | 200 | Notes |
|---|---|---|---|
| GET | `/bootstrap` | `{ taxonomy, examConfigs[], providers[], questionBankSummary, analyticsReady }` | Read-only snapshot for first paint; the frontend mock layer mirrors its shape |

## 2. Exam configs

| Method | Path | Success | Errors | Notes |
|---|---|---|---|---|
| GET | `/exam-configs` | 200 | — | List, with `state` field (`official_verified`/`historical`/`provisional`) |
| GET | `/exam-configs/:id` | 200 | 404 | Full config + `BasisRef[]` + `Thresholds` |
| POST | `/exam-configs/:id/approve` | 200 | 400, 404, 409 | Bind `ProvisionalApproval` (4 bound values + acks) — FR-E3 |

`approve` never mutates a shipped config's rule values; it only stores the approval record
([CPNS_2026_REGULATIONS.md](../examination/CPNS_2026_REGULATIONS.md) §4.3).

## 3. Questions

| Method | Path | Success | Errors | Notes |
|---|---|---|---|---|
| GET | `/questions` | 200 | 400 | Filter by competency, test, lifecycle, difficulty, provenance |
| GET | `/questions/:id` | 200 | 404 | Full question incl. hidden answerKey for the owner |
| POST | `/questions` | 201 | 400 | Manual create (default lifecycle `draft`) |
| PATCH | `/questions/:id` | 200 | 400, 404 | Lifecycle transitions only where V-rules permit |
| POST | `/questions/:id/activate` | 200 | 409 | `draft`→`active` gate (V-01…V-12 must pass) |
| POST | `/questions/:id/archive` | 200 | 409 | `active`→`archived` |
| POST | `/questions/bulk` | 200 | 400, 409 | Bulk archive/activate — FR-Q4; atomic |

Question validation is field-level in [VALIDATION.md](./VALIDATION.md) and lifecycle in
[QUESTION_SPECIFICATION.md](../examination/QUESTION_SPECIFICATION.md) §3.

## 4. Generation jobs + AI

| Method | Path | Success | Errors | Notes |
|---|---|---|---|---|
| POST | `/generation-jobs` | 202 | 400, 502, 504, 429 | Enqueue N per competency; returns job id — FR-G1 |
| GET | `/generation-jobs/:id` | 200 | 404 | Status + per-batch results + drafts — FR-G2 |
| POST | `/generation-jobs/:id/cancel` | 200 | 409 | Stop unasubmitted batches — FR-G2 |

Generation persistence shape (queue vs row) is unresolved until
[GENERATION_JOBS.md](./GENERATION_JOBS.md) — see
[DEVELOPMENT_ROADMAP.md](../roadmap/DEVELOPMENT_ROADMAP.md).

| Method | Path | Success | Errors | Notes |
|---|---|---|---|---|
| GET | `/providers` | 200 | — | List, keys shown as masked tail only — FR-C1/C6 |
| POST | `/providers` | 201 | 400, 409 | Create provider (key write-only) |
| PATCH | `/providers/:id` | 200 | 400, 404 | Edit base URL, headers, `extraParams` (never return key) |
| DELETE | `/providers/:id` | 204 | 404 | Remove provider |
| POST | `/providers/:id/test` | 200 | 502, 504, 429 | Connection test (listModels/chat smoke) — FR-C2 |
| POST | `/providers/:id/models` | 200 | 502, 504, 429 | Refresh model list — FR-C3 |
| PUT | `/providers/:id/task-map` | 200 | 400, 404 | Task→model mapping + capability flags — FR-C4/C5 |

Provider interface contract is [AI_PROVIDER_ARCHITECTURE.md](../ai/AI_PROVIDER_ARCHITECTURE.md) §2;
secret handling is [SECRETS.md](./SECRETS.md).

## 5. Sessions + scoring

| Method | Path | Success | Errors | Notes |
|---|---|---|---|---|
| POST | `/sessions` | 201 | 400, 409 | Freeze snapshot; requires configId + roster — PF-00 |
| GET | `/sessions/:id` | 200 | 404 | Session + snapshot (no answers disclosed) |
| PATCH | `/sessions/:id/answers` | 200 | 400, 404 | Autosave sheets — FR-T4 |
| POST | `/sessions/:id/submit` | 200 | 400, 404, 409, 422 | Preflight then score; see §below |
| GET | `/sessions/:id/result` | 200 | 404, 409 | Stored `ScoreResult`, or unscored state |

`submit` returns 200 with `ScoreResult` on success; on `PREFLIGHT_FAILED` (422) nothing is scored;
on `APPROVAL_INVALID`/`APPROVAL_VERSION_MISMATCH`/`THRESHOLD_CONFIG_INVALID` (409) the session is
stored **unscored** ([SCORING_METHODOLOGY.md](../examination/SCORING_METHODOLOGY.md) §11).

## 6. Analytics

| Method | Path | 200 | Notes |
|---|---|---|---|
| GET | `/analytics` | `AnalyticsSnapshot` | Per-test/competency metrics + MRT + trends + difficulty |

`AnalyticsSnapshot` shape and sample rules are [ANALYTICS_ENGINE.md](./ANALYTICS_ENGINE.md) §2–6.
The frontend consumes it verbatim ([FRONTEND_DATA_CONTRACTS.md](../frontend/FRONTEND_DATA_CONTRACTS.md)).

## 7. Recommendations

| Method | Path | Success | Errors | Notes |
|---|---|---|---|---|
| GET | `/recommendations/weaknesses` | 200 | — | Top weaknesses (reportable only) — FR-L1/L2 |
| GET | `/recommendations/materials` | 200 | 400 | Materials matched per weakness — FR-L3 |
| POST | `/recommendations/drill` | 201 | 400 | Create targeted drill from a weakness — FR-L4 |
| GET | `/study-plan` | 200 | — | Current plan |
| PUT | `/study-plan` | 200 | 400 | User-edited plan (propose-diff, not overwrite) — FR-L5/L6 |

Boundaries and rules are [RECOMMENDATION_ENGINE.md](../ai/RECOMMENDATION_ENGINE.md).

---

## Not in this file

- Deadline enforcement (FR-T2) is a server-clock concern of the session resource, not a separate
  endpoint — see [DEVELOPMENT_ROADMAP.md](../roadmap/DEVELOPMENT_ROADMAP.md).
- A known-but-out-of-scope feature returns `UNSUPPORTED (501)` — see [API_SPECIFICATION.md](./API_SPECIFICATION.md) §4.