# ADR-002 — SQLite

- **Status**: Accepted
- **Date**: 2026-11-07

## Context

Single-user, local-first, no server. The data is relational (configs, questions, sessions, snapshots) but small.

## Decision

SQLite as the datastore. No separate DB server, no ORM mandated.

## Consequences

- Zero-daemon operation; a single file per user is persisted per machine.
- Migrations are versioned and additive-first ([MIGRATION_STRATEGY.md](../backend/MIGRATION_STRATEGY.md)).
- Score snapshots are opaque JSON, so scoring survives schema drift to live tables ([SCORING_METHODOLOGY.md](../examination/SCORING_METHODOLOGY.md) §7).