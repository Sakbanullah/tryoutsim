# Database Schema

Canonical source for the SQLite logical schema. This is a data model, not DDL (migration mechanics
are in [MIGRATION_STRATEGY.md](./MIGRATION_STRATEGY.md)). Table/column names here are the contract;
the frontend never reads them (it speaks HTTP).

---

## 1. Design rules

- **Integers only** for scoring/counts/timing (ms). Percentages are derived, not stored.
- **Snapshot-first**: a session binds immutable snapshots; score reads snapshots, never the live
  question/config tables ([SCORING_METHODOLOGY](../examination/SCORING_METHODOLOGY.md) §7).
- **Secrets write-only**: provider keys stored by reference with a masked tail, never a plaintext
  column readable by accident ([SECURITY](../architecture/SECURITY.md) §3).
- **No invented attributes**: every column traces to a doc requirement (PRD FR / spec §).

## 2. Core tables

### `exam_config`

| column | type | notes |
|---|---|---|
| `id` | TEXT PK | e.g. `skd-cpns-2026-provisional` |
| `pathway` | TEXT | `CPNS` \| `SEKOLAH_KEDINASAN` |
| `examYear` | INT | |
| `state` | TEXT | `official_verified` \| `historical` \| `provisional` |
| `durationMinutes` | INT | |
| `itemCount` | INT | total items |
| `twkCount`,`tiuCount`,`tkpCount` | INT | per sub-test |
| `twkWeight`,`tiuWeight` | INT | 5 / 0 semantics (blank → 0) |
| `tkpWeightMin`,`tkpWeightMax` | INT | 1..5 |
| `maxScore` | INT | |
| `scoringVersion` | TEXT | |
| `configVersion` | TEXT | monotonic per change |
| `regulatoryBasisHash` | TEXT | opaque hash over `BasisRef[]` |

### `basis_ref`

| column | type | notes |
|---|---|---|
| `id` | TEXT PK | |
| `examConfigId` | TEXT FK | → `exam_config.id` |
| `tier` | TEXT | evidence tier (`VERIFIED-2026`, `VERIFIED-CURRENT`, `HISTORICAL`, …) |
| `pathway` | TEXT | pathway tag |
| `title`,`source`,`url`,`accessedAt` | TEXT | provenance |

### `thresholds`

| column | type | notes |
|---|---|---|
| `examConfigId` | TEXT PK/FK | one per config |
| `naikTotal` | INT | |
| `naikTiu` | INT (nullable) | cumlaude variant |
| `affirmationTotal`,`affirmationTkp` | INT (nullable) | affirmation variant |

(only the columns a config actually defines; validation guards the finite-integer `≤ maxScore` rule
in [SCORING_METHODOLOGY](../examination/SCORING_METHODOLOGY.md) §5.)

### `provisional_approval`

| column | type | notes |
|---|---|---|
| `configId` | TEXT PK/FK | |
| `configVersion`,`scoringVersion`,`regulatoryBasisHash` | TEXT | the four bound values |
| `approvedByUserAt` | TEXT | ISO-8601 |
| `approvedBy`,`acknowledgedWarnings` | TEXT | |

Bound values are exactly the `ProvisionalApproval` shape in
[CPNS_2026_REGULATIONS](../examination/CPNS_2026_REGULATIONS.md) §4.3.

### `question`

| column | type | notes |
|---|---|---|
| `id` | TEXT PK | |
| `test` | TEXT | `TWK` \| `TIU` \| `TKP` |
| `competencyId` | TEXT FK | → `competency` |
| `stimulus`, `stem` | TEXT | |
| `optionsJson` | TEXT | option list incl. per-option TKP weights |
| `answerKeyJson` | TEXT | owner-visible only |
| `explanation`, `difficulty` | TEXT | |
| `lifecycle` | TEXT | `draft` \| `active` \| `archived` |
| `provenanceJson` | TEXT | `Provenance` (model/provider/promptVersion/generatedAt) |
| `contentHash` | TEXT | for dedup/dup-cluster (V-08/09) |
| `taxonomyVersion` | TEXT | |

Provenance and lifecycle are [QUESTION_SPECIFICATION](../examination/QUESTION_SPECIFICATION.md) §2–3.

### `competency`

| column | type | notes |
|---|---|---|
| `id` | TEXT PK | leaf or domain id from taxonomy |
| `parentId` | TEXT FK nullable | hierarchy |
| `test` | TEXT | grouping |
| `label`, `goal` | TEXT | official wording |

### `session`

| column | type | notes |
|---|---|---|
| `id` | TEXT PK | |
| `examConfigId`, `configVersion`, `scoringVersion` | TEXT | at creation |
| `mode` | TEXT | `tryout` \| `practice` |
| `rosterJson` | TEXT | item ids (PF-00 integrity) |
| `status` | TEXT | `open` \| `submitted` \| `blocked` |
| `deadlineAt` | TEXT | server-clock deadline (FR-T2) |
| `startedAt`, `submittedAt` | TEXT | |

### `session_snapshot`

| column | type | notes |
|---|---|---|
| `sessionId` | TEXT PK/FK | |
| `snapshotVersion` | TEXT | |
| `questionsJson` | TEXT | frozen question text/options/version/contentHash |
| `answerKeysJson` | TEXT | frozen keys |
| `configJson` | TEXT | frozen config + rules |
| `thresholdsJson` | TEXT | frozen thresholds |
| `approvalJson` | TEXT (nullable) | frozen `ProvisionalApproval`, if approved |
| `taxonomyVersion` | TEXT | |

This is the immutability boundary ([SCORING_METHODOLOGY](../examination/SCORING_METHODOLOGY.md) §7.2).

### `answer_sheet`

| column | type | notes |
|---|---|---|
| `sessionId`, `questionId` | TEXT PK | |
| `selectedOption` | TEXT (nullable) | null = unanswered |
| `answerTimestampMs` | INT | for response time |
| `flagged` | INT (0/1) | |

### `score_result` (stored, never recomputed)

| column | type | notes |
|---|---|---|
| `sessionId` | TEXT PK/FK | |
| `snapshotVersion` | TEXT | |
| `totalJson`, `sectionsJson`, `perQuestionJson` | TEXT | `Bucket` / `ScoreResult` shape |
| `approvalJson` | TEXT (nullable) | the approval ref actually used |
| `blockedErrorCode` | TEXT (nullable) | when stored unscored |
| `scoredAt` | TEXT | |

`Bucket` = `{earned, possible, answeredCount, correctCount}`; TKP `correctCount`=0, `correct`=null
([SCORING_METHODOLOGY](../examination/SCORING_METHODOLOGY.md) §2.2).

### `provider` / `secret_ref`

| column | type | notes |
|---|---|---|
| `provider.id` | TEXT PK | |
| `provider.baseUrl`, `defaultModel`, `headersJson`, `extraParamsJson` | TEXT | user-visible config |
| `provider.timeoutMs`, `capabilityFlagsJson` | TEXT/INT | |
| `secret_ref.providerId` | TEXT PK/FK | |
| `secret_ref.keyLast4` | TEXT | masked tail only |
| `secret_ref.backend` | TEXT | storage backend (file vs OS keychain) |

No plaintext key column ([SECRETS.md](./SECRETS.md)).

### `generation_job` / `generation_batch`

| column | type | notes |
|---|---|---|
| `generation_job.id` | TEXT PK | |
| `generation_job.competencyId`, `count`, `status` | TEXT/INT/TEXT | |
| `generation_job.providerId`, `taskModel`, `promptVersion` | TEXT | |
| `generation_batch.jobId` | TEXT FK | |
| `generation_batch.status`, `failureCategory` | TEXT | one batch → N drafts |
| `generation_batch.draftQuestionIds` | TEXT | array of `question.id` |

Job shape is provisional until [GENERATION_JOBS.md](./GENERATION_JOBS.md) is resolved
([DEVELOPMENT_ROADMAP](../roadmap/DEVELOPMENT_ROADMAP.md)).

### `study_plan` / `metric` (derived cache)

Analytics metrics are **derived on read**, not persisted as truth
([ANALYTICS_ENGINE](./ANALYTICS_ENGINE.md) §7); the only stored analytics-adjacent row is the
user-edited `study_plan` (propose-diff result), which is a user document, not a metric.

## 3. Boundaries

- Physical storage of secrets: [SECRETS.md](./SECRETS.md).
- Relation diagram: [ERD.md](./ERD.md).
- Migration mechanics: [MIGRATION_STRATEGY.md](./MIGRATION_STRATEGY.md).