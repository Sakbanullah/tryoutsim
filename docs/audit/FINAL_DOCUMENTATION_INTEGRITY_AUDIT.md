# Final Documentation Integrity Audit

Final verification of the six-document corruption repair and of the contract consistency around it, after
[POST_REPAIR_REPAIR_REPORT.md](./POST_REPAIR_REPAIR_REPORT.md) (pass 1) and the pass-2 corrections recorded
in §2 below.

Date: 2026-11-09 · Owner: user (Sakbanullah) · Scope: `docs/` Markdown only.

**Not performed, by instruction:** no source-code change, no dependency change, no test, build or lint,
**no Git operation** (no checkout, reset, add, commit or push). `git show`/`git diff` were read-only.

Every claim below names where it was checked. The verdict in §6 is derived from those checks, not from the
token scan alone.

---

## 1. What this audit is

Two earlier documents already exist and are not repeated here:

| Document | Role |
|---|---|
| [POST_REPAIR_INTEGRITY_AUDIT.md](./POST_REPAIR_INTEGRITY_AUDIT.md) | found the damage; lists PR-01…PR-22 |
| [POST_REPAIR_REPAIR_REPORT.md](./POST_REPAIR_REPAIR_REPORT.md) | applied the repair; before → after per token |
| this file | re-checks the result, closes the open items, states what is **not** proven |

Status labels used: **fixed** = defect was real, now corrected and re-read · **verified** = claim checked
and true, nothing to change · **open** = needs a Product Owner decision · **limitation** = cannot be proven
by this method.

---

## 2. Findings fixed in pass 2 (this audit)

| # | Finding | Evidence | Where fixed |
|---|---|---|---|
| F-1 | Repair report §2 arithmetic said "40 damaged"; its own table and a recount give **24 damaged, 116 clean, 140 total** | pass-1 §4 table row count; recount of the 140 listed tokens | `POST_REPAIR_REPAIR_REPORT.md` §2 (header + body + note) |
| F-2 | `PRD` NFR-5 read "WCAG 2.1 **NN** contrast"; `HEAD` and two canonical docs say **AA** | `git show HEAD:docs/product/PRD.md` (NFR-5); `FRONTEND_ACCESSIBILITY.md` l.9; `FRONTEND_PRD.md` l.96 | `PRD.md` l.329 — now `AA`; **Q-PR2 closed** |
| F-3 | `FRONTEND_API_MAPPING` §2 still counted `API_ENDPOINTS` at **73** after the bulk row made it 74 | pass-1 §6.3; `grep -cE '^\| (GET\|POST\|PATCH\|PUT\|DELETE) \|'` → 74 | mapping §2 |
| F-4 | mapping §2 narrated E36 as "not yet in the route table", then §5 still said "**73 routes**" | mapping l.172, l.226 | both rewritten; §5 now 74 / 70 Supported / 4 Partial |
| F-5 | mapping §2 counted **E06** as Partial while the E06 row read "Supported" | mapping §2 table vs the E06 inventory row | E06 row now states the GAP-M12 partial detail; `grep -c '\| Partial —'` → 4, matching §2 |
| F-6 | mapping put **E17** `POST /sessions/:id/resume` on Beranda `/`; the page spec's Beranda API list is `GET /bootstrap`, `GET /analytics`, `GET /sessions`, `GET /recommendations/weaknesses` | `FRONTEND_PAGE_SPECIFICATIONS.md` §1 "API" line; `FRONTEND_EXAM_FLOW.md` l.108 (resume on route entry) | mapping §3 Beranda row; E17 stays on the Runner row, where `FRONTEND_EXAM_FLOW` puts it |
| F-7 | The **closed** error registry (`API_SPECIFICATION` §4) contained neither the ranked PF-12 codes `REGULATORY_PATHWAY_MISMATCH` / `REGULATORY_YEAR_MISMATCH` / `REGULATORY_SCOPE_UNVERIFIED` nor the PF-09 refusals `THRESHOLD_NOT_INTEGER` / `THRESHOLD_EXCEEDS_MAX` / `THRESHOLDS_REQUIRE_APPROVAL`, although `SCORING_METHODOLOGY` §6/§11.1 ranks them on the submit path — a direct contradiction of `ERROR_HANDLING` §1 ("the set is closed") | `SCORING_METHODOLOGY` §6.2 PF-09/PF-12 rows, §11.1 items 1–2; `API_SPECIFICATION` §4 rows | `API_SPECIFICATION` §4 (PF-09 refusals in the `THRESHOLD_CONFIG_INVALID` class, one `REGULATORY_*` row, closing note), `API_ENDPOINTS` status legend, `ERROR_HANDLING` §4; **AUD-73** |
| F-8 | `API_ENDPOINTS` status legend listed `THRESHOLD_CONFIG_INVALID` **twice** | legend l.7–10 before pass 2 | legend de-duplicated |
| F-9 | Registry meaning said `CONFLICT` is "a state conflict **other than approval**", while a later row says approval is never a `CONFLICT` — and `ERROR_HANDLING` uses `CONFLICT` for every lifecycle refusal (`illegal_transition`, `already_submitted`, …) | `ERROR_HANDLING` §4 rows 5–7; `API_SPECIFICATION` §7.x validation rows | registry `CONFLICT` row now states its real scope |
| F-10 | `THRESHOLDS_REQUIRE_APPROVAL` (a PF-09 **block**) sat in a document whose §5.6 headline is score-vs-verdict; the distinction was not stated at the code | `SCORING_METHODOLOGY` §6.2 "Failing — thresholds" | one sentence added: PF-09 runs before PF-13, so it blocks rather than withholds |
| F-11 | `QUESTION_SPECIFICATION` §3.2 (the canonical lifecycle home of FR-Q4) named no bulk edge; the only bulk rule lived outside it | FR-Q4; `API_ENDPOINTS` §6 | §3.2 "Bulk operation" paragraph |
| F-12 | `API_ENDPOINTS` `GET /questions` listed a filter field, `difficultyAiInitial`, that does not exist in the question contract (it is `difficulty.aiInitial` in `QUESTION_SPECIFICATION` §1.1 and `ANALYTICS_ENGINE` §4.1; the DB column is `difficultyAiInitial`) | the three documents named | row now labels them query keys and names the stored columns; `DATABASE_SCHEMA` §2 states the contract key |
| F-13 | A Mermaid node id `NV` inside `A[Accumulated active time] -->|no| NV[No verdict …]` was one character from the `no` label — an ambiguous look-alike in the one diagram of the user journeys | `USER_JOURNEYS.md` l.94 | renamed `NOV` |

F-7/F-8 change only the **defined set** of submit error codes; they add no capability, no threshold and
no approval rule. Score-vs-verdict semantics (§5.6/§11) are untouched and were re-read after the edit.

---

## 3. Verified correct (checked, nothing changed)

### 3.1 PR-01…PR-22 — every finding of the integrity audit

| Finding | Subject | Verdict | How checked |
|---|---|---|---|
| PR-01 | `AnswerKey`/`AnswerSheet` type names | verified fixed | `type AnswerKey` / `type AnswerSheet` at `SCORING_METHODOLOGY` l.66/74; 7 + 7 uses; zero `Nnswer*` outside the audit evidence files |
| PR-02 | `PREFLIGHT_FAILED`, `REGULATORY_*`, `SNAPSHOT_*` spellings | verified fixed | none of `PREFLIGHT_FNILED`, `REGULNTORY_`, `SNNPSHOT_` anywhere in `docs/` |
| PR-03 | `NAB` concept | verified fixed | 10 `NAB` in `SCORING_METHODOLOGY`; no `NNB` in any non-audit file |
| PR-04 | subsystem name `AI` in `FEATURE_MATRIX` | verified fixed | matrix rows name AI; no `NI` token outside quoted evidence |
| PR-05 | `Kepmen PANRB`, `KELIMA`, `TA 2026` | verified fixed | `Kepmen PANRB 321/2024` with `HISTORICAL` tier (l.184); `406/2026` `KELIMA` at l.667; no `PNNRB`/`KELIMN` |
| PR-06 | `HISTORICAL` tier literal | verified fixed | l.184; `FRONTEND_RESULTS_ANALYTICS` §3 "via HISTORICAL basis" |
| PR-07 | `SEKOLAH_KEDINASAN` literal | verified fixed | `SCORING_METHODOLOGY` l.394, l.667; no `SEKOLNH_` |
| PR-08 | ERD entity names | verified fixed | `ERD.md` read; `BASIS_REF`, `PROVISIONAL_APPROVAL`, `SESSION_SNAPSHOT`, `AI_ROUTING` present, `verdictWithheldJson` added to `SCORE_RESULT` |
| PR-09 | document titles / `§14 Acceptance criteria` | verified fixed | `SYSTEM_ARCHITECTURE.md` title; `PRD.md` §14 heading |
| PR-10 | `Approval`, `ScoreApprovalRef`, `ProvisionalApproval` | verified fixed | §11 read; no `Npproval` form |
| PR-11 | `activeMsAtStart`, `difficultyAiInitial`, `elapsedActiveMs` | verified | §7/§8 use `activeMs`; the remaining `difficultyAiInitial` instances are DB columns and are now labelled as such (F-12) |
| PR-12 | `OpenAI-compatible` preset | verified fixed | `SYSTEM_ARCHITECTURE` l.15, `PRD` FR-C1; no `OpenNI` |
| PR-13 | dead link `NUDIT_FINDINGS_RESOLUTION.md` | verified fixed | `SCORING_METHODOLOGY` l.435 reads `docs/audit/AUDIT_FINDINGS_RESOLUTION.md`; the file exists |
| PR-14 | `NPI` for `API` in security text | verified fixed | no `NPI` token outside quoted evidence |
| PR-15 | mapping claimed 73 routes for 74 E-rows | fixed twice — pass 1 (E-id side) and F-3/F-4 (API side, §5 sentence) | counts in §3.2 |
| PR-16 | `§1.6 · 14` heading over 15 rows | verified fixed | per-section recount: every `### 1.x · n` header equals its row count (1, 4, 6, 13, 2, 15, 7, 4, 9, 3, 7, 3) |
| PR-17 | `§1.8 · 5` heading over 4 rows | verified fixed | same recount |
| PR-18 | E36 without a route row | resolved by adding the row (pass 1); product status **approved by the Product Owner 2026-11-09** (Q-1 closed, AUD-74) | `API_ENDPOINTS` §6 table + prose + `VALIDATION` l.57 + page spec §11 + mapping E36 |
| PR-19 | E26 path `?competencyId=<id>` | verified fixed | mapping E26 row |
| PR-20 | `SourceRef.tier` narrower than `EvidenceTier` | see §4 Q-2 (product-adjacent, documented) | `MATERIAL_SPECIFICATION` §4 |
| PR-21 | `Nnalogi`, `Deret Nngka` in a PRD example | verified fixed | `PRD.md` FR-P1 reads *Analogi*, *Silogisme*, *Deret Angka* |
| PR-22 | prose tokens (`Nn`, `Nn unanswered`, `Nuto-submit`, `NND`, `Nrray`, `Nrrows`, `Npplies`, `Nnything`) | verified fixed | zero non-audit hits |

Corrupted spellings still appear **only** inside `POST_REPAIR_INTEGRITY_AUDIT.md` (as the audit's own
evidence) and `POST_REPAIR_REPAIR_REPORT.md` (before → after tables). Both were marked so a reader cannot
mistake them for live text (integrity audit §3.1 status note).

### 3.2 Counts — recounted this pass, not copied

| Measure | Figure | Check |
|---|---|---|
| `API_ENDPOINTS` route rows | **74** | `grep -cE '^\| (GET\|POST\|PATCH\|PUT\|DELETE) \|'` |
| mapping E-ids | **74** (E01–E77 minus E52, E76, E77) | `grep -cE '^\| E[0-9]{2} \|'`; retired ids absent, none duplicated |
| section headers sum | **74** | per-section recount, all twelve headers correct |
| called by a screen | **73** | 74 − E72 `/health` (launcher only) |
| Supported / Partial | **70 / 4** | `grep -c '\| Partial —'` → 4 (E06, E27, E28, E32), matching the §2 table row by row |
| mapping §1 header, §2 table, §5 sentence | 74 / 74,73,70,4 / 74 | read together; no residue of 73 except the screen figure |

### 3.3 Corruption scan — scope and method

Swept all 72 Markdown files under `docs/` for: `N`-initialized look-alikes (`NPI`, `NI`, `Non-NI`,
`Nnswer*`, `Npproval`, `Nnalytics`, `Nrray`, `NND`, `Nrchitecture`, `Ncceptance`, `Nuto-submit`,
`Npplies`, `Nnything`, `Nnalogi`, `Deret Nngka`, `KELIMN`, `PNNRB`, `HISTORICNL`, `SEKOLNH_`), the
article/option/A-shaped `N` (`option N`, `Key {N:`, `| N | 0 |`), bare `N <word>`, and `WCAG 2.1 NN`.
Result outside the two evidence files: **no hits**. Every remaining `N` token is a real word, an acronym
(`NAB`, `NFR`, `NULL`, `NKRI`, `NOTIFICATION`), the placeholder "N questions", or a Mermaid node id.

Two independent passes were run (one by this session, one blind to the earlier token list); the blind pass
also reported only evidence-file hits. A third verification pass found one additional item not on the
original list — the `NV` node id (F-13) — which supports the caution in §5.

### 3.4 Contracts re-read end to end after the edits

`SCORING_METHODOLOGY` (§5.3, §5.6, §6.2, §6.7, §10, §11.1) · `PRD` (FR-Q4, FR-T7, NFR-5, §9 ids) ·
`FEATURE_MATRIX` (all FR ids) · `QUESTION_SPECIFICATION` (§1.1, §3.2) · `API_SPECIFICATION` (§3–§4, §4.2,
§7) · `ERROR_HANDLING` §1, §4 · `API_ENDPOINTS` (legend, §4–§6) · `DATABASE_SCHEMA` §2 · `ERD` ·
`VALIDATION` §2 · `FRONTEND_API_MAPPING` (§1 headers, §2, §3, §5) · `FRONTEND_RESULTS_ANALYTICS` (§1, §2,
§3, §5.1, §8) · `FRONTEND_PAGE_SPECIFICATIONS` §1, §2, §11 · `FRONTEND_PRD` · `USER_STORIES` ·
`USER_JOURNEYS` (diagram) · `SYSTEM_REVISION_REPORT` §8, §12 · `AUDIT.md`.

Held against each other: notification ids `FR-N1…N3` consistent in PRD / matrix / FRONTEND_PRD /
USER_STORIES and different from the analytics ids `FR-A1…A8` · `WCAG 2.1 AA` in all three places it is
stated · every `FR-*` in the matrix defined in PRD §9 and unique there · enum literals
`SEKOLAH_KEDINASAN`, `HISTORICAL`, `EVIDENCE-BACKED-NOT-CPNS-2026` spelled identically wherever used ·
`REGULATORY_*` / `THRESHOLD_CONFIG_INVALID` / `PREFLIGHT_FAILED` / approval codes agree between
`SCORING_METHODOLOGY` §11.1, the registry, the behaviour table and the three frontend documents that
render the blocked state · regulation citations (Kepmen PANRB 321/2024 KESEBELAS/KEDELAPAN, 406/2026
KELIMA) unchanged · relative links in every changed document resolve.

---

## 4. Open questions for the Product Owner

None of these was decided by this audit.

| # | Question | What the documents say today | Cost of changing |
|---|---|---|---|
| ~~**Q-1**~~ | ~~Does bulk **archive** (`POST /questions/bulk`) stay in MVP?~~ **Resolved — Product Owner decision 2026-11-09: APPROVED.** Bulk archive stays in MVP; it is the only bulk transition (`active → archived`), every submitted id is validated against FR-Q4 and the lifecycle, the operation is one transaction, unsupported transitions are rejected; no bulk content editing, no bulk activation, no CSV/Excel import. Already the documented contract (PRD FR-Q4, MVP decision E, `API_ENDPOINTS` §6, `VALIDATION` l.57, `QUESTION_SPECIFICATION` §3.2, E36, page spec §11); the repair had only restored the missing route-table row | AUD-74 closed |
| **Q-2** | Does `SourceRef.tier` narrow `EvidenceTier`? (PR-20) | `MATERIAL_SPECIFICATION` §4 restricts the tier per source kind and says so; the broader set allows more | Low — one table |
| Q-2…Q-10, U-2…U-6 | Pre-existing owner items in `SYSTEM_REVISION_REPORT` §8 and `AUDIT_FINDINGS_RESOLUTION` §10 | Unchanged by this repair; re-read and untouched | As recorded there |
| — | The `(SC-1)`/`(SC-2)`/`SC-3` removal (pass-1 D4) | Reviewed again: those are **audit finding ids** that collided with the document's own `SC-01…SC-08` codes; no sentence loses meaning | Reversible, cosmetic |

---

## 5. Limitations — what this audit does not prove

1. **`FRONTEND_RESULTS_ANALYTICS.md` has no baseline.** It is untracked; one sentence was reconstructed by
   inference in pass 1. It reads correctly against its neighbours, but "original wording" cannot be
   established from anything in the repository.
2. **New text is diff-blind.** `git diff` against `HEAD` cannot flag damage inside revision-era text. The
   scan searched patterns, not meaning: a corrupted word that is still a real English/Indonesian word, or an
   id that stayed unique, could survive. The `FR-A1…A3` collision was found by reading, and the blind pass
   still produced one item not on the original list (`NV`), which is the honest measure of residual risk.
3. **No line-by-line reading of every document.** The contracts in §3.4 were read end to end; the rest of
   `docs/` was covered by the pattern scan and by link/anchor checks only.
4. **No code comparison.** There is no source in this repository yet; nothing was checked against an
   implementation.
5. **Error-code registry scope.** §4 now defines the *outcome* codes and the three PF-09 refusals and the
   three PF-12 codes; the per-check codes of `PREFLIGHT_FAILED.errors[]` (e.g. `SHEET_COUNT_MISMATCH`) are
   documented in `SCORING_METHODOLOGY` §6 and referenced from `API_SPECIFICATION` §4.1's
   `PreflightError` shape, not enumerated one by one in §4. That is the intended layering (one canonical
   list per enum, pointers elsewhere), not a gap, but it does mean §4 alone is not a complete code list.
6. **No approval was inferred from the documents.** Where a rule could only be confirmed by the owner
   (Q-1) it was listed, not assumed — and the owner has since decided it.

---

## 6. Verdict

**PASS**, with one open item that does not affect documentation integrity (Q-2 in §4; Q-1 was approved by
the Product Owner on 2026-11-09).

Basis, in order of weight:

1. **No live corruption remains.** All six affected documents were re-read; every one of the 140 damaged
   tokens that this repository can evidence is either restored from `HEAD`, or, for the 24 in new text,
   restored from the canonical document that defines the term. Two independent scans agree; the only
   remaining hits are inside the audit's own evidence tables.
2. **Every PR-01…PR-22 finding is closed or explicitly open**, with its state named in §3.1 — none is
   silently dropped.
3. **The contract chain agrees numerically**, recounted rather than copied: 74 routes, 74 E-ids, 73
   screen-reachable, 70 Supported, 4 Partial, twelve section headers summing to 74, and the same figures in
   `API_ENDPOINTS`, the mapping and `SYSTEM_REVISION_REPORT` §12.6.
4. **The one real remaining contradiction found in pass 2** — the closed error registry missing codes the
   scoring document ranks — was a genuine contract defect (AUD-73) and is corrected without touching
   approval or score/verdict semantics.
5. **Nothing was decided that belonged to the owner.** Bulk archive was flagged for reaffirmation, not
   approved by silence; the Product Owner then approved it (2026-11-09), and the revision report's other
   product decisions are unchanged.

This PASS is **not** a statement that every sentence is the author's original, nor that the documents are
complete: it is that the documents, as they now stand, contain no known corruption, agree with their
canonical sources on every point checked, and list what remains open. The limitations in §5 bound that
claim.

**Next:** Product Owner review of the remaining §4 Q-2 and the pass-2 edits, then the implementation gates in
[docs/roadmap/DEVELOPMENT_ROADMAP.md](../roadmap/DEVELOPMENT_ROADMAP.md).
