# Migration Strategy

Canonical source for how the SQLite schema changes over time. The logical schema is
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

## 2. Direction

- `migration_0001_baseline` … monotonically increasing, applied inside a transaction each.
- A `schema_migrations` table records applied ids + a checksum of each applied file.
- **Single-node, single-user**: no concurrent-writer migration concerns beyond a local file lock; if
  a migration fails mid-way it rolls back to the previous transactional checkpoint.

## 3. Version contract with scoring

The `scoringVersion` and `configVersion` are **domain values** bound into approval, independent of
the CLI schema version. A schema migration never bumps `scoringVersion` automatically
([CPNS_2026_REGULATIONS](../examination/CPNS_2026_REGULATIONS.md) §4.3): changing scoring rules is a
regulatory/domain action, not a schema action. Conflation is a catchable audit finding (AUD-id TBD).

## 4. Backfill rules for provisional columns

- New non-null column → must ship a default or a backfill step in the same migration.
- Existing rows never get an invented `regulatoryBasisHash`: hashes are recomputed over `BasisRef`,
  then re-approval is forced (any hash change invalidates `ProvisionalApproval` — BR-E3).

## 5. Secrets are not migrated

Provider keys live in the secret store ([SECRETS.md](./SECRETS.md)), not in schema tables. Key
migration is a secret-store concern and is out of scope for schema migrations.

## 6. Open item

Exact migration tooling is decided at backend time (ADR-002 SQLite; no ORM mandated). This file fixes
the invariants; the tool is an implementation choice recorded in `BACKEND_TEMP.md`.