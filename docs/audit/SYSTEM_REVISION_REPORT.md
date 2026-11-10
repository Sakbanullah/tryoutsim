# System Revision Report — CPNS-only product redefinition

Status: **complete — awaiting Product Owner approval** (Phases 1–4 written in this file).
Date: 2026-11-08 · Owner: user (Sakbanullah)
Scope: documentation only. No backend/frontend source, dependency, test, build, or Git operation was
performed by this revision.

---

## 1. Phase 1 — audit (decision → document → conflict → action)

Legend for **Class**: `DOC` = documents contradict the decision · `MISSING` = the decision has no
documented home yet · `IMPL` = the Gate-2 frontend implements the old behaviour (code is **out of
scope** for this revision; recorded only) · `ALIGNED` = already correct, no change needed.

### A. Scope = CPNS only

| # | Decision | Documents / sections in conflict | Class | Action |
|---|---|---|---|---|
| A1 | Sekolah Kedinasan is not a product pathway | `CPNS_2026_REGULATIONS.md` §2.3(b), §4.1–§4.4 (pathway enum, `skd-sekolah-kedinasan-2026`), §8.5; `COMPETENCY_TAXONOMY.md` §1–§6 (tier `VERIFIED-2026-SEKOLAH-KEDINASAN` on every node); `SCORING_METHODOLOGY.md` §3.2 evidence table, §5.4, §6.7, §7 snapshot `pathway`; `BUSINESS_RULES.md` BR-E1; `DATABASE_SCHEMA.md` `exam_config.pathway`; `FRONTEND_DATA_CONTRACTS.md` §3 (`pathway`, `EvidenceTier`, `basisPathway`); `FRONTEND_INFORMATION_ARCHITECTURE.md` §6; `FRONTEND_PAGE_SPECIFICATIONS.md` §2–§3; `FRONTEND_MOCK_DATA_STRATEGY.md` §3; `DESIGN_SYSTEM.md` §5; `MVP_SCOPE.md` §3; `RISK_REGISTER.md` R-6 | DOC | Product scope limited to CPNS; the Sekolah Kedinasan **capability** is removed from product surfaces while the **evidence record** and the **anti-laundering guard** (PF-12, BR-E1) stay, because removing them would let a non-CPNS instrument be cited as CPNS authority — an `AGENTS.md` non-negotiable. |
| A2 | Historical data / migrations must not be deleted | `DATABASE_SCHEMA.md`, `MIGRATION_STRATEGY.md` — no mechanism for a pathway that is no longer offered | MISSING | New rule: shipped configs and recorded sessions are never deleted; the `SEKOLAH_KEDINASAN` storage value becomes *legacy, not offered*, retained for replay only. |
| A3 | Taxonomy must not claim CPNS-2026 verification | `COMPETENCY_TAXONOMY.md` §1: node tier is `VERIFIED-2026-SEKOLAH-KEDINASAN` | DOC | Node tier becomes `EVIDENCE-BACKED-NOT-CPNS-2026` (renamed so no product surface can read it as a CPNS claim). IDs unchanged (historical records depend on them). |
| A4 | Frontend implements the old pathway | `frontend/src/mock/configs.ts` (`kedinasan406`), `examRoster.ts`, `TierBadge`, `PathwayBadge`, `TryoutList`, `TryoutDetail` | IMPL | **Not changed in this revision** (no code permitted). Listed in §6 as the first frontend fix when implementation reopens. |

### B. Navigation — Belajar / Kelola

| # | Decision | Documents / sections | Class | Action |
|---|---|---|---|---|
| B1 | Main nav = Beranda, Tryout, Latihan, Progres, Lainnya | `FRONTEND_INFORMATION_ARCHITECTURE.md` §2 | ALIGNED | Unchanged. |
| B2 | Kelola = Bank Soal, Review Soal, Materi, Generasi AI, Pengaturan AI, Konfigurasi Ujian, Manajemen Paket | IA §4 (six items; no *Review Soal*, no *Materi*, no *Manajemen Paket*) | DOC | IA §4 rebuilt to the seven items, each with its owning doc. |
| B3 | No config status / config choice on Beranda | `PRD.md` FR-D4/F-D5, §8.2 FR-T1; `FRONTEND_PAGE_SPECIFICATIONS.md` §1, §3; `FRONTEND_ROUTING.md` §1 (`/tryout/:configId`); `FRONTEND_PRD.md` §4; `DESIGN_SYSTEM.md` §5 usage | DOC | Beranda shows no config information; the learner never picks a config to start; the config is resolved server-side from the package (H1/H2). |
| B4 | No config information on Progres | `FRONTEND_RESULTS_ANALYTICS.md` §6 block 1 | DOC | Progres keeps the **comparability warning** (a correctness statement about mixed rule versions) but no config selector or config badge. Deviation recorded as an open question (§8 Q-2). |
| B5 | Config managed only in Kelola | `PRD.md` FR-E1…FR-E4; `FRONTEND_PAGE_SPECIFICATIONS.md` §14 | ALIGNED | Stays in Kelola. |
| B6 | "Lainnya" no longer contains learning items | IA §4 (`Rencana belajar` under Belajar) | DOC | The study-plan screen is not in the approved navigation and is **out of MVP**; see §12.3 (Q-1 resolved). |

### C. Packages (tryout + latihan)

| # | Decision | Documents / sections | Class | Action |
|---|---|---|---|---|
| C1 | Tryout = Simulasi SKD Lengkap + per-subtest (TWK, TIU, TKP) | Nothing describes a *package*; `PRD.md` FR-T1 starts from a **config** | MISSING | New canonical doc `docs/product/PACKAGE_SPECIFICATION.md`. |
| C2 | Latihan = per-submateri | `PRD.md` FR-P1 (any competency level), `FRONTEND_PAGE_SPECIFICATIONS.md` §7 (three subject cards), `FRONTEND_GAP_REGISTER.md` GAP-F8 | DOC | Latihan picker lists submateri (taxonomy leaves) + curated latihan packages + weakness drills. GAP-F8 is closed by the new package/drill endpoints. |
| C3 | Built-in curated + dynamic from eligible stock | Nothing | MISSING | Package spec §2–§4. |
| C4 | Custom packages from a template, versioned; a change = new version | Nothing | MISSING | Package spec §5. |
| C5 | Started session pinned to the package version at creation | `SCORING_METHODOLOGY.md` §7 freezes questions/config but knows no package | DOC | `SessionSnapshot.packageBinding` added (package id + version + roster). |
| C6 | Avoid previously answered questions while stock suffices; warn before repeats; Latihan may repeat | `QUESTION_SPECIFICATION.md` §7 selection rules (no history term) | DOC | Selection rules extended in the package spec §4; question spec §7 points to it. |
| C7 | Roster assembly | `FRONTEND_GAP_REGISTER.md` U-F11, GAP-F8; `FRONTEND_EXAM_FLOW.md` §2 | MISSING | Closed by `POST /packages/:id/sessions` (roster assembled server-side). |

### D. Exam flow

| # | Decision | Documents / sections | Class | Action |
|---|---|---|---|---|
| D1 | Countdown exists; timer pauses on leave and resumes on return; duration = accumulated **active** time | `PRD.md` FR-T2/NFR-3 (deadline), `SCORING_METHODOLOGY.md` §8 (auto-submit at deadline), `USER_STORIES.md` US-T2, `FRONTEND_EXAM_FLOW.md` §6 ("no timer"), `FRONTEND_GAP_REGISTER.md` U-F1/GAP-F5, `DATABASE_SCHEMA.md` `session.deadlineAt` | DOC | Accumulated-active-time model: `activeMs`, `lastResumedAt`, `durationMs`, `pausedAt`; expiry rule on resume. Timer is now shipped. |
| D2 | Autosave + resume anytime | `PRD.md` FR-T4; GAP-F2/F3/F4; `FRONTEND_EXAM_FLOW.md` §8 (no persistence promise) | DOC | Contracts `GET /sessions/:id` (content + answers) and `PATCH /sessions/:id/answers` (typed) added; resume becomes a promise. |
| D3 | Tryout explanations only after the session ends | `PRD.md` FR-T6; `FRONTEND_RESULTS_ANALYTICS.md` §4 (hidden), GAP-F7/U-F3 | DOC | Tryout: explanations in the result only. Latihan: after each answer. U-F3/GAP-F7 closed. |
| D4 | Latihan explanation after each answer; TKP explanation explains **each** option's weight | `FRONTEND_EXAM_FLOW.md` §9 ("only if the key is disclosed"), GAP-X6; `QUESTION_SPECIFICATION.md` V-10 | DOC | Practice answer route returns the key + explanation + per-option weights; V-10 already requires per-option justification (kept, strengthened reference). GAP-X6 closed. |
| D5 | Submit before all answered allowed; confirm when blanks remain; blank never scored correct | `PRD.md` FR-T5 | ALIGNED | Confirm screen already lists blanks; `unansweredScore` already 0. Wording tightened to "never scored as correct". |
| D6 | Results = score + per-submateri strength/weakness + recommendation | `FRONTEND_RESULTS_ANALYTICS.md` §2 (per-question rows only, no recommendation) | DOC | Result screen adds a per-submateri block and a recommendation block fed by the backend. |
| D7 | Progres = cross-session trend, consistency, response time, when data suffices | `ANALYTICS_ENGINE.md` §5 (trend defined, `TrendSeries` untyped), GAP-F11/U-F5 | DOC | `TrendSeries`, `consistency`, per-submateri response time typed; sample gates kept. |
| D8 | History immutable; user may delete history; deletion must account for derived analytics | No delete route; no rule | MISSING | New `HISTORY_DELETION` contract: delete is an explicit user act, cascades to derived reads (they are derived-on-read), records a tombstone, and recomputes analytics; immutable **until** deleted. |
| D9 | Explain consequences of deletion | Nothing | MISSING | Documented in the analytics doc + page spec. |

### E. Question bank & lifecycle

| # | Decision | Documents / sections | Class | Action |
|---|---|---|---|---|
| E1 | Manual create = one-by-one form; no CSV/Excel import, no bulk edit | `MVP_SCOPE.md` Q-row (bulk ops), `PRD.md` FR-Q4 | DOC | Import and bulk edit recorded as explicit non-goals; bulk *archive* kept only as a bank operation already documented, bulk *activate* removed (conflicts with per-question validation). **Product Owner confirmed 2026-11-09** that bulk archive stays in MVP (`active → archived` only, ids validated, one transaction, no edit/activation/import) — [AUDIT](../AUDIT.md) AUD-74. |
| E2 | Validation layers: technical → AI quality rating → consistency → user sampling | `AI_VALIDATION.md` §1 (A parse / B shape / C V-01…12 / D lifecycle); `QUESTION_SPECIFICATION.md` §5 | DOC | New layer ids added on top of A–D: `T` technical (=A+B+C), `Q` AI quality rating, `K` consistency, `S` sampling. |
| E3 | Batch: all auto-validated, failures quarantined; user reviews a sample; fully-passed batch usable in dynamic packages | `QUESTION_GENERATION.md`, `GENERATION_JOBS.md` §3 (all drafts need individual review) | DOC | Batch outcome model + sampling quota; "eligible" definition. |
| E4 | Selective repair; replacements re-validate and re-sample | Nothing | MISSING | Documented in question spec §6. |
| E5 | Sampling is not a guarantee: reporting + post-publication withdrawal | `PRD.md` FR-Q-lifecycle; partial | DOC | Report → quarantine/withdrawal flow added. |
| E6 | Manual questions: technical validation, no batch sampling | Nothing | MISSING | Same lifecycle, `samplingGate: 'not_applicable'`. |
| E7 | Provenance: manual/AI, provider+model, time+batch, validation results, sampling/approval, revision history, version used in session | `QUESTION_SPECIFICATION.md` §2 (mostly present), §2 missing `batchId`, sampling status | DOC | Fields added. |
| E8 | Filters: text, subtest, submateri, difficulty, status, origin, provider/model/batch, created date; no saved filters | `PRD.md` FR-Q1 | DOC | Filter list extended; saved filters recorded as cut. |
| E9 | Two difficulty fields: AI initial (easy/medium/hard) and empirical from responses once sample suffices | `QUESTION_SPECIFICATION.md` §1 (`difficulty`), `ANALYTICS_ENGINE.md` §4 (author-assigned only) | DOC | `difficulty.aiInitial` + `difficulty.empirical` (nullable, sample-gated); analytics joins the empirical field. |

### F. Results / analytics / AI role

| # | Decision | Documents / sections | Class | Action |
|---|---|---|---|---|
| F1 | Deterministic stats drive strengths/weaknesses; AI only explains and orders the study sequence, never invents a weakness | `RECOMMENDATION_ENGINE.md` §2 (ranking is deterministic — ok), §4 (AI material) | DOC | Explicit: AI may order the *study sequence* and write explanation text, but the weakness set is closed before the model is called. |
| F2 | Account for sample size, difficulty, response time, trend, consistency, practice coverage | `ANALYTICS_ENGINE.md` §3–§5 (sample, trend) — no coverage/consistency | DOC | `coverage` and `consistency` metrics added; difficulty uses empirical when reportable. |
| F3 | TKP attainment, not right-wrong | `ANALYTICS_ENGINE.md` §2.1 | ALIGNED | Kept. |
| F4 | Deterministic scoring, snapshot, immutable results | `SCORING_METHODOLOGY.md` §1, §7 | ALIGNED | Kept; deletion rule (D8) is the only new exception and is explicit. |

### G. Materi

| # | Decision | Documents / sections | Class | Action |
|---|---|---|---|---|
| G1 | Materi exists (manual or AI), AI content is a draft until approved, versioned | `DATABASE_SCHEMA.md` DB-1 (**no material table**), `API_ENDPOINTS.md` §7 absence envelope, `RECOMMENDATION_ENGINE.md` §4, `MVP_SCOPE.md`, `FRONTEND_GAP_REGISTER.md` GAP-X7, `AUDIT_FINDINGS_RESOLUTION.md` U-1 | DOC | DB-1 superseded: material bank **enters MVP**. Absence envelope removed. This is the largest single change and is flagged in §7. |
| G2 | Main materi follows the taxonomy; free notes allowed; unmapped materi must not affect competency analytics | Nothing | MISSING | New `MATERIAL_SPECIFICATION.md`. |
| G3 | Factual/legal/historical/policy materi need verifiable sources; conceptual/strategy need not; unverified labeled | Nothing | MISSING | Material spec §4. |
| G4 | Never treated as official fact | `QUESTION_SPECIFICATION.md` §2.1 (question-level only) | MISSING (material level) | Material spec §5. |

### H. Regulation / config

| # | Decision | Documents / sections | Class | Action |
|---|---|---|---|---|
| H1 | A regulation change = new config version; old versions retained; historical results keep their config at creation | `CPNS_2026_REGULATIONS.md` §4.2–§4.3 | ALIGNED | Kept; wording sharpened ("config version", not a new config id, unless the cycle changes). |
| H2 | New packages use the latest verified config | Nothing | MISSING | Package spec §3. |
| H3 | If unverified: tryouts still available with a temporary config labelled **Belum Terverifikasi**; system may propose initial values from historical references; user may adjust; never invent parameters; results computable on the chosen temporary config; never claim official pass status without a verified passing threshold; snapshot stores the config | `CPNS_2026_REGULATIONS.md` §4.2 (provisional "not scoreable until approved"), `PRD.md` §13.4, `FRONTEND_PAGE_SPECIFICATIONS.md` §2–§3 (lock until approved) | DOC | Provisional config becomes **startable** without an approval dialog; approval remains required only for a *threshold verdict*. Label `Belum Terverifikasi` becomes the single user-visible state name. |
| H4 | Config status invisible in the learner area | see B3 | DOC | Same action. |

### I. AI provider

| # | Decision | Documents / sections | Class | Action |
|---|---|---|---|---|
| I1 | One global default provider/model + per-feature overrides | `AI_PROVIDER_ARCHITECTURE.md` §4 (four tasks, no global default) | DOC | `defaultProviderId`/`defaultModel` records + the existing per-task overrides. |
| I2 | Presets: OpenRouter, OpenAI-compatible, Ollama; custom allowed | `AI_PROVIDER_ARCHITECTURE.md` §1–§3 | MISSING (presets) | Presets table added (values are *presets*, not regulations). |
| I3 | Auto model list when supported + manual Model ID; connection test before use | `PRD.md` FR-C2/FR-C3 | ALIGNED | Kept; "before use" made a rule. |
| I4 | Capability detection automatic **and** manually correctable; never assume all models equal | `AI_PROVIDER_ARCHITECTURE.md` §5 ("defaults guessed from a known-model table", user-edited) | DOC | Automatic + manual correction, with a persisted `capabilitySource`. |
| I5 | No automatic fallback to another provider; clear errors + manual retry | `AI_PROVIDER_ARCHITECTURE.md` §6 (retry, same provider) | ALIGNED | Made explicit as a prohibition on cross-provider fallback. |
| I6 | Track partial output | `QUESTION_GENERATION.md` §4 (batch-atomic) | DOC | Partial output is retained per batch and **exposed** as partial counts on the job. |
| I7 | No token/cost statistics in the app | `AI_PROVIDER_ARCHITECTURE.md` §2 `usage?` | DOC | `usage` kept in the interface (transport may return it) but **not persisted and never displayed**. |
| I8 | Capabilities/limits wording applies to generation jobs | `GENERATION_JOBS.md` §2 | DOC | Job status carries capability-derived limits; no token/cost reporting. |

### J. Jobs & notifications

| # | Decision | Documents / sections | Class | Action |
|---|---|---|---|---|
| J1 | Generation runs as a backend background job; user may leave or close the browser | `GENERATION_JOBS.md` (no browser-independent statement), `DATA_FLOW.md` §2 (UI polls) | DOC | Job execution is server-owned; the UI polls or reads the notification centre. |
| J2 | In-app notification centre; listed events; no Windows notifications | Nothing | MISSING | New `NOTIFICATION_SPECIFICATION.md` + `GET /notifications`, `PATCH /notifications/:id`. |
| J3 | Statuses = queued, running, completed, failed, interrupted (closed set) | `GENERATION_JOBS.md` §2 (`queued/running/cancelling/completed/failed`) | DOC | `interrupted` added; **`cancelling` removed**. Closed set of five states; a sixth would be an API-contract change. |
| J4 | No pause, no resume, **no cancel** in MVP | `PRD.md` FR-G2, `API_ENDPOINTS.md` `/generation-jobs/:id/cancel`, `FRONTEND_PAGE_SPECIFICATIONS.md` §7, `FRONTEND_API_MAPPING.md` E52, `FRONTEND_DATA_CONTRACTS.md` | DOC (**supersedes an older requirement**) | Cancel removed end to end: route, `JobStatus` member, `generated_batch.status` value, UI control, user story, feature row. This decision **supersedes** the earlier documented cancel requirement; it is no longer an open question. Exam-session pause/resume is a different mechanism and is unchanged. |
| J5 | On restart: inspect leftover jobs; resume only technically safe ones, else offer retry; keep partial results; no duplicate questions; never claim a provider request resumes mid-flight | `GENERATION_JOBS.md` §4 ("whether in-flight jobs survive a restart" unresolved) | MISSING | `interrupted` state + restart policy. |

### K. Deployment, storage, backup, secrets

| # | Decision | Documents / sections | Class | Action |
|---|---|---|---|---|
| K1 | Localhost only, frontend + backend on the user machine; everything but AI offline | `SECURITY.md` §1–§2, `PRD.md` NFR-1 | ALIGNED | Kept. |
| K2 | One command/shortcut to run both; backend ready before browser opens; clean shutdown | Nothing | MISSING | New `DEPLOYMENT_AND_BACKUP.md` §1. |
| K3 | No account/login/role/PIN | `AUTHENTICATION.md`, ADR-009 | ALIGNED | Kept. |
| K4 | Automatic + manual backup to a user-chosen folder; failure must not claim success; retention policy | Nothing | MISSING | Deployment doc §2. |
| K5 | Restore cross-device with a migration wizard + compatibility validation; API keys not exported by default | `MIGRATION_STRATEGY.md` §5 (secrets not migrated) | DOC | Wizard + manifest added. |
| K6 | Keys in OS secure storage (e.g. Windows Credential Manager); never plaintext in DB/config; never fully exposed to frontend; backend owns access | `SECRETS.md` §2 ("unresolved" between keychain and file) | DOC | Decision taken: OS credential store; file backend removed. |

### Cross-cutting new docs (no predecessor)

`PACKAGE_SPECIFICATION.md` (product), `MATERIAL_SPECIFICATION.md` (examination), `NOTIFICATION_SPECIFICATION.md`
(backend), `DEPLOYMENT_AND_BACKUP.md` (architecture), `HISTORY_AND_DELETION` (§ in analytics doc).

---

## 2. Phase 2 — documents revised

Every row is a file that was edited or created by this revision. Nothing outside `docs/`, `README.md` and
`AGENTS.md` was touched.

### 2.1 New canonical documents

| Doc | Owns | Decided by |
|---|---|---|
| `docs/product/PACKAGE_SPECIFICATION.md` | package record, built-in tryout/subtest packages, Latihan submateri units, roster assembly, repeat rule, custom packages + immutable versions, config binding | C, D1, D2 |
| `docs/examination/MATERIAL_SPECIFICATION.md` | material model, scope vs free note, provenance, sources by content type, approval per version, validation M-01…M-06 | G |
| `docs/backend/NOTIFICATION_SPECIFICATION.md` | notification record, seven event groups, in-app delivery, no OS notifications, deep links | J2 |
| `docs/architecture/DEPLOYMENT_AND_BACKUP.md` | launcher, localhost-only posture, backup, verification, retention, migration wizard, key handling | K1–K6 |

### 2.2 Examination set

| Doc | Change |
|---|---|
| `CPNS_2026_REGULATIONS.md` | §4.1 `dataProvenance` (`seed`/`legacy`); §4.2 startable vs verdict + **Belum Terverifikasi**; §4.3 invalidation withholds the verdict only; §4.4 shipped configs incl. the retained legacy row; §8 rules 3/4/7/8 |
| `COMPETENCY_TAXONOMY.md` | node tier renamed `EVIDENCE-BACKED-NOT-CPNS-2026`; pathway attributions removed; ids unchanged |
| `SCORING_METHODOLOGY.md` | invariants 10–11 (score ≠ verdict, deterministic inputs); §3.3 blanks; §5.6 score vs verdict; §7 `packageBinding`/`roster`/`timing`; §7.1 history deletion; §8.1 accumulated-active-time clock; PF-09/PF-13 wording; §11/§11.1 precedence split into blocking vs verdict-only |
| `QUESTION_SPECIFICATION.md` | rewritten: two difficulty fields, provenance + `SamplingRecord`, layers T/Q/K/S, lifecycle, §6 batch/sampling/repair/withdrawal, §7 versions, §8 bank filters |

### 2.3 Backend set

| Doc | Change |
|---|---|
| `ANALYTICS_ENGINE.md` | input contract, §3.4 conclusion gate, §4 difficulty/coverage/consistency/response time, snapshot shape, §7 history deletion |
| `RECOMMENDATION_SERVICE.md`, `RECOMMENDATION_ENGINE.md`, `AI_VALIDATION.md`, `QUESTION_GENERATION.md`, `GENERATION_JOBS.md`, `AI_PROVIDER_ARCHITECTURE.md` | rewritten to F, E, I, J |
| `BUSINESS_RULES.md` | BR-E2/E3 revised, BR-E5, BR-S4…S6, BR-Q2…Q7, BR-A4/A5, BR-L3/L4, BR-J1…J3, BR-M1…M3, BR-D1…D5 |
| `DATABASE_SCHEMA.md` / `ERD.md` | question versions/reports, session package binding + clock + tombstone, provider/presets/`ai_routing`, notifications, backups, packages, `observed_question_history`, materials, `verdictWithheldJson` |
| `API_ENDPOINTS.md` | route table rebuilt (77 routes; **now 73** after the §12 correction); approval codes moved out of the 409 legend |
| `API_SPECIFICATION.md` | §4 verdict-only codes are `200` fields, not errors; §5 `verdict`/`withheld`/`packageBinding`; §7.3 `/score`; §7.4–§7.6 session start, autosave, Latihan feedback |
| `SECRETS.md` | OS secure storage decided; keys excluded from backups |
| `VALIDATION.md` | new domain rules; approval boundary restated |
| `MIGRATION_STRATEGY.md` | §1 legacy pathway, §5 keys/restore, §6 forward compatibility |
| `ERROR_HANDLING.md` | approval codes removed from the domain-failure table; `tryout_no_feedback` added |
| `PROVIDER_INTEGRATION.md` | presets, capability probing, no fallback |

### 2.4 Product set

| Doc | Change |
|---|---|
| `PRD.md` | rewritten: §4 CPNS-only scope, §6 two areas, §7 use cases UC-01…UC-15, §9 FR-A6/A8, FR-T1…T8, FR-P1…P5, FR-G7/G8, FR-Q1…Q8, FR-L7, FR-M1…M5, FR-C8, FR-E5/E6, FR-K1…K4, FR-H1…H4, FR-A1…N3, §10 NFR-1…NFR-13 |
| `USER_STORIES.md` | rewritten; new US-B, US-T, US-P, US-A5…A8, US-M, US-K, US-H, US-N1/N2 |
| `USER_JOURNEYS.md` | rewritten; J-1…J-8 + journey-level failure table |
| `MVP_SCOPE.md` | rewritten: in-scope table, extended cut lines, shipped configs (legacy row never offered), sampling default |
| `FEATURE_MATRIX.md` | rewritten: every FR → owning doc |

### 2.5 Frontend set

| Doc | Change |
|---|---|
| `FRONTEND_INFORMATION_ARCHITECTURE.md` | five-item dock, Belajar/Kelola split, seven Kelola items, routes, IA invariants (no config in learner path) |
| `FRONTEND_ROUTING.md` | `/tryout/:packageId` replaces `/tryout/:configId`; new Kelola routes; guards |
| `FRONTEND_PAGE_SPECIFICATIONS.md` | rewritten per screen, incl. §11–§19 (bank, review/sampling, materials, generation, AI, config, packages, backup, notifications) |
| `FRONTEND_EXAM_FLOW.md` | accumulated-active-time clock, pause/resume, blanks confirmation, explanations withheld, Latihan feedback with per-option weights |
| `FRONTEND_RESULTS_ANALYTICS.md` | score/verdict split, per-submateri strengths/weaknesses, recommendation, delete-with-consequences, Progres blocks without config badge |
| `FRONTEND_DATA_CONTRACTS.md` | typed contracts for package/session/runner/feedback/notification/material/offer/job/coverage/consistency/trend; `withheld`; `ErrorCode` trimmed of verdict-only codes |
| `FRONTEND_GAP_REGISTER.md` | rewritten: GAP-F1…F13 resolved, remaining GAP-M/X items all low; U-F1…U-F12 decided |
| `FRONTEND_PRD.md` | rewritten: coverage table now complete; hard rules updated |
| `FRONTEND_API_MAPPING.md` | rewritten: 77 routes (**now 73** after §12), reverse mapping, 4 partial |
| `DESIGN_SYSTEM.md` | §5 badge table rebuilt (no config badge in Belajar), copy table, exam rules |
| `FRONTEND_ACCESSIBILITY.md` | clock live regions, TKP weight disclosure, manual pass extended |
| `FRONTEND_MOCK_DATA_STRATEGY.md` | fixtures for packages/clock/notifications; no config in Belajar |
| `FRONTEND_COMPONENT_ARCHITECTURE.md` | new feature modules and primitives (`Clock`, `NotificationBell`) |
| `FRONTEND_STATE_MANAGEMENT.md` | clock is server state; flags persist; no `configId` in storage |
| `FRONTEND_IMPLEMENTATION_PLAN.md` | build rule per endpoint status; Gate 2 re-alignment order |

### 2.6 Architecture, roadmap, meta

| Doc | Change |
|---|---|
| `SYSTEM_ARCHITECTURE.md`, `DATA_FLOW.md`, `SECURITY.md` | §2–§4 components, eight flows, secrets + local-data posture; submit flow separates blocking from verdict-only |
| `DEVELOPMENT_ROADMAP.md` | Gate 0 re-baseline item + Gate 2 re-alignment items |
| `RISK_REGISTER.md` | R-6 reworded; R-11…R-16 (clock, job loss, false backup success, sampling confidence, deletion, local data loss) |
| `AGENTS.md` | non-negotiable 2 (CPNS-only scope + pathway), 3 (verdict-only approval), canonical-doc table |
| `README.md`, `docs/README.md` | scope statement, doc index, next step |
| `docs/AUDIT.md` | Round 4, AUD-58…AUD-72 |
| `docs/decisions/ADR-004-exam-config-states.md` | decision restated: startable + scorable, verdict needs approval |
| `ERROR_HANDLING.md`, `ERD.md`, `VALIDATION.md`, `DATABASE_SCHEMA.md` | consistency follow-up found in Phase 3 (§4) |

---

## 3. Phase 3 — consistency verification

### 3.1 Checks run

| # | Check | Method | Result |
|---|---|---|---|
| 1 | Every decision A–K has a documented home | §1 matrix, then §2 review | **pass** — each decision names ≥ 1 owning section |
| 2 | No product surface offers a non-CPNS pathway | search `Sekolah\|Kedinasan` across `docs/**`, `README.md`; manual review of each hit | **pass** — remaining hits are evidence/guard text only (§3.2) |
| 3 | Historical data not deleted | review of `DATABASE_SCHEMA`, `MIGRATION_STRATEGY`, `CPNS_2026_REGULATIONS` §4.4, §8 rules 7–8 | **pass** — retained rows marked `dataProvenance: 'legacy'`, never returned |
| 3b | No file deleted | `git ls-files -o --exclude-standard` + `git diff --stat` | **pass** — only additions and edits; `docs/audit/` was already untracked before this revision |
| 4 | Score vs verdict stated the same way everywhere | search `APPROVAL_MISSING\|APPROVAL_INVALID\|APPROVAL_VERSION_MISMATCH\|verdict\|scored only\|unscored` | **fixed 6 docs** (§3.3) |
| 5 | Clock model consistent | search `deadline\|deadlineAt\|countdown\|timer` | **pass** — only the §8.1 active-time model remains; no `deadlineAt` column survives in the schema (remaining hits are historical audit rows and the J-1 "no deadline" phrasing) |
| 6 | Explanations disclosure consistent | `FR-T6` vs `FR-P4` vs exam-flow vs results | **pass** — Tryout: after end; Latihan: after each answer |
| 7 | Navigation consistent | IA §2/§4 vs routing vs page specs vs PRD §6 vs design system §7 | **pass** — five dock items, seven Kelola items, no config route |
| 8 | FR ids unique and resolvable | `FEATURE_MATRIX` → `PRD` §9 | **pass** — every matrix FR exists in PRD |
| 9 | Every screen has ≥ 1 endpoint and every endpoint an owner | `FRONTEND_API_MAPPING` §3 | **pass** — 73 routes, 72 screen-reachable (after §12) |
| 10 | Enum/difficulty/status vocabularies identical | `Difficulty`, `Lifecycle`, job status, `MaterialOffer`, notification severity | **pass** — single definition per enum, others point |
| 11 | No invented endpoint/field/status | manual review of new route tables | **pass** — every route cites `API_ENDPOINTS`, which cites the domain doc |
| 12 | Out-of-scope item appears nowhere as a feature | `MVP_SCOPE` §2 list vs PRD, stories, pages | **pass** |
| 13 | Every FR in PRD §9 is traced in `FEATURE_MATRIX` | extract all `^- FR-*` lines, match against the matrix | **pass** — 80 FRs, all present (`FR-L5–6` is a range row) |
| 14 | No dangling relative link | resolve the target of every Markdown link (`](` + path + `.md)`) on disk | **pass** — one broken link found and fixed (§3.3 P3-10) |

### 3.2 Non-CPNS references that intentionally remain

Every surviving mention is one of three kinds, and none is a product surface:

1. **Evidence record** — `CPNS_2026_REGULATIONS.md` §2.3(b), §3.2(b), §5.4: the 2026 framework instrument
   exists and is recorded as evidence with its own scope. Removing it would erase the record of *why*
   the CPNS threshold is `UNVERIFIED`.
2. **Anti-laundering guard** — BR-E1, PF-12, `SCORING_METHODOLOGY` §6.7: forbids citing a non-CPNS
   instrument as CPNS authority. Removing the guard would let the laundering happen silently.
3. **Storage/replay compat** — `exam_config.pathway` storage enum value, `dataProvenance: 'legacy'`,
   `MIGRATION_STRATEGY` §1: keeps old rows readable without offering them.

The tier `EVIDENCE-BACKED-NOT-CPNS-2026` is the renamed, pathway-free label for kind 1. Two uses of the
old tier name were found in Phase 3 and fixed (`SCORING_METHODOLOGY.md` §6.7,
`CPNS_2026_REGULATIONS.md` §4.1/§5 type block); `FRONTEND_DATA_CONTRACTS.md` gained the new tier member.

### 3.3 Contradictions found in Phase 3 and fixed

All were introduced by the decision changes, not pre-existing.

| # | Contradiction | Docs | Fix |
|---|---|---|---|
| P3-1 | Approval failure was still `409` in the error registry and domain-failure table, while the new rule says the score is written on submit | `API_SPECIFICATION.md` §4, `ERROR_HANDLING.md` §4, `API_ENDPOINTS.md` legend, `ERD.md`, `VALIDATION.md`, `DATABASE_SCHEMA.md` | Verdict-only codes moved to `200` fields (`withheld`), removed from the `409` legend; `blockedErrorCode` narrowed to blocking codes; new `verdictWithheldJson` column |
| P3-2 | Error precedence listed `APPROVAL_*` as ranked blocking codes | `SCORING_METHODOLOGY.md` §11.1 | Split into blocking order then verdict-only order; verdict-only never costs a score |
| P3-3 | Frontend `ErrorCode` union still carried the approval codes as errors | `FRONTEND_DATA_CONTRACTS.md` §2, §5 | `VerdictWithheldCode` type added; `ErrorCode` trimmed; `ScoreResult.withheld` added |
| P3-4 | ADR-004 restated the superseded "unscored until approved" decision | `decisions/ADR-004-exam-config-states.md` | Decision line restated; consequences updated |
| P3-5 | Exam-flow and page-spec tables still listed `409 APPROVAL_*` as submit outcomes | `FRONTEND_EXAM_FLOW.md` §7, `FRONTEND_PAGE_SPECIFICATIONS.md` §5, `FRONTEND_RESULTS_ANALYTICS.md` §5.2 | Blocking codes listed; approval stated as verdict-only |
| P3-6 | Journey J-4 named `blockedErrorCode` for a withheld verdict | `USER_JOURNEYS.md` J-4 | Names `withheld.code` / `withheld.changed[]` |
| P3-7 | `Data Flow` submit diagram wrote `blockedErrorCode` for the verdict-withheld branch | `architecture/DATA_FLOW.md` §3 | Branch renamed and both block/verdict branches separated |
| P3-8 | `EVIDENCE-BACKED-NOT-CPNS-2026` missing from the wire type and the frontend union | `CPNS_2026_REGULATIONS.md` §4.1, `FRONTEND_DATA_CONTRACTS.md` §3 | Member added in both |
| P3-9 | Two `VERIFIED-2026-SEKOLAH-KEDINASAN` tier mentions survived the rename | `SCORING_METHODOLOGY.md` §6.7 | Renamed |
| P3-10 | PRD renumbering (§8→§9) left stale `PRD.md §8.x` cross-references | `AI_PROVIDER_ARCHITECTURE.md` §1, `QUESTION_GENERATION.md` §1, `RECOMMENDATION_ENGINE.md` §1, `ANALYTICS_ENGINE.md` §1, `PACKAGE_SPECIFICATION.md` §1, `MATERIAL_SPECIFICATION.md` §1 (which also had a broken `./PRD.md` path) | Pointed at §9.x / `../product/PRD.md` |
| P3-11 | Session route parameter was `:sessionId` in three docs and `:id` in two, and `/tryout/:packageId` was declared before `/tryout/sesi/:id` (the package route would swallow the runner) | `FRONTEND_ROUTING.md` §1, `FRONTEND_INFORMATION_ARCHITECTURE.md` §4, `FRONTEND_PAGE_SPECIFICATIONS.md` §4–§6 | Unified on `:id`; session routes declared first; ordering noted as load-bearing |
| P3-12 | `PRD.md` §3 lost a row boundary between O-6 and O-7 during the rewrite | `PRD.md` §3 | Rows separated |

No contradiction was left open. Nothing was closed by omission: each row above names the file and the
resulting rule.

### 3.4 Stale references removed

`/tryout/:configId` (now `/tryout/:packageId`), "Kumpulan soal" (now **Bank Soal**), "Analytics" (now
**Progres**), "Perlu persetujuan" as a start lock (now a **Kelola-only** config label;
**Belum Terverifikasi** names the state), `skd-sekolah-kedinasan-2026` as an offered config (now a
retained `legacy` row), `GAP-*` ids in the layout/state docs, "U-F1 open timer question" (closed by §8.1),
"DB-1 no material bank" as a live statement (superseded, AUD-64) — all replaced by the new canonical
wording.

The four files that predate this revision and were already untracked
(`AUDIT_FINDINGS_RESOLUTION.md`, `INDEPENDENT_DOCUMENTATION_AUDIT.md`, `FRONTEND_API_MAPPING.md`,
`FRONTEND_EXAM_FLOW.md`) **do** carry the old wording, because they are the record of what was found.
They were not rewritten: a finding that says "this was wrong" must keep saying what was wrong.

---

## 4. Domain → DB → API → frontend contract chain

One row per concept that this revision introduced or changed. Each chain is verified down to a column and a
route, so no layer is missing. Table and column names were read from
[DATABASE_SCHEMA](../backend/DATABASE_SCHEMA.md) after the Phase 3 edits; routes from
[API_ENDPOINTS](../backend/API_ENDPOINTS.md); types from
[FRONTEND_DATA_CONTRACTS](../frontend/FRONTEND_DATA_CONTRACTS.md) §3. It records the chain; the canonical
docs remain the authority on each cell.

| Concept | Domain (canonical) | DB | API | Frontend |
|---|---|---|---|---|
| Package + version | `PACKAGE_SPECIFICATION` §1, §5 | `package`, `package_version` | `GET/POST /packages`, `POST /packages/:id/versions`, `/retire` | `Package`, `PackageList/PackageDetail`, Manajemen Paket |
| Session binding | §3 | `session.packageId`, `packageVersion`; `session_snapshot.packageBindingJson` | `POST /packages/:id/sessions` | `PackageBinding` |
| Repeat rule | §4.4 | `observed_question_history` | `Package.availability.repeatCount` | repeat notice on the card |
| Active-time clock | `SCORING_METHODOLOGY` §8.1 | `session.activeMs`, `runningSince`, `durationMs` | `PATCH /answers`, `/pause`, `/resume` | `Clock` primitive |
| Score vs verdict | §5.6, §11 | `score_result.verdictJson`, `verdictWithheldJson`, `blockedErrorCode` | `200` + `withheld`; `409`/`422` blocks | `ScoreResult.verdict/withheld` |
| History deletion | `ANALYTICS_ENGINE` §7 | `session_deletion` tombstone | `DELETE /sessions/:id`, `/bulk-delete`, `GET /deletion-impact` | delete dialog with consequences |
| Question version | `QUESTION_SPECIFICATION` §7 | `question.contentVersion`, `contentHash`, version rows | `PATCH /questions/:id` | version list in Bank Soal detail |
| Sampling gate | §6.2 | `question.provenanceJson` (batchId + `SamplingRecord`) | `POST /question-batches/:id/sample`, `GET /question-batches` | Review Soal sampling screen |
| Reports / withdrawal | §6.5 | `question_report` | `POST /questions/:id/reports`, `GET/PATCH /question-reports/:id` | report action + Review Soal queue || Two difficulty fields | §1.1 | `question.difficultyAiInitial`, `question.empiricalDifficultyJson` | `difficulty` / `empiricalDifficulty` filters | Progres two tabs; Bank Soal two filters |
| Material | `MATERIAL_SPECIFICATION` §1–§5 | `material`, `material_version` | `GET/POST/PATCH /materials`, `/approve`, `/retire`, `/draft` | Materi list/detail |
| Material offer | `RECOMMENDATION_ENGINE` §4 | — (derived) | `GET /recommendations/materials` | `MaterialOffer` |
| AI routing | `AI_PROVIDER_ARCHITECTURE` §4 | `ai_routing` | `GET/PUT /ai-routing` | Pengaturan AI default + overrides |
| Provider presets | §3 | `provider.preset` | `POST /providers` | preset picker |
| Capabilities | §6 | `provider.capabilityFlagsJson` (each flag carries `source`) | `PUT /providers/:id/capabilities` | capability rows with `otomatis`/`manual` |
| Job lifecycle | `GENERATION_JOBS` §2 | `generation_job`, `generation_batch` | `GET/POST /generation-jobs`, `/retry` (no cancel - §12.1) | Generasi AI + notification |
| Notifications | `NOTIFICATION_SPECIFICATION` §2–§3 | `notification` | `GET /notifications`, `PATCH/:id`, `/read-all` | bell + Pusat pemberitahuan |
| Backup | `DEPLOYMENT_AND_BACKUP` §2 | `backup_record` | `GET/PUT /settings/backup`, `GET/POST /backups` | Pengaturan |
| Restore | §3 | — (replaces DB) | `POST /restores/validate`, `POST /restores` | restore wizard |
| Secrets | `SECRETS` §2 | `secret_ref` (name only) | never serialised | masked tail only |
| Legacy compatibility | `CPNS_2026_REGULATIONS` §8 rules 7–8, `MIGRATION_STRATEGY` §1.1 | `exam_config.dataProvenance` | `GET /exam-configs` filters `legacy` | unreachable by route |

### 4.1 Referential rules that changed

- `session_snapshot` gained `packageBindingJson` and `timingJson`; both are frozen at creation and never
  recomputed ([SCORING_METHODOLOGY](../examination/SCORING_METHODOLOGY.md) §7).
- `question` is versioned by `contentHash`; a session references the hash it froze, so an edited question
  can never retroactively change a stored result.
- `material_version` is the unit of approval; `material.approvalVersion` points at the approved one.

---

## 5. Requirements traceability

| Decision | FR | US | Journey | Screen(s) | Backend rules |
|---|---|---|---|---|---|
| A | §4 of PRD, BR-E1 | — | — | none (no pathway screen) | BR-E1, PF-12 |
| B | FR-D4, FR-D5, FR-E1 | US-A5, US-E1 | J-1, J-2 | Beranda, Lainnya, Progres | IA §6 invariants |
| C | FR-K1…K4, FR-T1, FR-P1, FR-P5 | US-K1…K3, US-T1, US-P1, US-P4 | J-3 | Tryout, Latihan, Manajemen Paket | `PACKAGE_SPECIFICATION` |
| D | FR-T2…T8, FR-P2…P4, FR-A8, FR-H4 | US-T2…T7, US-P2/P3, US-A8 | J-3, J-4, J-8 | runner, konfirmasi, hasil | scoring §3.3, §5.6, §8.1, §11 |
| E | FR-Q1…Q8, FR-G3, FR-G7 | US-B2…B10 | J-5, J-6 | Bank Soal, Review Soal | `QUESTION_SPECIFICATION` §3–§8 |
| F | FR-A1…A7, FR-L1…L7, FR-D2/D3 | US-A1…A7, US-L1…L5 | J-2 | Progres, hasil (learning sequence inline; no standalone plan - §12.3) | `ANALYTICS_ENGINE`, `RECOMMENDATION_ENGINE` |
| G | FR-M1…M5 | US-M1…M4 | J-2 | Materi | `MATERIAL_SPECIFICATION` |
| H | FR-E1…E6, FR-T7 | US-E1…E4, US-T7 | J-3, J-4 | Konfigurasi Ujian, hasil | regulations §4, scoring §11 |
| I | FR-C1…C8 | US-C1…C6 | J-7 | Pengaturan AI | `AI_PROVIDER_ARCHITECTURE`, `SECRETS` |
| J | FR-G8, FR-A1…N3 | US-N1/N2, US-B1 | J-1, J-5 | Generasi AI, notification centre | `GENERATION_JOBS`, `NOTIFICATION_SPECIFICATION` |
| K | FR-H1…H3, NFR-1/7/12/13 | US-H1/H2, US-C3 | J-8 | Pengaturan, launcher | `DEPLOYMENT_AND_BACKUP`, `SECRETS`, BR-D1…D4 |

Every FR in `PRD.md` §9 appears in `FEATURE_MATRIX.md`; every screen in the IA appears in
`FRONTEND_API_MAPPING.md` §3. No orphan requirement and no orphan screen.

---

## 6. Gate-2 frontend deviation inventory

The existing frontend (28 `.tsx` / 43 source files, **not modified** by this revision) implements the
pre-revision documentation. These are the concrete deviations the next frontend gate must fix. None is a
defect in this documentation revision; each is a work item.

| # | File | Deviation from the new decision | Decision |
|---|---|---|---|
| F-1 | `frontend/src/App.tsx`, `features/tryout/TryoutDetail.tsx` | `/tryout/:configId` — the learner picks a config to start | B3, C1 |
| F-2 | `features/tryout/TryoutList.tsx`, `features/shared/badges.tsx` | "Perlu persetujuan" start lock; config badges on the tryout list | B3, H |
| F-3 | `features/beranda/BerandaPage.tsx` | renders the config list incl. a pathway label; "Kumpulan soal" wording | B3, A1 |
| F-4 | `features/progres/ProgresPage.tsx` | config selector on Progres | B4 |
| F-5 | `features/tryout/Runner.tsx` | no clock rendering, no pause/resume (`// No timer. … GAP-F5, U-F1`); `mode: 'practice'` | D1, D3 |
| F-6 | `features/latihan/LatihanPick.tsx` | one fixed drill roster instead of a submateri picker with stock | C2 |
| F-7 | `features/latihan/PracticeSummary.tsx` | "Explanations are not shown: the practice payload carries no disclosed key (GAP-X6)"; no per-answer feedback in the runner | D4 |
| F-8 | `features/tryout/TryoutResult.tsx` | no per-submateri strengths/weaknesses block; names `SEKOLAH_KEDINASAN` basis | D6, A1 |
| F-9 | `features/lainnya/Generation.tsx` | generation requires a config choice | B5, C3 |
| F-10 | `features/lainnya/ConfigPages.tsx`, `features/shared/badges.tsx` | pathway rendering; old tier label `Terverifikasi Kedinasan 2026` | A1, A3 |
| F-11 | `features/progres/CompetencyDetail.tsx` | states that domain names come from the Kedinasan rule | A3 |
| F-12 | `features/shared/format.ts` | persists `lastConfigId` in `localStorage` | B3 |
| F-13 | `mock/*` | config fixtures include the offered Kedinasan row; no package/notification/backup fixtures | A1, C, J2, K4 |
| F-14 | missing features | no Materi, Review Soal, sampling, Manajemen Paket, Pengaturan/backup, notification centre | G, E, C4, K4, J2 |

F-1 to F-14 are listed in `DEVELOPMENT_ROADMAP.md` Gate 2 as the re-alignment checklist.

---

## 7. Unapproved assumptions (explicitly flagged)

These are decisions this revision had to make to keep the documents coherent. Each is a **proposal**, not
an owner decision, and each is reversible without touching code. Rows withdrawn by the 2026-11-08 correction
are marked **withdrawn** and keep their id so no id is reused.

| # | Assumption | Why it was needed | Where it lives | Reversal cost |
|---|---|---|---|---|
| AS-1 | Approval gates the **verdict**, not the session | "Tryout must stay available without a verified config" and "no fabricated pass status" both hold only if score and verdict are separate | scoring §5.6, §11; regulations §4.2; AGENTS 3 | medium - touches scoring result shape |
| AS-2 | ~~Sampling size = `max(2, 10 %)` capped at 5~~ **withdrawn** - the sampling quota is an **unresolved product parameter**; no value is assumed (Q-4) | The decision said "user reviews a sample" without a size; the owner has not approved a formula | `QUESTION_SPECIFICATION` §6.2 rule 3, `MVP_SCOPE` §4, `VALIDATION` | none - no number is in force |
| AS-3 | A **critical** report means *wrong key* or *ambiguous* | Named in the decision, not enumerated | `QUESTION_SPECIFICATION` §6.5 | trivial |
| AS-4 | Latihan is untimed by default | Decision gave a duration rule but no default for Latihan | PRD FR-P2, exam flow §6 | trivial |
| AS-5 | Backend-internal notification polling, no push channel | Simplest local mechanism; the decision only required in-app delivery | `NOTIFICATION_SPECIFICATION` §5 | low |
| AS-6 | Retention default = last 7 backups / 30 days, manual backups never pruned | Decision required a documented policy, not specific numbers | `DEPLOYMENT_AND_BACKUP` §2.3 | trivial |
| AS-7 | Launcher starts backend, waits on `/health`, then opens the browser | "backend ready before the browser opens" needs a readiness signal | `DEPLOYMENT_AND_BACKUP` §1.2 | low |
| AS-8 | ~~Study plan reached from Progres~~ **withdrawn** - a standalone Rencana Belajar feature is **out of MVP** (Q-1) | The route was an inference, not a decision | `MVP_SCOPE` §2, `RECOMMENDATION_ENGINE` §7 | none |
| AS-9 | `dataProvenance: 'legacy'` for pre-scope configs rather than deleting them | "Do not delete historical data" + "no pathway in the product" | regulations §4.1, §8.7-8 | low |
| AS-10 | ~~Rencana Belajar item whose evidence was deleted is marked~~ **withdrawn** with AS-8; the derived **learning sequence** simply excludes deleted sessions | Nothing to mark once no plan document is stored | `ANALYTICS_ENGINE` §7.3, `RECOMMENDATION_ENGINE` §7 | none |
| AS-11 | A custom package **may pin** a config as a management-side reference; an unusable pin falls through to the latest usable config | Decision H requires a package to work with a temporary config, and E requires custom packages; a pin is the only way a creator can express a specific rule set without the learner choosing one | regulations §4.2.1, package spec §3 | low - one nullable column pair on the package version |
| AS-12 | "Hide" is a **view filter**, documented but not shipped in MVP; only user deletion changes stored data | The owner asked for the three concepts to be distinguished; shipping a reversible filter was not requested | `ANALYTICS_ENGINE` §7.1, §7.5 | trivial |

---

## 8. Open questions for the Product Owner

Recorded as unresolved. No assumption was silently made in their place. **Q-3 was removed** by the
2026-11-08 correction: decision J4 now supersedes the older cancel requirement outright, so there is nothing
left to resolve. Q-9 and Q-10 were added by the same correction.

| # | Question | Current documented default | Impact if changed |
|---|---|---|---|
| Q-1 | ~~Is **Rencana Belajar** in scope at all?~~ **resolved 2026-11-08**: it is **not** in MVP; recommendations and the learning sequence render inline | No standalone screen, route or plan table | If it is later approved: one route, one FR group (FR-L5/L6), one table, one component group to add |
| Q-2 | Must Progres state **why** a cross-version comparison is blocked? It currently states *that* it is blocked, without naming a config (decision B4). | Stated in prose, no config id | If it must name the version: a config label returns to a Belajar surface, reopening B4 |
| Q-4 | **Sampling quota** - how many questions of a batch must the user review before the batch is approved? | **Unresolved.** No formula, no minimum, no default. The workflow is specified; the number is not | UI shows the size the backend drew; approving a number changes one product constant |
| Q-5 | Default retention numbers (AS-6). | 7 backups / 30 days | Trivial |
| Q-6 | May a **manual** question ever need sampling, e.g. after heavy editing of a TKP key? | No sampling for manual questions; key validation + T still required | Low - one validation rule |
| Q-7 | Should the notification centre be reachable from the dock as a sixth item? | No - shell bell + `/lainnya/notifikasi` | Low - IA change, recorded in `docs/AUDIT.md` |
| Q-8 | **Permanent purge** of a deleted session (including its tombstone). Is physical erasure ever required? | **Unresolved.** The MVP operation is a user deletion that leaves a content-free tombstone and removes the session from views and analytics. No purge route, control or migration exists | If approved: a new destructive operation with its own confirmation, audit rule and backup caveat |
| Q-9 | Should **hide** ship as a user-visible, reversible filter in addition to delete? | Not in MVP; documented only (AS-12) | Low - a filter plus a label distinction on history rows |
| Q-10 | **Delete-everything app data** - is a bulk "erase all data" control wanted beyond per-result deletion? | Not specified. No such route exists | Medium - affects backup/restore and audit rules |

Pre-existing owner items still open and **not** decided by this revision: U-2, U-3, U-4 of
`AUDIT_FINDINGS_RESOLUTION.md` §10 (U-1 is superseded by the Materi decision). Nothing in this revision
depends on them.

---

## 9. Risk and audit updates

- `RISK_REGISTER.md`: R-6 reworded to "non-CPNS rule laundering"; new R-11...R-16 (clock, job loss, false
  backup success, sampling confidence, deletion distortion, local data loss).
- `docs/AUDIT.md`: Round 4 with AUD-58...AUD-71 (`resolved`). **AUD-72 is now `resolved`** (Rencana Belajar
  out of MVP). No finding ID was added, removed or renumbered; one existing row (**AUD-53**) had its
  *wording* updated to the renamed tier and says so in the row; two items (DB-1, the BR-E2 approval gate) are
  marked **superseded**, not deleted.
- `docs/decisions/ADR-004-exam-config-states.md`: decision text corrected to the score/verdict split. No
  new ADR was created; the change is a correction of the same decision, recorded in AUD-59.

---

## 10. What was not done

Stated explicitly so the reader does not infer more than was delivered.

- **No source code was written or changed.** `git diff -- frontend backend` is empty. The deviations in
  §6 remain in the working tree as they were.
- **No dependency, package or lockfile change.**
- **No test suite, test framework, build, lint or typecheck was run** - none is required at the
  documentation gate.
- **No Git operation** - no commit, no staging, no push, no identity change.
- **No data or migration file was deleted.** Where a decision made a stored value unused, the row stays and
  is marked `legacy`.
- **No UI-language change**: UI copy stays Indonesian; docs, code and comments stay English.
- **No new feature beyond the eleven decisions.** The one borderline addition - the material bank - is a
  direct consequence of decision G and is recorded as such (AUD-64). Two capabilities that the revision had
  kept by inference were **removed** by the 2026-11-08 correction: cancel of a generation job (§12.1) and the
  standalone Rencana Belajar feature (§12.3). AS-2, AS-8 and AS-10 are withdrawn. The anti-laundering guard for non-CPNS instruments is
  **kept** (§3.2) because removing it would violate an `AGENTS.md` non-negotiable.
- **No unverified regulation was introduced.** No threshold, duration or weight was invented; AS-6 and AS-7
  are product constants, not exam rules, and no sampling quota is in force.

---

## 11. Approval request

The documentation set is internally consistent, every decision A-K has a canonical home, all contracts
resolve through domain -> DB -> API -> frontend, and the open questions in §8 (Q-1 resolved, Q-3
withdrawn, Q-2/Q-4/Q-5/Q-6/Q-7/Q-8/Q-9/Q-10 still open) are recorded rather than assumed.

What the owner is being asked to approve:

1. **The revision itself** - decisions A-K as written, plus the flagged assumptions in §7 (AS-2, AS-8,
   AS-10 withdrawn; AS-11, AS-12 added).
2. **The 2026-11-08 correction** in §12 - cancel removed, sampling quota unresolved, Rencana Belajar out of
   MVP, deletion semantics separated, config resolution internal.
3. **Q-2, Q-4, Q-5, Q-6, Q-7, Q-8, Q-9, Q-10** - or an explicit "accept the documented default" for any of
   them. Q-4 (sampling quota) and Q-8 (permanent purge) are the two that hold a shipped behaviour open.
4. **U-2, U-3, U-4** - still open from `AUDIT_FINDINGS_RESOLUTION.md` §10. Nothing here depends on them,
   but they block the corresponding backend screens.

On approval, the next unit of work is the Gate-2 frontend re-alignment (§6, F-1...F-14). No code has been
written in this revision.

**Awaiting the Product Owner's decision on this revision, on §12, and on the open questions in §8, before
any frontend or backend implementation resumes.**

---

## 12. Correction run - 2026-11-08 (Product Owner review)

The Product Owner accepted the revision as a working draft but withheld approval and listed five
corrections and no other change. This section records what each correction changed, where, and what is
still open. Every other document was touched only where a cross-reference, enum or count depended on a
corrected value.

### 12.1 Generation-job cancellation removed end to end

The older cancel requirement is **superseded** by the Product Owner decision: MVP generation jobs support
**no pause, no resume and no cancel**. Only `queued`, `running`, `completed`, `failed` and `interrupted`
remain.

| Surface | Change |
|---|---|
| `GENERATION_JOBS.md` §2 | `JobStatus` is the closed five-state set; `cancelling` removed; explicit "no pause, no resume, no cancel" rule; batch status is `completed \| failed \| interrupted`; restart table no longer finalises a cancelled job |
| `QUESTION_GENERATION.md` §5 | Retitled "Batching, partial output"; cancel bullet removed; a job runs to completion |
| `API_ENDPOINTS.md` §8 | `POST /generation-jobs/:id/cancel` removed; a sentence states the absence is deliberate |
| `DATABASE_SCHEMA.md` | `generation_batch.status` domain is `completed \| failed \| interrupted` |
| `ERD.md` | `GENERATION_JOB.status` domain no longer lists `cancelling` |
| `FRONTEND_API_MAPPING.md` | E52 deleted; **E52 is a retired id, never reused**; route count recounted |
| `FRONTEND_DATA_CONTRACTS.md` | `GenerationJob.status` and batch status narrowed; no cancel state |
| `FRONTEND_PAGE_SPECIFICATIONS.md` §7 | Cancel button and "Membatalkan" status word removed; explicit no-cancel statement |
| `FRONTEND_COMPONENT_ARCHITECTURE.md`, `FRONTEND_INFORMATION_ARCHITECTURE.md` | "cancel" dropped from the component and screen descriptions |
| `PRD.md` FR-G2, `MVP_SCOPE.md` §1/§2, `FEATURE_MATRIX.md`, `USER_STORIES.md` | Text and feature rows updated; cancel listed as out of scope with its reopen condition |
| Exam-session clock | **Unchanged.** `SCORING_METHODOLOGY` §8.1 pause/resume of the accumulated active-time countdown is a different mechanism and was not touched |

Q-3 is removed from §8.

### 12.2 Sampling quota is an unresolved product parameter

| Surface | Change |
|---|---|
| `QUESTION_SPECIFICATION.md` §6.2 rule 3 | Rule states that the quota is **not approved**; no size is fixed and none is assumed; the contract carries `sampleSize` |
| `MVP_SCOPE.md` §4 | No formula; only the workflow is in scope |
| `QUESTION_GENERATION.md` §1 | Reviews "the sample the backend drew" with its stated size |
| `VALIDATION.md` | Explicitly states that no minimum sample size is enforced until approval |
| `FRONTEND_PAGE_SPECIFICATIONS.md` §7, `USER_STORIES.md` US-B3 | UI renders the backend's `sampleSize`; never derives it |
| `FEATURE_MATRIX.md` | Row marked "(sampling **quota unresolved**)" |
| `SYSTEM_REVISION_REPORT.md` | AS-2 withdrawn; Q-4 reworded to the open quota question |

The validation and sampling **workflow** (T -> Q -> K -> S, quarantine, selective repair, re-validation,
re-sampling, post-publication withdrawal) is intact and unchanged.

### 12.3 Standalone Rencana Belajar removed from MVP

Two concepts are now separated:

1. **Recommendations shown in results and Progres** - approved and unchanged (deterministic weaknesses,
   evidence, material offer, drill target).
2. **A standalone study-plan feature** - screen, route, user-editable plan, proposal-diff, `/study-plan`
   routes, `study_plan` table - **not approved, out of MVP**.

| Surface | Change |
|---|---|
| `RECOMMENDATION_ENGINE.md` §7 | Rewritten as "Learning sequence - not a standalone feature"; the approved deterministic order + AI explanation stays |
| `RECOMMENDATION_SERVICE.md` §2 | "Propose study plan" step replaced by "Order the sequence" |
| `API_ENDPOINTS.md` §11 | `GET /study-plan` and `PUT /study-plan` removed; **E76/E77 retired ids** |
| `DATABASE_SCHEMA.md` | `study_plan` marked **not in MVP**; no plan table exists |
| `FRONTEND_ROUTING.md`, `FRONTEND_INFORMATION_ARCHITECTURE.md` | `/progres/paket` removed from the route table |
| `FRONTEND_RESULTS_ANALYTICS.md` §8 | Rewritten: no plan screen; the sequence renders inline (Progres block 12) |
| `FRONTEND_PAGE_SPECIFICATIONS.md` §9, `FRONTEND_PRD.md`, `FRONTEND_IMPLEMENTATION_PLAN.md`, `FRONTEND_GAP_REGISTER.md` (GAP-F12, U-F6) | References corrected; "no Rencana Belajar screen in MVP" stated |
| `PRD.md` §5, UC-07, FR-L5/L6; `USER_STORIES.md` US-L4; `USER_JOURNEYS.md`; `FEATURE_MATRIX.md`; `DATA_FLOW.md` §5; `SYSTEM_ARCHITECTURE.md` | Reworded to the learning sequence; "Rencana Belajar" listed as an out-of-MVP term |
| `MVP_SCOPE.md` §2 | Standalone plan listed as out of scope with its reopen condition |
| `docs/AUDIT.md` AUD-72 | Marked **resolved** |

AS-8 and AS-10 are withdrawn. Historical audit records of the proposal are retained.

### 12.4 History deletion: hide vs. delete vs. purge

`ANALYTICS_ENGINE.md` §7 was rewritten around three distinct operations:

| Operation | Stored effect | Status |
|---|---|---|
| **Hide** | none - a view filter over rows still present and still counted | documented, not shipped (Q-9) |
| **User deletion** (MVP) | session, answers, snapshot and result removed in one transaction; one content-free `session_deletion` tombstone retained | in scope |
| **Permanent purge** | physical erasure including the tombstone | **unresolved, not implemented** (Q-8) |

- The earlier claim that deletion makes the data "gone permanently" is **withdrawn** everywhere
  (`ANALYTICS_ENGINE`, `SCORING_METHODOLOGY` §7, `FRONTEND_RESULTS_ANALYTICS` §5.3, `DATABASE_SCHEMA`,
  `ERD`, `BUSINESS_RULES` BR-L4).
- The tombstone's exact contents are documented: `sessionId`, `mode`, `startedAt`, `finishedAt`,
  `questionCount`, `configId`, `configVersion`, `deletedAt`, `deletionKind` - no answers, no stem text, no
  score.
- The delete dialog copy states five true consequences, including that an earlier backup may still contain
  the pre-deletion database and that a content-free record remains.
- Derived analytics and recommendations **exclude deleted history by construction** (derived-on-read over
  present rows), not by a client filter.
- Immutable results are preserved until the user explicitly deletes them.

### 12.5 Config resolution when no verified config exists

New canonical subsection `CPNS_2026_REGULATIONS.md` §4.2.1. Resolution is **internal to package management
and session creation**; the learner never selects a config.

| Order | Candidate |
|---|---|
| 1 | the package version's pinned config, if still usable |
| 2 | the latest usable CPNS config for the mode - `official_verified`, else `provisional` |
| 3 | `409 reason:"no_usable_config"` - only when no CPNS config is startable at all |

- `legacy` (non-CPNS) rows are never candidates.
- **A package cannot require a verified config.** A `provisional` config is startable; the score is computed
  on it; the result is labelled **Belum Terverifikasi** and carries **no verdict**.
- Communication without a selection step: nothing on the package list, package detail, runner header;
  the label appears only on the result footnote and in Kelola -> Konfigurasi Ujian;
  Kelola -> Manajemen Paket states a package's config pin and its state.
- **No missing regulation value is invented**; unknown counts or rules make the package unavailable with a
  reason rather than fabricate a parameter.
- Session snapshots preserve the exact config used (identity, state, basis hash, unverified warnings).

Propagated to `PACKAGE_SPECIFICATION` §3, `API_SPECIFICATION` §7.4 (new "Config resolution" row),
`API_ENDPOINTS` §3, `FRONTEND_PAGE_SPECIFICATIONS` §3 and §17. Assumption AS-11 records the optional pin.

### 12.6 Contract chain, traceability and counts after the correction

| Link | Change |
|---|---|
| Domain -> DB | `generation_batch.status` domain shrunk; `study_plan` marked not in MVP; `session_deletion.deletionKind` added |
| DB -> API | `/generation-jobs/:id/cancel`, `/study-plan` GET/PUT removed; `POST /packages/:id/sessions` gains the resolution order |
| API -> frontend | E52, E76, E77 retired; `GenerationJob` and `History` contract comments updated; screen specs match |
| Route table | `/progres/paket` removed; `/lainnya/paket/:id` gains the config-pin row |
| **Route count** | `API_ENDPOINTS`: **74** (was 77; the 74th is `POST /questions/bulk`, whose route row was added on 2026-11-09 by the targeted repair, [POST_REPAIR_REPAIR_REPORT](./POST_REPAIR_REPAIR_REPORT.md) §4). `FRONTEND_API_MAPPING`: 74 ids (E01-E77 minus E52, E76, E77), 73 called by a screen, 1 launcher-only (E72), 70 supported, 4 partial. The numbers reported by this correction (73/73/72/69) were wrong by one; the arithmetic error is [POST_REPAIR_INTEGRITY_AUDIT](./POST_REPAIR_INTEGRITY_AUDIT.md) PR-15 |
| Frontend route count | **26** (was 27; `/progres/paket` removed) |
| Traceability | Every FR in `PRD.md` §9 still maps to a `FEATURE_MATRIX` row; FR-G2, FR-L5 and FR-L6 were **re-worded**, not removed, so the ids remain traceable |
| Retired ids | E52, E76, E77 are retired permanently and must not be reused |

### 12.7 Defects found and repaired while applying the corrections

Stated for honesty; all are documentation-only and none affects a product rule.

- A shell-based text replacement corrupted several documents (dropped letters inside identifiers, mangled
  `§`, `->` and em dashes). Six files were affected: `SYSTEM_ARCHITECTURE`, `ERD`,
  `SCORING_METHODOLOGY`, `FRONTEND_RESULTS_ANALYTICS`, `FEATURE_MATRIX`, `PRD`.
  **Correction (2026-11-09):** the claim that every affected token was repaired was false for five of
  those six files; the scan behind it searched a fixed list of spellings and missed every token whose
  leading `A` had been eaten. [POST_REPAIR_INTEGRITY_AUDIT](./POST_REPAIR_INTEGRITY_AUDIT.md) found 154
  damaged lines in 6 files, including semantic damage in `SCORING_METHODOLOGY` and `PRD`. The repair and
  its per-token provenance are recorded in [POST_REPAIR_REPAIR_REPORT](./POST_REPAIR_REPAIR_REPORT.md).
- Five section references into `ANALYTICS_ENGINE` §7 were retargeted after §7 was restructured
  (`§7.2 -> §7.3`, `§7.3 -> §7.4`, `§7.4 -> §7.6`).

### 12.8 Remaining Product Owner decisions

Nothing else is blocked. These are the items on which this revision deliberately did **not** decide:

| # | Decision | Why it is open |
|---|---|---|
| Q-4 | Sampling quota for a generated batch | The workflow is specified; the number is not approved and no replacement is assumed |
| Q-8 | Whether permanent purge of a deleted session must ever exist | Tombstoning is not permanent deletion; no purge is implemented until approved |
| Q-9 | Whether a reversible "hide" ships alongside delete | Only the distinction is documented today |
| Q-10 | Whether a bulk "erase all app data" control is wanted | Not specified; no route exists |
| Q-2 | Whether Progres must name the config version when a comparison is blocked | Prose today, to keep config out of Belajar |
| Q-5 | Retention defaults (7 backups / 30 days) | Product constant, owner may change freely |
| Q-6 | Whether an edited manual question ever needs sampling | Not required today |
| Q-7 | Whether the notification centre joins the dock | Shell bell today |
| U-2, U-3, U-4 | Pre-existing items in `AUDIT_FINDINGS_RESOLUTION.md` §10 | Unchanged by this revision |

**No implementation, dependency, test, build or Git operation was performed in this correction.**
