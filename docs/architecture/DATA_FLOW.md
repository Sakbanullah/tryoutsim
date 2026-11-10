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
  API->>DB: read taxonomy + packages + providers + summary + unread notifications
  DB-->>API: rows
  API-->>UI: taxonomy, packages, provider status, empty bank, unreadCount
```

Bootstrap carries **no exam-config list**: the learner never selects a config
([PACKAGE_SPECIFICATION](../product/PACKAGE_SPECIFICATION.md) §3).

## 2. Generate questions

```mermaid
sequenceDiagram
  participant UI
  participant API
  participant Jobs
  participant Provider
  participant DB
  UI->>API: POST /generation-jobs
  API->>Jobs: enqueue (server-owned; browser may close)
  loop each batch
    Jobs->>Provider: chat (prompt template)
    Provider-->>Jobs: raw response
    Jobs->>Jobs: T → Q → K [AI_VALIDATION]
    Jobs->>DB: commit batch atomically (drafts / quarantined)
  end
  Jobs->>DB: job report (partial counts) + notification
  UI->>API: GET /notifications (poll)
  API-->>UI: job outcome
```

## 3. Start + score a session (the score pipeline)

```mermaid
sequenceDiagram
  participant UI
  participant API
  participant Pack
  participant Snap
  participant Score
  participant DB
  UI->>API: POST /packages/:id/sessions { mode }
  API->>Pack: select roster (eligible stock, repeat rule) + bind latest usable CPNS config
  API->>Snap: freeze SessionSnapshot (questions, keys, config, rules, thresholds, package binding, timing)
  Snap-->>DB: persist session + snapshot (one transaction)
  API-->>UI: session + runner payload
  loop while running
    UI->>API: PATCH /sessions/:id/answers (answer + clock)
    API->>DB: upsert answer_sheet, update activeMs
  end
  UI->>API: POST /sessions/:id/submit
  API->>DB: freeze answer sheet
  API->>Score: preflight(snapshot, sheets)  [SCORING_METHODOLOGY §6]
  alt preflight aborts (semantic corruption / malformed thresholds / wrong regulatory scope)
    Score-->>API: PREFLIGHT_FAILED { errors[] } / THRESHOLD_CONFIG_INVALID / REGULATORY_*
    API-->>UI: 422 / 409, nothing scored
  else verdict not possible (approval missing / invalid / version mismatch)
    Score-->>API: score computed, verdict withheld
    Score-->>DB: ScoreResult with verdict = null, verdictWithheldJson set
    API-->>UI: 200 ScoreResult (no verdict) + withheld.code / withheld.changed[]
  else ok
    Score->>Score: scoreSession(preflighted)  [pure, snapshot-only]
    Score-->>DB: ScoreResult + snapshotVersion + approval
    Score-->>UI: ScoreResult
  end
```

`submit` always produces a score unless the snapshot itself is unusable. A missing approval withholds the
**verdict only**; `/score` is used after a genuine abort or to add a verdict
([API_SPECIFICATION](../backend/API_SPECIFICATION.md) §7.3).

## 4. Analytics

```mermaid
sequenceDiagram
  participant UI
  participant API
  participant Analytics
  participant DB
  UI->>API: GET /analytics
  API->>DB: existing sessions + ScoreResult + answer log + difficulty + coverage
  DB-->>Analytics: raw rows (deleted sessions absent by construction)
  Analytics->>Analytics: metrics (accuracy / attainment, sample rules, consistency, coverage)
  Analytics-->>UI: AnalyticsSnapshot per version triple (percentages + counts, no re-scoring)
```

## 5. Recommendations → learning sequence

```mermaid
sequenceDiagram
  participant Analytics
  participant Reco
  participant AI as AI provider (optional)
  participant DB
  Analytics->>Reco: AnalyticsSnapshot
  Reco->>Reco: rank strengths/weaknesses (closed set; reportable only)
  Reco->>DB: read approved materials by competency
  Reco->>AI: analysis task with the CLOSED weakness list (optional)
  AI-->>Reco: studyOrder permutation + explanation text
  Reco->>Reco: validate permutation; discard anything outside the input set
  Reco-->>UI: strengths + weaknesses + evidence + MaterialOffer + ordered sequence with reason (no plan document)
```

If the AI step fails or is unmapped, the flow returns the deterministic result with no narrative — the
result screen never blocks on a provider.

## 6. Sampling gate

```mermaid
sequenceDiagram
  participant UI
  participant API
  participant DB
  UI->>API: GET /question-batches
  API-->>UI: batch + sample + flags
  UI->>API: POST /question-batches/:batchId/sample { outcome }
  API->>DB: sampling record; dynamicEligible = true for the eligible set
  API->>DB: notification resolved (batch_awaiting_sampling)
```

## 7. Backup and restore

```mermaid
sequenceDiagram
  participant UI
  participant API
  participant Backup
  participant FS as User-chosen folder
  API->>Backup: scheduled / manual run
  Backup->>FS: write temp archive (no keys)
  Backup->>Backup: open + integrity check
  alt verified
    Backup->>FS: rename to final name
    API->>API: prune by retention, notify backup_succeeded
  else failed or unverified
    API->>API: record failed run, notify backup_failed (never "success")
  end
  UI->>API: POST /restores/validate, then POST /restores
  API->>Backup: compatibility check, copy current DB aside, migrate forward, swap
  API->>API: keys absent → hasKey=false, notify restore_completed
```

## 8. History deletion

```mermaid
sequenceDiagram
  participant UI
  participant API
  participant DB
  UI->>API: GET /sessions/:id/deletion-impact
  API-->>UI: what will change (plain language)
  UI->>API: DELETE /sessions/:id (after explicit confirm)
  API->>DB: delete session + snapshot + answers + result, insert tombstone (one transaction)
  API-->>UI: 204; analytics re-read on next request
```

---

## Invariants visible across flows

- The score pipeline reads **only** the snapshot (flow 3); no flow reads the live bank/config into a
  score.
- Analytics never feeds a score back; flows 3 and 4 are one-directional. Flow 5 consumes flow 4's
  `AnalyticsSnapshot` unchanged (including `sessionCount` and `testMean`), never re-aggregating.
- Flow 5 may **order and explain** the closed weakness set; it can never add a competency to it.
- Flows 2 and 6 change only the question pool; no generation path writes a score or an analytics value.
- Flow 7 copies data out and in; it never recomputes a result and never moves a key.
- Flow 8 is the only path by which a stored result disappears, and it is always a user act
  ([ANALYTICS_ENGINE](../backend/ANALYTICS_ENGINE.md) §7).
