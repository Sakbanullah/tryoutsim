# Analytics Engine

Canonical source for **how raw scores and timing become the metrics the product shows**. It consumes
`ScoreResult` from [SCORING_METHODOLOGY.md](../examination/SCORING_METHODOLOGY.md) §2.2 and answer-timing
events; it never re-scores and never changes a score.

Related: [SCORING_METHODOLOGY.md](../examination/SCORING_METHODOLOGY.md) §9 ·
[PRD.md](../product/PRD.md) §8.5 (FR-A1…FR-A5) · [QUESTION_SPECIFICATION.md](../examination/QUESTION_SPECIFICATION.md).

---

## 1. Input contract

| Input | Source | Notes |
|---|---|---|
| `ScoreResult` | scoring output (§2.2) | `total`, `byTest`, `byCompetency`, `byQuestion`, `thresholds`, `snapshotVersion`. Frozen. |
| Answer timing | session answer log | `session.startedAt` + per-question `answeredAt`. **Never** part of `ScoreResult`; determinism requires scores to ignore clocks (§8). |
| Question difficulty | question table, joined by `questionId` | author-assigned, used only by FR-A3. **Not** a scoring field. |

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

### 2.3 Mean response time (FR-A1)

Median seconds per answer, derived from the answer log, not from `ScoreResult`:

```
elapsed_i = answeredAt_i − (answeredAt_{i−1} or session.startedAt)
responseTime = median(elapsed_i over all answered questions of the scope)
```

- Only `selected !== null` answers count.
- Scope is per test / per competency / per session, same as the buckets.
- Reported as a median with the answer count, never alone.

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
every metric carries its `answeredCount` (and `sessionCount` for trends) inline, and any aggregate
over fewer than 3 sessions is labelled "butuh ≥3 sesi". No claim of statistical significance is made.

---

## 4. Difficulty analysis (FR-A3)

Accuracy (TWK/TIU) or attainment (TKP), grouped by author-assigned `difficulty ∈ {easy, medium, hard}`
within a test, joined from the question table by `questionId`.

- Same minimum-sample rule (`answeredCount ≥ 5`) applies **per difficulty cell**.
- Difficulty is an authoring label, not a scoring input; a difficulty edit later does not re-score the
  session, it only changes which cell this session's questions fall into. (See AUDIT note on drift.)

---

## 5. Trend analysis (FR-A2) and its limits

A trend is a per-competency series of metric values across sessions, ordered by time.

- Requires `≥ 3` sessions touching the competency; below that: `insufficient_data`, "butuh ≥3 sesi".
- **Comparability gate (FR-A5, US-A4):** sessions scored under different `configVersion` or
  `scoringVersion` are not plotted on the same line without an explicit incompatibility note. The
  config badge from `SessionSnapshot` (`configId`, `configVersion`) is carried alongside.
- Trend direction is reported qualitatively ("membaik / menurun / stabil") **with** the session count
  and metric range, never as a guarantee.

---

## 6. Output shape

```ts
type MetricValue = {
  value: number | null;          // accuracy or attainment ratio 0..1
  numerator: number;             // correctCount (acc) or earned (attainment)
  denominator: number;           // answeredCount (acc) or possible (attainment)
  answeredCount: number;
  sessionCount?: number;         // trends only
  state: 'reportable' | 'insufficient_data' | 'zero_correct' | 'zero_attainment';
};

type AnalyticsSnapshot = {
  configId: string;
  configVersion: number;
  scoringVersion: number;
  perTest: Record<'TWK' | 'TIU' | 'TKP', MetricValue & { metric: 'accuracy' | 'attainment' }>;
  perCompetency: Record<string, MetricValue & { metric: 'accuracy' | 'attainment' }>;
  difficulty: Record<Test, Record<Difficulty, MetricValue>>;
  responseTime: { medianSeconds: number; answeredCount: number };
};
```

The analytics engine returns this; the frontend renders it unchanged. It never emits a percentage the
frontend must recompute.

---

## 7. Boundaries

- **Does not** define weakness ranking → [RECOMMENDATION_ENGINE.md](../ai/RECOMMENDATION_ENGINE.md).
- **Does not** define scoring → [SCORING_METHODOLOGY.md](../examination/SCORING_METHODOLOGY.md).
- **Does not** define API shape → [API_SPECIFICATION.md](./API_SPECIFICATION.md).
- **Rejected rule:** no "correct" concept for TKP; no difficulty-influencing-score (difficulty drift
  must not leak into scoring comparisons).