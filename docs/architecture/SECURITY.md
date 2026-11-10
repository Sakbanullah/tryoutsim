# Security

Canonical source for the **security posture** of a local-first, single-user app.

---

## 1. Threat model (scoped)

The app runs on the user's own machine, bound to `127.0.0.1`, with a single local user and no account
system. The realistic threats are therefore:

| Threat | Severity | Mitigation |
|---|---|---|
| Another local user inspects the database / secret store | Medium | Bind loopback; document that data is readable by anyone holding the DB role's credentials |
| A local process uses the DB role's stored credentials to read/write directly | Medium | Role is least-privilege on the app database only; credentials file outside the data directory and backups; acknowledged, not fully mitigable on a single-user machine (§3.1) |
| A malicious local page calls the API (DNS rebinding / CORS) | Medium | Same-origin only; no CORS \*; loopback bind; `Host` allowlist + required client header (§2) |
| API key leaked via logs, bundle, or response | High | Write-only keys, masked tail, never in response/log/bundle (NFR-7, FR-C6) |
| Remote access expectation | Low | Explicitly **not** supported; no remote binding |
| Unauthorised code from a dependency | Low | Minimal dependencies (ADR-008) |

This scoping is what justifies **no authentication by default** — see
[AUTHENTICATION.md](../backend/AUTHENTICATION.md), which evaluates auth and concludes `none` for MVP
unless a documented threat requires otherwise.

## 2. Network posture

- Backend listens on `127.0.0.1` only (not `0.0.0.0`).
- Same-origin requests only; no wildcard CORS, no credential-bearing cross-origin responses.
- **DNS rebinding is blocked by the browser, not only by the bind (SEC-1).** Rebinding makes a
  hostile page's *own origin* resolve to `127.0.0.1`, so a loopback bind and same-origin CORS do not
  stop it on their own. Two server-side checks close it:
  - **`Host` allowlist** — reject any request whose `Host` is not `127.0.0.1:<port>` or
    `localhost:<port>` (`421`), so a rebound domain name never reaches a handler.
  - **Custom request header** — the Data client sends `X-Tryoutsim-Client: 1`; any state-changing
    request without it is rejected. A cross-origin `fetch` cannot add a header without a CORS preflight,
    which this server never grants.
  This is transport hygiene, **not authentication** — the auth decision stays
  [AUTHENTICATION.md](../backend/AUTHENTICATION.md).
- The **only** outbound traffic is to the configured AI provider (NFR-1). Provider base URLs are
  user-supplied and shown in the config UI, never hard-coded.

## 3. Secrets

- API keys are **write-only** and live in **OS secure storage** (Windows Credential Manager / Keychain /
  Secret Service), never in the database, a config file, a backup or a bundle. The local backend owns
  all access ([SECRETS.md](../backend/SECRETS.md) §2).
- Keys never appear in: response bodies, logs, error text echoed from a provider call (mask any auth
  header), the frontend bundle, or any document (NFR-7). The frontend never receives a full key at any
  point.
- `extraParams` and headers are user-visible so nothing is forwarded silently.
- **Backups exclude keys** by default ([DEPLOYMENT_AND_BACKUP](./DEPLOYMENT_AND_BACKUP.md) §2.1); a
  restore on another machine requires re-entry.

## 3.1 Local data posture

- The app's data is **local only**: one machine, one user, one local PostgreSQL 18 server
  ([DEPLOYMENT_AND_BACKUP](./DEPLOYMENT_AND_BACKUP.md) §1, §4). No cloud server stores app data.
- Everything except AI calls works offline; an offline machine is a supported state, not an error —
  but the database server must be running, or the backend reports a start failure (§1.2 there).
- The local PostgreSQL server listens on `127.0.0.1` only. The app uses a dedicated role scoped to one
  database; the role password is a local credential, never a key that grants access elsewhere.
- Data at rest is **not encrypted by the app** (out of scope, [SECRETS.md](../backend/SECRETS.md) §4).
  The threat table above states the consequence plainly: anything that can reach loopback and hold the
  role's credentials can read it.

## 4. Boundaries

- Authentication decision: [AUTHENTICATION.md](../backend/AUTHENTICATION.md).
- Provider key handling at runtime: [SECRETS.md](../backend/SECRETS.md).
- Error handling / no-leak rules: [ERROR_HANDLING.md](../backend/ERROR_HANDLING.md).
- Data model and migration: [DATABASE_SCHEMA.md](../backend/DATABASE_SCHEMA.md),
  [MIGRATION_STRATEGY.md](../backend/MIGRATION_STRATEGY.md).