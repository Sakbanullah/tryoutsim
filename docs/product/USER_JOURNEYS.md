# User Journeys

Narrative + Mermaid for the flows that carry the product. Stories: [USER_STORIES.md](./USER_STORIES.md).
Rules: [CPNS_2026_REGULATIONS.md](../examination/CPNS_2026_REGULATIONS.md).

---

## J-1 First run → first scored try out

The empty-state journey. This is the acceptance path in [PRD.md](./PRD.md) §13.

```mermaid
sequenceDiagram
  actor U as User
  participant App
  participant API
  participant P as AI provider
  U->>App: open localhost
  App->>API: GET /bootstrap
  API-->>App: taxonomy + configs + empty bank
  App-->>U: "Belum ada provider. 3 langkah menuju try out pertama."
  U->>App: add provider (base URL, key, model)
  App->>API: POST /providers
  App->>API: POST /providers/:id/test
  API->>P: GET /models
  P-->>API: 200 + model list
  API-->>App: ok
  U->>App: generate 10 TIU soal, deret angka
  App->>API: POST /generation-jobs
  API->>P: chat completion (batched)
  P-->>API: JSON drafts
  API-->>App: drafts (lifecycle=draft)
  U->>App: accept all that pass validation
  App->>API: PATCH /questions/:id/accept
  U->>App: approve provisional config
  App->>API: POST /exam-configs/:id/approval
  U->>App: start 10-question try out
  App-->>U: hasil
```

Decision points that must not be skipped:

1. **Provider not configured** → the empty state still lets the user go to Try Out and Practice with
   whatever questions exist. AI is additive, never a gate ([PRD.md](./PRD.md) FR-C7).
2. **No active questions for the chosen filter** → offer "Latih dengan bank yang ada" or "Buat soal".
   Never a dead end.
3. **Config unapproved** → Start is disabled with the exact warning, and a one-click "Setujui" path.
4. **Zero questions answered** → no result screen; back to practice.

---

## J-2 Daily practice loop

```mermaid
flowchart TD
  D[Dashboard] -->|weakness card| W[Titik lemah + n]
  W -->|"Latih ini"| P[Latihan tertarget]
  P --> R[Hasil latihan]
  R --> A[Analisis diperbarui]
  A --> D
  W -->|"Baca materi"| M[Materi]
  M --> P
  D -->|"Rencana hari ini"| PL[Rencana Belajar]
  PL --> P
```

The loop must close within one screen transition per arrow. If a user has to remember a competency
name to act on it, the journey is broken.

---

## J-3 Full try out under time pressure

```mermaid
flowchart LR
  S[Choose config] --> N[Read notice]
  N --> T[Session runs]
  T -->|refresh / crash| T
  T -->|deadline hits| SUB[Auto-submit]
  T -->|user submits| SUB
  SUB -->|approval valid| SC[Scored]
  SUB -->|approval invalid| UN[Unscored, answers kept]
  UN -->|user re-approves| SC
  SC --> RES[Result summary]
  RES --> REV[Per-question review]
```

Key promises: the timer is deadline-based (a refresh cannot add time), autosave is ≤ 2 s, and a
scoring failure never destroys answers.

---

## J-4 Recovering from an invalidated approval

```mermaid
sequenceDiagram
  actor U as User
  participant App
  participant API
  U->>App: session in progress
  Note over API: config edited / basis changed
  U->>App: submit
  App->>API: POST /sessions/:id/submit
  API-->>App: 409 APPROVAL_INVALID {changed: ["regulatoryBasisHash"]}
  App-->>U: "Sesi tersimpan. Konfigurasi berubah."
  U->>App: review diff, re-approve
  App->>API: POST /exam-configs/:id/approval
  App->>API: POST /sessions/:id/score
  API-->>App: scored result
```

The 409 names **which** of the four bound values changed. That is the difference between a
trustworthy gate and an annoying one.

---

## J-5 Reviewing AI drafts before they can be practised

```mermaid
flowchart TD
  G[Generated batch] --> V{Validation}
  V -->|critical fail| X[rejected]
  V -->|pass| DV[draft → ai_validated]
  DV --> H{Ulasan user}
  H -->|reject| X
  H -->|edit| DV
  H -->|accept| HR[human_reviewed]
  HR --> K{Answer key validated?}
  K -->|no| HR
  K -->|yes| ACT[active]
  ACT --> SESS[Selectable in sessions]
```

No path from `draft` to `active` skips the user. This is the structural guarantee behind
[QUESTION_SPECIFICATION.md](../examination/QUESTION_SPECIFICATION.md) §3.

---

## J-6 Provider swap

```mermaid
flowchart LR
  O[Old provider fails] --> M[Task mapping screen]
  M --> C[Choose new provider + model]
  C --> T[Test]
  T --> G[Next generation uses new model]
  G -.->|unchanged| S[Scoring, analytics, recommendations]
```

The dotted edge is the product promise: only AI output changes ([PRD.md](./PRD.md) O-5, §13.6).

---

## Journey-level failure modes

| Failure | Must happen | Must not happen |
|---|---|---|
| Provider unreachable | Category + retry; drafts already created stay | Silent empty result |
| Generation returns broken JSON | Batch marked failed, raw response viewable | Partial writes to the bank |
| Session crash | State restored | Lost answers |
| Approval invalidated | Answers kept, re-approval path | Re-scoring under new rules silently |
| Empty question bank | Clear CTA to generate or browse | Blank screen |
| Only 2 answers on a competency | "Belum cukup data" | A ranked weakness claiming certainty |
