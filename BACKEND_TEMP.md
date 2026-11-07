# BACKEND_TEMP.md

Worklog of backend decisions and open items during the planning phase. **This is a scratchpad, not a
canonical doc** — findings are promoted to canonical docs (or to the audit register) before the
backend gate opens. Do not treat entries here as final.

---

## Open items (decide at backend start)

| # | Item | Where it lives | Notes |
|---|---|---|---|
| 1 | Secret-store backend (OS keychain vs owner-only file) | `docs/backend/SECRETS.md` §2 | invariant fixed (no plaintext in SQLite); backend choice open |
| 2 | Generation-job persistence (separate tables vs JSON job-row) | `docs/backend/GENERATION_JOBS.md` §4, `DATABASE_SCHEMA.md` §2 | shape unresolved |
| 3 | Job crash-recovery (survive restart or not) | `docs/backend/GENERATION_JOBS.md` §4 | |
| 4 | Migration tooling (no ORM mandated) | `docs/backend/MIGRATION_STRATEGY.md` §6 | ADR-002 SQLite; tool is an implementation choice |
| 5 | Deadline enforcement: server-clock vs browser-clock | `docs/roadmap/DEVELOPMENT_ROADMAP.md` | server clock assumed; browser-only rejected (FR-T2) |

## Rejected / deferred (do not resurrect without reopening)

| Item | Why deferred |
|---|---|
| Non-discriminating TKP key rejection (all-equal weights) | No regulatory basis (AUD-18) |
| Login/accounts for MVP | No auth default (ADR-009) |
| Premature Zustand/Redux/TanStack Query | Dependency minimalism (ADR-008); upgrade triggers documented instead |
| Automated frontend tests | User forbade (ADR-007) |

## Status

Planning phase. Backend not started. This file becomes the implementation worklog when Gate 3 opens
([docs/roadmap/DEVELOPMENT_ROADMAP.md](docs/roadmap/DEVELOPMENT_ROADMAP.md)).