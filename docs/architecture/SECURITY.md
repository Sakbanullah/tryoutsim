# Security

Canonical source for the **security posture** of a local-first, single-user app.

---

## 1. Threat model (scoped)

The app runs on the user's own machine, bound to `127.0.0.1`, with a single local user and no account
system. The realistic threats are therefore:

| Threat | Severity | Mitigation |
|---|---|---|
| Another local user inspects the SQLite file / secret store | Medium | Bind loopback; document that data is plain on disk |
| A malicious local page calls the API (DNS rebinding / CORS) | Medium | Same-origin only; no CORS \*; loopback bind |
| API key leaked via logs, bundle, or response | High | Write-only keys, masked tail, never in response/log/bundle (NFR-7, FR-C6) |
| Remote access expectation | Low | Explicitly **not** supported; no remote binding |
| Unauthorised code from a dependency | Low | Minimal dependencies (ADR-008) |

This scoping is what justifies **no authentication by default** — see
[AUTHENTICATION.md](../backend/AUTHENTICATION.md), which evaluates auth and concludes `none` for MVP
unless a documented threat requires otherwise.

## 2. Network posture

- Backend listens on `127.0.0.1` only (not `0.0.0.0`).
- Same-origin requests only; no wildcard CORS, no credential-bearing cross-origin responses.
- The **only** outbound traffic is to the configured AI provider (NFR-1). Provider base URLs are
  user-supplied and shown in the config UI, never hard-coded.

## 3. Secrets

- API keys are **write-only**: stored via a reference, displayed only as a masked tail (FR-C6).
- Keys never appear in: response bodies, logs, error text echoed from a provider call (mask any auth
  header), the frontend bundle, or any document (NFR-7).
- `extraParams` and headers are user-visible so nothing is forwarded silently.

## 4. Boundaries

- Authentication decision: [AUTHENTICATION.md](../backend/AUTHENTICATION.md).
- Provider key handling at runtime: [SECRETS.md](../backend/SECRETS.md).
- Error handling / no-leak rules: [ERROR_HANDLING.md](../backend/ERROR_HANDLING.md).
- Data-at-rest (SQLite) and migration: [DATABASE_SCHEMA.md](../backend/DATABASE_SCHEMA.md).