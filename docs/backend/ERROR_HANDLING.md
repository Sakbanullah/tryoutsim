# Error Handling

Canonical source for how the backend classifies, maps, and reports errors. The envelope and
`error.code` registry are in [API_SPECIFICATION.md](./API_SPECIFICATION.md) §3–4; this file is the
**behaviour** behind them.

---

## 1. Code-first, status-second

- The client always branches on `error.code`; HTTP status is a transport shorthand
  ([API_SPECIFICATION.md](./API_SPECIFICATION.md) §3).
- The `error.code` set is closed and versioned (no ad-hoc strings). Adding a code is an API-contract
  change, recorded in [AUDIT.md](../AUDIT.md).

## 2. No-leak rule (non-negotiable)

An error `message`, `details`, or log line **never contains**:

- provider API keys / auth headers (always `keyLast4` or nothing) — [SECURITY](../architecture/SECURITY.md) §3
- stack traces or internal paths (log-only, never in the response)
- the content of a regulatory-basis hash or the bound values beyond the `changed[]` summary
  ([API_SPECIFICATION](./API_SPECIFICATION.md) §4.2)

Provider transport layers mask the `Authorization` header **before** error propagation
([AI_PROVIDER_ARCHITECTURE](../ai/AI_PROVIDER_ARCHITECTURE.md) §6).

## 3. Error mapping (provider → envelope code)

| transport condition | `error.code` |
|---|---|
| connection refused / DNS | `PROVIDER_UNAVAILABLE` |
| 401 / 403 from provider | `PROVIDER_AUTH_FAILED` (key masked) |
| 429 or provider rate limit | `RATE_LIMITED` + `retryAfterMs` |
| timeout exceeded `timeoutMs` | `PROVIDER_TIMEOUT` + `timeoutMs` |
| malformed provider response | `PROVIDER_UNAVAILABLE` with `reason:"malformed_response"` |

## 4. Domain failure states (not generic 500)

| state | `error.code` | after-effect |
|---|---|---|
| preflight/SC rejection | `PREFLIGHT_FAILED` (422) | nothing scored; answer sheet intact |
| never approved | `APPROVAL_MISSING` | **not an error**: score written, `verdict: null`, `changed[]` present on the result |
| approval no longer valid | `APPROVAL_INVALID` | **not an error**: score written, `verdict: null`, `changed[]` names the drifted value |
| bound-version mismatch | `APPROVAL_VERSION_MISMATCH` | **not an error**: score written, `verdict: null` |
| threshold block broken | `THRESHOLD_CONFIG_INVALID` (409); the PF-09 refusals `THRESHOLD_NOT_INTEGER`, `THRESHOLD_EXCEEDS_MAX`, `THRESHOLDS_REQUIRE_APPROVAL` share this class | config rejected until corrected |
| regulatory scope wrong | `REGULATORY_PATHWAY_MISMATCH` / `REGULATORY_YEAR_MISMATCH` / `REGULATORY_SCOPE_UNVERIFIED` (409) | config rebuilt; nothing scored |
| already submitted (re-submit) | `CONFLICT` `reason:"already_submitted"` (409) | answers stay frozen; use `/score` |
| already scored (re-score) | `CONFLICT` `reason:"not_resubmittable"` (409) | existing `ScoreResult` stands |

The three approval states are **verdict-only** conditions: the submit returns `200` with a stored
`ScoreResult` whose `verdict` is `null` ([SCORING_METHODOLOGY](../examination/SCORING_METHODOLOGY.md) §5.6).
A retry after approval uses `POST /sessions/:id/score`, which recomputes against the same frozen snapshot
and may only add the verdict while every score field stays identical
([API_SPECIFICATION](./API_SPECIFICATION.md) §7.3).

`POST /questions/:id/answer-feedback` on a tryout returns `CONFLICT` `reason:"tryout_no_feedback"` (409);
it is never answered with content ([API_SPECIFICATION](./API_SPECIFICATION.md) §7.6).

A `THRESHOLD_CONFIG_INVALID` state leaves **no committed score**; the retry is
`POST /sessions/:id/score`, which re-preflights against the same frozen snapshot
([SCORING_METHODOLOGY](../examination/SCORING_METHODOLOGY.md) §11,
[API_SPECIFICATION](./API_SPECIFICATION.md) §7.3). This is idempotent: the first success writes the
result and every later call is `not_resubmittable`; a failure writes nothing, so the same unchanged
input after correction either scores or re-rejects with the same code. Which code wins when several
apply is [SCORING_METHODOLOGY](../examination/SCORING_METHODOLOGY.md) §11.1.

## 5. Generation failure taxonomy

Mirrors [QUESTION_GENERATION.md](../ai/QUESTION_GENERATION.md) §5:

`timeout` · `auth` · `rate_limit` · `malformed_json` · `schema_violation` · `provider_error`.

Each lands on the batch with a `failureCategory`; the generation endpoint surfaces it via
`GET /generation-jobs/:id`, not a thrown 500.

## 6. Retry / idempotency

- `submit` is idempotent per snapshot: same input → same `ScoreResult` or same `PREFLIGHT_FAILED`
  set (deterministic, [SCORING_METHODOLOGY](../examination/SCORING_METHODOLOGY.md) §8). After the
  first submit the session is frozen — `submit` returns `already_submitted` and scoring continues
  only through `/score`.
- Provider retries are bounded and backoff-capped; a retry that changes the answer is never done
  silently (generation §5).

## 7. Boundary

- Field-level rejection: [VALIDATION.md](./VALIDATION.md).
- Security: [SECURITY.md](../architecture/SECURITY.md).