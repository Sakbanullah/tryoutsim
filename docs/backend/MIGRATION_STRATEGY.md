# Migration Strategy

Canonical source for how the **PostgreSQL 18** schema changes over time
([ADR-002](../decisions/ADR-002-sqlite.md)). The logical schema is
[DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md); this file is the **how**, not the what.

---

## 1. Principles

- **Versioned, additive-first.** Every schema change ships as a numbered migration; additive columns
  are preferred, destructive steps are last and explicit.
- **Data loss is a hard stop.** A migration that drops data without a documented export/recovery
  path is rejected ([ERROR_HANDLING](./ERROR_HANDLING.md)).
- **Snapshot immutability beats migration pressure.** Score snapshots are opaque JSON, so scoring
  correctness survives schema changes to the live question/config tables — this is the reason the
  snapshot boundary exists ([SCORING_METHODOLOGY](../examination/SCORING_METHODOLOGY.md) §7).
- **Nothing historical is deleted.** Rows representing past activity — sessions, results, snapshots,
  question versions, approvals, validation records — are never removed by a migration. Products and
  rules change; the record of what was already done does not
  ([CPNS_2026_REGULATIONS](../examination/CPNS_2026_REGULATIONS.md) §8 rule 8).
- **Retired is a state, not a deletion.** Something the product no longer offers (for example the
  retained non-CPNS config, `dataProvenance: 'legacy'`) is marked and filtered out, never dropped.

## 1.1 Legacy pathway data

The 2026-11-08 scope change made the product CPNS-only. The stored `SEKOLAH_KEDINASAN` config and any
session recorded against it are **retained**:

- the config row keeps its id, basis and state, plus `dataProvenance: 'legacy'`;
- no migration rewrites `session.examConfigId`, so a replay of an old session still resolves;
- management routes filter `legacy` rows out; nothing in the learner area can reach them.

## 2. Direction

- `migration_0001_baseline` … monotonically increasing, raw `.sql` files applied in order. A failed
  migration may leave a **partially applied** schema — Prisma CLI 7 documents partial execution and promises
  no atomicity — so every migration is written to be safely re-runnable (`IF NOT EXISTS`, `DROP … IF EXISTS`
  before `CREATE`). Recovery is `migrate resolve --rolled-back`, not `migrate reset`.
- The shipped migrations are `20261110000000_baseline`, `20261110000001_constraints_and_guards` and
  `20261110000002_verdict_update_and_package_pin` (AUD-85/87/88: the verdict columns and T-7 row guard,
  `tryoutsim.add_session_verdict`, and the optional `package_version` config pin). A new definer function is
  granted in `backend/db/provision-grants.sql`, which is re-run after the migration.
- `_prisma_migrations` (Prisma's own table) records each applied migration and its checksum.
- **Single-node, single-user**: no concurrent-writer migration concerns beyond the single-instance lock
  ([DEPLOYMENT_AND_BACKUP](../architecture/DEPLOYMENT_AND_BACKUP.md) §1.2). Two migration runs cannot
  overlap by construction; the backend serialises them with a PostgreSQL advisory lock as a second
  guard.
- A migration that fails is a **hard start failure**: the backend refuses to serve rather than run on a
  half-migrated database ([DEPLOYMENT_AND_BACKUP](../architecture/DEPLOYMENT_AND_BACKUP.md) §1.2).

## 3. Version contract with scoring

The `scoringVersion` and `configVersion` are **domain values** bound into approval, independent of
the CLI schema version. A schema migration never bumps `scoringVersion` automatically
([CPNS_2026_REGULATIONS](../examination/CPNS_2026_REGULATIONS.md) §4.3): changing scoring rules is a
regulatory/domain action, not a schema action. Conflation would be a rule change and is therefore
recorded in [AUDIT.md](../AUDIT.md) like any other — the register has no open entry for it today; this
line names the obligation, not an existing finding.

## 4. Backfill rules for provisional columns

- New non-null column → must ship a default or a backfill step in the same migration.
- Existing rows never get an invented `regulatoryBasisHash`: hashes are recomputed over `BasisRef`,
  then re-approval is forced (any hash change invalidates `ProvisionalApproval` — BR-E3).
- A new **behavioural** column backfilled with a safe value must say what the safe value means. Example:
  `question.dynamicEligible` is backfilled `1` only for questions whose provenance is
  `human_authored`/`official_historical` or whose sampling record says `sampled_pass`; everything else is
  backfilled `0` (not yet eligible). A default of `1` for AI questions would bypass the sampling gate.

## 5. Secrets are not migrated

Provider keys live in the OS credential store ([SECRETS.md](./SECRETS.md) §2), not in schema tables.
Schema migrations never read, write or move them.

**Cross-device restore** is the migration the user actually performs
([DEPLOYMENT_AND_BACKUP](../architecture/DEPLOYMENT_AND_BACKUP.md) §3): an archive carries no key, and the
restored `secret_ref` rows resolve to `hasKey = false` until the user re-enters each key.
A credential entry name from another machine is invalid by construction and is never treated as a key
found.

## 6. Restore compatibility contract

A backup archive carries its schema version. The restore wizard accepts an archive whose schema version is
**≤** the running app's, refuses a newer one, and runs forward migrations inside the restore transaction.
Nothing in the archive is recomputed: results and snapshots restore verbatim.

## 7. Migration tooling

The runner is **Prisma Migrate**, decided with the ORM ([ADR-011](../decisions/ADR-011-orm-selection.md),
`Accepted`; [ADR-002](../decisions/ADR-002-sqlite.md)). It satisfies §1–§2 as follows: versioned
`prisma/migrations/<timestamp>_<name>/migration.sql` applied in order; a checksum recorded per migration in
`_prisma_migrations`; a PostgreSQL advisory lock on deploy (10 s timeout, not configurable — a timeout is a
hard start failure). The app's start path runs `prisma migrate status` only; applying migrations
(`prisma migrate deploy`) is a separate operator step under the migration role.

Generated SQL is **reviewed**, never trusted blindly: the additive-first rule (§1) and the immutability
rule (§1) bind generated migrations exactly as they bind hand-written ones. **Custom SQL is mandatory** for
the features the Prisma schema DSL cannot express — `CHECK` constraints, exclusion constraints, the
append-only immutability triggers, the DB-4 conditional cascade, and non-B-tree index variants. Those are
added with `prisma migrate dev --create-only`, then reviewed and applied.
[ADR-011](../decisions/ADR-011-orm-selection.md) §6 is the authoritative audit of which invariant needs
custom SQL and why; this section does not restate it.

**Privilege note:** `prisma migrate dev` needs a shadow database; on PostgreSQL the datasource user must be
superuser or hold `CREATEDB`. A configured `shadowDatabaseUrl` points the tool at a pre-created database
but does not remove the requirement. The app role therefore never holds `CREATEDB`; migrations run under a
separate migration role. See [SCHEMA_CONTRACT_REVIEW](SCHEMA_CONTRACT_REVIEW.md) §2.2.

**Advisory lock:** `migrate deploy`, `migrate dev` and `migrate resolve` take a PostgreSQL advisory lock with
a **10 s timeout that cannot be configured**; on timeout the command must be re-run. A migration run
overlapping another fails the start check, which refuses to serve.

**Transaction scope per migration:** UNVERIFIED for Prisma 7.10.1 — Prisma's v7 docs do not state whether
each migration file applies in one transaction. A failed migration must therefore be treated as possibly
partial: resolve with `migrate resolve --rolled-back`, inspect the schema, fix, redeploy. Never
`migrate reset` on a database holding data. Settlement test:
[SCHEMA_CONTRACT_REVIEW](SCHEMA_CONTRACT_REVIEW.md) §5.1 step 7.