# ADR-009 — No authentication

- **Status**: Accepted
- **Date**: 2026-11-07

## Context

Loopback-bound, single-user, local. The threat model has no remote/other-user surface worth a login ([SECURITY.md](../architecture/SECURITY.md) §1).

## Decision

No auth for MVP. No login, session, user table, or roles ([AUTHENTICATION.md](../backend/AUTHENTICATION.md)).

## Consequences

- Authentication is added only if a documented threat condition materialises (LAN binding, multi-user, remote secret execution) — see [AUTHENTICATION.md](../backend/AUTHENTICATION.md) §3.
- Provider API keys are outbound credentials, not app auth; they are handled by [SECRETS.md](../backend/SECRETS.md), unrelated to a login.