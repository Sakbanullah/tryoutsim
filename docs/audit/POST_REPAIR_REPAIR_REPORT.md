# Post-Repair Repair Report — Option A (targeted)

Executes **Option A — targeted documentation repair** from
[POST_REPAIR_INTEGRITY_AUDIT.md](./POST_REPAIR_INTEGRITY_AUDIT.md) §12, as approved by the Product Owner.

Date: 2026-11-09 · Owner: user (Sakbanullah) · Scope: `docs/` Markdown only.

**Not performed, by instruction:** no source-code change, no dependency change, no test, build or lint,
**no Git operation** (no checkout, reset, commit or push). The Git `HEAD` baseline was read with `git show`
(diffing only) — nothing was restored wholesale from it.

Status: **repair complete — reported, awaiting Product Owner approval. Not a PASS claim** (§10).
Superseded in part by [FINAL_DOCUMENTATION_INTEGRITY_AUDIT.md](./FINAL_DOCUMENTATION_INTEGRITY_AUDIT.md)
(pass 2, 2026-11-09), which carries the verdict; §12 now records the pass-2 outcome of Q-PR1…Q-PR3.

---

## 1. What was done, and the order

1. Read the full audit (PR-01…PR-22) and `SYSTEM_REVISION_REPORT.md` §1–§12 to extract the **intentional
   revisions** that must survive (cancel removal, sampling quota unresolved, Rencana Belajar out of MVP,
   deletion semantics, config resolution, score/verdict split, CPNS-only scope, `EVIDENCE-BACKED-NOT-CPNS-2026`
   rename, the batch table). These were treated as protected content.
2. Read every in-scope document **in full** at its current state.
3. Diffed each tracked document against `git show HEAD:<path>` and classified every changed line as
   *intentional revision* or *corruption*. The corruption is a systematic `A→N` substitution, which shows up
   in the diff as isolated letter swaps inside otherwise-intentional lines.
4. Verified every replacement against a second source, not against the diff alone: the `HEAD` spelling, or
   the canonical document named in `AGENTS.md` (`DATABASE_SCHEMA.md`, `API_ENDPOINTS.md`,
   `CPNS_2026_REGULATIONS.md`, `ANALYTICS_ENGINE.md`), or a third document that already used the correct
   spelling of the same string.
5. Re-read every changed document end to end after the edits (§9).

---

## 2. A result the audit did not expect: 116 of the 140 tokens were already clean

The repair pass ran **after** the audit was written. By the time this pass started, **116** of the 140
tokens in the audit's six damaged files were **already correct**, and only **24** were still damaged.
(116 + 24 = 140, matching the audit's total.)

> **Correction, 2026-11-09.** This section first read "100 … and only 40"; both figures were wrong and
> contradicted the table below it. The table's per-document figures (18 + 4 + 1 + 0 + 0 + 1 = 24 damaged;
> 79 + 4 + 1 + 18 + 9 + 5 = 116 clean) were correct. Corrected in the pass-2 review
> ([FINAL_DOCUMENTATION_INTEGRITY_AUDIT.md](./FINAL_DOCUMENTATION_INTEGRITY_AUDIT.md) §2 F-1); see
> [FINAL_DOCUMENTATION_INTEGRITY_AUDIT.md](./FINAL_DOCUMENTATION_INTEGRITY_AUDIT.md) §2 item F-1.

| Document | Tokens per audit | Still damaged at start of this repair | Already correct |
|---|---|---|---|
| `examination/SCORING_METHODOLOGY.md` | 97 | **18** | 79 |
| `product/PRD.md` | 8 (tokens) | **4** | 4 |
| `product/FEATURE_MATRIX.md` | 2 | **1** | 1 |
| `backend/ERD.md` | 18 | **0** | 18 |
| `architecture/SYSTEM_ARCHITECTURE.md` | 9 | **0** | 9 |
| `frontend/FRONTEND_RESULTS_ANALYTICS.md` | 6 | **1** (line 128) | 5 |
| **Total** | **140** | **24** | **116** |

Every previously repaired string was re-checked against its source (§3) and found correct; none had been
"repaired" to a different-but-plausible word. The residue is concentrated in content the audit could not
match against `HEAD` because that content is **new** (written by the revision): `SCORING_METHODOLOGY` §10
worked examples, §11.1 `A config`, §6.2 `(SC-2)`; `PRD` FR-G7/Q8/E6/K3 and the §9.13 notification block;
`FEATURE_MATRIX` FR-T2 and FR-L3. That is consistent with the audit's own warning (§10.2): a diff against
`HEAD` cannot see a corrupted **new** line, so the remaining residue sat exactly where diffing is blind.

**The 24 repaired tokens are listed in §4, each with its source.**

---

## 3. Verification method for the 116 already-correct tokens

Not a token scan. For each string the audit listed, the repair pass checked one of:

| Source class | Example checked |
|---|---|
| Git `HEAD` spelling | `AnswerKey`, `AnswerSheet`, `NAB`, `AI`, `OpenAI-compatible`, `BASIS_REF`, `PROVISIONAL_APPROVAL`, `SESSION_SNAPSHOT`, `AI_ROUTING`, `Kepmen PANRB`, `KELIMA`, `TA 2026`, `HISTORICAL`, `SEKOLAH_KEDINASAN`, `PREFLIGHT_FAILED`, `REGULATORY_*`, `docs/audit/AUDIT_FINDINGS_RESOLUTION.md` |
| `DATABASE_SCHEMA.md` column or table name | `activeMsAtStart`→`session.activeMs`/`timingJson`, `difficultyAiInitial`, `elapsedActiveMs`, `answer_sheet`, `ai_routing` |
| `API_SPECIFICATION.md` / `API_ENDPOINTS.md` | `PREFLIGHT_FAILED`, `REGULATORY_PATHWAY_MISMATCH` / `_YEAR_MISMATCH` / `_SCOPE_UNVERIFIED`, `SNAPSHOT_*`, `/analytics/trends?competencyId=<id>` |
| `CPNS_2026_REGULATIONS.md` §2.3 | `Kepmen PANRB 406/2026` Diktum `KELIMA`, `Kepmen PANRB 321/2024` `KESEBELAS`/`KEDELAPAN`, `EVIDENCE-BACKED-NOT-CPNS-2026`, `VERIFIED-2026` for Sekolah Kedinasan only, `HISTORICAL` tier |
| A third document with the same string | `AnalyticsSnapshot` (`ANALYTICS_ENGINE.md` §6), `API keys never reach the browser` (PRD O-6 ↔ SECURITY), `Akurasi` (`ANALYTICS_ENGINE.md` §2.1 wording), `Answer key shapes by test` |

Three of these deserve an explicit note because a diff check alone would not prove them:

- **`ScoreApprovalRef = ProvisionalApproval`** (§2.2) is new §12 content, not corruption. `HEAD` had
  `ScoreApprovalRef` as a standalone record; the revision deliberately replaced it, and
  `AUDIT_FINDINGS_RESOLUTION.md` API-1 confirms "`approval` is a `ProvisionalApproval`".
- **`Sekolah Kedinasan` KELIMA by 406/2026** (§3.2, §6.7) is a **cross-pathway corroboration citation**,
  allowed by `AGENTS.md` non-negotiable 2 when it is not cited as CPNS authority. The row itself says
  `VERIFIED-2026` *for that pathway only*, and the paragraph below it says it is *never* the source of a CPNS
  rule. Retained as written.
- **`FRONTEND_RESULTS_ANALYTICS.md` `§5.3`** (deletion dialog) is correct — `AUDIT.md` AUD-63 and
  `SYSTEM_REVISION_REPORT` §12.4 both cite it, and the current heading is `### 5.3 Deleting this session`.

---

## 4. Before → after — every change made in this repair

| # | Document | Line (before repair) | Before | After | Source / reason |
|---|---|---|---|---|---|
| 1 | `SCORING_METHODOLOGY` | §10.1 l.857 | `Key \`{N:0, B:5, C:0, D:0, E:0}\`` | `Key \`{A:0, B:5, …}\`` | Option letter reverted to `A`; `HEAD` §10.1 reads `{A:0, B:5, C:0, D:0, E:0}` |
| 2 | `SCORING_METHODOLOGY` | §10.1 table | `\| N \| 0 \| false \|` | `\| A \| 0 \| false \|` | Same key, answer row; `HEAD` reads `\| A \| 0 \| false \|` |
| 3 | `SCORING_METHODOLOGY` | §10.2 l.867 | `Key \`{N:5, B:4, C:3, D:2, E:1}\`` | `Key \`{A:5, …}\`` | `HEAD` reads `{A:5, B:4, C:3, D:2, E:1}` |
| 4 | `SCORING_METHODOLOGY` | §10.2 l.868 | `` `{N:5, B:4, C:2, D:1, E:1}` `` (cross-ref to §3.2) | `` `{A:5, B:4, C:2, D:1, E:1}` `` | Must match §3.2's rendered key, which uses `A` |
| 5 | `SCORING_METHODOLOGY` | §10.2 table | `\| N \| 5 \| null …` | `\| A \| 5 \| null …` | Same key |
| 6 | `SCORING_METHODOLOGY` | §11.1 item 1 | `N config whose scope is wrong …` | `A config whose scope is wrong …` | Article; same sentence in the audit's PR-22 list |
| 7 | `SCORING_METHODOLOGY` | §11 l.952 | `**…** N pre-flight approval failure never discards a score:` | `**…** A pre-flight approval failure never discards a score:` | Article |
| 8 | `SCORING_METHODOLOGY` | §3.2 closing note | `…equals \`perQuestionMax.TKP\` (SC-3).` | `…equals \`perQuestionMax.TKP\`.` | `SC-3` is the **audit finding id** for this note (`AUDIT_FINDINGS_RESOLUTION.md` SC-3), not a scoring rule. In a SC-rules section it reads as a cross-reference to a non-existent SC-03 and collides with SC-03 (`MAX_SCORE_MISMATCH`). Removed (§11 item D4) |
| 9 | `SCORING_METHODOLOGY` | §5.3 | `…valid by construction (SC-1).` | `…valid by construction.` | `SC-1` is the audit finding id (threshold-ceiling finding), not a rule. Removed |
| 10 | `SCORING_METHODOLOGY` | §6.2 l.576 | `**One origin per code, three checks (SC-2).**` | `**One origin per code, three checks.**` | `SC-2` is the audit finding id. Removed |
| 11 | `SCORING_METHODOLOGY` | §10.2 l.868 | `…no §3.2 weight set is a rule, SC-3.` | `…no §3.2 weight set is a rule, SC-05.` | Same as #8; replaced with the rule that actually governs it |
| 12 | `PRD` | FR-G7 l.213 | `N batch's questions become usable …` | `A batch's questions become usable …` | Article |
| 13 | `PRD` | FR-Q8 l.232 | `N fix creates a new content version …` | `A fix creates a new content version …` | Article |
| 14 | `PRD` | FR-E6 l.289 | `N regulation change creates …` | `A regulation change creates …` | Article |
| 15 | `PRD` | FR-K3 l.296 | `N custom package is created …` | `A custom package is created …` | Article |
| 16 | `PRD` | §4 l.49 | `retained, not deleted` (§10) | `retained, not deleted` (§11) | **Heading-number cross-reference.** "Constraints" was renumbered §10→§11 by the revision; the reference did not move. `PRD` §11 is now Constraints |
| 17 | `PRD` | §9.13 FR-A1 | `FR-A1 Report asynchronous outcomes …` | `FR-N1 Report asynchronous outcomes …` | Id collision: `FR-A1` is already §9.4 "Per-test, per-submateri accuracy". `A→N` turned these three notification ids into duplicates. Restored to `FR-N1` (story ids US-N1/N2 already exist) |
| 18 | `PRD` | §9.13 FR-A2 | `FR-A2 **No Windows/OS notifications.**` | `FR-N2 **No Windows/OS notifications.**` | Same |
| 19 | `PRD` | §9.13 FR-A3 | `FR-A3 Job statuses include …` | `FR-N3 Job statuses include …` | Same |
| 20 | `FEATURE_MATRIX` | l.15 | `Nccumulated-active-time countdown …` | `Accumulated-active-time countdown …` | `HEAD` reads `Accumulated`; matches `SCORING_METHODOLOGY` §8.1 |
| 21 | `FEATURE_MATRIX` | l.53 | `\| approved material per weakness \|` | `\| Approved material per weakness \|` | Sentence case; `HEAD` reads `Material per weakness`; matches FR-L3 "Approved … material" |
| 22 | `FEATURE_MATRIX` | l.84 | `FR-A1` (Notifications row) | `FR-N1` | Follows #17 |
| 23 | `FEATURE_MATRIX` | l.85 | `FR-A2` (Notifications row) | `FR-N2` | Follows #18 |
| 24 | `FEATURE_MATRIX` | l.86 | `FR-A3` (Notifications row) | `FR-N3` | Follows #19 |
| 25 | `FRONTEND_PRD` | l.72 | `\| FR-A1…FR-A3 notifications \|` | `\| FR-N1…FR-N3 notifications \|` | Follows #17–#19; without it the matrix row and this row disagree |
| 26 | `FRONTEND_RESULTS_ANALYTICS` | §6 block 2 l.128 | `metric word (Nkurasi / Pencapaian)` | `metric word (Akurasi / Pencapaian)` | UI term `Akurasi` is the word used by `ANALYTICS_ENGINE` §2.1 ("accuracy") and §1 of this file; `Nkurasi` is `A→N` damage |
| 27 | `FRONTEND_RESULTS_ANALYTICS` | §2 per-question row | (no statement) | added one sentence: choice letter is read verbatim from `byQuestion[].selected` | `POST_REPAIR_INTEGRITY_AUDIT` §3.6 records 9 damaged lines in this untracked file and names 6 tokens; this is the **one line with no recoverable token** (§5) |

**Count: 26 token-level repairs + 1 reconstructive sentence + the API reconciliation in §6 + two
report corrections in §7.** No other line of any in-scope document was altered.

---

## 5. `FRONTEND_RESULTS_ANALYTICS.md` — the nine lines the audit listed, and the one gap

The file is untracked, so reconstruction used parity with tracked documents only. Re-read line by line:

| Audit §3.6 line | Current state | Verdict |
|---|---|---|
| l.1 title `Learning Nnalytics` | `# Frontend Results and Learning Analytics` | correct before this repair |
| l.3 `NnalyticsSnapshot` | `AnalyticsSnapshot` | correct before this repair — matches `ANALYTICS_ENGINE.md` §6 type |
| l.60 `Nn NI-origin question` | `An AI-origin question` | correct before this repair |
| l.70 `via HISTORICNL basis` | `via HISTORICAL basis` | correct before this repair — tier exists in `CPNS_2026_REGULATIONS` §4.1 |
| l.80 `The NPI enforces this` | `The API enforces this` | correct before this repair |
| l.97 `PREFLIGHT_FNILED`, `REGULNTORY_*` | `PREFLIGHT_FAILED`, `REGULATORY_*` | correct before this repair — matches `API_SPECIFICATION` §4 |
| l.138 `NI-written` | `AI-written` | correct before this repair |
| l.165 `NI-written` | `AI-written` | correct before this repair (§8, "AI-written reason") |
| l.177 `NI-written` | `AI-written` | correct before this repair (§9.4) |
| l.128 `Nkurasi` (found now) | `Akurasi` | **repaired** (#26) |
| — | "your choice letter" (4 table rows) | **no token recoverable.** The audit's 9 damaged lines vs 6 damaged tokens meant one damaged location carried no flaggable token. The only text in this file with no counterpart elsewhere that reads as truncated is "your choice letter" without saying where the letter comes from. Repaired by **adding one sentence that states the existing contract** (`byQuestion[].selected`, the frozen option key), not by inventing copy. **Provenance: `SCORING_METHODOLOGY` §2.2 `ScoreResult.byQuestion[].selected`.** If the Product Owner prefers the original sentence, nothing depends on this one |

Those references were verified against `ANALYTICS_ENGINE` §7.6 (user-facing consequences) and
`SCORING_METHODOLOGY` §2.2. No contradiction found.

---

## 6. PR-15…PR-19 — API reconciliation

### 6.1 The corrected figures

Before repair the mapping stated 73 / 73 / 72 / 69. The audit's §8 arithmetic is right, so after repair:

| Measure | Before | After | Basis |
|---|---|---|---|
| `API_ENDPOINTS` route rows | 73 | **74** | 73 before + the `POST /questions/bulk` row added (§6.3) |
| `FRONTEND_API_MAPPING` E-ids | 73 | **74** | counted: 74 `E##` rows |
| Screen-reachable | 72 | **73** | 74 − E72 `/health` (launcher only) |
| Launcher-only | 1 | 1 | E72 |
| Supported | 69 | **70** | 74 − 4 partial |
| Partial | 4 | 4 | E06, E27, E28, E32 |

Section-sum check after the header fixes: `1 + 4 + 6 + 13 + 2 + 15 + 7 + 4 + 9 + 3 + 7 + 3 = 74`. Each
section header was re-counted against its own rows; §1.6 (14→**15**) and §1.8 (5→**4**) were the only two
wrong, as PR-16 and PR-17 said.

### 6.2 PR-19 — E26 path

`/analytics/trends?competencyId=` → **`/analytics/trends?competencyId=<id>`**, matching `API_ENDPOINTS` §5
verbatim.

### 6.3 PR-18 — `E36 POST /questions/bulk`, resolved without adding an unapproved feature

**The endpoint was never absent from the contract; it was missing from one table in it.** Checking all six
mentions of the route:

| Document | State before repair |
|---|---|
| `PRD` FR-Q4 | "Bulk archive only; there is no bulk activate, no bulk edit and **no CSV/Excel import**" |
| `MVP_SCOPE` (§1, decision E) | bulk *archive* allowed; bulk *edit* removed |
| `API_ENDPOINTS` §6 **prose** | "**Bulk archive** (`POST /questions/bulk`) is retained as a bank housekeeping operation for `active → archived` only" |
| `API_ENDPOINTS` §6 **route table** | **no row** ← the defect |
| `VALIDATION.md` l.57 | "`POST /questions/bulk` accepts only `active → archived` ids" (409 otherwise) |
| `FRONTEND_PAGE_SPECIFICATIONS` §11, `FRONTEND_API_MAPPING` E36 | row + page action present |

The route therefore already existed on **both** sides as a documented rule; only its method/path/status row
was missing. The repair **adds the missing row** and nothing else:

- Row: `POST /questions/bulk` · 200 · errors `400, 409` · "Bulk **archive only** (`active → archived`), ids
  verified against FR-Q4 in one transaction. Cannot activate, accept or edit content".
  Every cell is sourced: path/behaviour from `API_ENDPOINTS` §6 prose, `VALIDATION.md` l.57 (→ 409), FR-Q4.
- The prose paragraph now says "same table".
- `FRONTEND_API_MAPPING` §2 recorded that E36 is the one-route difference and that its **product status was
  open** for the owner (since approved — decision below).

> **Pass 2 (2026-11-09).** With the row present, mapping §2 now counts API_ENDPOINTS at **74** (it still
> said 73) and the E36 paragraph was rewritten: the route is in both tables, and what remains for the
> owner was a **reaffirmation** that bulk archive stays in MVP (Q-PR1, §12) — approved 2026-11-09, §6.3.

**What this does not decide.** It does not add bulk import, bulk edit, bulk activate, or any new capability
— `API_ENDPOINTS` "Not in this file" still forbids them, and the new row restates FR-Q4. Whether a bulk
*archive* endpoint should exist at all is a product question the Product Owner had not answered since the
revision text and the `MVP_SCOPE` decision E explicitly keep it; this repair preserved the documents'
existing position rather than choosing the audit's alternative. **It was listed as Q-PR1 in §12.**

> **Product Owner decision, 2026-11-09: APPROVED.** Bulk archive stays in MVP — `active → archived` only,
> every submitted id validated, one transaction, unsupported transitions rejected, no bulk content editing,
> no bulk activation, no CSV/Excel import. This is exactly what the row, FR-Q4, `VALIDATION` l.57,
> `QUESTION_SPECIFICATION` §3.2 and the `MVP_SCOPE` decision state, so **no contract text changes**. Q-PR1 is
> closed; [AUDIT](../AUDIT.md) AUD-74 is resolved on that decision and keeps its text.

---

## 7. Corrections to the revision report (required by this repair)

| Location | Before | After | Why |
|---|---|---|---|
| `SYSTEM_REVISION_REPORT` §12.6 route count | "`API_ENDPOINTS`: **73** … 73 ids, 72 called by a screen, 69 supported" | "**74** … 74 ids, 73 called by a screen, 70 supported, 4 partial" with a pointer to this report and to audit PR-15 | The recorded figure was wrong by one; a report that keeps a wrong count re-creates the defect |
| `SYSTEM_REVISION_REPORT` §12.7 | "Every affected token was repaired … a scan … now returns zero hits" | kept, followed by an explicit **Correction (2026-11-09)** paragraph: the claim was false for five of six files; the scan searched a fixed list | The audit's §11 verdict is that this sentence is false. Leaving it unqualified contradicts the audit record |

No other sentence of the revision report was changed. **All §12 product decisions are unchanged.**

---

## 8. Product Owner decisions preserved (nothing decided unilaterally)

| Decision | Where it lives | Verified after repair |
|---|---|---|
| Cancel of a generation job removed | `GENERATION_JOBS` §2, `API_ENDPOINTS` §8, E52 retired | unchanged |
| Sampling quota unresolved, no number | 6 documents | unchanged; no number introduced |
| Rencana Belajar out of MVP | `MVP_SCOPE` §2, `RECOMMENDATION_ENGINE` §7, `FRONTEND_RESULTS_ANALYTICS` §8 | unchanged |
| Hide / delete / purge separated; purge unresolved | `ANALYTICS_ENGINE` §7.1–§7.8 | unchanged |
| Config resolution internal to packages | `CPNS_2026_REGULATIONS` §4.2.1 | unchanged |
| Score computed, verdict requires approval | `SCORING_METHODOLOGY` §5.6, §11 | unchanged |
| CPNS only; non-CPNS never cited as authority | whole set | unchanged |
| `EVIDENCE-BACKED-NOT-CPNS-2026` rename | taxonomy, scoring §6.7 | unchanged |
| Deletion consequences wording | `ANALYTICS_ENGINE` §7.6, results §5.3 | unchanged |

Open questions Q-2, Q-4…Q-10 and U-2…U-4 are untouched. **One new open item was created by this repair
(Q-PR1, §12)** rather than resolved by inference.

---

## 9. Re-read of every changed document (no token scan as proof)

Each was read end to end after the edits, checking (a) the edit reads correctly in its sentence, (b) the
neighbouring intentional text still says what §8 lists, (c) cross-references point at existing headings and
sections.

| Document | Result of the read |
|---|---|
| `examination/SCORING_METHODOLOGY.md` | §10 examples consistent (`A…E`); §3.2/§10.2 cross-reference resolves; §11.1 prose grammatical; no `SC-05` collision remains; §5.3 sentence complete |
| `product/PRD.md` | FR ids unique: D1–D6, T1–T8, P1–P5, A1–A8, G1–G8, Q1–Q8, L1–L7, M1–M5, C1–C8, E1–E6, K1–K4, H1–H4, **N1–N3**; §4 → §11 cross-reference correct ("Constraints" is §11) |
| `product/FEATURE_MATRIX.md` | every FR id in §9 appears; notification rows now name FR-N1–N3; `Approved material`, `Accumulated-active-time` correct |
| `frontend/FRONTEND_PRD.md` | notification coverage row names FR-N1–N3 |
| `frontend/FRONTEND_RESULTS_ANALYTICS.md` | §1–§9 read; `Akurasi`, the added sentence, `HISTORICAL`, `AI-origin`, `AI-written`, `API enforces` all consistent with their sources |
| `frontend/FRONTEND_API_MAPPING.md` | §1 header 74; 12 section headers sum to 74; §2 table and §5 agree; E36 note points at this report and the open item (pass 2: §2 count 73→74, E36 note rewritten) |
| `backend/API_ENDPOINTS.md` | §6 table now holds `bulk` after `archive`; prose says "same table"; §1–§11 re-counted at 74 routes |
| `frontend/FRONTEND_PAGE_SPECIFICATIONS.md` | §11 Bulk row consistent with FR-Q4 (select active rows → one `POST /questions/bulk`) |
| `audit/SYSTEM_REVISION_REPORT.md` | §12.6 and §12.7 corrected; rest unchanged |

---

## 10. What is **not** claimed

**This is not a PASS.** A clean token count is not proof, for the same reason the audit's §10 gave:

1. **No baseline exists** for `FRONTEND_RESULTS_ANALYTICS.md`. Its 9th damaged line is reconstructed by
   inference (§5) and could differ from the original sentence.
2. **The residue was invisible to the diff.** The 24 remaining tokens were all in revision-era *new* text,
   which `git diff` against `HEAD` cannot flag. A damaged new line that still reads as a plausible word
   would survive this method — the three `FR-*A1…A3` collisions were found only because two ids landed in
   the same document, and are reported as a **method warning**, not as an exhaustive sweep.
3. ~~**`NN` in `PRD` NFR-5 looks like damage and was left alone.**~~ **Resolved in pass 2:** NFR-5 read
   "WCAG 2.1 NN contrast"; `HEAD` and `FRONTEND_ACCESSIBILITY.md` both establish **AA**, and
   `FRONTEND_PRD.md` agrees, so the canonical reference is unambiguous and the text is now `AA`
   (Q-PR2 closed).
4. **No claim about out-of-scope documents.** Files outside the eight were checked only for the corruption
   patterns and were not read line by line here.
5. **No arithmetic re-derivation** of scoring mathematics; no code comparison.

---

## 11. Discrepancies between this repair and the audit's instructions

Stated because the instruction said to use `HEAD` as the reference, and in four places this repair did
**not** restore `HEAD`:

| # | Audit/instruction implied | What was done | Why |
|---|---|---|---|
| D1 | "Use Git `HEAD` as reference for the seven tracked documents" | Used `HEAD` **plus** the canonical document for every token. 116 tokens matched `HEAD`; 24 had no `HEAD` counterpart | Those 24 are in new text; `HEAD` has nothing to restore. Restoring them from `HEAD` would delete intentional §12 content — exactly what the instruction forbids (item 3) |
| D2 | Audit PR-22 lists `Nn` at PRD l.262 as damage | **Not** changed. The line now reads "A standalone **Rencana Belajar** feature" | `HEAD` text was "no separate screen". This is §12.3 revision prose, not damage |
| D3 | Audit PR-22 `Nrray`, `Nrrows`, `NND`, `Nuto-submit`, `Npplies`, etc. | Verified already correct; no edit needed | Already repaired before this pass |
| D4 | — | Removed the `(SC-1)`, `(SC-2)`, `SC-3` attributions in `SCORING_METHODOLOGY` | They are **audit finding ids** that the revision wrote into a document whose own rules are `SC-01…SC-08`; inside that document they read as broken rule references. This is a **documentation-integrity change to new text**, not a token repair — the owner may reject it (`Q-PR3`) with no other effect |

---

## 12. Open items created by this repair — for the Product Owner

| # | Question | Current documented state | Impact |
|---|---|---|---|
| ~~**Q-PR1**~~ | ~~Should `POST /questions/bulk` (bulk **archive** only) stay in MVP?~~ **Closed — Product Owner decision 2026-11-09: APPROVED**, with the scope now stated (`active → archived` only, ids validated, one transaction, unsupported transitions rejected, no bulk edit/activation/import). AUD-74 resolved on that decision. Historical trace below. | Trace at HEAD: PRD FR-Q4 "Bulk archive; bulk activate only for questions whose validation passes"; `MVP_SCOPE` decision E "bulk *archive* allowed, bulk *edit* removed"; `API_ENDPOINTS` §6 prose row; `VALIDATION.md` l.57; E36 and page §11. The capability is pre-existing; only the route-table cell was missing. Now in both tables (§6.3, pass 2). `QUESTION_SPECIFICATION` §3.2 states the single bulk edge | If "no", delete the row + E36 + the page-spec sentence + the `VALIDATION` sentence + the §3.2 paragraph; nothing else moves |
| **Q-PR2** | ~~Is `NFR-5` "WCAG 2.1 **NN** contrast" meant to be **AA**?~~ | **Closed in pass 2** — `PRD` NFR-5 now `AA`; sources agree | — |
| **Q-PR3** | Accept removal of the `(SC-1)` / `(SC-2)` / `SC-3` attributions? | Removed (§11 D4); reviewed in pass 2 — the ids are audit-finding ids that collide with the document's own `SC-01…SC-08`, and no sentence loses meaning | Confirmed; reversible |

**Pass-2 additions (step 5 of the follow-up instruction).**

| # | What | Where |
|---|---|---|
| F-1 | §2 arithmetic corrected: 116 clean + 24 damaged = 140 (the "40" was wrong) | §2 |
| F-2 | `FRONTEND_API_MAPPING` §2 counted `API_ENDPOINTS` at 73 after the bulk row made it 74; E36 paragraph said "not yet in the route table" | mapping §2 |
| F-3 | The **closed** error registry lacked the ranked PF-12 codes `REGULATORY_*` and the PF-09 refusals `THRESHOLD_NOT_INTEGER` / `THRESHOLD_EXCEEDS_MAX` / `THRESHOLDS_REQUIRE_APPROVAL`; `API_ENDPOINTS` legend listed `THRESHOLD_CONFIG_INVALID` twice; `CONFLICT` was scoped "other than approval" while `ERROR_HANDLING` uses it for transitions | `API_SPECIFICATION` §4/§4 prose, `ERROR_HANDLING` §4, `API_ENDPOINTS` legend, `AUDIT.md` AUD-73 |
| F-4 | `QUESTION_SPECIFICATION` §3.2 stated no transition forbids bulk, yet FR-Q4's canonical doc should name the one bulk edge | QUESTION_SPECIFICATION §3.2 |
| F-5 | `ERROR_HANDLING` §4 (behaviour table) did not list the regulatory block | ERROR_HANDLING §4 |

Full evidence and the verdict: [FINAL_DOCUMENTATION_INTEGRITY_AUDIT.md](./FINAL_DOCUMENTATION_INTEGRITY_AUDIT.md).

---

## 13. Files changed by this repair

| File | Nature |
|---|---|
| `docs/examination/SCORING_METHODOLOGY.md` | 11 token/article edits (§4 #1–#11) |
| `docs/product/PRD.md` | 4 articles, 1 heading reference, 3 FR id collisions (§4 #12–#19) |
| `docs/product/FEATURE_MATRIX.md` | 2 words, 3 FR ids (§4 #20–#24) |
| `docs/frontend/FRONTEND_PRD.md` | 1 FR id range (§4 #25) |
| `docs/frontend/FRONTEND_RESULTS_ANALYTICS.md` | 1 word, 1 reconstructed sentence (§4 #26–#27) |
| `docs/frontend/FRONTEND_API_MAPPING.md` | PR-15/16/17/18/19 (§6) |
| `docs/backend/API_ENDPOINTS.md` | missing `POST /questions/bulk` row (§6.3) |
| `docs/frontend/FRONTEND_PAGE_SPECIFICATIONS.md` | one Bulk row wording so the list is not read-only (§6.3) |
| `docs/audit/SYSTEM_REVISION_REPORT.md` | route-count figure; §12.7 honesty correction (§7) |
| `docs/backend/API_SPECIFICATION.md` | pass 2: closed registry — one `REGULATORY_*` row, PF-09 refusals in the `THRESHOLD_CONFIG_INVALID` class, `CONFLICT` scope |
| `docs/backend/ERROR_HANDLING.md` | pass 2: §4 rows for the regulatory block and the PF-09 refusals |
| `docs/AUDIT.md` | pass 2: AUD-73 |
| `docs/examination/QUESTION_SPECIFICATION.md` | pass 2: §3.2 bulk-operation paragraph |
| `docs/audit/FINAL_DOCUMENTATION_INTEGRITY_AUDIT.md` | pass 2: final audit |
| `docs/audit/POST_REPAIR_REPAIR_REPORT.md` | this file |

Seven of the ten are in the eight documents the audit named; the other three are the two documents that
declare the same contract (the backend route table, the page spec) and the revision report whose own
figures were wrong. **No file outside this set was modified.**

---

## 14. Guardrail confirmation

- Documentation only. No `.ts`, `.tsx`, `.json`, config or dependency file touched.
- No test, build, lint or typecheck run (and none attempted).
- No Git operation of any kind: no `checkout`, `reset`, `stash`, `add`, `commit`, `push`, or identity change.
  `git show` and `git diff` were used read-only.
- Nothing was restored wholesale from `HEAD`; every replacement is listed in §4.

---

**Repair complete. Awaiting Product Owner approval — including a decision on Q-PR1, Q-PR2 and Q-PR3
(§12) and on whether to re-run the full integrity audit before implementation resumes.**
