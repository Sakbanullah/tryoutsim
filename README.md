# TryoutSim

Local-first, single-user, AI-assisted CPNS (Calon Pegawai Negeri Sipil) SKD preparation.

**Status: planning complete — no implementation started.** This repository currently contains
documentation only. Source code exists neither in `frontend/` nor `backend/`; the phases are gated
([docs/roadmap/DEVELOPMENT_ROADMAP.md](docs/roadmap/DEVELOPMENT_ROADMAP.md)).

SKD = Seleksi Kompetensi Dasar, three sub-tests: **TWK** (Tes Wawasan Kebangsaan),
**TIU** (Tes Intelegensia Umum), **TKP** (Tes Karakteristik Pribadi).

---

## What this is

A personal study app that:

- runs the official structured SKD drill (try out) and untimed practice,
- scores deterministically from a frozen session snapshot, never from a live config
  ([docs/examination/SCORING_METHODOLOGY.md](docs/examination/SCORING_METHODOLOGY.md)),
- generates practice questions via a configured AI provider, with provenance and validation,
- shows analytics and evidence-backed recommendations only from data, never recomputing scores in
  the UI.

## Documentation map

| Area | Entry |
|---|---|
| Product | [docs/product/PRD.md](docs/product/PRD.md) |
| Examination rules | [docs/examination/CPNS_2026_REGULATIONS.md](docs/examination/CPNS_2026_REGULATIONS.md), [COMPETENCY_TAXONOMY.md](docs/examination/COMPETENCY_TAXONOMY.md), [QUESTION_SPECIFICATION.md](docs/examination/QUESTION_SPECIFICATION.md), [SCORING_METHODOLOGY.md](docs/examination/SCORING_METHODOLOGY.md) |
| Backend | [docs/backend/API_SPECIFICATION.md](docs/backend/API_SPECIFICATION.md), [DATABASE_SCHEMA.md](docs/backend/DATABASE_SCHEMA.md), [ANALYTICS_ENGINE.md](docs/backend/ANALYTICS_ENGINE.md) |
| Frontend | [docs/frontend/FRONTEND_DATA_CONTRACTS.md](docs/frontend/FRONTEND_DATA_CONTRACTS.md), [FRONTEND_IMPLEMENTATION_PLAN.md](docs/frontend/FRONTEND_IMPLEMENTATION_PLAN.md) |
| AI | [docs/ai/AI_PROVIDER_ARCHITECTURE.md](docs/ai/AI_PROVIDER_ARCHITECTURE.md) |
| Architecture | [docs/architecture/SYSTEM_ARCHITECTURE.md](docs/architecture/SYSTEM_ARCHITECTURE.md), [ARCHITECTURE_DECISIONS.md](docs/architecture/ARCHITECTURE_DECISIONS.md) |
| Decisions | [docs/decisions/README.md](docs/decisions/README.md) |
| Roadmap / risks / audit | [docs/roadmap/DEVELOPMENT_ROADMAP.md](docs/roadmap/DEVELOPMENT_ROADMAP.md), [RISK_REGISTER.md](docs/roadmap/RISK_REGISTER.md), [docs/AUDIT.md](docs/AUDIT.md) |
| Everything | [docs/README.md](docs/README.md) |

## Regulatory honesty

Where a CPNS-2026 SKD instrument is **not** verified, the app ships a `provisional` config that is
**not offered for scoring** until the user explicitly approves it; it never presents a provisional or
historical basis as official 2026. See
[docs/examination/CPNS_2026_REGULATIONS.md](docs/examination/CPNS_2026_REGULATIONS.md) §4.

## Next step

Read [docs/roadmap/DEVELOPMENT_ROADMAP.md](docs/roadmap/DEVELOPMENT_ROADMAP.md) and approve the
documentation set to open the frontend gate. Nothing builds until then.