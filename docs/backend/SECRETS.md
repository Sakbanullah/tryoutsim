# Secrets

Canonical source for how provider API keys are stored and surfaced. This is a runtime-secret
concern, not application auth ([AUTHENTICATION.md](./AUTHENTICATION.md) §5).

---

## 1. Write-only contract

- Keys are **write-only**: created with a reference, read back only as a masked tail (`keyLast4`)
  ([PRD](../product/PRD.md) NFR-7, FR-C6).
- No endpoint returns the full key. `GET /providers` shows `keyLast4` and a `hasKey` boolean.
- Product code can send the key to the provider transport, but never log it, echo it in an error,
  or store it back into a normal table ([SECURITY](../architecture/SECURITY.md) §3).

## 2. Storage location (decision)

As a local-first app, the key must live on this machine. Two candidate backends:

| backend | PRO | CON |
|---|---|---|
| OS keychain (`Credential Manager`/Keychain) | OS-encrypted, standard | platform-specific API |
| Local secret file (owner-only perms) | portable, simple | plaintext if perms/lock weaken |

**Status: unresolved until backend time** — the decision is recorded as open in
[DEVELOPMENT_ROADMAP](../roadmap/DEVELOPMENT_ROADMAP.md) and re-decided when the backend starts. The
**invariant** holds regardless of backend: the key is never in the SQLite schema in plaintext form
([DATABASE_SCHEMA](./DATABASE_SCHEMA.md) §2 `secret_ref`).

## 3. Surface rules

- The `secret_ref` row holds `providerId`, `keyLast4`, and `backend` only.
- A provider's `headers` may carry an `Authorization` value set at runtime from the secret; the
  stored/returned header config must never contain the plaintext (it shows a placeholder/masked form).
- On provider update the key is left untouched unless the user submits a new one; replacing shows the
  new `keyLast4` only.

## 4. Out of scope

- Encrypting the SQLite database file itself.
- Rotating/migrating keys across machines (single local user).