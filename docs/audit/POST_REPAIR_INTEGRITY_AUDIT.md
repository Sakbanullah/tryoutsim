# Post-Repair Documentation Integrity Audit

Auditor: documentation-only pass over the corrections recorded in
[SYSTEM_REVISION_REPORT.md](./SYSTEM_REVISION_REPORT.md) §12.
Date: 2026-11-08
Scope: `docs/` Markdown only. **No source code, dependency, test, build or Git operation was performed.**
**No source document was modified during this audit.**

Status: **audit complete - findings reported, nothing corrected.**

> This audit **contradicts** the claim made in `SYSTEM_REVISION_REPORT.md` §12.7 that the shell-replacement
> damage was fully repaired and that "a scan for the corruption patterns now returns zero hits". That claim
> was based on a token list that was too narrow. The damage is still present in six documents, including
> semantic content in the two documents the Product Owner named as priority. See §2 and §5.

---

## 1. Why the earlier "zero corruption" claim was wrong

The repair passes in §12.7 searched for a **fixed list** of damaged spellings (`GENERNTION`,
`DNTNBNSE`, `NNNLYTICS`, `INFORMNTION`, and a few others). Every occurrence of those strings was repaired,
so the scan correctly returned zero **for that list**.

The underlying corruption is broader than the list: a text replacement turned the letter `A`/`a` into `N`
across whole words. That produces an unbounded set of damaged spellings. Words whose leading `A` was eaten
(`Answer` -> `Nnswer`, `AI` -> `NI`, `Arrows` -> `Nrrows`) were never in the list, so they were never
searched for and never repaired.

The method used here is different and is stated so the reader can judge it:

1. Locate every token that no longer exists in the Git `HEAD` baseline of the same file.
2. Flag tokens whose shape is only explainable by a lost `A` (a capital run containing `N`, or `N`
   immediately followed by lower-case inside an identifier).
3. Read the surrounding sentence to confirm the token is damage and not a newly introduced word.

Step 3 is a human read, not a token test - which is why this audit reads documents instead of scanning them.

---

## 2. The eight affected documents

The eight documents touched by the corrupted replacement are those named in `SYSTEM_REVISION_REPORT.md`
§12.7. This audit confirms the list is complete: no other file under `docs/` contains the corruption
patterns.

| # | Document | Baseline | Damaged lines | Damaged tokens | Current state |
|---|---|---|---|---|---|
| 1 | `examination/SCORING_METHODOLOGY.md` | Git `HEAD` | **78** | **97** | **DAMAGED - semantic** |
| 2 | `backend/ERD.md` | Git `HEAD` | **15** | **18** | **DAMAGED - semantic** |
| 3 | `architecture/SYSTEM_ARCHITECTURE.md` | Git `HEAD` | **13** | **9** | **DAMAGED - title and domain terms** |
| 4 | `product/PRD.md` | Git `HEAD` | **27** | **8** | **DAMAGED - heading and domain terms** |
| 5 | `frontend/FRONTEND_RESULTS_ANALYTICS.md` | **untracked** | **9** | **6** | **DAMAGED - no baseline** |
| 6 | `product/FEATURE_MATRIX.md` | Git `HEAD` | **12** | **2** | **DAMAGED - domain terms** |
| 7 | `product/USER_STORIES.md` | Git `HEAD` | 0 | 0 | clean - repair complete |
| 8 | `frontend/FRONTEND_PRD.md` | Git `HEAD` | 0 | 0 | clean - repair complete |

Total damaged lines: **154**. Total damaged tokens: **140**.

Only #7 and #8 are actually repaired. The §12.7 statement "a scan for the corruption patterns now returns
zero hits" is true only for #7 and #8 and only for the narrow list.

---

## 3. Per-document findings

### 3.1 `examination/SCORING_METHODOLOGY.md` - **CRITICAL**

> **Status (2026-11-09).** Findings PR-01…PR-13 below are repaired;
> [POST_REPAIR_REPAIR_REPORT.md](./POST_REPAIR_REPAIR_REPORT.md) §4 records each before → after with its
> source, and [FINAL_DOCUMENTATION_INTEGRITY_AUDIT.md](./FINAL_DOCUMENTATION_INTEGRITY_AUDIT.md) carries the
> verdict. Line numbers and the corrupted spellings below are the **audit-time evidence** and are kept
> verbatim; they no longer describe the files.

This is the canonical scoring document. It is the most damaged file, and the damage is not cosmetic: the
**type vocabulary and the error-code vocabulary** are corrupted.

| Location | Corrupted | Correct (HEAD / canonical) | Effect |
|---|---|---|---|
| §2.2 heading, l.63 | `Nnswer key` | `Answer key` | heading |
| l.66, 74, 213, 455, 477, 625, 732, 733, 738 | `NnswerKey` / `NnswerSheet` | `AnswerKey` / `AnswerSheet` | **Type names** in four `ts` code blocks. The contract no longer matches `ERD.md` (`ANSWER_SHEET`) or `DATABASE_SCHEMA.md` |
| l.140 | `Nn unanswered` | `An unanswered` | prose |
| §3 heading, l.149 | `## 3. Nnswer key shapes` | `Answer key shapes` | heading |
| l.184, 185, 665 | `Kepmen PNNRB` | `Kepmen PANRB` | **issuing authority name** |
| l.184 | `HISTORICNL` | `HISTORICAL` | **evidence-tier literal** - no longer a valid tier |
| l.185, 665 | `KELIMN` | `KELIMA` | **Diktum ordinal** |
| l.185 | `TN 2026` | `TA 2026` | exam-year abbreviation |
| l.204 | `Nuto-submit` | `Auto-submit` | rule text |
| l.357 | `Permen PNNRB 6/2024` | `Permen PANRB 6/2024` | legal citation |
| l.394, 665, 694 | `SEKOLNH_KEDINNSNN` | `SEKOLAH_KEDINASAN` | storage enum literal |
| l.486, 638-643 | `SNNPSHOT_*` | `SNAPSHOT_*` | **error-code family** |
| l.488, 663, 664, 667, 670, 977 | `REGULNTORY_*` | `REGULATORY_*` | **error-code family** |
| l.581, 955, 981, 1014 | `PREFLIGHT_FNILED` | `PREFLIGHT_FAILED` | **error code** |
| l.489 | `PF-13 | Npproval integrity` | `Approval integrity` | rule text |
| l.500 | `Npplies to` | `Applies to` | table header |
| l.521 | `Nn earlier draft` | `An earlier draft` | explanatory note |
| l.308-383, 426-440, 901 | `NNB` | `NAB` (Nilai Ambang Batas) | **domain term**, 10 occurrences |
| l.913, 916, 921, 942, 949-968, 997 | `Npproval`, `ScoreNpprovalRef`, `ProvisionalNpproval` | `Approval`, `ScoreApprovalRef`, `ProvisionalApproval` | **type names in §11** |
| l.718 | `activeMsNtStart` | `activeMsAtStart` | field name |
| l.80 | `points NND the counts` | `points AND the counts` | prose |
| l.98, 724 | `Nrray` | `Array` | `ts` type |
| l.435 | `docs/audit/NUDIT_FINDINGS_RESOLUTION.md` | `docs/audit/AUDIT_FINDINGS_RESOLUTION.md` | **dead file reference** (target does not exist) |

Measured against baseline: `Answer` occurrences **19 -> 0**; `NAB` **2 -> 0**; `Nnswer` **0 -> 20**.

### 3.2 `product/FEATURE_MATRIX.md` - **CRITICAL**

`AI` was replaced with `NI` throughout. Fifteen occurrences, zero remaining `AI`.

| Lines | Corrupted | Correct | Effect |
|---|---|---|---|
| 35 | `N questions` | `N questions` is correct; row is fine | - |
| 53 | `Npproved material per weakness` | `Approved material per weakness` | requirement text |
| 56, 57, 62-69 | `NI`, `NI config`, `NI orders/explains`, `NI draft` | `AI`, `AI config`, `AI orders/explains`, `AI draft` | **eleven feature-area cells** name the wrong subsystem |
| 68 | `Non-NI works w/o provider` | `Non-AI works w/o provider` | FR-C7 wording |

Measured against baseline: `AI ` **10 -> 0**; `NI ` **0 -> 15**.

The matrix is the traceability spine for `PRD.md` §9. With `AI` renamed to `NI`, eleven FR rows point at a
subsystem that does not exist in any other document. Traceability still resolves by FR id, but the matrix
no longer reads correctly.

### 3.3 `backend/ERD.md` - **HIGH**

| Line | Corrupted | Correct | Effect |
|---|---|---|---|
| 4 | `Nrrows are` | `Arrows are` | diagram legend |
| 8, 44 | `BNSIS_REF` | `BASIS_REF` | **entity name** |
| 10, 59 | `PROVISIONNL_APPROVAL` | `PROVISIONAL_APPROVAL` | **entity name** |
| 14, 81, 219 | `SESSION_SNNPSHOT` | `SESSION_SNAPSHOT` | **entity name** |
| 31, 198 | `NI_ROUTING` | `AI_ROUTING` | **entity name** |
| 53 | `cumulative NNB` | `cumulative NAB` | domain term |
| 117 | `elapsedNctiveMs` | `elapsedActiveMs` | field name |
| 137 | `difficultyNiInitial` | `difficultyAiInitial` | field name |
| 222 | `PREFLIGHT_FNILED`, `REGULNTORY_*` | `PREFLIGHT_FAILED`, `REGULATORY_*` | error codes |

Entity names in the ERD no longer match `DATABASE_SCHEMA.md` table names (`basis_ref`,
`provisional_approval`, `session_snapshot`, `ai_routing`). Four of the six entities renamed by this revision
are corrupted.

### 3.4 `architecture/SYSTEM_ARCHITECTURE.md` - **HIGH**

| Line | Corrupted | Correct |
|---|---|---|
| 1 | `# System Nrchitecture` | `# System Architecture` (**document title**) |
| 6, 15, 36, 50, 66 | `NI`, `NI provider`, `OpenNI-compatible` | `AI`, `AI provider`, `OpenAI-compatible` |
| 30, 40, 80 | `NPI gateway`, `NPI keys`, `NPI paths` | `API gateway`, `API keys`, `API paths` |
| 32, 63 | `Nnalytics` | `Analytics` |
| 44, 75 | `NDR`, `NDRs` | `ADR`, `ADRs` |

`OpenAI-compatible` is a **named provider preset** in `PRD.md` FR-C1 and `AI_PROVIDER_ARCHITECTURE.md`; as
`OpenNI-compatible` it names nothing.

### 3.5 `product/PRD.md` - **HIGH**

| Line | Corrupted | Correct | Effect |
|---|---|---|---|
| §14 heading, l.369 | `## 14. Ncceptance criteria` | `## 14. Acceptance criteria` | **section heading**; confirmed absent from baseline as `Acceptance` |
| 12, 21, 35, 66, 91, 98, 107, 110, 200, 228, 234, 249, 256, 265, 266, 275, 324, 344, 353, 365, 366, 377 | `NI`, `NI provider`, `NI-drafted`, `non-NI`, `openNI-compatible` | `AI`, ... | 21 occurrences of a subsystem rename in the product requirements |
| 40, 306 | `NPI keys` | `API keys` | security requirement text |
| 132 | `Nnything` | `Anything` | prose |
| 171 | `*Nnalogi*`, `*Deret Nngka*` | `*Analogi*`, `*Deret Angka*` | **example submateri names** in FR-P1 |

### 3.6 `frontend/FRONTEND_RESULTS_ANALYTICS.md` - **HIGH (no baseline)**

This file is **untracked**, so no Git baseline exists. Damage is inferred from context and from parity with
the same strings in tracked files.

| Line | Corrupted | Correct | Basis |
|---|---|---|---|
| 1 | `# Frontend Results and Learning Nnalytics` | `... Learning Analytics` | title |
| 3 | `NnalyticsSnapshot` | `AnalyticsSnapshot` | type name used in `ANALYTICS_ENGINE.md` |
| 60 | `Nn NI-origin question` | `An AI-origin question` | prose + domain term |
| 70 | `via HISTORICNL` basis | `via HISTORICAL` | tier literal |
| 80 | `The NPI enforces this` | `The API enforces this` | prose |
| 97 | `PREFLIGHT_FNILED`, `REGULNTORY_*` | `PREFLIGHT_FAILED`, `REGULATORY_*` | error codes |
| 138, 165, 177 | `NI-written` | `AI-written` | domain term |

### 3.7 `product/USER_STORIES.md` - clean

No damaged line. The three `N`-initial tokens are legitimate words (`Number`, `Nothing`, `Non-goals`).

### 3.8 `frontend/FRONTEND_PRD.md` - clean

No damaged line. The two `N`-initial tokens are legitimate (`Never`, `Non-functional`).

---

## 4. The two previously skipped documents

Both were read in full for this audit. **Neither is damaged** and **both are consistent** with the current
Product Owner decisions.

### 4.1 `examination/MATERIAL_SPECIFICATION.md` (123 lines, §1-§7)

| Check | Result |
|---|---|
| Corruption | none |
| Section numbering | §1 Record, §2 Scope, §3 Provenance, §4 Sources, §5 Approval, §6 Validation, §7 Boundaries - contiguous, no gaps |
| Type/enum literals | `contentType`, `MaterialScope`, `MaterialStatus`, `SourceRef.tier` all well-formed |
| Links | 6 targets, all resolve |
| Decision G conformance | manual **and** AI drafting (§3), draft-until-approved (§3, §5), version history (§5), taxonomy-bound main material + free notes (§2), unmapped material excluded from analytics (§2 rule 3), sources required only for factual/legal/historical/policy (§4), unverified labelled never promoted (§4) |
| DB-1 supersession | stated at the top and cross-referenced to the report |

Two observations, neither a defect:

- `SourceRef.tier` (l.87) lists four tiers and omits `VERIFIED-ABSENCE` and
  `EVIDENCE-BACKED-NOT-CPNS-2026` from the `EvidenceTier` set in `CPNS_2026_REGULATIONS.md` §4.1. This is a
  deliberate narrowing for material sources, but it is an **unstated** narrowing - the file does not say so.
  Recorded as LOW.
- §6 M-06 is marked "no" (flags only) while the table header is "Blocks `approved`" - the column reads
  correctly. No change needed.

### 4.2 `backend/NOTIFICATION_SPECIFICATION.md` (126 lines, §1-§8)

| Check | Result |
|---|---|
| Corruption | none |
| Section numbering | §1-§8 contiguous |
| Event set | ten types, closed, each with severity and deep link |
| Decision J conformance | in-app only, no OS/Windows (§1), generation done/failed/interrupted (§2), batch awaiting sampling (§2), backup success/fail (§2), question report + quarantine (§2), validation done (§2), restore done (§2) |
| Decision J4 conformance | **no cancel event exists** - correct after §12.1. There is no `generation_cancelled` type, which is right |
| Delivery | backend writes inside the owning transaction; UI polls; no push (§5) |
| Contracts | `GET /notifications`, `PATCH /notifications/:id`, `POST /notifications/read-all` - all three exist in `API_ENDPOINTS.md` §9 |

No defect found.

---

## 5. Findings

### CRITICAL

| ID | Finding | Location | Impact |
|---|---|---|---|
| **PR-01** | Scoring type vocabulary corrupted: `AnswerKey`, `AnswerSheet` -> `NnswerKey`, `NnswerSheet` (20 occurrences; `Answer` count 19 -> 0) | `SCORING_METHODOLOGY.md` l.63-738 | The canonical scoring contract no longer uses the type names the backend, DB and frontend contracts reference. A future implementer copying these types builds the wrong names |
| **PR-02** | Error-code families corrupted: `PREFLIGHT_FNILED`, `REGULNTORY_*`, `SNNPSHOT_*` | `SCORING_METHODOLOGY.md`, `ERD.md`, `FRONTEND_RESULTS_ANALYTICS.md` | The same code is spelled **three different ways across three documents**, and none matches the clean `API_SPECIFICATION.md`. Codes are API-contract values; an implementer cannot tell which spelling is authoritative |
| **PR-03** | Domain concept `NAB` (Nilai Ambang Batas) replaced by `NNB` (10 occurrences) | `SCORING_METHODOLOGY.md` l.308-901 | The central scoring threshold concept is renamed in the document that defines it. `NNB` is defined nowhere else |
| **PR-04** | Subsystem name `AI` replaced by `NI` (15 occurrences, `AI` count 10 -> 0) | `FEATURE_MATRIX.md` l.35-69 | Eleven FR rows name a subsystem that exists in no other document; the traceability matrix mis-describes the product |
| **PR-05** | Legal citations corrupted: `Kepmen PANRB` -> `Kepmen PNNRB`, `Permen PANRB 6/2024` -> `Permen PNNRB 6/2024`, `KELIMA` -> `KELIMN`, `TA` -> `TN` | `SCORING_METHODOLOGY.md` l.184-357 | **Cites a non-existent issuing authority.** This is the failure mode `AGENTS.md` non-negotiable 1 exists to prevent |

### HIGH

| ID | Finding | Location | Impact |
|---|---|---|---|
| PR-06 | Evidence tier literal `HISTORICAL` -> `HISTORICNL` | `SCORING_METHODOLOGY.md` l.184, `FRONTEND_RESULTS_ANALYTICS.md` l.70 | `HISTORICNL` is not a member of `EvidenceTier`; the tier table row and the UI rule reference an invalid value |
| PR-07 | Pathway enum literal `SEKOLAH_KEDINASAN` -> `SEKOLNH_KEDINNSNN` | `SCORING_METHODOLOGY.md` l.394, 665, 694 | Storage enum literal invalid; PF-12 references a value that does not exist |
| PR-08 | ERD entity names corrupted: `BASIS_REF`, `PROVISIONAL_APPROVAL`, `SESSION_SNAPSHOT`, `AI_ROUTING` | `ERD.md` l.8-219 | Four of the ERD's entities no longer match `DATABASE_SCHEMA.md` |
| PR-09 | Document titles corrupted | `SYSTEM_ARCHITECTURE.md` l.1 (`System Nrchitecture`), `PRD.md` l.369 (`Ncceptance criteria`), `FRONTEND_RESULTS_ANALYTICS.md` l.1 | Title and a numbered section heading are wrong; anchor/in-page references to §14 rely on the text |
| PR-10 | Type names `ScoreApprovalRef`, `ProvisionalApproval`, `Approval` -> `Npproval` forms | `SCORING_METHODOLOGY.md` §11 | The approval contract is unreadable |
| PR-11 | Field names `activeMsAtStart` -> `activeMsNtStart`, `difficultyAiInitial` -> `difficultyNiInitial`, `elapsedActiveMs` -> `elapsedNctiveMs` | `SCORING_METHODOLOGY.md`, `ERD.md` | Field names differ from `DATABASE_SCHEMA.md` |
| PR-12 | Provider preset `OpenAI-compatible` -> `OpenNI-compatible` | `SYSTEM_ARCHITECTURE.md` l.15, `PRD.md` l.266 | Names a preset that does not exist; FR-C1 is wrong |
| PR-13 | Dead file reference `docs/audit/NUDIT_FINDINGS_RESOLUTION.md` | `SCORING_METHODOLOGY.md` l.435 | Target file does not exist; the reference cannot be followed |
| PR-14 | `NPI` used for `API` in security text | `PRD.md` l.40, 306; `SYSTEM_ARCHITECTURE.md` l.30, 40, 80; `FRONTEND_RESULTS_ANALYTICS.md` l.80 | Security requirements (`API keys never reach the browser`) name the wrong component |

### MEDIUM

| ID | Finding | Location | Impact |
|---|---|---|---|
| PR-15 | `FRONTEND_API_MAPPING.md` claims **73** routes but contains **74** E-rows | §1 heading, §2 counts table | The reconciliation numbers reported in `SYSTEM_REVISION_REPORT.md` §12.6 are wrong by one |
| PR-16 | Section header `### 1.6 Questions · 14` heads **15** rows | `FRONTEND_API_MAPPING.md` l.73 | Section arithmetic stated in §2 does not hold |
| PR-17 | Section header `### 1.8 Generation jobs · 5` heads **4** rows | `FRONTEND_API_MAPPING.md` l.105 | Same |
| PR-18 | `E36 POST /questions/bulk` has **no row** in `API_ENDPOINTS.md` | `FRONTEND_API_MAPPING.md` l.86 | An endpoint exists only on the frontend side of the contract chain. Either the endpoint is missing from the backend contract or E36 should be retired |
| PR-19 | `E26` path written `/analytics/trends?competencyId=` vs API's `/analytics/trends?competencyId=<id>` | `FRONTEND_API_MAPPING.md` l.71 | Cosmetic in a table, but breaks exact-match tooling |

### LOW

| ID | Finding | Location |
|---|---|---|
| PR-20 | `MATERIAL_SPECIFICATION` `SourceRef.tier` narrows `EvidenceTier` without saying so | §4 l.87 |
| PR-21 | `PRD.md` l.171 example submateri names `Nnalogi`, `Deret Nngka` | FR-P1 |
| PR-22 | `Nnything` (PRD l.132), `Nn` (PRD l.262), `Nn unanswered` (SCORING l.140), `Npplies` (SCORING l.500), `Nn earlier draft` (SCORING l.521), `Nuto-submit` (SCORING l.204), `NND` (SCORING l.80), `Nrray` (SCORING l.98, 724), `Nrrows` (ERD l.4) | prose only, no contract effect |

---

## 6. Evidence - sections actually inspected

Reading, not scanning. Each row lists what was opened and what was compared against.

| Document | Sections read | Compared against |
|---|---|---|
| `SCORING_METHODOLOGY.md` | §2.2, §3, §5.1-§5.5, §6.1, §6.3, §6.7, §6.8, §7, §8.1, §9, §10, §11.1-§11.4, §12 | Git `HEAD` baseline; `API_SPECIFICATION.md` §4; `DATABASE_SCHEMA.md`; `ERD.md`; `FRONTEND_DATA_CONTRACTS.md` |
| `FEATURE_MATRIX.md` | whole file (85 rows) | Git `HEAD`; `PRD.md` §9 FR list |
| `ERD.md` | whole file | Git `HEAD`; `DATABASE_SCHEMA.md` table list |
| `SYSTEM_ARCHITECTURE.md` | whole file | Git `HEAD`; `AGENTS.md` canonical table |
| `PRD.md` | §1-§15 including all headings | Git `HEAD`; `FEATURE_MATRIX.md`; §12 of the revision report |
| `FRONTEND_RESULTS_ANALYTICS.md` | §5.3, §6, §8, §9 | `ANALYTICS_ENGINE.md` §7; `SCORING_METHODOLOGY.md` §11.1 |
| `USER_STORIES.md` | whole file | Git `HEAD` |
| `FRONTEND_PRD.md` | whole file | Git `HEAD` |
| `MATERIAL_SPECIFICATION.md` | whole file, all 7 sections | `PRD.md` §9.8; `RECOMMENDATION_ENGINE.md` §4; decision G |
| `NOTIFICATION_SPECIFICATION.md` | whole file, all 8 sections | `API_ENDPOINTS.md` §9; `GENERATION_JOBS.md` §2, §5; decision J |
| `API_ENDPOINTS.md` | full route table (73 rows) | `FRONTEND_API_MAPPING.md` |
| `FRONTEND_API_MAPPING.md` | all 12 sections, counts, reverse mapping | `API_ENDPOINTS.md` |

---

## 7. Cross-document contract consistency

### 7.1 What is consistent

| Chain | Verdict |
|---|---|
| Job status enum | `queued / running / completed / failed / interrupted` matches in `GENERATION_JOBS.md`, `FRONTEND_DATA_CONTRACTS.md`, `ERD.md`, `DATABASE_SCHEMA.md`. No `cancelling` anywhere. **Pass** |
| Retired routes | no `/cancel`, `/study-plan`, `/progres/paket` in any active table. **Pass** |
| Route ordering rule | `/tryout/sesi/:id` and `/latihan/sesi/:id` declared before `/tryout/:packageId`. **Pass** |
| Deletion semantics | `ANALYTICS_ENGINE` §7.1-§7.8, `DATABASE_SCHEMA` tombstone, `ERD` note, `SCORING_METHODOLOGY` §7, `BUSINESS_RULES` BR-L4, `FRONTEND_RESULTS_ANALYTICS` §5.3 all say the same thing: hide / user deletion / purge, tombstone not a purge. **Pass** |
| Config resolution | `CPNS_2026_REGULATIONS` §4.2.1, `PACKAGE_SPECIFICATION` §3, `API_SPECIFICATION` §7.4, `API_ENDPOINTS` §3, `FRONTEND_PAGE_SPECIFICATIONS` §3/§17 agree on pin -> latest usable -> `no_usable_config`, `provisional` startable, verdict withheld. **Pass** |
| Sampling | quota unresolved in `QUESTION_SPECIFICATION`, `MVP_SCOPE`, `VALIDATION`, `QUESTION_GENERATION`, page spec, US-B3. No number in force. **Pass** |
| Rencana Belajar | absent from routes, IA, page specs, API; present only as "out of MVP". **Pass** |
| Notification events | `NOTIFICATION_SPECIFICATION` §2 set matches the API routes and contains no cancel event. **Pass** |
| Material model | `MATERIAL_SPECIFICATION` matches `DATABASE_SCHEMA`, `API_ENDPOINTS` §7, decision G. **Pass** |

### 7.2 What is broken

| Chain | Verdict |
|---|---|
| Score result type names | `SCORING_METHODOLOGY` says `NnswerKey`/`NnswerSheet`/`ScoreNpprovalRef`; `DATABASE_SCHEMA` says `answer_sheet`; `ERD` says `ANSWER_SHEET`. **Fail (PR-01, PR-10)** |
| Error codes | three spellings across three documents, none matching `API_SPECIFICATION`. **Fail (PR-02)** |
| ERD entities | `BNSIS_REF`, `PROVISIONNL_APPROVAL`, `SESSION_SNNPSHOT`, `NI_ROUTING` vs `DATABASE_SCHEMA` tables. **Fail (PR-08)** |
| Evidence tiers | `HISTORICNL` is not in `EvidenceTier`. **Fail (PR-06)** |
| Pathway enum | `SEKOLNH_KEDINNSNN` is not the storage literal. **Fail (PR-07)** |
| Provider presets | `OpenNI-compatible` vs `OpenAI-compatible`. **Fail (PR-12)** |
| API endpoint completeness | `E36 /questions/bulk` exists only on the frontend side. **Fail (PR-18)** |

---

## 8. API reconciliation

Requested figures: **73 mapping IDs, 72 screen-reachable, 69 supported, 4 partial, 26 frontend routes.**

### 8.1 Route counts

| Measure | Claimed | Actual | Verdict |
|---|---|---|---|
| `API_ENDPOINTS` route rows | (73 implied) | **73** | correct |
| `FRONTEND_API_MAPPING` E-rows | **73** | **74** | **wrong by 1 (PR-15)** |
| Frontend routes in `FRONTEND_ROUTING` | **26** | **26** | correct |
| Retired ids absent (E52, E76, E77) | required | absent | pass |
| Forbidden paths absent | required | absent | pass |

**Why 74 not 73.** E52, E76 and E77 were removed from 77, which gives 74. The correction run reported
"73" and wrote that number into the heading, the counts table and the report. The arithmetic in §12.6 was
also stated as `1 + 4 + 6 + 13 + 2 + 14 + 7 + 4 + 9 + 3 + 7 + 3 = 73`; the true section contents are
`1 + 4 + 6 + 13 + 2 + **15** + 7 + **4** + 9 + 3 + 7 + 3`, which sums to **74**. Two section headers
(§1.6 says 14, §1.8 says 5) disagree with their own rows.

`API_ENDPOINTS` genuinely holds **73** routes. The mapping holds **74** E-ids. The extra one is:

- **`E36 POST /questions/bulk`** - a bulk **archive** action. It has no row in `API_ENDPOINTS.md`.

This is also a scope question worth flagging: decision E says **no bulk editing in MVP**, but allows bulk
*archive*. E36 is the only row in the mapping without a backend counterpart, so either the endpoint is
missing from the backend contract (MEDIUM, PR-18) or E36 should not exist. **This audit does not decide
which** - it is reported for the owner.

### 8.2 Screen reachability: 72

The reverse mapping (`FRONTEND_API_MAPPING` §3) lists 26 screens. The single endpoint not reachable from a
screen is **E72 `GET /health`**, used only by the launcher to wait for backend readiness
(`DEPLOYMENT_AND_BACKUP.md` §1.2). That is correct and intentional.

With 74 E-ids and one launcher-only endpoint, screen-reachable ids are **73**, not 72. The "72" figure
inherits the same off-by-one as PR-15.

### 8.3 Supported: 69

Counting the Status column as written: 70 rows are `Supported`, 4 are `Partial` (`E06` `definition` detail,
`E27`, `E28`, `E32`). 70 + 4 = 74. The claimed 69 again inherits the off-by-one.

### 8.4 Partial: 4

`E06` (`GAP-M12`), `E27`/`E28` (`GAP-M4`), `E32` (`GAP-M1`). **Correct.**

### 8.5 Endpoints that reference removed features

None found. No row in `API_ENDPOINTS` or `FRONTEND_API_MAPPING` references cancel, `/study-plan`,
`/progres/paket`, or a Rencana Belajar resource. **Pass.**

---

## 9. Cross-references and open questions

### 9.1 Links

| Check | Result |
|---|---|
| Relative `.md` links resolving to an existing file | 0 dangling (verified across all of `docs/`) |
| Inline path references (not links) resolving | **1 broken**: `docs/audit/NUDIT_FINDINGS_RESOLUTION.md` (PR-13) |

### 9.2 Open questions

The revision report §8 lists Q-1 (resolved), Q-2, Q-3 (withdrawn), Q-4, Q-5, Q-6, Q-7, Q-8, Q-9, Q-10.
Checked against the documents:

| Question | Documented as unresolved? | Audit conclusion |
|---|---|---|
| Q-1 Rencana Belajar | marked resolved | correctly resolved; the owner's instruction removed the feature, so recording it as resolved is **not** a unilateral decision |
| Q-3 cancel | marked withdrawn | correctly withdrawn; owner decision supersedes the old requirement |
| Q-4 sampling quota | unresolved in 6 places | correct; **no number appears anywhere** in `docs/` |
| Q-8 permanent purge | unresolved in `ANALYTICS_ENGINE` §7.7 and report §8 | correct; no purge route or control exists |
| Q-9 hide | unresolved | correct |
| Q-10 bulk erase | unresolved | correct |
| Q-2, Q-5, Q-6, Q-7 | unresolved | correct |
| U-2, U-3, U-4 | carried forward | correct |

**No Product Owner decision was taken unilaterally** by the correction run. Q-1 and Q-3 were closed by an
explicit owner instruction, not by inference. This audit found no place where an open question had been
silently converted into a rule.

---

## 10. Limits of this verification

Stated explicitly, because a clean token count is not proof of correctness.

1. **One of the eight documents has no baseline.** `FRONTEND_RESULTS_ANALYTICS.md` is untracked, so damage
   in it cannot be proved by diff. Its findings (§3.6) are inferred from context and from parity with the
   same strings in tracked files. A damaged sentence with no counterpart elsewhere could still be present.
2. **Restoration is not proven, only the absence of damage.** For the seven tracked files, a line that was
   corrupted and then "repaired" to a *different but plausible* word would not be caught by diffing against
   `HEAD` alone. The comparison in §6 was done by reading, which reduces but does not eliminate this risk.
3. **This audit found new damage that the previous three scans missed.** The earlier claim of zero
   corruption was wrong. The same failure mode could be expected: a limited search returns a limited
   result. The method used here is broader but is still pattern-based plus human read, not exhaustive proof.
4. **Documents outside the eight were checked only for the corruption patterns and for links.** They were
   not all read line by line in this pass.
5. **No semantic review of scoring mathematics.** Specific score arithmetic in `SCORING_METHODOLOGY` §10
   was read for corrupted tokens but not independently recomputed; that is a different audit.
6. **No code was compared against documents**, because no source code exists for the backend and the
   frontend is out of scope.

---

## 11. Verdict

## **FAIL**

Justification:

- **Five CRITICAL findings (PR-01 to PR-05).** The canonical scoring document has its type vocabulary, error
  codes, threshold concept and legal citations corrupted. The traceability matrix renames the AI subsystem.
- **Nine HIGH findings (PR-06 to PR-14)**, including three document titles/headings, four ERD entity names,
  two enum literals, and a dead file reference.
- **The cross-document contract chain is broken in seven places** (§7.2) - the exact property the previous
  revision claimed to have established.
- **The reported API figures are wrong by one** (73 vs 74), and an endpoint exists only on one side of the
  contract (PR-18).
- **The claim in `SYSTEM_REVISION_REPORT.md` §12.7 that the damage was fully repaired is false.** Two of the
  eight documents are repaired; six are not.

What **does** pass: all Product Owner corrections from the previous round are correctly reflected in the
documents (cancel removed, sampling quota unresolved, Rencana Belajar out of MVP, deletion semantics
separated, config resolution internal); the two previously skipped documents are clean and consistent; all
relative links resolve; no open question was decided unilaterally; the frontend route count (26) is correct.

The product-level documentation is sound. **The text has not survived its own repair.**

---

## 12. Recovery options - for Product Owner approval, not started

No document was changed during this audit. Three options, cheapest first:

| Option | What it means | Cost | Risk |
|---|---|---|---|
| **A. Targeted repair** | Restore the 140 corrupted tokens from the `HEAD` baseline where the baseline exists; hand-repair the 9 lines in the untracked file from context | low-medium | Leaves the intentional revisions intact; must be verified line by line, not by scan |
| **B. Regenerate from baseline** | `git checkout` the seven tracked files, then re-apply only the §12 corrections from the recorded intent | medium | Discards the good parts of the revision; must re-verify every §12 change |
| **C. Accept as-is** | Nothing | none | **not recommended** - PR-05 cites a non-existent issuing authority, which violates `AGENTS.md` non-negotiable 1 |

Recommendation: **Option A**, with these controls:

1. Repair token by token against `HEAD`, listing every substitution in one table before applying.
2. For the untracked file, reconstruct the 9 lines by hand and state their provenance.
3. Re-run this audit's method afterwards - diff against `HEAD` plus a full read of the two priority
   documents - and do not accept a token scan as proof.
4. Fix PR-15 to PR-19 (the API reconciliation) in the same pass; they are independent of the corruption.

---

**Audit complete. No document was modified. Awaiting Product Owner approval before any repair.**
