# ADR-011 — ORM: Prisma ORM 7 over PostgreSQL 18

- **Status**: **Accepted** — Product Owner decision, 2026-11-10. Prisma ORM is the single data-access
  layer; Drizzle is **not** selected. Ratified for documentation and Gate-3 preparation only: no Prisma
  package is installed and no schema, migration or backend code exists yet.
- **Date**: 2026-11-10 (Proposed) · 2026-11-10 (Accepted)
- **Related**: [ADR-002](ADR-002-sqlite.md) (PostgreSQL 18 datastore), [ADR-008](ADR-008-dependency-minimalism.md)
  (minimalism; one ORM), [ADR-003](ADR-003-modular-monolith.md) (modular monolith).
- **Evidence**: version and compatibility claims below are quoted from the official Prisma documentation
  and the npm registry, retrieved 2026-11-10 (§3). Claims that could not be confirmed from a source are
  marked **UNVERIFIED** and listed in §7.

## 1. Context

The PO decided (2026-11-10) that TryoutSim uses **Prisma ORM** with PostgreSQL 18. The fixed stack:

| Concern | Decision |
|---|---|
| Database | PostgreSQL 18, local server (`127.0.0.1:5432`) — [ADR-002](ADR-002-sqlite.md) |
| Data access | **Prisma ORM** (this ADR) |
| Runtime | Node.js 24 |
| HTTP server | `node:http` — no HTTP framework |
| Test runner | `node:test` — no test framework |
| Architecture | Modular monolith — [ADR-003](ADR-003-modular-monolith.md) |

The data layer carries invariants Prisma must not break:

- **Transactional invariants** (DB-6): `POST /sessions` writes `session` + `session_snapshot` in one
  transaction; `POST /sessions/:id/score` writes `score_result` atomically; `DELETE /sessions/:id` removes
  session + snapshot + answers + result in one transaction
  ([DATABASE_SCHEMA.md](../backend/DATABASE_SCHEMA.md) §2 *Atomicity*).
- **Cross-store ordering** (DB-4): secret written before the `provider` row, row deleted before the
  secret, with a conditional cascade on `generation_job.providerId`
  ([DATABASE_SCHEMA.md](../backend/DATABASE_SCHEMA.md) §2 *provider*; [SECRETS.md](../backend/SECRETS.md) §2).
- **Immutability**: `question_version`, `session_snapshot`, `score_result`, `provisional_approval`,
  `question_report`, `validation_record`, `question_review` are append-only
  ([SCORING_METHODOLOGY.md](../examination/SCORING_METHODOLOGY.md) §7).
- **Schema-level integrity**: foreign keys with referential actions, uniqueness, check constraints.
- **Complex analytics aggregates** over JSON snapshots ([ANALYTICS_ENGINE.md](../backend/ANALYTICS_ENGINE.md)).
- **Migration guards**: `_prisma_migrations` checksums, re-runnable migrations (no atomicity is assumed — see
  §5), a PostgreSQL advisory lock ([MIGRATION_STRATEGY.md](../backend/MIGRATION_STRATEGY.md) §2).

## 2. Decision

**Prisma ORM 7 is the data-access layer, used in driver-adapter mode over the `pg` driver.**

- One ORM only. No second ORM, no query builder, no second driver ([ADR-008](ADR-008-dependency-minimalism.md)).
- Raw SQL through `$queryRaw` / `$executeRaw` is used where Prisma's query API is the wrong tool
  (analytics aggregates, atomic multi-statement sequences, constraint-critical DDL).
- **Prisma Migrate is the migration runner.** Every generated migration is reviewed SQL; custom SQL may be
  appended with `--create-only` before it is applied (§5, §6).
- [DATABASE_SCHEMA.md](../backend/DATABASE_SCHEMA.md) stays canonical. `schema.prisma` is an *implementation*
  of it, never its source of truth.

## 3. Version and compatibility (verified 2026-11-10)

### 3.1 Recommended version

**Prisma ORM 7.10.1** — the current stable release, and the `prev` dist-tag on npm.

| Fact | Value | Source |
|---|---|---|
| `prisma` 7.10.1, `@prisma/client` 7.10.1, `@prisma/adapter-pg` 7.10.1 | published 2026-10-15 | npm registry (`npm view`) |
| npm `latest` = `8.0.0-rc.33` | **release candidate, not GA** | npm registry dist-tags; prisma.io *Release status* |
| Prisma ORM 8 status | "a **release candidate**… until the final release, some details of the API may still change" | prisma.io/docs/orm/release-status |
| Prisma ORM 7 support window | "keeps receiving bug fixes and security updates for 18 months from the day Prisma ORM 8 reaches general availability" | prisma.io/docs/orm/release-status |

**Why 7 and not 8:** 8 is an RC; its docs state that `$extends`, filtering inside JSON columns, atomic
`increment`, most nested writes, **transaction isolation levels** and the `P2002`-style error codes are
[*not available yet*](https://www.prisma.io/docs/orm/release-status). Transaction isolation levels and
nested writes are load-bearing for this schema (DB-6, §6), so an RC that drops them is not adoptable. ORM 8
also replaces `@prisma/client` with `@prisma/orm-postgres`, a different package layout.
**Trigger to revisit:** Prisma ORM 8 reaches general availability (docs at retrieval said "expected in
October 2026", which has not happened) and the missing features above ship.

### 3.2 Node.js 24

- Prisma 7 system requirements: **Node.js `^20.19.0`, `^22.12.0`, or `^24.0.0`**; "supports and tests all
  *Active LTS* and *Maintenance LTS* Node.js releases"
  (prisma.io/docs/orm/v7/reference/system-requirements).
- Package `engines` for `prisma@7.10.1` and `@prisma/client@7.10.1`: `^20.19 || ^22.12 || >=24.0` (npm registry).
- This machine: **Node v24.19.0**, npm 11.17.0 — inside the supported range.
- Upgrading to Prisma ORM 8 later raises the Node floor to **24.11** on the 24 line.

### 3.3 PostgreSQL 18

- Prisma 7 *Supported database versions* table lists **PostgreSQL 9.6 … 18** explicitly
  (prisma.io/docs/orm/v7/reference/supported-databases).
- This machine: `psql (PostgreSQL) 18.1`, service running, port 5432 accepting connections.

### 3.4 What is *not* verified

- **No Prisma package has been installed or executed.** Compatibility is established from the published
  support matrix and package metadata, not from a live smoke test.
- **Windows-specific** runtime behaviour (client generation, migrate, the `pg` adapter) — Prisma supports
  Windows generally, but nothing was run here. Gate-3 smoke test, §7.

## 4. Configuration

### 4.1 Dependencies

| Package | Kind | Where | Why |
|---|---|---|---|
| `prisma` | devDependency | root | The CLI: `generate`, `migrate`, `studio`. |
| `@prisma/client` | dependency | root | The generated client `schema.prisma` produces. |
| `@prisma/adapter-pg` | dependency | root | Prisma's maintained driver adapter for `pg`. |
| `pg` | **dependency (direct)** | root | `@prisma/adapter-pg` requires `pg`; the adapter only supplies its own glue. `pg` is already the decided driver ([ADR-002](ADR-002-sqlite.md)). |
| `@types/pg` | devDependency | root | Only if TypeScript types are wanted for the adapter options. |

- In Prisma ORM 7, **driver adapters are the default** for relational datasources
  (prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/databases-connections/connection-pool §
  "Starting with Prisma ORM v7").
- `@prisma/adapter-pg@7.10.1` declares `pg ^8.16.3`, `@types/pg ^8.16.0`, `postgres-array` and
  `@prisma/driver-adapter-utils` as dependencies (npm registry).
- **`pg` is a direct dependency, not transitive.** The app constructs the pool through `PrismaPg` with its
  own options (pool size, timeouts), so it must be declared where the app can pin and upgrade it rather
  than relying on an adapter's transitive copy.
- **No second driver.** `postgres.js` is not used. `@prisma/adapter-pg` and `pg` are one driver path.
- **No HTTP or test dependency is added.** Prisma has no HTTP-framework or test-framework dependency, so
  `node:http` and `node:test` stay ([§1](#1-context)).

### 4.2 Connection string and pooling

- `DATABASE_URL` carries `host=127.0.0.1 port=5432 dbname=tryoutsim user=tryoutsim_app`; the password comes
  from the secret store, never from a committed file ([SECRETS.md](../backend/SECRETS.md) §2,
  [DEPLOYMENT_AND_BACKUP.md](../architecture/DEPLOYMENT_AND_BACKUP.md) §1.5).
- Prisma Migrate reads the URL from `prisma.config.ts` `datasource.url`; the **application** passes the same
  URL to `PrismaPg({ connectionString })` in its own code
  (prisma.io/docs/orm/v7/core-concepts/supported-databases/database-drivers § "Driver adapters and
  database connection configuration").
- **Pooling is the `pg` pool's**, not Prisma's. Prisma ORM 7 `pg` adapter defaults:

| Behaviour | Field | Default |
|---|---|---|
| Pool size | `max` | `10` |
| Acquire **and** connect timeout (one field) | `connectionTimeoutMillis` | `0` (no timeout) |
| Idle timeout | `idleTimeoutMillis` | `10s` |
| Connection lifetime | `maxLifetimeSeconds` | `0` (no timeout) |

- For a single-user local app a `max` of 10 is more than enough; no tuning is required at MVP. The
  default is **no** timeout — `connectionTimeoutMillis` must be given a finite value explicitly (a
  start-up readiness check must fail rather than hang;
  [DEPLOYMENT_AND_BACKUP.md](../architecture/DEPLOYMENT_AND_BACKUP.md) §1.2). The one field covers both
  acquiring from the pool and opening the socket; they cannot be set separately. Recommended values:
  [SCHEMA_CONTRACT_REVIEW.md](../backend/SCHEMA_CONTRACT_REVIEW.md) §3.3.
- Prisma has no transaction or statement timeout; `statement_timeout` and
  `idle_in_transaction_session_timeout` are set on the role
  ([SCHEMA_CONTRACT_REVIEW.md](../backend/SCHEMA_CONTRACT_REVIEW.md) §3.3).
- Migrations use their **own** connection path via the CLI; they do not share the app pool.

## 5. Migration strategy under Prisma Migrate

| Invariant ([MIGRATION_STRATEGY.md](../backend/MIGRATION_STRATEGY.md)) | How Prisma Migrate satisfies it |
|---|---|
| §1 ordered, versioned migrations | `prisma/migrations/<timestamp>_<name>/migration.sql`, applied in order; package **script** invokes `prisma migrate deploy` for `up` and `prisma migrate status` for `status` (npm scripts, not a second tool) |
| §1 additive-first | A review rule on every generated `migration.sql`; no `--force-reset` ever. Destructive changes are refused by review, not by the tool. |
| §1 immutability of history | Append-only tables have no update path in the app; see §6 for the extra database-level guards |
| §2 (was) one transaction per migration | **UNVERIFIED** for Prisma 7.10.1 — the v7 docs do not state whether each migration file applies in one transaction. PostgreSQL DDL is transactional, but Prisma's own rollback statement is written for the ORM 8 runner. Treat a failed migration as possibly partial: `migrate resolve --rolled-back`, inspect, fix, redeploy. Settlement test: [SCHEMA_CONTRACT_REVIEW.md](../backend/SCHEMA_CONTRACT_REVIEW.md) §5.1 |
| §2 `schema_migrations` + checksums | Prisma's own `_prisma_migrations` table records each applied migration and its **checksum**; editing an applied migration is detected |
| §2 advisory lock (single-instance guard) | Prisma Migrate takes a **PostgreSQL advisory lock** on production commands, with a **10 s timeout, not configurable**; on timeout the command must be re-run (prisma.io/docs/orm/v7/prisma-migrate/workflows/development-and-production § "Advisory locking"). If it times out, the backend refuses to start (hard start failure, MIGRATION_STRATEGY §2). |
| §4 backfill rules | A custom-SQL migration step to backfill an existing column follows the same review rule; the ORM offers no automatic backfill |
| §6 restore compatibility | An archive at a schema version ≤ the running app's runs forward migrations inside the restore transaction; the restored archive is never recomputed |

**Dev vs. deploy:** `prisma migrate dev` (development, uses a shadow database) and `prisma migrate deploy`
(the app's start path; it uses no shadow database and does not check drift). The shadow database is created
on the same server and **PostgreSQL requires the datasource user to be superuser or hold `CREATEDB`**
(prisma.io/docs/orm/v7/prisma-migrate/understanding-prisma-migrate/shadow-database); a configured
`shadowDatabaseUrl` points the tool at a pre-created database but does not remove the requirement.
**The app role does not get `CREATEDB`.** Migrations run under a separate migration role; the options and
the recommendation are in [SCHEMA_CONTRACT_REVIEW.md](../backend/SCHEMA_CONTRACT_REVIEW.md) §2.2, and the
Product Owner decision it needs is §5.5. Binds to
[DEPLOYMENT_AND_BACKUP.md](../architecture/DEPLOYMENT_AND_BACKUP.md) §1.5.

## 6. Prisma capability audit against TryoutSim's invariants

Prisma's schema DSL does **not** cover every PostgreSQL feature. Each item below was checked against the
official pages cited; the ones marked *custom SQL* must be hand-written in a migration file
(`prisma migrate dev --create-only`, append SQL, then apply —
prisma.io/docs/orm/v7/prisma-migrate/workflows/unsupported-database-features).

| # | TryoutSim requirement | Prisma 7 support | Disposition |
|---|---|---|---|
| P-1 | Primary/foreign keys, referential actions, uniqueness, enums, indexes | First class in `schema.prisma` | Generated |
| P-2 | `CHECK` constraints (e.g. score bounds, non-negative counts, status enums at DB level) | **Not expressible in the Prisma schema**; the unsupported-features pages list triggers, views, stored procedures and anything else outside the DSL as custom-SQL-only. No `@@check` attribute exists in Prisma 7. | **Custom SQL** in a migration |
| P-3 | Partial indexes | Supported in Prisma 7 via the `where` argument on `@unique` / `@@unique` / `@@index` — **but behind the `partialIndexes` preview feature** | **Custom SQL** (PO directive 2026-11-10: the preview flag is not used) |
| P-4 | Exclusion constraints (if a range/exclusion rule is ever needed) | Not in the DSL | **Custom SQL** |
| P-5 | Append-only immutability (`question_version`, `session_snapshot`, `score_result`, `provisional_approval`, `question_report`, `validation_record`, `question_review`, `session_deletion`, `package_version`, `material_version`) | No ORM-level "read-only table". Prisma exposes `update`/`delete` on every model; the guarantee must be enforced in the database. | **Custom SQL**: triggers that raise, per append-only table, with **no escape hatch** — a custom GUC is settable by any role, so it would let the runtime unlock its own guard. DB-6's delete runs through one `SECURITY DEFINER` function owned by the migration role, and the runtime role holds no `UPDATE`/`DELETE` on the affected tables, so privilege is the first line and the trigger the second. Detail: [SCHEMA_CONTRACT_REVIEW.md](../backend/SCHEMA_CONTRACT_REVIEW.md) §1.3, §1.7 |
| P-6 | Conditional cascade for DB-4 (`generation_job.providerId` → `CASCADE` for finished jobs, `RESTRICT` while `queued`/`running`) | A single FK declares one referential action; the condition depends on the row's `status`. Note the rule is currently **prose only** in DATABASE_SCHEMA §2 — it is not a schema object Prisma is failing to generate. | **Custom SQL**: `ON DELETE RESTRICT` on the FK plus a `BEFORE DELETE ON provider` trigger that deletes finished jobs itself and lets `RESTRICT` reject the rest (database-enforced; recommended). The alternative — application-side cascade step — leaves DB-4 partly outside the database. Decision belongs to Gate 3: [SCHEMA_CONTRACT_REVIEW.md](../backend/SCHEMA_CONTRACT_REVIEW.md) §1.4 |
| P-13 | Role privileges and `ALTER DEFAULT PRIVILEGES` (a separate migration role owns the tables; the app role gets DML only) | Grants are not expressible in `schema.prisma` — Prisma manages no privileges at all | **Custom SQL** / provisioning script: [SCHEMA_CONTRACT_REVIEW.md](../backend/SCHEMA_CONTRACT_REVIEW.md) §2.4 |
| P-7 | Multi-table atomicity (DB-6) | Interactive transactions (`$transaction(async (tx) => …)`); batch transactions (`$transaction([...])`). Exceptions roll back. | Generated API — use **interactive** transactions for DB-6, because the multi-statement sequence has logic between statements |
| P-8 | Isolation levels / write-conflict discipline | Configurable per transaction: `ReadCommitted`, `RepeatableRead`, `Serializable`. Write-conflict/deadlock surfaces as `P2034`. | Use `Serializable` for the DB-6 write points and the score write; handle `P2034` explicitly (see [ERROR_HANDLING.md](../backend/ERROR_HANDLING.md)) |
| P-9 | Row locking / compare-and-write (BR-E3 approval invalidation, answer autosave revision counter) | No ORM lock API. `$queryRaw` can run `SELECT … FOR UPDATE`. Interactive transactions share one connection, so the lock stays held across statements. | **Raw SQL** inside an interactive transaction |
| P-10 | Analytics aggregates over JSON snapshots | Prisma's aggregate/groupBy covers plain columns, not JSON extraction | **Raw SQL** (`$queryRaw`) |
| P-11 | Multi-statement DDL (triggers, functions, extensions) | Custom SQL only | **Custom SQL** |
| P-12 | Schema-level `CREATE INDEX … USING` variants beyond B-tree | Index type is not part of the Prisma DSL; partial indexes excepted (P-3) | **Custom SQL** |

**Consequence, stated plainly:** Prisma Migrate generates the *structural* schema; the *integrity* layer —
P-2, P-4, P-5, P-6, P-12 — is hand-written SQL in reviewable migration files. This is not a workaround; it
is the documented Prisma path for database features outside the schema DSL. Every such file is reviewed
against [MIGRATION_STRATEGY.md](../backend/MIGRATION_STRATEGY.md) §1 like any other migration.

**One guarantee that Prisma cannot carry at all:** append-only immutability (P-5) is a database property.
If it were enforced only in application code, a future bug could rewrite a stored score. It is enforced by
triggers, and [SCORING_METHODOLOGY.md](../examination/SCORING_METHODOLOGY.md) §7 stays its canonical
statement.

## 7. Verification still open (Gate 3)

None of these is claimed as done:

1. **Windows smoke test** on this machine: `prisma generate`, `prisma migrate dev --create-only`, the `pg`
   adapter connecting to PostgreSQL 18.1, and one interactive transaction. (Nothing installed yet.)
2. **`prisma migrate deploy` advisory-lock timeout** — what the app does when the 10 s lock times out, and
   whether a startup readiness check covers it.
3. **Shadow database provisioning** — the datasource user must hold `CREATEDB`; two-role split
   (migration role vs app role) recommended. Needs a Product Owner decision
   ([SCHEMA_CONTRACT_REVIEW.md](../backend/SCHEMA_CONTRACT_REVIEW.md) §2.2, §5.5). Binds to
   [DEPLOYMENT_AND_BACKUP.md](../architecture/DEPLOYMENT_AND_BACKUP.md) §1.5.
4. **`node:test` integration** — decided on paper: one disposable **schema** per test file, migrations
   applied by the migrator, schema dropped after; rollback-per-test is rejected because a raising trigger
   and `Serializable` conflicts cannot be tested inside a transaction that never commits
   ([SCHEMA_CONTRACT_REVIEW.md](../backend/SCHEMA_CONTRACT_REVIEW.md) §4.2). Not built. No test framework
   may be added ([ADR-008](ADR-008-dependency-minimalism.md)).
5. **Partial indexes** — **closed by PO directive (2026-11-10)**: custom SQL migrations, the `partialIndexes`
   preview feature is not used.
6. **Custom objects under drift detection** — whether a replayed trigger/CHECK/custom index causes `migrate dev`
   to report drift. **The v7 docs do not say**, so this is UNVERIFIED and is the top risk: if it does, every
   dev run offers to drop the database. Test: [SCHEMA_CONTRACT_REVIEW.md](../backend/SCHEMA_CONTRACT_REVIEW.md) §5.1 step 5.
7. **Trigger ↔ legitimate-write interaction** — a raising trigger must not fire on writes the documents
   require (`session.deletedAt`, the DB-6 delete, the `observed_question_history` rebuild). Resolved on paper
   without any caller-settable flag: the delete runs through a `SECURITY DEFINER` function and the runtime role
   holds no `UPDATE`/`DELETE` on those tables. Untested
   ([SCHEMA_CONTRACT_REVIEW.md](../backend/SCHEMA_CONTRACT_REVIEW.md) §1.3, §1.7).

Each blocker's concrete test or decision is in
[SCHEMA_CONTRACT_REVIEW.md](../backend/SCHEMA_CONTRACT_REVIEW.md) §5.1–§5.5.

## 8. Consequences

- One ORM family in the dependency tree: `prisma`, `@prisma/client`, `@prisma/adapter-pg`, `pg`
  ([ADR-008](ADR-008-dependency-minimalism.md)). No second data-access library.
- A **codegen step** (`prisma generate`) joins the build; the generated client directory is a build
  artifact and is not hand-edited.
- A **generated-client output path** is configured explicitly (Prisma 7 recommends a custom output path,
  default `../generated/prisma`) rather than relying on the legacy `node_modules` placement.
- A **new third-party manifest** (`schema.prisma` + `prisma/migrations/`) becomes the persisted schema
  record; [DATABASE_SCHEMA.md](../backend/DATABASE_SCHEMA.md) remains its normative description.
- **`pg` is retained** as a direct dependency; it is the driver, and there is no second driver.
- **ADR-008's single-ORM rule is satisfied**, and the "raw SQL where the ORM is the wrong tool" clause
  is exactly what §6 depends on.

## 9. Decision history

| Date | Status | Note |
|---|---|---|
| 2026-11-10 | Proposed | ORM use approved (PO); Prisma leading candidate, Drizzle assessed. Recommendation in that draft favoured Drizzle on correctness-fit — that recommendation is **superseded by the PO decision below** and is retained only as history. |
| 2026-11-10 | **Accepted** | **PO decision: Prisma ORM, PostgreSQL 18.** Drizzle not selected. |
