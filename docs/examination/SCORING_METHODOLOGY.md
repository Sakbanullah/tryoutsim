# Scoring Methodology

Canonical source for **how answers become scores**. Exam rules, thresholds, config states and
evidence tiers live in [CPNS_2026_REGULATIONS.md](./CPNS_2026_REGULATIONS.md); this file defines the
computation and its determinism guarantees.

Question metadata and lifecycle: [QUESTION_SPECIFICATION.md](./QUESTION_SPECIFICATION.md).
Metrics computed *from* scores: [ANALYTICS_ENGINE.md](../backend/ANALYTICS_ENGINE.md).

---

## 1. Invariants

1. **Deterministic.** Given the same snapshot and the same answers, the result is identical, always.
   No clocks, no randomness, no network.
2. **Pure.** `scoreSession(...)` has no side effects. Timestamps never reach it (§8).
3. **Per-question data, not per-type branches.** Every question type is scored by the same function;
   what differs is the data in its answer key (§3).
4. **Never assumes one correct answer.** There is no `correctOption`. There is a map of option →
   score, plus a score for "no answer".
5. **Immutable once written.** A score result stores the snapshot version and the approval reference
   it used (§7, §11). Later edits never change past results.
6. **No silent defaults.** A missing score, a missing key, a missing sheet, or a missing metadata row
   is an error, never a zero.
7. **Two phases — with ordered checks inside pre-flight.** Pre-flight validates the session *as a
   whole* (§6) and may reject it. Its checks are ordered so that a check never throws on input an
   earlier check already rejected (§6.3). Scoring (§4) then runs only on already-validated input.
8. **The snapshot is the single source of truth.** Scoring reads question versions, answer keys,
   metadata, taxonomy version, config version, scoring version, thresholds and the approval from the
   frozen snapshot — never from the live question bank, key table, or config (§7). This is what makes
   invariant 5 hold.
9. **Scoring and analytics are separate.** Scoring produces points and counts. Metrics (§9) are
   computed from scores downstream and never feed back into them.
10. **Score and verdict are separate outputs.** A session is always scored; a threshold verdict is
    emitted only when the snapshot carries thresholds *and* a valid approval (§5.6, §11). No verdict
    is ever fabricated as `false`.
11. **A blank never earns credit.** `unansweredScore = 0` for every shipped config; a blank is not a
    correct answer and is excluded from the accuracy denominator (§3.3).

---

## 2. Data shapes

### 2.1 Question metadata — explicit, never parsed from IDs

`test` and `competencyId` are **first-class fields** of the question record
([QUESTION_SPECIFICATION.md](./QUESTION_SPECIFICATION.md) §1). Nothing in the scoring engine may
split a `questionId` string, infer a test prefix, or regex a competency path. IDs are opaque.

```ts
type QuestionMeta = {
  questionId: string;                   // opaque
  test: 'TWK' | 'TIU' | 'TKP';          // explicit
  competencyId: string;                 // explicit leaf id, from COMPETENCY_TAXONOMY.md
};
```

Validation of that metadata (pre-flight §6 PF-07):
`test` is one of the three literals; `competencyId` resolves to an existing, non-deprecated **leaf**
node in the taxonomy version the session was started under, whose own `test` equals `test`. Because
each leaf belongs to exactly one test, every `byCompetency` bucket is single-test.

### 2.2 Answer key, answer sheet, buckets, result

```ts
type AnswerKey = {
  questionId: string;
  scoringVersion: number;                   // rules that produced these weights
  optionScores: Record<string, number>;     // "A".."E" -> weight
  unansweredScore: number;                  // score for blank / timed out
  maxScore: number;                         // stored; SC-03 checks it, scorer never recomputes
};

type AnswerSheet = {
  questionId: string;
  selected: string | null;                  // null = unanswered
  answeredAt?: string;                      // analytics only, never scoring
};

// A bucket carries the points AND the counts analytics needs, so analytics never re-scores.
type Bucket = {
  earned: number;
  possible: number;
  answeredCount: number;   // questions with selected !== null
  correctCount: number;    // TWK/TIU: earned === maxScore; TKP: 0 and unused (§9)
};

type ScoreResult = {
  sessionId: string;
  configId: string;                         // = the session's config at snapshot time
  configVersion: number;                    //                   "
  scoringVersion: number;                   //                   "
  snapshotVersion: string;                  // §7 — the only reference the session needs
  approval?: ScoreApprovalRef;              // §11 — present iff a provisional verdict was authorized
  total: Bucket;
  byTest: Record<'TWK' | 'TIU' | 'TKP', Bucket>;
  byCompetency: Record<string, Bucket>;     // leaf competency id -> bucket (single-test, §2.1)
  byQuestion: Array<{
    questionId: string;
    test: 'TWK' | 'TIU' | 'TKP';
    competencyId: string;
    earned: number;
    maxScore: number;
    selected: string | null;                // null = unanswered
    correct: boolean | null;                // TWK/TIU: earned === maxScore; blank or TKP: null
  }>;
  thresholds: ThresholdEvaluation;          // §5
};

// The approval record that authorized this result: identity + all four bound values, verbatim.
// ScoreResult already carries configId/configVersion/scoringVersion from the same snapshot, so this
// block is redundant by design — a result must be verifiable without re-reading anything else
// (invariant 5). Longest-error evidence: APPROVAL_INVALID.changed[] names which bound value drifted.
type ScoreApprovalRef = ProvisionalApproval;

// Canonical identifier for the wire/storage representation. API_SPECIFICATION.md §5, the frontend
// contracts and `score_result` all use exactly this shape; there is no second ScoreResult type.
type SessionScoreResult = ScoreResult & {
  bucketUnit: 'points';                     // every number in every Bucket is a raw point count
};
```

**One `ScoreResult`, three representations, one shape.** The pure function returns `ScoreResult`;
the immutable stored row (`DATABASE_SCHEMA.md` §2) and the HTTP payload (`API_SPECIFICATION.md` §5)
both round-trip exactly that object. There is no adapter boundary and no second field vocabulary:
`byTest` (not `sections`), `byQuestion` (not `perQuestion`), `maxScore` and `selected` per question
(not `possible`), `thresholds: ThresholdEvaluation` (§5.4, not `naik*`).

**Identity and provenance are separate.** `configId`/`configVersion`/`scoringVersion` answer *which
rule set produced this number*; `snapshotVersion` plus `approval` answer *which frozen inputs the
user authorized*. A session is partitioned by the first and audited by the second — it never needs a
value copied out of the config table to be understandable later.

`possible` is the sum of each question's `maxScore`, accumulated in the same pass as `earned`.
`answeredCount` and `correctCount` are accumulated in that same pass, so analytics never has to
reconstruct "answered" or "correct" from points. `correctCount` for TKP is always `0`; the TKP metric
is score attainment, not accuracy (§9).

The **keyed answer** for TWK/TIU is the option whose weight equals `maxScore`; `correct` is therefore
`selected !== null && earned === maxScore`. An unanswered TWK/TIU question has `correct: null` (not
`false`) so analytics never counts a blank as a mistake. For TKP there is no keyed answer, so
`correct` is `null` in `byQuestion` and `correctCount` is `0` in every TKP bucket.

`optionScores` is the **only** place correctness is expressed. That is what makes TKP (no single
correct answer) the same code path as TWK/TIU (one correct answer worth 5, four worth 0).

---

## 3. Answer key shapes by test

### 3.1 TWK and TIU

One option worth the full per-question maximum, the other four worth 0:

```ts
// B is the keyed answer
{ optionScores: { A: 0, B: 5, C: 0, D: 0, E: 0 }, unansweredScore: 0, maxScore: 5 }
```

The scorer does not know this shape; SC-04 (§6.1) enforces it.

### 3.2 TKP

Every option carries its own weight; there is no single correct answer.

```ts
{ optionScores: { A: 5, B: 4, C: 2, D: 1, E: 1 }, unansweredScore: 0, maxScore: 5 }
```

Rules:

- All five options must carry a weight. A partial key is invalid (SC-01).
- Weights need not be distinct; ties are allowed. There is **no** requirement that weights differ —
  an all-equal key is a defensible authoring decision, not a scoring error (see §6.1 note).
- The range comes from the config (`rules.tkpWeightRange`), not from code.
- The weights above are one valid key among many; §10.2 works a different valid key on the same
  range. Neither example is a rule — SC-05 checks only that every weight is inside
  `tkpWeightRange` and at least one equals `perQuestionMax.TKP`.

**Evidence status of the range.** Two instruments have been read in full:

| Instrument | Pathway | Diktum | TKP range | Tier |
|---|---|---|---|---|
| Kepmen PANRB 321/2024 | **CPNS 2024** | KETUJUH | lowest 1, highest 5, blank 0 | `HISTORICAL` |
| Kepmen PANRB 406/2026 | **Sekolah Kedinasan** TA 2026 | KELIMA | lowest 1, highest 5, blank 0 | `VERIFIED-2026` for that pathway only |

The shipped **CPNS 2026** config carries `tkpWeightRange = [1, 5]` as a **provisional value
(UNV-03)**, carried forward from the 2024 CPNS instrument. It is *not* claimed as a CPNS 2026 rule.
406/2026 is cited only as corroboration that the 1–5 scheme was still in use in the 2026 assessment
year for a different pathway — never as the source of a CPNS rule
([CPNS_2026_REGULATIONS.md](./CPNS_2026_REGULATIONS.md) §2.3, §8 rule 5). A CPNS-2026 instrument that
differs changes the config number; no code branch moves.

### 3.3 Blank, skip, timeout

- Flagging ("tandai") does not change the answer.
- Unanswered → `selected: null` → `unansweredScore`.
- **A blank answer can never earn credit**: `unansweredScoreBounds.min ≥ 0` and `unansweredRule: 'zero'`
  for every shipped config (SC-06, SC-07). A blank is never counted as correct and never enters the
  accuracy denominator ([ANALYTICS_ENGINE.md](../backend/ANALYTICS_ENGINE.md) §2.1).
- Submitting with blanks is allowed. The confirmation screen states how many remain before the submit is
  confirmed ([FRONTEND_EXAM_FLOW.md](../frontend/FRONTEND_EXAM_FLOW.md) §7); the blanks then score exactly
  as blanks under `unansweredScore`.
- Auto-submit at expiry scores every unanswered question identically — no penalty, no bonus, no
  partial credit.
- `selected` is always one of the question's rendered option keys; PF-04 rejects anything else.

---

## 4. Computation

```ts
function scoreQuestion(key: AnswerKey, sheet: AnswerSheet, scoringVersion: number): number {
  // Inputs are pre-flighted (§6). These remain as defence in depth.
  if (key.scoringVersion !== scoringVersion) throw new Error('SCORING_VERSION_MISMATCH');
  if (sheet.selected === null) return key.unansweredScore;
  const s = key.optionScores[sheet.selected];
  if (s === undefined) throw new Error('NO_SCORE_FOR_OPTION');
  return s;
}

function scoreSession(input: PreflightedSession): ScoreResult {
  const { session, snapshot, sheets } = input;          // §6.4
  const roster = snapshot.questions;                    // snapshot, not live bank
  const keys = snapshot.answerKeysById;                 // frozen keys, not live table

  const total: Bucket   = { earned: 0, possible: 0, answeredCount: 0, correctCount: 0 };
  const byTest = {
    TWK: { earned: 0, possible: 0, answeredCount: 0, correctCount: 0 },
    TIU: { earned: 0, possible: 0, answeredCount: 0, correctCount: 0 },
    TKP: { earned: 0, possible: 0, answeredCount: 0, correctCount: 0 },
  };
  const byCompetency: Record<string, Bucket> = {};
  const byQuestion = [];

  for (const q of roster) {                            // snapshot order, not sheet order
    const key = keys.get(q.questionId)!;               // PF-06 guaranteed presence
    const sheet = sheets.get(q.questionId)!;           // PF-01/02/03 guaranteed presence
    const earned = scoreQuestion(key, sheet, snapshot.scoringVersion);
    const correct = q.test === 'TKP' ? null
                  : sheet.selected === null ? null       // unanswered — distinct from wrong
                  : earned === key.maxScore;

    total.earned += earned;
    total.possible += key.maxScore;
    if (sheet.selected !== null) total.answeredCount += 1;
    if (correct === true) total.correctCount += 1;

    byTest[q.test].earned += earned;
    byTest[q.test].possible += key.maxScore;
    if (sheet.selected !== null) byTest[q.test].answeredCount += 1;
    if (correct === true) byTest[q.test].correctCount += 1;

    const comp = (byCompetency[q.competencyId] ??=
      { earned: 0, possible: 0, answeredCount: 0, correctCount: 0 });
    comp.earned += earned;
    comp.possible += key.maxScore;
    if (sheet.selected !== null) comp.answeredCount += 1;
    if (correct === true) comp.correctCount += 1;

    byQuestion.push({ questionId: q.questionId, test: q.test, competencyId: q.competencyId,
                      earned, maxScore: key.maxScore, selected: sheet.selected, correct });
  }

  return {
    sessionId: session.id,
    configId: snapshot.configId,
    configVersion: snapshot.configVersion,
    scoringVersion: snapshot.scoringVersion,
    snapshotVersion: snapshot.snapshotVersion,
    approval: snapshot.provisionalApproval,
      // copied verbatim; non-provisional scorings leave this undefined
    total, byTest, byCompetency, byQuestion,
    thresholds: evaluateThresholds(byTest, total, snapshot.thresholds),
  };
}
```

Notes that matter:

- `snapshot` carries `configId`, `configVersion`, `scoringVersion`, `thresholds`, and the answer keys
  (§7). **`config` is never read from any mutable/live source** — it cannot be undefined because it is
  a field of the frozen snapshot, not a separately-passed argument.
- Iteration is over **`snapshot.questions`**, the authoritative roster — not over submitted answers.
  Every session question therefore contributes exactly one `byQuestion` row, answered or not, and no
  question is counted twice (roster IDs are unique by PF-00).
- `byCompetency` is initialised before use (`??=`) and keyed by the **explicit** `q.competencyId`
  (§2.1). There is no `undefined += n` path.
- Summation is over integers in a fixed order. No floating point anywhere in scoring.
- The `!` assertions are sound because pre-flight guarantees them; the guards in `scoreQuestion` stay
  so that a future caller that skips pre-flight fails loudly instead of producing `NaN`.

---

## 5. Thresholds

```ts
type ScoringRules = {
  scoringVersion: number;
  tkpWeightRange: [number, number];
  perQuestionMax: { TWK: number; TIU: number; TKP: number };
  unansweredScoreBounds: { min: number; max: number };  // SC-06 (was unpacked under old numbering)
  unansweredRule: 'zero' | 'custom';                    // SC-07
};

type ThresholdSet = {
  mode: 'per_subtest_and_total' | 'per_subtest_only' | 'total_only' | 'none';
  TWK?: number;          // = the NAB for that subtest, in points
  TIU?: number;
  TKP?: number;
  total?: number;        // = the *cumulative* NAB, in points (see note)
  source: BasisRef;      // tier + pathway + year of the basis that produced these numbers
};
```

**`total` is the cumulative NAB — and nothing else.** The instruments express the special-track
threshold as a *cumulative* minimum plus a TIU minimum (321/2024 KELIMA BELAS 311 + TIU 85;
KEENAM BELAS 286 + TIU 60; 406/2026 KESEPULUH 281 + TIU 55). That cumulative minimum is exactly
`total` under `mode: 'total_only'` or `'per_subtest_and_total'`, with `TIU` set to the TIU minimum. A
threshold set therefore **never needs a `naikTotal`/`naikTiu` or `affirmation*` field**: those words
describe *which instrument clause* a number came from, which is what `source` (a `BasisRef`) already
records. `mode: 'none'` means what it says: the config states no threshold and no verdict is
produced — including any config whose applicable clause cannot be established (see §5.5).

Note that the instruments' cumulative minimum is **not** the arithmetic sum of their per-subtest
figures: 321/2024 KEENAM BELAS is 286 while 65 + 80 + 166 = 311; 406/2026 KESEPULUH is 281 while
65 + 80 + 156 = 301. The cumulative stop is taken independently of the sub-test stops and is
slightly lenient, not contradictory. Never validate one against the other.

### 5.1 Required fields per mode — enforced, not implied

| `mode` | Required present | Must be absent | Per-field rule |
|---|---|---|---|
| `per_subtest_and_total` | `TWK`, `TIU`, `TKP`, `total` | — | each ≥ 0 |
| `per_subtest_only` | `TWK`, `TIU`, `TKP` | `total` | each ≥ 0 |
| `total_only` | `total` | `TWK`, `TIU`, `TKP` | ≥ 0 |
| `none` | none | all four | — |

A missing required value, or a present-but-forbidden value, is a **configuration error**
(`THRESHOLD_CONFIG_INVALID`). It blocks the config from becoming scoreable. It is never treated as a
pass, an absence, or `0`.

### 5.2 Comparison operator — explicit

The comparison is **`>=`** (greater than or equal to), applied per field:

| Mode | Pass condition |
|---|---|
| `per_subtest_and_total` | `byTest.TWK.earned >= TWK` **and** `byTest.TIU.earned >= TIU` **and** `byTest.TKP.earned >= TKP` **and** `total.earned >= total` |
| `per_subtest_only` | the three subtest comparisons, `and`-ed |
| `total_only` | `total.earned >= total` |
| `none` | not evaluated |

`>=` is chosen because the instruments define NAB as "nilai minimal yang harus dipenuhi"
([CPNS_2026_REGULATIONS.md](./CPNS_2026_REGULATIONS.md) §2.3, Kepmen 321/2024 Diktum **KESEBELAS**;
406/2026 Diktum **KETUJUH**) — a minimum that *must be met*, i.e. meeting it qualifies. Exactly-on-threshold
passes. The real recruitment then ranks among qualifiers (Pasal 31(5)–(7) of Permen PANRB 6/2024);
this app only reproduces qualification, never the ranking cut.

Integers only, so `>=` is unambiguous — no float tolerance needed or permitted.

### 5.3 Value constraints — validated, not assumed (PF-09)

Every present threshold field must be a **finite integer**, `0 ≤ value ≤ ceiling[field]`.

```ts
// The instrument's stated maximum for the subtest — NOT the roster. A tournament roster is
// deliberately shorter than the real exam; capping at it would reject a real NAB as out of range.
const CEILING_POINTS = { TWK: 150, TIU: 175, TKP: 225 };   // 321/2024 KEDELAPAN = 406/2026 KEENAM

ceiling[field]     = CEILING_POINTS[field] * perQuestionMax[field] / 5
ceiling.total      = ceiling.TWK + ceiling.TIU + ceiling.TKP
```

`CEILING_POINTS` is a product constant whose values are canonical in
[CPNS_2026_REGULATIONS.md](./CPNS_2026_REGULATIONS.md) §2.3; this file only names it. When a
CPNS-2026 instrument states a different maximum, the constant changes with that config — no code
branch moves, because every shipped max is expressed against `perQuestionMax = 5`.

A non-integer (`NaN`, `Infinity`, fractional) is `THRESHOLD_NOT_INTEGER`; a value above the field's
ceiling is `THRESHOLD_EXCEEDS_MAX`. Both block scoring exactly like `THRESHOLD_CONFIG_INVALID`.
Neither bound depends on how many questions a particular session happens to contain, so a practice
drill carrying the full NAB is valid by construction.

### 5.4 Result of evaluation

```ts
type ThresholdEvaluation =
  | { mode: 'none' }
  | { mode: 'total_only' | 'per_subtest_only' | 'per_subtest_and_total';
      passed: boolean;
      passesBySubtest?: { TWK: boolean; TIU: boolean; TKP: boolean };
      basisTier: EvidenceTier;
      basisPathway?: 'CPNS' | 'SEKOLAH_KEDINASAN';
      noticeRequired: boolean };   // true whenever tier !== 'VERIFIED-2026' for this pathway
```

A threshold set whose basis is not `VERIFIED-2026` **for the config's own pathway** may drive a
verdict only under a **valid `provisional` approval** ([CPNS_2026_REGULATIONS.md](./CPNS_2026_REGULATIONS.md)
§4.3). For a `CPNS` config, a `Sekolah Kedinasan` basis is corroboration, not authority, so it keeps
`noticeRequired: true` even when its own-pathway tier is `VERIFIED-2026`. The result view renders the
config `notice`. Values and provenance live there (§2.3) and are not restated here.

### 5.6 A session is always scored; a verdict is conditional

Two separate outputs, never merged:

| Output | Requires | Absent when |
|---|---|---|
| **Score** — `total`, `byTest`, `byCompetency`, `byQuestion`, counts | the snapshot only | never — a started session always produces a score |
| **Verdict** — `passed` against a `ThresholdSet` | `mode ≠ 'none'` **and** a valid approval (§11) | no thresholds carried, or the approval is invalid |

Consequences, which every consumer must honour:

1. A provisional config with `mode: 'none'` (the shipped default) is **startable and scorable**; its
   result carries `thresholds: { mode: 'none' }` and the result screen says no passing threshold is
   verified for CPNS 2026 ([CPNS_2026_REGULATIONS.md](./CPNS_2026_REGULATIONS.md) §4.2).
2. A `ThresholdSet` present but unapproved (or approved against other bound values) yields
   **no `passed` field** — not `false`. Absence of a verdict is not a failure verdict.
3. Analytics never depends on a verdict (§9); a config change can therefore never invalidate a
   historical comparison of scores, only the meaning of a verdict.

Tie-break order (TKP → TIU → TWK, Pasal 31(6)–(7)) is reproduced only as explanatory copy when the
user compares two sessions against the same threshold. It never changes `passed`.

### 5.5 Which NAB clause a session is scored against

`ThresholdSet` holds **one** clause. The instruments do not publish a single NAB: 321/2024
KEDUA BELAS applies to penetapan kebutuhan umum and kebutuhan khusus Kalimantan, while KEEMPAT BELAS
excludes five categories (cumlaude, diaspora, disabilitas, Papua, Daerah Tertinggal) that KELIMA
BELAS and KEENAM BELAS then re-threshold. `ThresholdSet` carries no `formasi`/exemption selector,
and the app is not tied to a `formasi`, so:

- **Which clause a CPNS 2026 drill should use is not established by this documentation.** It is
  recorded as a product decision for the owner (see `docs/audit/AUDIT_FINDINGS_RESOLUTION.md`), not
  silently chosen here.
- Until the owner decides, a threshold set spanning clauses may not be shipped. The honest default
  is `mode: 'none'` with `noticeRequired` copy — the app reports the user's earned points per
  subtest, correctness counts, and attainment, and says explicitly it does not render a pass verdict
  because the applicable NAB clause is uncertain. A verdict is still available to a user who
  approves a provisional config that names the clause in `source.scope`.

The value field never changes shape depending on the answer. Only `mode` does.

---

## 6. Pre-flight validation

Runs before scoring, on the assembled session. **Any failure aborts scoring** — no partial result, no
zero-filled rows. This is the only place cross-question invariants are enforced.

```ts
type PreflightInput = {
  snapshot: SessionSnapshot;    // §7 — the frozen snapshot actually used, source of truth
  sheets: AnswerSheet[];        // the only live input: what the user submitted
  taxonomy: TaxonomyRegistry;   // resolved for snapshot.taxonomyVersion, read-only
};

type PreflightError = { code: string; questionId?: string };

function preflight(input: PreflightInput):
  | { ok: true; result: PreflightedSession }
  | { ok: false; errors: PreflightError[] };
```

The snapshot — not `snapshotVersion`, not the live config — is the input. Question roster, answer
keys, metadata, config version, scoring version, thresholds and approval all come *from* the snapshot.
The live question bank, key table and config are never consulted. `PreflightedSession` (below) is the
pre-flight output and is itself frozen: scoring receives it and does no further lookup.

All checks run and **all** failures are collected, ordered by `(questionId || '', code)`, so the
message the user sees is stable and complete rather than one-at-a-time.

| ID | Check | Error code |
|---|---|---|
| PF-00 | Roster is non-empty **and** its `questionId`s are unique. | `EMPTY_ROSTER` / `DUPLICATE_ROSTER_QUESTION_ID` |
| PF-01 | Each roster question has exactly one `AnswerSheet`. | `SHEET_COUNT_MISMATCH` |
| PF-02 | No duplicate `questionId` among sheets. | `DUPLICATE_QUESTION_ID` |
| PF-03 | No sheet whose `questionId` is outside the snapshot roster. | `SHEET_NOT_IN_SESSION` |
| PF-04 | `selected` is `null` or one of that question's frozen `optionKeys`. | `INVALID_OPTION_SELECTED` |
| PF-05 | Each roster question has exactly one `AnswerKey` in the snapshot; no duplicate, no orphan key. | `KEY_COUNT_MISMATCH` / `DUPLICATE_QUESTION_ID` / `ORPHAN_ANSWER_KEY` |
| PF-06 | Every key's `scoringVersion` equals `snapshot.scoringVersion`, all identical. | `SCORING_VERSION_MISMATCH` |
| PF-07 | Every question's `test` is a valid literal; `competencyId` is a non-deprecated leaf in `snapshot.taxonomyVersion` whose `test` matches. | `INVALID_TEST` / `UNKNOWN_COMPETENCY` / `COMPETENCY_TEST_MISMATCH` / `DEPRECATED_COMPETENCY` |
| PF-08 | Every key satisfies SC-01…SC-08 (§6.1). | the failing `SC-xx` code |
| PF-09 | Threshold set satisfies §5.1 and §5.3; a non-`VERIFIED-2026`-for-pathway basis is permitted only when `snapshot.state` is `provisional` (§6.7). Carrying no thresholds (`mode: 'none'`) is always valid. | `THRESHOLD_CONFIG_INVALID` / `THRESHOLD_NOT_INTEGER` / `THRESHOLD_EXCEEDS_MAX` / `THRESHOLDS_REQUIRE_APPROVAL` |
| PF-10 | Snapshot is internally complete and is the source of everything scored: sheets/keys/metadata resolve to it, and it binds config, rules, thresholds and approval (§6.5). | `SNAPSHOT_MISSING` / `SNAPSHOT_INCOMPLETE` / `SNAPSHOT_MISMATCH` |
| PF-11 | Config rule fields are valid (§6.6): `scoringVersion`, `tkpWeightRange`, `unansweredScoreBounds`, `perQuestionMax`. | `CONFIG_SCORING_VERSION_INVALID` / `CONFIG_WEIGHT_RANGE_INVALID` / `CONFIG_UNANSWERED_BOUNDS_INVALID` / `CONFIG_PER_QUESTION_MAX_INVALID` |
| PF-12 | Regulatory scope: every `BasisRef` matches the config's `pathway` and `examYear`, and no `Sekolah Kedinasan` instrument is treated as a `VERIFIED-2026` CPNS basis (§6.7). | `REGULATORY_PATHWAY_MISMATCH` / `REGULATORY_YEAR_MISMATCH` / `REGULATORY_SCOPE_UNVERIFIED` |
| PF-13 | Approval integrity: when `thresholds.mode !== 'none'`, the snapshot carries a valid `provisionalApproval` matching its bound `configVersion`/`scoringVersion`/`regulatoryBasisHash` (§11). A failure withholds the **verdict**, not the score (§5.6). | `APPROVAL_MISSING` / `APPROVAL_INVALID` / `APPROVAL_VERSION_MISMATCH` |

PF-00 and PF-01/PF-03/PF-05 together give "one question counted exactly once": the roster is unique
(PF-00), sheet IDs match it bijectively (PF-01 + PF-02 + PF-03), and key IDs match it bijectively
(PF-05). A missing or extra *sheet* is an invalid state to be rejected — not an unanswered question,
never a silent zero.

### 6.1 Answer-key rules SC-01…SC-08

Checked against the config frozen in the snapshot.

| ID | Applies to | Rule | Error code |
|---|---|---|---|
| SC-01 | all | `optionScores` keys **set-equal** the five frozen option keys A–E: no missing, no extra. | `KEY_OPTION_SET_MISMATCH` |
| SC-02 | all | every weight is a finite integer, `0 ≤ w ≤ perQuestionMax[test]`. | `WEIGHT_NOT_INTEGER` / `WEIGHT_OUT_OF_RANGE` |
| SC-03 | all | `maxScore === max(optionScores)` and `maxScore === perQuestionMax[test]`. | `MAX_SCORE_MISMATCH` |
| SC-04 | TWK/TIU | exactly one option has weight `perQuestionMax[test]`; the other four are `0`. | `TWK_TIU_KEY_SHAPE` |
| SC-05 | TKP | all five weights lie in `tkpWeightRange`; at least one equals `perQuestionMax.TKP`. | `TKP_WEIGHT_OUT_OF_RANGE` / `TKP_NO_MAX_WEIGHT` |
| SC-06 | all | `unansweredScore` is a finite integer, `unansweredScoreBounds.min ≤ u ≤ unansweredScoreBounds.max`, and within `[0, perQuestionMax[test]]`. | `UNANSWERED_SCORE_INVALID` |
| SC-07 | all | `unansweredScore` is consistent with `unansweredRule`: when it is `'zero'`, `unansweredScore` must be `0`. | `UNANSWERED_SCORE_INCONSISTENT` |
| SC-08 | all | key `scoringVersion` equals the snapshot's `scoringVersion`. | `SCORING_VERSION_MISMATCH` |

Rationale for the gaps this closes:

- A negative or fractional `unansweredScore` would make blank answers *profitable* or produce float
  drift; SC-06 forbids both.
- SC-07 is separate from SC-06 because bounds alone cannot express "the config says blank = 0"; the
  config's own declaration (`unansweredRule`) is the constraint.
- **Deliberately not a validation rule: "a TKP key must have at least two distinct weights."** An
  all-equal TKP key can still be legitimate — if every option is equally acceptable, every option
  deserving the same point value is a defensible authoring decision. Rejecting it would be a scoring
  opinion with no regulatory basis. Authoring quality of that kind belongs to the question review
  stage, not to scoring. (An earlier draft numbered this SC-06 and then removed it; the numbering
  above is contiguous, so there is no reserved slot.)
- TWK/TIU and TKP use the same option-set rule (SC-01), so no test is a special case for shape.

### 6.2 Worked pre-flight cases

Examples use `snapshot` shorthand: `Q1(TWK, TWK.INTEGRITAS)` means a snapshot question whose
`test`/`competencyId` are those values and whose frozen `optionKeys` are `["A","B","C","D","E"]`.

**Passing.** 2 questions, `scoringVersion 1`, `perQuestionMax = {TWK:5, TIU:5, TKP:5}`,
`unansweredRule: 'zero'`.

```
snapshot.questions = [Q1(TWK, TWK.INTEGRITAS), Q2(TKP, TKP.PELAYANAN_PUBLIK)]
snapshot.answerKeys = [{Q1, v1, {A:0,B:5,C:0,D:0,E:0}, u:0, max:5},
                       {Q2, v1, {A:5,B:4,C:2,D:1,E:1}, u:0, max:5}]
sheets              = [{Q1, "B"}, {Q2, null}]
```
→ PF-00…PF-13 pass; SC-01…SC-08 pass. Score: Q1 = 5 (correct), Q2 = 0 (blank, unanswered).
`total = {earned:5, possible:10, answeredCount:1, correctCount:1}`,
`byTest.TWK = {5,5,1,1}`, `byTest.TKP = {0,5,0,0}`, `byTest.TIU = {0,0,0,0}`.

**Failing — roster defects collected together.**

```
snapshot.questions = []                          // empty
sheets  = [{Q1, "B"}, {Q1, "C"}, {Q3, "A"}]      // Q1 twice, Q3 not in (empty) roster
```
```
errors:
  PF-00 EMPTY_ROSTER                        (no roster)
  PF-00 DUPLICATE_ROSTER_QUESTION_ID        (if roster were [Q1,Q1] — shown for completeness)
  PF-02 DUPLICATE_QUESTION_ID      Q1
  PF-03 SHEET_NOT_IN_SESSION       Q3
```
Scoring does not run.

**Failing — key and rule defects.**

```
snapshot.questions = [Q1(TWK, TWK.INTEGRITAS)]
snapshot.scoringVersion = 1
sheets  = [{Q1, "B"}]
snapshot.answerKeys = [{Q1, v2, {A:0,B:5,C:0,D:0}, u:0, max:5}]  // version 2, D/E missing
```
```
errors (sorted by questionId, then code):
  PF-06 SCORING_VERSION_MISMATCH            Q1  (v2 vs snapshot version 1)
  SC-01 KEY_OPTION_SET_MISMATCH             Q1  (options D and E missing)
  SC-08 SCORING_VERSION_MISMATCH            Q1  (same key-version defect, reported per-rule)
```
PF-08 reports each failing SC rule; the same underlying defect (wrong `scoringVersion`) is expressed
by both PF-06 (cross-question) and SC-08 (per-key) because they test different scopes, and both are
kept so a key that passes SC-08 but arrives under a divergent snapshot is still caught by PF-06.

**One origin per code, three checks.** `SCORING_VERSION_MISMATCH` has exactly one producer:
`PF-06`/`SC-08` inside pre-flight, reported once per question. The `throw` in `scoreQuestion` (§4) is
**not** a second origin — it is unreachable defence in depth, because scoring runs only after every
pre-flight check passes (§6.3) and PF-06/SC-08 would already have produced the report. It cannot fire
on a legitimately pre-flighted session, so there is no third code path a caller has to handle; the
only surface that can ever carry this code is `PREFLIGHT_FAILED.errors[]`
([API_SPECIFICATION](../backend/API_SPECIFICATION.md) §4.1).

**Failing — thresholds.** Throughout these pre-flight examples `snapshot.state` is `'provisional'` (the
only state in which a non-`VERIFIED-2026`-for-pathway basis can reach PF-09 at all), and `snapshot` is
otherwise a well-formed session snapshot as in §7. `mode: 'per_subtest_and_total'` with `total` missing →
`THRESHOLD_CONFIG_INVALID`. `TWK: 65.5` → `THRESHOLD_NOT_INTEGER`. `total: 999` on a 10-question
roster → `THRESHOLD_EXCEEDS_MAX` (999 > 550 ceiling; the roster size is irrelevant, §5.3). A
non-`VERIFIED-2026`-for-pathway threshold basis with `snapshot.state !== 'provisional'` →
`THRESHOLDS_REQUIRE_APPROVAL`. PF-09 runs before PF-13, so this is a **block**: the session is not scored,
not a withheld verdict. The registry classifies it with `THRESHOLD_CONFIG_INVALID`
([API_SPECIFICATION](../backend/API_SPECIFICATION.md) §4).

**Failing — config rule fields.** `tkpWeightRange = [5, 1]` → `CONFIG_WEIGHT_RANGE_INVALID`;
`unansweredScoreBounds = {min: 3, max: 1}` → `CONFIG_UNANSWERED_BOUNDS_INVALID`;
`perQuestionMax.TWK = 0` → `CONFIG_PER_QUESTION_MAX_INVALID`; `scoringVersion = 1.5` →
`CONFIG_SCORING_VERSION_INVALID`.

**Failing — unanswered score.** `unansweredScore: -1` → `UNANSWERED_SCORE_INVALID` (SC-06).
`unansweredScore: 2` with `unansweredRule: 'zero'` → `UNANSWERED_SCORE_INCONSISTENT` (SC-07).

The user sees one "sesi tidak dapat dinilai" screen listing all rows. Nothing is scored.

### 6.3 Order and dependency between checks

Pre-flight checks are ordered so that no check throws on input an earlier check rejects:

1. **PF-00** establishes that the roster exists and its IDs are unique — the object later checks map
   over.
2. **PF-01 / PF-02 / PF-03** build the `questionId → AnswerSheet` projection and verify it is a
   bijection with the roster.
3. **PF-05** builds `questionId → AnswerKey` from the snapshot and verifies bijection with the roster.
4. **PF-06 … PF-08** run per key. A question whose key or sheet is already reported missing is
   **skipped** here rather than looked up (which would `undefined`-throw): its absence is already one
   error, and re-reporting it under every dependent rule would bury the real code.
5. **PF-09 / PF-11 / PF-12 / PF-13** are roster- and config-level and depend only on the snapshot.
6. **PF-10** is the integrity seal: it re-checks that sheets, keys and metadata are projections of
   this snapshot, so nothing upstream was read from a different, newer snapshot.

Each check reports its own code and continues. The `!` non-null assertions in `scoreSession` are valid
only because scoring runs **after** every check passes — a check that fails never reaches scoring.

### 6.4 The pre-flighted session (frozen output)

```ts
type PreflightedSession = {
  session: { id: string; snapshotVersion: string };
  snapshot: SessionSnapshot;              // frozen, the single source (§7)
  sheets: Map<string, AnswerSheet>;       // built by PF-01..03, keyed by questionId
};
```

Scoring (§4) reads `snapshot.*` and `sheets` only. It never re-resolves anything and has no reference
to the live bank, key table, or config. `snapshot.answerKeysById` and `snapshot.questions` are the
roster and keys; `snapshot.scoringVersion`, `snapshot.thresholds`, `snapshot.configId`,
`snapshot.configVersion` satisfy the computation's `config` needs without a mutable `config`.

### 6.5 What PF-10 binds (snapshot integrity)

PF-10 asserts the snapshot is the whole story:

- the snapshot is present (`SNAPSHOT_MISSING`) and every field §7 requires is present and non-null
  (`SNAPSHOT_INCOMPLETE`): `configId`, `configVersion`, `scoringVersion`, `taxonomyVersion`,
  `scoringRules`, `thresholds` (unless `mode === 'none'`), `questions`, `answerKeys`;
- `snapshot.questions` IDs are unique and exactly equal `snapshot.answerKeys` IDs (bijection);
- the sheets, keys and metadata handed to scoring resolve to **this** snapshot, not a different/newer
  one (`SNAPSHOT_MISMATCH`) — i.e. the input carries no data the snapshot does not.

### 6.6 Config rule-field validation (PF-11)

The `ScoringRules` frozen in the snapshot must itself be sound before any key is checked against it:

| Field | Rule | Error code |
|---|---|---|
| `scoringVersion` | finite positive integer | `CONFIG_SCORING_VERSION_INVALID` |
| `tkpWeightRange` | `[min, max]` finite integers, `min ≤ max` | `CONFIG_WEIGHT_RANGE_INVALID` |
| `unansweredScoreBounds` | `min ≤ max`, both finite integers | `CONFIG_UNANSWERED_BOUNDS_INVALID` |
| `perQuestionMax` | each of TWK/TIU/TKP a finite positive integer | `CONFIG_PER_QUESTION_MAX_INVALID` |

### 6.7 Regulatory scope validation (PF-12)

A `VERIFIED-2026` tier is **not sufficient** on its own. Every `BasisRef` (the config's
`regulatoryBasis`) must be checked against the snapshot's `pathway` and `examYear`
([CPNS_2026_REGULATIONS.md](./CPNS_2026_REGULATIONS.md) §4.1):

- A basis carrying `tier: 'VERIFIED-2026'` must have `pathway === snapshot.pathway` **and**
  `examYear === snapshot.examYear` — otherwise `REGULATORY_PATHWAY_MISMATCH` /
  `REGULATORY_YEAR_MISMATCH`.
- Kepmen PANRB 406/2026 has `pathway: 'SEKOLAH_KEDINASAN'`. In a `CPNS` config it may appear **only** as
  `EVIDENCE-BACKED-NOT-CPNS-2026` (corroboration), never as `VERIFIED-2026` authority for a CPNS
  field. A CPNS config that carries it as `VERIFIED-2026` → `REGULATORY_PATHWAY_MISMATCH`.
- A basis whose document scope / instrument ID cannot establish CPNS applicability for the config's
  cycle keeps its field `UNVERIFIED` → the config stays `provisional` and `REGULATORY_SCOPE_UNVERIFIED`
  blocks any verdict; the session is still scored (§5.6), and approval is required **only** to emit the
  verdict.

A CPNS-2026 threshold that has no matching CPNS instrument therefore remains `provisional`
([CPNS_2026_REGULATIONS.md](./CPNS_2026_REGULATIONS.md) §4.4) and its verdict requires approval — PF-12
enforces the pathway/scope boundary, PF-13 enforces the approval that follows from it.

---

## 7. Immutability: session snapshots

A scored result must never change because the bank, the key table, or the config changed afterwards.

**Rule.** A session freezes its inputs at start into a `SessionSnapshot`, and scoring reads **only**
that snapshot.

```ts
type SessionSnapshot = {
  snapshotVersion: string;   // e.g. "s1-2026-11-07T10:00:00Z-<contentHash8>"

  // Config identity and rules, frozen
  configId: string;
  configVersion: number;
  scoringVersion: number;
  examYear: number;
  pathway: 'CPNS' | 'SEKOLAH_KEDINASAN';
  state: 'official_verified' | 'historical' | 'provisional';
  scoringRules: ScoringRules;                 // §5 — frozen, includes ranges and perQuestionMax
  thresholds?: ThresholdSet;                  // undefined iff mode === 'none'
  regulatoryBasisHash: string;                // hash of the ordered BasisRef[] used
  provisionalApproval?: ProvisionalApproval;  // §11 — frozen copy, present iff required and valid

  // Session assembly, frozen (PACKAGE_SPECIFICATION.md §5)
  packageBinding: {
    packageId: string;
    packageVersion: number;
    mode: 'tryout' | 'latihan';
    kind: 'full_simulation' | 'subtest' | 'submateri';
    rosterHash: string;                       // sha256 over ordered questionIds
  };
  roster: {
    repeatCount: number;                      // items already answered before this session
    attemptedBefore: number;                  // how many roster items were seen at least once
  };

  // Timing, frozen — recorded, never scored (§8)
  timing: {
    mode: 'accumulated_active';               // §8.1
    durationMs: number | null;                // the length the session was started with; null = unset
    activeMsAtStart: number;                  // always 0 for a new session
    autoSubmitOnExpiry: boolean;              // true when durationMs is set
  };

  // Question content and keys, frozen
  taxonomyVersion: string;
  questions: Array<{
    questionId: string;
    questionVersion: number;          // QUESTION_SPECIFICATION.md §1 contentVersion
    contentHash: string;
    test: 'TWK' | 'TIU' | 'TKP';
    competencyId: string;
    optionKeys: string[];             // frozen rendered options, used by PF-04
  }>;
  answerKeys: AnswerKey[];            // frozen copies, not references
  answerKeysById: Map<string, AnswerKey>;  // derived projection for O(1) scoring
};
```

- **At session start** the server resolves every question to its current `questionVersion`, copies the
  `AnswerKey`, the `ScoringRules`, the `ThresholdSet`, and (when applicable) the `provisionalApproval`
  into the snapshot, and records `snapshotVersion` on the session.
- **Scoring always reads the snapshot**, never the live bank, key table, or config. `answerKeysById`
  is a projection of `answerKeys`; `config`, `configVersion`, `scoringVersion`, and `thresholds` are
  read from this struct, so the value the computation needs is always defined and immutable.
- **Editing a question, a key, or the config** creates a new version for *future* sessions. It does
  not touch existing snapshots.
- **Deleting/archiving** a question removes it from selection, not from snapshots. An archived question
  still scores correctly in the session that used it.
- `ScoreResult.snapshotVersion` is stored, so a result can always be re-derived byte-identically.
- Snapshots are never garbage-collected while a session referencing them exists.
- **The package binding is part of the snapshot** so a session's roster and the package version that
  produced it can always be read back together — a later package version never describes an earlier
  session ([PACKAGE_SPECIFICATION.md](../product/PACKAGE_SPECIFICATION.md) §5).

**Approval validity is bound into the snapshot, not read live.** `provisionalApproval` is a copy taken
at snapshot time. PF-13 checks it against the snapshot's own `configVersion`/`scoringVersion`/
`regulatoryBasisHash` — so the snapshot protects both question correctness *and* which rule set the
user actually authorized (§11). A snapshot **without** an approval is still scorable: it yields a score
and no threshold verdict (§5.6).

**Re-scoring** is permitted only by re-running scoring on the **same** snapshot. The app never
re-scores an old session under a new snapshot.

### 7.1 History: immutable, and the one way it leaves

A finished result is **immutable**: no edit, no config change and no re-approval alters it.

The user may **delete history** — a session, or a range of sessions — as an explicit act. This is the
only path by which a stored result stops existing, and its mechanics are owned by
[ANALYTICS_ENGINE.md](../backend/ANALYTICS_ENGINE.md) §7. What scoring guarantees:

1. Deletion removes the session, its answers, its result **and** its snapshot together; a half-deleted
   session is never observable.
2. Nothing derived is recomputed from a deleted session; analytics are derived-on-read
   ([ANALYTICS_ENGINE.md](../backend/ANALYTICS_ENGINE.md) §7.3), so a deleted session simply stops
   contributing.
3. A `session_deletion` tombstone is kept (id, mode, dates, counts — no answers, no stem text) so an
   empty analytics panel can say *why* it is empty instead of looking like a bug. **The tombstone is not a
   permanent purge**: physical erasure is unresolved
   ([ANALYTICS_ENGINE.md](../backend/ANALYTICS_ENGINE.md) §7.7).
4. No background process ever deletes a session.

---

## 8. Determinism and timestamps

- `answeredAt` is never read by scoring. It is copied into the result only if a debug view requests it.
- Counting thresholds, totals and buckets involve integers only. No `Math.round`, no `toFixed`, no
  percentages in `ScoreResult`.
- Given the same `SessionSnapshot` and answer sheets, `scoreSession` is a pure function — a property
  test asserting `scoreSession(x)` deep-equals `scoreSession(x)` belongs in the backend test suite when
  the backend is built.

### 8.1 Session timing — accumulated active time

**Duration is accumulated active time, not calendar time.** Closing the browser, switching tabs or a
crash must not consume the learner's time.

```ts
type SessionClock = {
  mode: 'accumulated_active';
  durationMs: number | null;   // null = no countdown
  activeMs: number;            // accumulated only while the session is "active"
  runningSince: string | null; // set while active; null while paused
};
```

Rules:

1. **Active** means the runner is open and the session is not paused. `activeMs` grows only between
   `runningSince` and "now" while active.
2. **Leaving pauses.** Navigating away, closing the tab or closing the app pauses the clock: the
   server's answer-save call (or the last heartbeat) stores `activeMs` and clears `runningSince`.
   Autosave and the clock update in the same request, so an answer is never saved without its time.
3. **Returning resumes.** Opening an `open` session resumes it: `runningSince` is set again and
   `activeMs` continues from the stored value.
4. **Expiry is checked on resume, not on a wall clock.** When `durationMs` is set and
   `activeMs ≥ durationMs` on resume, the session is on expiry: the server marks it expired and
   submits it with the answers already saved. The client never decides this — a client cannot outlive
   a reload and a client clock is untrusted.
5. **Submit before expiry is always allowed**; the accumulated time is recorded on the result as
   evidence (`ScoreResult.timing`), never as a scoring input.
6. **`durationMs = null`** means the session has no countdown (Latihan always; a config with no asserted
   duration). The runner then shows elapsed active time, and states that there is no time limit.
7. **The timer never changes how answers score.** Two sessions with identical answers and snapshots
   score identically whether the first finished in 10 minutes and the second in 90 (invariant 2).
8. **Response time** (per-question, for analytics) is recorded per answer from the same clock; it is an
   analytics join, never a scoring field ([ANALYTICS_ENGINE.md](../backend/ANALYTICS_ENGINE.md) §1).

---

## 9. Metrics derived from scores (pointer, not definition)

Scoring stops at `earned` / `possible` / `answeredCount` / `correctCount` per bucket. **How** a bucket
becomes a percentage depends on the test, and that rule is canonical in
[ANALYTICS_ENGINE.md](../backend/ANALYTICS_ENGINE.md):

| Test | Metric | Numerator / denominator (all available on `ScoreResult`) |
|---|---|---|
| TWK | accuracy | `correctCount / answeredCount` |
| TIU | accuracy | `correctCount / answeredCount` |
| TKP | score attainment | `earned / possible` |

`ScoreResult` cannot produce TWK/TIU accuracy from points alone; that is exactly why it now carries
`correctCount` and `answeredCount` on every bucket, and `correct`/`selected` per question (§2.2).
Analytics uses those counts directly and never recomputes "correct" from `earned`. For TKP,
`correctCount` is `0` and must not be divided; the metric is attainment. `possible` is the attainment
denominator for **all** tests.

Minimum-sample rules (`answeredCount < N → "belum cukup data"`, distinct from "zero correct"), and
trend computation: canonical in [ANALYTICS_ENGINE.md](../backend/ANALYTICS_ENGINE.md) §3.

---

## 10. Worked examples

### 10.1 TWK, one keyed answer

Key `{A:0, B:5, C:0, D:0, E:0}`, unanswered `0`.

| Answer | Earned | correct |
|---|---|---|
| B | 5 | true |
| A | 0 | false |
| blank | 0 | null (unanswered) |

### 10.2 TKP — minimum-weight option vs blank

Key `{A:5, B:4, C:3, D:2, E:1}`, unanswered `0`, range `[1,5]`. (Different weights from §3.2's
`{A:5, B:4, C:2, D:1, E:1}` on purpose — both are valid; no §3.2 weight set is a rule, SC-05.)

| Answer | Earned | correct |
|---|---|---|
| A | 5 | null (TKP has no keyed answer) |
| E | 1 (worst defensible response — still earns its weight) | null |
| blank | 0 (distinct from choosing E; review shows which was chosen) | null |

### 10.3 Session with mixed tests

10 TWK (max 5) + 10 TIU (max 5) + 10 TKP (max 5). `possible` = 150.

7 TWK correct + 3 TWK wrong; 5 TIU correct + 5 TIU wrong; TKP earning 5,5,4,4,3,3,2,2,1,1 = 30.
All 30 answered.

| Bucket | earned | possible | answeredCount | correctCount |
|---|---|---|---|---|
| TWK | 35 | 50 | 10 | 7 |
| TIU | 25 | 50 | 10 | 5 |
| TKP | 30 | 50 | 10 | 0 |
| total | 90 | 150 | 30 | 12 |

Metrics downstream: TWK accuracy 7/10 = 70 %, TIU 5/10 = 50 %, TKP attainment 30/50 = 60 %.

### 10.4 Time-out mid-session

30 of 110 items answered — a roster sized like the real exam's 110 items rather than the 30-item example
of §10.3; the remaining 80 are `selected: null` → `unansweredScore`. `possible` still
includes them (80 × maxScore), `answeredCount` reflects only the 30, so attainment is honest about the
unanswered mass and accuracy's denominator excludes it. No partial credit.

### 10.5 Threshold evaluation

Config `mode: 'per_subtest_and_total'`, thresholds TWK 60 / TIU 70 / TKP 150 / total 300 — **made-up
round numbers, not any real NAB**; real values live only in
[CPNS_2026_REGULATIONS.md](./CPNS_2026_REGULATIONS.md) §2.3. Assume a roster large enough that each
threshold is at or below its `maxPossible` (PF-09 enforces this). Session earns TWK 70 / TIU 85 /
TKP 170. (The ceiling is the instrument maximum, §5.3 — not the roster: a 60-question drill would
still admit a 550 total.)

Total = 325 ≥ 300 ✓, TWK 70 ≥ 60 ✓, TIU 85 ≥ 70 ✓, TKP 170 ≥ 150 ✓ → `passed: true`. Because the
basis tier is not `VERIFIED-2026` for the CPNS pathway, `noticeRequired: true` and the UI renders the
provisional notice beside the verdict.

---

## 11. Approval integrity

Scoring a **verdict** on a `provisional` config (or any verdict whose threshold basis is not
`VERIFIED-2026` for the pathway, §6.7) requires a valid `ProvisionalApproval`, **bound into the
snapshot**. Scoring a provisional config **without** thresholds needs no approval: the session is
scored and carries no verdict (§5.6).

```ts
type ProvisionalApproval = {
  configId: string;
  configVersion: number;
  scoringVersion: number;
  regulatoryBasisHash: string;   // sha256 over ordered BasisRef[]
  approvedByUserAt: string;
  approvedBy: string;
  acknowledgedWarnings: string[];
};
```

**Canonical definition.** The shape above is defined once, in
[CPNS_2026_REGULATIONS.md](./CPNS_2026_REGULATIONS.md) §4.3; it is repeated here only because §6,
§7 and §11 bind it. `configId` and `approvedByUserAt` are both present and are **not**
interchangeable: `configId` identifies *which configuration record* was approved (two provisional
configs can share a version number), `approvedByUserAt` says *when*. `AGENTS.md` non-negotiable 3,
ADR-004, `BUSINESS_RULES.md` BR-E3, `VALIDATION.md` §2 and `DATABASE_SCHEMA.md` §2 all name the same
four bound values `{configId, configVersion, scoringVersion, regulatoryBasisHash}`; nothing else
binds.

**How the approval reaches pre-flight.** At session start the server copies the approval into
`snapshot.provisionalApproval`. Pre-flight hands the snapshot to PF-13, which checks the approval
against the snapshot's **own** bound values:

| Condition | Effect |
|---|---|
| No approval in snapshot, and `thresholds.mode === 'none'` | **No error.** Session scores; `thresholds: { mode: 'none' }`; no verdict (§5.6) |
| No approval in snapshot, and `thresholds.mode !== 'none'` | `APPROVAL_MISSING` — **the verdict is withheld, the score is kept** |
| Approval present, any bound value differs from the snapshot | `APPROVAL_INVALID` — verdict withheld, score kept |
| Approval present but targets other `configVersion`/`scoringVersion` than the snapshot froze | `APPROVAL_VERSION_MISMATCH` — verdict withheld, score kept |

**Score and verdict are separate outputs (§5.6).** A pre-flight approval failure never discards a score:
the session is submitted, scored from its frozen snapshot, and stored with `verdict: null` plus the
approval error that caused it. The result screen shows the score and states that no passing threshold is
verified for this session's config. `PREFLIGHT_FAILED` (semantic corruption of the snapshot or answer
sheets) remains a hard abort with no result — that is a different failure class and it is unaffected by
this rule.

All four bound values must match the snapshot, not the live config. That is the point: the approval
authorizes the **rule set frozen in this session**, never whatever the config currently is.

**Re-scoring an old session after re-approval — without accidentally using the wrong version.**

| Point | Behaviour |
|---|---|
| Approval lapsed but config unchanged | The user re-approves the **same** `configVersion`/`scoringVersion`/`regulatoryBasisHash`. PF-13 matches the snapshot → `POST /sessions/:id/score` re-runs pre-flight on the **same** snapshot and succeeds, now emitting a verdict. |
| Config edited mid-session (bumped `configVersion` or `scoringVersion`, or basis changed) | The snapshot still froze the **old** values. Re-approving the new config produces an approval for the *new* values → `APPROVAL_VERSION_MISMATCH`. The old session is **permanently verdict-less**, answers and score are preserved, and the user starts a new session under the new snapshot. The app never silently re-scores an old session under a newer rule set. |
| Submit with invalid approval | The session is scored; the `200` result carries `withheld.code` plus `withheld.changed[]` as `{field, approved, current}` for the mismatched bound value(s) — see [API_SPECIFICATION.md](../backend/API_SPECIFICATION.md) §4.2. Answers and score preserved. (In a `200` result there is no `error.details`; `details.changed[]` belongs to the `409 THRESHOLD_CONFIG_INVALID` envelope only.) |
| Precedence when several PF-xx fail at once | See §11.1. |

### 11.1 Error precedence — which code the client sees

Pre-flight collects **all** failures (§6), so one submit can violate several gates. Blocking failures are
ranked first and return an error status carrying exactly one `error.code`; verdict-only outcomes then
appear inside a successful `200` result. Resolution order, first match wins:

1. `REGULATORY_PATHWAY_MISMATCH` / `REGULATORY_YEAR_MISMATCH` / `REGULATORY_SCOPE_UNVERIFIED` (PF-12).
   A config whose scope is wrong is not a config to be re-approved; it must be rebuilt.
2. `THRESHOLD_CONFIG_INVALID` (PF-09) — the threshold block is malformed regardless of approval; a
   genuine block, nothing scored.
3. `PREFLIGHT_FAILED` (422) — every remaining PF-xx/SC-xx failure, listed in full in
   `error.details.errors[]`.
4. **Verdict-only, inside a `200` result** (the score is written first, so these never cost a score):
   `APPROVAL_VERSION_MISMATCH` before `APPROVAL_INVALID` before `APPROVAL_MISSING` (PF-13), because the
   most specific diff is the most actionable. Only one appears in `withheld.code`; the others remain
   visible in `withheld.changed[]` where they apply.

Every failure in the set is still reported inside `details.errors[]` (code + path) even when a
higher-ranked code supplies `error.code`; the ranking decides the HTTP code and the primary UI
surface, never what is hidden. A submit that is both an approval problem and an answer-sheet problem
therefore returns 409 *and* lists the sheet errors, so the user fixes both in one pass.

Codes 1 and 2 are 409 and code 3 is 422. Code 4 is not an error status at all: it travels inside the `200`
result. The stored `score_result.blockedErrorCode` records the ranked **blocking** code (1–3); a
verdict-only code (4) is written to `verdictWithheldJson` and the score is stored in full (§5.6,
[DATABASE_SCHEMA](../backend/DATABASE_SCHEMA.md) §2). For code 3 nothing is written: the answer sheets or
the snapshot are unusable, so there is no score to keep.

`ScoreResult.approval` stores a `ScoreApprovalRef` (§2.2) recording which approval authorized the
verdict: `approvedByUserAt`, `approvedBy`, the `configVersion` it authorized, and its
`regulatoryBasisHash`. Non-provisional scorings leave it absent. The app never silently discards
answers and never re-scores under rules the user did not approve.

---

## 12. Cross-document consistency

This file defines scoring. Do not duplicate any table from here elsewhere; link to these anchors.

| Document | Relationship |
|---|---|
| [CPNS_2026_REGULATIONS.md](./CPNS_2026_REGULATIONS.md) | Exam rules, threshold *values*, evidence tiers, config states, `BasisRef` (with pathway/year), approval record. This file adds the *validation* of those, not new values. |
| [QUESTION_SPECIFICATION.md](./QUESTION_SPECIFICATION.md) §5 | Question lifecycle. Its V-06 delegates key shape to **§6.1** here (SC-01…SC-08); it must not restate SC rules. |
| [PACKAGE_SPECIFICATION.md](../product/PACKAGE_SPECIFICATION.md) | Roster assembly and the repeat rule; this file freezes the result (`packageBinding`, `roster`). Selection is not scoring (§7.1 of that doc, §4.4). |
| [ANALYTICS_ENGINE.md](../backend/ANALYTICS_ENGINE.md) | Consumes `ScoreResult` (`earned`/`possible`/`answeredCount`/`correctCount`); owns accuracy vs attainment, minimum sample, trends, history deletion. |
| [API_SPECIFICATION.md](../backend/API_SPECIFICATION.md) | Error codes `PREFLIGHT_FAILED`, `APPROVAL_INVALID`, `APPROVAL_VERSION_MISMATCH`, `APPROVAL_MISSING`, `THRESHOLD_CONFIG_INVALID` in the error envelope; the `ScoreResult` wire payload (§5). |
| [PRD.md](../product/PRD.md) | FR-A1 (per-test/per-competency **accuracy**, served by `correctCount`/`answeredCount`; **mean response time** is an analytics concern from `AnswerSheet.answeredAt`, not a scoring output), FR-A3 (difficulty analysis), FR-T7 (unscorable session stored, never a fake zero). |