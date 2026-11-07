# Development Roadmap

Status: **Gate 0 approved, Gate 2 built (manual verification pending)** · 2026-11-08

This roadmap is a dependency chain, not a date plan. It records the gate the master directive enforces:
**no frontend implementation, then no backend implementation, without explicit user approval.**

---

## Gate 0 — Planning (approved 2026-11-08)

- [x] Discovery, discovery report
- [x] CPNS 2026 research + evidence record
- [x] Exam config model + approval integrity
- [x] Examination docs (regulations, taxonomy, question spec, scoring methodology)
- [x] Product docs (PRD, user stories, journeys, feature matrix, MVP scope)
- [x] AI docs, architecture docs, decisions, backend + frontend specs
- [x] Audit register (open findings → this doc's report)
- [x] **Gate: user approval of the full documentation set** (2026-11-08)

## Gate 1 — Skill audit + root files

Do **only** after Gate 0 approval:

- [x] Skill audit → `docs/architecture/INSTALLED_SKILLS.md` (fill the deferred table)
- [x] `AGENTS.md`, `BACKEND_TEMP.md`, `README.md`, `docs/README.md`, `.gitignore`

## Gate 2 — Frontend (mock data)

Do **only** after Gate 1:

- [x] Frontend implementation against documented contracts, on mock data
- [ ] Manual verification by the user (ADR-007: no automated frontend tests)

## Gate 3 — Backend

Do **only** after frontend approval:

- [ ] Backend against [API_SPECIFICATION.md](../backend/API_SPECIFICATION.md), SQLite, migrations
- [ ] Wire frontend to backend in place of mock layer

## Open integration items (carried to `BACKEND_TEMP.md`)

Recorded as unresolved until the relevant doc exists:

- Exact `generation-jobs` persistence shape (job queue vs rows) — see
  [GENERATION_JOBS.md](../backend/GENERATION_JOBS.md).
- Secret-store backend (file vs OS keychain) — see [SECRETS.md](../backend/SECRETS.md).
- Deadline enforcement: a server clock is assumed; a browser-only clock is rejected (FR-T2).