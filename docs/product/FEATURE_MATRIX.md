# Feature Matrix

Canonical mapping of **feature → the requirement(s) it satisfies → the doc that owns it**. Requirement
IDs are from [PRD.md](./PRD.md) §9 and are not redefined here.

| Area | Feature | FR | Primary docs | Phase |
|---|---|---|---|---|
| Beranda | Latest session + per-test scores | FR-D1 | [PRD](./PRD.md) §9.1, [FRONTEND_PAGE_SPECIFICATIONS](../frontend/FRONTEND_PAGE_SPECIFICATIONS.md) | Frontend (mock) |
| Beranda | Submateri metrics (reportable only) | FR-D2 | [ANALYTICS_ENGINE](../backend/ANALYTICS_ENGINE.md) §3 | Frontend + backend |
| Beranda | Top-3 weaknesses with evidence | FR-D3 | [RECOMMENDATION_ENGINE](../ai/RECOMMENDATION_ENGINE.md) §2–3 | Frontend + backend |
| Beranda | Recent history — **no config badge** | FR-D4 | [FRONTEND_INFORMATION_ARCHITECTURE](../frontend/FRONTEND_INFORMATION_ARCHITECTURE.md) §4 | Frontend |
| Beranda | Learner pending actions (no config status) | FR-D5 | [PRD](./PRD.md) §9.1, [NOTIFICATION_SPECIFICATION](../backend/NOTIFICATION_SPECIFICATION.md) | Frontend + backend |
| Beranda | Start entry points + resume open session | FR-D6 | [USER_JOURNEYS](./USER_JOURNEYS.md) J-1, J-3 | Frontend |
| Tryout | Package start, config bound server-side | FR-T1 | [PACKAGE_SPECIFICATION](./PACKAGE_SPECIFICATION.md) §2–§3 | Frontend + backend |
| Tryout | Accumulated-active-time countdown, expiry on resume | FR-T2 | [SCORING_METHODOLOGY](../examination/SCORING_METHODOLOGY.md) §8.1 | Frontend + backend |
| Tryout | Navigate + flag | FR-T3 | [PRD](./PRD.md) §9.2 | Frontend |
| Tryout | Autosave with clock / resume anytime | FR-T4 | [API_SPECIFICATION](../backend/API_SPECIFICATION.md) §7.5 | Frontend + backend |
| Tryout | Submit; blanks confirmation | FR-T5 | [FRONTEND_EXAM_FLOW](../frontend/FRONTEND_EXAM_FLOW.md) §7 | Frontend |
| Tryout | Result after end; explanations withheld until end | FR-T6 | [FRONTEND_EXAM_FLOW](../frontend/FRONTEND_EXAM_FLOW.md) §8–§9; [FRONTEND_RESULTS_ANALYTICS](../frontend/FRONTEND_RESULTS_ANALYTICS.md) §2.2 | Frontend + backend |
| Tryout | No verdict without approval; no fabricated pass/fail | FR-T7 | [SCORING_METHODOLOGY](../examination/SCORING_METHODOLOGY.md) §5.6 | Frontend + backend |
| Tryout | Blank never correct | FR-T8 | [SCORING_METHODOLOGY](../examination/SCORING_METHODOLOGY.md) §3.3 | Backend |
| Latihan | Submateri picker with stock | FR-P1 | [PACKAGE_SPECIFICATION](./PACKAGE_SPECIFICATION.md) §6 | Frontend + backend |
| Latihan | Untimed default, same clock rule | FR-P2 | [SCORING_METHODOLOGY](../examination/SCORING_METHODOLOGY.md) §8.1 | Frontend |
| Latihan | Same runner as Tryout | FR-P3 | [FRONTEND_EXAM_FLOW](../frontend/FRONTEND_EXAM_FLOW.md) | Frontend |
| Latihan | Feedback after every answer, TKP per-option weights | FR-P4 | [FRONTEND_EXAM_FLOW](../frontend/FRONTEND_EXAM_FLOW.md) §9, [QUESTION_SPECIFICATION](../examination/QUESTION_SPECIFICATION.md) §5 V-10 | Frontend + backend |
| Latihan | Deliberate repeats, stated first | FR-P5 | [PACKAGE_SPECIFICATION](./PACKAGE_SPECIFICATION.md) §4.4 | Backend |
| Progres | Per-test/submateri accuracy + attainment + MRT | FR-A1 | [ANALYTICS_ENGINE](../backend/ANALYTICS_ENGINE.md) §2–§4 | Backend |
| Progres | Trend + minimum sample | FR-A2 | [ANALYTICS_ENGINE](../backend/ANALYTICS_ENGINE.md) §5 | Backend |
| Progres | Difficulty analysis, two fields | FR-A3 | [ANALYTICS_ENGINE](../backend/ANALYTICS_ENGINE.md) §4.1 | Backend |
| Progres | Zero vs insufficient | FR-A4 | [ANALYTICS_ENGINE](../backend/ANALYTICS_ENGINE.md) §3.2 | Backend |
| Progres | Comparability across config versions | FR-A5 | [ANALYTICS_ENGINE](../backend/ANALYTICS_ENGINE.md) §5, [API_SPECIFICATION](../backend/API_SPECIFICATION.md) §6.2 | Frontend + backend |
| Progres | Consistency + coverage | FR-A6 | [ANALYTICS_ENGINE](../backend/ANALYTICS_ENGINE.md) §4.2–§4.3 | Backend |
| Progres | No strong conclusion from small samples | FR-A7 | [ANALYTICS_ENGINE](../backend/ANALYTICS_ENGINE.md) §3.4 | Frontend + backend |
| Progres | History deletion + stated consequences | FR-A8 | [ANALYTICS_ENGINE](../backend/ANALYTICS_ENGINE.md) §7 | Frontend + backend |
| Generation | N questions for a competency set (job) | FR-G1 | [QUESTION_GENERATION](../ai/QUESTION_GENERATION.md), [GENERATION_JOBS](../backend/GENERATION_JOBS.md) | Backend + AI |
| Generation | Progress + retry (no pause, resume or cancel) | FR-G2 | [GENERATION_JOBS](../backend/GENERATION_JOBS.md) §2 | Frontend + backend |
| Generation | Layered validation T→Q→K→S | FR-G3 | [QUESTION_SPECIFICATION](../examination/QUESTION_SPECIFICATION.md) §5, [AI_VALIDATION](../ai/AI_VALIDATION.md) | Backend |
| Generation | Review screen (accept/edit/reject) | FR-G4 | [QUESTION_GENERATION](../ai/QUESTION_GENERATION.md) §4 | Frontend |
| Generation | Provenance record | FR-G5 | [QUESTION_SPECIFICATION](../examination/QUESTION_SPECIFICATION.md) §2 | Backend |
| Generation | Failure category + retry, no fallback | FR-G6 | [AI_PROVIDER_ARCHITECTURE](../ai/AI_PROVIDER_ARCHITECTURE.md) §7 | Frontend + backend |
| Generation | Sampling gate, quarantine, selective repair (sampling **quota unresolved**) | FR-G7 | [QUESTION_SPECIFICATION](../examination/QUESTION_SPECIFICATION.md) §6 | Frontend + backend |
| Generation | Server-owned, survives browser close | FR-G8 | [GENERATION_JOBS](../backend/GENERATION_JOBS.md) §1, §5 | Backend |
| Question bank | Text search + filters (no saved filters) | FR-Q1 | [QUESTION_SPECIFICATION](../examination/QUESTION_SPECIFICATION.md) §8.1 | Frontend + backend |
| Question bank | Row detail: layers, sampling, versions, usage | FR-Q2 | [QUESTION_SPECIFICATION](../examination/QUESTION_SPECIFICATION.md) §4, §7 | Frontend |
| Question bank | Lifecycle transitions | FR-Q3 | [QUESTION_SPECIFICATION](../examination/QUESTION_SPECIFICATION.md) §3 | Frontend + backend |
| Question bank | Bulk archive only | FR-Q4 | [QUESTION_SPECIFICATION](../examination/QUESTION_SPECIFICATION.md) §3.2, [API_ENDPOINTS](../backend/API_ENDPOINTS.md) §6, [VALIDATION](../backend/VALIDATION.md) l.57 | Backend |
| Question bank | Duplicate clusters | FR-Q5 | [QUESTION_SPECIFICATION](../examination/QUESTION_SPECIFICATION.md) §5 V-08/09 | Backend |
| Question bank | Manual one-by-one creation, no import | FR-Q6 | [QUESTION_SPECIFICATION](../examination/QUESTION_SPECIFICATION.md) §6.1 | Frontend + backend |
| Question bank | Report → triage → quarantine | FR-Q7 | [QUESTION_SPECIFICATION](../examination/QUESTION_SPECIFICATION.md) §6.5 | Frontend + backend |
| Question bank | Versions, frozen sessions, re-activation gate | FR-Q8 | [QUESTION_SPECIFICATION](../examination/QUESTION_SPECIFICATION.md) §6.4, §7 | Backend |
| Personalised | Deterministic weakness set | FR-L1 | [RECOMMENDATION_ENGINE](../ai/RECOMMENDATION_ENGINE.md) §2 | Backend |
| Personalised | Numeric justification | FR-L2 | [RECOMMENDATION_ENGINE](../ai/RECOMMENDATION_ENGINE.md) §3 | Frontend + backend |
| Personalised | Approved material per weakness | FR-L3 | [RECOMMENDATION_ENGINE](../ai/RECOMMENDATION_ENGINE.md) §4, [MATERIAL_SPECIFICATION](../examination/MATERIAL_SPECIFICATION.md) | Backend + AI |
| Personalised | Targeted drill | FR-L4 | [RECOMMENDATION_ENGINE](../ai/RECOMMENDATION_ENGINE.md) §5 | Frontend + backend |
| Personalised | Ordered learning sequence, rendered inline (no standalone plan) | FR-L5–6 | [RECOMMENDATION_ENGINE](../ai/RECOMMENDATION_ENGINE.md) §7 | Frontend + backend |
| Personalised | AI orders/explains only | FR-L7 | [RECOMMENDATION_ENGINE](../ai/RECOMMENDATION_ENGINE.md) §2.1, §6 | Backend + AI |
| Materi | Manual or AI draft | FR-M1 | [MATERIAL_SPECIFICATION](../examination/MATERIAL_SPECIFICATION.md) §3 | Frontend + AI |
| Materi | Draft → approve per version, history | FR-M2 | [MATERIAL_SPECIFICATION](../examination/MATERIAL_SPECIFICATION.md) §5 | Frontend + backend |
| Materi | Taxonomy-bound vs free note (inert) | FR-M3 | [MATERIAL_SPECIFICATION](../examination/MATERIAL_SPECIFICATION.md) §2 | Backend |
| Materi | Sources for factual/legal/etc. | FR-M4 | [MATERIAL_SPECIFICATION](../examination/MATERIAL_SPECIFICATION.md) §4 | Frontend + backend |
| Materi | Unverified source labelled | FR-M5 | [MATERIAL_SPECIFICATION](../examination/MATERIAL_SPECIFICATION.md) §4 | Frontend |
| AI config | Provider CRUD + presets | FR-C1 | [AI_PROVIDER_ARCHITECTURE](../ai/AI_PROVIDER_ARCHITECTURE.md) §3 | Backend |
| AI config | Connection test before use | FR-C2 | [AI_PROVIDER_ARCHITECTURE](../ai/AI_PROVIDER_ARCHITECTURE.md) §5 | Backend |
| AI config | Model list + manual Model ID | FR-C3 | [AI_PROVIDER_ARCHITECTURE](../ai/AI_PROVIDER_ARCHITECTURE.md) §5 | Backend |
| AI config | Global default + per-feature overrides | FR-C4 | [AI_PROVIDER_ARCHITECTURE](../ai/AI_PROVIDER_ARCHITECTURE.md) §4 | Backend |
| AI config | Capabilities auto + manual | FR-C5 | [AI_PROVIDER_ARCHITECTURE](../ai/AI_PROVIDER_ARCHITECTURE.md) §6 | Backend |
| AI config | Write-only key in OS secure storage | FR-C6 | [SECRETS](../backend/SECRETS.md) §2 | Backend |
| AI config | Non-AI works w/o provider | FR-C7 | [AI_PROVIDER_ARCHITECTURE](../ai/AI_PROVIDER_ARCHITECTURE.md) §1 | All |
| AI config | No fallback, no token/cost | FR-C8 | [AI_PROVIDER_ARCHITECTURE](../ai/AI_PROVIDER_ARCHITECTURE.md) §7, §9 | Backend |
| Exam config | List configs + state (Kelola only) | FR-E1 | [CPNS_2026_REGULATIONS](../examination/CPNS_2026_REGULATIONS.md) §4.4 | Frontend + backend |
| Exam config | `Belum Terverifikasi` notice | FR-E2 | [CPNS_2026_REGULATIONS](../examination/CPNS_2026_REGULATIONS.md) §4.2 | Frontend |
| Exam config | Four-value approval | FR-E3 | [CPNS_2026_REGULATIONS](../examination/CPNS_2026_REGULATIONS.md) §4.3 | Frontend + backend |
| Exam config | Invalidation withholds verdict only | FR-E4 | [SCORING_METHODOLOGY](../examination/SCORING_METHODOLOGY.md) §11 | Backend |
| Exam config | Temporary config, proposed values, no invention | FR-E5 | [CPNS_2026_REGULATIONS](../examination/CPNS_2026_REGULATIONS.md) §4.2 | Frontend + backend |
| Exam config | Regulation change → new version, old kept | FR-E6 | [CPNS_2026_REGULATIONS](../examination/CPNS_2026_REGULATIONS.md) §4.4, §8 | Backend |
| Packages | Built-in tryout packages (full + three subtests) | FR-K1 | [PACKAGE_SPECIFICATION](./PACKAGE_SPECIFICATION.md) §2 | Frontend + backend |
| Packages | Latihan units = submateri | FR-K2 | [PACKAGE_SPECIFICATION](./PACKAGE_SPECIFICATION.md) §6 | Frontend + backend |
| Packages | Custom package from template, immutable versions | FR-K3 | [PACKAGE_SPECIFICATION](./PACKAGE_SPECIFICATION.md) §5 | Frontend + backend |
| Packages | avoid answered, warn on repeat | FR-K4 | [PACKAGE_SPECIFICATION](./PACKAGE_SPECIFICATION.md) §4 | Backend |
| Data | Verified backup, failure never success | FR-H1 | [DEPLOYMENT_AND_BACKUP](../architecture/DEPLOYMENT_AND_BACKUP.md) §2.2 | Backend |
| Data | Retention policy | FR-H2 | [DEPLOYMENT_AND_BACKUP](../architecture/DEPLOYMENT_AND_BACKUP.md) §2.3 | Backend |
| Data | Restore / cross-device wizard | FR-H3 | [DEPLOYMENT_AND_BACKUP](../architecture/DEPLOYMENT_AND_BACKUP.md) §3 | Frontend + backend |
| Data | History deletion with consequences | FR-H4 | [ANALYTICS_ENGINE](../backend/ANALYTICS_ENGINE.md) §7.4 | Frontend + backend |
| Notifications | In-app centre, seven event groups | FR-N1 | [NOTIFICATION_SPECIFICATION](../backend/NOTIFICATION_SPECIFICATION.md) §2 | Frontend + backend |
| Notifications | No OS notifications | FR-N2 | [NOTIFICATION_SPECIFICATION](../backend/NOTIFICATION_SPECIFICATION.md) §1 | Frontend |
| Notifications | Job statuses incl. `interrupted`, safe restart | FR-N3 | [GENERATION_JOBS](../backend/GENERATION_JOBS.md) §2, §5 | Backend |

This matrix is read-only regarding requirement text; it maps, it does not add.

Out of scope features are fixed in [MVP_SCOPE.md](./MVP_SCOPE.md) §2.
