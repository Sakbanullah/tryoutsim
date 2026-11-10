# Frontend Results and Learning Analytics

How the result screen and the progress screens render `ScoreResult` and `AnalyticsSnapshot`. Both are
rendered **verbatim** — no formula, rounding or ranking is performed in the UI
([FRONTEND_DATA_CONTRACTS](./FRONTEND_DATA_CONTRACTS.md) §1, BR-X2).

Canonical meaning: [SCORING_METHODOLOGY](../examination/SCORING_METHODOLOGY.md) §2.2, §5, §5.6, §9 ·
[ANALYTICS_ENGINE](../backend/ANALYTICS_ENGINE.md) §2–§7 ·
[RECOMMENDATION_ENGINE](../ai/RECOMMENDATION_ENGINE.md) §2–§3. This file owns **presentation only**.

---

## 1. Vocabulary (what the UI may say)

| Field | UI wording | Never |
|---|---|---|
| `earned` / `possible` | "**{earned} dari {possible} poin**" | "skor", a percentage computed in the UI |
| `correctCount` / `answeredCount` (TWK, TIU) | "**{correct} benar dari {answered} dijawab**" | "akurasi 80%" computed locally |
| `byTest.TKP` attainment | "**{earned} dari {possible} poin**" | "benar/salah" |
| `MetricValue.percent` + counts | "**72% (18/25)**" | a bare percentage |
| `MetricValue.state = 'insufficient_data'` | "**Belum cukup data (n={answered})**" | "0%", "lemah" |
| `zero_correct` | "**0 benar dari {n} soal**" | "gagal" |
| `zero_attainment` | "**0 poin dari {n} soal**" | "salah semua" |
| `responseTime.medianSeconds` | "**±{m:ss} per soal (n={answeredCount})**" | "waktu rata-rata" (it is a median) |
| `coverage` | "**{attempted}/{available} soal pernah dikerjakan**" | a percent without the counts |
| `consistency` | "**Rentang {spread} poin** · arah: {direction}" | "tidak konsisten" alone |
| `thresholds.passed === true` | "**Memenuhi** ambang batas" + `notice` | "Lulus CPNS" |
| `thresholds.passed === false` | "**Belum memenuhi** ambang batas" + `notice` | "Gagal" |
| verdict absent | "**Ambang batas kelulusan CPNS 2026 belum terverifikasi**, jadi status lulus/belum lulus tidak ditampilkan." | any pass/fail styling, an empty badge, a red bar |

The app never claims a user "lulus" (passed the recruitment). It can only report whether the
*reproduced* threshold is met ([SCORING_METHODOLOGY](../examination/SCORING_METHODOLOGY.md) §5.2).

## 2. Result screen — Tryout (`/tryout/sesi/:id/hasil`)

| # | Block | Content | Source field |
|---|---|---|---|
| 1 | Header | date, session mode and package name — **no config badge** | session + `packageBinding` |
| 2 | Total | "**{total.earned} dari {total.possible} poin**", with `answeredCount`, `correctCount` | `ScoreResult.total` |
| 3 | Per test | three cards TWK/TIU/TKP: the point bar ([DESIGN_SYSTEM](./DESIGN_SYSTEM.md) §9) over the test's roster questions, then points; accuracy for TWK/TIU, points only for TKP | `byTest`, `byQuestion` |
| 4 | **Kekuatan & kelemahan per submateri** | the session's own reportable cells, each with metric, `n`, and "belum cukup data" for the rest | `byCompetency` |
| 5 | **Rekomendasi** | up to 3 ranked weaknesses with their evidence summary, each with "Baca materi" (approved material or draft notice) and "Latih ini" | recommendations contract |
| 6 | Ambang batas | only if `thresholds.mode !== 'none'`: mode word, each configured threshold with the verdict; `noticeRequired` → notice card. Otherwise the no-verdict sentence of §1 | `thresholds` |
| 7 | Persetujuan | if `approval` present: "Disetujui {approvedByUserAt}" + the acknowledged warnings as text | `approval` |
| 8 | Per soal | collapsible; one **block** per roster question (answered or not), paginated — see §2.1 and §2.2 | `byQuestion`, E78 |
| 9 | Next | "Lihat perkembangan" → `/progres`; "Coba lagi" → `/tryout` | — |
| 10 | Delete | "Hapus riwayat sesi ini" → consequences dialog (§5.1) | `GET /sessions/:id/deletion-impact` |

### 2.1 Per-question pagination (Tinjau jawaban)

**Product Owner decision 2026-11-09.** The per-question review is paginated so each question's block
has room to read; the review is not one long list.

| Rule | Value |
|---|---|
| Questions per page | **5 questions**, fixed |
| Pages | `ceil(questions / 5)`, where `questions` = the session's roster size (`byQuestion.length`) |
| Last page | holds the remainder — a 17-question session gives pages 1–5, 6–10, 11–15, 16–17 |
| Numbering | continuous across pages: page 2 starts at question 6. The number is the roster position, never a count of answered questions |
| Navigation | prev/next plus the page position ("n / total"), present only when `questions > 5` |
| Page change | returns the view to the review heading; triggers **no request** other than the batch §2.2 describes, and a revisited page does not re-request it |

This is a **presentation rule only**. It changes no session length, package roster, TWK/TIU/TKP
distribution, score, threshold, answer state or explanation content. A session with 17 questions stays
a 17-question session and produces a 17-block review; the UI shows five of those blocks at a time.

**Where paging happens — frontend.** `ScoreResult.byQuestion` is returned whole by
`GET /sessions/:id/result` ([API_SPECIFICATION](../backend/API_SPECIFICATION.md) §5): one row per
roster question, no paging parameters, and it is already on the client for the total, `byTest` summary
and analytics. Pagination is view state over that array; every result route gains no `page`/`limit`
parameter. The content the block also needs (§2.2) is requested **per page**, not per session: the
question-content route takes the five `questionId`s of the page being shown. A server-paged
`ScoreResult` would split one contract object across requests for no payload benefit at CPNS roster
sizes and would put paging policy in the API — rejected as a new architecture with no documented basis.

### 2.2 Per-question block (Product Owner decision 2026-11-09)

The Tinjau jawaban table no longer carries a **Jawabanmu** or a **Keterangan** column. Each question is
one block, and every piece of answer and evaluation information sits inside it. The header columns are
**No · Bidang · Poin** only.

**Content order — fixed.** A block renders these parts in this sequence, and omits a part only where
the rules below say so:

| # | Part | Source | Rendered as |
|---|---|---|---|
| 1 | Question identity: number and **Bidang** | `byQuestion[].test`, roster position | "No. 6 — **TIU**". Bidang is the test only (`TWK` / `TIU` / `TKP`); a competency **id** is never rendered ([DESIGN_SYSTEM](./DESIGN_SYSTEM.md) §10) and a competency **label** is not part of this block |
| 2 | Question text | content route (§2.2.2), frozen snapshot | the stem, plus the asset when the question carries one (`alt` text required) |
| 3 | Your answer | `byQuestion[].selected` + the frozen option text | "**Jawabanmu:** Pilihan B — {option text}", or "**Jawabanmu:** Tidak dijawab" when `selected === null` |
| 4 | Status | `byQuestion[].correct`, `earned`, `maxScore` | see the status table below |
| 5 | Correct answer | content route, **TWK/TIU only, and only when `correct === false`** | "**Jawaban yang benar:** Pilihan B — {option text}" |
| 6 | Explanation | E78, **only when its version equals the frozen version** (§2.2.3) | "**Pembahasan:**" followed by the explanation text, or the §2.2.3.1 notice |

**Parts that never render.** Part 5 is absent when the answer is correct (§2.2.1 rule 3), when the
question is unanswered, and for **every** TKP question — TKP has no keyed answer
([SCORING_METHODOLOGY](../examination/SCORING_METHODOLOGY.md) §4). Part 6 is absent only when the
question carries no explanation or the content route cannot supply one (§2.2.3).

**Status — text, icon and colour.** Status is never colour alone ([FRONTEND_ACCESSIBILITY](./FRONTEND_ACCESSIBILITY.md)).
Every status has a word, an icon and a semantic tone; the tone is the DESIGN_SYSTEM `--success` /
`--danger` / `--lavender` token, never a new colour.

| Question state | Status | Icon | Tone |
|---|---|---|---|
| TWK/TIU `correct === true` | **Benar** | ✓ check | `--success` |
| TWK/TIU `correct === false` | **Salah** | ✗ cross | `--danger` |
| TWK/TIU `selected === null` | **Tidak dijawab** | — dash | neutral |
| TKP, answered (`selected !== null`) | **Dijawab · nilai {earned} dari {maxScore}** + badge **Pencapaian** | ● filled dot | `--lavender` (badge), no `--danger`/`--success` on the row |
| TKP, unanswered | **Tidak dijawab · nilai {earned} dari {maxScore}** + badge **Pencapaian** | — dash | neutral |

**TKP is never "Benar" or "Salah".** `correct` is always `null` for TKP
([BUSINESS_RULES](../backend/BUSINESS_RULES.md) BR-S2) and the app renders no correctness word for it:
its metric is attainment, not accuracy ([SCORING_METHODOLOGY](../examination/SCORING_METHODOLOGY.md) §9).
`--danger` is never used on a TKP option ([DESIGN_SYSTEM](./DESIGN_SYSTEM.md) §4).

The **Poin** column shows `{earned} dari {maxScore}` verbatim, for every test, as before; no number is
formatted, rounded or re-derived ([FRONTEND_DATA_CONTRACTS](./FRONTEND_DATA_CONTRACTS.md) §1).

#### 2.2.1 Evaluation rules

1. **Status and points come from `ScoreResult`.** They are read verbatim from `byQuestion[].correct`,
   `earned` and `maxScore`.
2. **The correct answer is shown from the session's own key, not derived in the UI.** For TWK/TIU the
   keyed option is the option whose `optionScores` value equals `maxScore`
   ([SCORING_METHODOLOGY](../examination/SCORING_METHODOLOGY.md) §2.2, §3.1). The content route sends the
   key as a field; the UI never finds it by comparing weights
   ([FRONTEND_DATA_CONTRACTS](./FRONTEND_DATA_CONTRACTS.md) §1, BR-X2). Where an answer key carries more
   than one option at `maxScore` (possible only for a TKP key, §3.2 there), there is no single keyed
   option and part 5 does not apply.
3. **No redundant correction.** When the answer is correct, part 5 is not shown: "Jawabanmu" already
   names the keyed option.
4. **Unanswered TWK/TIU** shows the key when the frozen key has one: the block then teaches what the
   answer would have been. Its status stays **Tidak dijawab** — a blank is never rendered as wrong or
   as correct ([SCORING_METHODOLOGY](../examination/SCORING_METHODOLOGY.md) §3.3).
5. **TKP.** Part 5 never appears. The block shows, after the status (part 4, extended — see §2.2.1.1):
   every option with its weight, ordered by weight descending, the chosen option marked, and each
   option's own justification.

##### 2.2.1.1 TKP option table

against the status line (part 4), not a second evaluation:

| Column | Source | Rule |
|---|---|---|
| Opsi | frozen options (content route) | option key and text, as shown in the runner |
| Nilai | `answerKey.optionScores`, frozen (content route) | the weight, verbatim |
| Alasan | `optionJustifications` from the content route — frozen (`frozen`) or, when the frozen key has none, latest (`latest`) | the justification for that option, per `justificationsSource` |

Rules:

- **Every option is listed**, highest weight first; ties keep the question's own option order. There is
  no "the best option" row to single out: every option whose weight equals `maxScore` is marked as
  attaining the maximum (some TKP items legitimately have more than one, §3.2 there).
- The **chosen option is marked on its row** (e.g. "Dipilih", plus the same mark in the status line),
  so the user can see what was chosen and what it earned without scanning.
- A TKP item's weights come from the config's `tkpWeightRange`; the UI never assumes the range is 1–5
  and never recomputes the total.
- The UI never states that a higher weight is objectively "correct" and a lower one "wrong"; the
  explanation says why one behaviour is more appropriate, the weights quantify it.
- **Missing justifications** (a question whose frozen key predates §1.2 of
  [QUESTION_SPECIFICATION](../examination/QUESTION_SPECIFICATION.md) and whose later key carries none
  either) leave the Alasan cell empty and the block states: "Alasan per opsi belum tersedia untuk soal
  ini." Every option and every weight still render, because they were scored. The row is never filled
  with the explanation text or with invented reasoning, and no historical key is treated as if it
  already met V-13 — completeness is required for a **new** question to be activated, not a fact about
  old data (R-B, T-03).
- A TKP option is never rendered in `--danger`.

#### 2.2.2 Where the content comes from

Part 2 (stem and options from the snapshot) and part 5 (the key the session was scored with) come from
the **question-content route** `GET /sessions/:id/questions?ids=…`
([API_SPECIFICATION](../backend/API_SPECIFICATION.md) §7.7), which reads the session snapshot. Part 3's
option text comes from the same snapshot; part 6 (explanation) comes from the same response but only
when it passes the version check of §2.2.3; the TKP justifications come from that snapshot key when it
carries them, else from the latest. Parts 3's status/points and part 4 come from `ScoreResult` already
on the client. The `?ids=` batch is the **approved** E78 contract (Product Owner, 2026-11-09):
1–20 roster ids, one request per five-question page.

The block renders a loading shape for one request, and a per-question fallback when the response omits
a question or reports it missing (§7.7 there): the identity, answer, status, correct answer and points still render
from `ScoreResult`, and the block says the question content is unavailable. The review never blocks on
this request, and the score above it is never affected.

#### 2.2.3 When the explanation is shown — strict version matching

**Product Owner decision 2026-11-09:** an explanation is shown **only when its version is exactly the
frozen version of the question the session scored** — strict equality of `latestContentVersion` and
`frozenContentVersion`. There is no "close enough" rule, no AI relevance check and no manual
compatibility judgement; each of those was rejected.

| Condition | Block behaviour |
|---|---|
| `latestContentVersion === frozenContentVersion` and an explanation exists | part 6 renders, labelled **Pembahasan:** |
| Versions differ (the question was edited after the session) | **the explanation is not shown.** Part 6 is replaced by the not-available notice of §2.2.3.1 — never by the older or the newer text |
| `explanationSource === 'none'` | same notice; the part is never silently dropped |

The identity of "the version an explanation belongs to" and the mechanism by which that identity is
compared at read time are **UNRESOLVED — TECHNICAL DESIGN REQUIRED** ([API_SPECIFICATION](../backend/API_SPECIFICATION.md)
§7.7.1 E78-T2/T4); the product behaviour above is decided.

##### 2.2.3.1 Explanation not available

When part 6 cannot be shown, the block states it plainly and keeps everything else:

> "Pembahasan untuk soal ini belum tersedia."

- The status, the points, the key and the TKP table still render.
- The block never falls back to an explanation of a different version.
- **Latihan link.** When the question's competency has material with a valid relation and available
  stock, the notice offers a link to the Latihan screen for that submateri. When the relation is absent or
  cannot be resolved, **no link is rendered** — the UI never invents a destination
  (R-B, T-02). Whether the material-resolution link belongs to this notice at all, and its final copy,
  are **UNRESOLVED — PO DECISION REQUIRED** (T-02: relation resolution still unproven).

#### 2.2.4 Residual risks

The Product Owner decisions above close the behavioural side of R-A, R-B and R-C; what remains is technical.
| # | Risk | Where it shows | Status |
|---|---|---|---|
| R-A | Explanation and frozen question could be shown together while describing different versions | §2.2.3 | **RESOLVED (behaviour, PO 2026-11-09)** — strict version matching; a mismatch hides the explanation. Remaining: **UNRESOLVED — TECHNICAL DESIGN REQUIRED** for the version-identity mechanism (E78-T4) |
| R-B | A TKP key with no justifications (older data) | Alasan cells empty + one sentence | **RESOLVED (behaviour, PO 2026-11-09)** — every option and weight render, the absence is stated, nothing is invented. Latihan-link resolution: **UNRESOLVED — TECHNICAL DESIGN REQUIRED** (T-02) |
| R-C | A correct TWK/TIU answer whose re-keyed question would show a different answer's explanation | §2.2.3 | **RESOLVED** by the same rule as R-A: a re-key bumps the version, so the explanation is hidden |

### Per-question identity and disclosure

**Explanations after the session ends.** Every block shows its explanation, on whichever page that
block is shown (§2.1), and only after the session is submitted (§4). An AI-origin question keeps its
badge in the block. The key, the explanation and the per-option weights are withheld until submit
([API_SPECIFICATION](../backend/API_SPECIFICATION.md) §7.6, §7.7).

**One rendering rule per requirement (AC list).** These are the block's acceptance checks; they restate
nothing new, they pin what §2.2 already says.

| # | Check |
|---|---|
| AC-01 | The summary table has no **Jawabanmu** and no **Keterangan** column; one **Poin** column remains, beside No. and Bidang |
| AC-02 | Each question renders as one block in the fixed order: identity (No. + TWK/TIU/TKP) → stem → participant answer → status → correct answer → explanation |
| AC-03 | The status is present as a word **and** an icon **and** a semantic tone — never colour alone |
| AC-04 | "Jawaban yang benar" appears only for a **wrong** TWK/TIU answer; never for TKP, never for a correct or unanswered one |
| AC-05 | TKP never renders Benar/Salah and never uses `--danger`; its status is "Dijawab · nilai {earned} dari {maxScore}" (or "Tidak dijawab · …") with the **Pencapaian** badge |
| AC-06 | Every TKP option is listed with its weight; any option at the maximum weight is marked; the chosen option is marked **Dipilih** |
| AC-07 | Each listed TKP option carries its own reasoning; a key without reasoning shows the sentence "Alasan per opsi belum tersedia untuk soal ini." and nothing invented |
| AC-08 | At most **5** blocks per page; numbering is continuous across pages |
| AC-09 | After submit, the explanation renders on whatever page its block is on — no paging state hides it; when its version differs from the frozen one it is **not** rendered and the §2.2.3.1 notice is |
| AC-10 | An explanation is rendered only with strict version equality; on any mismatch the block shows "Pembahasan untuk soal ini belum tersedia." and never a different version's text |
| AC-11 | No number on the block is computed client-side: points, weights and status all come from the E78 response |
| AC-12 | Every id in a page request belongs to this session's roster; the block never presents another session's question, and a refused request renders the block as unavailable rather than substituting content |
| AC-13 | When the explanation is unavailable, a Latihan link is offered only for a resolved material relation; otherwise no link is rendered |

Contrast of every status and cell text is §2 of [FRONTEND_ACCESSIBILITY](./FRONTEND_ACCESSIBILITY.md)
(4.5:1).

## 3. Where a verdict may not be shown

| Condition | Rendering |
|---|---|
| `verdict === null` and no thresholds carried | "Konfigurasi ini belum menetapkan ambang batas, jadi **belum ada penilaian ambang batas**." Score and analysis still render |
| `verdict === null` because approval is missing/invalid | The §1 no-verdict sentence, plus (in a muted disclosure) which bound value changed |
| `thresholds.noticeRequired === true` | Verdict shown **with** the config `notice` beside it |
| `via HISTORICAL` basis | Verdict is labelled "menurut aturan arsip {year}", never as the current cycle |

A missing verdict is **never** rendered as "belum lulus", a red badge, a zeroed bar or an empty slot.

## 4. Explanations and disclosure

- **Tryout**: the key, the explanation and the per-option weights are **withheld until the session is
  submitted**, then available in the per-question block of this screen (§2.2)
  ([FRONTEND_EXAM_FLOW](./FRONTEND_EXAM_FLOW.md) §9).
- **Latihan**: shown immediately after each answer, in the runner.
- The API enforces this: a tryout session's runner payload carries no key and no explanation, and
  `POST /sessions/:id/answer-feedback` refuses with `409 tryout_no_feedback`
  ([API_SPECIFICATION](../backend/API_SPECIFICATION.md) §7.6). The session question-content route
  exists only for a session that has been submitted (§7.7).

## 5. Blocked or verdict-less states

### 5.1 Session submitted, no verdict (the normal case today)

| Element | Content |
|---|---|
| Score | rendered in full (§2 blocks 2–5) — nothing is hidden |
| Note | "**Ambang batas kelulusan CPNS 2026 belum terverifikasi.** Skor di atas tetap berlaku." |
| Disclosure | when an approval exists but drifted: which of the four bound values changed, in words ("dasar hukum berbeda", "ambang batas berubah") — never a hash |
| Approval on record | when an `approval` is present, "Disetujui {approvedByUserAt}" plus its `acknowledgedWarnings` as text (§2 block 7); the drift disclosure above is separate and says *what changed*, the warnings say *what was accepted* |
| Action | "Buka Konfigurasi Ujian" → `/lainnya/ujian` (Kelola). Not required to read the result |

### 5.2 Nothing scored (true block)

Reached only for `PREFLIGHT_FAILED` (422), `THRESHOLD_CONFIG_INVALID` (409) or `REGULATORY_*` (409).

| Element | Content |
|---|---|
| Banner | "**Sesi ini tersimpan, tetapi belum bisa dinilai.** Jawabanmu aman." |
| Reason | one sentence from the code, in words |
| Action | "Coba nilai lagi" → `POST /sessions/:id/score` |

The UI never edits answers on this path — the session is submitted and frozen
([DATABASE_SCHEMA](../backend/DATABASE_SCHEMA.md) session state machine).

### 5.3 Deleting this session

The delete dialog states, in plain Indonesian: the result leaves history and analysis and the app
cannot restore it; any trend, consistency or weakness using this session changes or disappears; the
question's empirical difficulty may revert to "belum cukup data"; other sessions are unaffected; a
backup taken earlier may still contain the pre-deletion database; a content-free record that a session
existed is retained ([ANALYTICS_ENGINE](../backend/ANALYTICS_ENGINE.md) §7.6).

The dialog **never** says the data is “gone permanently” or “erased”. The MVP operation is a user
deletion that leaves a content-free tombstone; physical purge is unresolved and not implemented
(§7.7 there).

## 6. Progres (`/progres`)

All numbers from **one** `GET /analytics` call. **No config selector is offered**, and no config badge is
rendered anywhere on this screen.

| # | Block | Content | Field |
|---|---|---|---|
| 1 | Comparability note | only when `comparability.mixed`: "Data ini mencampur {n} versi aturan — tidak dibandingkan satu sama lain." No ids, no badges | `comparability` |
| 2 | Per test | three cards: metric word (Akurasi / Pencapaian), percent + counts, sample badge, median time | `perTest`, `responseTime` |
| 3 | Per submateri | grouped by test then domain (`parentId`), leaf rows: percent + counts + session count | `perCompetency` |
| 4 | Kesulitan | two tabs: *Sulit menurut penulis soal* (`difficulty`) and *Sulit menurut pengalamanmu* (`empiricalDifficulty`); each cell with its own sample badge; a cell without data reads "belum cukup data" | `difficulty`, `empiricalDifficulty` |
| 5 | Konsistensi | per submateri where reportable: spread and direction | `consistency` |
| 6 | Cakupan materi | attempted/available per submateri with the percent | `coverage` |
| 7 | Waktu respons | median overall and per submateri, always with the answer count | `responseTime` |
| 8 | Titik lemah | the ranked list **as returned by `GET /recommendations/weaknesses`** — the frontend never sorts | recommendations contract |
| 9 | Belum cukup data | a separate, quieter list with `n` and what is missing ("butuh ≥3 sesi") | `perCompetency`, `trends` |
| 10 | Tren | per submateri where `state === 'reportable'`; otherwise "Butuh {n} sesi lagi" | `trends` |
| 11 | Riwayat dihapus | when `history.deletedSessionCount > 0`: "{n} riwayat dihapus — analisis hanya dari data yang tersisa." | `history` |
| 12 | Urutan belajar | the ordered weakness list with the AI-written reason for the order, rendered inline; **no link to a separate plan screen** (none exists in MVP) | recommendations contract |

**Ranking rule.** The backend ranks; the UI renders the received order. Sorting client-side by `percent`
would be a re-implementation of the deficit metric and is forbidden by BR-X2.

**Small-sample rule.** Every cross-session statement needs ≥ 3 comparable sessions
([ANALYTICS_ENGINE](../backend/ANALYTICS_ENGINE.md) §3.4). Below that the block says how many more are
needed, never a direction.

## 7. Detail submateri (`/progres/kompetensi/:id`)

| Element | Content |
|---|---|
| Title | taxonomy `label.id` of the node (leaf or domain); **never the id** |
| Metric | percent + `numerator/denominator`, `answeredCount`, `sessionCount` |
| Children | child rows from `perCompetency` |
| Kesulitan | the two difficulty breakdowns for this node |
| Konsistensi & tren | only where reportable, with the counts |
| Cakupan | attempted/available |
| Waktu | median per question with n |
| Materi | approved materials for this node, each opening in Materi |
| Action | "Latih submateri ini" → drill |

## 8. Learning sequence — no standalone plan screen

There is **no Rencana Belajar screen and no `/progres/paket` route** in MVP: the feature is not approved
([MVP_SCOPE](../product/MVP_SCOPE.md) §2). The learning sequence renders inline on the result screen and
in block 12 of Progres: the deterministic order of weaknesses plus the AI-written reason for that order.

The previously specified proposal-diff plan UI (material, drill target, estimated effort, apply/dismiss,
"bukti dihapus" labelling) is **withdrawn from the MVP contract** and recorded as an unapproved proposal in
[SYSTEM_REVISION_REPORT](../audit/SYSTEM_REVISION_REPORT.md) §8. Do not build it without an explicit
Product Owner decision.

## 9. Sample-size discipline (non-negotiable)

1. `insufficient_data` is **never** described as weak, poor, low or failed. It says "Belum cukup data".
2. No weakness claim without `answeredCount ≥ 5` — enforced by the backend state, rendered by the UI.
3. Every metric shows `sessionCount`; aggregates below 3 sessions say "butuh ≥3 sesi".
4. No LLM text is generated on the frontend; recommendation narratives are rendered from the validated
   contract payload, labelled as AI-written when present
   ([RECOMMENDATION_ENGINE](../ai/RECOMMENDATION_ENGINE.md) §6).
5. No config id, config state or scoring version is rendered in the learner area. A result's exact rule
   set remains readable from the result payload; the UI does not surface it as a negotiation.
