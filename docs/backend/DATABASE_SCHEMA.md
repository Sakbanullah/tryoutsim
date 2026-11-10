# Database Schema

Canonical source for the PostgreSQL 18 logical schema ([ADR-002](../decisions/ADR-002-sqlite.md)).
This is a data model, not DDL (migration mechanics are in [MIGRATION_STRATEGY.md](./MIGRATION_STRATEGY.md)).
Table/column names here are the contract; the frontend never reads them (it speaks HTTP).

---

## 1. Design rules

- **Integers only** for scoring/counts/timing (ms). Percentages are derived, not stored.
- **Snapshot-first, with one explicit exception.** A session binds immutable snapshots; the scoring
  function reads snapshots, never the live question/config tables
  ([SCORING_METHODOLOGY](../examination/SCORING_METHODOLOGY.md) §7). **Pre-flight** is the exception:
  PF-12/PF-13 read the *live* `exam_config` and the current `provisional_approval` to detect drift
  between what the user approved and what the config now is — that comparison is the approval check
  (BR-E3). Nothing read there ever feeds scoring: it can only withhold the verdict (DB-3, scoring §5.6).
  Phrase the rule as *scoring reads snapshots; pre-flight compares snapshots against live rows*. (An
  earlier version of this line said "never the live config tables" without the exception, which an
  implementer would have followed by dropping the drift check — the exact silent-approval failure
  ADR-004 exists for.)
- **Secrets write-only**: provider keys live in the OS credential store and are referenced with a masked
  tail; no key material is ever a column ([SECURITY](../architecture/SECURITY.md) §3, [SECRETS](./SECRETS.md) §2).
- **No invented attributes**: every column traces to a doc requirement (PRD FR / spec §).
- **Nothing historical is deleted.** Additive-first migrations; retained rows for a no-longer-offered
  pathway keep their own identity ([MIGRATION_STRATEGY](./MIGRATION_STRATEGY.md) §2,
  [CPNS_2026_REGULATIONS](../examination/CPNS_2026_REGULATIONS.md) §8 rule 8).
- **Derived-on-read.** Analytics are never stored per session; the only stored session-derived rows are
  the question-level `empirical_difficulty` and the deletion tombstone
  ([ANALYTICS_ENGINE](./ANALYTICS_ENGINE.md) §7.3).

## 2. Core tables

### `exam_config`

| column | type | notes |
|---|---|---|
| `id` | TEXT PK | e.g. `skd-cpns-2026-provisional` |
| `pathway` | TEXT | **`CPNS` only** — `CHECK (pathway = 'CPNS')` (PO D-4, 2026-11-10). A second value is not storable; `SEKOLAH_KEDINASAN` is *not* a valid value. The retained legacy config keeps `dataProvenance = 'legacy'` and its rows are never deleted, but it is filtered from every selectable route, never returned, and never re-tagged with a second pathway value |
| `examYear` | INT | |
| `state` | TEXT | `official_verified` \| `historical` \| `provisional` |
| `dataProvenance` | TEXT | `seed` \| `legacy` — `legacy` rows are retained for evidence/replay and never offered |
| `durationMinutes` | INT (nullable) | NULL = no exam-length claim (the shipped provisional default; UNV-09) |
| `itemCount` | INT | total items |
| `twkCount`,`tiuCount`,`tkpCount` | INT | per sub-test |
| `twkWeight`,`tiuWeight` | INT | 5 / 0 semantics (blank → 0) |
| `tkpWeightMin`,`tkpWeightMax` | INT | 1..5 |
| `maxScore` | INT | 550 for both obtained instruments |
| `notice` | TEXT | human-readable limitation text, rendered beside any verdict and in **Kelola → Konfigurasi Ujian** — never as a start prerequisite (§4.1) |
| `scoringVersion` | INT | monotonic per scoring-rule change (an integer, not TEXT — [SCORING_METHODOLOGY](../examination/SCORING_METHODOLOGY.md) §2.2 types it `number`) |
| `configVersion` | INT | monotonic per content change |
| `regulatoryBasisHash` | TEXT | opaque sha256 over `BasisRef[]` |

### `basis_ref`

| column | type | notes |
|---|---|---|
| `id` | TEXT PK | |
| `examConfigId` | TEXT FK | → `exam_config.id` |
| `tier` | TEXT | evidence tier (`VERIFIED-2026`, `VERIFIED-CURRENT`, `HISTORICAL`, …) |
| `pathway` | TEXT | `CHECK (pathway = 'CPNS')`, NOT NULL — the hash input for CPNS 2026 scoring (D-4) |
| `title`,`source`,`url`,`accessedAt` | TEXT | provenance |

### `thresholds`

| column | type | notes |
|---|---|---|
| `examConfigId` | TEXT PK/FK | one per config |
| `mode` | TEXT | `per_subtest_and_total` \| `per_subtest_only` \| `total_only` \| `none` |
| `twk`,`tiu`,`tkp` | INT (nullable) | NAB per subtest, present iff required by `mode` |
| `total` | INT (nullable) | **cumulative** NAB (321/2024 KELIMA/KETIGA BELAS 311; KEENAM BELAS 286) — the only cumulative column |
| `sourceJson` | TEXT | the `BasisRef` that produced these numbers (tier + pathway + year + scope clause) |

`ThresholdSet` is canonical in [SCORING_METHODOLOGY](../examination/SCORING_METHODOLOGY.md) §5 and
`mode: 'none'` means **no row**, not a row of zeroes. There is no `naikTotal`/`naikTiu`/
`affirmationTotal`/`affirmationTkp` column: those words named instrument *clauses* (KETIGA BELAS,
KELIMA BELAS, KEENAM BELAS), and the clause a number came from is `sourceJson.scope`. Validation
(missing/forbidden per mode, finite integer, `≤` ceiling) is the scoring doc's §5.1/§5.3 — this
table stores what that validation accepts and adds nothing.

### `provisional_approval` (append-only)

| column | type | notes |
|---|---|---|
| `id` | TEXT PK | one row per approval act |
| `configId` | TEXT FK | → `exam_config.id` |
| `configVersion` | INT | the four approval-bound values ([CPNS_2026_REGULATIONS](../examination/CPNS_2026_REGULATIONS.md) §4.3) |
| `scoringVersion` | INT | 〃 |
| `regulatoryBasisHash` | TEXT | 〃 |
| `approvedByUserAt` | TEXT | ISO-8601 UTC, evidence of *when* — not a bound value |
| `approvedBy` | TEXT | local user identity — evidence, not a bound value |
| `acknowledgedWarningsJson` | TEXT | array of `UNV-*` ids ticked in the dialog |

Append-only: re-approval adds a row; "current approval" is the newest row for `(configId,
configVersion)`. Never updated in place, so the history of what was approved when survives. Bound
values are exactly the `ProvisionalApproval` shape in
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
| `explanation` | TEXT | |
| `difficultyAiInitial` | TEXT | `easy` \| `medium` \| `hard` — set at authoring, never rewritten by analytics. Keyed as `difficulty.aiInitial` in the question contract ([QUESTION_SPECIFICATION](../examination/QUESTION_SPECIFICATION.md) §1.1) and in [ANALYTICS_ENGINE](./ANALYTICS_ENGINE.md) §4.1 |
| `empiricalDifficultyJson` | TEXT (nullable) | `{ band, basis, sampleCount, computedAt }`; NULL until the question's own sample is reportable ([ANALYTICS_ENGINE](./ANALYTICS_ENGINE.md) §4.1). Contract key: `difficulty.empirical`. Two distinct fields, never merged |
| `lifecycle` | TEXT | `draft` \| `ai_validated` \| `human_reviewed` \| `active` \| `quarantined` \| `rejected` \| `archived` — all seven states of [QUESTION_SPECIFICATION](../examination/QUESTION_SPECIFICATION.md) §3, nothing collapsed |
| `dynamicEligible` | INT (0/1) | the quality gate is satisfied (§6.3 there); `active` alone is not selectable |
| `answerKeyValidatedAt` | TEXT (nullable) | activation prerequisite (§3); NULL blocks `active` |
| `quarantinedReason` | TEXT (nullable) | required iff `lifecycle = 'quarantined'` |
| `provenanceJson` | TEXT | `Provenance` (origin, model/provider, prompt/version, generationId, **batchId**, generatedAt, sampling) |
| `contentHash` | TEXT | for dedup/dup-cluster (V-08/09) |
| `taxonomyVersion` | TEXT | |
| `contentVersion` | INT | bumps on ANY edit; sessions freeze it (§7.1) |

Provenance, difficulty, eligibility and lifecycle are
[QUESTION_SPECIFICATION](../examination/QUESTION_SPECIFICATION.md) §1–§3, §6.

### `question_version` (append-only)

| column | type | notes |
|---|---|---|
| `questionId`, `contentVersion` | TEXT/INT PK | |
| `contentHash`, `stem`, `optionsJson`, `answerKeyJson`, `explanation` | TEXT | the exact content of that version |
| `createdAt` | TEXT | |

Every content version is retained so a past session's wording can be read back and so a repair never
destroys what was scored ([QUESTION_SPECIFICATION](../examination/QUESTION_SPECIFICATION.md) §7.2).
Nothing in this table is ever updated or deleted.

### `question_report` (append-only)

| column | type | notes |
|---|---|---|
| `id` | TEXT PK | |
| `questionId` | TEXT FK | |
| `contentVersion` | INT | the version the report was filed against |
| `reportedAt` | TEXT | |
| `severity` | TEXT | `critical` \| `non_critical` — the reporting user's choice from a closed set |
| `category` | TEXT | `wrong_key` \| `ambiguous` \| `typo` \| `explanation_unclear` \| `other` |
| `note` | TEXT (nullable) | |
| `resolution` | TEXT (nullable) | `repaired` \| `withdrawn` \| `rejected` \| NULL = open |
| `resolvedAt` | TEXT (nullable) | |

A `critical` report sets the question to `quarantined` immediately (auto-quarantine) and raises a
notification; the final decision remains the user's
([QUESTION_SPECIFICATION](../examination/QUESTION_SPECIFICATION.md) §6.5).

### `validation_record` (append-only)

| column | type | notes |
|---|---|---|
| `id` | TEXT PK | |
| `questionId` | TEXT FK | → `question.id` |
| `contentVersion` | INT | the version this run validated |
| `contentHash` | TEXT | the hash of the content this run validated — a record is stale when it differs from `question.contentHash` (T-layer V-01…V-13, §5) |
| `result` | TEXT | `pass` \| `fail` \| `flagged` (aggregate over layers) |
| `layersJson` | TEXT | one entry per layer `{ layer: 'T'\|'Q'\|'K', result, checks[] }`, with the model id for Q/K |
| `validatorVersion` | TEXT | |
| `validatedAt` | TEXT | |

### `question_review` (append-only)

| column | type | notes |
|---|---|---|
| `id` | TEXT PK | |
| `questionId` | TEXT FK | → `question.id` |
| `reviewer` | TEXT | local user identity |
| `reviewedAt` | TEXT | |
| `decision` | TEXT | `accepted` \| `edited` \| `rejected` \| `reported` \| `repaired` \| `withdrawn` |
| `activity` | TEXT | `content` \| `batch_decision` \| `sample_review` \| `report_triage` \| `repair` |
| `editsJson` | TEXT (nullable) | `[{ field, beforeHash, afterHash }]` |
| `answerKeyValidatedBy`, `answerKeyValidatedAt` | TEXT (nullable) | key validation is separate from content review (§4) |
| `notes` | TEXT (nullable) | |

These two tables are what make FR-Q2 ("all validation checks and review history") renderable and
what make the "no path from `draft` to `active` skips the user" guarantee **verifiable after the
fact** rather than merely intended (DB-2). Both are append-only: nothing is updated or deleted, and
`question.lifecycle` is a cache of the latest state derivable from them.

### `competency`

| column | type | notes |
|---|---|---|
| `id` | TEXT PK | leaf or domain id from taxonomy |
| `parentId` | TEXT FK nullable | hierarchy |
| `test` | TEXT | grouping |
| `label`, `goal` | TEXT | working label and goal from taxonomy §3–§6 (never presented as official CPNS 2026 text) |
| `tier` | TEXT | `EVIDENCE-BACKED-NOT-CPNS-2026` \| `UNVERIFIED` \| `DEPRECATED` ([COMPETENCY_TAXONOMY](../examination/COMPETENCY_TAXONOMY.md) §1) |

### `session`

| column | type | notes |
|---|---|---|
| `id` | TEXT PK | |
| `examConfigId`, `configVersion`, `scoringVersion` | INT | at creation, copied from the config; `configId` = `examConfigId` |
| `mode` | TEXT | `tryout` \| `latihan` |
| `packageId`, `packageVersion` | TEXT/INT | the **package version this session was created from**, frozen ([PACKAGE_SPECIFICATION](../product/PACKAGE_SPECIFICATION.md) §5) |
| `rosterJson` | TEXT | item ids (PF-00 integrity) |
| `status` | TEXT | `open` \| `submitted` \| `blocked` — see the state machine below |
| `activeMs` | INT | accumulated **active** time, never calendar time (scoring §8.1) |
| `runningSince` | TEXT (nullable) | set while active; NULL while paused |
| `durationMs` | INT (nullable) | the countdown the session was started with; NULL = no limit |
| `startedAt`, `submittedAt` | TEXT | |
| ~~`deletedAt`~~ | — | **removed** (PO D-2, 2026-11-10). It was never observable: the row is deleted in the same transaction that would have written it, and nothing reads it. The absence of a `session` row *is* the deletion; the content-free tombstone in `session_deletion` is the record. Deletion is now a single function call — see **Deletion (D-1)** below, not a two-step write-then-delete |

**Session state machine (FL-4).** Three `status` values, with "scored" kept on the result row
(`score_result`, 1:1) rather than duplicated as a fourth status — one fact, one place:

```
open ──submit──► submitted ──/score──► submitted + score_result
  │                  └──verdict withheld (score stored)───► submitted + score_result (verdict null)
  └──(roster/config invalid at start)──► blocked
```

- `submitted` means the answer sheet is **frozen**. Answers may not be patched after submit
  (`PATCH /sessions/:id/answers` → 409), which is what makes the "answers preserved, never rewritten"
  promise real.
- Submit is **always scorable**: a provisional config without thresholds, or with a lapsed approval,
  produces a score and no verdict ([SCORING_METHODOLOGY](../examination/SCORING_METHODOLOGY.md) §5.6).
  `POST /sessions/:id/score` is only needed after a genuine pre-flight abort (codes 1 or 6).
- A `submitted` session with a `score_result` is never re-scored or re-scored under
  a different snapshot ([SCORING_METHODOLOGY](../examination/SCORING_METHODOLOGY.md) §7).
- `blocked` is reserved for a session that never legitimately started; it is not an unscored state.

**Atomicity (DB-6).** `POST /sessions` writes `session` + `session_snapshot` in **one PostgreSQL
transaction** (all-or-nothing). `POST /sessions/:id/score` likewise writes `score_result` in one
transaction, so a session is never observably "half-scored".

**Deletion (D-1, PO 2026-11-10).** `DELETE /sessions/:id` removes the session, its snapshot, its answers
and its result ([ANALYTICS_ENGINE](./ANALYTICS_ENGINE.md) §7.3) through **exactly one path**:
`tryoutsim.delete_session(text)`, a `SECURITY DEFINER` function. Its guarantees, all of which are
requirements rather than conventions:

- **Owner** `tryoutsim_migrator` (never superuser); `SET search_path = pg_catalog, public` pinned at
  creation; every object referenced schema-qualified; **no dynamic SQL**.
- `REVOKE ALL … FROM PUBLIC`; `GRANT EXECUTE` to `tryoutsim_app` only.
- The runtime role holds **no `UPDATE`, `DELETE` or `TRUNCATE`** on `session`, `session_snapshot`,
  `answer_sheet`, `score_result` or `session_deletion` — privilege is the first line of defence; the
  append-only triggers (T-1…T-13) raise unconditionally behind it, with no bypass flag and no GUC.
- The function locks the parent row `FOR UPDATE`, returns `false` when it does not exist (the caller maps
  that to `404` without learning anything more), writes the content-free tombstone **first**, then deletes
  the children and the parent — so a raised exception anywhere leaves nothing deleted.
- It returns `boolean` and **never** reports why a session is not deletable (no object-existence oracle).
- A single function body is a single transaction, so DB-6 holds by construction: no caller can interleave
  a second statement between the tombstone and the parent delete.

**Bulk deletion (D-3).** Each session is one call and one transaction. One session's failure does **not**
roll back another session's completed deletion; the caller reports per-session outcomes in requested order.
The invariants above hold for every session in a batch.

### `session_snapshot`

| column | type | notes |
|---|---|---|
| `sessionId` | TEXT PK/FK | |
| `snapshotVersion` | TEXT | |
| `questionsJson` | TEXT | frozen question text/options/version/contentHash, **plus each question's `maxScore`** so `byQuestion[].maxScore` survives after an edit |
| `answerKeysJson` | TEXT | frozen keys |
| `configJson` | TEXT | frozen config + rules |
| `thresholdsJson` | TEXT | frozen thresholds |
| `approvalJson` | TEXT (nullable) | frozen `ProvisionalApproval`, if one existed at start |
| `packageBindingJson` | TEXT | `{ packageId, packageVersion, mode, kind, rosterHash }` ([PACKAGE_SPECIFICATION](../product/PACKAGE_SPECIFICATION.md) §5) |
| `timingJson` | TEXT | frozen `SessionSnapshot.timing` (scoring §8.1) |
| `rosterJson` | TEXT | `{ repeatCount, attemptedBefore }` — honest repeat accounting |
| `taxonomyVersion` | TEXT | |

This is the immutability boundary ([SCORING_METHODOLOGY](../examination/SCORING_METHODOLOGY.md) §7.2).

### `session_deletion` (append-only tombstone)

| column | type | notes |
|---|---|---|
| `id` | TEXT PK | |
| `sessionId` | TEXT | the deleted session's id (no FK: the row is gone) |
| `mode`, `configId`, `configVersion` | TEXT/INT | what it was |
| `startedAt`, `finishedAt` | TEXT | |
| `questionCount` | INT | |
| `deletedAt` | TEXT | |
| `deletionKind` | TEXT | `user_delete` for the MVP operation. A physical purge is **not** implemented and gets no value until approved ([ANALYTICS_ENGINE](./ANALYTICS_ENGINE.md) §7.7) |

Content-free by construction: no answers, no stem text, no score, no metric. It exists so an empty
analytics panel can say *why* it is empty ([ANALYTICS_ENGINE](./ANALYTICS_ENGINE.md) §7.4).

**A tombstone is not a permanent deletion.** Deleting a session removes it from views and from analysis and
leaves this row; it does not erase every trace, and the app never claims it does (§7.1, §7.7 there).

### `answer_sheet`

| column | type | notes |
|---|---|---|
| `sessionId`, `questionId` | TEXT PK | |
| `selectedOption` | TEXT (nullable) | null = unanswered |
| `answerTimestampMs` | INT | monotonic revision counter for last write (per-session save order) |
| `elapsedActiveMs` | INT | active time spent on the question, from the session clock (scoring §8.1) |
| `flagged` | INT (0/1) | |

### `score_result` (stored, never recomputed)

| column | type | notes |
|---|---|---|
| `sessionId` | TEXT PK/FK | |
| `snapshotVersion` | TEXT | |
| `totalJson`, `byTestJson`, `byCompetencyJson`, `byQuestionJson`, `thresholdsJson` | TEXT | the `ScoreResult` of [SCORING_METHODOLOGY](../examination/SCORING_METHODOLOGY.md) §2.2, field-for-field (renamed from `sectionsJson`/`perQuestionJson` — there is one result shape, API-1) |
| `approvalJson` | TEXT (nullable) | `ScoreApprovalRef` = the `ProvisionalApproval` actually used to emit a verdict |
| `verdictJson` | TEXT (nullable) | the `ThresholdEvaluation` (§5.4) — **NULL when no verdict is possible** (no thresholds, or approval missing/invalid). Never `{passed: false}` as a placeholder |
| `timingJson` | TEXT | elapsed active time and per-section timing, evidence only |
| `blockedErrorCode` | TEXT (nullable) | the ranked **blocking** code that aborted pre-flight (`PREFLIGHT_FAILED`, `THRESHOLD_CONFIG_INVALID`, `REGULATORY_*`) ([SCORING_METHODOLOGY](../examination/SCORING_METHODOLOGY.md) §11.1) |
| `verdictWithheldJson` | TEXT (nullable) | `{ code: APPROVAL_*, changed: ChangeEntry[] }` when a verdict-only condition withheld the verdict while the score was written |
| `scoredAt` | TEXT | |

`Bucket` = `{earned, possible, answeredCount, correctCount}`; TKP `correctCount`=0, `correct`=null
([SCORING_METHODOLOGY](../examination/SCORING_METHODOLOGY.md) §2.2).

### `provider` / `secret_ref`

| column | type | notes |
|---|---|---|
| `id` | TEXT PK | |
| `providerId`, `defaultModel`, `headersJson`, `extraParamsJson`, `baseUrl` | TEXT | user-visible config |
| `preset` | TEXT | `openrouter` \| `openai_compatible` \| `ollama` \| `custom` ([AI_PROVIDER_ARCHITECTURE](../ai/AI_PROVIDER_ARCHITECTURE.md) §3) |
| `timeoutMs`, `capabilityFlagsJson` | INT / TEXT | capabilities carry `source` (`auto`/`manual`) and `detectedAt` (§6 there) |
| `testedAt` | TEXT (nullable) | last successful connection test for the current `defaultModel`; NULL blocks job creation |
| `modelCacheJson` | TEXT (nullable) | last `listModels()` result, refreshed by `POST /providers/:id/models`. Transient: read-only display, dropped when the provider is deleted, never used to decide behaviour — a stale list must not silently restrict a model the user typed ([AI_PROVIDER_ARCHITECTURE](../ai/AI_PROVIDER_ARCHITECTURE.md) §5) |
| `secret_ref.providerId` | TEXT PK/FK | |
| `secret_ref.keyLast4` | TEXT | masked tail only |
| `secret_ref.hasKey` | INT (0/1) | false for keyless providers and after a cross-machine restore |
| `secret_ref.storeEntryName` | TEXT | name of the OS credential-store entry (no key material) |
| `secret_ref.storeKind` | TEXT | `windows_credential_manager` \| `macos_keychain` \| `secret_service` |

No plaintext key column ([SECRETS.md](./SECRETS.md) §2).

### `ai_routing` (single row)

| column | type | notes |
|---|---|---|
| `defaultProviderId`, `defaultModel` | TEXT (nullable) | the one global default; NULL = no default |
| `perTaskJson` | TEXT | `{ question?, explanation?, material?, analysis? }` overrides ([AI_PROVIDER_ARCHITECTURE](../ai/AI_PROVIDER_ARCHITECTURE.md) §4) |

**Provider writes span two stores (DB-4).** `provider` lives in PostgreSQL; the key lives in the secret
store outside it ([SECRETS.md](./SECRETS.md) §2). The order is fixed so a crash never leaves an
orphaned key, which is the leak class NFR-7 forbids:

- **Create** — write the secret first, then the `provider` row; if the row insert fails, purge the
  secret before returning the error. A secret without a provider is unreachable and purgeable; a
  provider without a secret is not.
- **Delete** — delete the `provider` row first (inside a transaction that also cascades), then purge
  the secret. Failing to purge is logged as an orphan and retried at startup; failing to delete the
  row fails the request.
- **Cascade** — `generation_job.providerId` is `ON DELETE CASCADE` for **finished** jobs (history is
  kept through the job's own `promptVersion`/`taskModel` snapshot) and `ON DELETE RESTRICT` while a
  job is `queued`/`running` (403-style `409 CONFLICT` at the endpoint). The ERD states the rule in
  one line; the schema owns the detail here.

### `generation_job` / `generation_batch`

| column | type | notes |
|---|---|---|
| `generation_job.id` | TEXT PK | |
| `generation_job.competencyIdsJson`, `count`, `status` | TEXT/INT/TEXT | `status` ∈ the six statuses of [GENERATION_JOBS](./GENERATION_JOBS.md) §2 |
| `generation_job.providerId`, `taskModel`, `promptVersion` | TEXT | |
| `generation_job.producedCount`, `quarantinedCount`, `partial` | INT | partial output is reported, never discarded (§3 there) |
| `generation_batch.jobId` | TEXT FK | |
| `generation_batch.status`, `failureCategory` | TEXT | `completed` \| `failed` \| `interrupted`; one batch → N drafts |
| `generation_batch.rawResponseRef` | TEXT (nullable) | **scrubbed** provider response, kept for inspection |
| `generation_batch.draftQuestionIds` | TEXT | array of `question.id` |

Job persistence shape is decided ([GENERATION_JOBS](./GENERATION_JOBS.md) §4): two tables, batch is the
atomic unit. Restart/crash recovery is [GENERATION_JOBS](./GENERATION_JOBS.md) §5.

### `notification`

| column | type | notes |
|---|---|---|
| `id` | TEXT PK | |
| `type` | TEXT | closed set, [NOTIFICATION_SPECIFICATION](./NOTIFICATION_SPECIFICATION.md) §2 |
| `severity` | TEXT | `info` \| `action` \| `warning` \| `error` |
| `titleKey` | TEXT | message-catalogue key |
| `paramsJson` | TEXT | interpolation values — never a key, never a score |
| `linkJson` | TEXT (nullable) | `{ route, entityId }` |
| `entityId` | TEXT | owning record id, for idempotency (`type`,`entityId`) |
| `createdAt`, `readAt`, `dismissedAt` | TEXT | `readAt`/`dismissedAt` nullable |

### `backup_record`

| column | type | notes |
|---|---|---|
| `id` | TEXT PK | |
| `mode` | TEXT | `automatic` \| `manual` |
| `startedAt`, `finishedAt` | TEXT | |
| `status` | TEXT | `succeeded` \| `failed` |
| `filePath`, `fileSizeBytes` | TEXT/INT (nullable) | NULL on failure |
| `failureReason` | TEXT (nullable) | why it failed; never a secret |
| `schemaVersion` | INT | archive schema version, for restore compatibility |

Backup/restore rules are [DEPLOYMENT_AND_BACKUP](../architecture/DEPLOYMENT_AND_BACKUP.md) §2–§3.

### `package` / `package_version`

| column | type | notes |
|---|---|---|
| `package.id` | TEXT PK | |
| `package.mode`, `package.source` | TEXT | `tryout`/`latihan`; `builtin`/`dynamic`/`custom` |
| `package.retiredAt` | TEXT (nullable) | retired packages stay readable for their sessions |
| `package_version.packageId`, `version` | TEXT/INT PK | monotonic per package |
| `package_version.definitionJson` | TEXT | `PackageDefinition` ([PACKAGE_SPECIFICATION](../product/PACKAGE_SPECIFICATION.md) §1) |
| `package_version.titleId`, `createdAt` | TEXT | |
| `package_version.examConfigId`, `examConfigVersion` | TEXT/INT (nullable) | the custom-package pin (AUD-87, PO 2026-11-10): the config+version the definition was authored against. Nullable, no FK — the pin may name a config that has since changed; resolution falls through when it is no longer usable ([CPNS_2026_REGULATIONS](../examination/CPNS_2026_REGULATIONS.md) §4.2.1) |

A package version is immutable; saving a change inserts a new row ([PACKAGE_SPECIFICATION](../product/PACKAGE_SPECIFICATION.md) §5).

### `observed_question_history` (derived index)

| column | type | notes |
|---|---|---|
| `questionId` | TEXT PK | |
| `lastAnsweredAt` | TEXT (nullable) | used by the repeat rule: least-recently-answered first |
| `answerCount` | INT | how many times the question has been answered, any mode |

Derived from `answer_sheet` and rebuilt on demand; it holds no score and no answer content. It is the only
index the selector needs ([PACKAGE_SPECIFICATION](../product/PACKAGE_SPECIFICATION.md) §4.2).

### `study_plan` — **not in MVP**

Analytics metrics are **derived on read**, not persisted as truth
([ANALYTICS_ENGINE](./ANALYTICS_ENGINE.md) §6). MVP stores **no** plan table: a standalone Rencana Belajar
feature is not approved ([RECOMMENDATION_ENGINE](../ai/RECOMMENDATION_ENGINE.md) §7,
[MVP_SCOPE](../product/MVP_SCOPE.md) §2). A user-editable plan table is a recorded proposal only and must
not be created until the Product Owner approves the feature. The learning sequence itself is derived on
read.

### `material` / `material_version` — **in MVP**

The earlier decision DB-1 ("no material bank") is **superseded** (2026-11-08): materials are in MVP.
The record, sources, approval and validation are
[MATERIAL_SPECIFICATION](../examination/MATERIAL_SPECIFICATION.md); this table stores what that spec
accepts and adds nothing.

| column | type | notes |
|---|---|---|
| `material.id` | TEXT PK | |
| `material.title`, `contentType` | TEXT | `conceptual` \| `strategy` \| `factual` \| `legal` \| `historical` \| `policy` |
| `material.scopeJson` | TEXT | `{ kind: 'competency'\|'domain', competencyId }` or `{ kind: 'free', note }` |
| `material.status` | TEXT | `draft` \| `approved` \| `retired` |
| `material.provenanceJson` | TEXT | `manual` / `ai_drafted` / `ai_drafted_reviewed` + provider, model, prompt, timestamps |
| `material.version` | INT | bumps on any edit |
| `material.sourcesJson` | TEXT | `SourceRef[]` — required for factual/legal/historical/policy |
| `material.approvalVersion`, `approvedAt` | INT/TEXT (nullable) | approval is bound to a **version** |
| `material_version.materialId`, `version` | TEXT/INT PK | append-only content history |
| `material_version.bodyJson` | TEXT | the exact body of that version |

## 3. Enforced objects (PO D-8, 2026-11-10)

Everything in this section is a database object, not a convention. Nothing here overrides a rule owned by
another canonical doc — where it does, the pointer wins and this section only says *how* the rule is
enforced. Line references are to §2 above. The constraint reasoning and the rejected alternatives are in
[SCHEMA_CONTRACT_REVIEW](./SCHEMA_CONTRACT_REVIEW.md) §1.

### 3.1 Closed sets

Each is also a TypeScript union in exactly one canonical doc; the check, the Prisma `enum` and the union
change together in one commit.

| id | Column | Values |
|---|---|---|
| C-1 | `exam_config.state` | `official_verified` \| `historical` \| `provisional` |
| C-2 | `exam_config.dataProvenance` | `seed` \| `legacy` |
| C-3 | `exam_config.pathway` | `CPNS` only (D-4) |
| C-4 | `basis_ref.pathway` | `CPNS` only, NOT NULL (D-4) |
| C-5 | `basis_ref.tier` | the five evidence tiers + `EVIDENCE-BACKED-NOT-CPNS-2026` ([CPNS_2026_REGULATIONS](../examination/CPNS_2026_REGULATIONS.md) §0) |
| C-6 | `thresholds.mode` | `per_subtest_and_total` \| `per_subtest_only` \| `total_only` \| `none` |
| C-7 | `question.test` | `TWK` \| `TIU` \| `TKP` |
| C-8 | `question.lifecycle` | the seven values in §2 ([QUESTION_SPECIFICATION](../examination/QUESTION_SPECIFICATION.md) §3) |
| C-9 | `question_report.severity` · `category` · `resolution` | 2 / 5 / 3 values as specified |
| C-10 | `validation_record.result` | `pass` \| `fail` \| `flagged` |
| C-11 | `question_review.decision` · `activity` | 6 / 5 values as specified |
| C-12 | `competency.tier` | `EVIDENCE-BACKED-NOT-CPNS-2026` \| `UNVERIFIED` \| `DEPRECATED` |
| C-13 | `session.mode` · `status` | 2 / 3 values |
| C-14 | `score_result.blockedErrorCode` | the five codes (SCORING_METHODOLOGY §5.6) |
| C-15 | `session_deletion.deletionKind` | `'user_delete'` only |
| C-16 | `provider.preset` | 4 values |
| C-17 | `secret_ref.storeKind` | 3 values |
| C-18 | `generation_job.status` | 5 values |
| C-19 | `generation_batch.status` | 3 values |
| C-20 | `notification.severity` · `type` | 4 values / [NOTIFICATION_SPECIFICATION](./NOTIFICATION_SPECIFICATION.md) §2 |
| C-21 | `backup_record.mode` · `status` | 2 / 2 values |
| C-22 | `package.mode` · `source` | 2 / 3 values |
| C-23 | `material.contentType` · `status` | 6 / 3 values |

### 3.2 Bounds and pairings

| id | Constraint |
|---|---|
| B-1 | `exam_config.itemCount = twkCount + tiuCount + tkpCount`, all `>= 0` |
| B-2 | `exam_config.twkWeight IN (0,5) AND tiuWeight IN (0,5)` |
| B-3 | `exam_config.tkpWeightMin BETWEEN 1 AND 5 AND tkpWeightMin <= tkpWeightMax` |
| B-4 | `exam_config.durationMinutes IS NULL OR > 0`; `maxScore > 0` |
| B-5 | `exam_config.scoringVersion > 0 AND configVersion > 0` |
| B-6 | `thresholds`: presence of `twk`/`tiu`/`tkp`/`total` matches `mode`; each present value `>= 0` (presence rules are [SCORING_METHODOLOGY](../examination/SCORING_METHODOLOGY.md) §5.1) |
| B-7 | `provisional_approval.scoringVersion > 0 AND configVersion > 0` |
| B-8 | `question.dynamicEligible IN (0,1)`; `question.contentVersion > 0` |
| B-9 | `question.lifecycle = 'quarantined'` ⇒ `quarantinedReason` non-empty |
| B-10 | `question.difficultyAiInitial IN ('easy','medium','hard')` |
| B-11 | `question_report.resolution` and `resolvedAt` are null together |
| B-12 | `competency.parentId <> id` |
| B-13 | `session.activeMs >= 0`; `durationMs IS NULL OR > 0`; `configVersion > 0`; `scoringVersion > 0` |
| B-14 | `answer_sheet.flagged IN (0,1)`; `answerTimestampMs >= 0`; `elapsedActiveMs >= 0` |
| B-15 | `session_deletion.questionCount >= 0`; `observed_question_history.answerCount >= 0` |
| B-16 | `provider.timeoutMs > 0`; `secret_ref.hasKey IN (0,1)` |
| B-17 | `generation_job.count >= 1`, `producedCount >= 0`, `quarantinedCount >= 0`, `partial IN (0,1)` |
| B-18 | `backup_record.fileSizeBytes >= 0`, `schemaVersion >= 0`; on `status='failed'` both path and size are NULL |
| B-19 | `package_version.version > 0`; `material.version > 0`; `material_version.version > 0` |
| B-20 | `material.status='approved'` ⇒ `approvalVersion` and `approvedAt` both non-null, and null together |

### 3.3 Append-only triggers

Every trigger is `ENABLE ALWAYS`: a plain `ENABLE` trigger is disabled by `session_replication_role = replica`,
which a restore may set. Each forbids `UPDATE`, `DELETE` and `TRUNCATE` on its table by raising SQLSTATE
`23001`; the permitted operation is the first step of deletion through `tryoutsim.delete_session` (§2).

| id | Table | Permitted | Forbidden |
|---|---|---|---|
| T-1 | `provisional_approval` | INSERT | UPDATE, DELETE, TRUNCATE |
| T-2 | `question_version` | INSERT | UPDATE, DELETE, TRUNCATE |
| T-3 | `question_report` | INSERT, UPDATE while `resolution IS NULL` | DELETE, TRUNCATE; UPDATE after resolution |
| T-4 | `validation_record` | INSERT | UPDATE, DELETE, TRUNCATE |
| T-5 | `question_review` | INSERT | UPDATE, DELETE, TRUNCATE |
| T-6 | `session_snapshot` | INSERT; DELETE only via the delete function | UPDATE, TRUNCATE |
| T-7 | `score_result` | INSERT; DELETE only via the delete function; UPDATE of `verdictJson`/`approvalJson`/`verdictWithheldJson` only, only while `verdictJson IS NULL`, only via `tryoutsim.add_session_verdict` (AUD-85) | every other UPDATE, TRUNCATE |
| T-8 | `session_deletion` | INSERT (via the delete function only) | UPDATE, DELETE, TRUNCATE |
| T-9 | `package_version` | INSERT | UPDATE, DELETE, TRUNCATE |
| T-10 | `material_version` | INSERT | UPDATE, DELETE, TRUNCATE |
| T-11 | `session` | INSERT, UPDATE while `open`; status transition per the state machine | `submittedAt` reset to NULL; `submitted` → `open` |
| T-12 | `answer_sheet` | INSERT/UPDATE while the parent session is `open`; DELETE only via the delete function | any write once `submitted` |
| T-13 | `thresholds` | INSERT | UPDATE, DELETE once the owning config version is historical |

**No trigger** on `question`, `exam_config`, `provider`, `notification`, `backup_record`, `generation_job`,
`generation_batch`, `package`, `material`, `observed_question_history`, `ai_routing`, `secret_ref`,
`competency`, `basis_ref` — these legitimately update, and their history constraints are version rows or
business rules.

### 3.4 Deliberately not a database constraint

| Rule | Where it lives instead |
|---|---|
| `thresholds.* <= exam_config.maxScore` (ceiling) | SCORING_METHODOLOGY §5.3 validation |
| a threshold set on a non-`VERIFIED-2026` basis requires an approval row | SCORING_METHODOLOGY §5.4, §11 |
| `score_result.verdictJson IS NULL` iff no valid approval | scoring function |
| `blockedErrorCode IS NULL` iff `totalJson` present | scoring function |
| `session.durationMs` = `snapshot.timing.durationMs` | pre-flight |
| `session.rosterJson` has unique ids | pre-flight |
| question lifecycle transitions are the only legal ones | QUESTION_SPECIFICATION §3 (the column is a cache derivable from history; a full state machine in a trigger would duplicate that rule) |
| `session.status='submitted'` ⇒ a `score_result` row exists | DB-6 transaction, app |
| `basis_ref` rows hash to `regulatoryBasisHash` | app (sha256 over ordered rows) |
| retention/purge of `notification` rows | retention policy, not a row invariant |

Named so that nobody "adds the missing check" and duplicates a rule that already has one canonical home.

### 3.5 Grants, partial indexes, collation

- **Grants are provisioning SQL, never a migration** — Prisma emits no privilege, and a migration cannot run
  as the provisioning role. Role split, the default-privilege ordering trap and the full matrix:
  [SCHEMA_CONTRACT_REVIEW](./SCHEMA_CONTRACT_REVIEW.md) §2.6; the operating requirement in
  [DEPLOYMENT_AND_BACKUP](../architecture/DEPLOYMENT_AND_BACKUP.md) §1.5.
- **Partial indexes are custom SQL** (D-8), written in a `--create-only` migration. They are performance
  objects, not invariants: each needs its documented query. P-1 `question`
  (`lifecycle='active' AND dynamicEligible=1`), P-2 `generation_job` (`status IN ('queued','running')`), P-3
  `session` (`status='submitted'`, the analytics scope), P-4 `question_report` (`resolution IS NULL`), P-5
  `notification` (`readAt IS NULL`).
- **No exclusion constraint and no non-B-tree index** has a documented need. All uniqueness here is PK/UNIQUE
  expressible; all stored JSON is `TEXT` and never queried by containment. Adding either requires a written
  need first ([ADR-008](../decisions/ADR-008-dependency-minimalism.md)).
- **`COLLATE "C"` on every `TEXT` identifier that is an opaque id** (D-5), on both sides of every FK and in
  every composite key, so identifier comparison is byte-wise and not locale-dependent. Not on ordinary text or
  search fields. A locale-collated id column would make `'A'` and `'a'` equal identifiers on some locales.

### 3.6 Migration-tooling facts the schema depends on

- The migration table is **`_prisma_migrations`**, owned by the migration role; the application role gets
  `SELECT` only. It carries no schema object of this document and no constraint references it.
- Prisma's `diff` does not see triggers or `CHECK`s, so a generated migration that drops and recreates a table
  silently loses them — the reason [MIGRATION_STRATEGY](./MIGRATION_STRATEGY.md) §1 forbids destructive steps
  without review.

## 4. Boundaries

- Physical storage of secrets: [SECRETS.md](./SECRETS.md).
- Relation diagram: [ERD.md](./ERD.md).
- Migration mechanics: [MIGRATION_STRATEGY.md](./MIGRATION_STRATEGY.md).