# Question Generation

Canonical source for the **generation pipeline**: how a request becomes draft questions in the Bank
Soal, and how a batch reaches the point where it is usable. Referenced by
[QUESTION_SPECIFICATION.md](../examination/QUESTION_SPECIFICATION.md) §6 and
[PRD.md](../product/PRD.md) §9.5 (FR-G1…FR-G8).

The prompt text is canonical in [PROMPT_SPECIFICATION.md](./PROMPT_SPECIFICATION.md); the provider
interface in [AI_PROVIDER_ARCHITECTURE.md](./AI_PROVIDER_ARCHITECTURE.md); the validation layers in
[AI_VALIDATION.md](./AI_VALIDATION.md). This file owns the pipeline and its failure taxonomy; the
backend execution lives in [GENERATION_JOBS.md](../backend/GENERATION_JOBS.md).

---

## 1. Pipeline

```mermaid
flowchart LR
  R[Request: competencies, difficulty, count, config] --> J[Create job (backend background)]
  J --> B[Batch questions]
  B --> P[Provider chat]
  P --> T[T: parse + shape + V-01..V-13]
  T -->|fail| Q1[quarantined, reason stored]
  T -->|ok| Q[Q: AI quality rating]
  Q -->|off_target| Q1
  Q -->|ok| K[K: consistency check]
  K -->|fail| Q1
  K -->|ok| POOL[batch sampling pool, dynamicEligible=false]
  POOL --> S[S: user samples the batch]
  S -->|clean| LIVE[dynamicEligible=true]
  S -->|findings, scoped| FIX[only the named questions quarantined for repair]
  FIX --> RE[re-validate T→Q→K, then re-sample]
  RE --> LIVE
```

1. **Request** names `competencyIds` (leaves), `difficulty`, `count`, `configId`.
2. **Job** records `providerId`, `modelId`, `promptTemplateId`, `promptVersion`, `generationId`.
3. **Batching** splits `count` into batches sized so review stays ≤ 60 s/question
   ([PRD.md](../product/PRD.md) §12) and so a prompt fits the model's `maxContextTokens`
   ([AI_PROVIDER_ARCHITECTURE.md](./AI_PROVIDER_ARCHITECTURE.md) §6); a batch is the unit of retry and
   of failure.
4. **Every produced question arrives as `draft`** with a complete `provenance` block — never `active`
   (US-B2). Regenerating creates a **new** question whose `generationId` differs; it never mutates the
   old one in place.
5. **The pipeline runs without the browser.** The user may navigate away or close the browser; the job
   continues on the backend and the outcome reaches the user through the in-app notification centre
   ([GENERATION_JOBS.md](../backend/GENERATION_JOBS.md) §1,
   [NOTIFICATION_SPECIFICATION.md](../backend/NOTIFICATION_SPECIFICATION.md) §2).

## 2. Provenance on arrival

Each draft pins: provider, model, prompt template + version, generation id, **batch id**, timestamp. This
is the `provenance` block of [QUESTION_SPECIFICATION.md](../examination/QUESTION_SPECIFICATION.md) §2; the
"never official" badge and prohibited-strings rules in §2.1 are enforced here on arrival.

## 3. Validation on arrival — automated, every question

Layer **T** (parse, shape, V-01…V-13) runs on **every** generated question, then **Q** and **K**
([AI_VALIDATION.md](./AI_VALIDATION.md)). Layer definitions and the quarantine rule are canonical in
[QUESTION_SPECIFICATION.md](../examination/QUESTION_SPECIFICATION.md) §5.

- A question that fails is **quarantined**, still listed, with the failing layer and check, so the user
  can repair it — never silently dropped (FR-G3, US-B6).
- A question that passes all three layers is **not usable yet**: it waits for the batch's sampling gate
  (§4). Its state is `active` with `dynamicEligible = false`, or `ai_validated` until the batch decision.
- **Manual questions run T only** and never enter a sampling gate
  ([QUESTION_SPECIFICATION.md](../examination/QUESTION_SPECIFICATION.md) §6.1).

## 4. Batch gate — sample, decide, publish

1. When every batch of a job finishes, the batch summary lists `passedForSampling` and `quarantined`,
   and a `batch_awaiting_sampling` notification is raised.
2. The user opens the sampling screen, which shows:
   - the sample the backend drew, with its stated `sampleSize` (the **quota is an unresolved product
     parameter** — [QUESTION_SPECIFICATION](../examination/QUESTION_SPECIFICATION.md) §6.2 rule 3);
   - every **Q/K flag** of the sampled items, so the review is aimed;
   - the batch's counts and the statement that sampling is **not** a guarantee.
3. The user records an outcome: **clean** (no findings) or **findings** naming specific questions.
4. `clean` → every `passedForSampling` question becomes `dynamicEligible = true`.
   `findings` → only the named questions are quarantined; the rest become eligible. A finding declared
   **systemic** quarantines the whole batch and is stated as such.
5. The sample size, the outcome and the finding count are stored in `provenance.sampling` and stay
   visible in the bank forever.

## 5. Batching, partial output

- Progress shows batches done/total (FR-G2, US-B1).
- A batch never half-writes: it is committed atomically (all its drafts or none), and a failed batch is
  marked failed with its **scrubbed** raw response retained for inspection.
- **Partial output is first-class.** A job that fails on batch 3 of 5 keeps the questions of batches 1–2,
  reports `partial: true` with per-batch counts, and the notification says how many questions survived.
  Partial output is pooled and sampled exactly like a complete batch.
- **No pause, no resume, no cancel.** A running job runs to completion
  ([GENERATION_JOBS](../backend/GENERATION_JOBS.md) §2).

## 6. Failure taxonomy (canonical ids)

| Category | Meaning | Retry? |
|---|---|---|
| `timeout` | provider exceeded `timeoutMs` | yes |
| `auth` | 401/403 — key rejected | no (until key fixed) |
| `rate_limit` | 429 | yes, honouring retry cap |
| `malformed_json` | non-JSON or wrong schema despite contract | yes (regenerate) |
| `schema_violation` | JSON parsed but fails structural validation | yes (regenerate) |
| `provider_error` | any other provider/transport failure | yes |
| `interrupted` | the app stopped while the batch was in flight | yes (explicit retry, §7) |

The raw response is always viewable (FR-G6), scrubbed. `malformed_json` and `schema_violation` are
distinct: one is "not JSON", the other is "JSON of the wrong shape"
([AI_VALIDATION.md](./AI_VALIDATION.md)).

**Retry is always on the same provider and model.** There is no automatic fallback
([AI_PROVIDER_ARCHITECTURE.md](./AI_PROVIDER_ARCHITECTURE.md) §7).

## 7. Interruption and restart

A provider request cannot be resumed mid-flight, and the product never claims otherwise.

On restart the backend inspects leftover jobs ([GENERATION_JOBS.md](../backend/GENERATION_JOBS.md) §5):

| Situation | Action |
|---|---|
| Batch had not been sent when the app stopped | Safe to resume: the batch starts normally |
| Batch was in flight, no response recorded | Batch marked `interrupted`; **no retry is attempted automatically**; the user is offered "coba lagi" |
| Batch completed before the stop | Its questions are kept — no duplicate is created on retry |

Duplicate protection is `(generationId, batchId, promptVersion)` plus a `contentHash` check on insertion
(V-08), so a retried batch can never double-insert a question it already produced.

## 8. Regeneration and repair

Regenerating one question issues a new job with `count: 1` and the original's parameters; the result
is a **new** `draft` row, and it carries `regeneratesQuestionId` in its provenance pointing at the
original. The original is kept (or rejected/archived by the user), so no provenance record is
overwritten and the two are never conflated as one question
([GENERATION_JOBS.md](../backend/GENERATION_JOBS.md) §3).

A repaired question (edited after a sampling finding or a report) is **not** a regeneration: it keeps its
id and gets a new `contentVersion`, and it must pass T → Q → K and be **re-sampled** before it regains
`dynamicEligible` ([QUESTION_SPECIFICATION.md](../examination/QUESTION_SPECIFICATION.md) §6.4).
