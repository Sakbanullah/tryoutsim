# ERD

Entity-relationship diagram for the logical schema in
[DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md). Arrows are `—<` one-to-many. Nullable FKs are marked.

```mermaid
erDiagram
  EXAM_CONFIG ||--o{ BASIS_REF : "has"
  EXAM_CONFIG ||--o| THRESHOLDS : "defines"
  EXAM_CONFIG ||--o| PROVISIONAL_APPROVAL : "approved by"
  EXAM_CONFIG ||--o{ SESSION : "configured at creation"
  PACKAGE ||--o{ PACKAGE_VERSION : "versions"
  PACKAGE_VERSION ||--o{ SESSION : "pinned by"
  SESSION ||--|| SESSION_SNAPSHOT : "freezes"
  SESSION ||--o{ ANSWER_SHEET : "collects"
  SESSION ||--o| SCORE_RESULT : "produces"
  SESSION ||--o| SESSION_DELETION : "leaves tombstone on user delete"
  COMPETENCY ||--o{ QUESTION : "owns"
  COMPETENCY ||--o| MATERIAL : "scopes"
  QUESTION ||--o{ ANSWER_SHEET : "answered by"
  QUESTION ||--o{ VALIDATION_RECORD : "validated by"
  QUESTION ||--o{ QUESTION_REVIEW : "reviewed by"
  QUESTION ||--o{ QUESTION_VERSION : "retains"
  QUESTION ||--o{ QUESTION_REPORT : "reported by"
  QUESTION ||--o| OBSERVED_QUESTION_HISTORY : "indexed by"
  MATERIAL ||--o{ MATERIAL_VERSION : "versions"
  PROVIDER ||--o| SECRET_REF : "stores key by"
  PROVIDER ||--o{ GENERATION_JOB : "drives"
  GENERATION_JOB ||--o{ GENERATION_BATCH : "fans out"
  GENERATION_BATCH }o--o{ QUESTION : "produces"
  AI_ROUTING ||--o| PROVIDER : "default"

  EXAM_CONFIG {
    text id PK
    text pathway "storage enum; only CPNS offered"
    text dataProvenance "seed or legacy"
    int examYear
    text state
    int durationMinutes "nullable - NULL = no claim"
    int scoringVersion "integer"
    int configVersion "integer"
    text regulatoryBasisHash
  }
  BASIS_REF {
    text id PK
    text examConfigId FK
    text tier
    text pathway
  }
  THRESHOLDS {
    text examConfigId PK_FK
    text mode
    int total "cumulative NAB only"
    int twk "nullable"
    int tiu "nullable"
    int tkp "nullable"
    text sourceJson "BasisRef naming the clause"
  }
  PROVISIONAL_APPROVAL {
    text id PK
    text configId FK
    int configVersion
    int scoringVersion
    text regulatoryBasisHash
    text approvedByUserAt "evidence, not bound"
    text approvedBy "evidence, not bound"
  }
  SESSION {
    text id PK
    text examConfigId FK
    int configVersion
    int scoringVersion
    text mode "tryout / latihan"
    text packageId FK
    int packageVersion
    text status "open / submitted / blocked"
    int activeMs
    text runningSince "nullable - set while active"
    int durationMs "nullable - NULL = no limit"
  }
  SESSION_SNAPSHOT {
    text sessionId PK_FK
    text snapshotVersion
    text questionsJson "incl. per-question maxScore"
    text answerKeysJson
    text configJson
    text thresholdsJson
    text approvalJson "nullable"
    text packageBindingJson
    text timingJson
    text rosterJson "repeatCount, attemptedBefore"
  }
  SESSION_DELETION {
    text id PK
    text sessionId "no FK - row is gone"
    text mode
    int questionCount
    text deletedAt
  }
  PACKAGE {
    text id PK
    text mode
    text source "builtin / dynamic / custom"
    text retiredAt "nullable"
  }
  PACKAGE_VERSION {
    text packageId PK_FK
    int version PK
    text definitionJson
    text createdAt
    text examConfigId "nullable - optional pin (AUD-87)"
    int examConfigVersion "nullable"
  }
  ANSWER_SHEET {
    text sessionId PK_FK
    text questionId PK_FK
    text selectedOption "null = unanswered"
    int answerTimestampMs "save-order counter"
    int elapsedActiveMs
  }
  SCORE_RESULT {
    text sessionId PK_FK
    text snapshotVersion
    text totalJson
    text byTestJson
    text byCompetencyJson
    text byQuestionJson
    text thresholdsJson
    text approvalJson "nullable"
    text verdictJson "NULL when no verdict possible"
    text verdictWithheldJson "nullable - code + changed[]"
    text timingJson
    text blockedErrorCode "nullable"
    text scoredAt
  }
  QUESTION {
    text id PK
    text competencyId FK
    text test
    text lifecycle "7 states"
    text difficultyAiInitial
    text empiricalDifficultyJson "nullable"
    int dynamicEligible
    text contentHash
    int contentVersion
    text answerKeyValidatedAt "nullable"
  }
  QUESTION_VERSION {
    text questionId PK_FK
    int contentVersion PK
    text contentHash
  }
  QUESTION_REPORT {
    text id PK
    text questionId FK
    int contentVersion
    text severity "critical / non_critical"
    text resolution "nullable = open"
  }
  VALIDATION_RECORD {
    text id PK
    text questionId FK
    text contentHash "run is stale when it differs"
    text result
    text layersJson "T / Q / K"
  }
  QUESTION_REVIEW {
    text id PK
    text questionId FK
    text decision "accepted / edited / rejected / reported / repaired / withdrawn"
    text activity
  }
  OBSERVED_QUESTION_HISTORY {
    text questionId PK_FK
    text lastAnsweredAt "nullable"
    int answerCount
  }
  MATERIAL {
    text id PK
    text status "draft / approved / retired"
    text contentType
    int version
    int approvalVersion "nullable - bound to a version"
  }
  MATERIAL_VERSION {
    text materialId PK_FK
    int version PK
    text bodyJson
  }
  COMPETENCY {
    text id PK
    text parentId
    text test
    text tier
  }
  PROVIDER {
    text id PK
    text baseUrl
    text preset
    text testedAt "nullable - blocks job creation"
  }
  AI_ROUTING {
    text defaultProviderId "nullable"
    text defaultModel "nullable"
  }
  SECRET_REF {
    text providerId PK_FK
    text keyLast4
    text storeEntryName "OS credential store"
  }
  GENERATION_JOB {
    text id PK
    text providerId FK
    text status "queued/running/completed/failed/interrupted"
    int producedCount
    int quarantinedCount
  }
```

## Notes

- `ANSWER_SHEET`'s FK to `QUESTION` points at the **snapshot's frozen question**, keyed by
  `questionId` (stable); content is resolved via `SESSION_SNAPSHOT`, never the live `QUESTION` row
  at read time.
- `SCORE_RESULT.blockedErrorCode` is non-null exactly when a **blocking** code prevented scoring
  (`THRESHOLD_CONFIG_INVALID`, `PREFLIGHT_FAILED`, `REGULATORY_*`). A **verdict-only** code
  (`APPROVAL_MISSING` / `APPROVAL_INVALID` / `APPROVAL_VERSION_MISMATCH`) is stored in
  `verdictWithheldJson`, not here, and the result still carries `totalJson`/`byTestJson`:
  **score and verdict are separate** (§5.6). Ranking:
  [SCORING_METHODOLOGY](../examination/SCORING_METHODOLOGY.md) §11.1.
- `THRESHOLDS` stores the `ThresholdSet` verbatim; there are no `naik*`/`affirmation*` columns — the
  clause a number came from is `sourceJson` ([DATABASE_SCHEMA](./DATABASE_SCHEMA.md) §2).
- `VALIDATION_RECORD` and `QUESTION_REVIEW` are append-only and are what make "no path from `draft`
  to `active` skips the user" auditable after the fact (DB-2). `QUESTION.lifecycle` is a cache of the
  latest state they imply.
- `QUESTION.dynamicEligible` is the sampling gate: `active` alone is not selectable
  ([QUESTION_SPECIFICATION](../examination/QUESTION_SPECIFICATION.md) §6.3).
- `SESSION.status` is three values; "scored vs verdict" is on the `SCORE_RESULT` row, not a fourth
  status ([DATABASE_SCHEMA](./DATABASE_SCHEMA.md) §2, FL-4).
- `GENERATION_JOB → GENERATION_BATCH → QUESTION(draft)` is a two-step relation resolving job→batch→drafts;
  the batch table is elided here but stated in [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) §2.
- `SESSION_DELETION` is content-free and carries no FK back to a removed session. It is the only trace a
  deleted history leaves ([ANALYTICS_ENGINE](./ANALYTICS_ENGINE.md) §7.1, §7.7 — a tombstone is not a permanent purge).
- `SECRET_REF` stores an OS-credential-store entry **name**, never key material ([SECRETS](./SECRETS.md) §2).
