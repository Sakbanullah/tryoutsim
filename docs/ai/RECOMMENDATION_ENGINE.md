# Recommendation Engine

Canonical source for **turning analytics into weaknesses, recommendations, and a study plan**.
Referenced by [PRD.md](../product/PRD.md) §8.6 (FR-L1…FR-L6) and
[COMPETENCY_TAXONOMY.md](../examination/COMPETENCY_TAXONOMY.md).

Consumes [ANALYTICS_ENGINE.md](../backend/ANALYTICS_ENGINE.md) output; never re-scores and never
changes a score.

---

## 1. Inputs

Per competency: metric value (`accuracy`/`attainment`), `answeredCount`, `sessionCount`, plus the
user's mean across competencies. All are computed by
[ANALYTICS_ENGINE.md](../backend/ANALYTICS_ENGINE.md); this file only ranks and maps.

## 2. Weakness identification (FR-L1)

A competency is a **candidate weakness** only when its metric is `reportable`
(`answeredCount ≥ 5`, [ANALYTICS_ENGINE.md](../backend/ANALYTICS_ENGINE.md) §3.1). `insufficient_data`
rows are excluded from ranking entirely — they are shown as "Belum cukup data (n=…)", never ranked
(FR-A4, US-A3).

Ranking is by **deficit from the user's own mean** across competencies of the same test, descending;
ties by lower `sessionCount` first (less evidence → sooner to confirm). Ranked weaknesses cap at 3
surfaced on the dashboard (FR-D3), with the full list available elsewhere.

## 3. Evidence shown with every weakness (FR-L2)

Numbers, not adjectives:

| Field | Source |
|---|---|
| Metric | `accuracy` or `attainment` (label the kind) |
| `n` | `answeredCount` |
| `sesi` | `sessionCount` |
| Gap | metric − user mean, signed and labelled |

No weakness row may claim certainty; the sample caveat from
[ANALYTICS_ENGINE.md](../backend/ANALYTICS_ENGINE.md) §3.3 is always shown.

## 4. Recommendation (FR-L3)

For a surfaced weakness, recommend a learning material from the bank (AI-drafted or user-authored —
provenance label per [QUESTION_SPECIFICATION.md](../examination/QUESTION_SPECIFICATION.md) §2.1), else
offer to draft one via [QUESTION_GENERATION.md](./QUESTION_GENERATION.md) (task `material`).

## 5. Targeted drill (FR-L4)

Each recommendation carries a "Latih ini" action that opens a pre-filled practice session for that
competency ([USER_JOURNEYS.md](../product/USER_JOURNEYS.md) J-2).

## 6. Study plan (FR-L5, FR-L6)

- Plan items derive from ranked weaknesses (material + drill target + estimated effort).
- The user may edit any item.
- **Recomputation proposes, does not overwrite:** after each new result the engine computes a new
  suggested plan and shows a diff; the user applies or dismisses. An edited item the user kept is
  never silently discarded (US-L4).

---

## 7. Boundaries

- Metric definition and sample rules: [ANALYTICS_ENGINE.md](../backend/ANALYTICS_ENGINE.md).
- Ranking **and** material/drill/plan logic: this file.
- The backend service that executes these queries: [RECOMMENDATION_SERVICE.md](../backend/RECOMMENDATION_SERVICE.md).