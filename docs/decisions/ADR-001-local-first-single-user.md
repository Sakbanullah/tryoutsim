# ADR-001 — Local-first, single-user

- **Status**: Accepted
- **Date**: 2026-11-07

## Context

CPNS prep is personal. No sharing, leaderboard, or team features are needed for MVP ([PRD.md](../product/PRD.md) §4 O-6). A cloud backend adds a secret, a server, and an account surface for zero feature value.

## Decision

Single-user, local-first. One process, one SQLite file, loopback-bound. No cloud account, no remote data.

## Consequences

- Simpler threat model ([SECURITY.md](../architecture/SECURITY.md) §1); auth is off by default ([ADR-009](ADR-009-no-auth.md)).
- The only network call is the configured AI provider ([SECURITY.md](../architecture/SECURITY.md) §2).
- Multi-device sync and sharing are explicitly out of scope ([MVP_SCOPE.md](../product/MVP_SCOPE.md) §2).