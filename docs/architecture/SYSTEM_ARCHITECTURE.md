# System Architecture

Canonical source for **what the system is made of and how the pieces talk**. Not a deployment script.

Local-first, single-user. One process serves a browser UI and speaks to one external dependency: the
configured AI provider.

---

## 1. Context

```mermaid
flowchart LR
  U[User browser] <--> A[TryoutSim app]
  A <--> P[AI provider\n(gateway / OpenAI-compatible)]
  A <--> DB[(PostgreSQL 18)]
```

- **No cloud account, no multi-user server** ([PRD.md](../product/PRD.md) §4, O-6).
- The only network call is to the provider ([PRD.md](../product/PRD.md) NFR-1).
- Backend binds `127.0.0.1`; no auth by default ([SECURITY.md](./SECURITY.md),
  [AUTHENTICATION.md](../backend/AUTHENTICATION.md)).

## 2. Components

| Component | Owns | Canonical doc |
|---|---|---|
| Frontend (React + TS + Vite + Tailwind, implemented) | UI, mock-data layer until the backend gate opens | `docs/frontend/*` |
| Launcher | one command/shortcut: start backend, wait for ready, open browser, clean shutdown | [DEPLOYMENT_AND_BACKUP.md](./DEPLOYMENT_AND_BACKUP.md) §1 |
| API gateway | HTTP surface, one process | [API_SPECIFICATION.md](../backend/API_SPECIFICATION.md) |
| Exam/scoring domain | configs, packages, sessions, scoring, thresholds, snapshots | [SCORING_METHODOLOGY.md](../examination/SCORING_METHODOLOGY.md), [PACKAGE_SPECIFICATION.md](../product/PACKAGE_SPECIFICATION.md) |
| Analytics | metrics from scores + timing; derived-on-read | [ANALYTICS_ENGINE.md](../backend/ANALYTICS_ENGINE.md) |
| Recommendation | weaknesses, materials, drills, learning sequence (no standalone plan) | [RECOMMENDATION_ENGINE.md](../ai/RECOMMENDATION_ENGINE.md) |
| Question bank | question CRUD, lifecycle, provenance, versions, reports | [QUESTION_SPECIFICATION.md](../examination/QUESTION_SPECIFICATION.md) |
| Material | material records, versions, approval | [MATERIAL_SPECIFICATION.md](../examination/MATERIAL_SPECIFICATION.md) |
| AI integration | provider transport, routing, capability detection, generation jobs | [AI_PROVIDER_ARCHITECTURE.md](../ai/AI_PROVIDER_ARCHITECTURE.md), [GENERATION_JOBS.md](../backend/GENERATION_JOBS.md) |
| Notifications | persisted in-app events and unread state | [NOTIFICATION_SPECIFICATION.md](../backend/NOTIFICATION_SPECIFICATION.md) |
| Backup/restore | archive, verification, retention, migration wizard | [DEPLOYMENT_AND_BACKUP.md](./DEPLOYMENT_AND_BACKUP.md) §2–§3 |
| Storage | PostgreSQL 18 persistence + migrations | [DATABASE_SCHEMA.md](../backend/DATABASE_SCHEMA.md), [ADR-002](../decisions/ADR-002-sqlite.md) |
| Secret store | API keys in OS secure storage | [SECRETS.md](../backend/SECRETS.md) §2 |

## 3. Deployment shape

A **modular monolith** (see ADR on this): one backend process, modules separated by folder and
interface, not by service/network. One local **PostgreSQL 18** database per install, reached over
loopback through **Prisma ORM** with raw SQL where it fits ([ADR-002](../decisions/ADR-002-sqlite.md),
[ADR-008](../decisions/ADR-008-dependency-minimalism.md), [ADR-011](../decisions/ADR-011-orm-selection.md));
migrations versioned (NFR-9).

- **Frontend and backend run on the user's machine**; the backend binds loopback only.
- **One command or shortcut** starts both and opens the browser **after** the backend reports ready
  ([DEPLOYMENT_AND_BACKUP.md](./DEPLOYMENT_AND_BACKUP.md) §1.2).
- **Everything works offline except AI calls.** Provider absence or failure degrades only AI features.
- **Jobs run in the backend**, not the browser; a closed browser does not stop a generation job
  ([GENERATION_JOBS.md](../backend/GENERATION_JOBS.md) §1).
- **No cloud server for app data**; backups go to a user-chosen local folder.
- **Single user, no account, no login, no roles, no PIN** ([AUTHENTICATION.md](../backend/AUTHENTICATION.md)).

## 4. Data flow summary

The end-to-end flows (bootstrap, generate, score, analyze) are in [DATA_FLOW.md](./DATA_FLOW.md).
Data-flow **invariants**:

- Scores are a pure function of a frozen [session snapshot](../examination/SCORING_METHODOLOGY.md §7) —
  never the live question bank/config.
- Analytics flows **from** scores, never back into them (scoring ↔ analytics separation), and is
  derived-on-read so a deleted session simply stops contributing
  ([ANALYTICS_ENGINE.md](../backend/ANALYTICS_ENGINE.md) §7.2).
- AI output changes nothing except queued content (questions, materials, recommendation **ordering and
  explanation**); it never touches scoring/analytics and never introduces a weakness
  ([RECOMMENDATION_ENGINE.md](../ai/RECOMMENDATION_ENGINE.md) §2.1).
- A session's **config and package version are bound server-side**; the client sends neither
  ([PACKAGE_SPECIFICATION.md](../product/PACKAGE_SPECIFICATION.md) §3).

## 5. Stack decision status

Backend stack decisions are **ratified** (Product Owner, 2026-11-10) and recorded in
[ADR-002](../decisions/ADR-002-sqlite.md):

| Choice | Value |
|---|---|
| Database | PostgreSQL 18 (local server, `127.0.0.1:5432`) |
| Runtime | Node.js 24 |
| HTTP server | `node:http` (no HTTP framework) |
| Test runner | `node:test` |
| Data access | **Prisma ORM 7** over PostgreSQL 18 ([ADR-011](../decisions/ADR-011-orm-selection.md)); raw SQL (`$queryRaw`/`$executeRaw`) for analytics aggregates and constraint-critical DDL |
| Database driver | `pg` (node-postgres), direct dependency, used through `@prisma/adapter-pg` — the only driver (`postgres.js` is not used) |
| Migrations | Prisma Migrate; custom SQL for CHECK/exclusion constraints, append-only triggers and the DB-4 conditional cascade ([ADR-011](../decisions/ADR-011-orm-selection.md) §6) |

Frontend stack ([ADR-010](../decisions/ADR-010-stack-react-ts-vite-tailwind.md)) remains **Proposed**. The
backend data access is decided: **Prisma ORM** ([ADR-011](../decisions/ADR-011-orm-selection.md),
`Accepted`). The architecture above is a shape, not a full dependency list;
[ADR-008](../decisions/ADR-008-dependency-minimalism.md) governs anything added beyond the above.

## 6. Boundaries

- This file names components and their seams; it does not restate scoring rules, API paths, or schema.
- Frontend-internal architecture is [FRONTEND_COMPONENT_ARCHITECTURE.md](../frontend/FRONTEND_COMPONENT_ARCHITECTURE.md).
- Backend-internal execution is the `docs/backend/*` set.