# Independent Technical & Product Documentation Audit

Auditor: independent pass, no assumption that the prior `PASSED` verdict was correct.
Date: 2026-11-08 · Scope: the full 64-document planning set · Mode: read-only audit.

Status: **audit complete — findings reported, no document corrected.**

> **Superseded where it states the MVP contract.** This file is a historical record and is kept unchanged
> on purpose. Two of its rows describe behaviours that the Product Owner later removed: generation-job
> cancellation (`POST /generation-jobs/:id/cancel`) and the standalone study plan (`GET`/`PUT /study-plan`,
> FR-L5 as an editable plan). The live contract is `GENERATION_JOBS.md` §2 and `RECOMMENDATION_ENGINE.md` §7;
> the change is recorded in `SYSTEM_REVISION_REPORT.md` §12.
Remediation and the Gate 1 decision await owner approval.

---

## 1. Executive summary

Sixty-four Markdown documents were read in full. The set is unusually disciplined on its two hardest
axes — regulatory honesty (no fabricated CPNS 2026 instrument, pathway separation enforced) and
scoring determinism (pure function, snapshot-bound, ordered preflight). Those areas pass.

The failures are not in the rules. They are at the **seams between documents**, exactly where a
documentation set has no compiler to catch drift. Three failures matter:

1. **The contract pair disagrees with itself.** `SCORING_METHODOLOGY.md` §2.2 defines `ScoreResult`
   with `byTest` / `byQuestion`; `API_SPECIFICATION.md` §5, `FRONTEND_DATA_CONTRACTS.md` §3 and
   `DATABASE_SCHEMA.md` §2 all use `sections` / `perQuestion`. Thresholds have three incompatible
   shapes (`ThresholdSet`, `ThresholdSummary`, `{naikTotal, naikTiu}`). If Gate 2 builds against the
   frontend contracts and Gate 3 implements the scoring doc, the two halves cannot be joined without
   a rename — which is a contract break discovered after both gates have passed.

2. **The question lifecycle has two incompatible definitions.** `QUESTION_SPECIFICATION.md` §3 and
   `AI_VALIDATION.md` §1 define five states; `BUSINESS_RULES.md` BR-Q3, `DATABASE_SCHEMA.md` §2 and
   `API_ENDPOINTS.md` §3 define three. The five-state machine is the one carrying the core guarantee
   ("no path from `draft` to `active` skips the user"). The three-state version silently deletes
   `human_reviewed`, which *is* that guarantee.

3. **User journeys call endpoints that do not exist.** `USER_JOURNEYS.md` J-1 and J-4 use
   `PATCH /questions/:id/accept`, `POST /exam-configs/:id/approval` and `POST /sessions/:id/score`.
   None appear in `API_ENDPOINTS.md`. Two of them are the acceptance path described in PRD §13.1.

Separately, the regulatory record has a **provenance defect** (REG-1/REG-2, §8): the 321/2024 table
omits Diktum KETIGA and KEEMPAT, so the 130-minute duration is recorded without the fact that it is
scoped to a disability exemption. The number in the doc is correct; the missing scope is not
disclosed. Given that regulatory honesty is the project's first non-negotiable, this is the most
damaging finding in the set, even though its practical effect on the shipped provisional config is
limited.

**Verdict: `CONDITIONAL PASS`.** No `CRITICAL` finding — nothing here would produce a wrong score or a
security breach once built correctly against either side. But the set is not safe to open Gate 1 on
as written: Gate 2 would freeze the wrong `ScoreResult` shape and the wrong lifecycle into a mock
layer, and ADR-006 makes the mock layer the contract the backend must match.

Remediation is small and localised: 6 `HIGH`, 11 `MEDIUM`, 9 `LOW`, 2 `INFO`. None requires new
design — every fix is one document agreeing with another that is already correct.

---

## 2. Scope and method

**Constraints observed.** No source file was created or modified. No git operation. No provider,
model or AI configuration touched. No product scope or decision changed. No document corrected.
The only file written is this report, plus the pointer line added to `docs/AUDIT.md` that the
request explicitly called for.

**Method.**

1. Every one of the 64 Markdown files was read in full, not sampled.
2. Documents were read in dependency clusters, not alphabetically, so a rule and its consumers sat in
   context together: examination cluster (regulations → taxonomy → question spec → scoring),
   backend cluster (API → schema → ERD → endpoints → validation → errors → rules), AI cluster
   (provider → prompt → generation → validation → recommendation), frontend cluster (PRD → IA →
   routes → pages → components → state → contracts → design → a11y), product cluster
   (PRD → stories → journeys → matrix → scope), and the decision/roadmap cluster.
3. `PRD.md` was treated as the primary source of product requirements. Where another doc departs from
   it, the departure is reported, not reconciled silently.
4. Regulatory claims were checked against the primary instruments cached under `.research/`
   (`kepmen321_2024.txt`, `kepmen406_2026.txt`, and page images `k321_p4..p6.jpg`), not against the
   project's own summary of them.
5. Every finding carries a file, a section or line number, and a quoted or paragraphed artefact.
   Anything that could not be checked against a source is marked `NOT VERIFIED` and is not counted
   as passing.

**What this audit could not do**, and why it is stated rather than glossed:

- No runtime exists, so "does the contract hold" is a textual comparison, not an execution.
- The 321/2024 full text is available and was used. The 406/2026 text is available and was used.
  Permen PANRB 6/2024 is cached but was only spot-checked for the Pasal 30 / Pasal 31 citations.
- The 2021 SKD claim (110 soal / 100 minutes) is recorded in the regulations doc as `HISTORICAL`
  with the note "title only; body not extractable". That is honestly recorded and was **not**
  independently confirmed. Marked `NOT VERIFIED` below.

---

## 3. Documents examined

All 64. Counts by directory:

| Location | Files | Examined |
|---|---|---|
| root (`AGENTS.md`, `BACKEND_TEMP.md`, `README.md`) | 3 | 3 |
| `backend/README.md` | 1 | 1 |
| `docs/` (`AUDIT.md`, `README.md`) | 2 | 2 |
| `docs/ai/` | 5 | 5 |
| `docs/architecture/` | 5 | 5 |
| `docs/backend/` | 14 | 14 |
| `docs/decisions/` (ADR-001…010 + README) | 11 | 11 |
| `docs/examination/` | 4 | 4 |
| `docs/frontend/` | 11 | 11 |
| `docs/product/` | 5 | 5 |
| `docs/roadmap/` | 2 | 2 |
| `frontend/README.md` | 1 | 1 |
| **Total** | **64** | **64** |

Primary instruments cross-checked outside the doc set: `.research/kepmen321_2024.txt`,
`.research/kepmen406_2026.txt`, `.research/k321_p4.jpg`, `.research/k321_p5.jpg`,
`.research/k321_p6.jpg`, `.research/pr_cpns2026.txt`.

---

## 4. Area A — Scoring → Analytics → Frontend field traceability

### 4.1 The traceability matrix

`✗` = the field does not exist downstream under any name. `≠` = exists but renamed, and the rename
is not documented as an alias.

| Source field (SCORING §2.2) | Analytics (§6 `AnalyticsSnapshot`) | API field (API_SPEC §5) | Frontend consumer (CONTRACTS §3) | Verdict |
|---|---|---|---|---|
| `total: Bucket` | — (analytics stores no session total) | `total` | `ScoreResult.total` | OK |
| `byTest: Record<Test,Bucket>` | `perTest` (derived) | **`sections`** | `sections` | **≠** API-1 |
| `byCompetency: Record<string,Bucket>` | `perCompetency` | ✗ absent from ScoreResult | ✗ | **≠** ANA-1 |
| `byQuestion: Array<{...}>` | — | **`perQuestion`** | `perQuestion` | **≠** API-1 |
| `byQuestion[].maxScore` | — | ✗ (contract says `possible`) | `perQuestion[].possible` | **≠** API-1 |
| `byQuestion[].selected` | — | ✗ absent | ✗ absent | **≠** QS-2 |
| `byQuestion[].correct` | — | `correct` | `correct: ItemCorrect` | OK |
| `snapshotVersion: string` | — | **`"2"`** (numeric-looking) | `string` | **≠** API-1 |
| `configId` | `configId` | `configId` | `configId` | OK |
| `configVersion` | `configVersion` | ✗ absent | ✗ | **≠** API-5 |
| `scoringVersion` | `scoringVersion` | ✗ absent | ✗ | **≠** API-5 |
| `approval?: ScoreApprovalRef` | — | `approval` | `ProvisionalApproval \| null` | **≠** API-6 |
| `thresholds: ThresholdEvaluation` | — | `{naikTotal, naikTiu}` | `{naikTotal, naikTiu?}` | **≠** API-2 |
| `MetricValue.value` (ratio 0..1) | `MetricValue.value` | percent int 0–100 | `MetricValue.percent` | **≠** ANA-3 |
| `MetricValue.state` | `state` | ✗ absent | ✗ (contract §4 says flags arrive) | **≠** ANA-4 |
| — | `responseTime.medianSeconds` | ✗ absent from `AnalyticsSnapshot` API field list | — | **≠** ANA-5 |
| — | `difficulty` | — | — | OK |

### 4.2 Findings

**API-1 (HIGH) — `ScoreResult` has two incompatible shapes.**
`SCORING_METHODOLOGY.md` §2.2 declares `byTest` and `byQuestion`, and each `byQuestion` element
carries `maxScore` and `selected`. `API_SPECIFICATION.md` §5, `FRONTEND_DATA_CONTRACTS.md` §3 and
`DATABASE_SCHEMA.md` §2 (`totalJson, sectionsJson, perQuestionJson`) all use `sections` and
`perQuestion`, with `possible` instead of `maxScore` and no `selected`. `API_SPECIFICATION.md` §5
even states the payload is "the `ScoreResult` shape defined in SCORING_METHODOLOGY.md §2.2" — a
claim its own example then contradicts.
Impact: the mock layer (`FRONTEND_MOCK_DATA_STRATEGY.md`) is built to the frontend contract; the
backend is built to the scoring doc. ADR-006 makes the mock the de-facto contract. The mismatch
surfaces at Gate 3 as a breaking rename across every result, review, and analytics screen.
Recommendation: `SCORING_METHODOLOGY.md` §2.2 is canonical and is named as such by the others —
so either the backend adopts `sections`/`perQuestion`/`possible` and §2.2 is amended through the
audit register, or the other three change. Decide once, in the regulation-canonical direction.
Affects: SCORING §2.2, API_SPEC §5, CONTRACTS §3, DATABASE_SCHEMA §2, ANALYTICS §1.

**API-2 (HIGH) — threshold shape has three incompatible definitions.**
Canonical `ThresholdSet` (`SCORING_METHODOLOGY.md` §5) is
`{mode, TWK?, TIU?, TKP?, total?, source: BasisRef}`. `API_SPECIFICATION.md` §5 emits
`"thresholds": { "naikTotal": 311, "naikTiu": 80 }`. `FRONTEND_DATA_CONTRACTS.md` §3 declares
`{naikTotal: number; naikTiu?: number}`. `DATABASE_SCHEMA.md` §2 stores
`naikTotal, naikTiu, affirmationTotal, affirmationTkp`.

Note the second-order problem: `naikTotal` = 311 is the **cumulative** threshold (KETIGA BELAS of
321/2024; KESEPULUH of 406/2026) and is not the `ThresholdSet.total` field, which under `mode:
'per_subtest_and_total'` means *cumulative* only in the same sense. Whether `naikTotal` and
`ThresholdSet.total` are the same quantity is not stated anywhere. A reader cannot tell.

Also: `ThresholdSet` has no `affirmation*` field at all, so `DATABASE_SCHEMA.md`'s
`affirmationTotal` / `affirmationTkp` columns trace to no scoring rule. The 321/2024 instrument does
carry affirmation exemptions (Diktum KESEMBILAN, 406/2026 Diktum KESEMBILAN), so the columns are
modeling something real that the scoring doc does not define.

Impact: the approval dialog shows "the effective thresholds" (FR-E3) from a shape that is not the
shape thresholds are evaluated in.
Recommendation: define one `ThresholdSummary` as the wire projection of `ThresholdSet`, name it in
`SCORING_METHODOLOGY.md` §5, and have API/CONTRACTS/schema reference it. Explicitly state whether
the cumulative threshold is `total`, `naikTotal`, or both.
Affects: SCORING §5, API_SPEC §5, CONTRACTS §3, DATABASE_SCHEMA §2, ERD, PAGES §10.

**ANA-1 (MEDIUM) — `byCompetency` never reaches the frontend, and prefix roll-up is unspecified.**
`ScoreResult.byCompetency` is keyed by leaf id. `COMPETENCY_TAXONOMY.md` §7 rule 2 requires
analytics to aggregate "at any level by prefix match (`TIU.NUMERIK.*`)". `ANALYTICS_ENGINE.md` never
states that transform: §2.2 defines per-competency metrics over `perCompetency` without saying
whether keys are leaves, domains, or both. `API_SPECIFICATION.md` §5's example omits `byCompetency`
entirely.
Impact: US-A1 / FR-A1 require per-competency accuracy; the review screen needs leaf-level, the
dashboard needs domain-level. Neither side owns the roll-up.
Recommendation: state in `ANALYTICS_ENGINE.md` §2 that `perCompetency` contains both leaf and
ancestor keys (or an explicit roll-up rule), and add `byCompetency` to the API example.

**ANA-3 (MEDIUM) — metric value is a ratio in one doc and an integer percent in another.**
`ANALYTICS_ENGINE.md` §6 declares `MetricValue { value: number /* 0..1 */; ... }`.
`FRONTEND_DATA_CONTRACTS.md` §3 declares `MetricValue { percent: number; ... }` with integer
percent. `API_SPECIFICATION.md` §1 mandates "Integers only … `0.55` is wrong" and "Percentages are
integer 0–100".
Impact: the one rule the project states loudest ("no floats in scoring-related output") is broken by
the canonical analytics type. A frontend built to §3 will show `0` for every value if it receives
the backend's ratio, or vice versa.
Recommendation: `ANALYTICS_ENGINE.md` §6 emits `percent: 0..100` integer plus counts, matching
API_SPEC §1. The ratio stays internal.

**ANA-4 (MEDIUM) — sample-status cannot travel.**
`ANALYTICS_ENGINE.md` §3.2 defines `reportable | insufficient_data | zero_correct | zero_attainment`
inside `MetricValue`, and `FRONTEND_DATA_CONTRACTS.md` §4 says these "come as explicit flags from
analytics". But CONTRACTS §3's `MetricValue` has no `state` field, and API_SPEC gives no
`AnalyticsSnapshot` schema at all. `RECOMMENDATION_SERVICE.md` §1 says it receives "sample-status
flags" — the field is assumed to exist by three docs and declared by none that the frontend reads.
Impact: FR-A4 (zero vs insufficient) and BR-L2 depend entirely on this field; the UI cannot render
"Belum cukup data (n=…)" without it.
Recommendation: add `state` to the shared `MetricValue` and publish the `AnalyticsSnapshot` schema
in `API_SPECIFICATION.md` (currently it only exists in `ANALYTICS_ENGINE.md` §6).

**ANA-5 (LOW) — response time: PRD says mean, analytics computes median.**
PRD FR-A1 and MVP_SCOPE §1 say "mean response time". `ANALYTICS_ENGINE.md` §2.3 defines it as the
**median** of `answeredAt` deltas, and API_SPEC §1 says "mean response time is a median over ms" —
which is internally contradictory in a single sentence.
Recommendation: median is the correct statistic for response times (outliers). Amend PRD FR-A1 to
"median response time" and fix API_SPEC §1's wording. This is a real product-requirement change, so
it needs the owner, not a silent edit.

---

## 5. Area B — API → Database endpoint traceability

### 5.1 The matrix

| Endpoint | Service / business rule | Tables | Transaction | Error contract |
|---|---|---|---|---|
| `GET /bootstrap` | Bootstrap assembly | taxonomy(competency), exam_config, provider, question counts | read-only | — |
| `GET /exam-configs` | BR-E4 | exam_config | read-only | — |
| `GET /exam-configs/:id` | — | exam_config, basis_ref, thresholds | read-only | 404 `NOT_FOUND` |
| `POST /exam-configs/:id/approve` | BR-E2, BR-E3; VALIDATION §2 | provisional_approval | single insert | 400, 404, 409 |
| `GET /questions` | — | question | read-only | 400 `VALIDATION_FAILED` |
| `GET /questions/:id` | — | question, competency | read-only | 404 |
| `POST /questions` | BR-Q1 | question | insert | 400 |
| `PATCH /questions/:id` | BR-Q2, BR-Q3 | question | update | 400, 404 |
| `POST /questions/:id/activate` | BR-Q2 (V-01…V-12) | question, (validation record — **no table**) | update | 409 |
| `POST /questions/:id/archive` | BR-Q3 | question | update | 409 |
| `POST /questions/bulk` | FR-Q4, atomic | question | **transactional batch** | 400, 409 |
| `POST /generation-jobs` | FR-G1 | generation_job, generation_batch | insert; **shape unresolved** | 400, 502, 504, 429 |
| `GET /generation-jobs/:id` | FR-G2 | generation_job, generation_batch, question | read-only | 404 |
| `POST /generation-jobs/:id/cancel` | GENERATION_JOBS §2 | generation_job, generation_batch | update | 409 |
| `GET /providers` | FR-C1, FR-C6 | provider, secret_ref | read-only | — |
| `POST /providers` | BR-A1 | provider **+ secret store (outside schema)** | **two-phase; not specified** | 400, 409 |
| `PATCH /providers/:id` | BR-A1, BR-A3 | provider, secret_ref | update | 400, 404 |
| `DELETE /providers/:id` | — | provider, secret_ref, **generation_job FK** | cascade rule **unstated** | 404 |
| `POST /providers/:id/test` | FR-C2 | provider, secret_ref | **no write** | 502, 504, 429 |
| `POST /providers/:id/models` | FR-C3 | provider | update (model cache — **no column**) | 502, 504, 429 |
| `PUT /providers/:id/task-map` | FR-C4, FR-C5 | provider (`capabilityFlagsJson`) | update | 400, 404 |
| `POST /sessions` | PF-00, FR-T1 | session, session_snapshot | **two-table atomic** | 400, 409 |
| `GET /sessions/:id` | — | session, session_snapshot | read-only | 404 |
| `PATCH /sessions/:id/answers` | FR-T4, NFR-3 | answer_sheet | upsert | 400, 404 |
| `POST /sessions/:id/submit` | PF-00…PF-13, SC-01…SC-08, BR-E3 | session, session_snapshot, answer_sheet, score_result, **exam_config(current)**, **provisional_approval** | **atomic score-or-blocked** | 400, 404, 409, 422 |
| `GET /sessions/:id/result` | — | score_result | read-only | 404, 409 |
| `GET /analytics` | ANALYTICS §2–§6 | score_result, answer_sheet, question, session, session_snapshot | read-only, **cross-config filtering unstated** | — |
| `GET /recommendations/weaknesses` | FR-L1, BR-L2, RECOMMENDATION §2 | score_result, competency | read-only | — |
| `GET /recommendations/materials` | FR-L3 | **material table does not exist** | read-only | 400 |
| `POST /recommendations/drill` | FR-L4 | session (via practice) | insert | 400 |
| `GET /study-plan` | — | study_plan | read-only | — |
| `PUT /study-plan` | FR-L5, FR-L6 | study_plan | update | 400 |

### 5.2 Findings

**DB-1 (HIGH) — the `material` entity has no table, no endpoint, and no creation path.**
FR-L3 requires "recommend learning material per weakness (AI-generated or user-authored)".
`RECOMMENDATION_ENGINE.md` §4 and `RECOMMENDATION_SERVICE.md` §2.3 both assume a material bank.
`API_ENDPOINTS.md` §7 exposes `GET /recommendations/materials` and nothing else — no create, no
edit, no storage. `DATABASE_SCHEMA.md` §2 has no `material` table. `score_result`'s neighbor
`study_plan` is described as "the only stored analytics-adjacent row"; there is nowhere for a
material to live.
Impact: O-3 ("every identified weakness leads to a recommended material") and success metric
"100% of surfaced weaknesses → material + drill" are unachievable as specified.
Recommendation: add a `material` table (id, competencyId, provenance, content, createdAt) and
`POST/PATCH /materials`, or explicitly scope materials to `no_material` in MVP and correct PRD.
This is a product-scope decision, so it is the owner's call.

**DB-2 (HIGH) — the question `validation` / `lifecycle` history state has no persistence.**
`QUESTION_SPECIFICATION.md` §1 puts `validation?: ValidationRecord` and `lifecycle: Lifecycle` on the
question, and §4 defines `ReviewHistory`. FR-Q2 requires "row detail shows all validation checks and
review history". `DATABASE_SCHEMA.md` §2's `question` table has a single `lifecycle TEXT` column and
no `validationJson`, no `reviewHistoryJson`, no `validation` table. `PATCH /questions/:id` returns
200 with no stated persistence for the review trail.
Impact: FR-Q2 and US-B6 cannot be satisfied; the audit trail behind "no path from draft to active
skips the user" (USER_JOURNEYS J-5) is not stored, so the guarantee is unverifiable after the fact.
Recommendation: add `validationJson` and a `question_review` table, or state that
`ReviewHistory` is derived.

**DB-3 (MEDIUM) — `submit` reads live `exam_config` / `provisional_approval` while the doc says it
reads only the snapshot.**
`DATA_FLOW.md` §3 and SYSTEM_ARCHITECTURE §4 state "the score pipeline reads **only** the snapshot".
BR-E3 / PF-13 require comparing the snapshot's approved values against the **current** config to
detect drift — which is a live-table read by definition. Both statements are true for different
steps, but no doc says so. `DATABASE_SCHEMA.md` §1 "Snapshot-first: score reads snapshots, never the
live question/config tables" contradicts BR-E3 as written.
Impact: an implementer following §1 literally reintroduces silent approval drift — the exact failure
ADR-004 exists to prevent.
Recommendation: state the two-step rule explicitly: *preflight* reads live config to detect drift
(this is the approval check); *scoring* reads only the snapshot. Amend DATABASE_SCHEMA §1.

**DB-4 (MEDIUM) — provider create/delete span the schema boundary with no transaction rule.**
`POST /providers` writes `provider` (SQLite) and a secret (secret store, outside SQLite —
`SECRETS.md` §2). `DELETE /providers/:id` must remove the secret and handle `generation_job.providerId`
FK (ERD line 18). No doc specifies what happens when one half succeeds. `generation_job` has no
`ON DELETE` rule stated anywhere.
Impact: an orphaned secret (key retained after provider deletion) is precisely the leak class
R-8/NFR-7 exists to prevent.
Recommendation: state create order (secret first, then row, compensate on failure) and delete
order (row first, then secret purge). Add a `ON DELETE` note to the ERD.

**DB-5 (MEDIUM) — `GET /analytics` merges sessions scored under different configs.**
FR-A5 and ANALYTICS §5 require a comparability gate when `configVersion` / `scoringVersion` differ.
`API_ENDPOINTS.md` §6 exposes one `GET /analytics` with no config parameter, and
`ANALYTICS_ENGINE.md` §6's `AnalyticsSnapshot` is a single flat object carrying one
`configId/configVersion/scoringVersion` triple. How a mixed dataset is represented — filtered to the
latest config, or per-config snapshots — is not stated.
Impact: FR-A5's promise (never compare incompatible configs silently) has no contract behind it.

**DB-6 (LOW) — `UPDATE /analysis`: `POST /questions/bulk` is atomic across N rows, but
`POST /sessions` freezes two tables (session + snapshot) with no stated atomicity.

**DB-7 (LOW) — `POST /providers/:id/models` refreshes a model list; `DATABASE_SCHEMA.md` has no
column for it (`provider` has `defaultModel` and `capabilityFlagsJson`, nothing cacheable). The
route works only if the list is transient.

---

## 6. Area C — AI question-generation pipeline

### 6.1 Flow with the two gates

```
  Request {competencyIds, difficulty, count, configId}          [QUESTION_GENERATION §1.1]
        │
        ▼
  [1] Create job  ── providerId, modelId, promptTemplateId,
        │            promptVersion, generationId                 [§1.2]
        ▼
  [2] Batch fan-out (batch = retry + failure unit)               [§1.3, GENERATION_JOBS §1]
        │
        ▼
  [3] ProviderTransport.chat(prompt)                            [AI_PROVIDER §2]
        │
        ▼
  ┌───────────── GATE A — AI output validity ──────────────────────────────────┐
  │ [4] A: parse JSON / fenced JSON fallback        → malformed_json           │
  │ [5] B: AI-01 top-level+questions array          → schema_violation         │
  │ [6]  B: AI-02 stem/options/answerKey/explanation→ schema_violation         │
  │ [7]  B: AI-03 optionScores keys ⊆ options keys  → schema_violation         │
  │ [8]  B: AI-04 keys ⊆ A..E, distinct             → schema_violation         │
  │ [9]  B: AI-05 no negative/non-numeric score     → schema_violation         │
  │ [10] B: AI-06 prohibited strings (V-12 mirror)  → schema_violation, BLOCKS │
  │ [11] provenance populated on arrival            → BR-Q1                    │
  │ [12] lifecycle forced to `draft`, never `active`→ §1.4                     │
  └────────────────────────────────────────────────────────────────────────────┘
        │ pass                                    │ fail
        ▼                                         ▼
  draft shown in review screen                    batch.failureCategory set,
  (failed drafts ALSO shown, with check+message)  raw response retained, never
        │                                         silently dropped [FR-G6]
        ▼
  ┌───────────── GATE B — publication validity ───────────────────────────────┐
  │ [13] user accepts / edits / rejects each draft                              │
  │ [14] V-01…V-12 schema validation                [QUESTION_SPEC §5]          │
  │ [15] SC-01…SC-08 scoring consistency            [SCORING §6.1]              │
  │ [16] TKP weights each in 1..5                   [SC-05]                     │
  │ [17] contentHash computed (V-08/09 dedup)       [QUESTION_SPEC §1]          │
  │ [18] all review history recorded                [QUESTION_SPEC §4]          │
  │ [19] human_reviewed → active transition          [QUESTION_SPEC §3]         │
  │ [20] activation prerequisites satisfied         [QUESTION_SPEC §3]          │
  └────────────────────────────────────────────────────────────────────────────┘
        │ pass                                    │ fail / user rejects
        ▼                                         ▼
   `active` → selectable in sessions         stays `draft` or `ai_validated`;
                                             rejected → terminal
```

### 6.2 Verdict on the pipeline

The pipeline design is sound: two gates, the AI gate and the publication gate are properly
separated, failure categories are canonical and shared by `QUESTION_GENERATION.md` §5,
`GENERATION_JOBS.md` §2 and `ERROR_HANDLING.md` §5, and nothing is silently dropped. The
"never `active` on arrival" guarantee is stated in six docs and contradicted by none in prose.

The defects are all at the persistence/seam layer, not in the logic:

**AI-1 (HIGH) — same lifecycle split as `BUSINESS_RULES.md` BR-Q3 and `DATABASE_SCHEMA.md`; the
five-state machine (which contains `ai_validated`, `human_reviewed`, `quarantined`) is the one
enforced here and in `USER_JOURNEYS.md` J-5. See finding FL-1.**

**AI-2 (MEDIUM) — step [6]/[7] can never pass for TKP as specified.**
AI-02 requires `answerKey`; AI-03 requires `optionScores` keyed to `options`. For TWK/TIU,
`PROMPT_SPECIFICATION.md` §3 says "tepat satu jawaban benar" and the schema emits `optionScores` for
all cases. But `VALIDATION.md` §2 and `QUESTION_SPECIFICATION.md` §5 say TKP has "no single correct"
and TWK/TIU has exactly one full-score option. The structural check does not distinguish; a model
that emits `answerKey: "B"` (a plausible TWK output) fails AI-02, while one that emits a full
`optionScores` map for TWK passes AI-03. No check enforces "TWK/TIU exactly one full score".
The only place that is enforced is SC-04, at the *publication* gate — inside the claim that the AI
gate already checked shape.

**AI-3 (MEDIUM) — regeneration identity contradicts itself.**
`QUESTION_GENERATION.md` §1.4: regenerating "creates a **new** question whose `generationId` differs;
it never mutates the old one in place." §6: "Regenerating one question issues a new job/batch." But
`AI_VALIDATION.md` §4 and `VALIDATION.md` §2 imply regeneration is a per-question re-run of the
validation, while `GENERATION_JOBS.md` §3 says regeneration "is a new job". Whether FR-G4's
"regenerate one" creates one new question or a batch of N is inconsistent across three docs.
Impact: FR-G4 ("regenerate one or all") cannot be implemented portably.

**AI-4 (LOW) — `REQUEST`/`task` mismatch.** `AI_PROVIDER_ARCHITECTURE.md` §4 says an unmapped task's
"feature is disabled with a clear reason". `QUESTION_GENERATION.md` §1.2 records `promptTemplateId`.
Neither says what the job does if the `question` task is unmapped — reject at `POST /generation-jobs`
(400) or accept and fail every batch? `API_ENDPOINTS.md` §4 does not list a task-missing error.

---

## 7. Area D — Security audit

### 7.1 PASS items

| Check | Evidence | Result |
|---|---|---|
| Loopback-only bind | `SECURITY.md` §2, `API_SPEC` §1, ADR-009 | PASS |
| No wildcard CORS | `SECURITY.md` §2 | PASS |
| Keys write-only, `keyLast4` only | `SECRETS.md` §1–3, `DATABASE_SCHEMA` `secret_ref`, FR-C6 | PASS |
| Keys never in responses/logs/errors/bundle | `ERROR_HANDLING.md` §2, `SECURITY.md` §3, NFR-7 | PASS (with SEC-2 caveat) |
| Provider transport masks Authorization before error marshalling | `PROVIDER_INTEGRATION.md` §3 | PASS |
| Hashes opaque, never printed | `API_SPEC` §4.2 | PASS |
| No auth for MVP, reasoning documented | `AUTHENTICATION.md`, ADR-009 | PASS |

### 7.2 Findings

**SEC-1 (MEDIUM) — DNS rebinding is listed as a threat but has no effective mitigation.**
`SECURITY.md` §1 lists "A malicious local page calls the API (DNS rebinding / CORS)" and gives the
mitigation "Same-origin only; no CORS \*; loopback bind". Same-origin and no-CORS do **not** stop
DNS rebinding: the attacker's page resolves its own hostname to `127.0.0.1`, making the request
same-origin from the browser's view. The actual defences are a `Host`-header allowlist (reject
anything other than `127.0.0.1:<port>` / `localhost:<port>`) and, for write endpoints, an
unguessable token or `Origin` check.

`AUTHENTICATION.md` §3 lists "add a local access token / host allowlist **first**" — but only as a
condition that triggers if binding changes to LAN, which is not the DNS-rebinding case.

Impact: NFR-7 (no key leak) is reachable through this hole if the attacker page can drive
`POST /generation-jobs`/`/providers/:id/test` (the key never leaves the server, so the direct key
leak is not proven — but reading analytics, the full question bank with answer keys, and
provider base URLs is). Under ADR-009 the API has no auth at all, so nothing else stops it.

Recommendation: `SECURITY.md` §2 must require (a) a `Host` allowlist and (b) a per-install token
required on all state-changing routes, issued to the UI at bootstrap. Note this is **not** an
authentication system and does not conflict with ADR-009 — it is transport hygiene.

**SEC-2 (MEDIUM) — "show the exact error text returned by the provider" (FR-C2) leaks raw provider
responses.**
FR-C2, `AI_PROVIDER_ARCHITECTURE.md` §2 (`test()` "returns the provider's exact error text") and
`USER_STORIES.md` US-C1 ("connection test shows the provider's exact error") all require raw text
be returned to the UI. `ERROR_HANDLING.md` §2 says no provider key ever appears. `PROVIDER_INTEGRATION.md`
§5 says the test envelope's `reason` "never includes the key". Nothing specifies the scrubbing step:
what exactly is matched and redacted before the raw text reaches the response.

Many OpenAI-compatible gateways echo the offending `Authorization` header (often partially masked but
sometimes fully, e.g. in 401 debug bodies) in the error body. Without a named scrubber, FR-C2 and
NFR-7 fight each other.

Recommendation: `AI_PROVIDER_ARCHITECTURE.md` §2 states that "exact error text" excludes anything
matching the configured key's known prefix or full value, and the key is replaced with `<redacted>`
before it is placed in `error.details`.

**SEC-3 (LOW) — `Authorization` handling is stated two different ways.**
`VALIDATION.md` §2: "never accept an `Authorization` value from response path back into storage".
`SECRETS.md` §3: "A provider's `headers` may carry an `Authorization` value set at runtime from the
secret". The second implies storage can carry the source of an `Authorization`, which the first
forbids. They are reconcilable (the header is materialised at send time, never stored), but only
if read together.

**SEC-4 (INFO) — data-at-rest is plaintext SQLite.** `SECRETS.md` §4 explicitly places "encrypting the
SQLite database file" out of scope. `SECURITY.md` §1's threat table calls "Another local user inspects
the SQLite file" Medium and mitigates it with "Bind loopback; document that data is plain on disk".
Both are consistent and honest. Recorded, not a defect.

---

## 8. Area E — Regulatory evidence for CPNS 2026

### 8.1 What is verified

The provenance record in `CPNS_2026_REGULATIONS.md` is generally strong and, critically, it does not
invent a CPNS 2026 instrument. Confirmations against the cached primary sources:

| Claim in doc | Primary source | Result |
|---|---|---|
| No CPNS-2026 SKD instrument found | SSCASN "Belum ada dasar hukum untuk seleksi ini"; MenPANRB Press Release 378/HUMAS-MENPANRB/2026 | PASS (`VERIFIED-ABSENCE`) |
| 321/2024: numbers 30/35/45, weights 5/0/1–5, max 550 | `kepmen321_2024.txt` KEDELAPAN/KEEMBILAN | PASS |
| 321/2024: NAB 65/80/166 | `k321_p6.jpg` (page `-7-`) KEDUA BELAS | PASS |
| 321/2024: cumulative 311, TIU 85 | `k321_p6.jpg` KELIMA BELAS | PASS |
| 321/2024: cumulative 286, TIU 60 | `k321_p6.jpg` KEENAM BELAS | PASS |
| 406/2026: 100 minutes | `kepmen406_2026.txt` KETIGA | PASS |
| 406/2026: NAB 65/80/156, cumulative 281, TIU 55 | `kepmen406_2026.txt` KEDELAPAN, KESEPULUH | PASS |
| Sum check 65+80+166 = 311 | arithmetic | PASS |
| Sum check 65+80+156 = 301 ≠ 281 ... | arithmetic vs 406/2026 KESEPULUH | See REG-3 |

### 8.2 Findings

**REG-1 (HIGH) — Diktum KETIGA and KEEMPAT of 321/2024 are omitted; the 130-minute value is
presented without its scope.**
`CPNS_2026_REGULATIONS.md` §2.3(a) (lines 132–142) records KELIMA as "SKD duration **130 (seratus
tiga puluh) minutes**" with tier `HISTORICAL`. No KETIGA and no KEEMPAT row is present.

The primary instrument (§.research/kepmen321_2024.txt, and confirmed on `k321_p4..p5.jpg`) is:
- **KETIGA**: SKD for *ordinary* participants is **100 minutes**.
- **KEEMPAT**: an exemption extending the duration for a specific group (the disability provision).
- **KELIMA**: the 130-minute value, **explicitly scoped** to "pelamar sebagaimana dimaksud pada
  Diktum KEEMPAT".

So 321/2024's *base* duration is 100 minutes, not 130. The doc's table has no way for a reader to
know this; the only duration recorded is the exemption value, and it is recorded as if it were the
instrument's duration. The same omission cascades into §4.4 ("Duration carried as 130 minutes with an
explicit '2024 value' warning") and into UNV-05 ("Carried 130 min (2024 value)"), and then into the
approval warning the user reads. **The user approves a provisional config whose duration is the
wrong subsection of the instrument, with a warning that describes the wrong uncertainty.**

Note that 406/2026 recorded KETIGA correctly as 100 minutes — so this is a 321/2024-specific
omission, not a systematic one, which makes it look like a transcription gap rather than a policy.

Recommendation: add KETIGA (100 min, base) and KEEMPAT to the 321/2024 table; rewrite the KELIMA row
to record the scope; correct §4.4 and UNV-05 so the carried 130 is described as the exemption value,
and add a new open uncertainty ("which duration applies to a 2026 general-candidate drill — 100 or
130?") to the register. This is the single most important finding in the audit.

**REG-2 (MEDIUM) — Diktum KETIGA BELAS collapsed into KEDUA BELAS; KESEBELAS absent.**
`CPNS_2026_REGULATIONS.md` line 139 folds KETIGA BELAS's scoping language into the KEDUA BELAS row.
In the instrument KETIGA BELAS is a **separate diktum** that scopes KEDUA BELAS to "penetapan
kebutuhan umum dan penetapan kebutuhan khusus putra/putri Kalimantan". The 406/2026 table correctly
renders "KESEMBILAN–KESEPULUH" as two diktums, so the convention exists and is applied inconsistently.

KESEBELAS ("NAB = nilai minimal yang harus dipenuhi setiap peserta seleksi") is also absent. Note
`SCORING_METHODOLOGY.md` §5 *cites* KESEMBILAN for the definition of NAB — but in 321/2024 it is
KESEBELAS, not KESEMBILAN, that carries that definition. The citation is to the wrong diktum.

Impact: a reader checking the cumulative-311 threshold against the document cannot see that its
applicability is conditioned on the general (not Cumlaude/Diaspora/etc.) track. That matters
because the config ships 311 for a user whose practice is not tied to a `formasi` category.

**REG-3 (MEDIUM) — UNV items are listed as `regulatoryBasis`, which `BasisRef` cannot represent.**
`CPNS_2026_REGULATIONS.md` §4.4 gives `skd-cpns-2026-provisional`'s basis as
"Permen PANRB 6/2024 Pasal 30; Kepmen PANRB 321/2024 (2024 numbers); Kepmen PANRB 406/2026
(framework only); **UNV-01…UNV-05**". `BasisRef` (§4.1) requires `{document, number, effectiveDate?,
tier, pathway?, examYear?, scope?, sourceUrl?, fetchedAt?}` and represents a *document*. UNV items
are unresolved questions, not documents, and cannot appear as `BasisRef` — yet they feed
`regulatoryBasisHash` (§4.1: "hash over `BasisRef[]`").

Also, the 406/2026 basis is listed as "framework only" with `skd-cpns-2026-provisional` — a
Sekolah Kedinasan instrument cited for a CPNS config. The doc guards this as "framework only", but
AGENTS.md's constraint 2 says "Sekolah Kedinasan rules … are never cited as CPNS 2026 authority".
A basis-tagged `BasisRef` is a citation. This is either a real pathway leak or a wording problem in
the table, and the doc does not say which.

Impact: the `regulatoryBasisHash` that binds the approval is computed over a set that includes
items its own type cannot hold. Approval integrity is the spine of ADR-004; if the hash input is
ill-defined, so is the approval.

**REG-4 (LOW) — 406/2026 `KESEMBILAN` vs `KESEPULUH` numbering.** 406/2026's NAB definition is
KETUJUH in the doc's table, and the NAB values are KEDELAPAN. The cumulative 281/TIU 55 is
KESEPULUH. The 65+80+156 = 301 arithmetic vs 281 is not "wrong" — the 281 is cumulative, and stops
are taken independently — but the doc presents the two without saying so, which invites a reader to
conclude 301 is inconsistent with 281. Add a note.

**REG-5 (LOW) — the 2021 claim is `HISTORICAL` and unsourced beyond a title.** `CPNS_2026_REGULATIONS.md`
line 188 records "2021: SKD = 110 soal in 100 minutes (title only; body not extractable)" with a URL.
The doc is honest about the limitation. Marked `NOT VERIFIED` by this audit because the body was not
recovered.

### 8.3 Path assessment of the provisional config

The carried 130-minute value and the carried 65/80/166 NAB are both flagged as "2024 values, not
confirmed for CPNS 2026" and both enter `acknowledgedWarnings`. Given no CPNS-2026 instrument exists,
the provisional model is correct in shape. But REG-1 means the "2024 value" for duration is itself
the exemption sub-value (130) rather than the base (100), so the carried default is outside the main
line of the 2024 instrument even by 2024 standards. **That is the strongest reason this audit cannot
call the set "ready".**

---

## 9. Area F — Cross-document consistency

Cross-document failures, ranked. Each is a contradiction, not a stylistic difference.

### FL-1 (HIGH) — question lifecycle: 5 states vs 3 states

| Doc | States |
|---|---|
| `QUESTION_SPECIFICATION.md` §3 | `draft → ai_validated → human_reviewed → active / archived / quarantined` |
| `AI_VALIDATION.md` §1 | `draft → human_reviewed → active` |
| `USER_JOURNEYS.md` J-5 | `draft → ai_validated → human_reviewed → active` |
| `BUSINESS_RULES.md` BR-Q3 | `draft` / `active` / `archived` |
| `DATABASE_SCHEMA.md` §2 `question.lifecycle` | `draft` / `active` / `archived` |
| `API_ENDPOINTS.md` §3 | creates `draft`, activates, archives only |
| `FRONTEND_PAGE_SPECIFICATIONS.md` §6 | "draft→active (gate), archive" |

The five-state machine is the one carrying the guarantee ("no path from draft to active skips the
user"); the three-state version silently deletes `human_reviewed`, which *is* that guarantee.
`quarantined` (which the question spec introduces for validation-failed questions still shown to the
user) does not exist in the schema either.

**FL-2 (HIGH) — the four approval-bound values are stated three different ways.**
- `AGENTS.md` §Non-negotiable 3, `CPNS_2026_REGULATIONS.md` §4.3, `BUSINESS_RULES.md` BR-E3,
  ADR-004: `{configId, configVersion, scoringVersion, regulatoryBasisHash}`.
- `VALIDATION.md` §2: `{configVersion, scoringVersion, regulatoryBasisHash, approvedByUserAt}` —
  `configId` replaced by `approvedByUserAt`.
- `SCORING_METHODOLOGY.md` §2.2 `ScoreApprovalRef`: `{approvedByUserAt, approvedBy, configVersion,
  regulatoryBasisHash}` — no `configId`, but has `approvedBy`.

This is the rule AGENTS.md calls non-negotiable and the rule ADR-004 is named for. Three
canonical docs disagree on it. `approvedByUserAt` is a timestamp, not an identity of *which config
was approved*; without `configId` a user with two provisional configs could in principle cross-bind.

**FL-3 (HIGH) — user journeys call endpoints that do not exist.**
`USER_JOURNEYS.md` J-1: `PATCH /questions/:id/accept`, `POST /exam-configs/:id/approval`.
J-4: `POST /sessions/:id/score`, and `POST /exam-configs/:id/approval` again.
`API_ENDPOINTS.md` has `PATCH /questions/:id` (lifecycle transitions only), `POST
/exam-configs/:id/approve` ("approve", not "approval"), and no `POST /sessions/:id/score` at all
(re-score is described as "a later retry" against the snapshot — via `submit` again — in
`ERROR_HANDLING.md` §4). J-1's "accept" and J-4's re-score path are the **acceptance path in PRD
§13.1**.

**FL-4 (MEDIUM) — `POST /sessions/:id/submit` is described as idempotent per snapshot, but no endpoint
exists for re-scoring an unscored session that is already `submitted`.**
`ERROR_HANDLING.md` §4 says "resubmitting the same unchanged input after re-approval either scores
or re-rejects". J-4 shows `POST /sessions/:id/score`. `DATABASE_SCHEMA.md` `session.status` has no
`unscored` value (only `open`/`submitted`/`blocked`), though `score_result.blockedErrorCode` exists
for exactly that case. So the session is "submitted and unscored", and "re-submit" must be legal
against a submitted session — which the endpoint's own status semantics do not say.

**FL-5 (MEDIUM) — `APPROVAL_MISSING` has no entry in the error registry.**
`SCORING_METHODOLOGY.md` §11 lists `APPROVAL_MISSING` / `APPROVAL_INVALID` / `APPROVAL_VERSION_MISMATCH`
as PF-13 errors. `API_SPECIFICATION.md` §4's registry has the latter two, not the first.
`CONTRACTS.md` §2's `ApiError` union has the latter two, not the first. `ERROR_HANDLING.md` §4 omits
it. A provisional unapproved config is a first-class state (`README.md`, MVP_SCOPE §3), so this code
will fire and has no wire shape.

Also open: whether PF-13 codes surface as `PREFLIGHT_FAILED.errors[]` (422) — where
`PreflightError.code` is documented as "one of PF-00…PF-13" — or as top-level 409. DB-3 and §4.1
imply **both** mechanisms can emit PF-13 codes, which is undefined.

**FL-6 (MEDIUM) — analytics input contract is missing `sessionCount`, which recommendation ranking
requires.**
`RECOMMENDATION_ENGINE.md` §1 lists `sessionCount` as an input and §2/§3 rank and display by it
("ties by lower `sessionCount` first"; evidence table row "`sesi` | `sessionCount`").
`ANALYTICS_ENGINE.md` §6's `AnalyticsSnapshot` has no `sessionCount` and no "user mean".
`RECOMMENDATION_SERVICE.md` §1 lists only per-competency accuracy/attainment + `answeredCount` +
sample-status flags. Three docs, three different input sets.
Impact: FR-D3 ranking ("ties by lower sessionCount") and the evidence table (`n`, `sesi`, `gap`) cannot
be produced from the declared analytics output.

**FL-7 (MEDIUM) — `MetricValue` shape conflict.** Covered as ANA-3/ANA-4 above; recorded here because
it is a cross-document failure (`ANALYTICS_ENGINE.md` §6 vs `FRONTEND_DATA_CONTRACTS.md` §3).

**FL-8 (MEDIUM) — threshold semantics: `naikTotal` / `ThresholdSet.total`.**
Covered as API-2. Additionally `BUSINESS_RULES.md` BR-E3 says "any mismatch → 409, stored unscored",
which is right, but `SCORING_METHODOLOGY.md` §11 says changed thresholds trigger
`THRESHOLD_CONFIG_INVALID` (also 409). Which code wins when both config version and a threshold
changed is not stated.

**FL-9 (LOW) — `FRONTEND_INFORMATION_ARCHITECTURE.md` has no top-level Exam-config section, yet
`/exam-configs/:id` is listed as reached "from Exam config" and a page spec §10 exists for it.**
The route is unreachable from the documented nav. FR-E1 requires the config list, so this is a real UI
gap.

**FL-10 (LOW) — `USER_STORIES.md` does not cover all FRs.** No story for FR-D1, FR-D4, FR-D5, FR-P3,
FR-Q3, FR-Q4, FR-C3, FR-C5, FR-E1, FR-A3. `FEATURE_MATRIX.md` and `FRONTEND_PAGE_SPECIFICATIONS.md`
*do* cover all 46 FRs, so PRD coverage exists at those levels — but the user-story backlog
(`USER_STORIES.md` is described as "canonical backlog") has holes. The audit's coverage matrix (§10)
treats the matrix + page spec as the coverage evidence and flags the story gap as LOW.

**FL-11 (LOW) — `_SESSION_SNAPSHOT` in ERD omits `configJson`, `thresholdsJson`, `approvalJson`
present in `DATABASE_SCHEMA.md` §2.** Marks the ERD as a subset only for batches, not snapshots.

**FL-12 (LOW) — `MIGRATION_STRATEGY.md` §3 contains a literal `(AUD-id TBD)`** unresolved identifier
in a canonical doc. Folded into FL-14.

**FL-13 (LOW) — `PROVIDER_INTEGRATION.md` §5 returns `{ok, latencyMs, reason}`** while
`AI_PROVIDER_ARCHITECTURE.md` §2's `test()` returns `{ok, error?}`. Two shapes for one operation.

**FL-14 (INFO) — `docs/AUDIT.md` is 110 lines and states "PASSED — zero open critical/high".** This
audit found 6 HIGH, which by the register's own severity rule means the register's verdict was
premature. The prior audit evidently compared docs pairwise, not along the seams this audit
did. Recorded plainly, not as blame: an audit register that closes findings without a coverage
matrix can pass a set that a matrix-driven audit fails.

**FL-15 (INFO) — `.research/kepmen321_2024.txt` records the instrument's signing date as 27 Juli 2026.**
That is the 406/2026 date. 321/2024 should be 2024. Either the cached file is mislabelled or the doc
transcription pulled a date from the wrong instrument. Low practical impact, high provenance
significance — the doc's whole thesis is provenance. `NOT VERIFIED` which is wrong.

---

## 10. Area G — PRD requirement coverage matrix

All 46 requirements from `PRD.md` §8. Status key:
`C` = covered by a canonical doc that specifies it; `P` = covered but the covering doc contradicts another;
`N` = covered by only one of (matrix / page spec / story), not all.

| FR | Requirement | Story | Architecture | API / Backend | Frontend | Status |
|---|---|---|---|---|---|---|
| FR-D1 | Latest result, accuracy, per-test | — | ANALYTICS §1 | `GET /sessions/:id/result` | PAGES §1.1 | N (no story) |
| FR-D2 | Competency accuracy ≥5 answered | US-A1 | ANALYTICS §3.1 | `GET /analytics` | PAGES §1.2 | **P** (ANA-4: state field absent) |
| FR-D3 | Top-3 weaknesses + evidence | US-L1 | RECO §2 | `GET /recommendations/weaknesses` | PAGES §1.3 | **P** (FL-6: no `sessionCount`) |
| FR-D4 | Recent history, config badge | — | — | — (no dedicated endpoint; embedded in bootstrap?) | PAGES §1.4 | N |
| FR-D5 | Pending actions | — | — | no endpoint | PAGES §1.5 | N |
| FR-T1 | Config `notice` before start | US-T1 | DATA_FLOW | `POST /sessions` | PAGES §2.2 | C |
| FR-T2 | Deadline timer, auto-submit | US-T2 | — | `session.deadlineAt` | PAGES §3.1 | C |
| FR-T3 | Navigate, flag | US-T3 | — | `answer_sheet.flagged` | PAGES §3.3 | C |
| FR-T4 | Autosave, resume | US-T4 | — | `PATCH /sessions/:id/answers` | PAGES §3.4 | C |
| FR-T5 | Submit confirm, unanswered count | US-T5 | — | — | PAGES §3.5 | C |
| FR-T6 | Immediate score, hide answers | US-T6 | DATA_FLOW §3 | `GET /sessions/:id/result` | PAGES §4 | **P** (API-1 field mismatch) |
| FR-T7 | Blocked → unscored | US-T7 | DATA_FLOW §3 | 409 unscored | PAGES §4.3 | **P** (FL-5 no `APPROVAL_MISSING`) |
| FR-P1 | Any competency level + difficulty | US-P1 | TAXONOMY | `POST /sessions` | PAGES §5.1 | C |
| FR-P2 | Untimed, optional soft timer | US-P2 | — | — | PAGES §5.2 | C |
| FR-P3 | Same runner as Try Out | — | COMPONENT §2 `QuestionRunner` | — | PAGES §5.3 | N |
| FR-P4 | Inline explanations | US-P3 | — | `GET /questions/:id` | PAGES §5.4 | C |
| FR-G1 | Generate N questions | US-B1 | GEN §1 | `POST /generation-jobs` | PAGES §7.1 | C |
| FR-G2 | Progress + cancel | US-B1 | GENERATION_JOBS §2 | `:id`, `:id/cancel` | PAGES §7.2 | C |
| FR-G3 | Full validation routing | US-B2 | AI_VALIDATION §1 | GEN §3 | PAGES §7.3 | C |
| FR-G4 | Review accept/edit/reject/regen | US-B3 | GEN §1 | **no accept endpoint in API_ENDPOINTS** | PAGES §7.3 | **P** (FL-3, AI-3) |
| FR-G5 | Provenance record | US-B2 | QUESTION_SPEC §2 | `question.provenanceJson` | — | C |
| FR-G6 | Failure category + retry | US-B4 | GEN §5 | `generation_batch.failureCategory` | PAGES §7.4 | C |
| FR-A1 | Per-test/competency accuracy + MRT | US-A1 | ANALYTICS §2 | `GET /analytics` | PAGES §8.1 | **P** (ANA-5 mean vs median) |
| FR-A2 | Trend + min sample | US-A2 | ANALYTICS §5 | `GET /analytics` | PAGES §8.2 | C |
| FR-A3 | Difficulty analysis | — | ANALYTICS §4 | `GET /analytics.difficulty` | PAGES §8.3 | N (no story) |
| FR-A4 | Zero vs insufficient | US-A3 | ANALYTICS §3.2 | **`state` not in wire type** | PAGES §8.4 | **P** (ANA-4) |
| FR-A5 | Config comparability | US-A4 | ANALYTICS §5 | `GET /analytics` no config param | PAGES §8.5 | **P** (DB-5) |
| FR-L1 | Weakness rule set | US-L1 | RECO §2 | `GET /recommendations/weaknesses` | PAGES §1.3 | **P** (FL-6) |
| FR-L2 | Numeric justification | US-L1 | RECO §3 | same | same | **P** (FL-6) |
| FR-L3 | Material per weakness | US-L2 | RECO §4 | `GET /recommendations/materials`; **no `material` table** | — | **P** (DB-1) |
| FR-L4 | One-click drill | US-L3 | RECO §5 | `POST /recommendations/drill` | PAGES §1.3 | C |
| FR-L5 | Editable plan | US-L4 | RECO §6 | `PUT /study-plan` | ROUTES `/study-plan` | C |
| FR-L6 | Recompute proposes, not overwrites | US-L4 | RECO §6 | `PUT /study-plan` | ROUTES | C |
| FR-Q1 | List + filters | US-B5 | QUESTION_SPEC §7 | `GET /questions` | PAGES §6.1 | C |
| FR-Q2 | Detail validations + review history | US-B6 | QUESTION_SPEC §4 | **no persistence** | PAGES §6.2 | **P** (DB-2) |
| FR-Q3 | Lifecycle transitions | — | QUESTION_SPEC §3 | `PATCH /questions/:id` | PAGES §6.3 | **P** (FL-1) |
| FR-Q4 | Bulk archive/activate | — | QUESTION_SPEC §3 | `POST /questions/bulk` | PAGES §6.4 | N |
| FR-Q5 | Duplicate clusters | US-B7 | QUESTION_SPEC §5 V-08/09 | — (no endpoint) | PAGES §6.5 | **P** (no API) |
| FR-C1 | Provider CRUD | US-C1 | AI_PROVIDER §3 | `/providers` | PAGES §9.1 | C |
| FR-C2 | Test connection, exact error | US-C1 | AI_PROVIDER §2 | `/providers/:id/test` | PAGES §9.1 | **P** (SEC-2) |
| FR-C3 | Fetch/list models, manual entry | US-C2? | AI_PROVIDER §2 | `/providers/:id/models` | PAGES §9.2 | N (DB-7) |
| FR-C4 | Task→model map | US-C2 | AI_PROVIDER §4 | `PUT /task-map` | PAGES §9.3 | C |
| FR-C5 | Capability flags | — | AI_PROVIDER §5 | `PUT /task-map` | PAGES §9.4 | N |
| FR-C6 | Key write-only, masked tail | US-C3 | SECURITY §3 | `GET /providers` `keyLast4` | PAGES §9.1 | C |
| FR-C7 | Non-AI works without provider | US-C4 | AI_PROVIDER §4 | — | — | C |
| FR-E1 | List configs + state | — | REGULATIONS §4.2 | `GET /exam-configs` | PAGES §2.1 | N |
| FR-E2 | Basis + unresolved + notice | US-T1 | REGULATIONS §4.3 | `GET /exam-configs/:id` | PAGES §10.1 | **P** (REG-3) |
| FR-E3 | Approve with four bound values | US-E1 | REGULATIONS §4.3 | `POST /:id/approve` | PAGES §10.2 | **P** (FL-2) |
| FR-E4 | Auto-invalidate, block until re-approved | US-E2 | SCORING §11 | 409 codes | PAGES §10.3 | **P** (FL-5) |

**Coverage summary:** all 46 FRs are named in `FEATURE_MATRIX.md` and in
`FRONTEND_PAGE_SPECIFICATIONS.md`; 12 have no user story. 21 of 46 are "covered but contradicted by
another doc" (`P`), concentrated in FR-D2/D3, FR-T6/T7, FR-G4, FR-A1/A4/A5, FR-L1/L2/L3, FR-Q2/Q3,
FR-C2, FR-E2/E3/E4. **No FR is entirely uncovered** — the gap is never "nobody wrote it" but
"two docs wrote it differently", which is the same diagnosis as every other area.

---

## 11. Findings by severity

### CRITICAL — none

No finding would produce a wrong score, a security breach, or an invalid pass decision if built
correctly against either side of each contradiction. Stated plainly rather than downgraded:
REG-1's default duration value is wrong against 2024's base and REG-3's hash input is ill-defined,
so a *reviewer* could form an incorrect view of the instrument, but the app cannot silently ship a
wrong score from these.

### HIGH — 6

| ID | Finding | Where |
|---|---|---|
| FL-1 | Question lifecycle: 5 states vs 3 states across 7 docs; `human_reviewed` and `quarantined` deleted in schema | QUESTION_SPEC §3 vs BUSINESS_RULES BR-Q3, DATABASE_SCHEMA §2 |
| FL-2 | Four approval-bound values stated three ways; `configId` missing from VALIDATION §2 and ScoreApprovalRef | AGENTS.md 3, REGULATIONS §4.3, VALIDATION §2, SCORING §2.2 |
| FL-3 | User journeys call 3 endpoints that do not exist, on the PRD §13.1 acceptance path | USER_JOURNEYS J-1, J-4 vs API_ENDPOINTS |
| API-1 | `ScoreResult` has two shapes: `byTest`/`byQuestion` vs `sections`/`perQuestion` | SCORING §2.2 vs API_SPEC §5, CONTRACTS §3, DATABASE_SCHEMA §2 |
| API-2 | Thresholds have three shapes; `ThresholdSet` has no `naik*` fields, schema has no `affirmation*` in scoring | SCORING §5 vs API_SPEC §5, CONTRACTS §3, DATABASE_SCHEMA §2 |
| REG-1 | 321/2024 KETIGA (100 min base) and KEEMPAT omitted; 130 min is the disability-exemption value presented as the duration | REGULATIONS §2.3(a) L132–142, §4.4, UNV-05 |

### MEDIUM — 11

| ID | Finding |
|---|---|
| FL-4 | Re-scoring an unscored submitted session: no endpoint; `session.status` has no `unscored` |
| FL-5 | `APPROVAL_MISSING` has no error registry entry; PF-13 codes ambiguous between 422 and 409 |
| FL-6 | `sessionCount` and user-mean required by recommendation ranking never exist in `AnalyticsSnapshot` |
| DB-1 | No `material` table/endpoint for FR-L3; O-3 unachievable |
| DB-2 | No persistence for `ValidationRecord` / `ReviewHistory`; FR-Q2 and the review guarantee unverifiable |
| DB-3 | "score reads only the snapshot" contradicts BR-E3's live drift check |
| DB-4 | Provider create/delete spans SQLite + secret store with no transaction/cascade rule |
| DB-5 | `GET /analytics` has no config scoping despite FR-A5's comparability gate |
| ANA-1 | `byCompetency` absent from API; prefix roll-up (TAXONOMY §7.2) unspecified |
| ANA-3 | `MetricValue.value` ratio vs `MetricValue.percent` integer; breaks the integers-only rule |
| ANA-4 | Sample status `state` never on the wire; FR-A4 has no field |
| SEC-1 | DNS rebinding listed as a threat with no effective mitigation (Host allowlist + token absent) |
| SEC-2 | "Exact provider error text" (FR-C2) has no defined scrubbing step against NFR-7 |
| REG-2 | KETIGA BELAS collapsed into KEDUA BELAS; KESEBELAS absent; SCORING §5 cites KESEMBILAN for the NAB definition that is KESEBELAS |
| REG-3 | UNV items listed in `regulatoryBasis` cannot be `BasisRef`; 406/2026 (Sekolah Kedinasan) basis-tagged onto a CPNS config |
| AI-2 | AI-01…AI-06 cannot distinguish TWK/TIU single-key from TKP weight-map; "exactly one full score" unenforced at Gate A |
| AI-3 | Regeneration: one new question vs a new job of N — three docs differ |
| FL-7 | `MetricValue` shape conflict (detail of ANA-3) |

### LOW — 9

| ID | Finding |
|---|---|
| ANA-5 | PRD/MVP say mean response time; analytics computes median; API_SPEC §1 says "mean … is a median" |
| QS-1 | `Question.lifecycle: Lifecycle` type never defined anywhere |
| SC-1 | PF-09 caps thresholds at `maxPossible` computed from the **actual roster**; no doc specifies practice roster length, so a shortened practice set carrying full NAB fails with `THRESHOLD_EXCEEDS_MAX` |
| SC-2 | `SCORING_VERSION_MISMATCH` produced by PF-06, SC-08 and a `scoreQuestion` throw — three origins, one code |
| SC-3 | §3.2 vs §10.2 TKP example weight sets differ (both valid) |
| DB-6 | `POST /sessions` two-table atomicity unstated while bulk is stated atomic |
| DB-7 | Model-list refresh has no storage |
| FL-9 | Exam-config route unreachable from IA nav |
| FL-10 | 12 FRs have no user story |
| FL-11 | ERD snapshot omits 3 columns present in schema |
| FL-13 | Provider test returns two shapes |

### INFO — 2

| ID | Finding |
|---|---|
| FL-14 | `AUDIT.md` verdict "PASSED — zero open critical/high" is contradicted by 6 HIGH found here |
| FL-15 | Cached `kepmen321_2024.txt` carries the 406/2026 signing date (2026 vs 2024) — provenance defect, `NOT VERIFIED` which is wrong |
| REG-4 | 406/2026 cumulative 281 vs sub-test sum 301 presented without the "stops taken independently" note |
| SEC-4 | Data at rest is plaintext (documented, consistent, not a defect) |

---

## 12. Unresolved decisions

Items the docs themselves leave open. Not defects; recorded so Gate 1 cannot proceed while assuming
they are settled.

| # | Open item | Where recorded | Blocking gate? |
|---|---|---|---|
| U-1 | Secret-store backend: OS keychain vs owner-only file | SECRETS §2, BACKEND_TEMP 1 | Gate 3 |
| U-2 | Generation-job persistence: separate tables vs JSON job row | GENERATION_JOBS §4, BACKEND_TEMP 2, DATABASE_SCHEMA §2 | Gate 3 |
| U-3 | Job crash-recovery semantics | GENERATION_JOBS §4, BACKEND_TEMP 3 | Gate 3 |
| U-4 | Migration tooling (no ORM) | MIGRATION_STRATEGY §6, BACKEND_TEMP 4 | Gate 3 |
| U-5 | Deadline enforcement: server clock assumed, browser-only rejected | ROADMAP, BACKEND_TEMP 5 | Gate 3 |
| U-6 | Frontend stack ratification (ADR-010 Proposed) | ARCHITECTURE_DECISIONS, ADR-010 | Gate 2 |
| U-7 | `INSTALLED_SKILLS.md` inventory table empty | INSTALLED_SKILLS | Gate 1 |
| U-8 | UNV-01…UNV-08: CPNS 2026 instrument absent; duration, NAB, weights, counts unresolved | REGULATIONS §7 | External — cannot close from docs |
| U-9 | Which duration applies to a 2026 general-candidate drill (100 or 130) | **not recorded** — implied by REG-1 | Gate 2/3 (scoring) |
| U-10 | TKP all-equal-weight rejection: deferred for lack of regulatory basis | BACKEND_TEMP rejected | — |

U-9 is new: it is the question REG-1 exposes and no doc asks.

---

## 13. Risk register reconciliation

| RISK_REGISTER ID | Register status | This audit | Note |
|---|---|---|---|
| R-1 CPNS 2026 uncertainty | High/High, tracked UNV | **Agree, and stronger** | REG-1 means the carried duration is the wrong sub-value of the 2024 instrument, not merely "unconfirmed". R-1's mitigation ("re-check at each review") has not yet caught this. |
| R-2 Dataset quality | resolved-by-design | **Partly disagree** | V-01…V-12 + lifecycle is a real barrier, but FL-1 means the lifecycle is undefined (5 v 3 states) and DB-2 means validation history is not persisted. The design exists; the persistence does not. |
| R-3 AI official-framing drift | resolved-by-design | Agree | V-12 + AI-06 + prompt invariant + badge, consistent across 5 docs. |
| R-4 Scoring correctness | resolved (AUD-05..07,21) | **Partly disagree** | The scoring *function* is sound and deterministic. The *contract* around it is not (API-1, API-2). R-4 should be reopened as "scoring-to-wire contract". |
| R-5 Analytics misleading | resolved-by-design | **Disagree** | Minimum-sample and zero-vs-insufficient rules are correct, but ANA-4 means the state never reaches the UI, and FL-6 means ranking ties cannot be computed. The mechanism is specified; the wire is not. |
| R-6 Kedinasan laundering | resolved-by-design | **Partly disagree** | PF-12 and §8 rule 5 enforce it at scoring. But REG-3 basis-tags 406/2026 onto the CPNS provisional config, which is the exact failure the rule forbids. |
| R-7 Contract drift | ongoing (Medium) | **Understated** | Not "ongoing risk" — the drift is *present, in the docs* (API-1, API-2, ANA-3, ANA-4). Severity should be High and status should be "open finding". |
| R-8 Secret leak | resolved-by-design | Agree with caveats | SEC-1 and SEC-2 are the two holes; both are medium. |
| R-9 Approval silently invalidated | resolved-by-design | Agree in mechanism | FL-2 (three definitions of the bound values) undermines it. Move to "mechanism sound, definition inconsistent". |
| R-10 Dependency licence drift | accepted | Agree | ADR-008 is coherent. |

**R-7 is the headline reconciliation.** The register treats frontend↔backend contract drift as a
future risk to be watched. The audit shows it is already in the text, with four concrete
mismatches.

---

## 14. Final readiness assessment

### Verdict: `CONDITIONAL PASS`

**Areas passed:**
- **A (Scoring→Analytics→Frontend consistency)**, in the *semantic* sense: bucket semantics, TKP
  `correct: null` / `correctCount: 0`, attainment vs accuracy, minimum sample `≥5`, trend `≥3`
  sessions, and the `>=` threshold comparison are consistent across all six docs that touch them.
  The inconsistency is in *field names and wire shapes*, not in meaning. **Structurally: FAIL**
  (API-1, API-2, ANA-1,3,4).
- **C (AI generation pipeline)**: flow, gates, failure taxonomy, provenance-on-arrival, never-active
  — PASS. Lifecycle and regeneration specifics — FAIL (FL-1, AI-3).
- **D (Security)**: write-only keys, loopback, masked tails, hashes opaque, no secrets in errors —
  PASS in the majority. Two MEDIUM holes (SEC-1, SEC-2) are real and specific.
- **E (Regulatory honesty)**: no fabricated CPNS 2026 instrument, tiers applied, absence recorded,
  pathway separability *asserted* — PASS on the core thesis. FAIL on completeness of the 321/2024
  transcription (REG-1, REG-2) and on hash input (REG-3).
- **F (Cross-document consistency)**: FAIL. 4 HIGH contradictions (FL-1, FL-2, FL-3, API-1).
- **B (API→DB)**: structurally complete for the session/scoring spine; FAIL for materials,
  review persistence, and the snapshot-vs-live read rule.
- **G (PRD coverage)**: all 46 FRs covered; 21 contradicted. No missing requirement, many duplicate
  definitions — the failure is integration, not omission.

### Five biggest risks

1. **Gate 2 freezes the wrong contract.** ADR-006 makes the mock layer the contract. If Gate 2 is
   built against `FRONTEND_DATA_CONTRACTS.md` (`sections`, `percent`, no `state`), the backend must
   either adopt it (contradicting the canonical scoring doc) or break the frontend. This is the most
   expensive failure in the set, and it is deferred by exactly one gate.

2. **The claim "no path from draft to active skips the user" is unverifiable after the fact.** The
   five-state lifecycle that encodes it disagrees with the schema that would store it (FL-1), and
   the review history that would prove it has no table (DB-2). The guarantee exists in prose only.

3. **The duration the user approves is the wrong sub-value of the 2024 instrument** (REG-1). Not
   catastrophic — the config is provisional and warnings are acknowledged — but it is the exact kind
   of error the project's first non-negotiable exists to prevent, and a reader checking the doc
   against the instrument will find the doc wrong.

4. **The recommendation loop (O-3) has no material to recommend and no `sessionCount` to rank
   with** (DB-1, FL-6). Two of the product's five objectives depend on data shapes that do not exist.

5. **The approval integrity spine — the thing ADR-004 is named after — has three definitions of its
   four bound values** (FL-2), and its `regulatoryBasisHash` input includes items its own type cannot
   hold (REG-3). The most safety-critical rule in the project is the one with the most drift.

### What this means for Gate 1

Gate 1 (skill audit + root files) does **not** depend on any of these findings — it touches
`INSTALLED_SKILLS.md`, `AGENTS.md`, `BACKEND_TEMP.md`, `README.md`, `docs/README.md`, `.gitignore`,
none of which are contradicted by anything above. Opening Gate 1 is safe **provided** the frontend and
backend gates remain closed until the HIGH findings are resolved.

Gate 2 must not open until at least: FL-1, FL-2, FL-3, API-1, API-2, REG-1, ANA-3, ANA-4, FL-6,
DB-1 are resolved. Gate 3 inherits and additionally requires DB-2, DB-3, DB-4, DB-5, FL-4, FL-5,
SEC-1, SEC-2.

### `NOT VERIFIED` items

- The 2021 SKD claim (110 soal / 100 minutes) — body not recoverable; `HISTORICAL` and honestly
  labelled in the doc (REG-5).
- Which of `kepmen321_2024.txt` vs the doc carries the correct signing date (FL-15).
- Permen PANRB 6/2024 Pasal 30/31 citations — spot-checked only, not fully read for this audit.
- That the 406/2026 text cached in `.research/` is the final signed instrument — assumed from its
  diktum chain and 27 Juli 2026 date; not verified against a second source.
- That no CPNS-2026 instrument exists — verified as `VERIFIED-ABSENCE` against SSCASN and the
  MenPANRB release on the date those were fetched (2026-11-07). A later publication would change
  this; the doc records `fetchedAt`, so the check is repeatable.

---

## Appendix — files created or modified by this audit

| File | Change |
|---|---|
| `docs/audit/INDEPENDENT_DOCUMENTATION_AUDIT.md` | **created** — this report |
| `docs/AUDIT.md` | **one pointer line added** (§0), prior history untouched |

No other file was created, modified or deleted. No git operation was performed. No source code was
written. No commit was made. No provider/model/AI configuration was touched. No product scope or
decision was changed. No finding in this report has been applied to any document.
