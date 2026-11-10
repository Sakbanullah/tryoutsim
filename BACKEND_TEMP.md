# BACKEND_TEMP.md

Worklog of backend decisions and open items during the planning phase. **This is a scratchpad, not a
canonical doc** — findings are promoted to canonical docs (or to the audit register) before the
backend gate opens. Do not treat entries here as final.

Team coordination for the backend team is specified in
[docs/roadmap/COORDINATION_SPEC.md](docs/roadmap/COORDINATION_SPEC.md) (PROPOSAL — Gate 3 remains closed).

---

## Open items (decide at backend start)

| # | Item | Where it lives | Notes |
|---|---|---|---|
| 1 | Secret-store backend (OS keychain vs owner-only file) | `docs/backend/SECRETS.md` §2 | invariant fixed (no plaintext in the database); backend choice open |
| 2 | Generation-job persistence (separate tables vs JSON job-row) | `docs/backend/GENERATION_JOBS.md` §4, `DATABASE_SCHEMA.md` §2 | shape unresolved |
| 3 | Job crash-recovery (survive restart or not) | `docs/backend/GENERATION_JOBS.md` §4 | |
| 4 | Prisma ORM 7 + Prisma Migrate — install and smoke-test | `docs/decisions/ADR-011-orm-selection.md` §7; `docs/backend/MIGRATION_STRATEGY.md` §7 | **Decided** (PO 2026-11-10). Open work is verification: Windows smoke test, shadow-DB provisioning, `node:test` isolation, `partialIndexes` preview flag, trigger replay under `migrate dev` |
| 5 | Deadline enforcement: server-clock vs browser-clock | `docs/roadmap/DEVELOPMENT_ROADMAP.md` | server clock assumed; browser-only rejected (FR-T2) |

## Rejected / deferred (do not resurrect without reopening)

| Item | Why deferred |
|---|---|
| Non-discriminating TKP key rejection (all-equal weights) | No regulatory basis (AUD-18) |
| Login/accounts for MVP | No auth default (ADR-009) |
| Premature Zustand/Redux/TanStack Query | Dependency minimalism (ADR-008); upgrade triggers documented instead |
| Automated frontend tests | User forbade (ADR-007) |

## Decided (2026-11-10 — Product Owner)

Stack for the backend, recorded in [ADR-002](docs/decisions/ADR-002-sqlite.md):

| Concern | Decided |
|---|---|
| Database | PostgreSQL 18 (local server) |
| Data access | **Prisma ORM 7** ([ADR-011](docs/decisions/ADR-011-orm-selection.md), `Accepted`) |
| ORM | Prisma only — one ORM ([ADR-008](docs/decisions/ADR-008-dependency-minimalism.md) revised) |
| Driver | `pg` (node-postgres), direct dependency, via `@prisma/adapter-pg`; no second driver |
| Migrations | Prisma Migrate; custom SQL for CHECK/triggers/DB-4 cascade ([ADR-011](docs/decisions/ADR-011-orm-selection.md) §6) |
| Raw SQL | `$queryRaw`/`$executeRaw` for analytics aggregates and constraint-critical DDL |
| Runtime | Node.js 24 |
| HTTP server | `node:http` |
| Test runner | `node:test` |

Not decided here: exact role/database names, where the role password is stored, and whether the app role
holds `CREATEDB` or a separate shadow database is provisioned (Gate 3). The review recommends a **separate
migration role** — the app role never holds `CREATEDB`
([docs/backend/SCHEMA_CONTRACT_REVIEW.md](docs/backend/SCHEMA_CONTRACT_REVIEW.md) §2.2, decision pending at
its §5.5).

## Review 2026-11-10

[docs/backend/SCHEMA_CONTRACT_REVIEW.md](docs/backend/SCHEMA_CONTRACT_REVIEW.md) — custom-SQL inventory,
migration workflow, `pg` pool values, `node:test` isolation, ADR-011 §7 blocker ledger, verification table.
Findings recorded as AUD-82. Nothing installed, no database, no role, no migration run.

## Review 2026-11-10 — round 2 (five PO directives)

Recorded as AUD-83. Directives settled: separate migration role; no `CREATEDB` on `tryoutsim_app`;
partial indexes as custom SQL; DB-4 = FK `RESTRICT` + trigger; constraint inventory in `DATABASE_SCHEMA.md`.
Withdrawn: the custom-GUC immutability escape hatch (any role can set a placeholder GUC) — replaced by least
privilege plus a `SECURITY DEFINER` delete function; and the "migration is atomic" claim (Prisma CLI 7
documents partial execution). Open: custom-object drift behaviour under `migrate dev`, the Windows smoke test,
and the PO decisions in review §5.5.

## Status

Planning phase. Backend not started. This file becomes the implementation worklog when Gate 3 opens
([docs/roadmap/DEVELOPMENT_ROADMAP.md](docs/roadmap/DEVELOPMENT_ROADMAP.md)).