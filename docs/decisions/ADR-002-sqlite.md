# ADR-002 — PostgreSQL datastore

- **Status**: Accepted (revised 2026-11-10, replacing the original SQLite decision)
- **Date**: 2026-11-07 (original) · 2026-11-10 (revision)
- **Supersedes**: the SQLite decision of this ADR as originally recorded

## Context

Single-user, local-first, no cloud server. The data is relational (configs, questions, sessions,
snapshots) and, by nature, modest in size for a single learner.

The original decision (2026-11-07) was SQLite: zero daemon, one file per machine. That still holds for
the MVP's single-user use. Two properties argue against it as the *primary* datastore:

- **Product direction.** TryoutSim is a portfolio project and the foundation of an application that
  may evolve into a multi-user product. A datastore that cannot grow into concurrent multi-user
  operation would be replaced by that later step, and the replacement would touch every query.
- **Growth of the data model.** Sessions, snapshots and question versions are append-only history and
  accumulate monotonically ([MIGRATION_STRATEGY.md](../backend/MIGRATION_STRATEGY.md) §1). Nothing is
  ever deleted from them. A single-user local MVP fits SQLite, but the trajectory does not.

The portfolio posture is also part of the decision: a real relational server is the more practically
transferable skill, and TryoutSim is explicitly built as a portfolio artefact.

## Decision

**PostgreSQL 18 is the primary datastore.** Product Owner decision, 2026-11-10.

- The app connects to a **PostgreSQL 18 server** on the user's machine (`127.0.0.1:5432` by default).
  The server, the dedicated role and its password are provisioned once by the user; the app may create
  the database itself if the role is allowed to, but never creates or stores credentials silently
  ([DEPLOYMENT_AND_BACKUP.md](../architecture/DEPLOYMENT_AND_BACKUP.md) §1.5).
- The database is accessed through **Prisma ORM** over PostgreSQL 18 (Product Owner decision, 2026-11-10;
  [ADR-011](ADR-011-orm-selection.md), `Accepted`). Raw SQL through `$queryRaw`/`$executeRaw` remains used
  for analytics aggregates and constraint-critical DDL.
- The driver is **`pg` (node-postgres)**, used through Prisma's `@prisma/adapter-pg` driver adapter and
  declared as a direct dependency. It is the only driver; no second driver is added
  ([ADR-011](ADR-011-orm-selection.md) §4).
- The backend runtime is **Node.js 24**. Prisma ORM 7.10.1 is the pinned line
  ([ADR-011](ADR-011-orm-selection.md) §3); it supports Node.js 24 and PostgreSQL 18.
- The backend runtime is **Node.js 24** with `node:http` (HTTP server) and `node:test` (test runner).
  No HTTP framework. Prisma adds no HTTP or test dependency.
- All other guarantees are unchanged: **scoring is a pure function over an immutable snapshot**;
  sessions, results and question versions are append-only
  ([SCORING_METHODOLOGY.md](../examination/SCORING_METHODOLOGY.md) §7); snapshots are opaque JSON.

## Consequences

- **A local server is required.** Unlike SQLite, the backend does not open a file; it dials
  `127.0.0.1:5432`. The launcher's readiness check therefore includes "PostgreSQL reachable", and an
  unavailable server is a stated, recoverable start failure ([DEPLOYMENT_AND_BACKUP.md](../architecture/DEPLOYMENT_AND_BACKUP.md) §1.2).
- **Role, database and credentials are one-time installation configuration**, documented in
  [DEPLOYMENT_AND_BACKUP.md](../architecture/DEPLOYMENT_AND_BACKUP.md) §1.5.
- **Backup is a logical dump, not a file copy.** The SQLite "one file" backup is replaced by
  `pg_dump`/`pg_restore`-based archives, still verified before being offered as a successful backup
  ([DEPLOYMENT_AND_BACKUP.md](../architecture/DEPLOYMENT_AND_BACKUP.md) §2).
- **Migrations are run by Prisma Migrate** (`prisma migrate deploy`), which records each applied migration
  with a checksum in `_prisma_migrations`, applies each inside a transaction, and takes a PostgreSQL
  advisory lock; the contract is unchanged ([MIGRATION_STRATEGY.md](../backend/MIGRATION_STRATEGY.md) §2, §7).
  Constraint features Prisma's schema DSL cannot express (CHECK, exclusion constraints, append-only
  triggers, the DB-4 conditional cascade) are **hand-written SQL** in reviewed migration files
  ([ADR-011](ADR-011-orm-selection.md) §6).
- **SQLite is no longer supported.** No SQLite migration, no backfill, no SQLite-specific code. There
  is no data to migrate: the backend has no released persistence.
- **Score snapshots remain opaque JSON**, so scoring survives schema drift to live tables
  ([SCORING_METHODOLOGY.md](../examination/SCORING_METHODOLOGY.md) §7). This is unchanged by the swap.
- **The threat model shifts.** A loopback-bound server with a role and password is attackable by a
  process that can reach loopback and a local user who can read the role's credentials; this is
  documented, not mitigated away ([SECURITY.md](../architecture/SECURITY.md) §3.1).
