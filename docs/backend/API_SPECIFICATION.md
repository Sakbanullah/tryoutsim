# API Specification

Canonical source for the backend HTTP surface. The frontend reads this (and
[FRONTEND_DATA_CONTRACTS.md](../frontend/FRONTEND_DATA_CONTRACTS.md)); the backend implements this
as a Node.js 24 service on `node:http`, over PostgreSQL 18 through Prisma ORM ([ADR-002](../decisions/ADR-002-sqlite.md),
[ADR-011](../decisions/ADR-011-orm-selection.md), [SYSTEM_ARCHITECTURE.md](../architecture/SYSTEM_ARCHITECTURE.md) §5).
No endpoint listed here is implemented yet — this is a contract, not code.

---

## 1. Conventions

- **Base path** `http://127.0.0.1:<port>/api/v1` — loopback only
  ([SECURITY.md](../architecture/SECURITY.md) §2).
- **Single local user, no auth** ([AUTHENTICATION.md](./AUTHENTICATION.md)).
- **Media type** `application/json`; request/response bodies are JSON unless `204`.
- **IDs** are strings, opaque, stable per resource. No client-side parsing of IDs into
  sub-parts (AUD-06).
- **Timestamps** ISO-8601 UTC (`2026-11-07T14:30:00Z`).
- **Durations** milliseconds as integers; response time is reported as a **median** (FR-A1 says
  "mean"; median is what [ANALYTICS_ENGINE.md](./ANALYTICS_ENGINE.md) §2.3 computes and what this
  contract carries — the PRD wording is the one to fix, tracked in `docs/audit/AUDIT_FINDINGS_RESOLUTION.md` ANA-5).
- **Integers only** for anything scoring-related: counts, scores, percentages are integers
  (`55`, not `55.0`, not `0.55`).
- **Percentages** are integer 0–100, always accompanied by the raw counts they derive from
  (see `MetricValue` §6.1).

## 2. Success envelope

Every `2xx` body is a JSON object:

```json
{ "data": <resource | array>, "meta": { "version": "<contract-version>" } }
```

- `meta.version` is the API contract version the response obeys; the frontend matches it against
  its own expected version (see §6 error `CONTRACT_MISMATCH`).

## 3. Error envelope

Every non-`2xx` body is **one** JSON object:

```json
{
  "error": {
    "code": "<ERROR_CODE>",
    "message": "<human-readable, no secrets>",
    "details": "<object | null>",
    "requestId": "<opaque id, for logs only>"
  }
}
```

- `message` never contains provider keys, auth headers, or stack traces
  ([ERROR_HANDLING.md](./ERROR_HANDLING.md) §2).
- `details` shape depends on `code`; the shape is fixed per code below.
- HTTP statuses are a shorthand, never the error source of truth — the client always reads
  `error.code` ([ERROR_HANDLING.md](./ERROR_HANDLING.md) §1).

## 4. Error registry

| code | HTTP | `details` shape | Meaning |
|---|---|---|---|
| `VALIDATION_FAILED` | 400 | `{ "fields": [{ "path": string, "message": string, "rule": string }] }` | Request body violates a field rule (see [VALIDATION.md](./VALIDATION.md)) |
| `NOT_FOUND` | 404 | `{ "resource": string, "id": string }` | Resource does not exist |
| `CONFLICT` | 409 | `{ "resource": string, "reason": string }` | State conflict: a legal-transition or lifecycle refusal (`illegal_transition`, `already_submitted`, `not_resubmittable`, `tryout_no_feedback`, …) or a bank operation that cannot proceed (`no_eligible_stock`, `package_retired`, `no_usable_config`) |
| `PROVIDER_UNAVAILABLE` | 502 | `{ "providerId": string, "reason": string }` | Provider call failed at transport level |
| `PROVIDER_AUTH_FAILED` | 502 | `{ "providerId": string }` | Provider returned auth/unauthorised (key masked, never echoed) |
| `RATE_LIMITED` | 429 | `{ "providerId": string, "retryAfterMs": int \| null }` | Provider rate limit |
| `PROVIDER_TIMEOUT` | 504 | `{ "providerId": string, "timeoutMs": int }` | Provider call exceeded timeout |
| `PREFLIGHT_FAILED` | 422 | `{ "errors": PreflightError[] }` | One or more PF-xx/SC-xx checks failed; **nothing was scored** |
| `APPROVAL_MISSING` | 200 | `{ "verdict": null, "withheld": { "code": "APPROVAL_MISSING", "changed": [], "config": ConfigSummary } }` on the result | Thresholds are carried and no approval was ever granted. **The score is written; the verdict is withheld** (§5.6 of the scoring doc). `changed` is empty by construction (nothing to diff) |
| `APPROVAL_INVALID` | 200 | same envelope with `{ "changed": ChangeEntry[], "config": ConfigSummary }` | A valid approval exists for the same version, but a bound value or threshold drifted. **The score is written; the verdict is withheld** |
| `APPROVAL_VERSION_MISMATCH` | 200 | same envelope with `{ "changed": ChangeEntry[] }` | Approval exists but targets a different `configVersion`/`scoringVersion` than the snapshot froze. **The score is written; the verdict is withheld** |
| `THRESHOLD_CONFIG_INVALID` | 409 | `{ "changed": ChangeEntry[], "thresholds": ThresholdSummary }` | Threshold block malformed/inconsistent vs scoring rules — a genuine block, nothing scored. `THRESHOLD_NOT_INTEGER`, `THRESHOLD_EXCEEDS_MAX` and `THRESHOLDS_REQUIRE_APPROVAL` are PF-09 refusals ranked in this class ([SCORING_METHODOLOGY](../examination/SCORING_METHODOLOGY.md) §5.3, §11.1) |
| `REGULATORY_PATHWAY_MISMATCH` / `REGULATORY_YEAR_MISMATCH` / `REGULATORY_SCOPE_UNVERIFIED` | 409 | `{ "changed": ChangeEntry[] }` | PF-12: a basis whose pathway or year does not match the snapshot, or a `Sekolah Kedinasan`/`UNVERIFIED` instrument never approved for this pathway (`changed[]` names the offending `BasisRef` field). A config to be rebuilt, not re-approved; nothing scored ([SCORING_METHODOLOGY](../examination/SCORING_METHODOLOGY.md) §6.7, §11.1) |
| `CONTRACT_MISMATCH` | 426 | `{ "expected": string, "actual": string }` | Client contract version differs from server |
| `UNSUPPORTED` | 501 | `{ "feature": string }` | Known but deliberately out of scope |

This registry is the **closed** set ([ERROR_HANDLING.md](./ERROR_HANDLING.md) §1). The three approval
codes are **verdict-only** outcomes: they appear in a `200` result as `verdict.withheld`, never as an HTTP
error, so a missing or drifted approval can never cost the user a score. `THRESHOLD_CONFIG_INVALID`, the
`REGULATORY_*` codes and `PREFLIGHT_FAILED` are genuine blocks and are ranked in
[SCORING_METHODOLOGY.md](../examination/SCORING_METHODOLOGY.md) §11.1; when one submit violates several,
the ranking decides which code this registry returns, and `PREFLIGHT_FAILED.errors[]` still lists every
failing PF-xx/SC-xx.

### 4.1 `PreflightError`

```json
{ "code": "PF-01", "path": "sheets[3].selectedOption", "message": "...", "severity": "block" }
```

- `code` is one of `PF-00`…`PF-13` / `SC-01`…`SC-08` — exactly the IDs in
  [SCORING_METHODOLOGY.md](../examination/SCORING_METHODOLOGY.md) §6.1, never invented here.
- `severity` is always `"block"` (a preflight failure always blocks scoring).
- `path` points at the offending field when one exists, else is `null`.

### 4.2 `APPROVAL_*` / `THRESHOLD_CONFIG_INVALID` — `changed[]`

`changed[]` is shared by the three codes that describe a *diff* (`APPROVAL_MISSING` carries an empty
array — see below). Each element names what changed and its before/after value, **never the content
of a hash** (hashes are compared opaque, not displayed):

```json
{
  "changed": [
    { "field": "configVersion",       "approved": 2,     "current": 3 },
    { "field": "scoringVersion",      "approved": 2,     "current": 3 },
    { "field": "regulatoryBasisHash", "approved": "<opaque-hash>", "current": "<opaque-hash>" },
    { "field": "thresholds.total",    "approved": 311,   "current": 314 }
  ]
}
```

Rules binding `changed[]`:

- **Bounds.** `configId`, `configVersion`, `scoringVersion`, `regulatoryBasisHash` (the four
  approval-bound values of [CPNS_2026_REGULATIONS.md](../examination/CPNS_2026_REGULATIONS.md) §4.3)
  **plus** any field of the snapshot's `ThresholdSet` (`thresholds.mode`,
  `thresholds.TWK`/`TIU`/`TKP`/`total`). Nothing else — not a general-purpose diff, and never an
  `approvedByUserAt`/`approvedBy` entry (those are provenance, not bound values).
- **Values are JSON-typed.** `configVersion`/`scoringVersion` are numbers (they are `number` in the
  contract, not strings); thresholds are integers. Never stringified for display convenience.
- **`config` / `thresholds`** in `details` is a summary for UX display: state, label, and the
  effective thresholds — again **no hashes, no secrets**.

The codes share this type but differ in `details` and in what they tell the UI. The first three are
**verdict-only** and travel inside a `200` result; only `THRESHOLD_CONFIG_INVALID` is an error status:

| code | what failed | remedy |
|---|---|---|
| `APPROVAL_MISSING` | thresholds are carried and no approval was ever granted | the result carries **no verdict** and says no passing threshold is verified; the user may approve in **Kelola → Konfigurasi Ujian**, then re-score the same session with `/score` to obtain a verdict |
| `APPROVAL_INVALID` | a bound value or threshold field drifted since approval | same: score stands, verdict withheld until re-approval |
| `APPROVAL_VERSION_MISMATCH` | the stored approval binds a different `configVersion`/`scoringVersion` than the snapshot froze | the snapshot keeps its rules; a verdict would be re-derived by re-approving **those** values. The app never silently scores under newer rules |
| `THRESHOLD_CONFIG_INVALID` | threshold block fails §5.1/§5.3 integrity (missing/forbidden field, non-integer, above ceiling) | config is rejected until corrected — no approval path fixes a malformed block |

**Score-versus-verdict.** No verdict-only code discards a result
([SCORING_METHODOLOGY.md](../examination/SCORING_METHODOLOGY.md) §5.6). A submit always returns a
`ScoreResult`; when the verdict is withheld the score fields are complete and `verdict` is `null`. Only
`PREFLIGHT_FAILED` (422), `THRESHOLD_CONFIG_INVALID` (409) and the regulatory-scope codes
(`REGULATORY_*`, 409) mean **nothing was scored**. Which of them wins is
[SCORING_METHODOLOGY.md](../examination/SCORING_METHODOLOGY.md) §11.1.

## 5. `ScoreResult` — the one result shape

On a successful score (`POST /sessions/:id/submit` or `POST /sessions/:id/score`, 200), `data` **is**
the `ScoreResult` defined in [SCORING_METHODOLOGY.md](../examination/SCORING_METHODOLOGY.md) §2.2 —
the same object the pure function returns and the same object `score_result` stores. There is no
wire-specific variant: field names, nesting and types are identical.

Every field is **read from the stored row** — `timing`, `withheld`, `packageBinding` and `scoredAt` included.
Nothing on this payload is projected or recomputed at read time (AUD-88, PO 2026-11-10); `timing` is
computed once, at scoring, and `verdict` is the stored `verdictJson` or `null`.

```json
{
  "sessionId": "s_01J...",
  "configId": "skd-cpns-2026-provisional",
  "configVersion": 3,
  "scoringVersion": 2,
  "snapshotVersion": "s1-2026-11-07T10:00:00Z-9f2c1a7b",
  "approval": {
    "configId": "skd-cpns-2026-provisional",
    "configVersion": 3,
    "scoringVersion": 2,
    "regulatoryBasisHash": "<opaque-hash>",
    "approvedByUserAt": "2026-11-07T09:58:11.000Z",
    "approvedBy": "local-user",
    "acknowledgedWarnings": ["UNV-01", "UNV-05"]
  },
  "total": { "earned": 250, "possible": 550, "answeredCount": 110, "correctCount": 62 },
  "byTest": {
    "TWK": { "earned": 120, "possible": 150, "answeredCount": 30, "correctCount": 24 },
    "TIU": { "earned": 130, "possible": 175, "answeredCount": 35, "correctCount": 26 },
    "TKP": { "earned": 172, "possible": 225, "answeredCount": 45, "correctCount": 0 }
  },
  "byCompetency": {
    "TIU.NUMERIK.DERET": { "earned": 15, "possible": 15, "answeredCount": 3, "correctCount": 3 }
  },
  "byQuestion": [
    { "questionId": "q_01", "test": "TWK", "competencyId": "TWK.PILAR_NEGARA",
      "earned": 5, "maxScore": 5, "selected": "B", "correct": true },
    { "questionId": "q_02", "test": "TKP", "competencyId": "TKP.PELAYANAN_PUBLIK",
      "earned": 4, "maxScore": 5, "selected": "B", "correct": null }
  ],
  "thresholds": {
    "mode": "none"
  },
  "verdict": null,
  "timing": { "activeMs": 5320000, "durationMs": 6000000 },
  "packageBinding": { "packageId": "pkg_skd_full", "packageVersion": 4, "mode": "tryout",
                      "kind": "full_simulation", "rosterHash": "<opaque>" }
}
```

- `byQuestion` has **one row per roster question**, answered or not — not "one per answered item".
  `selected: null` with `correct: null` is an unanswered TWK/TIU item; TKP is always
  `correct: null` with `correctCount: 0` in every TKP bucket
  ([SCORING_METHODOLOGY.md](../examination/SCORING_METHODOLOGY.md) §2.2, §4).
- `thresholds` is the `ThresholdEvaluation` of §5.4 — `{ "mode": "none" }` when the config asserts no
  threshold. There is no `naikTotal`/`naikTiu` field on the wire or in storage
  ([SCORING_METHODOLOGY.md](../examination/SCORING_METHODOLOGY.md) §5).
- **`verdict` is `null` whenever no verdict is possible** — no thresholds carried, or approval
  missing/invalid (§5.6). It is never `false` as a placeholder: absence of a verdict is not a failure.
- `timing.activeMs` is accumulated **active** time, recorded as evidence; it never influences the score
  ([SCORING_METHODOLOGY.md](../examination/SCORING_METHODOLOGY.md) §8.1).
- `packageBinding` names the package version the roster came from
  ([PACKAGE_SPECIFICATION.md](../product/PACKAGE_SPECIFICATION.md) §5).
- `approval` is present iff a verdict was authorized by a provisional approval; if present it is
  the full `ProvisionalApproval` ([CPNS_2026_REGULATIONS.md](../examination/CPNS_2026_REGULATIONS.md) §4.3).
- All numbers are integers. The frontend renders these values, never recomputes them
  ([FRONTEND_DATA_CONTRACTS.md](../frontend/FRONTEND_DATA_CONTRACTS.md) §1).

## 6. Analytics projection — `AnalyticsSnapshot`

`GET /analytics` returns [ANALYTICS_ENGINE.md](./ANALYTICS_ENGINE.md) §6's `AnalyticsSnapshot`
verbatim: integer `percent` (0–100) + `numerator`/`denominator`/`answeredCount`/`sessionCount` per
`MetricValue`, an explicit `state`, and a `comparability` block naming the config/scoring versions
in the set (§6.2 below). `MetricValue` is defined once, in `ANALYTICS_ENGINE.md` §6; this section
only fixes the route's shape.

### 6.1 `MetricValue` on the wire

Exactly [ANALYTICS_ENGINE.md](./ANALYTICS_ENGINE.md) §6's type. The two checks a client can rely on:
`percent` is an integer in `0..100` (`null` iff `state === 'insufficient_data'`), and `state` is always
present — `reportable` / `insufficient_data` / `zero_correct` / `zero_attainment`.

### 6.2 `comparability`

`GET /analytics` returns one `AnalyticsSnapshot` per distinct `(configId, configVersion,
scoringVersion)` triple present in the set and `comparability.mixed === true` when there is more than one,
with `comparability.versions[]` listing each triple, so FR-A5's "never compare incompatible configs
silently" is a field, not a hope. **The learner area does not offer a config filter**: scoping is a
management concern, not a start prerequisite.

## 7. Endpoint contracts (the flows that were previously unspecified)

Each subsection fixes method, path, purpose, authorization, request, response, validation, errors,
idempotency/state transitions and database effect. Field rules referenced by id are in
[VALIDATION.md](./VALIDATION.md) §2.

### 7.1 `PATCH /questions/:id/accept`

| Aspect | Contract |
|---|---|
| Purpose | The user accepts (possibly after editing) an AI draft: `draft`/`quarantined` → `human_reviewed`. This is the human-review step in [QUESTION_SPECIFICATION.md](../examination/QUESTION_SPECIFICATION.md) §3. |
| Authorization | Single local user; no roles (ADR-009). The review must be attributable: `reviewedBy` is always the local user string, never client-supplied. |
| Request | `{ "decision": "accepted" \| "edited" \| "rejected", "edits"?: FieldEdit[], "notes"?: string }` |
| Response `200` | `{ "question": Question, "review": ReviewHistory }` — the updated record and the appended entry |
| Validation | `question_id`; `decision` must be a legal transition from the current `lifecycle` (accept/edit from `draft` or `quarantined`; reject from `draft`/`ai_validated`/`quarantined`); `edits` required when `decision === 'edited'`; every `edits[].field` a writable content field |
| Errors | `400 VALIDATION_FAILED`; `404 NOT_FOUND`; `409 CONFLICT` with `reason: "illegal_transition"` (e.g. accepting an `active` question) |
| Idempotency | Repeating the exact same decision on an already-`human_reviewed` question returns `200` with the existing entry and appends nothing (the review history is append-only; a duplicate is not written twice). |
| State transition | `draft → human_reviewed` (accept), `quarantined → human_reviewed` (accept — clears quarantine), `draft/ai_validated/quarantined → rejected` (terminal). It **never** reaches `active`; that is `POST /questions/:id/activate`. |
| DB effect | `question.lifecycle` updated; one row appended to `question_review`; for `edited`, `contentVersion` + 1 and the old `ValidationRecord` is marked stale by `contentHash` mismatch. Provenance flips `ai_generated → ai_generated_human_reviewed` (§2). |

### 7.2 `POST /exam-configs/:id/approval`

Replaces the earlier `POST /exam-configs/:id/approve` name (one route, one name — see
`docs/audit/AUDIT_FINDINGS_RESOLUTION.md` FL-3).

| Aspect | Contract |
|---|---|
| Purpose | Record the user's explicit approval of a `provisional` config's current four bound values ([CPNS_2026_REGULATIONS.md](../examination/CPNS_2026_REGULATIONS.md) §4.3). |
| Authorization | Single local user; the act is logged with `approvedBy`/`approvedByUserAt`. |
| Request | `{ "configId": string, "acknowledgedWarnings": string[] }` — the client supplies **only** these. The four bound values are server-computed from the config at that instant and are never accepted from the client ([VALIDATION.md](./VALIDATION.md) §2). |
| Response `200` | `{ "approval": ProvisionalApproval, "config": ConfigSummary }` |
| Validation | `body.configId` must equal path `:id`; config must exist and be `provisional` (`409 CONFLICT reason:"state_not_provisional"` otherwise); `acknowledgedWarnings` must contain every outstanding `UNV-*` id the config carries |
| Errors | `400 VALIDATION_FAILED`; `404 NOT_FOUND`; `409 CONFLICT` |
| Idempotency | Approve-then-approve with the same four values returns `200` with the existing approval (no duplicate row, timestamp unchanged); if any bound value changed since the first call, both approvals are valid for their own values and the newest is "current". |
| State transition | none on the config; the config does not change state — approval only lifts "unapproved". |
| DB effect | Append-only `provisional_approval` row for `(configId, configVersion)` with the four server-computed values + evidence fields. |

### 7.3 `POST /sessions/:id/score`

The re-score path, split from `submit` so a submitted session without a stored result can be scored
without re-sending answers (J-4).

| Aspect | Contract |
|---|---|
| Purpose | Score a **submitted** session whose pre-flight genuinely aborted (ranking codes 1 or 6), against its frozen snapshot — or add a verdict after an approval was granted. |
| Authorization | Single local user; the session must belong to them (there is only one user). |
| Request | no body |
| Response `200` | `SessionScoreResult` (§5) — identical shape to `submit` |
| Validation | session exists (`404`); `status === 'submitted'` (`409 CONFLICT reason:"not_resubmittable"` when a `score_result` already exists with a **verdict or a score** — re-scoring a scored session is forbidden by [SCORING_METHODOLOGY.md](../examination/SCORING_METHODOLOGY.md) §7). Exception: a stored result whose `verdict === null` may be re-scored **only** to add the verdict, with identical score fields — the call fails `409 reason:"verdict_only_change_forbidden"` if any score field would differ |
| Errors | `404 NOT_FOUND`; `409 CONFLICT` (`not_resubmittable`, `verdict_only_change_forbidden`); `409 THRESHOLD_CONFIG_INVALID`; `422 PREFLIGHT_FAILED` — same ranking as `submit` ([SCORING_METHODOLOGY.md](../examination/SCORING_METHODOLOGY.md) §11.1). A verdict-only condition never errors: it returns `200` with `withheld` set |
| Idempotency | The first successful call writes the result; a later call on the same snapshot returns the stored result unchanged. A `PREFLIGHT_FAILED` writes nothing (answers intact). |
| State transition | `submitted (no result)` → `submitted (scored)` on success; unchanged on failure. |
| DB effect | On success: insert `score_result` (result JSON + `snapshotVersion` + `verdictJson` + `approvalJson` + `verdictWithheldJson` + `timingJson` + `scoredAt`), `blockedErrorCode` only for a blocking failure. A stored result with `verdict === null` is re-scored and, when every score field is identical, the verdict is added through `tryoutsim.add_session_verdict` — never by an ordinary UPDATE (T-7). On failure: nothing written. |

`POST /sessions/:id/submit` remains the answer-accepting path. Once submitted, `submit`
returns `409 CONFLICT reason:"already_submitted"` and the client must use `/score` — so a single
session cannot have answers rewritten after submission.

### 7.4 `POST /packages/:id/sessions`

| Aspect | Contract |
|---|---|
| Purpose | Create a session from a package version: assemble the roster, resolve and bind a CPNS config, freeze the snapshot ([PACKAGE_SPECIFICATION.md](../product/PACKAGE_SPECIFICATION.md) §3–§4, [CPNS_2026_REGULATIONS.md](../examination/CPNS_2026_REGULATIONS.md) §4.2.1). |
| Authorization | Single local user. |
| Request | `{ "mode": "tryout" \| "latihan", "packageVersion"?: number }` — no config id, no roster. The client cannot choose either. |
| Response `201` | `{ "session": Session, "runner": RunnerPayload, "configResolution": "pinned" \| "fallback" \| "resolved" }` |
| Validation | package exists, is not retired, has eligible stock; `mode` matches the package; if `packageVersion` is omitted the current version is used. Zero eligible stock → `409 CONFLICT reason:"no_eligible_stock"` with the shortfall counts; a partial stock under `avoid_answered` returns `repeatWarning` on the package view, not an error |
| Config resolution | Internal, in this order: the package version's pinned config if still usable → the latest usable CPNS config for the mode (`official_verified`, else `provisional`) → `409 CONFLICT reason:"no_usable_config"`. Rows with `dataProvenance:"legacy"` are never candidates. A `provisional` config is **not** an error: the session starts, the score is computed on it, and the verdict is withheld. |
| Errors | `400 VALIDATION_FAILED`; `404 NOT_FOUND`; `409 CONFLICT` (`no_eligible_stock`, `package_retired`, `no_usable_config`) |
| Idempotency | Not idempotent — each call creates a new session (a session is an event, not a resource with a client key). |
| State transition | none on the package; `session.status = 'open'` |
| DB effect | Insert `session` + `session_snapshot` in one transaction (DB-6); bind `packageId`/`packageVersion`; record the resolved config identity, its state and its unverified-field warnings in the snapshot; record `roster.repeatCount` and `roster.attemptedBefore`. |

### 7.5 `PATCH /sessions/:id/answers`

| Aspect | Contract |
|---|---|
| Purpose | Autosave: record one answer, its flag, and the clock in one request so an answer is never stored without its active time ([SCORING_METHODOLOGY.md](../examination/SCORING_METHODOLOGY.md) §8.1). |
| Request | `{ "questionId": string, "selected": "A"\|"B"\|"C"\|"D"\|"E"\|null, "flagged"?: boolean, "elapsedActiveMs": int }` |
| Response `200` | `{ "savedAt": string, "activeMs": int, "expired": boolean }` — `expired` true when the write crossed the duration limit, so the client can render the expiry state without deciding it |
| Validation | `questionId` in the frozen roster; `selected` in that question's frozen `optionKeys` or `null`; `elapsedActiveMs` a finite non-negative integer |
| Errors | `400 VALIDATION_FAILED`; `404 NOT_FOUND`; `409 CONFLICT` (`already_submitted`, `session_expired`) |
| Idempotency | Last write wins per `(sessionId, questionId)`; the answer log keeps one current row per question. Repeating the same body is harmless. |
| DB effect | Upsert `answer_sheet`; update `session.activeMs`/`runningSince`. |

### 7.6 `POST /sessions/:id/answer-feedback` (Latihan only)

| Aspect | Contract |
|---|---|
| Purpose | Return the key, the explanation, and **each option's weight** for the question just answered, so a Latihan session can give feedback immediately ([FRONTEND_EXAM_FLOW.md](../frontend/FRONTEND_EXAM_FLOW.md) §9). |
| Request | `{ "questionId": string }` |
| Response `200` | `{ "questionId", "selected", "earned", "maxScore", "correct": boolean \| null, "optionScores": Record<"A".."E", int>, "explanation": string }` |
| Validation | `session.mode === 'latihan'`; the question is in the frozen roster and has been answered |
| Errors | `404 NOT_FOUND`; `409 CONFLICT reason:"tryout_no_feedback"` — a tryout never discloses feedback mid-session ([PRD.md](../product/PRD.md) FR-T6) |
| Idempotency | Read-only; repeating returns the same body. |
| DB effect | none. |

TKP rule: `correct` is always `null` and the response states attainment; `optionScores` is what makes the
per-option explanation verifiable ([QUESTION_SPECIFICATION.md](../examination/QUESTION_SPECIFICATION.md)
§5 V-10).

### 7.7 `GET /sessions/:id/questions` — frozen content + matched explanation (Tinjau jawaban)

**Product Owner decision 2026-11-09 (P-1b).** The result screen's question blocks read frozen content
and the key the session was scored with from **one session-scoped route**, and the explanation from the
question's latest version **only when that version is the one the session froze** (strict version
matching, same date). This route is a separate read from `GET /sessions/:id/result`, whose
`ScoreResult` is not widened by it (§5).

**Route shape — approved by the Product Owner (2026-11-09).** P-1b first fixed that a session-scoped
content route must exist and sketched it per question
(`GET /sessions/:id/questions/:questionId`). The Product Owner has since approved the **batch** form:
`GET /sessions/:id/questions?ids=id1,id2,…`. It is the final API contract, not a proposal. It is chosen
because the review screen needs exactly the five questions of one page
([FRONTEND_RESULTS_ANALYTICS.md](../frontend/FRONTEND_RESULTS_ANALYTICS.md) §2.1): one request per page
instead of five, and the same roster-membership check applied to all of them at once. The single-id form
is superseded.

| Aspect | Contract |
|---|---|
| Purpose | Supply the per-question block on the result screen ([FRONTEND_RESULTS_ANALYTICS.md](../frontend/FRONTEND_RESULTS_ANALYTICS.md) §2.2): the frozen stem, options, key and TKP weights, plus the explanation, which the UI shows only on strict version equality (row `explanationSource` below) |
| Query | `?ids=<questionId>,<questionId>,…` — **required**, 1–20 ids (the review sends the five of the current page, §2.1 there). Ids are roster positions from `byQuestion`; the order of the response follows the order of `ids`. The ceiling of 20 is a request-size limit, not a page size: it is ten times the review page, so paging never needs more. |
| Source split | **Frozen snapshot** — `session_snapshot`: stem, asset, option keys and texts, the `AnswerKey` the session was scored with (`optionScores`, and `optionJustifications` when the key carries them — §1.2 there). **Latest question version** (`question_version` at the question's current `contentVersion`) — `explanation`, and `optionJustifications` **only** when the frozen key has none. Neither source's content is presented as the other's: `frozenContentVersion` and `latestContentVersion` are both returned so the client can apply its rule without guessing |
| Response `200` | `{ "sessionId": string, "questions": ReviewQuestion[] }` — see the type below |
| ReviewQuestion | `{ questionId, test, stem, asset?, options: [{ key, text }], keyedOption: string \| null, optionScores: Record<string, int>, earned, maxScore, selected: string \| null, correct: boolean \| null, frozenContentVersion: int, latestContentVersion: int \| null, explanation: string \| null, explanationSource: 'latest' \| 'none', optionJustifications: Record<string, string> \| null, justificationsSource: 'latest' \| 'frozen' \| 'none', questionState: 'live' \| 'archived' \| 'quarantined' \| 'missing' }` |
| `keyedOption` | The TWK/TIU option keyed for this session (whose frozen weight equals `maxScore`), computed **server-side from the frozen key**. `null` for TKP and for a frozen key with more than one option at `maxScore`. The client never derives it ([FRONTEND_DATA_CONTRACTS.md](../frontend/FRONTEND_DATA_CONTRACTS.md) §1). |
| `earned` / `maxScore` / `selected` / `correct` | Echoed from the stored `ScoreResult.byQuestion` row for that id — not recomputed, so this route and §5 cannot disagree |
| `explanationSource` | `latest` when the current version has an explanation, else `none`. There is no snapshot fallback: the snapshot does not store explanations (`session_snapshot.questionsJson`, [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) §`session_snapshot`). `explanation` is `null` only with `none`. **The client shows it only when `latestContentVersion === frozenContentVersion`** (strict version matching, Product Owner 2026-11-09); on any mismatch the explanation is not rendered. |
| `justificationsSource` | `frozen` when the snapshot's key carries `optionJustifications` — the normal case, because §1.2 makes them part of the key and the key is frozen. `latest` when only the current version's key does (a key edited after the session), `none` when neither does — a key that predates §1.2. `optionJustifications` is `null` only with `none`. A `none` answer is not an error: the block lists every option and weight and states that per-option reasoning is unavailable |
| `questionState` | `missing` when no current `question` row resolves; `archived` / `quarantined` when the current row is in that lifecycle state. Content still renders in every case — archival removes a question from selection, not from past sessions ([QUESTION_SPECIFICATION.md](../examination/QUESTION_SPECIFICATION.md) §7.2). A `missing` id still yields frozen content and key; only the latest explanation is `none`. |
| Validation | Product Owner decision 2026-11-09: `ids` present and 1–20; every id must be a `questionId` **in this session's stored roster**; duplicates rejected. A malformed id, an unknown id, a duplicate, or an id belonging to another session all produce the **same** `400` — the route never reveals whether a question exists outside the roster |
| Session state | Allowed only when the session is `submitted` (scored or unscored). For `open` the route refuses `409 reason:"session_open"`: the key and explanation are never readable mid-session ([PRD.md](../product/PRD.md) FR-T6, [FRONTEND_EXAM_FLOW.md](../frontend/FRONTEND_EXAM_FLOW.md) §9). Applies to tryout **and** latihan, within the scope stated here; Latihan's own mid-session feedback stays on §7.6. |
| Access | Same single-user session as every other route (K). It is a **learner-area** route (class L): it returns no version history, no validation records, no sampling record and no `review` entries — those remain `GET /questions/:id` (Kelola). The answer key is returned only after submit, with the explanation |
| Errors | `400 VALIDATION_FAILED` — `ids` missing, empty, over 20, duplicate, malformed, unknown, or not in this session's roster (one response, no distinction between the last three); `404 NOT_FOUND` (session); `409 CONFLICT` (`session_open`) |
| Idempotency | Read-only; repeating returns the same body for the same stored result and the same latest question versions. |
| DB effect | none. |
| Conflict note | A question edited after the session reports `latestContentVersion ≠ frozenContentVersion`. The client then hides the explanation (§2.2.3 there); the route never substitutes latest option texts or latest weights for frozen ones. |

```json
{
  "sessionId": "s_01J...",
  "questions": [
    {
      "questionId": "q_06", "test": "TIU",
      "stem": "Deret 3, 6, 11, 18, …",
      "options": [{ "key": "A", "text": "23" }, { "key": "B", "text": "27" }],
      "keyedOption": "B",
      "optionScores": { "A": 0, "B": 5, "C": 0, "D": 0, "E": 0 },
      "earned": 0, "maxScore": 5, "selected": "E", "correct": false,
      "frozenContentVersion": 2, "latestContentVersion": 3,
      "explanation": "Selisih bertambah 1 tiap langkah, jadi suku berikutnya 27.",
      "explanationSource": "latest",
      "optionJustifications": null, "justificationsSource": "none",
      "questionState": "live"
    },
    {
      "questionId": "q_07", "test": "TKP",
      "stem": "Rekan kerja mengabaikan permintaan pimpinan …",
      "options": [{ "key": "A", "text": "…" }],
      "keyedOption": null,
      "optionScores": { "A": 5, "B": 4, "C": 2, "D": 1, "E": 1 },
      "earned": 1, "maxScore": 5, "selected": "D", "correct": null,
      "frozenContentVersion": 1, "latestContentVersion": 1,
      "explanation": "Pilihan A menunjukkan inisiatif …",
      "explanationSource": "latest",
      "optionJustifications": { "A": "…", "B": "…", "C": "…", "D": "…", "E": "…" },
      "justificationsSource": "latest",
      "questionState": "live"
    }
  ]
}
```

**Why this route and not a wider `ScoreResult`.** Widening `ScoreResult` (rejected: option P-2) would
put variable-length content into the object stored field-for-field in `score_result`, multiply the
payload by roster size, and change the one result shape that API-1 unified. The route keeps that shape
untouched. Reading `GET /questions/:id` instead (rejected: option P-1a) would serve **live** content as
if it were the scored content and would expose the Kelola view — version history, validation, sampling —
to the learner screen ([FRONTEND_API_MAPPING.md](../frontend/FRONTEND_API_MAPPING.md) §3).

#### 7.7.1 Unresolved technical points

Recorded, not decided. None changes a field above; each is a mechanism the technical design must prove.

| # | Question | Status |
|---|---|---|
| E78-T1 | Route shape | **RESOLVED (PO 2026-11-09):** the batch form `?ids=` is the final contract; the single-id form is superseded |
| E78-T2 | Storing `optionJustifications` inside `AnswerKey` (the direction the PO chose): database storage, serialisation/deserialisation of the snapshot, behaviour on keys that predate the field, and whether any migration is needed | **UNRESOLVED — TECHNICAL DESIGN REQUIRED.** §1.2 defines the key's **shape** only; no migration, back-fill or historical compatibility is claimed. Back-fill is **not** required by decision (T-03) |
| E78-T3 | Which HTTP status a bad id returns | **RESOLVED (PO 2026-11-09):** one `400` for every bad id — malformed, unknown, duplicate, or outside the session's roster — so the response never reveals whether a question exists outside the roster |
| E78-T4 | How the "version identity" of an explanation is stored and compared at read time, so that strict equality with the frozen snapshot version is provable | **UNRESOLVED — TECHNICAL DESIGN REQUIRED.** The product rule is decided (strict match, mismatch hides the explanation); the mechanism is not |

## 8. Cross-references

- Endpoint inventory + path/method/status tables: [API_ENDPOINTS.md](./API_ENDPOINTS.md).
- Field-level validation rules: [VALIDATION.md](./VALIDATION.md).
- Error taxonomy and no-leak rule: [ERROR_HANDLING.md](./ERROR_HANDLING.md).
- Scoring gates that produce §4 errors: [SCORING_METHODOLOGY.md](../examination/SCORING_METHODOLOGY.md) §6, §11.
- Statistics that fill §6: [ANALYTICS_ENGINE.md](./ANALYTICS_ENGINE.md).
- Frontend's read of these envelopes: [FRONTEND_DATA_CONTRACTS.md](../frontend/FRONTEND_DATA_CONTRACTS.md) §5.
- **Approval never blocks a session.** `APPROVAL_*` outcomes withhold the verdict and keep the score
  (§4, §5); they are not a "start this later" gate and never appear as an HTTP error
  ([CPNS_2026_REGULATIONS.md](../examination/CPNS_2026_REGULATIONS.md) §4.2).