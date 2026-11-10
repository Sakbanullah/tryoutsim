# Audit Findings — Resolution Record

Companion to [INDEPENDENT_DOCUMENTATION_AUDIT.md](./INDEPENDENT_DOCUMENTATION_AUDIT.md) (the audit
report, preserved unchanged). This file records, for **every** finding in that report, what was done:
status, root cause, the documents changed, the resolution itself, the evidence, and what remains
uncertain.

Date: 2026-11-08 · Scope: documentation only · No source code, provider configuration, or Git history
was touched.

Status key: `RESOLVED` (the contract now says one thing and every dependent doc matches) ·
`PARTIALLY RESOLVED` (the contradiction is gone but a value is still unknown by evidence, recorded as
`UNV-*`) · `OPEN` (needs the owner) · `ACCEPTED RISK` (known, documented, deliberately carried) ·
`NOT A FINDING` (the audit's premise is contradicted by the filesystem or the sources).

---

## 0. Register arithmetic

The audit's own severity headers undercount its rows:

| Section | Header says | Rows actually present |
|---|---|---|
| HIGH | 6 | 6 (FL-1, FL-2, FL-3, API-1, API-2, REG-1) — **correct** |
| MEDIUM | 11 | 18 |
| LOW | 9 | 11 |
| INFO | 2 | 4 |

The executive summary repeats 11/9/2. **This record dispositions every row present**, not the header
counts.

**Why the headers are wrong.** The audit's §11 register was assembled by severity after the fact from
the per-area sections, and the header numerals were typed once and never re-counted against the table
below them. The LOW block is the clearest case: its header says 9, its table lists 11 rows, and the
header numeral is exactly the count of rows *minus QS-1 and SC-1–SC-3* — the four findings living in
the middle two tables of §11 (`FL-4…FL-7` at line 790 and the low table at 813) that were written in
a second pass. In other words, the four findings this correction request reopens and the §11 header
undercount are **the same defect, two views of it**: the four rows were appended to the tables
without updating the numerals above them.

**Final row count: 6 HIGH + 18 MEDIUM + 11 LOW + 4 INFO = 39 findings.**

Aliases and cross-references counted once, as findings — not as extra rows:

| Alias | Primary finding | Reason |
|---|---|---|
| FL-7 | ANA-3 | Self-declared "detail of ANA-3"; same defect, same fix |
| *(none other)* | — | FL-6, FL-11, FL-8, DB-6/7, FL-9/10/11/12/13, SEC-3, AI-4, REG-4/5, FL-15 are distinct findings, each with its own disposition |

Also recorded here because the audit's context section stated otherwise:

- **`docs/backend/SECRETS.md` exists** (1,873 bytes, written 2026-11-07). The audit's "missing
  secret-store doc" premise was wrong; the roadmap's link to it is not dangling. → `NOT A FINDING`.
- **`docs/backend/MIGRATION_STRATEGY.md` §6 referred to `BACKEND_TEMP.md` without a path** while the
  file lives at the repository root. Fixed to point at the roadmap's Gate-3 hand-off.

---

## 1. Area A — Scoring & API (`API-*`, `ANA-*`)

| ID | Sev | Status | Root cause | Docs changed | Resolution | Evidence | Remaining uncertainty |
|---|---|---|---|---|---|---|---|
| API-1 | HIGH | RESOLVED | Three teams described the same object; `ScoreResult` had a scoring shape (`byTest`, `byQuestion`), a wire shape (`sections`, `perQuestion`) and a storage shape (`sectionsJson`). | `SCORING_METHODOLOGY.md` §2.2, §12; `API_SPECIFICATION.md` §5; `FRONTEND_DATA_CONTRACTS.md` §3; `DATABASE_SCHEMA.md` `score_result`; `ANALYTICS_ENGINE.md` §1; `ERD.md`; `FRONTEND_PAGE_SPECIFICATIONS.md` §4 | **One shape, no adapter.** `ScoreResult` is defined once in SCORING §2.2; the wire *is* it (API §5); `score_result` stores it field-for-field (`totalJson`, `byTestJson`, `byCompetencyJson`, `byQuestionJson`, `thresholdsJson`, `approvalJson`); the frontend copies it verbatim. `byQuestion` = one row per roster question with `maxScore` + `selected`; `byTest`/`byCompetency` are `Bucket` maps; `approval` is a `ProvisionalApproval`. | API §5 full JSON example; the same field names appear in SCORING §2.2, DATABASE_SCHEMA §2 and FRONTEND_DATA_CONTRACTS §3 | none |
| API-2 | HIGH | RESOLVED | The 321/2024 NAB has several clauses (`naikTotal`, `naikTiu`, `affirmationTotal`, `affirmationTkp` in one doc; `total` in another; a bare `Thresholds` in a third). The words named *instrument clauses*, not data. | `SCORING_METHODOLOGY.md` §5, §5.5; `API_SPECIFICATION.md` §5; `DATABASE_SCHEMA.md` `thresholds`; `ERD.md`; `FRONTEND_DATA_CONTRACTS.md` §3 | **Deleted the vocabulary.** One `ThresholdSet { mode, twk?, tiu?, tkp?, total?, source }`, `mode ∈ per_subtest_and_total \| per_subtest_only \| total_only \| none`, comparison `>=`. `total` is the cumulative NAB only. The clause a number came from is `source.scope` (a `BasisRef`). `mode: 'none'` = no verdict, no row. | SCORING §5.1–5.5, §11.1; DATABASE_SCHEMA `thresholds` note; FRONTEND `ThresholdEvaluation` | Which clause a session is scored against is still unestablished → UNV-10 (owner decision), shipped default `mode: 'none'` |
| ANA-1 | MEDIUM | RESOLVED | `byCompetency` was leaf-only at scoring but the dashboard needs domain rows; no doc said who rolls up. | `ANALYTICS_ENGINE.md` §2.2 | Analytics emits **every** taxonomy node (leaf + ancestor) in `perCompetency`, formed only by summing leaf buckets then applying the test formula. The frontend never aggregates. | ANALYTICS §2.2 paragraph + §6 `perCompetency` comment | none |
| ANA-3 | MEDIUM | RESOLVED | `MetricValue.value` was a 0–1 ratio in analytics and an integer percent in API/frontend. | `ANALYTICS_ENGINE.md` §6; `API_SPECIFICATION.md` §1, §6.1; `FRONTEND_DATA_CONTRACTS.md` §3 | One `MetricValue { percent: int \| null, numerator, denominator, answeredCount, sessionCount, state, sampleNote? }`. `percent` is half-up-rounded **once, in the backend**; the ratio never leaves the engine. | ANALYTICS §6 type + rounding paragraph; API §6.1 | none |
| ANA-4 | MEDIUM | RESOLVED | `state` (`reportable`/`insufficient_data`/`zero_correct`/`zero_attainment`) was computed but not carried on the wire, so FR-A4's distinction could not reach a badge. | `ANALYTICS_ENGINE.md` §6; `API_SPECIFICATION.md` §6.1; `FRONTEND_DATA_CONTRACTS.md` §3, §4 | `state` is required on every `MetricValue`; `percent` is `null` iff `insufficient_data`; the UI maps states to badges and never infers them. | FRONTEND_DATA_CONTRACTS §4 | none |
| ANA-5 | LOW | RESOLVED (doc) · owner wording pending | PRD FR-A1 and MVP_SCOPE say "mean response time"; ANALYTICS computes a median. | `ANALYTICS_ENGINE.md` §2.3; `API_SPECIFICATION.md` §1 | The statistic is the **median** and is stated as such in analytics and on the wire; the PRD wording is marked as the text to update. A mean over 110 items is dominated by one pause. | ANALYTICS §2.3 | The PRD text itself is unchanged — a product-owner wording edit (see §10 U-4) |
| FL-6 | MEDIUM | RESOLVED | Ranking needs `sessionCount`; the analytics output type did not carry it. | `ANALYTICS_ENGINE.md` §3.3, §6; `RECOMMENDATION_ENGINE.md` §1; `RECOMMENDATION_SERVICE.md` §1; `API_SPECIFICATION.md` §6.1 | `sessionCount` is **required** on every cell, with a stated meaning (sessions whose roster contains ≥1 question of that competency; ancestors = union of leaves). Recommendation tie-break "lower `sessionCount` first" is now computable from the snapshot alone. | ANALYTICS §6 justification paragraph | none |
| FL-7 | MEDIUM | RESOLVED | Duplicate of ANA-3/ANA-4. | as above | Closed with ANA-3/ANA-4; no separate fix. | — | none |

## 2. Area B — Persistence / database (`DB-*`)

| ID | Sev | Status | Root cause | Docs changed | Resolution | Evidence | Remaining uncertainty |
|---|---|---|---|---|---|---|---|
| DB-1 | MEDIUM (§11) / HIGH (finding heading) | PARTIALLY RESOLVED · **owner decision** | FR-L3 asks for a material per weakness; no table, no create path, no provenance path for material content, and the weakness basis itself presupposes a threshold that is not established. | `DATABASE_SCHEMA.md` §2 `material`; `API_ENDPOINTS.md` §7; `RECOMMENDATION_ENGINE.md` §4; `RECOMMENDATION_SERVICE.md` §2.3; `DATA_FLOW.md` §5; `USER_STORIES.md` US-L2; `FRONTEND_INFORMATION_ARCHITECTURE.md` (J-2 "Baca materi" arrow) | MVP ships **no material table**. `GET /recommendations/materials` returns the explicit absence envelope `{ status: 'no_material' \| 'no_verified_basis' }`. FR-L3 and O-3 stay as written requirements for a later phase; the gap is recorded, not papered over with an empty table. | DATABASE_SCHEMA §2 `material`; API_ENDPOINTS §7 row | Whether materials enter MVP, and with what provenance model, is the owner's call (§10 U-1) |
| DB-2 | MEDIUM (§11) / HIGH (finding heading) | RESOLVED | Question validation and review history had no table ("all validation checks and review history" — FR-Q2 — was unrenderable). | `DATABASE_SCHEMA.md` `validation_record`, `question_review`; `ERD.md`; `QUESTION_SPECIFICATION.md` §3, §4 | Two **append-only** tables. `validation_record.contentHash` makes staleness explicit (a record is stale when it differs from `question.contentHash`). `question_review` carries decision/edits/key-validation/notes. `question.lifecycle` is a cache of what they imply. | DATABASE_SCHEMA §2; ERD notes | none |
| DB-3 | MEDIUM | RESOLVED | Rule said "scoring never reads the live config", but PF-12/PF-13 *must* read the live config to detect drift — an implementer would have deleted the approval check. | `DATABASE_SCHEMA.md` §1 | Rule rephrased: *scoring reads snapshots; pre-flight compares the snapshot against live rows*, and nothing read there can feed a score (it can only produce 409/422). | DATABASE_SCHEMA §1 (DB-3) | none |
| DB-4 | MEDIUM | RESOLVED | Provider row (SQLite) + secret (external store) had no write order, so a crash could orphan a key. | `DATABASE_SCHEMA.md` `provider`/`secret_ref` | Fixed order: **create** = secret first then row (purge secret on row failure); **delete** = row first then purge (retry at startup); **cascade** = job FK `CASCADE` for finished jobs, `RESTRICT` while queued/running. | DATABASE_SCHEMA §2 provider note | none |
| DB-5 | MEDIUM | RESOLVED | `GET /analytics` could merge sessions scored under different configs into one number. | `ANALYTICS_ENGINE.md` §5; `API_SPECIFICATION.md` §6.2; `API_ENDPOINTS.md` §6 | `?configId` scopes the set. Unscoped returns one snapshot per `(configId, configVersion, scoringVersion)` triple with `comparability.mixed === true` and each triple's `sessionCount`; no average is ever taken across triples. | ANALYTICS §5; API §6.2 | none |
| DB-6 | LOW | RESOLVED | Bulk question ops were atomic but `POST /sessions` (two tables) and `POST /sessions/:id/score` had no atomicity statement. | `DATABASE_SCHEMA.md` `session` | Both write inside one SQLite transaction; a session is never observably half-scored; a failure writes nothing. | DATABASE_SCHEMA §2 Atomicity (DB-6) | none |
| DB-7 | LOW | RESOLVED | `POST /providers/:id/models` refreshes a model list; the schema had no column and no rule. | `DATABASE_SCHEMA.md` `provider.modelCacheJson` | `modelCacheJson` column, explicitly **transient**: read-only display, dropped with the provider, never used to decide behaviour (a stale list must not silently restrict a typed model). | DATABASE_SCHEMA provider note | none |
| FL-11 | LOW | RESOLVED | ERD's `SESSION_SNAPSHOT` omitted `configJson`, `thresholdsJson`, `approvalJson` — the three things scoring reads. | `ERD.md`; also `THRESHOLDS` (`naikTotal`/`naikTiu` removed), `EXAM_CONFIG` INT versions + `durationMinutes`, `SCORE_RESULT` full column set, `QUESTION`, new `VALIDATION_RECORD`/`QUESTION_REVIEW` | ERD redrawn to match DATABASE_SCHEMA column-for-column. | ERD mermaid blocks vs DATABASE_SCHEMA tables | none |
| FL-12 | LOW | RESOLVED | `MIGRATION_STRATEGY.md` §3 carried a literal `(AUD-id TBD)`. | `MIGRATION_STRATEGY.md` §3, §6 | Replaced with the real obligation (any scoringVersion conflation is recorded in `docs/AUDIT.md`); the `BACKEND_TEMP.md` pointer now points at the roadmap's Gate-3 hand-off. | MIGRATION_STRATEGY §3 | none |

## 3. Area C — Scoring detail and question model (`QS-*`, `SC-*`)

These four were **found only in the audit's §11 severity register** — they appear nowhere in the
area-by-area sections. The first resolution pass therefore missed them; each is dispositioned below
from a fresh read of the current documents, not from the earlier report.

| ID | Sev | Status | Root cause | Docs changed | Resolution | Evidence | Remaining uncertainty |
|---|---|---|---|---|---|---|---|
| QS-1 | LOW | RESOLVED | `QUESTION_SPECIFICATION.md` §1 declared `lifecycle: Lifecycle`, but no `Lifecycle` type was defined in that doc, in `DATABASE_SCHEMA.md`, or in any consumer — so "seven states" existed as prose and a mermaid diagram, not as a contract. | `QUESTION_SPECIFICATION.md` §3 (new `<code>` block); consumers verified: `DATABASE_SCHEMA.md` `question.lifecycle`, `BUSINESS_RULES.md` BR-Q3, `API_ENDPOINTS.md` §3, `FRONTEND_PAGE_SPECIFICATIONS.md` §6, `USER_JOURNEYS.md` J-5, `AI_VALIDATION.md` §1 | A `type Lifecycle = 'draft' \| 'ai_validated' \| 'human_reviewed' \| 'active' \| 'quarantined' \| 'rejected' \| 'archived'` is now defined in QUESTION_SPECIFICATION §3, immediately after the transition diagram, with the note that these seven are the only lifecycle values. `DATABASE_SCHEMA.question.lifecycle` already enumerated the same seven; the closing rule ("only `activate`, only from `human_reviewed`") names the one route into `active`. | QUESTION_SPEC §1 field `lifecycle: Lifecycle`; §3 type + closing rule; DATABASE_SCHEMA row | none. `VALIDATION.md` §1 `enum` rule references `lifecycle`; the fixed set it needs now exists. |
| SC-1 | LOW | RESOLVED | The audit found PF-09 capping thresholds at `maxPossible` computed from the **actual roster**, so a shortened practice drill carrying the full NAB would be rejected as `THRESHOLD_EXCEEDS_MAX`. No document specified practice roster length. | `SCORING_METHODOLOGY.md` §5.3, §6.2, §10.5 | **The premise no longer holds.** §5.3 now derives the ceiling from the *instrument* maximum (`CEILING_POINTS × perQuestionMax / 5`), explicitly "NOT the roster. A tournament roster is deliberately shorter than the real exam; capping at it would reject a real NAB as out of range." A shortened practice drill carrying the full NAB is therefore valid by construction, and the text says so ("SC-1"). §6.2's worked failure (`total: 999` on a 10-question roster → exceeds the 550 ceiling) and §10.5's parenthetical ("the ceiling is the instrument maximum, §5.3 — not the roster") both demonstrate the rule. | SCORING §5.3 code block + closing paragraph; §6.2; §10.5 | none. Practice roster length is still unspecified — but it is no longer load-bearing for threshold validity. |
| SC-2 | LOW | RESOLVED | `SCORING_VERSION_MISMATCH` appeared at three sites — PF-06 (cross-question), SC-08 (per-key) and a `throw` inside `scoreQuestion` (§4) — with no statement showing whether the throw is a third origin a caller must handle. | `SCORING_METHODOLOGY.md` §6.2; verified consumers: `API_SPECIFICATION.md` §4.1 (only `PREFLIGHT_FAILED.errors[]` carries PF/SC codes), §11.1 | One producer named: PF-06/SC-08 inside pre-flight, reported once per question. The §4 `throw` is now stated to be **unreachable defence in depth** — scoring runs only after every pre-flight check passes (§6.3) and PF-06/SC-08 would already have produced the report — so it cannot fire on a legitimately pre-flighted session and there is no third code path. The only surface that can carry the code is `PREFLIGHT_FAILED.errors[]`. | SCORING §6.2 "One origin per code, three checks (SC-2)"; API §4.1 | none. The `throw` remains in the code snippet as belt-and-braces; the contract no longer implies it is a live origin. |
| SC-3 | LOW | RESOLVED | §3.2's TKP example is `{A:5, B:4, C:2, D:1, E:1}` and §10.2's is `{A:5, B:4, C:3, D:2, E:1}`. Both satisfy SC-05, but nothing said so, so a reader could infer one example was a rule the other violated. | `SCORING_METHODOLOGY.md` §3.2, §10.2 | Both examples are now explicitly labelled as *one valid key among many* under SC-05, each cross-referencing the other and naming the reason they differ. SC-05 is unchanged — it checks only that every weight lies in `tkpWeightRange` and at least one equals `perQuestionMax.TKP`. | SCORING §3.2 bullet, §10.2 opening sentence, §6.1 SC-05 row | none |

---

## 4. Area C — AI pipeline (`AI-*`)

| ID | Sev | Status | Root cause | Docs changed | Resolution | Evidence | Remaining uncertainty |
|---|---|---|---|---|---|---|---|
| AI-1 | HIGH | RESOLVED | Same lifecycle split as FL-1 (3 states in BR-Q3 / schema, 5–7 in the spec). | `QUESTION_SPECIFICATION.md` §3; `BUSINESS_RULES.md` BR-Q2/BR-Q3; `DATABASE_SCHEMA.md` `question`; `API_ENDPOINTS.md` §3; `FRONTEND_PAGE_SPECIFICATIONS.md` §6; `USER_JOURNEYS.md` J-5 | **Seven states, one list**, stated as a `Lifecycle` type in QUESTION_SPECIFICATION §3 and cited — not restated — everywhere else. `draft`/`quarantined` → `human_reviewed` via `PATCH /questions/:id/accept`; only `activate` reaches `active`, only from `human_reviewed`. | QUESTION_SPEC §3 diagram + type + closing rule; API_ENDPOINTS §3 closing paragraph | none |
| AI-2 | MEDIUM | RESOLVED | AI-02 required `answerKey` on every item and AI-03 required `optionScores` on every item — both gates could never pass a TKP (no single key) or a TWK/TIU (no weight map). | `AI_VALIDATION.md` §3 | AI-02: exactly one of `answerKey` (TWK/TIU) or `optionScores` (TKP). AI-03: TKP keys equal option keys; the wrong shape for the test fails. | AI_VALIDATION §3 table rows AI-02/AI-03 | none |
| AI-3 | MEDIUM | RESOLVED | "Regeneration is a new job referencing the original" vs a new row with a different `generationId` — two identities for the same act, no field tied them. | `QUESTION_GENERATION.md` §6; `GENERATION_JOBS.md` §3; `QUESTION_SPECIFICATION.md` §2, §6 | Regeneration = new job with `count: 1`; the new `draft` carries `provenance.regeneratesQuestionId`; the original is kept and never edited in place. | QUESTION_SPEC §2 `Provenance` field; GEN §6 | none |
| AI-4 | LOW | RESOLVED | "An unmapped task is disabled with a clear reason" named no route or behaviour. | `AI_PROVIDER_ARCHITECTURE.md` §4 | Per-task consequence stated: `question` unmapped → `409 task_unmapped`; `explanation` unmapped → draft with empty flagged explanation; `material` → `{status:'no_material'}`; `analysis` → ranking without a model. `material` disabled in MVP regardless (DB-1). | AI_PROVIDER_ARCHITECTURE §4 | none |

## 5. Area D — Security (`SEC-*`)

| ID | Sev | Status | Root cause | Docs changed | Resolution | Evidence | Remaining uncertainty |
|---|---|---|---|---|---|---|---|
| SEC-1 | MEDIUM | RESOLVED | DNS rebinding was listed as a threat mitigated by "loopback bind + same-origin", which does not stop a hostile page whose own origin resolves to `127.0.0.1`. | `SECURITY.md` §1, §2 | Two server-side checks: a **`Host` allowlist** (`127.0.0.1:<port>` / `localhost:<port>`, else 421) and a **required `X-Tryoutsim-Client` header** on state-changing requests (a cross-origin `fetch` cannot add a custom header without a preflight this server never grants). Explicitly labelled transport hygiene, not authentication — ADR-009 stands. | SECURITY §1 threat row, §2 bullets | none |
| SEC-2 | MEDIUM | RESOLVED | FR-C2 wants "the exact error text"; NFR-7 forbids the key ever leaving. Nothing named the scrubbing step. | `AI_PROVIDER_ARCHITECTURE.md` §3 (Scrub); `PROVIDER_INTEGRATION.md` §5; `USER_STORIES.md` US-C1 | One **scrubber** strips the `Authorization` value, the key, its last-4, and `sk-…`-shaped tokens before any adapter string is stored or returned; the stored raw message is the scrubbed text. US-C1 now says "after secret scrubbing". | AI_PROVIDER_ARCHITECTURE §3; USER_STORIES US-C1 | none |
| SEC-3 | LOW | RESOLVED | `VALIDATION.md` forbade storing an `Authorization` header; `SECRETS.md` §3 implied a stored header could carry one. | `SECRETS.md` §3 | One rule: the header is materialised at send time and **never stored**; the write path rejects a client-supplied `Authorization`. | SECRETS §3 | none |
| SEC-4 | INFO | ACCEPTED RISK | Data at rest is plaintext SQLite; SQLite encryption is out of scope. | none (consistent as written) | Recorded, not a defect: `SECRETS.md` §4 and `SECURITY.md` §1 agree, and both say so plainly. | SECURITY §1 row 1; SECRETS §4 | none |

## 6. Area E — Regulatory evidence (`REG-*`)

| ID | Sev | Status | Root cause | Docs changed | Resolution | Evidence | Remaining uncertainty |
|---|---|---|---|---|---|---|---|
| REG-1 | HIGH | RESOLVED (correctness) · PARTIALLY (which value applies) | 321/2024 KETIGA and KEEMPAT were omitted, so "130 minutes" was carried as if it were the instrument's duration. It is the exemption duration for one legally-defined group. | `CPNS_2026_REGULATIONS.md` §2.3(a), §7 UNV-05/UNV-09; `DATABASE_SCHEMA.md` `durationMinutes`; `ERD.md`; `*.md` config examples (§4.4) | KETIGA (base **100**) and KEEMPAT (exemption group) restored; KELIMA restated as **130 for the KEEMPAT group only**. "Reading the duration diktums together" states that neither value is established for a CPNS-2026 general candidate → **UNV-09**. Shipped config asserts **no** duration (`durationMinutes = NULL`). | regulations §2.3(a) KETIGA/KEEMPAT/KELIMA + reading note; §7 UNV-09 | Which duration a 2026 general drill should use is unknown (§10 U-2). The doc no longer guesses. |
| REG-2 | MEDIUM | RESOLVED (structure) · PARTIALLY (which clause applies) | KETIGA BELAS (scope) was collapsed into KEDUA BELAS (values); KESEBELAS (the NAB *definition*) was missing; and the instrument publishes *several* NABs, not one. | `CPNS_2026_REGULATIONS.md` §2.3(a) table + "Reading the NAB diktums together"; §7 UNV-10; `SCORING_METHODOLOGY.md` §5.5 | KESEBELAS = definition; KEDUA BELAS = 65/80/166; KETIGA BELAS = scope (umum + Kalimantan); KEEMPAT BELAS = five excluded categories; KELIMA BELAS = 311 / TIU 85; KEENAM BELAS = 286 / TIU 60. The doc states the honest direction (one clause stricter, one more lenient than the sub-test sum; the cumulative stop is independent of the sub-test stops). | regulations §2.3(a); SCORING §5.5 | Which clause the app scores against needs an owner decision → **UNV-10**, default `mode: 'none'` |
| REG-3 | MEDIUM | RESOLVED | `UNV-*` items (unresolved questions) were listed inside `regulatoryBasis`, which `BasisRef` cannot represent, so the hash that binds approval had undefined input. | `CPNS_2026_REGULATIONS.md` §4.4 | `regulatoryBasis` lists **documents only**; UNV items can never be a `BasisRef`; the `skd-cpns-2026-provisional` basis is Permen PANRB 6/2024 Pasal 30 + Kepmen PANRB 321/2024 (2024 numbers), with **406/2026 removed** as a CPNS basis. | regulations §4.4 table + REG-3 note | none |
| REG-4 | LOW | RESOLVED | 65+80+156 = 301 vs cumulative 281 read as an arithmetic error; the diktum numbering was also off by one. | `CPNS_2026_REGULATIONS.md` §2.3(b), REG-4 note | Table rewritten: KETUJUH definition, KEDELAPAN 65/80/156, KESEMBILAN affirmation exception, KESEPULUH 281 / TIU 55; the 301-vs-281 relationship is stated (cumulative stop ≠ sub-test sum). | regulations §2.3(b) | none |
| REG-5 | LOW | ACCEPTED RISK | The 2021 "110 items / 100 minutes" row comes from a title, not a body. | `CPNS_2026_REGULATIONS.md` §3 | Row kept `HISTORICAL` with the limitation stated and marked **not used by any config**. | regulations §3 row 2021 | none |
| FL-15 | INFO | RESOLVED | `.research/kepmen321_2024.txt` was suspected of carrying 406/2026's signing date. | `CPNS_2026_REGULATIONS.md` §2.3(a) provenance row | Verified: the stub is 150 bytes of JDIH nav URLs with no date; "27 Juli 2026" occurs only in `kepmen406_2026.txt` (the 406 signing date). 321/2024's date (`2024-07-29`) comes from the JDIH API `tanggal_penetapan` field and the image-scan PDF. | regulations §2.3(a) Signed/Posted row | none |

## 7. Area F — Cross-document consistency (`FL-*`)

| ID | Sev | Status | Root cause | Docs changed | Resolution | Evidence | Remaining uncertainty |
|---|---|---|---|---|---|---|---|
| FL-1 | HIGH | RESOLVED | Lifecycle: 5 states in one doc, 3 in another, and a `draft → active` shortcut in the page spec. | `QUESTION_SPECIFICATION.md` §3; `BUSINESS_RULES.md`; `DATABASE_SCHEMA.md`; `API_ENDPOINTS.md`; `FRONTEND_PAGE_SPECIFICATIONS.md`; `USER_JOURNEYS.md`; `AI_VALIDATION.md` §1 | See AI-1: seven states, one `Lifecycle` type, one transition diagram, one authorization route per edge, and history persisted (`validation_record`, `question_review`). Every other doc cites QUESTION_SPEC §3 rather than restating the states. | QUESTION_SPEC §3; DATABASE_SCHEMA `question.lifecycle`; BR-Q3 | none |
| FL-2 | HIGH | RESOLVED | The four approval-bound values were written three ways: `VALIDATION.md` included `approvedByUserAt` (not a bound value) and omitted `configId`; §4.4, ADR-004 and the API disagreed on the authorizer and timestamp semantics; persistence was unstated. | `CPNS_2026_REGULATIONS.md` §4.3 (the one canonical definition); `VALIDATION.md` §2; `ADR-004`; `API_SPECIFICATION.md` §7.2; `DATABASE_SCHEMA.md` `provisional_approval`; `BUSINESS_RULES.md` BR-E3 | **One canonical definition** in regulations §4.3: fields + meaning table (bind: `configId`, `configVersion`, `scoringVersion`, `regulatoryBasisHash`; evidence: `approvedByUserAt`, `approvedBy`, `acknowledgedWarnings`); authorizer = the single local user, values server-computed, client supplies `configId` + acks only; timestamp = server clock, UTC, ms, **evidence only** (not a bound value); invalidation = any bound value or `ThresholdSet` field changes; re-approval = append a row; persistence = append-only `provisional_approval`, four enforcement points named. | regulations §4.3; VALIDATION §2; ADR-004 Consequences | **No `AGENTS.md` requirement was removed or weakened** — the four bound values are exactly those named there; see §9 for the ambiguity note |
| FL-3 | HIGH | RESOLVED | Three flows used routes that did not exist: draft acceptance, re-scoring after a 409, and "approve". | `API_SPECIFICATION.md` §7.1–7.3; `API_ENDPOINTS.md` §2, §3, §5; `USER_JOURNEYS.md` J-1, J-4 | Three complete contracts (purpose, authorization, request, response, validation, errors, idempotency, state transition, DB effect): `PATCH /questions/:id/accept`, `POST /exam-configs/:id/approval` (replaces `/approve`, no alias), `POST /sessions/:id/score`. | API_SPECIFICATION §7; API_ENDPOINTS §2/§3/§5 | none |
| FL-4 | MEDIUM | RESOLVED | `submit` was "idempotent per snapshot" but nothing could re-score a stored-unscored session. | `API_SPECIFICATION.md` §7.3; `DATABASE_SCHEMA.md` `session`; `ERROR_HANDLING.md` §4, §6; `DATA_FLOW.md` §3 | Session = `open → submitted → submitted+score_result`; "scored" lives on the result row, not a fourth status. `submit` again → `409 already_submitted`; `/score` on a scored session → `409 not_resubmittable`; failures write nothing. | DATABASE_SCHEMA state machine; ERROR_HANDLING §4 | none |
| FL-5 | MEDIUM | RESOLVED | `APPROVAL_MISSING` existed in scoring §11 but not in the error registry, so a client could not branch on it. | `API_SPECIFICATION.md` §4; `ERROR_HANDLING.md` §4; `FRONTEND_DATA_CONTRACTS.md` §2; `FRONTEND_STATE_MANAGEMENT.md` §5; `FRONTEND_MOCK_DATA_STRATEGY.md` §2; `VALIDATION.md` §3; `ERD.md`; `API_ENDPOINTS.md` legend | Registered: 409, `{ changed: [], config }` — empty by construction, since "never approved" has nothing to diff. Added to every consumer's union and to the domain-failure table. | API_SPECIFICATION §4 row | none |
| FL-8 | MEDIUM | RESOLVED | `naikTotal`/`ThresholdSet.total` named different things; "when does a threshold apply" was unstated. | `SCORING_METHODOLOGY.md` §5, §5.5, §11.1; `API_SPECIFICATION.md` §5 | See API-2. Additionally: threshold evaluation is per session against the frozen `ThresholdSet`; the clause is a product decision (UNV-10); and when one submit trips several codes the **precedence** is fixed: pathway/year/scope → APPROVAL_MISSING → APPROVAL_VERSION_MISMATCH → APPROVAL_INVALID → THRESHOLD_CONFIG_INVALID → 422. | SCORING §11.1; API §4 registry note | none |
| FL-9 | LOW | RESOLVED | IA had no top-level Exam-config section although `/exam-configs/:id` and the approval UI exist. | `FRONTEND_INFORMATION_ARCHITECTURE.md` §1, §2 | **Konfigurasi Ujian** added as a section under "Alat", mapping to `/exam-configs/:id`. | IA §1 table | none |
| FL-10 | LOW | RESOLVED | FR-D1, FR-D4, FR-D5, FR-P3, FR-A3, FR-C5, FR-E1 and FR-Q3/Q4 had no user story. | `USER_STORIES.md` | Stories added for the dashboard (US-A5: FR-D1/D4/D5) and runner parity (US-A6: FR-P3); US-L2 marked deferred; US-C1 corrected for SEC-2. FR-A3, FR-C5, FR-E1, FR-Q3/Q4 remain covered by page specs and the feature matrix — see §10 **U-5** for the story-writing call. | USER_STORIES §Hasil, §Latihan, §Rekomendasi | Not all 12 missing stories were invented; only those whose absence hid a contract gap |
| FL-13 | LOW | RESOLVED | `test()` returned `{ok, error?}`; `PROVIDER_INTEGRATION` returned `{ok, latencyMs, reason}`. | `AI_PROVIDER_ARCHITECTURE.md` §2; `PROVIDER_INTEGRATION.md` §5 | One shape: `{ ok: true, latencyMs } \| { ok: false, latencyMs, reason }`, inside the success envelope (a failed test is a result, not an API error); `reason` is scrubbed. | AI_PROVIDER_ARCHITECTURE §2; PROVIDER_INTEGRATION §5 | none |

## 8. Cross-document audit — verification performed

Searched every `.md` under `docs/` (excluding `docs/audit/`, which is preserved history) for the old
contracts, then checked each hit by hand:

| Pattern | Hits outside `docs/audit/` | Verdict |
|---|---|---|
| `byTest` | SCORING §2.2, API §5, DATABASE_SCHEMA, FRONTEND §3, API §7 | correct — the single name |
| `sections`, `perQuestion`, `perQuestionJson`, `sectionsJson` | none (only in "not `sections`" / "not `perQuestion`" explanatory asides) | clean |
| `naikTotal`, `naikTiu`, `affirmationTotal`, `affirmationTkp` | only in "there is no such field" statements | clean |
| `/approve` | only "no `/approve` alias" | clean |
| `POST /exam-configs/:id/approval` | API_ENDPOINTS §2, API §7.2, VALIDATION §2, USER_JOURNEYS J-1/J-4 | consistent |
| `PATCH /questions/:id/accept` | API_ENDPOINTS §3, API §7.1, USER_JOURNEYS J-1/J-5, FRONTEND_PAGE §6 | consistent |
| `POST /sessions/:id/score` | API_ENDPOINTS §5, API §7.3, USER_JOURNEYS J-4, ERROR_HANDLING §4, DATA_FLOW §3, FRONTEND_PAGE §3 | consistent |
| three-state lifecycle (`draft`/`active`/`archived`) | none | clean |
| `APPROVAL_MISSING` | API §4, ERROR_HANDLING §4, FRONTEND §2/§5, FRONTEND_STATE §5, FRONTEND_MOCK §2, VALIDATION §3, ERD notes, API_ENDPOINTS legend | consistent |
| `MetricValue.value` (ratio) | none | clean |
| "mean response time" | ANALYTICS §2.3 (as a correction note), AUDIT history | clean |
| `130` minutes | regulations only, always scoped to KELIMA | clean |
| `durationMinutes` | DATABASE_SCHEMA, ERD — both `NULL` = no claim | clean |
| `AUD-id TBD` | none | clean |
| `BACKEND_TEMP.md` without path | AUDIT.md (root file, correct), DEVELOPMENT_ROADMAP (root file, correct) | clean |

Consistency between the three descriptions of each shared shape was re-checked where both exist: `ThresholdSet` (SCORING
§5) vs `thresholds` table vs `FRONTEND_DATA_CONTRACTS` §3; `ProvisionalApproval` (regulations §4.3) vs
`provisional_approval` table vs API §5 example; `AnalyticsSnapshot` (ANALYTICS §6) vs API §6 vs
FRONTEND §3.

---

## 9. `AGENTS.md` non-negotiable check (FL-2 guard)

The instruction for FL-2 forbids removing or weakening an `AGENTS.md` requirement to make a document
consistent. Each was checked:

| `AGENTS.md` constraint | After the changes |
|---|---|
| No fabricated regulation | Regulations §2.3(a)/(b) restored from the primary sources (321/2024 image scan, 406/2026 text); every new row carries a tier. |
| Pathway separation | 406/2026 removed from the CPNS config's `regulatoryBasis` (REG-3); the Sekolah Kedinasan config keeps it. |
| No silent approval drift; any change to the four bound values forces re-approval | Kept, and made sharper: the four values are named identically in regulations §4.3, `AGENTS.md`, ADR-004 and `VALIDATION.md`; a period-bound `approvedByUserAt` is no longer one of them. |
| Scoring is a pure function | Kept: SCORING §8 unchanged; the approval check lives in pre-flight (DB-3), not in the score. |
| Frontend renders, never recomputes | Kept and strengthened (ANA-1 roll-up moved to the backend; `MetricValue.percent` computed once). |
| Secrets write-only | Kept, plus the SEC-2 scrubber and SEC-3 single rule. |
| No implementation without approval | Kept: this task changed no source, installed nothing, ran no Gate. |

**One ambiguity worth an owner decision, not a silent fix:** `AGENTS.md` says a change to any of the
four bound values "forces re-approval", but does not say what happens if a *threshold or scoring-rule
field* changes while the four values stay the same — a shipped config can change its `ThresholdSet`
without bumping `configVersion`/`scoringVersion`. Those changes do affect the verdict. This record
**extends**, and does not weaken, the rule: `APPROVAL_INVALID` also fires on any `ThresholdSet` field
change (`API_SPECIFICATION.md` §4.2 bounds; regulations §4.3 invalidation). If the owner prefers the
strict reading (any threshold change must *also* bump `configVersion`), that is a one-line change to
regulations §4.3 and is recorded here as an open decision (§10 **U-6**).

---

## 10. Decisions the owner must still make

None of these are resolvable from the existing approved requirements or primary evidence.

| # | Decision | Why it cannot be derived | Where it is recorded | Default in the docs today |
|---|---|---|---|---|
| U-1 | DB-1 — do materials enter the MVP? | FR-L3 asks for them; there is no material bank, no provenance path, and the weakness basis is itself unestablished | DATABASE_SCHEMA §2 `material`; API_ENDPOINTS §7; RECOMMENDATION_ENGINE §4 | No material table; explicit `{ status: 'no_material' }` |
| U-2 | UNV-09 — which duration (100 base / 130 exemption) a 2026 general-candidate drill uses | Neither value is established for CPNS 2026; the two belong to different groups even in 2024 | regulations §7 UNV-05/UNV-09 | `durationMinutes = NULL` — no claim |
| U-3 | UNV-10 — which NAB clause a session is scored against | The app has no `formasi`; 321/2024 publishes several clauses by category | regulations §7 UNV-10; SCORING §5.5 | `mode: 'none'` — no verdict |
| U-4 | ANA-5 — change PRD FR-A1 from "mean" to "median" | A product wording change this record cannot make on its own | ANALYTICS §2.3; API §1 | Median, stated as such |
| U-5 | FL-10 — are US additions for FR-A3, FR-C5, FR-E1, FR-Q3/Q4 wanted? | These FRs are covered by page specs; a story is a product-writing decision | USER_STORIES.md | Covered by page specs + feature matrix |
| U-6 | Whether a `ThresholdSet` change alone must also bump `configVersion` (strict reading of `AGENTS.md`) | The requirement does not say | §8 above; regulations §4.3 | Any `ThresholdSet` change invalidates the approval (equivalent in effect) |

---

---

## 11. Cross-reference matrix — every original finding, exactly once

One row per finding as it appears in the audit's §11 register (the primary disposition is the §1–§6
row that owns it). Severity is the audit's §11 register severity, copied unchanged — see the
labelling note below the counts. "Primary" is where the fix lives; an alias or a detail finding
points at its owner but still has its own status.

### HIGH — 6

| # | ID | Sev | Area | Primary disposition | Status |
|---|---|---|---|---|---|
| 1 | FL-1 | HIGH | Cross-doc | §6 FL-1 (→ AI-1 for the type) | RESOLVED |
| 2 | FL-2 | HIGH | Cross-doc | §6 FL-2 (+ §8 `AGENTS.md` check) | RESOLVED |
| 3 | FL-3 | HIGH | Cross-doc | §6 FL-3 | RESOLVED |
| 4 | API-1 | HIGH | API | §1 API-1 | RESOLVED |
| 5 | API-2 | HIGH | API | §1 API-2 (+ §6 FL-8) | RESOLVED |
| 6 | REG-1 | HIGH | Regulatory | §5 REG-1 | RESOLVED (correctness) · U-2 open |

### MEDIUM — 18

| # | ID | Sev | Area | Primary disposition | Status |
|---|---|---|---|---|---|
| 7 | FL-4 | MEDIUM | Cross-doc | §6 FL-4 | RESOLVED |
| 8 | FL-5 | MEDIUM | Cross-doc | §6 FL-5 | RESOLVED |
| 9 | FL-6 | MEDIUM | Cross-doc | §1 FL-6 | RESOLVED |
| 10 | DB-1 | MEDIUM | DB | §2 DB-1 | RESOLVED (contract) · PARTIALLY (U-1) |
| 11 | DB-2 | MEDIUM | DB | §2 DB-2 | RESOLVED |
| 12 | DB-3 | MEDIUM | DB | §2 DB-3 | RESOLVED |
| 13 | DB-4 | MEDIUM | DB | §2 DB-4 | RESOLVED |
| 14 | DB-5 | MEDIUM | DB | §2 DB-5 | RESOLVED |
| 15 | ANA-1 | MEDIUM | Analytics | §1 ANA-1 | RESOLVED |
| 16 | ANA-3 | MEDIUM | Analytics | §1 ANA-3 | RESOLVED |
| 17 | ANA-4 | MEDIUM | Analytics | §1 ANA-4 | RESOLVED |
| 18 | SEC-1 | MEDIUM | Security | §4 SEC-1 | RESOLVED |
| 19 | SEC-2 | MEDIUM | Security | §4 SEC-2 | RESOLVED |
| 20 | REG-2 | MEDIUM | Regulatory | §5 REG-2 | RESOLVED (structure) · U-3 open |
| 21 | REG-3 | MEDIUM | Regulatory | §5 REG-3 | RESOLVED |
| 22 | AI-2 | MEDIUM | AI | §4 AI-2 | RESOLVED |
| 23 | AI-3 | MEDIUM | AI | §4 AI-3 | RESOLVED |
| 24 | FL-7 | MEDIUM | Cross-doc | §1 FL-7 → **alias of ANA-3** (no separate fix) | RESOLVED with ANA-3 |

### LOW — 11

| # | ID | Sev | Area | Primary disposition | Status |
|---|---|---|---|---|---|
| 25 | ANA-5 | LOW | Analytics | §1 ANA-5 | RESOLVED (doc) · U-4 open |
| 26 | QS-1 | LOW | Question model | §3 QS-1 | RESOLVED |
| 27 | SC-1 | LOW | Scoring | §3 SC-1 | RESOLVED |
| 28 | SC-2 | LOW | Scoring | §3 SC-2 | RESOLVED |
| 29 | SC-3 | LOW | Scoring | §3 SC-3 | RESOLVED |
| 30 | DB-6 | LOW | DB | §2 DB-6 | RESOLVED |
| 31 | DB-7 | LOW | DB | §2 DB-7 | RESOLVED |
| 32 | FL-9 | LOW | Cross-doc | §6 FL-9 | RESOLVED |
| 33 | FL-10 | LOW | Cross-doc | §6 FL-10 | RESOLVED (partial stories) · U-5 open |
| 34 | FL-11 | LOW | Cross-doc | §2 FL-11 | RESOLVED |
| 35 | FL-13 | LOW | Cross-doc | §6 FL-13 | RESOLVED |

### INFO — 4

| # | ID | Sev | Area | Primary disposition | Status |
|---|---|---|---|---|---|
| 36 | FL-14 | INFO | Cross-doc | §6 FL-14 | RESOLVED |
| 37 | FL-15 | INFO | Regulatory | §5 FL-15 | RESOLVED |
| 38 | REG-4 | INFO | Regulatory | §5 REG-4 | RESOLVED |
| 39 | SEC-4 | INFO | Security | §4 SEC-4 | ACCEPTED RISK |

### Recalculated counts

| Severity | Reported | RESOLVED | PARTIALLY RESOLVED | ACCEPTED RISK | OPEN |
|---|---|---|---|---|---|
| HIGH | 6 | 5 | 1 (REG-1) | 0 | 0 |
| MEDIUM | 18 | 17 | 1 (DB-1) | 0 | 0 |
| LOW | 11 | 11 | 0 | 0 | 0 |
| INFO | 4 | 3 | 0 | 1 (SEC-4) | 0 |
| **Total** | **39** | **36** | **2** | **1** | **0** |

Zero `OPEN` findings at any severity. The two `PARTIALLY RESOLVED` findings are consistent documents
whose *values* await evidence: REG-1 (which duration applies — UNV-09) and DB-1 (whether materials
enter the MVP). Each ships with a documented default that asserts nothing unproven, so neither
leaves a contradiction. The six owner decisions U-1…U-6 are judgement calls on already-documented
behaviour, not open defects.

**Severity labelling check.** The audit's §11 register places DB-1 and DB-2 under **MEDIUM (11
rows)**; the same report's finding headings call them **HIGH** (lines 268, 281). Because "MEDIUM
reported = 18" counts them there, and because the finding headings of the report body say HIGH, this
record lists DB-1 and DB-2 as **MEDIUM** with respect to the §11 register (so the row count is
18) and states the discrepancy here rather than silently normalising it.

If the two are counted as HIGH instead of MEDIUM — the finding headings' labelling — the totals
become HIGH 8, MEDIUM 16, LOW 11, INFO 4. The finding set is the same 39 rows either way; only two
labels move.

---

## 12. What was not changed

- The independent audit report — preserved verbatim as history.
- Prior findings (AUD-01…AUD-28, AUD-50…AUD-53) and their resolutions in `docs/AUDIT.md`.
- Any source file, dependency, provider/model configuration, or Git history.
- The PRD's requirement text (see U-4).
