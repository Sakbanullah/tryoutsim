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
| approval no longer valid | `APPROVAL_INVALID` (409) | session stored unscored |
| bound-version mismatch | `APPROVAL_VERSION_MISMATCH` (409) | session stored unscored |
| threshold block broken | `THRESHOLD_CONFIG_INVALID` (409) | config rejected until corrected |

All three 409 states leave **no committed score**; a later retry re-preflights against the same
snapshot ([SCORING_METHODOLOGY](../examination/SCORING_METHODOLOGY.md) §11). This is idempotent:
resubmitting the same unchanged input after re-approval either scores or re-rejects with the same
code.

## 5. Generation failure taxonomy

Mirrors [QUESTION_GENERATION.md](../ai/QUESTION_GENERATION.md) §5:

`timeout` · `auth` · `rate_limit` · `malformed_json` · `schema_violation` · `provider_error`.

Each lands on the batch with a `failureCategory`; the generation endpoint surfaces it via
`GET /generation-jobs/:id`, not a thrown 500.

## 6. Retry / idempotency

- `submit` is idempotent per snapshot: same input → same `ScoreResult` or same `PREFLIGHT_FAILED`
  set (deterministic, [SCORING_METHODOLOGY](../examination/SCORING_METHODOLOGY.md) §8).
- Provider retries are bounded and backoff-capped; a retry that changes the answer is never done
  silently (generation §5).

## 7. Boundary

- Field-level rejection: [VALIDATION.md](./VALIDATION.md).
- Security: [SECURITY.md](../architecture/SECURITY.md).