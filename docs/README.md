# TryoutSim — Documentation

Master index of all planning docs. **Product scope: CPNS SKD only** — no other recruitment pathway is
served. Canonical-doc rule: each subject is owned by one file; the rest point here (no duplication).

## Examination

- [CPNS_2026_REGULATIONS.md](examination/CPNS_2026_REGULATIONS.md) — evidence record, ExamConfig states, `Belum Terverifikasi`, provisional approval, shipped configs, historical retention
- [COMPETENCY_TAXONOMY.md](examination/COMPETENCY_TAXONOMY.md) — TWK/TIU/TKP taxonomy, evidence tiers
- [QUESTION_SPECIFICATION.md](examination/QUESTION_SPECIFICATION.md) — question model, two difficulty fields, lifecycle, layers T/Q/K/S, sampling, versions, bank filters
- [MATERIAL_SPECIFICATION.md](examination/MATERIAL_SPECIFICATION.md) — Materi model, scope, sources, approval per version
- [SCORING_METHODOLOGY.md](examination/SCORING_METHODOLOGY.md) — canonical scoring, preflight, snapshots, active-time clock, score vs verdict, history deletion

## Product

- [PRD.md](product/PRD.md) — requirements (§9 FR, §10 NFR, §12 MVP)
- [PACKAGE_SPECIFICATION.md](product/PACKAGE_SPECIFICATION.md) — tryout/subtest/Latihan packages, roster assembly, repeats, custom package versions
- [USER_STORIES.md](product/USER_STORIES.md)
- [USER_JOURNEYS.md](product/USER_JOURNEYS.md)
- [FEATURE_MATRIX.md](product/FEATURE_MATRIX.md) — FR → doc mapping
- [MVP_SCOPE.md](product/MVP_SCOPE.md) — in-scope / cut lines

## Backend

- [API_SPECIFICATION.md](backend/API_SPECIFICATION.md) — envelope + error registry
- [API_ENDPOINTS.md](backend/API_ENDPOINTS.md) — path/method/status tables
- [DATABASE_SCHEMA.md](backend/DATABASE_SCHEMA.md) / [ERD.md](backend/ERD.md)
- [BUSINESS_RULES.md](backend/BUSINESS_RULES.md) / [VALIDATION.md](backend/VALIDATION.md)
- [SECURITY.md](architecture/SECURITY.md) / [AUTHENTICATION.md](backend/AUTHENTICATION.md) / [SECRETS.md](backend/SECRETS.md)
- [ERROR_HANDLING.md](backend/ERROR_HANDLING.md) / [MIGRATION_STRATEGY.md](backend/MIGRATION_STRATEGY.md) / [SCHEMA_CONTRACT_REVIEW.md](backend/SCHEMA_CONTRACT_REVIEW.md)
- [ANALYTICS_ENGINE.md](backend/ANALYTICS_ENGINE.md)
- [GENERATION_JOBS.md](backend/GENERATION_JOBS.md) / [PROVIDER_INTEGRATION.md](backend/PROVIDER_INTEGRATION.md) / [RECOMMENDATION_SERVICE.md](backend/RECOMMENDATION_SERVICE.md)
- [NOTIFICATION_SPECIFICATION.md](backend/NOTIFICATION_SPECIFICATION.md) — in-app notification centre

## Frontend

- [FRONTEND_PRD.md](frontend/FRONTEND_PRD.md)
- [FRONTEND_INFORMATION_ARCHITECTURE.md](frontend/FRONTEND_INFORMATION_ARCHITECTURE.md) — Belajar / Kelola, five-item dock, seven Kelola items
- [FRONTEND_PAGE_SPECIFICATIONS.md](frontend/FRONTEND_PAGE_SPECIFICATIONS.md)
- [DESIGN_SYSTEM.md](frontend/DESIGN_SYSTEM.md)
- [FRONTEND_COMPONENT_ARCHITECTURE.md](frontend/FRONTEND_COMPONENT_ARCHITECTURE.md)
- [FRONTEND_STATE_MANAGEMENT.md](frontend/FRONTEND_STATE_MANAGEMENT.md)
- [FRONTEND_DATA_CONTRACTS.md](frontend/FRONTEND_DATA_CONTRACTS.md)
- [FRONTEND_ROUTING.md](frontend/FRONTEND_ROUTING.md)
- [FRONTEND_ACCESSIBILITY.md](frontend/FRONTEND_ACCESSIBILITY.md)
- [FRONTEND_IMPLEMENTATION_PLAN.md](frontend/FRONTEND_IMPLEMENTATION_PLAN.md)
- [FRONTEND_MOCK_DATA_STRATEGY.md](frontend/FRONTEND_MOCK_DATA_STRATEGY.md)
- [FRONTEND_EXAM_FLOW.md](frontend/FRONTEND_EXAM_FLOW.md) — runner, active-time clock, Latihan feedback
- [FRONTEND_RESULTS_ANALYTICS.md](frontend/FRONTEND_RESULTS_ANALYTICS.md)
- [FRONTEND_API_MAPPING.md](frontend/FRONTEND_API_MAPPING.md)
- [FRONTEND_GAP_REGISTER.md](frontend/FRONTEND_GAP_REGISTER.md)

## AI

- [AI_PROVIDER_ARCHITECTURE.md](ai/AI_PROVIDER_ARCHITECTURE.md) — presets, global default + overrides, capabilities, no fallback
- [PROMPT_SPECIFICATION.md](ai/PROMPT_SPECIFICATION.md)
- [QUESTION_GENERATION.md](ai/QUESTION_GENERATION.md)
- [AI_VALIDATION.md](ai/AI_VALIDATION.md)
- [RECOMMENDATION_ENGINE.md](ai/RECOMMENDATION_ENGINE.md)

## Architecture / decisions / roadmap

- [SYSTEM_ARCHITECTURE.md](architecture/SYSTEM_ARCHITECTURE.md)
- [DATA_FLOW.md](architecture/DATA_FLOW.md)
- [SECURITY.md](architecture/SECURITY.md)
- [DEPLOYMENT_AND_BACKUP.md](architecture/DEPLOYMENT_AND_BACKUP.md) — launcher, localhost-only posture, backup, retention, restore, keys
- [ARCHITECTURE_DECISIONS.md](architecture/ARCHITECTURE_DECISIONS.md) (+ [decisions/](decisions/README.md))
- [INSTALLED_SKILLS.md](architecture/INSTALLED_SKILLS.md)
- [DEVELOPMENT_ROADMAP.md](roadmap/DEVELOPMENT_ROADMAP.md) / [RISK_REGISTER.md](roadmap/RISK_REGISTER.md)
- [COORDINATION_SPEC.md](roadmap/COORDINATION_SPEC.md) — team coordination: transport, Task Board, Handoff Ledger, failure handling (PROPOSAL)

## Meta

- [AUDIT.md](AUDIT.md) — findings register + checks performed
- [audit/SYSTEM_REVISION_REPORT.md](audit/SYSTEM_REVISION_REPORT.md) — decisions A–K revision report
  (audit matrix, contradictions, open questions)
- [audit/AUDIT_FINDINGS_RESOLUTION.md](audit/AUDIT_FINDINGS_RESOLUTION.md)
- [audit/INDEPENDENT_DOCUMENTATION_AUDIT.md](audit/INDEPENDENT_DOCUMENTATION_AUDIT.md)
- [audit/POST_REPAIR_INTEGRITY_AUDIT.md](audit/POST_REPAIR_INTEGRITY_AUDIT.md) — post-revision integrity
  audit (PR-01…PR-22)
- [audit/POST_REPAIR_REPAIR_REPORT.md](audit/POST_REPAIR_REPAIR_REPORT.md) — repair applied, before → after
- [audit/FINAL_DOCUMENTATION_INTEGRITY_AUDIT.md](audit/FINAL_DOCUMENTATION_INTEGRITY_AUDIT.md) — final
  verification and verdict
