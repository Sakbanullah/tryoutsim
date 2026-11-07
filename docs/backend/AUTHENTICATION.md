# Authentication

Canonical evaluation of whether (and when) the app needs authentication. Outcome: **no auth for
MVP** ([ADR-009](../architecture/ARCHITECTURE_DECISIONS.md)). This file documents the reasoning so it
is a decision, not an omission.

---

## 1. Context

Local-first, single-user, loopback-bound. The only person who can reach the app is the person in
front of the machine ([SECURITY](../architecture/SECURITY.md) §1).

## 2. What "no auth" actually means

- No login, no session, no user table, no roles, no account management.
- The "owner" is whoever runs the process; identity is implicit.
- The API has no auth header and never issues credentials.

## 3. Threat conditions that would change this

Auth becomes necessary **only if** one of these becomes true:

| condition | then |
|---|---|
| Binding changes from loopback to LAN/remote | add a local access token / host allowlist first |
| Multiple OS users must share one install with isolation | per-user data dir + OS user separation, not a login |
| A secret must be executable remotely | move computation local, don't expose the key |

None are true for MVP. MVP scope keeps `127.0.0.1` binding and single-user
([MVP_SCOPE](../product/MVP_SCOPE.md) §2).

## 4. Why not a login "just in case"

- A login adds a password/secret to protect a machine the user already unlocks (no-single-secret-win).
- It does not reduce the realistic threats in the threat model ([SECURITY](../architecture/SECURITY.md) §1);
  those are mitigated by loopback binding + same-origin + minimal deps.
- Account state violates the no-cloud/single-user constraint ([PRD](../product/PRD.md) §4 O-6).

## 5. Boundary

Provider API keys are **not** app authentication — they are outbound credentials to the AI provider,
handled by [SECRETS.md](./SECRETS.md), never by an auth/login system.