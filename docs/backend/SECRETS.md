# Secrets

Canonical source for how provider API keys are stored and surfaced. This is a runtime-secret
concern, not application auth ([AUTHENTICATION.md](./AUTHENTICATION.md) §5).

---

## 1. Write-only contract

- Keys are **write-only**: created with a reference, read back only as a masked tail (`keyLast4`)
  ([PRD](../product/PRD.md) NFR-7, FR-C6).
- No endpoint returns the full key, at any point, for any reason. `GET /providers` shows `keyLast4` and
  a `hasKey` boolean.
- The **frontend never receives the key** — not on create, not on update, not in a debug payload
  ([SECURITY](../architecture/SECURITY.md) §3).
- Product code can send the key to the provider transport, but never log it, echo it in an error,
  or store it back into a normal table.

## 2. Storage location — decided: OS secure storage

**Decision (2026-11-08): keys live in the OS credential store.**
Windows Credential Manager on Windows; the platform equivalent (Keychain / Secret Service) where the app
runs. The local backend owns all access to it.

| Candidate | Verdict | Reason |
|---|---|---|
| OS credential store (`Credential Manager` / Keychain / Secret Service) | **Chosen** | encrypted by the OS, per-user access control, standard API |
| Local secret file with owner-only permissions | **Rejected** | plaintext once permissions or the lock weaken; a single misconfigured copy leaks the key |
| Key in the database (plaintext or self-encrypted) | **Rejected** | the database is dumped into every backup; a key inside it would travel with every backup |

This supersedes the earlier "unresolved until backend time" status. Consequences:

- `SECRET_REF` holds only `providerId`, `keyLast4`, `hasKey`, the **credential-store entry name**, and the
  store kind. It never holds key material ([DATABASE_SCHEMA](./DATABASE_SCHEMA.md)).
- The credential entry is named by the provider id plus an install-scoped prefix, so two installs on one
  machine do not overwrite each other.
- **Backups never include keys** ([DEPLOYMENT_AND_BACKUP](../architecture/DEPLOYMENT_AND_BACKUP.md) §2.1).
  A restore on another machine brings providers with `hasKey = false` and asks the user to re-enter the
  key; a credential reference from another machine is invalid by definition.
- A key deleted from the OS store outside the app is detected on the next use: the provider reports
  `hasKey = false` and the failure is surfaced, never silently retried with an empty key.

## 3. Surface rules

- The `secret_ref` row holds `providerId`, `keyLast4`, `hasKey`, and the credential-store entry name only.
- A provider's stored `headers` **never** carry an `Authorization` value, plaintext or placeholder —
  the transport materialises that header from the secret at send time and the write path rejects an
  `Authorization` header the client sends back ([VALIDATION.md](./VALIDATION.md) §2). The two rules
  are one rule: the header is built at send, never stored (SEC-3).
- On provider update the key is left untouched unless the user submits a new one; replacing shows the
  new `keyLast4` only.
- Every string that can leave the backend passes the scrubber in
  [AI_PROVIDER_ARCHITECTURE](../ai/AI_PROVIDER_ARCHITECTURE.md) §3 before display, storage or a log line.

## 4. Out of scope

- Encrypting the database itself (it holds no key material). The DB role's password is a separate
  provisioning credential ([DEPLOYMENT_AND_BACKUP](../architecture/DEPLOYMENT_AND_BACKUP.md) §1.5),
  not an API key, and is not governed by this document.
- Rotating or syncing keys across machines (single local user, keys re-entered after a restore).
- An opt-in "include keys in backup" option — **not in MVP**.
