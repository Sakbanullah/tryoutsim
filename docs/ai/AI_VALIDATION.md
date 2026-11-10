# AI Output Validation

Canonical source for the **AI-output-specific** guardrails applied to provider responses **before**
they enter the question data model, and for the **validation layers that involve a model** (quality
rating, consistency). The canonical question-schema validation (V-01…V-13) is
[QUESTION_SPECIFICATION.md](../examination/QUESTION_SPECIFICATION.md) §5 and is **not** restated here.

This file is deliberately narrow, to avoid duplicating the schema: it owns only what concerns
*AI-generated* content and *AI-assisted* checks.

---

## 1. Pipeline position

The canonical quality-gate order is
[QUESTION_SPECIFICATION.md](../examination/QUESTION_SPECIFICATION.md) §5:

```
T. technical (parse + shape + V-01..V-13)
Q. AI quality rating
K. consistency check
S. user sampling
```

This file owns the **AI-specific halves**: the parse/shape sub-steps of **T** (§2–§3), all of **Q**
(§4), the model-assisted part of **K** (§5), and the prohibition checks applied to AI text used in
recommendations (§6). It does **not** own the sampling procedure (question spec §6), the lifecycle
(question spec §3), or the schema rules (question spec §5).

Anything that is true for *human-authored* questions too lives in **T**, not here — manual questions
run **T** and stop (no batch, no sampling).

## 2. T.a — parse

- Accept the object, or a fenced ```` ```json ```` block per
  [PROMPT_SPECIFICATION.md](./PROMPT_SPECIFICATION.md) §4.
- Failure → `malformed_json`. The raw response is kept (scrubbed) so the user can see what the model
  produced.

## 3. T.b — structural shape checks

| ID | Check | Failure category |
|---|---|---|
| AI-01 | top-level object, `questions` is a non-empty array | `schema_violation` |
| AI-02 | each item has `stem`, `options` (array of `{key,text}`), `explanation`, and **exactly one** of `answerKey` (TWK/TIU: an option key) or `optionScores` (TKP: object keyed by option `key`) | `schema_violation` |
| AI-03 | the TKP `optionScores` keys equal the `options` keys; a TWK/TIU item carrying `optionScores`, or a TKP item carrying `answerKey`, fails | `schema_violation` |
| AI-04 | option keys are a subset of `A..E`, distinct | `schema_violation` |
| AI-05 | no `optionScores` value is negative or non-numeric | `schema_violation` |
| AI-06 | a TKP item's `optionJustifications` keys equal its `optionScores` keys, each a non-empty string; a TWK/TIU item carries none ([QUESTION_SPECIFICATION](../examination/QUESTION_SPECIFICATION.md) §1.2, V-13) | `schema_violation` |
| AI-07 | no prohibited string: "Soal Resmi", "Soal CPNS/BKN", official logo reference | `schema_violation` (and blocks, per §2.1) |
| AI-08 | `difficultyProposal` (if present) is exactly `easy`/`medium`/`hard`, and `competencyId` is a real leaf from the requested set | `schema_violation` |

AI-01…05 mirror, but do not replace, V-01/V-02 and SC-01…SC-08: the AI checks run on the *raw
provider payload* before it is shaped into a `Question`; V/SC rules run on the constructed record and
carry the config in force. The overlap is intentional (defence in depth), not duplication.

**AI-08 note.** `difficultyProposal` becomes `difficulty.aiInitial`
([QUESTION_SPECIFICATION.md](../examination/QUESTION_SPECIFICATION.md) §1.1). A proposal outside the
requested competency set is a failure, not a re-tag: the pipeline never relabels a question to whatever
the model produced.

A **T** failure quarantines that question and is reported in the batch summary; the rest of the batch
continues (question spec §6.2).

## 4. Q — AI quality rating

After **T** passes, the batch's own model (same provider/model as the generation) rates each question
against the request it was generated for.

```ts
type QualityRating = {
  competencyFit: 'on_target' | 'partial' | 'off_target';
  difficultyFit: 'matches' | 'easier' | 'harder';
  keyConfidence: 'high' | 'medium' | 'low';
  explanationComplete: boolean;       // every option addressed (TKP: every option's weight justified)
  flags: string[];                    // closed set of short codes, e.g. 'ambiguous_stem', 'two_plausible_keys'
};
```

Rules:

1. **A rating is a signal, never an approval.** It cannot move a question to `active` and cannot
   satisfy the sampling gate.
2. **`off_target` or `two_plausible_keys`** → that question is quarantined for repair; the rest of the
   batch proceeds (selective repair, question spec §6.4).
3. **`partial` / `medium` / `low`** → the question stays in the sampling pool and the flag is shown
   **inside** the sampling screen, so the user's attention is aimed rather than asked to judge blind.
4. **Self-rating bias is acknowledged, not hidden.** The same model rates its own output; the product
   states in the sampling screen that the rating is a model self-assessment. This is exactly why layer
   **S** exists and cannot be skipped.
5. Rating output is stored in the question's `ValidationRecord.layers[]` under `layer: 'Q'` with the
   model id, so provenance shows which model rated what.

## 5. K — consistency check (model-assisted part)

| ID | Check | Deterministic? | On failure |
|---|---|---|---|
| K-01 | duplicate against the bank (`contentHash`, V-08) | yes | quarantine |
| K-02 | near-duplicate (`V-09` normalised hash) | yes | quarantine for repair |
| K-03 | difficulty plausibility: `aiInitial` vs the question's structure, model judgement | no | flag only, shown in sampling |
| K-04 | competency fit re-check with the taxonomy goal injected | no | `off_target` → quarantine |
| K-05 | answer-key plausibility: for TWK/TIU exactly one full-score option, and the explanation argues for it | partly | flag shown in sampling; never auto-accepts |

Only K-03 and K-04 involve a model. They are recorded under `layer: 'K'`; a deterministic failure
(K-01/K-02) is recorded under `layer: 'T'` because it is a schema-level rule (V-08/V-09).

**A model contradiction is not arbitration.** When **Q** and **K** disagree (e.g. Q says
`on_target`, K says `off_target`), the stricter result wins and the question goes to sampling with both
signals visible. The pipeline never asks a model to settle a dispute between models.

## 6. Prohibition check on AI text outside questions

The same prohibited-claim check (AI-06 / V-12) runs on:

- **material drafts** ([MATERIAL_SPECIFICATION.md](../examination/MATERIAL_SPECIFICATION.md) §6 M-05);
- **recommendation notes** ([RECOMMENDATION_ENGINE.md](./RECOMMENDATION_ENGINE.md) §6): no official
  claim, no numeric claim absent from the supplied evidence, no competency outside the input set.

A failed check discards the AI text and keeps the deterministic content; it never blocks a result screen.

## 7. What this file does NOT do

- It does **not** assign a lifecycle state (that is [QUESTION_SPECIFICATION.md](../examination/QUESTION_SPECIFICATION.md) §3).
- It does **not** run sampling or define sample size (question spec §6).
- It does **not** judge TKP "correctness" (attainment only, [SCORING_METHODOLOGY.md](../examination/SCORING_METHODOLOGY.md) §9).
- It does **not** define weakness/recommendation logic ([RECOMMENDATION_ENGINE.md](./RECOMMENDATION_ENGINE.md)).
- It does **not** retry or fail a job ([GENERATION_JOBS.md](../backend/GENERATION_JOBS.md)).
