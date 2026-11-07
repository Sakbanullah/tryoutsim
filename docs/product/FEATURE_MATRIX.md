# Feature Matrix

Canonical mapping of **feature → the requirement(s) it satisfies → the doc that owns it**. Requirement
IDs are from [PRD.md](./PRD.md) §8 and are not redefined here.

| Feature area | Feature | FR | Primary docs | Phase |
|---|---|---|---|---|
| Dashboard | Latest session + accuracy + per-test | FR-D1 | [PRD](./PRD.md) §8.1, [FRONTEND_PAGE_SPECIFICATIONS](../frontend/FRONTEND_PAGE_SPECIFICATIONS.md) | Frontend (mock) |
| Dashboard | Competency accuracy ≥5 answered | FR-D2 | [ANALYTICS_ENGINE](../backend/ANALYTICS_ENGINE.md) §3 | Frontend + backend |
| Dashboard | Top-3 weaknesses with evidence | FR-D3 | [RECOMMENDATION_ENGINE](../ai/RECOMMENDATION_ENGINE.md) §2–3 | Frontend + backend |
| Dashboard | Recent history + config badge | FR-D4 | [PRD](./PRD.md) §8.1 | Frontend |
| Dashboard | Pending actions | FR-D5 | [PRD](./PRD.md) §8.1 | Frontend |
| Try Out | Config notice before start | FR-T1 | [PRD](./PRD.md) §8.2, [USER_JOURNEYS](./USER_JOURNEYS.md) J-3 | Frontend |
| Try Out | Deadline timer / auto-submit | FR-T2 | [PRD](./PRD.md) §8.2 | Frontend (timer) + backend (deadline) |
| Try Out | Navigate + flag | FR-T3 | [PRD](./PRD.md) §8.2 | Frontend |
| Try Out | Autosave / resume | FR-T4 | [PRD](./PRD.md) §8.2, [API_SPECIFICATION](../backend/API_SPECIFICATION.md) | Frontend + backend |
| Try Out | Submit confirm w/ unanswered count | FR-T5 | [PRD](./PRD.md) §8.2 | Frontend |
| Try Out | Immediate score, hide answers | FR-T6 | [SCORING_METHODOLOGY](../examination/SCORING_METHODOLOGY.md) | Frontend + backend |
| Try Out | Blocked scoring → unscored | FR-T7 | [SCORING_METHODOLOGY](../examination/SCORING_METHODOLOGY.md) §11 | Frontend + backend |
| Practice | Any competency level + difficulty | FR-P1 | [PRD](./PRD.md) §8.3 | Frontend + backend |
| Practice | Untimed default, soft timer | FR-P2 | [PRD](./PRD.md) §8.3 | Frontend |
| Practice | Same runner as try out | FR-P3 | [PRD](./PRD.md) §8.3 | Frontend |
| Practice | Inline explanation after answer | FR-P4 | [PRD](./PRD.md) §8.3 | Frontend |
| Generation | N questions for competency | FR-G1 | [QUESTION_GENERATION](../ai/QUESTION_GENERATION.md) | Backend + AI |
| Generation | Progress + cancel | FR-G2 | [QUESTION_GENERATION](../ai/QUESTION_GENERATION.md) §4 | Frontend + backend |
| Generation | Full validation routing | FR-G3 | [QUESTION_GENERATION](../ai/QUESTION_GENERATION.md) §3 | Backend |
| Generation | Review screen (accept/edit/reject) | FR-G4 | [QUESTION_GENERATION](../ai/QUESTION_GENERATION.md) §1 | Frontend |
| Generation | Provenance record | FR-G5 | [QUESTION_SPECIFICATION](../examination/QUESTION_SPECIFICATION.md) §2 | Backend |
| Generation | Failure category + retry | FR-G6 | [QUESTION_GENERATION](../ai/QUESTION_GENERATION.md) §5 | Frontend + backend |
| Analytics | Per-test/competency accuracy + MRT | FR-A1 | [ANALYTICS_ENGINE](../backend/ANALYTICS_ENGINE.md) §2–4 | Backend |
| Analytics | Trend + min sample | FR-A2 | [ANALYTICS_ENGINE](../backend/ANALYTICS_ENGINE.md) §5 | Backend |
| Analytics | Difficulty analysis | FR-A3 | [ANALYTICS_ENGINE](../backend/ANALYTICS_ENGINE.md) §4 | Backend |
| Analytics | Zero vs insufficient | FR-A4 | [ANALYTICS_ENGINE](../backend/ANALYTICS_ENGINE.md) §3.2 | Backend |
| Analytics | Config comparability | FR-A5 | [ANALYTICS_ENGINE](../backend/ANALYTICS_ENGINE.md) §5 | Frontend + backend |
| Personalised | Weakness rule set | FR-L1 | [RECOMMENDATION_ENGINE](../ai/RECOMMENDATION_ENGINE.md) §2 | Backend |
| Personalised | Numeric justification | FR-L2 | [RECOMMENDATION_ENGINE](../ai/RECOMMENDATION_ENGINE.md) §3 | Frontend + backend |
| Personalised | Material per weakness | FR-L3 | [RECOMMENDATION_ENGINE](../ai/RECOMMENDATION_ENGINE.md) §4 | Backend + AI |
| Personalised | One-click drill | FR-L4 | [RECOMMENDATION_ENGINE](../ai/RECOMMENDATION_ENGINE.md) §5 | Frontend + backend |
| Personalised | Editable plan | FR-L5–6 | [RECOMMENDATION_ENGINE](../ai/RECOMMENDATION_ENGINE.md) §6 | Frontend + backend |
| Question bank | List/filter | FR-Q1 | [QUESTION_SPECIFICATION](../examination/QUESTION_SPECIFICATION.md) §7 | Frontend + backend |
| Question bank | Row detail validations | FR-Q2 | [QUESTION_SPECIFICATION](../examination/QUESTION_SPECIFICATION.md) §5 | Frontend |
| Question bank | Lifecycle transitions | FR-Q3 | [QUESTION_SPECIFICATION](../examination/QUESTION_SPECIFICATION.md) §3 | Frontend + backend |
| Question bank | Bulk archive/activate | FR-Q4 | [QUESTION_SPECIFICATION](../examination/QUESTION_SPECIFICATION.md) §3 | Backend |
| Question bank | Duplicate clusters | FR-Q5 | [QUESTION_SPECIFICATION](../examination/QUESTION_SPECIFICATION.md) §5 V-08/09 | Backend |
| AI config | Provider CRUD | FR-C1 | [AI_PROVIDER_ARCHITECTURE](../ai/AI_PROVIDER_ARCHITECTURE.md) §3 | Backend |
| AI config | Connection test | FR-C2 | [AI_PROVIDER_ARCHITECTURE](../ai/AI_PROVIDER_ARCHITECTURE.md) §2 | Backend |
| AI config | List/enter models | FR-C3 | [AI_PROVIDER_ARCHITECTURE](../ai/AI_PROVIDER_ARCHITECTURE.md) §2 | Backend |
| AI config | Task→model map | FR-C4 | [AI_PROVIDER_ARCHITECTURE](../ai/AI_PROVIDER_ARCHITECTURE.md) §4 | Backend |
| AI config | Capability flags | FR-C5 | [AI_PROVIDER_ARCHITECTURE](../ai/AI_PROVIDER_ARCHITECTURE.md) §5 | Backend |
| AI config | Write-only key | FR-C6 | [SECURITY](../architecture/SECURITY.md) §3 | Backend |
| AI config | Non-AI works w/o provider | FR-C7 | [AI_PROVIDER_ARCHITECTURE](../ai/AI_PROVIDER_ARCHITECTURE.md) §4 | All |
| Exam config | List configs + state | FR-E1 | [CPNS_2026_REGULATIONS](../examination/CPNS_2026_REGULATIONS.md) §4 | Frontend + backend |
| Exam config | Basis + notice display | FR-E2 | [CPNS_2026_REGULATIONS](../examination/CPNS_2026_REGULATIONS.md) §4.3 | Frontend |
| Exam config | Four-value approval | FR-E3 | [CPNS_2026_REGULATIONS](../examination/CPNS_2026_REGULATIONS.md) §4.3 | Frontend + backend |
| Exam config | Auto-invalidate | FR-E4 | [SCORING_METHODOLOGY](../examination/SCORING_METHODOLOGY.md) §11 | Backend |

This matrix is read-only regarding requirement text; it maps, it does not add.

Out of scope features are fixed in [MVP_SCOPE.md](./MVP_SCOPE.md).