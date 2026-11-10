# Frontend State Management

How the UI holds data, what it may persist, and where each kind of state lives.

---

## 1. Default: nothing special

- Screen-local UI state (dialog open, selected tab) lives in the component.
- Server data is fetched through the Data client and held where it is read.
- **State closest to where it is used; promote only when it must be shared.**

## 2. Shared client state (the only global)

| State | Shape | Shared because |
|---|---|---|
| `contractVersion` | `string` | matched against `meta.version`; drives the one full-screen 426 notice |
| `activeSession` | `{ sessionId, mode: 'tryout' \| 'latihan' } \| null` | the runner survives child remounts |
| `pendingAutosave` | `{ sessionId, dirty: boolean } \| null` | a failing autosave must be visible from the shell |
| `unreadNotifications` | `number` | shell bell without a second poll from every screen |
| `flash` | `{ kind: 'error' \| 'info'; text: string } \| null` | one-shot message after navigation |

That is the whole global surface. Everything else is local or fetched-read-local.

## 3. Three kinds of state, kept apart

| Kind | Lives | Examples |
|---|---|---|
| **Backend data** | backend, over HTTP | scores, questions, configs, analytics, approvals |
| **Tab-only state** | component / module store, lost on reload | selected answer not yet saved, flag, open dialog, filter choices |
| **Mock data** | the mock layer, clearly labelled | every fixture before the backend exists |

The UI never stores a *derived* score, percentage or rank. It stores what the server returned.

## 4. Active exam state

- **Answers** are sent to the backend on every change through the documented autosave route
  (`PATCH /sessions/:id/answers`: `{ questionId, selected, flagged?, elapsedActiveMs }`), one answer
  plus its clock in one call. The mock layer holds them before the backend exists; the UI still
  behaves as if a save can fail.
- **Autosave feedback** is **three states, always visible**: *tersimpan* · *menyimpan…* ·
  *belum tersimpan — coba lagi*. The third is a persistent bar with a retry button; it never times out
  silently.
- **Navigation between questions is never blocked** by a failing save; the user can attempt answers to
  the last item even if an earlier save failed, and the confirm screen refuses to submit while the
  bar reads *belum tersimpan*.
- **Flags** are saved with the answer and survive reload.
- **The clock is server state.** The runner renders the returned `activeMs`/`runningSince`; leaving
  pauses it (`POST /sessions/:id/pause`), returning resumes it (`POST /sessions/:id/resume`). The UI
  never advances the timer past a confirmed value.
- **No optimistic score.** The result screen only renders a `ScoreResult` the server returned.

## 5. Browser storage

| Value | Allowed? | Why |
|---|---|---|
| Last `sessionId` (pointer only) | yes | reopens the last result after reload |
| Open-session pointer | yes | "Lanjutkan sesi" without a fresh history call; the id is not a secret |
| Answer letter, dragged items, draft text | **no** | exam answers belong to the backend contract; storing them locally would create a second, unsynchronised truth |
| Provider keys | **never** | NFR-7; keys are write-only and never reach the browser ([SECURITY](../architecture/SECURITY.md) §3) |
| Scores / results | no | re-fetch; never cache a score the user cannot refresh |

## 6. Loading, empty and error states

Every screen implements all four, and none is a blank page:

| State | Rule |
|---|---|
| Loading | skeleton of the final layout, "Sedang memuat…"; no spinner-only screens |
| Empty | what is missing + one action that fixes it (start a tryout, add a provider) |
| Error | plain Indonesian sentence + "Coba lagi"; technical codes never shown |
| Success | the data, with counts |

`insufficient_data` is **not** an error state: it is a normal reportable-with-caveat state
([FRONTEND_RESULTS_ANALYTICS](./FRONTEND_RESULTS_ANALYTICS.md) §6).

## 7. Upgrade triggers

| Symptom | Then |
|---|---|
| Several screens hand-roll cache invalidation and it breaks | add one minimal query cache |
| Global state grows past the table in §2 and mutations cross features | add a small store library |
| The Data client can no longer keep fetch/parse DRY | refactor the client, not add a framework |

Until one occurs, the baseline stands.
