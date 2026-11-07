# Frontend Data Contracts

The frontend's read of every backend shape. This is the mirror of
[API_SPECIFICATION.md](../backend/API_SPECIFICATION.md) and [API_ENDPOINTS.md](../backend/API_ENDPOINTS.md):
the backend implements, the frontend types against these. No field here is invented on the UI side.

---

## 1. The one rule

**The frontend renders, never recomputes.** Scores, percentages, sample-status flags, and weaknesses
all arrive from the backend; the UI formats and displays them. Any derivation a screen needs
(e.g. "which bucket is lowest") is a render concern only, never a scoring/metrics computation.

## 2. Envelopes

### Success

```ts
type ApiEnvelope<T> = { data: T; meta: { version: string } }
```

### Error (union by `error.code`)

```ts
type ApiError =
  | { code: 'VALIDATION_FAILED'; message: string; details: { fields: FieldError[] } }
  | { code: 'NOT_FOUND';       message: string; details: { resource: string; id: string } }
  | { code: 'CONFLICT';        message: string; details: { resource: string; reason: string } }
  | { code: 'PROVIDER_UNAVAILABLE' | 'PROVIDER_AUTH_FAILED' | 'RATE_LIMITED' | 'PROVIDER_TIMEOUT';
      message: string; details: Record<string, unknown> }
  | { code: 'PREFLIGHT_FAILED';          message: string; details: { errors: PreflightError[] } }
  | { code: 'APPROVAL_INVALID';          message: string; details: { changed: ChangeEntry[]; config: ConfigSummary } }
  | { code: 'APPROVAL_VERSION_MISMATCH'; message: string; details: { changed: ChangeEntry[] } }
  | { code: 'THRESHOLD_CONFIG_INVALID';  message: string; details: { changed: ChangeEntry[]; thresholds: ThresholdSummary } }
  | { code: 'CONTRACT_MISMATCH'; message: string; details: { expected: string; actual: string } }
  | { code: 'UNSUPPORTED';      message: string; details: { feature: string } }

type ChangeEntry = { field: string; approved: unknown; current: unknown }
```

`requestId` is present on every error but is log-only — the UI never shows it.

## 3. Core domain types (mirror backend shapes)

```ts
// Bucket — TWK/TIU/TKP per-section and totals
type Bucket = { earned: number; possible: number; answeredCount: number; correctCount: number }

// answer correctness per item
// TWK/TIU: true | false | null (null = unanswered)
// TKP: null (correctCount = 0)
type ItemCorrect = boolean | null

type ScoreResult = {
  total: Bucket
  sections: { twk: Bucket; tiu: Bucket; tkp: Bucket }
  perQuestion: Array<{ questionId: string; earned: number; possible: number; correct: ItemCorrect }>
  snapshotVersion: string
  configId: string
  approval: ProvisionalApproval | null
  thresholds: { naikTotal: number; naikTiu?: number }
}

// MetricValue — integer percent + the counts it derives from
type MetricValue = { percent: number; answeredCount: number; correctCount: number }
// TKP attainment analog: { attainmentPercent: number; earned: number; possible: number; answeredCount: number }
```

`ProvisionalApproval`, `ExamConfig`, `BasisRef`, `Thresholds`, and the analytics `AnalyticsSnapshot`
shapes are imported from the backend docs ([CPNS_2026_REGULATIONS](../examination/CPNS_2026_REGULATIONS.md),
[ANALYTICS_ENGINE](../backend/ANALYTICS_ENGINE.md)) — the frontend does not redefine them.

## 4. Render rules encoded above

- `perQuestion[].correct === null` → render `—` (belum dijawab), **not** "salah".
- TKP `correctCount === 0` and `correct === null` always; show `earned/possible` attainment.
- `MetricValue.percent` is integer; always display with `answeredCount`.
- `insufficient_data` / `zero_correct` / `zero_attainment` come as explicit flags from analytics —
  the UI maps them to badges, never infers them.

## 5. Error handling contract

The Data layer maps the raw error to a discriminated union, so screens write:

```
if (result.kind === 'blocked') showBlocked(result.changed)
if (result.kind === 'preflight') showPreflight(result.errors)
```

This concentrates `changed[]`/`errors[]` rendering in one error-mapper component
([FRONTEND_STATE_MANAGEMENT.md](./FRONTEND_STATE_MANAGEMENT.md) §5).

## 6. Mock parity

The mock layer must return shapes identical to these types, including error envelopes
([FRONTEND_MOCK_DATA_STRATEGY.md](./FRONTEND_MOCK_DATA_STRATEGY.md)).