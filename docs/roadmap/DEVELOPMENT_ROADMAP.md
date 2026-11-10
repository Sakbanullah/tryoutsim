# Development Roadmap

Status: **Gate 0 approved; documentation re-baselined 2026-11-08 (Product Owner decisions A–K). Gate 2
frontend awaits approval of this revision.** · 2026-11-08

This roadmap is a dependency chain, not a date plan. It records the gate the master directive enforces:
**no frontend implementation, then no backend implementation, without explicit user approval.**

---

## Gate 0 — Planning (approved 2026-11-08)

- [x] Discovery, discovery report
- [x] CPNS 2026 research + evidence record
- [x] Exam config model + approval integrity
- [x] Examination docs (regulations, taxonomy, question spec, scoring methodology)
- [x] Product docs (PRD, user stories, journeys, feature matrix, MVP scope, package spec)
- [x] AI docs, architecture docs, decisions, backend + frontend specs
- [x] Audit register (open findings → this doc's report)
- [x] **Gate: user approval of the full documentation set** (2026-11-08)
- [x] **Documentation re-baseline to decisions A–K** (CPNS-only scope, two-area navigation, packages,
  drill flows, question lifecycle and sampling, AI jobs, backup/security) —
  [audit/SYSTEM_REVISION_REPORT.md](../audit/SYSTEM_REVISION_REPORT.md)
- [ ] **Gate: Product Owner approval of the re-baselined documentation set**

## Gate 1 — Skill audit + root files

Do **only** after Gate 0 approval:

- [x] Skill audit → `docs/architecture/INSTALLED_SKILLS.md` (fill the deferred table)
- [x] `AGENTS.md`, `BACKEND_TEMP.md`, `README.md`, `docs/README.md`, `.gitignore`

## Gate 2 — Frontend (mock data)

Do **only** after Gate 1 **and** after the re-baselined documentation is approved:

- [ ] Re-align the existing Gate 2 frontend to the revised docs: two-area navigation (Belajar /
  Kelola via Lainnya), package-based start (no config selection), active-time clock, Latihan
  per-answer feedback, Beranda without config status, Progres without config selector
- [ ] Implement the new surfaces: Materi, Review Soal, sampling screen, Manajemen Paket,
  Pengaturan (backup/restore), notification centre
- [ ] Manual verification by the user (ADR-007: no automated frontend tests)

The already-built Gate 2 screens are **not** re-approved by the documentation revision; their
deviations from decisions B–D are listed in
[SYSTEM_REVISION_REPORT.md](../audit/SYSTEM_REVISION_REPORT.md) §6.

## Gate 3 — Backend

Do **only** after frontend approval:

- [ ] Backend against [API_SPECIFICATION.md](../backend/API_SPECIFICATION.md), PostgreSQL 18, migrations
- [ ] Background job runner, restart inspection, notification emission
- [ ] Backup/restore service, OS secure storage adapter
- [ ] Wire frontend to backend in place of mock layer

## Open integration items (carried to `BACKEND_TEMP.md`)

- Exact `generation-jobs` persistence shape (job queue vs rows) — see
  [GENERATION_JOBS.md](../backend/GENERATION_JOBS.md).
- Secret-store adapter on non-Windows hosts — see [SECRETS.md](../backend/SECRETS.md).
- Active-time clock: accumulated server-side from authenticated autosaves; a browser-only clock is
  rejected ([SCORING_METHODOLOGY.md](../examination/SCORING_METHODOLOGY.md) §8.1).
- Launcher implementation (one command that starts backend, waits for `/health`, then opens the
  browser) — see [DEPLOYMENT_AND_BACKUP.md](../architecture/DEPLOYMENT_AND_BACKUP.md) §1.
