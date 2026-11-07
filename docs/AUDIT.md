# Planning Audit

Status: **PASSED — zero open critical/high across all planning documents** · Last updated 2026-11-07
Remaining open findings are medium/low or closed-with-owner as recorded below.

This file records every audit finding against the planning documentation. The audit is a register,
not a badge: a finding leaves `open` only when it is `resolved` in the named documents, or is recorded
as `accepted-risk` with a stated reason.

**Status rule.** The audit is `PASSED` only when zero `critical` and zero `high` findings are `open`.
Medium/low may remain open with an owner. No finding may be closed by omission.

Severity: `critical` (a stated fact is wrong, or a guarantee does not hold) · `high` (a required
property is unspecified or two documents contradict) · `medium` (ambiguity, missing edge case) ·
`low` (clarity, consistency of wording).

---

## Findings

### Round 1 — examination documents (2026-11-07)

| ID | Sev | Category | Docs affected | Description | Resolution | Status |
|---|---|---|---|---|---|---|
| AUD-01 | critical | Regulatory accuracy | `COMPETENCY_TAXONOMY.md`, `SCORING_METHODOLOGY.md`, `QUESTION_SPECIFICATION.md` | TWK domains were listed as `TWK.PANCASILA`, `TWK.UUD45`, `TWK.BHINEKA`, `TWK.NKRI`. The official 2026 framework names five domains: nasionalisme, integritas, bela negara, pilar negara, bahasa negara. Pancasila/UUD/NKRI/Bhinneka are *contents of* `TWK.PILAR_NEGARA`. Every TWK question would have been mis-tagged. | Taxonomy §3 rewritten to the five official domains; correction note retained so the wrong IDs cannot silently return. | resolved |
| AUD-02 | high | Regulatory accuracy | `CPNS_2026_REGULATIONS.md` | §1 stated "no CPNS 2026 regulation found" while omitting the confirmed CPNS 2026 recruitment announcement (Press Release 378/HUMAS-MENPANRB/2026). Overstated absence. | §1 rewritten: recruitment announced (`VERIFIED-CURRENT` announcement), no CPNS-2026 SKD instrument (`VERIFIED-ABSENCE`), pathway distinction stated. | resolved |
| AUD-03 | high | Evidence | `CPNS_2026_REGULATIONS.md` | §2.3 stated the text of Kepmen PANRB 321/2024 was "NOT OBTAINED", and UNV-01…UNV-05 were unresolvable. The document was subsequently obtained (image scan, read page by page). | §2.3(a) records the full 321/2024 rules; §2.3(b) records 406/2026. UNV-01…UNV-05 rewritten with current status. Extraction method disclosed. | resolved |
| AUD-04 | critical | Evidence / scope | `CPNS_2026_REGULATIONS.md`, `SCORING_METHODOLOGY.md` | Risk of treating Kepmen PANRB 406/2026 (Sekolah Kedinasan) as the CPNS 2026 rule. Different pathway; different numbers (100 min vs 130 min; TKP NAB 156 vs 166). | `pathway` field added to `ExamConfig`; §2.3 separates the two instruments; §8 rule 5 forbids silent transfer; scoring §6.7 PF-12 validates pathway/scope. | resolved |
| AUD-05 | critical | Correctness | `SCORING_METHODOLOGY.md` §3.1 | TWK example keyed `{A:5,…}` while the comment said "B correct" — the example contradicted itself and taught the wrong key shape. | Key corrected to `{A:0,B:5,C:0,D:0,E:0}`; §10.1 worked example made consistent. | resolved |
| AUD-06 | critical | Correctness | `SCORING_METHODOLOGY.md` §4 | `byCompetency[competencyOf(q)] += earned` read `undefined + n` → `NaN`; `config` was referenced but never defined, and `byTest` aggregated points without counts. | §4 rewritten: `??=` initialisation over the snapshot roster; `{earned, possible, answeredCount, correctCount}` buckets; `config` fields read from the frozen snapshot (§6.4). | resolved |
| AUD-07 | high | Correctness | `SCORING_METHODOLOGY.md` §3 | `testOf(questionId)` / `competencyOf(questionId)` parsed metadata out of an opaque ID. Any ID rename silently mis-bucketed scores. | §2.1 defines explicit `QuestionMeta{test, competencyId}`; parsing forbidden; PF-07 validates. | resolved |
| AUD-08 | high | Correctness | `SCORING_METHODOLOGY.md` | No session pre-flight. Duplicate sheets, missing sheets, orphan sheets, missing keys, mixed scoring versions and unanswered session questions had no defined behaviour. | §6 adds PF-00…PF-13 with error codes, ordered checks (§6.3), collected-and-sorted reporting, and worked pass/fail cases. Missing/extra sheet is rejected, never a silent zero. | resolved |
| AUD-09 | high | Correctness | `SCORING_METHODOLOGY.md` | `unansweredScore` was constrained only by "should be 0". Negative or fractional values, and configs declaring a different blank rule, were unvalidated. | `unansweredScoreBounds` + `unansweredRule` added to `ScoringRules`; SC-06 (bounds) + SC-07 (rule consistency) added. | resolved |
| AUD-10 | high | Mutable history | `SCORING_METHODOLOGY.md`, `QUESTION_SPECIFICATION.md` | Nothing prevented editing a question/answer key/config from changing an already-scored session. Violated "immutable once written". | §7 defines `SessionSnapshot` binding questions, keys, metadata, config, scoringVersion, thresholds and approval; PF-10 checks completeness; `questionVersion`/`contentVersion` in the question record. | resolved |
| AUD-11 | high | Correctness | `SCORING_METHODOLOGY.md` §5 | Threshold modes had optional fields, no comparison operator, and no numeric bounds. | §5.1 required/forbidden fields per mode; §5.2 states `>=`; §5.3 adds finite-integer and `≤ maxPossible` bounds with codes. | resolved |
| AUD-12 | high | Analytics correctness | `SCORING_METHODOLOGY.md` §9 | Only earned points were aggregated; TKP has no "correct", so accuracy was undefined and had no denominator. | `{earned, possible, answeredCount, correctCount}` buckets + per-question `correct`; §9 states TWK/TIU accuracy = `correctCount/answeredCount`, TKP attainment = `earned/possible`. | resolved |
| AUD-13 | medium | Validation design | `SCORING_METHODOLOGY.md` SC-01…SC-09 | Option-set and max-score checks split inconsistently across tests. | Reorganised: SC-01 set-equality, SC-03 max-score, SC-04 TWK/TIU shape, SC-05 TKP range+max under separate codes. | resolved |
| AUD-14 | medium | Determinism | `SCORING_METHODOLOGY.md` | `answeredAt` and deadline sat adjacent to scoring with no purity statement. | §8 states timestamps/deadline never read by scoring; purity property test named. | resolved |
| AUD-15 | low | Documentation | `QUESTION_SPECIFICATION.md` | V-06 pointed at the wrong SC-rule section. | Pointer updated to §6.1 (SC-01…SC-08). | resolved |
| AUD-16 | low | Documentation | `SCORING_METHODOLOGY.md` | Threshold example restated NAB-like numbers risking divergence. | §10.5 uses explicitly fictional numbers; real values only in the regulations doc. | resolved |
| AUD-17 | low | Documentation | `SCORING_METHODOLOGY.md` §6.2 | Failing-case listing mixed a wrong key-count line with a duplicated code. | Listing rewritten with ordered errors and the Q3 asymmetry explained. | resolved |
| AUD-18 | medium | Over-specification | `SCORING_METHODOLOGY.md`, `AUDIT.md` | An earlier draft added SC-06 `TKP_NON_DISCRIMINATING`, rejecting all-equal TKP keys. No regulation requires distinct TKP weights; it asserted a scoring opinion as a rule. | SC-06 removed; numbering renumbered contiguously (SC-06 is now unanswered-score bounds); the rejected rule recorded in §6.1 so it is not re-added. | resolved |
| AUD-19 | medium | Evidence consistency | `SCORING_METHODOLOGY.md` §10.5 | Threshold example used numbers close to real NAB under an "illustration only" disclaimer. | Replaced with obviously fictional round numbers. | resolved |
| AUD-20 | high | Cross-document contradiction | `QUESTION_SPECIFICATION.md` V-10 | V-10 required a TKP explanation to justify "the zero-weight option", but SC-05 requires every TKP weight within `[1,5]` — no option can be zero. | V-10 rewritten to "each lower-weighted option". | resolved |

### Round 2 — continuation audit (2026-11-07)

| ID | Sev | Category | Docs affected | Description | Resolution | Status |
|---|---|---|---|---|---|---|
| AUD-21 | critical | Correctness | `SCORING_METHODOLOGY.md` §4 | `scoreSession()` read `config.id`, `config.configVersion`, `config.thresholds` from an undefined `config`; the pre-flight contract was never defined. | `PreflightedSession` (§6.4) now carries the frozen `SessionSnapshot`; §4 reads `snapshot.configId/configVersion/scoringVersion/thresholds`. No live `config` exists. | resolved |
| AUD-22 | high | Snapshot integrity | `SCORING_METHODOLOGY.md` §7 | `PreflightInput` carried only `snapshotVersion` + a live `config`; scoring could pull thresholds/keys from the live DB. | §7 `SessionSnapshot` now binds questions, content hashes, answer keys, metadata, taxonomyVersion, configVersion, scoringVersion, thresholds, and the approval; PF-10 asserts one-snapshot provenance. | resolved |
| AUD-23 | high | Regulatory scope | `SCORING_METHODOLOGY.md` §6.7 | `VERIFIED-2026` tier alone was treated as sufficient authority; pathway/year/scope never validated. | PF-12 checks `pathway`+`examYear`+instrument scope vs the config; 406/2026 may only be `VERIFIED-2026-SEKOLAH-KEDINASAN` in a CPNS config. CPNS-2026 thresholds stay provisional. | resolved |
| AUD-24 | medium | Roster integrity | `SCORING_METHODOLOGY.md` §6 | Empty roster and duplicate roster IDs were unvalidated; double-counting was representable. | PF-00 (`EMPTY_ROSTER` / `DUPLICATE_ROSTER_QUESTION_ID`) + bijection with sheets/keys (PF-01/03/05). | resolved |
| AUD-25 | medium | Analytics compatibility | `SCORING_METHODOLOGY.md` §9 | Claimed `ScoreResult` produced TWK/TIU accuracy when only points were available; also claimed a leaf competency bucket could span TWK and TKP, contradicting PF-07. | `answeredCount`/`correctCount` on every bucket + `byQuestion.correct`; §9 states accuracy needs those counts, TKP is attainment-only; the cross-test leaf claim removed. | resolved |
| AUD-26 | low | Numbering consistency | `SCORING_METHODOLOGY.md` §6.1 | SC-06 was deleted but numbering skipped to SC-07, leaving a dangling gap. | Renumbered contiguously SC-01…SC-08; §6.1 notes the rejected rule so the gap cannot regenerate; references (PF-08, QUESTION_SPECIFICATION V-06) updated. | resolved |
| AUD-27 | medium | Validation completeness | `SCORING_METHODOLOGY.md` §6 | Thresholds and config rule fields had no numeric-validation or dependency ordering. | §5.3 finite-integer/`≤ max` bounds (PF-09); §6.6 PF-11 validates `scoringVersion`/`tkpWeightRange`/`unansweredScoreBounds`/`perQuestionMax`; §6.3 orders checks so nothing throws on already-rejected input. | resolved |
| AUD-28 | high | Approval integrity | `SCORING_METHODOLOGY.md` §11 | How approval reached pre-flight and how an old session re-scores after re-approval were undefined; a wrong-version approval could pass silently. | §7 binds `provisionalApproval` into the snapshot; PF-13 matches it against the snapshot's bound values; §11 defines `APPROVAL_MISSING`/`APPROVAL_INVALID`/`APPROVAL_VERSION_MISMATCH` and the re-score paths; `ScoreResult.approval` records the authorising ref. | resolved |

---

## Open findings

| ID | Sev | Category | Docs affected | Description | Owner | Status |
|---|---|---|---|---|---|---|
| AUD-50 | medium | Consistency pending | `ANALYTICS_ENGINE.md`, `API_SPECIFICATION.md` | `ANALYTICS_ENGINE.md` did not exist. Now written: accuracy vs attainment, minimum sample (`≥5`), zero-vs-insufficient state machine, trend rules (≥3 sessions), mean response time (median) — consuming `ScoreResult` (`earned/possible/answeredCount/correctCount`) unchanged. `API_SPECIFICATION.md` now defines `PREFLIGHT_FAILED`, `APPROVAL_INVALID`, `APPROVAL_VERSION_MISMATCH`, `THRESHOLD_CONFIG_INVALID` with the bounded `changed[]` structure (§4.2). | docs written this run | resolved |
| AUD-51 | medium | Consistency pending | `FRONTEND_DATA_CONTRACTS.md`, `FRONTEND_PAGE_SPECIFICATIONS.md` | Frontend must render `{earned, possible}` and analytics percentages without recomputing, and show the provisional `notice` beside any verdict. Both docs written; `FRONTEND_DATA_CONTRACTS.md` §1 encodes render-never-recompute and §4 maps sample-status flags; page specs render raw counts and the approval/invalidation notice. | docs written this run | resolved |
| AUD-52 | low | Implementation debt | backend (not implemented) | Scoring purity/idempotence and pre-flight cases (§6.2) must become real tests when the backend is built. No test code exists; documenting the requirement is the whole deliverable at this stage. | backend phase | open |
| AUD-53 | low | Evidence | `CPNS_2026_REGULATIONS.md` UNV-08 | TWK/TIU/TKP sub-domains are `VERIFIED-2026` for the Sekolah Kedinasan pathway only. A CPNS-specific kisi-kisi has not been obtained. Taxonomy labels the tier accordingly; upgrading requires a CPNS instrument. | user review | accepted-risk |

---

## Checks performed

| # | Check | Result | Evidence |
|---|---|---|---|
| C-01 | Every scoring example is internally consistent with its own key | pass | §3.1, §10.1 both key B |
| C-02 | No aggregation can produce `NaN` / `undefined` | pass | §4 `??=` init over snapshot roster |
| C-03 | No test/competency inferred from an ID string | pass | §2.1 + PF-07 |
| C-04 | Session pre-flight defined, with success and failure cases | pass | §6, §6.2 |
| C-05 | Threshold modes fully specified; operator + numeric bounds explicit | pass | §5.1, §5.2, §5.3 |
| C-06 | Blank-answer score bounded and config-consistent | pass | SC-06, SC-07 |
| C-07 | Started sessions immune to bank, key, and config edits | pass | §7 snapshot + PF-10 |
| C-08 | TKP measured by attainment, not accuracy | pass | §9 |
| C-09 | No Sekolah Kedinasan rule presented as a CPNS 2026 rule | pass | regulations §2.3, §8 rule 5; scoring §6.7 PF-12 |
| C-10 | Scoring rules not duplicated across documents | pass | §12 pointer table; QUESTION_SPECIFICATION delegates |
| C-11 | Timestamps cannot affect points | pass | §8 |
| C-12 | Provisional approval gates any provisional threshold verdict | pass | §6.7, §11, PF-13 |
| C-13 | No validation rule lacks a regulatory or logical basis | pass | SC-01…SC-08 traceable; rejected all-equal-TKP rule recorded in §6.1 |
| C-14 | Every rule is reachable — none tests an impossible state | pass | TKP `[1,5]` vs V-10 corrected (AUD-20) |
| C-15 | Worked examples cannot be mistaken for real regulation | pass | §10.5 uses labelled fictional numbers |
| C-16 | `config` never read from a live/mutable source | pass | §4 reads `snapshot.*`; §6.4 `PreflightedSession` carries it |
| C-17 | Snapshot binds every scored input incl. thresholds + approval | pass | §7 struct, PF-10 |
| C-18 | Roster non-empty, unique, counted exactly once | pass | §6 PF-00 + bijection PF-01/03/05 |
| C-19 | SC numbering contiguous | pass | §6.1 SC-01…SC-08, V-06 updated |
| C-20 | Approval bound to snapshot, not live config | pass | §7 `provisionalApproval`, PF-13, §11 version-mismatch path |
| C-21 | Analytics `correct`/attainment semantics match scoring | pass | `ANALYTICS_ENGINE.md` §2 consumes `correctCount/answeredCount`; TKP attainment = `earned/possible` |
| C-22 | `changed[]` bounded to approval-bound values, no hash content leak | pass | `API_SPECIFICATION.md` §4.2 (field/approved/current; hashes opaque) |
| C-23 | Three 409 codes documented distinctly (invalid/mismatch/threshold) | pass | `API_SPECIFICATION.md` §4.2 table + [DATA_FLOW] §3 submitted state |
| C-24 | Frontend never recomputes scores/metrics | pass | `FRONTEND_DATA_CONTRACTS.md` §1, `BR-X2` |
| C-25 | Provisional/orphan config not offered as startable | pass | `FRONTEND_PAGE_SPECIFICATIONS.md` §2, `FRONTEND_DATA_CONTRACTS.md` §3 |
| C-26 | Every dangling cross-reference from AI docs resolved to a real doc | pass | `GENERATION_JOBS.md`, `PROVIDER_INTEGRATION.md`, `RECOMMENDATION_SERVICE.md`, `SECURITY.md`, `AUTHENTICATION.md`, `DATA_FLOW.md`, `FEATURE_MATRIX.md`, `MVP_SCOPE.md`, `RISK_REGISTER.md` all exist |
| C-27 | No auth / no frontend tests / dependency minimalism recorded as ADRs | pass | `ADR-007`, `ADR-008`, `ADR-009` |

---

## Out of scope (unchanged)

- Frontend and backend source code: not started, per directive.
- The actual skill-audit execution and the backend secret-store/generation-persistence decisions,
  carried in `INSTALLED_SKILLS.md`, `BACKEND_TEMP.md`, and `DEVELOPMENT_ROADMAP.md` — they are
  implementation-time, not planning-time.