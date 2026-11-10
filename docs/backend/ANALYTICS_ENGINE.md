# Analytics Engine

Canonical source for **how raw scores and timing become the metrics the product shows**. It consumes
`ScoreResult` from [SCORING_METHODOLOGY.md](../examination/SCORING_METHODOLOGY.md) §2.2 and answer-timing
events; it never re-scores and never changes a score.

Related: [SCORING_METHODOLOGY.md](../examination/SCORING_METHODOLOGY.md) §9 ·
[PRD.md](../product/PRD.md) §9.4 (FR-A1…FR-A8) · [QUESTION_SPECIFICATION.md](../examination/QUESTION_SPECIFICATION.md) ·
[PACKAGE_SPECIFICATION.md](../product/PACKAGE_SPECIFICATION.md) §4.

---

## 1. Input contract

| Input | Source | Notes |
|---|---|---|
| `ScoreResult` | scoring output (§2.2) | `total`, `byTest`, `byCompetency`, `byQuestion`, `thresholds`, `snapshotVersion`. Frozen. |
| Answer timing | answer log + `ScoreResult.timing` | `activeMs` per answer ([SCORING_METHODOLOGY](../examination/SCORING_METHODOLOGY.md) §8.1). **Never** a score input. |
| Question difficulty | question table, joined by `questionId` | **two fields**: `difficulty.aiInitial` (authoring) and `difficulty.empirical` (derived, §4). FR-A3 uses `empirical` when reportable, else `aiInitial`. **Not** a scoring field. |
| Practice coverage | session history | distinct questions *attempted at least once* per node (§4.2). |
| History tombstones | `session_deletion` (§7.3) | feeds only the "riwayat dihapus" state; contributes no metric. |

This separation is deliberate: `ScoreResult` is integer-only and timestamp-free; timing and difficulty
are analytics joins, so a scoring change cannot corrupt analytics and vice versa.

## 2. Metrics

### 2.1 Per test

| Test | Metric | Formula | Denominator |
|---|---|---|---|
| TWK | accuracy | `correctCount / answeredCount` | `answeredCount` (excludes unanswered) |
| TIU | accuracy | `correctCount / answeredCount` | `answeredCount` |
| TKP | score attainment | `earned / possible` | `possible` (includes unanswered mass) |

`correct` semantics from [SCORING_METHODOLOGY.md](../examination/SCORING_METHODOLOGY.md) §2.2:
TWK/TIU `true` / `false` / `null` (unanswered); TKP has no keyed answer, so `correct` is `null` in
`byQuestion` and `correctCount` is `0` in every TKP bucket. **A TKP option weighted highest is never
treated as "correct"** — attainment is the only TKP metric.

Both metrics are computable from `ScoreResult` without re-scoring; the frontend renders them and never
recomputes them ([FRONTEND_DATA_CONTRACTS.md](../frontend/FRONTEND_DATA_CONTRACTS.md)).

### 2.2 Per competency

A competency bucket is single-test (guaranteed by PF-07, since each leaf taxonomy node belongs to
exactly one test). The metric therefore follows the test:

| Test | Competency metric |
|---|---|
| TWK / TIU competency | accuracy = `correctCount / answeredCount` |
| TKP competency | attainment = `earned / possible` |

**`perCompetency` carries both leaves and ancestors (ANA-1).** `ScoreResult.byCompetency` is keyed by
leaf only. This engine rolls those buckets up by taxonomy ancestor
([COMPETENCY_TAXONOMY.md](../examination/COMPETENCY_TAXONOMY.md) §2, §7 rule 2) and emits **every**
node — leaf and ancestor — in the `perCompetency` map, because that is what the dashboard (domain
level) and the review screen (leaf level) each need without the frontend recomputing an aggregate.
Ancestor buckets are formed the only way analytics is allowed to form them: by **summing the leaf
buckets** in the set, then applying the test's formula. Ancestor and leaf values are both integers;
an ancestor's `answeredCount` is the sum of its leaves' — never a re-count of the roster.

This roll-up is deterministic and uses no per-question data beyond the buckets, so it is the same
code path whether the set is one session or several.

### 2.3 Mean response time (FR-A1) — reported as a median

Median seconds per answer, derived from the answer log, not from `ScoreResult`:

```
elapsed_i = answeredAt_i − (answeredAt_{i−1} or session.startedAt)
responseTime = median(elapsed_i over all answered questions of the scope)
```

- Only `selected !== null` answers count.
- Scope is per test / per competency / per session, same as the buckets.
- Reported as a median with the answer count, never alone.
- The PRD (FR-A1, MVP_SCOPE §1) says "mean response time". The **statistic is the median**, because
  a single long pause (a phone call, a distraction) would otherwise dominate a 110-item average. The
  PRD wording is the one to update; this file owns the statistic, the frontend renders it, and
  [API_SPECIFICATION.md](./API_SPECIFICATION.md) §1 carries it. The meaning of "MRT" is unchanged.

---

## 3. Sample rules

### 3.1 Minimum sample

A competency or test metric is **reportable** only when `answeredCount ≥ 5`. Below that the metric is
`null` with reason `insufficient_data` and the count is still shown. (The threshold `5` comes from
[PRD.md](../product/PRD.md) FR-D2; it is a product constant, not a regulation.)

### 3.2 "Zero correct" vs "insufficient data" (FR-A4)

These are distinct states and never conflated:

| State | Condition | Display |
|---|---|---|
| `insufficient_data` | `answeredCount < 5` | "Belum cukup data (n=…)" — **not ranked** |
| `zero_correct` | `answeredCount ≥ 5` and `correctCount === 0` (TWK/TIU) | "0 benar dari n soal" |
| `zero_attainment` | `answeredCount ≥ 5` and `earned === 0` (TKP) | "0 poin dari n soal" |

A competency with `n=2, 0 correct` must **never** outrank one with `n=40, 55%` in a weakness list.
Ranking (weakness) is defined in [RECOMMENDATION_ENGINE.md](../ai/RECOMMENDATION_ENGINE.md), and it
excludes `insufficient_data` rows entirely.

### 3.3 Confidence caveat

This is a single-user, small-`n` product. The engine reports a **sample caveat**, not a p-value:
every metric carries its `answeredCount` (and `sessionCount` inline on every cell, not only for trends), and any aggregate
over fewer than 3 sessions is labelled "butuh ≥3 sesi". No claim of statistical significance is made.

### 3.4 What the engine is allowed to conclude

| Data condition | Allowed output |
|---|---|
| 1 session, competency with `answeredCount < 5` | "Belum cukup data (n=…)" — **no strength/weakness label** |
| 1 session, competency with `answeredCount ≥ 5` | per-session strength/weakness **for this session**, labelled as one session's evidence |
| ≥ 3 sessions, same `(configId, configVersion, scoringVersion)` | trend, consistency, cross-session weakness ranking |
| ≥ 3 sessions, mixed versions | each triple reported separately; no combined trend (§5) |

The gate is on **sample size and comparability**, never on a threshold verdict.

---

## 4. Difficulty, coverage, consistency

### 4.1 Difficulty analysis (FR-A3) — two difficulty fields

Accuracy (TWK/TIU) or attainment (TKP), grouped by difficulty within a test, joined from the question
table by `questionId`. A question carries **two** difficulty values
([QUESTION_SPECIFICATION.md](../examination/QUESTION_SPECIFICATION.md) §1.1):

| Field | Source | Used for |
|---|---|---|
| `difficulty.aiInitial` | set at authoring (AI estimate or the user's own choice) | the `byInitialDifficulty` breakdown — what the *authoring* difficulty claimed |
| `difficulty.empirical` | **computed here**, from answers to the question itself | the `byEmpiricalDifficulty` breakdown, and package selection |

**Empirical difficulty.** A question's band is derived from how the user actually answered it, and is
`null` until its own sample is reportable (`answeredCount ≥ 5`, §3.1):

```
empiricalPercent(q) = TKP ? earned/possible : correctCount/answeredCount   // over all answers to q
band  = empiricalPercent ≥ 67 ? 'easy' : empiricalPercent ≥ 34 ? 'medium' : 'hard'
```

- The cut points (`67`, `34`) are a **product constant**, not a regulation and not a claim about real
  exam difficulty. They are recorded here so they are not "reasonable defaults" hidden in code.
- `empirical` is written by the analytics job only; it never rewrites `aiInitial`, and never enters
  scoring.
- A cell with `answeredCount < 5` is `insufficient_data` **under both fields**, so neither breakdown can
  present a small sample as a finding.
- Difficulty is not a scoring input; a difficulty edit later does not re-score the session.

### 4.2 Practice coverage

Per competency (leaf and ancestor), coverage is the share of **distinct active questions in stock** that
the user has attempted at least once:

```ts
type Coverage = {
  attemptedQuestions: number;   // distinct questionIds answered ≥1 time
  availableQuestions: number;   // distinct dynamicEligible active questions for the node
  percent: number | null;       // integer 0..100, null when availableQuestions === 0 or attempted < 5
  state: 'reportable' | 'insufficient_data';
};
```

- Coverage answers "have you *met* this material", separately from "how well did you do". It is shown
  next to the metric and never used to adjust a metric or a score.
- A node with coverage `< 100%` and `insufficient_data` reads *"materi belum tercakup"*, not "weak".
- Coverage is a *stock-dependent* number: adding questions lowers it without any loss of skill. The UI
  must show `attempted/available` counts beside the percent ([FRONTEND_RESULTS_ANALYTICS](../frontend/FRONTEND_RESULTS_ANALYTICS.md) §5).

### 4.3 Consistency

Consistency describes how stable the user's result is **across sessions** for one competency, and is
reported only where a trend is reportable (≥ 3 sessions, same version triple, §5):

```ts
type Consistency = {
  state: 'reportable' | 'insufficient_data';
  spreadPercent: number | null;    // max − min of the per-session metric percent (integers)
  direction: 'stable' | 'improving' | 'declining' | 'mixed';
};
```

- `spreadPercent` is a **range**, not a standard deviation: with a single user and a handful of sessions
  a range is honest and computable in integers.
- `direction` is derived from the ordered series: `improving` when the last value exceeds the first and
  no later value falls below an earlier one by more than the spread; `declining` symmetrically;
  `stable` when `spreadPercent ≤ 10`; otherwise `mixed`.
- Consistency is **never** used to raise or lower a weakness rank by itself; it is presented as evidence
  ([RECOMMENDATION_ENGINE.md](../ai/RECOMMENDATION_ENGINE.md) §2).

### 4.4 Response-time profile

In addition to the median (§2.3), Progres may show a per-submateri response-time median **with its
answer count**, when that cell is reportable. It is presented as context, never as a grading criterion:
a fast wrong answer and a slow right answer are both facts about practice, not about the exam.

---

## 5. Trend analysis (FR-A2) and its limits

A trend is a per-competency series of metric values across sessions, ordered by time.

- Requires `≥ 3` sessions touching the competency; below that: `insufficient_data`, "butuh ≥3 sesi".
- **Comparability gate (FR-A5, US-A4):** only sessions scored under the same `configVersion` **and**
  `scoringVersion` are plotted on one line. The engine issues one `AnalyticsSnapshot` per distinct
  `(configId, configVersion, scoringVersion)` triple present in the set; a request scoped by
  `configId` ([API_ENDPOINTS](./API_ENDPOINTS.md) §6) yields one. When more than one triple is in
  scope, `comparability.mixed === true` and each triple's `sessionCount` is listed — no average is
  ever taken across triples, so an incompatible comparison cannot be produced by accident.
- Trend direction is reported qualitatively ("membaik / menurun / stabil") **with** the session count
  and metric range, never as a guarantee.

---

## 6. Output shape

```ts
// Integer percent + the counts it derives from. Also the `MetricValue` the frontend reads
// (FRONTEND_DATA_CONTRACTS.md §3); one type, one meaning.
type MetricValue = {
  percent: number | null;        // integer 0..100; null iff state === 'insufficient_data'
  numerator: number;             // correctCount (accuracy) or earned (attainment)
  denominator: number;           // answeredCount (accuracy) or possible (attainment)
  answeredCount: number;
  sessionCount: number;          // sessions contributing to this cell (≥1; required for trends & ranking)
  state: 'reportable' | 'insufficient_data' | 'zero_correct' | 'zero_attainment';
  sampleNote?: string;           // e.g. "butuh ≥3 sesi" for aggregate views
};

type Test = 'TWK' | 'TIU' | 'TKP';
type Difficulty = 'easy' | 'medium' | 'hard';

type TrendSeries = {
  competencyId: string;
  points: Array<{ sessionId: string; finishedAt: string; percent: number; answeredCount: number }>;
  state: 'reportable' | 'insufficient_data';      // ≥3 sessions, same version triple
  direction: Consistency['direction'];
};

type AnalyticsSnapshot = {
  configId: string;
  configVersion: number;
  scoringVersion: number;
  perTest: Record<Test, MetricValue & { metric: 'accuracy' | 'attainment' }>;
  perCompetency: Record<string, MetricValue & { metric: 'accuracy' | 'attainment' }>; // leaves + ancestors, §2.2
  difficulty: Record<Test, Record<Difficulty, MetricValue>>;         // by aiInitial (§4.1)
  empiricalDifficulty: Record<Test, Record<Difficulty, MetricValue>>; // by empirical; empty cells are insufficient_data
  responseTime: { medianSeconds: number; answeredCount: number };
  coverage: Record<string, Coverage>;                                // per competency id, §4.2
  trends: TrendSeries[];                                             // per competency, §5
  consistency: Record<string, Consistency>;                          // per competency, §4.3
  // Inputs the recommendation ranking needs (RECOMMENDATION_ENGINE.md §2), so it never
  // re-aggregates: the user's own mean per test, and its comparison basis.
  testMean: Record<Test, MetricValue['percent']>;   // integer 0..100, or null when no cell is reportable
  comparability: {
    mixed: boolean;                                 // true iff >1 triple in the set
    versions: Array<{ configId: string; configVersion: number; scoringVersion: number; sessionCount: number }>;
  };
  history: {
    deletedSessionCount: number;                    // §7.3 — counted, never resurrected
    lastDeletionAt: string | null;
  };
};
```

`percent` is the ratio rounded **half-up** to an integer at the boundary — one documented rounding,
applied once, in the backend. `numerator`/`denominator` are always present so no reader ever has to
recover the ratio. The internal ratio never leaves this engine.

`sessionCount` is required, not optional: `RECOMMENDATION_ENGINE.md` §2 ties ranking on it and §3
prints it as evidence. A cell's `sessionCount` is the number of sessions whose roster contains ≥1
question of that competency (ancestors: union of their leaves' sessions).

The analytics engine returns this; the frontend renders it unchanged. It never emits a value the
frontend must recompute.

---

## 7. History: deletion, derivation and recomputation

### 7.1 Three distinct operations — do not conflate them

| Operation | What it does | Who can trigger it | Status |
|---|---|---|---|
| **Hide** | The result stays stored and unchanged; it stops appearing in normal application views (history lists, result cards, analytics inputs) | user, reversible | documented here; a **view filter**, not a data operation |
| **User deletion** (the MVP operation) | The session is removed from normal views **and** from analysis; one content-free tombstone is left | user, explicit | **in scope** |
| **Permanent purge** | Physical erasure of every remaining record of the session, tombstone included | user | **not approved — unresolved** (§7.7) |

**Tombstoning is not permanent deletion.** This document previously implied "gone permanently"; that
claim is withdrawn. The MVP operation removes the session from the analytical dataset and leaves a
non-recoverable-from-content tombstone. What the operating system or disk may retain at the file level
(PostgreSQL dead tuples and base-backup pages, logical-dump copies, filesystem slack) is outside the
app's contract and is not claimed either way.

### 7.2 Rule

**A finished result is immutable** ([SCORING_METHODOLOGY.md](../examination/SCORING_METHODOLOGY.md) §7)
**until the user explicitly deletes it.** Deletion is an explicit user act; nothing else removes a
session — not a new config, not a migration, not a job, not an AI call.

### 7.3 Analytics are derived-on-read and exclude deleted history

No metric is stored per session for analytics use. `AnalyticsSnapshot` is computed on request from the
sessions that are **present and not deleted**, so a deleted session stops contributing on the next read —
there is no cached aggregate to invalidate and no half-deleted state to reconcile.

Derived analytics and recommendations must **exclude deleted history**. That is guaranteed by
construction, not by a filter the UI applies: the engine never sees the removed rows.

The two fields that **are** written back are per-question and are recomputed from surviving answers only:
`difficulty.empirical` and the question's `sampling` counters are not analytics aggregates over sessions
and carry no session identity. A question whose answers were all deleted loses empirical data and returns
to `empirical = null` (insufficient data), which is the honest state.

### 7.4 What deletion does and what it leaves

| Object | On user deletion |
|---|---|
| Session row, answer sheets, frozen snapshot (including its question content and keys), `ScoreResult` | removed together in one transaction |
| Contributions to `perTest`, `perCompetency`, `coverage`, `trends`, `consistency`, `testMean` | disappear, because those are derived from the removed rows |
| Per-question `difficulty.empirical` | recomputed from surviving answers |
| Recommendations and the learning sequence | regenerated on next read; a weakness may vanish if its evidence was deleted |
| **Tombstone** (`session_deletion`, append-only) | **kept**: `{ sessionId, mode, startedAt, deletedAt, questionCount, configId, configVersion, reason? }` — no answers, no stem text, no option text, no score |
| Audit record | one append-only entry: timestamp + count |

The tombstone exists so the product can say *"3 riwayat dihapus — analisis hanya dari data yang tersisa"*
rather than presenting an empty panel as a defect (`AnalyticsSnapshot.history`, §6), and so the deletion
itself stays auditable. It contains no content that could reconstruct the session.

### 7.5 "Hide" versus "delete"

Hiding is a **display filter** over rows that are still present and still counted. If hiding ever ships, it
must be visibly reversible and must state whether hidden sessions still feed analysis. Deletion is the
opposite: it is not reversible from the app, and it removes the session from analysis. The two are never
presented with one label.

### 7.6 Consequences the user is told before confirming

The delete dialog states, in plain Indonesian, and the API returns the same in
`DELETE /sessions/:id` / `POST /sessions/bulk-delete`:

1. the result leaves history and analysis, and the app cannot restore it;
2. any trend, consistency or weakness that used this session changes or disappears;
3. the question's empirical difficulty may revert to "belum cukup data";
4. other sessions are not affected; a backup taken earlier may still contain the pre-deletion database
   ([DEPLOYMENT_AND_BACKUP.md](../architecture/DEPLOYMENT_AND_BACKUP.md) §2.3);
5. a content-free record that a session existed is retained.

Rule 4 and rule 5 are stated because they are true; the app does not claim that deletion reaches backups
or removes every trace.

### 7.7 Permanent purge — unresolved

Physical erasure (including the tombstone and any residual copy under the app's control) is **not an
approved behaviour**. It is recorded as an open Product Owner decision in the revision report §8. Until
it is approved:

- no route, UI control or migration performs a purge;
- the app never tells the user that a purge happened;
- the tombstone is retained;
- immutable results are preserved until the user explicitly deletes them (§7.2).

### 7.8 What is not deleted

- Question content, question versions and question history are **not** deleted by removing a session.
- Backup archives are not touched.

---

## 8. Boundaries

- **Does not** define weakness ranking → [RECOMMENDATION_ENGINE.md](../ai/RECOMMENDATION_ENGINE.md).
- **Does not** define scoring → [SCORING_METHODOLOGY.md](../examination/SCORING_METHODOLOGY.md).
- **Does not** define API shape → [API_SPECIFICATION.md](./API_SPECIFICATION.md).
- **Never invents a finding.** The engine emits counts, percents, states and ranges. Whether a cell is a
  "weakness", and in what order to study, is [RECOMMENDATION_ENGINE.md](../ai/RECOMMENDATION_ENGINE.md) —
  and the AI layer may only *order and explain* that set, never add a node to it (§2 there).
- **Rejected rule:** no "correct" concept for TKP; no difficulty-influencing-score (difficulty drift
  must not leak into scoring comparisons).