# Recommendation Engine

Canonical source for **turning analytics into strengths, weaknesses, recommendations, drills and a
study plan** — and for the **boundary between deterministic statistics and AI**. Referenced by
[PRD.md](../product/PRD.md) §9.7 (FR-L1…FR-L7) and
[COMPETENCY_TAXONOMY.md](../examination/COMPETENCY_TAXONOMY.md).

Consumes [ANALYTICS_ENGINE.md](../backend/ANALYTICS_ENGINE.md) output; never re-scores and never
changes a score.

---

## 1. Inputs

Per competency: `MetricValue` (`percent`, metric kind, `answeredCount`, `sessionCount`, `state`),
`Coverage` (§4.2 there), `Consistency` (§4.3 there), the response-time median, plus `testMean` — the
user's own mean **per test** (`AnalyticsSnapshot.testMean`,
[ANALYTICS_ENGINE.md](../backend/ANALYTICS_ENGINE.md) §6). All are computed by analytics; this file
only ranks and maps and never averages a metric itself.

**Difficulty, sample size, response time, trend, consistency and coverage are all inputs.** None of them
is derived here.

## 2. Weakness identification (FR-L1) — deterministic, closed before AI

A competency is a **candidate weakness** only when its metric is `reportable`
(`answeredCount ≥ 5`, [ANALYTICS_ENGINE.md](../backend/ANALYTICS_ENGINE.md) §3.1). `insufficient_data`
rows are excluded from ranking entirely — they are shown as "Belum cukup data (n=…)", never ranked
(FR-A4, US-A3).

Ranking is by **deficit from the user's own mean** across competencies of the same test, descending;
ties by lower `sessionCount` first (less evidence → sooner to confirm). Ranked weaknesses cap at 3
surfaced on the dashboard (FR-D3), with the full list available elsewhere.

### 2.1 The AI may not add, remove or invent a weakness

| Step | Owner | May an AI do it? |
|---|---|---|
| Compute metrics | analytics | **no** |
| Decide which competencies are weaknesses and in what order | this section (deterministic) | **no** |
| Order the *study sequence* among the identified weaknesses | §6 | **yes**, and the AI may reorder only the closed set |
| Write the explanatory text for a weakness | §6 | **yes**, from the fields in §3 only |
| Add a competency the statistics did not flag | — | **never** |
| Claim a cause ("you were tired", "this is usually easy") | — | **never** — there is no data for it |

Enforcement: the AI is called with the closed weakness list as its **only** permitted subject and must
return one entry per input id; an output naming an unknown competency, or a competency outside the
reportable set, is **discarded**, not displayed
([AI_VALIDATION.md](./AI_VALIDATION.md) §5). If the AI call fails, the result screen still renders the
deterministic list and explanation-free text — AI is never on the critical path of a result.

### 2.2 Strength identification

The mirror rule, and it is deliberately stricter: a **strength** requires `reportable` **and**
`sessionCount ≥ 3` **and** consistency `reportable` with `direction` not `declining`. A single good
session is not a strength; it is one session's evidence (§3.4 of the analytics doc).

### 2.3 TKP and Latihan

- TKP weaknesses use **attainment**, never right/wrong; the words "benar/salah" never appear on a TKP row
  ([FRONTEND_RESULTS_ANALYTICS.md](../frontend/FRONTEND_RESULTS_ANALYTICS.md) §1).
- The per-session result view uses the **same** rule set on that session's data: strengths, weaknesses
  and "belum cukup data", each with counts.

## 3. Evidence shown with every weakness (FR-L2)

Numbers, not adjectives:

| Field | Source |
|---|---|
| Metric | `accuracy` or `attainment` (label the kind) |
| `n` | `answeredCount` |
| `sesi` | `sessionCount` |
| Gap | metric − user mean, signed and labelled |
| Difficulty | the empirical band mix of the answered items, or "belum cukup data" |
| Coverage | `attempted/available` and percent (§4.2 there) |
| Response time | median seconds **with** answer count |
| Consistency | spread and direction, when reportable |
| Trend | direction with session count, when reportable |

No weakness row may claim certainty; the sample caveat from
[ANALYTICS_ENGINE.md](../backend/ANALYTICS_ENGINE.md) §3.3 is always shown. Any field whose source state is
`insufficient_data` renders as "belum cukup data" and is **not** replaced with a plausible guess.

## 4. Recommendation (FR-L3) — material bank is in MVP

For a surfaced weakness, recommend an approved learning material from the bank (§
[MATERIAL_SPECIFICATION.md](../examination/MATERIAL_SPECIFICATION.md) §6) bound to that competency or to
one of its ancestor domains; otherwise offer to draft one via `QUESTION_GENERATION` task `material`.
A draft is not recommended until the user approves it.

The envelope is explicit and never a placeholder:

```ts
type MaterialOffer =
  | { status: 'available'; materialId: string; version: number; title: string }   // approved
  | { status: 'draft_available'; materialId: string; hint: 'setujui_dulu' }        // exists, unapproved
  | { status: 'none'; action: 'generate_material' };
```

**This replaces the earlier MVP rule DB-1** ("no material bank; return `no_material`"), superseded by the
2026-11-08 product decision. The supersession is recorded in
[../AUDIT.md](../AUDIT.md) and [../audit/SYSTEM_REVISION_REPORT.md](../audit/SYSTEM_REVISION_REPORT.md) §G1.

A material offer never presupposes a threshold: the `'no_verified_basis'` case from the earlier rule is
gone, because a weakness is defined against the user's own mean (§2) and never against a passing
threshold.

## 5. Targeted drill (FR-L4)

Each recommendation carries a "Latih ini" action that opens a pre-filled practice session for that
competency ([USER_JOURNEYS.md](../product/USER_JOURNEYS.md) J-2). The drill is a **package**
([PACKAGE_SPECIFICATION.md](../product/PACKAGE_SPECIFICATION.md) §6, "weakness drill"):
`kind: 'submateri'`, `competencyIds` = the lapsed leaves, `repeatPolicy: 'allow_repeat'` so a small stock
still produces a drill, with the repeat count stated before starting.

## 6. AI role — ordering and explanation only

The AI receives the closed weakness list plus the evidence fields of §3 and returns:

```ts
type RecommendationExplanation = {
  studyOrder: string[];            // competency ids, a permutation of the input ids — nothing else
  notes: Array<{ competencyId: string; text: string }>;  // explanation text per input id
  planNarrative?: string;          // one paragraph, no new claims
};
```

Rules:

1. `studyOrder` is validated server-side as a **permutation of the input ids**; a missing id is appended
   in deterministic order, an unknown id is dropped.
2. `notes[].text` is rendered as advice, labelled as AI-written, and may reference only the evidence
   fields supplied. A prohibited string check (no "resmi", no official claim, no numeric claim absent
   from the input) runs before display ([AI_VALIDATION.md](./AI_VALIDATION.md) §5).
3. The AI never produces a numerical metric. If it returns a number, the number is discarded and the
   deterministic value is shown.

## 7. Learning sequence (FR-L5, FR-L6) — not a standalone feature

**Split of concepts.** Two things are separately scoped:

1. **Recommendations shown in results and Progres** — deterministic weaknesses, evidence, material offer
   and drill target (§2–§5). Approved and in MVP.
2. **A standalone Rencana Belajar feature with its own screen and route** — **not approved, out of MVP**
   ([MVP_SCOPE.md](../product/MVP_SCOPE.md) §2). No route, screen or navigation entry exists for it.

What remains canonical here is the **learning sequence**: the deterministic ordering of the weaknesses
with the AI-written explanation of *why* each is first (§2.1, §6). It is rendered inline where the
recommendations already appear (result, Progres), not on a separate page.

Rules that hold for the sequence:

- Sequence items derive from ranked weaknesses (material + drill target + estimated effort).
- **Recomputation proposes, does not overwrite.** After each new result the engine recomputes the order
  and explanation; nothing the user authored is silently discarded (US-L4).
- Deleting history ([ANALYTICS_ENGINE.md](../backend/ANALYTICS_ENGINE.md) §7) excludes the deleted session
  from the sequence; nothing resurrects it.
- A user-editable plan document, plan diff-apply, `/study-plan` routes and `/progres/paket` are **not
  part of the MVP contract**. They are recorded as an unapproved proposal in the revision report §8.

## 8. Cross-session conclusions (FR-L7)

Cross-session statements (trend, consistency, "you are improving") are emitted **only** where
`AnalyticsSnapshot` reports `reportable` for that competency: ≥ 3 sessions under the same
`(configId, configVersion, scoringVersion)` triple. Below that the product says so and stops; it never
generalises from one session and never compares across rule versions
([FRONTEND_RESULTS_ANALYTICS.md](../frontend/FRONTEND_RESULTS_ANALYTICS.md) §6).

---

## 9. Boundaries

- Metric definition and sample rules: [ANALYTICS_ENGINE.md](../backend/ANALYTICS_ENGINE.md).
- Material record, sources and approval: [MATERIAL_SPECIFICATION.md](../examination/MATERIAL_SPECIFICATION.md).
- Ranking **and** material/drill/plan logic: this file.
- The backend service that executes these queries: [RECOMMENDATION_SERVICE.md](../backend/RECOMMENDATION_SERVICE.md).
