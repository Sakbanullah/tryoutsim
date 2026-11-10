# TryoutSim

Local-first, single-user, AI-assisted **CPNS** (Calon Pegawai Negeri Sipil) SKD preparation. CPNS only —
no other recruitment pathway is served.

**Status: documentation re-baselined 2026-11-08, awaiting Product Owner approval.** The repository
carries documentation plus a Gate 2 frontend that predates the re-baseline; the revised documents gate
the next implementation step ([docs/roadmap/DEVELOPMENT_ROADMAP.md](docs/roadmap/DEVELOPMENT_ROADMAP.md)).

SKD = Seleksi Kompetensi Dasar, three sub-tests: **TWK** (Tes Wawasan Kebangsaan),
**TIU** (Tes Intelegensia Umum), **TKP** (Tes Karakteristik Pribadi).

---

## What this is

A personal study app that:

- runs a full SKD simulation, single-subtest tryouts, and per-submateri drills (Latihan),
- binds the exam configuration server-side and freezes it in a session snapshot; the learner never picks
  a config ([docs/product/PACKAGE_SPECIFICATION.md](docs/product/PACKAGE_SPECIFICATION.md)),
- counts only **accumulated active time**, autosaves and resumes at any time,
  ([docs/examination/SCORING_METHODOLOGY.md](docs/examination/SCORING_METHODOLOGY.md) §8.1),
- scores deterministically from the frozen snapshot, and separates the **score** from a threshold
  **verdict** — a verdict needs a valid approval,
- generates questions via a configured AI provider as background jobs, with provenance, layered
  validation and user sampling ([docs/examination/QUESTION_SPECIFICATION.md](docs/examination/QUESTION_SPECIFICATION.md)),
- holds a material bank feeding recommendations, and reports analysis only where the sample supports it,
- keeps everything except AI calls working offline, with verified local backups.

## Documentation map

| Area | Entry |
|---|---|
| Product | [docs/product/PRD.md](docs/product/PRD.md), [PACKAGE_SPECIFICATION.md](docs/product/PACKAGE_SPECIFICATION.md) |
| Examination rules | [docs/examination/CPNS_2026_REGULATIONS.md](docs/examination/CPNS_2026_REGULATIONS.md), [COMPETENCY_TAXONOMY.md](docs/examination/COMPETENCY_TAXONOMY.md), [QUESTION_SPECIFICATION.md](docs/examination/QUESTION_SPECIFICATION.md), [MATERIAL_SPECIFICATION.md](docs/examination/MATERIAL_SPECIFICATION.md), [SCORING_METHODOLOGY.md](docs/examination/SCORING_METHODOLOGY.md) |
| Backend | [docs/backend/API_SPECIFICATION.md](docs/backend/API_SPECIFICATION.md), [DATABASE_SCHEMA.md](docs/backend/DATABASE_SCHEMA.md), [ANALYTICS_ENGINE.md](docs/backend/ANALYTICS_ENGINE.md), [NOTIFICATION_SPECIFICATION.md](docs/backend/NOTIFICATION_SPECIFICATION.md) |
| Frontend | [docs/frontend/FRONTEND_INFORMATION_ARCHITECTURE.md](docs/frontend/FRONTEND_INFORMATION_ARCHITECTURE.md), [FRONTEND_DATA_CONTRACTS.md](docs/frontend/FRONTEND_DATA_CONTRACTS.md), [FRONTEND_API_MAPPING.md](docs/frontend/FRONTEND_API_MAPPING.md), [FRONTEND_GAP_REGISTER.md](docs/frontend/FRONTEND_GAP_REGISTER.md) |
| AI | [docs/ai/AI_PROVIDER_ARCHITECTURE.md](docs/ai/AI_PROVIDER_ARCHITECTURE.md) |
| Architecture / deployment | [docs/architecture/SYSTEM_ARCHITECTURE.md](docs/architecture/SYSTEM_ARCHITECTURE.md), [DEPLOYMENT_AND_BACKUP.md](docs/architecture/DEPLOYMENT_AND_BACKUP.md), [ARCHITECTURE_DECISIONS.md](docs/architecture/ARCHITECTURE_DECISIONS.md) |
| Decisions | [docs/decisions/README.md](docs/decisions/README.md) |
| Roadmap / risks / audit | [docs/roadmap/DEVELOPMENT_ROADMAP.md](docs/roadmap/DEVELOPMENT_ROADMAP.md), [RISK_REGISTER.md](docs/roadmap/RISK_REGISTER.md), [docs/AUDIT.md](docs/AUDIT.md), [docs/audit/SYSTEM_REVISION_REPORT.md](docs/audit/SYSTEM_REVISION_REPORT.md) |
| Everything | [docs/README.md](docs/README.md) |

## Regulatory honesty

Where a CPNS-2026 SKD instrument is **not** verified, tryouts still run on a `provisional` config
labelled **Belum Terverifikasi**. The score is always produced; a passing verdict is shown only when the
user has approved a threshold set, and the app never presents a provisional or historical basis as
official 2026. See [docs/examination/CPNS_2026_REGULATIONS.md](docs/examination/CPNS_2026_REGULATIONS.md) §4.

## Next step

Read [docs/audit/SYSTEM_REVISION_REPORT.md](docs/audit/SYSTEM_REVISION_REPORT.md) and
[docs/roadmap/DEVELOPMENT_ROADMAP.md](docs/roadmap/DEVELOPMENT_ROADMAP.md), then approve or amend the
re-baselined documentation set. Nothing builds until then.
