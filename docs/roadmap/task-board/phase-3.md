# Task Board — Phase 3 (backend implementation)

Mode: **ordinary subagents** (PO decision 2026-11-10). This is *not* a native Agent Team and there is no
shared native task list: this file is the record, and the Lead (main session) is the only writer of
`Status`.

The backend gate was opened by the PO on 2026-11-10 with D-1…D-8 approved and implementation authorised; the
roadmap gate definitions themselves are unchanged.

## Tasks

| Task ID | Title | Owner | Status | Deps | Notes |
|---|---|---|---|---|---|
| P3-D0-01 | Package, Prisma config, env config | Lead | DONE | — | `backend/package.json`, `prisma.config.ts`, `src/config.js` |
| P3-D0-02 | Envelope, error registry, validation primitives | Lead | DONE | P3-D0-01 | `src/errors.js`, `src/http/envelope.js`, `src/http/validation.js` |
| P3-D0-03 | Router, HTTP server, request ids | Lead | DONE | P3-D0-02 | `src/http/router.js`, `src/http/server.js` |
| P3-D0-04 | Pool with timeouts, health route, start path + lock | Lead | DONE | P3-D0-03 | `src/db/pool.js`, `src/routes/health.js`, `src/main.js` |
| P3-D0-05 | D0 self-check executed | Lead | DONE | P3-D0-04 | `test/d0-envelope.test.js` — 6/6 pass, `node --test` |
| P3-D1-01 | Prisma schema for every table in DATABASE_SCHEMA §2 | Lead | DONE | P3-D0-01 | `prisma/schema.prisma`; `prisma validate` passes |
| P3-D1-02 | Baseline migration generated offline | Lead | DONE | P3-D1-01 | `prisma/migrations/20261110000000_baseline` via `migrate diff` |
| P3-D1-03 | Custom objects migration (CHECKs, collations, triggers, DB-4, delete function) | Lead | DONE | P3-D1-02 | `..._constraints_and_guards/migration.sql` — **not applied** |
| P3-D1-04 | Provisioning SQL: roles, grants, default privileges | Lead | DONE | P3-D1-03 | `db/provision.ps1`, `db/provision-grants.sql`, `db/make-env.ps1` |
| P3-D1-05 | Apply migrations to a real database | Lead | **BLOCKED** | P3-D1-03 | No PostgreSQL superuser credential in this session |
| P3-D1-06 | Custom-object drift smoke test (`migrate dev`) | Lead | **BLOCKED** | P3-D1-05 | Top open risk; needs a live shadow DB |
| P3-D2-01 | D2 repositories and scoring core | Builder 2 (subagent) | READY | P3-D0-04 | Depends on D1 schema only |
| P3-D3-01 | D3 question bank and materials | Builder 3 (subagent) | READY | P3-D0-04 | |
| P3-D4-01 | D4 providers, secrets, routing, generation jobs | Builder 4 (subagent) | READY | P3-D0-04 | |
| P3-T1-01 | Tester 1: core logic + persistence | Tester 1 (subagent) | BLOCKED | P3-D1-05, P3-D2-01 | Tests need a database |

## Status history

| When | Task | From → To | By | Reason |
|---|---|---|---|---|
| 2026-11-10 | board | — → created | Lead | PO authorised ordinary-subagent execution and D0/D1 start |
| 2026-11-10 | P3-D1-05 | READY → BLOCKED | Lead | `psql -w` against `postgres`, `tryoutsim_migrator`, `tryoutsim_app` all fail with `password authentication failed`; no pgpass file; no Windows-auth path |
