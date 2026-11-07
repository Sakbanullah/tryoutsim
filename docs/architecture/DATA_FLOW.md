# Data Flow

Canonical source for the **end-to-end data flows** that cross component boundaries. Each flow is one
Mermaid sequence; layer responsibilities stay in the components' own docs, not restated here.

---

## 1. Bootstrap (first run → dashboard)

```mermaid
sequenceDiagram
  participant UI
  participant API
  participant DB
  UI->>API: GET /bootstrap
  API->>DB: read taxonomy + configs + providers + summary
  DB-->>API: rows
  API-->>UI: taxonomy, exam-configs, provider status, empty bank
```

## 2. Generate questions

```mermaid
sequenceDiagram
  participant UI
  participant API
  participant Jobs
  participant Provider
  UI->>API: POST /generation-jobs
  API->>Jobs: enqueue batches
  loop each batch
    Jobs->>Provider: chat (prompt template)
    Provider-->>Jobs: raw response
    Jobs->>Jobs: parse + AI validation [AI_VALIDATION]
    Jobs-->>DB: draft questions (lifecycle=draft, provenance complete)
  end
  API-->>UI: job + drafts, per-batch status
```

## 3. Start + score a session (the score pipeline)

```mermaid
sequenceDiagram
  participant UI
  participant API
  participant Snap
  participant Score
  participant DB
  UI->>API: POST /sessions
  API->>Snap: freeze SessionSnapshot (questions, keys, config, rules, thresholds, approval)
  Snap-->>DB: persist snapshot + session
  API-->>UI: session + snapshotVersion
  UI->>API: POST /sessions/:id/submit (sheets)
  API->>Score: preflight(snapshot, sheets)  [SCORING_METHODOLOGY §6]
  alt preflight fails
    Score-->>API: PREFLIGHT_FAILED { errors[] }
    API-->>UI: 422, nothing scored
  else approval invalid
    Score-->>API: APPROVAL_INVALID { changed[] }
    API-->>UI: 409, stored unscored
  else ok
    Score->>Score: scoreSession(preflighted)  [pure, snapshot-only]
    Score-->>DB: ScoreResult + snapshotVersion + approval ref
    Score-->>UI: ScoreResult
  end
```

## 4. Analytics

```mermaid
sequenceDiagram
  participant UI
  participant API
  participant Analytics
  participant DB
  UI->>API: GET /analytics
  API->>DB: sessions + ScoreResult + answer log + difficulty
  DB-->>Analytics: raw rows
  Analytics->>Analytics: metrics (accuracy / attainment, sample rules)
  Analytics-->>UI: AnalyticsSnapshot (percentages + counts, no re-scoring)
```

## 5. Recommendations → study plan

```mermaid
sequenceDiagram
  Analytics->>Reco: AnalyticsSnapshot
  Reco->>Reco: rank weaknesses (compute deficit, exclude insufficient)
  Reco->>DB: match material by competency
  Reco-->>UI: weaknesses + materials + proposed plan (diff for user edits)
```

---

## Invariants visible across flows

- The score pipeline reads **only** the snapshot (flow 3); no flow reads the live bank/config into a
  score.
- Analytics never feeds a score back; flows 3 and 4 are one-directional.
- Provider output (flow 2) cannot reach scoring/analytics flows.