# ERD

Entity-relationship diagram for the logical schema in
[DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md). Arrows are `—<` one-to-many. Nullable FKs are marked.

```mermaid
erDiagram
  EXAM_CONFIG ||--o{ BASIS_REF : "has"
  EXAM_CONFIG ||--o| THRESHOLDS : "defines"
  EXAM_CONFIG ||--o| PROVISIONAL_APPROVAL : "approved by"
  EXAM_CONFIG ||--o{ SESSION : "configured at creation"
  SESSION ||--|| SESSION_SNAPSHOT : "freezes"
  SESSION ||--o{ ANSWER_SHEET : "collects"
  SESSION ||--o| SCORE_RESULT : "produces"
  COMPETENCY ||--o{ QUESTION : "owns"
  QUESTION ||--o{ ANSWER_SHEET : "answered by"
  PROVIDER ||--o| SECRET_REF : "stores key by"
  PROVIDER ||--o{ GENERATION_JOB : "drives"

  EXAM_CONFIG {
    text id PK
    text pathway
    int examYear
    text state
    text scoringVersion
    text configVersion
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
    int naikTotal
    int naikTiu
  }
  PROVISIONAL_APPROVAL {
    text configId PK_FK
    text configVersion
    text scoringVersion
    text regulatoryBasisHash
  }
  SESSION {
    text id PK
    text examConfigId FK
    text mode
    text status
  }
  SESSION_SNAPSHOT {
    text sessionId PK_FK
    text snapshotVersion
    text questionsJson
    text answerKeysJson
  }
  ANSWER_SHEET {
    text sessionId PK_FK
    text questionId PK_FK
    text selectedOption
  }
  SCORE_RESULT {
    text sessionId PK_FK
    text totalJson
    text blockedErrorCode
  }
  QUESTION {
    text id PK
    text competencyId FK
    text test
    text lifecycle
    text contentHash
  }
  COMPETENCY {
    text id PK
    text parentId
    text test
  }
  PROVIDER {
    text id PK
    text baseUrl
  }
  SECRET_REF {
    text providerId PK_FK
    text keyLast4
  }
  GENERATION_JOB {
    text id PK
    text providerId FK
    text competencyId
  }
```

## Notes

- `ANSWER_SHEET`'s FK to `QUESTION` points at the **snapshot's frozen question**, keyed by
  `questionId` (stable); content is resolved via `SESSION_SNAPSHOT`, never the live `QUESTION` row
  at read time.
- `SCORE_RESULT.blockedErrorCode` is non-null exactly when a session is stored **unscored** after a
  409 (`APPROVAL_INVALID` / `APPROVAL_VERSION_MISMATCH` / `THRESHOLD_CONFIG_INVALID`).
- `GENERATION_JOB → GENERATION_BATCH → QUESTION(draft)` is a two-step relation resolving job→batch→drafts;
  the batch table is elided here but stated in [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) §2.