# API Endpoints

Endpoint inventory. Contract and envelope details are in
[API_SPECIFICATION.md](./API_SPECIFICATION.md); this file is the path/method/status table. All paths
are relative to `/api/v1`.

Status legend: `200` success · `201` created · `202` accepted · `204` no content · `400` `VALIDATION_FAILED` ·
`404` `NOT_FOUND` · `409` `CONFLICT` / `THRESHOLD_CONFIG_INVALID` / `REGULATORY_*` · `422` `PREFLIGHT_FAILED` · `426` `CONTRACT_MISMATCH` ·
`429` `RATE_LIMITED` · `502` `PROVIDER_UNAVAILABLE` / `PROVIDER_AUTH_FAILED` · `504` `PROVIDER_TIMEOUT`.

`APPROVAL_MISSING` / `APPROVAL_INVALID` / `APPROVAL_VERSION_MISMATCH` are **not** HTTP errors: they appear
as `verdict.withheld` inside a `200` result ([API_SPECIFICATION](./API_SPECIFICATION.md) §4).

---

## 1. Bootstrap / app state

| Method | Path | 200 | Notes |
|---|---|---|---|
| GET | `/bootstrap` | `{ taxonomy, packages[], providers[], questionBankSummary, analyticsReady, notifications: { unreadCount }, defaults }` | Read-only snapshot for first paint; the frontend mock layer mirrors its shape. **No exam-config list**: the learner never selects a config ([PACKAGE_SPECIFICATION](../product/PACKAGE_SPECIFICATION.md) §3) |

## 2. Exam configs (Kelola → Konfigurasi Ujian only)

| Method | Path | Success | Errors | Notes |
|---|---|---|---|---|
| GET | `/exam-configs` | 200 | — | Management list with `state`, `configVersion`, approval status. **`pathway: 'CPNS'` only**; `legacy` rows are not returned |
| GET | `/exam-configs/:id` | 200 | 404 | Full config + `BasisRef[]` + `Thresholds` + whether a threshold verdict is possible |
| POST | `/exam-configs/:id/approval` | 200 | 400, 404, 409 | Record `ProvisionalApproval` (four bound values computed server-side + acks) — FR-E3. Contract: [API_SPECIFICATION](./API_SPECIFICATION.md) §7.2 |
| POST | `/exam-configs` | 201 | 400 | Create a temporary (`provisional`) config version from documented values — FR-E5. Values without a basis are rejected (§4.2 of the regulations) |

`approval` never mutates a shipped config's rule values; it only stores the approval record
([CPNS_2026_REGULATIONS.md](../examination/CPNS_2026_REGULATIONS.md) §4.3). This is the **only**
route that grants approval — there is no `/approve` alias. A config's approval is **not** needed to
start or score a session (§4.2 there).

## 3. Packages and sessions

Package rules: [PACKAGE_SPECIFICATION](../product/PACKAGE_SPECIFICATION.md). Selection is server-side;
the client never sends a roster.

| Method | Path | Success | Errors | Notes |
|---|---|---|---|---|
| GET | `/packages` | 200 | — | List by `mode` (`tryout`/`latihan`), with availability + `repeatWarning` + `unavailableReason` |
| GET | `/packages/:id` | 200 | 404 | Current version + definition + startability |
| POST | `/packages` | 201 | 400 | Create a custom package from a template (version 1) |
| POST | `/packages/:id/versions` | 201 | 400, 404 | Save an edit as a **new version** (never `PUT`); returns the new version |
| POST | `/packages/:id/retire` | 200 | 404 | Retire; versions stay readable for past sessions |
| GET | `/latihan/submateri` | 200 | — | Leaf thesis nodes usable as Latihan units, with stock counts |

## 4. Sessions + scoring

| Method | Path | Success | Errors | Notes |
|---|---|---|---|---|
| POST | `/packages/:id/sessions` | 201 | 400, 404, 409 | Assemble the roster, resolve and bind a CPNS config (§4.2.1 of the exam record), freeze `session` + `session_snapshot` in one transaction (PF-00). The only way to start a session. |
| GET | `/sessions` | 200 | 400 | Session history (tryout + latihan), newest first; filters mode/date/status. **No config selector**; each row carries the mode and result summary |
| GET | `/sessions/:id` | 200 | 404, 409 | Runner payload: frozen question content (stem, options, asset) **and** saved answers, plus the clock state. Explanations/keys **excluded** for a tryout |
| PATCH | `/sessions/:id/answers` | 200 | 400, 404, 409 | Autosave: one answer, its flag, and the clock update in one call (FR-T4, scoring §8.1). `409` once submitted — answers freeze at submit |
| POST | `/sessions/:id/pause` | 200 | 404, 409 | Persist `activeMs`, clear `runningSince` |
| POST | `/sessions/:id/resume` | 200 | 404, 409 | Re-arm the clock; returns expired state when `activeMs ≥ durationMs` |
| POST | `/sessions/:id/answer-feedback` | 200 | 404, 409 | **Latihan only.** Returns the key + explanation + per-option weights for the just-answered question (FR-P2). `409 reason:"tryout_no_feedback"` for a tryout |
| POST | `/sessions/:id/submit` | 200 | 400, 404, 422 | Freeze answers, pre-flight, score, emit a verdict when possible (§below) |
| POST | `/sessions/:id/score` | 200 | 404, 409, 422 | Re-run pre-flight on the **same** snapshot after a genuine abort (codes 1 or 6). Contract: [API_SPECIFICATION](./API_SPECIFICATION.md) §7.3 |
| GET | `/sessions/:id/result` | 200 | 404 | Stored `ScoreResult` — score, per-submateri strengths/weaknesses, recommendation, optional verdict. **No question content and no explanation**: those are §7.7 |
| GET | `/sessions/:id/questions?ids=…` | 200 | 400, 404, 409 | Tinjau jawaban block content (batch, 1–20 roster ids): frozen stem/options/key/TKP weights from the snapshot. **Any bad id** — malformed, unknown, duplicate, or outside the roster — is one `400`. `409 session_open` before submit. Contract: [API_SPECIFICATION](./API_SPECIFICATION.md) §7.7 |
| DELETE | `/sessions/:id` | 204 | 404 | Delete one history entry; returns the consequence preview on a preceding `GET` (§6) |
| POST | `/sessions/bulk-delete` | 200 | 400 | Delete selected history; one transaction |

**Submit outcome.** A submit always produces a `ScoreResult` unless pre-flight finds the snapshot or the
answer sheets semantically corrupt (`PREFLIGHT_FAILED`, 422) or the regulatory scope is wrong
(`REGULATORY_*`, 409). A missing or invalid approval **does not block the submit**: it withholds the
verdict only ([SCORING_METHODOLOGY.md](../examination/SCORING_METHODOLOGY.md) §5.6, §11).

**Content split for Tinjau jawaban.** Question text, options, the key the session was scored with and
its TKP per-option reasoning (`optionJustifications`,
[QUESTION_SPECIFICATION.md](../examination/QUESTION_SPECIFICATION.md) §1.2) are the **frozen
snapshot's**. The explanation is read from the question's latest version but **shown only when that
version equals the frozen version** (strict version matching, Product Owner 2026-11-09) — a re-edited
question shows "Pembahasan untuk soal ini belum tersedia." instead. It arrives from
`GET /sessions/:id/questions` (§4), one request per review page — never by widening `ScoreResult`.

## 5. Analytics and history impact

| Method | Path | 200 | Notes |
|---|---|---|---|
| GET | `/analytics` | `AnalyticsSnapshot` | Per-test/competency metrics + MRT + trends + consistency + coverage + both difficulty breakdowns. Returns one snapshot per distinct `(configId, configVersion, scoringVersion)` triple with `comparability.mixed` naming every version present (FR-A5) |
| GET | `/analytics/trends?competencyId=<id>` | `TrendSeries` | Per-session metric series, ≥3 sessions or `insufficient_data` (FR-A2). Shape in [ANALYTICS_ENGINE.md](./ANALYTICS_ENGINE.md) §6 |
| GET | `/sessions/:id/deletion-impact` | `{ derivedChanges: string[], sessionsAffected: number }` | What deleting this history entry will change, in plain language, before the confirm step (FR-A8) |

`AnalyticsSnapshot` shape and sample rules are [ANALYTICS_ENGINE.md](./ANALYTICS_ENGINE.md) §2–§6; history
deletion is §7 there. The frontend consumes both verbatim
([FRONTEND_DATA_CONTRACTS.md](../frontend/FRONTEND_DATA_CONTRACTS.md)).

## 6. Questions (Bank Soal, Review Soal)

| Method | Path | Success | Errors | Notes |
|---|---|---|---|---|
| GET | `/questions` | 200 | 400 | Filters: text, test, competency (leaf/domain), `difficultyAiInitial`, `empiricalDifficulty`, lifecycle, origin, provider, model, batch, created from/to (query keys; the stored columns are `difficultyAiInitial` and `empiricalDifficultyJson` — [DATABASE_SCHEMA](./DATABASE_SCHEMA.md) §2). **No saved filters** (FR-Q1) |
| GET | `/questions/duplicates` | 200 | — | Candidate duplicate clusters from `contentHash` (V-08/V-09) — FR-Q5 |
| GET | `/questions/:id` | 200 | 404 | Full question incl. hidden answerKey, validation layers, sampling record, **version history**, sessions that used it |
| POST | `/questions` | 201 | 400 | Manual create, one at a time (FR-Q6). **No bulk import, no bulk edit** |
| PATCH | `/questions/:id` | 200 | 400, 404, 409 | Content edit; bumps `contentVersion`, invalidates validation, sets sampling `pending`. Refused while a session that froze it is `open` only for the *answer key* (V-06 protection) |
| PATCH | `/questions/:id/accept` | 200 | 400, 404, 409 | User accepts/rejects a draft: `draft`/`quarantined` → `human_reviewed`, or → `rejected` (FR-G4, FR-Q3) |
| POST | `/questions/:id/activate` | 200 | 409 | Activation gate: T pass on the current hash, `answerKeyValidatedAt` set, sampling gate satisfied when AI-origin |
| POST | `/questions/:id/archive` | 200 | 409 | `active` → `archived` |
| POST | `/questions/bulk` | 200 | 400, 409 | Bulk **archive only** (`active → archived`), one transaction (FR-Q4). Cannot activate, accept or edit content |
| POST | `/questions/:id/quarantine` | 200 | 409 | → `quarantined`, reason required (withdrawal, later defect) |
| POST | `/questions/:id/reports` | 201 | 400, 404 | File a report (`critical` auto-quarantines) — FR-Q7 |
| GET | `/question-reports` | 200 | 400 | Queue for **Kelola → Review Soal** |
| PATCH | `/question-reports/:id` | 200 | 400, 404 | Record the user's final decision (`repaired`/`withdrawn`/`rejected`) |
| POST | `/question-batches/:batchId/sample` | 200 | 400, 404, 409 | Record the sampling outcome (`clean` / `findings[]` / `systemic`); moves eligible questions to `dynamicEligible` — FR-G7 |
| GET | `/question-batches` | 200 | 400 | Batches awaiting sampling / sampled, with counts |

The seven lifecycle states and their legal transitions are canonical in
[QUESTION_SPECIFICATION.md](../examination/QUESTION_SPECIFICATION.md) §3; this table names the routes,
not a second state machine. **Bulk archive** (`POST /questions/bulk`, same table) is a bank housekeeping
operation for `active → archived` only; it cannot activate, accept or edit content (FR-Q4 narrowed).
There is no route that moves a question to `active` except `activate`.

## 7. Material (Kelola → Materi)

| Method | Path | Success | Errors | Notes |
|---|---|---|---|---|
| GET | `/materials` | 200 | 400 | List/filter by scope (`competency`/`domain`/`free`), `contentType`, `status`, origin |
| GET | `/materials/:id` | 200 | 404 | Record + source list + version history |
| POST | `/materials` | 201 | 400 | Create (manual or AI-drafted) — status `draft` |
| PATCH | `/materials/:id` | 200 | 400, 404 | Edit → new `version`, back to `draft` |
| POST | `/materials/:id/approve` | 200 | 400, 404 | Approve a specific version (M-01…M-05) |
| POST | `/materials/:id/retire` | 200 | 404 | Leave the recommendation pool |
| POST | `/materials/:id/draft` | 202 | 400, 404, 502, 504 | Draft a material with the AI provider (task `material`) — returns a job id |

Rules and validation: [MATERIAL_SPECIFICATION](../examination/MATERIAL_SPECIFICATION.md).

## 8. Generation jobs + AI configuration

| Method | Path | Success | Errors | Notes |
|---|---|---|---|---|
| POST | `/generation-jobs` | 202 | 400, 409, 502, 504, 429 | Enqueue N per competency set; returns job id — FR-G1. `409 reason:"provider_untested"` / `"task_unmapped"` |
| GET | `/generation-jobs` | 200 | 400 | List jobs, newest first |
| GET | `/generation-jobs/:id` | 200 | 404 | Status + per-batch results + drafts + partial counts — FR-G2. **No token/cost fields** |
| POST | `/generation-jobs/:id/retry` | 202 | 400, 404, 409 | Retry an `interrupted`/`failed` job on the same provider+model — FR-G8 |

**No cancel, pause or resume route.** MVP generation jobs expose create, list, read and retry only
(Product Owner decision, 2026-11-08; [GENERATION_JOBS](./GENERATION_JOBS.md) §2).

| Method | Path | Success | Errors | Notes |
|---|---|---|---|---|
| GET | `/providers` | 200 | — | List, keys shown as masked tail only — FR-C1/C6 |
| POST | `/providers` | 201 | 400, 409 | Create provider (`preset` + `baseUrl`; key write-only, OS credential store) |
| PATCH | `/providers/:id` | 200 | 400, 404 | Edit base URL, headers, `extraParams` (never return key) |
| DELETE | `/providers/:id` | 204 | 404 | Remove provider; its credential entry is purged |
| POST | `/providers/:id/test` | 200 | 502, 504, 429 | Connection test **and** capability probe — FR-C2. Required before a job |
| POST | `/providers/:id/models` | 200 | 502, 504, 429 | Refresh model list (auto list; manual Model ID always allowed) — FR-C3 |
| PUT | `/providers/:id/capabilities` | 200 | 400, 404 | Manual correction of capability flags — FR-C5 |
| GET | `/ai-routing` | 200 | — | One global default + per-task overrides |
| PUT | `/ai-routing` | 200 | 400, 404 | Set the global default and/or per-task overrides — FR-C4 |

Provider interface contract is [AI_PROVIDER_ARCHITECTURE.md](../ai/AI_PROVIDER_ARCHITECTURE.md) §2;
secret handling is [SECRETS.md](./SECRETS.md).

## 9. Notifications

| Method | Path | Success | Errors | Notes |
|---|---|---|---|---|
| GET | `/notifications` | 200 | 400 | Newest first; filters `unread`, `type`, `limit` |
| PATCH | `/notifications/:id` | 200 | 404 | Mark read / dismissed |
| POST | `/notifications/read-all` | 200 | — | Mark every unread as read |

Records, event types and delivery: [NOTIFICATION_SPECIFICATION](./NOTIFICATION_SPECIFICATION.md).

## 10. Backup, restore, app data

| Method | Path | Success | Errors | Notes |
|---|---|---|---|---|
| GET | `/settings/backup` | 200 | — | Folder, retention, last successful run, history |
| PUT | `/settings/backup` | 200 | 400 | Set folder and retention (`keepLastN`, `maxAgeDays`) |
| POST | `/backups` | 202 | 400, 409 | Run a manual backup; `409` while one is in progress. Failure is reported as a `backup_record` with `status: 'failed'` and a notification |
| GET | `/backups` | 200 | — | Backup history with status and failure reason |
| POST | `/restores/validate` | 200 | 400, 409 | Compatibility check of an archive (schema version, tables, integrity) — **no write** |
| POST | `/restores` | 202 | 400, 409 | Perform the restore after confirmation; replaces data; keys excluded |
| GET | `/health` | 200 | — | Readiness marker used by the launcher ([DEPLOYMENT_AND_BACKUP](../architecture/DEPLOYMENT_AND_BACKUP.md) §1.2) |

Backup/restore rules: [DEPLOYMENT_AND_BACKUP](../architecture/DEPLOYMENT_AND_BACKUP.md) §2–§3.

## 11. Recommendations

| Method | Path | Success | Errors | Notes |
|---|---|---|---|---|
| GET | `/recommendations/weaknesses` | 200 | — | Ranked weaknesses (reportable only) + strengths + insufficient-data rows — FR-L1/L2 |
| GET | `/recommendations/materials` | 200 | 400 | `MaterialOffer` — `available` / `draft_available` / `none` (material bank exists in MVP) — FR-L3 |
| POST | `/recommendations/drill` | 201 | 400, 409 | Create a weakness drill package + session — FR-L4 |

`GET /study-plan` and `PUT /study-plan` are **withdrawn from MVP**: a standalone Rencana Belajar feature
is not approved ([RECOMMENDATION_ENGINE](../ai/RECOMMENDATION_ENGINE.md) §7). E76/E77 are retired ids and
are not reused.

Boundaries and rules are [RECOMMENDATION_ENGINE.md](../ai/RECOMMENDATION_ENGINE.md).

---

## Not in this file

- Session duration is **accumulated active time** enforced by the session resource
  ([SCORING_METHODOLOGY.md](../examination/SCORING_METHODOLOGY.md) §8.1), not a separate endpoint.
- **No** CSV/Excel import, bulk question edit, saved filters, OS notifications, pause/resume of a
  generation job, cross-provider AI fallback — all recorded as out of scope
  ([MVP_SCOPE.md](../product/MVP_SCOPE.md) §3).
- A known-but-out-of-scope feature returns `UNSUPPORTED (501)` — see [API_SPECIFICATION.md](./API_SPECIFICATION.md) §4.
