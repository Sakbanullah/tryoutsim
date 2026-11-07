# API Specification

Canonical source for the backend HTTP surface. The frontend reads this (and
[FRONTEND_DATA_CONTRACTS.md](../frontend/FRONTEND_DATA_CONTRACTS.md)); the backend implements this
over SQLite. No endpoint listed here is implemented yet — this is a contract, not code.

---

## 1. Conventions

- **Base path** `http://127.0.0.1:<port>/api/v1` — loopback only
  ([SECURITY.md](../architecture/SECURITY.md) §2).
- **Single local user, no auth** ([AUTHENTICATION.md](./AUTHENTICATION.md)).
- **Media type** `application/json`; request/response bodies are JSON unless `204`.
- **IDs** are strings, opaque, stable per resource. No client-side parsing of IDs into
  sub-parts (AUD-06).
- **Timestamps** ISO-8601 UTC (`2026-11-07T14:30:00Z`).
- **Durations** milliseconds as integers (mean response time is a median over ms).
- **Integers only** for anything scoring-related: counts, scores, percentages are integers
  (`55`, not `55.0`, not `0.55`).
- **Percentages** are integer 0–100, always accompanied by the raw counts they derive from
  (see `MetricValue` below).

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
| `CONFLICT` | 409 | `{ "resource": string, "reason": string }` | State conflict other than approval (e.g. name collision) |
| `PROVIDER_UNAVAILABLE` | 502 | `{ "providerId": string, "reason": string }` | Provider call failed at transport level |
| `PROVIDER_AUTH_FAILED` | 502 | `{ "providerId": string }` | Provider returned auth/unauthorised (key masked, never echoed) |
| `RATE_LIMITED` | 429 | `{ "providerId": string, "retryAfterMs": int \| null }` | Provider rate limit |
| `PROVIDER_TIMEOUT` | 504 | `{ "providerId": string, "timeoutMs": int }` | Provider call exceeded timeout |
| `PREFLIGHT_FAILED` | 422 | `{ "errors": PreflightError[] }` | One or more PF-xx/SC-xx checks failed; **nothing was scored** |
| `APPROVAL_INVALID` | 409 | `{ "changed": string[], "config": ConfigSummary }` | Snapshot approval is no longer valid; session stored **unscored** |
| `APPROVAL_VERSION_MISMATCH` | 409 | `{ "changed": string[] }` | Approval-bound version differs from scoring version at submit |
| `THRESHOLD_CONFIG_INVALID` | 409 | `{ "changed": string[], "thresholds": ThresholdSummary }` | Threshold block broken/inconsistent vs scoring rules |
| `CONTRACT_MISMATCH` | 426 | `{ "expected": string, "actual": string }` | Client contract version differs from server |
| `UNSUPPORTED` | 501 | `{ "feature": string }` | Known but deliberately out of scope |

### 4.1 `PreflightError`

```json
{ "code": "PF-01", "path": "sheets[3].selectedOption", "message": "...", "severity": "block" }
```

- `code` is one of `PF-00`…`PF-13` / `SC-01`…`SC-08` — exactly the IDs in
  [SCORING_METHODOLOGY.md](../examination/SCORING_METHODOLOGY.md) §6.1, never invented here.
- `severity` is always `"block"` (a preflight failure always blocks scoring).
- `path` points at the offending field when one exists, else is `null`.

### 4.2 `APPROVAL_INVALID` / `APPROVAL_VERSION_MISMATCH` / `THRESHOLD_CONFIG_INVALID` — `changed[]`

The user explicitly requires these three error codes to carry a `changed[]` structure.

`changed[]` is an array of atomically-bounded values that no longer match what the running session
approved. Each element names what changed and its before/after value, **never the content of a
hash** (hashes are compared opaque, not displayed):

```json
{
  "changed": [
    { "field": "configVersion",            "approved": "2026-11-01T00:00Z", "current": "2026-11-03T00:00Z" },
    { "field": "scoringVersion",           "approved": "2",                  "current": "3" },
    { "field": "regulatoryBasisHash",      "approved": "<opaque-hash>",      "current": "<opaque-hash>" },
    { "field": "thresholds.naikTotal",     "approved": 311,                  "current": 314 }
  ]
}
```

Rules binding `changed[]`:

- It is **bounded to the four approval-bound values** from
  [CPNS_2026_REGULATIONS.md](../examination/CPNS_2026_REGULATIONS.md) `ProvisionalApproval`
  ({configId, configVersion, scoringVersion, regulatoryBasisHash}) plus any threshold field
  referenced by the snapshot. It is **not** a general-purpose diff.
- Each element is `{ field, approved, current }`. `field` is a stable dotted path; `approved` and
  `current` are the values bound at approval and at submit respectively.
- `config` / `thresholds` (in `APPROVAL_INVALID` / `THRESHOLD_CONFIG_INVALID` respectively) is a
  summary for UX display: state, label, and the effective thresholds — again **no hashes, no
  secrets**.

The three codes share this `changed[]` shape but differ in `details`:

| code | what failed | remedy |
|---|---|---|
| `APPROVAL_INVALID` | one of the four approval-bound values changed since approval | re-show notice, force re-approve before scoring |
| `APPROVAL_VERSION_MISMATCH` | a bound version field disagrees with the snapshot's scoring version | same re-approve path; distinct code so UI can name the exact field |
| `THRESHOLD_CONFIG_INVALID` | threshold block fails SC-01/SC-05/SC-06-style integrity vs scoring rules | config is rejected until corrected |

All three leave the session **stored but unscored** (see the unscored-session paths in
[SCORING_METHODOLOGY.md](../examination/SCORING_METHODOLOGY.md) §11); a later retry is against the
snapshot, never against live config.

## 5. Scoring submission result

On a successful score (`POST /sessions/:id/submit`, 200), `data` is the `ScoreResult` shape defined
in [SCORING_METHODOLOGY.md](../examination/SCORING_METHODOLOGY.md) §2.2:

```json
{
  "total": { "earned": 250, "possible": 400, "answeredCount": 88, "correctCount": 55 },
  "sections": {
    "twk": { "earned": 65, "possible": 150, "answeredCount": 29, "correctCount": 24 }
  },
  "perQuestion": [ /* one per answered item, per §2.2 */ ],
  "snapshotVersion": "2",
  "configId": "skd-cpns-2026-provisional",
  "approval": { /* ProvisionalApproval ref, §11 */ },
  "thresholds": { "naikTotal": 311, "naikTiu": 80 }
}
```

TWK/TIU `correct` is `true | false | null` (null = unanswered); TKP `correct` is `null` and
`correctCount` is `0` (see [SCORING_METHODOLOGY.md](../examination/SCORING_METHODOLOGY.md) §4).
The frontend renders these values, never recomputes them
([FRONTEND_DATA_CONTRACTS.md](../frontend/FRONTEND_DATA_CONTRACTS.md) §1).

## 6. Cross-references

- Endpoint inventory + path/method/status tables: [API_ENDPOINTS.md](./API_ENDPOINTS.md).
- Field-level validation rules: [VALIDATION.md](./VALIDATION.md).
- Error taxonomy and no-leak rule: [ERROR_HANDLING.md](./ERROR_HANDLING.md).
- Scoring gates that produce §4 errors: [SCORING_METHODOLOGY.md](../examination/SCORING_METHODOLOGY.md) §6, §11.
- Frontend's read of these envelopes: [FRONTEND_DATA_CONTRACTS.md](../frontend/FRONTEND_DATA_CONTRACTS.md) §5.