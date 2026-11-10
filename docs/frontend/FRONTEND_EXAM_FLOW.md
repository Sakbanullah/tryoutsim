# Frontend Exam Flow

The most important screens: sitting a tryout or a Latihan session. Requirements: PRD §9.2 FR-T1…FR-T8,
§9.3 FR-P1…FR-P5. Contracts: [FRONTEND_DATA_CONTRACTS](./FRONTEND_DATA_CONTRACTS.md),
[API_SPECIFICATION](../backend/API_SPECIFICATION.md) §7.4–§7.6. Clock rules:
[SCORING_METHODOLOGY](../examination/SCORING_METHODOLOGY.md) §8.1. Gaps:
[FRONTEND_GAP_REGISTER](./FRONTEND_GAP_REGISTER.md).

**Design rule for this whole flow:** the screen never invents a fact about the exam, and never decides
scoring or time. No duration, item count, countdown, verdict or "jawaban benar" appears unless a returned
field supplies it.

---

## 1. Layout

```
┌─────────────────────────────────────────────┐
│ Kabar bar   TWK · Soal 4 dari 30   12:34 ⏸  │  subject · position · active time (if durationMs ≠ null)
├─────────────────────────────────────────────┤
│  Question card                               │
│   Stem (18px, ≤68 chars/line)                │
│   [asset: image / table + alt text]          │
│   ○ A  …                                     │
│   ○ B  …                                     │
│   ○ C  …                                     │
│   ○ D  …                                     │
│   ○ E  …                                     │
├─────────────────────────────────────────────┤
│ [Tandai ▢]   [‹ Sebelumnya]  [Berikutnya ›]  │
│ status autosave: "Tersimpan"                 │
└─────────────────────────────────────────────┘
   Nav panel (chip per soal: terisi / kosong / ditandai)
   [Selesai & kirim]                         ← footer or panel action
```

Question chip states use **text + icon**, not colour alone: *terisi* (filled dot), *kosong* (empty
ring), *ditandai* (flag icon + "ditandai" in the legend).

## 2. Data the runner needs

Everything below comes from `POST /packages/:id/sessions` (runner payload) or `GET /sessions/:id`.

| Data | Field | Note |
|---|---|---|
| Question stem, options, asset | frozen snapshot content | config-bound, immutable for this session |
| Position and subject | roster order + `test` per question | |
| Total question count | roster length | from the response, never invented |
| Remaining active time | `durationMs` − `activeMs` | `null` duration → "tanpa batas waktu" |
| Selected answer, flag | `answer_sheet` rows in the payload | restored on resume |
| Clock state | `activeMs`, `runningSince` | paused vs running is server state |
| Session status | `GET /sessions/:id` (`status`) | `open` / `submitted` / `blocked` |

There is **no answer key and no explanation** in a tryout runner payload: the backend omits them until
the session ends. A Latihan runner gets feedback only through
`POST /sessions/:id/answer-feedback` per answered question (§9).

## 3. Answering

### TWK and TIU (single correct answer)

- A radio group, `A`–`E` ([SCORING_METHODOLOGY](../examination/SCORING_METHODOLOGY.md) §3.1).
- Selecting replaces the previous selection. A "hapus jawaban" action sends `selected: null`
  ([API_SPECIFICATION](../backend/API_SPECIFICATION.md) §7.5).
- **No feedback of right/wrong during a tryout.** In Latihan, feedback arrives after the answer (§9).

### TKP (weighted response)

- Single selection from five responses, semantically **not "the correct one"**
  ([SCORING_METHODOLOGY](../examination/SCORING_METHODOLOGY.md) §3.2).
- Above the options: "Pilih sikap yang paling mencerminkan dirimu dalam situasi ini."
- No weights, no "best" marker, no score bubble during the session.
- After the answer (Latihan) or after the session (Tryout): attainment plus **every option's weight and
  why it earns it** — never "benar"/"salah".

## 4. Navigation

- Prev / Next move one question and autosave first.
- The panel lists every question in roster order with its chip state; tapping jumps.
- Next on the last question offers "Ulangi soal yang kosong" when unanswered items exist, then
  "Selesai & kirim".
- Keyboard: `←/→` move, `1–5` or `A–E` select, `M` toggles the mark, `Enter` on the panel opens.

## 5. Autosave

| Aspect | Rule |
|---|---|
| Trigger | on every selection change, debounced ≤ 2 s (NFR-3), on navigation, and on any flag change |
| Request | `PATCH /sessions/:id/answers` — answer + flag + `elapsedActiveMs` in one call ([API_SPECIFICATION](../backend/API_SPECIFICATION.md) §7.5) |
| Success | "Tersimpan" (muted), using the returned `activeMs` |
| In flight | "Menyimpan…" |
| Failure | persistent bar "Belum tersimpan — Coba lagi"; submit is blocked until it clears; the user may keep answering |
| On leaving | flush first; if it fails, stay with a confirm "ada jawaban yang belum tersimpan" |

**One round trip, one truth.** An answer is never saved without its active time, and the client never
advances the clock locally beyond what the server confirmed.

## 6. Timer, pause and expiry

The timer shows **accumulated active time**, not calendar time. Canonical rules:
[SCORING_METHODOLOGY](../examination/SCORING_METHODOLOGY.md) §8.1.

| Event | Behaviour |
|---|---|
| `durationMs` is `null` (all Latihan, and any config without an asserted duration) | Show elapsed active time and the words "tanpa batas waktu". No countdown, no auto-submit |
| `durationMs` is set | Show remaining = `durationMs − activeMs`, as text, with a pause indicator when `runningSince` is null |
| User leaves the runner (navigation, tab hidden, browser closed, app closed) | Clock pauses: the last autosave stores `activeMs` and clears `runningSince` |
| User returns (route entry or "Lanjutkan sesi") | Clock resumes from the stored `activeMs` |
| `activeMs ≥ durationMs` on resume | Server marks the session expired and submits it with the saved answers; the client renders the result, never a silent loss |
| Submit before expiry | Always allowed |

**The client never decides expiry from its own wall clock.** It renders the server's returned
`activeMs`/`expired` and shows a one-line notice when the clock is paused
("Waktu berhenti saat kamu meninggalkan ujian.").

## 7. Submission

1. "Selesai & kirim" → confirm screen.
2. The confirm screen states the unanswered count and the flagged count. **If blanks remain, a second
   confirmation is required** — submitting early is allowed, but never silent
   ([SCORING_METHODOLOGY](../examination/SCORING_METHODOLOGY.md) §3.3).
3. `POST /sessions/:id/submit`.
4. `200` → result, which now includes the failed-verdict note when no verdict is possible. A blank is
   never counted as correct; the confirmation says so.
5. `422 PREFLIGHT_FAILED` / `409 THRESHOLD_CONFIG_INVALID` / `409 REGULATORY_*` → blocked result screen
   with answers kept. A missing or drifted approval is **not** a block: the score is written and only the
   verdict is withheld ([SCORING_METHODOLOGY](../examination/SCORING_METHODOLOGY.md) §5.6).

Submit is **irreversible** and is labelled so: "Setelah dikirim, jawaban tidak bisa diubah."

## 8. Recovery after refresh, restart or interruption

| Claim | Supported? |
|---|---|
| Answers reappear after reload | **yes** — saved through `PATCH /sessions/:id/answers` |
| Session still `open` | yes — `GET /sessions/:id` returns `status` |
| Flag state survives | yes — saved with the answer |
| Remaining time restored | yes — from `activeMs`, which did not advance while away |
| Resume after the app was closed | yes — Beranda offers "Lanjutkan sesi" |

Nothing is promised that the contract does not carry; the start screen states that the timer only counts
active time.

## 9. Latihan differences

| Aspect | Tryout | Latihan |
|---|---|---|
| Duration | from the config's asserted duration, else none | none by default; an optional countdown uses the same active-time rule |
| Marking | flag for review | not offered |
| Feedback | **only after the session ends** | **after every answer** |
| Feedback content | key, explanation, per-option weights (TKP) | same, immediately |
| Submit | explicit, blanks confirmed | explicit; "selesai" confirmation once |
| Result | `ScoreResult` | same shape; UI shows points per question and `—` for blanks |

**Latihan feedback payload** (`POST /sessions/:id/answer-feedback`, canonical in
[API_SPECIFICATION](../backend/API_SPECIFICATION.md) §7.6): `selected`, `earned`, `maxScore`,
`correct` (`null` for TKP), `optionScores`, `explanation`.

Presentation rules:

- TWK/TIU: mark the chosen option and the keyed option, state `+earned/max`.
- TKP: **list every option with its weight and why it earns that weight**, highest first, with the
  chosen option marked. In Latihan the reasoning is the part of the explanation that justifies that
  weight; a question whose explanation does not justify each option cannot be published while
  `dynamicEligible` depends on it — V-10
  ([QUESTION_SPECIFICATION](../examination/QUESTION_SPECIFICATION.md) §5). In the tryout review block the
  reasoning comes per option from `optionJustifications` (V-13, §1.2 there) —
  [FRONTEND_RESULTS_ANALYTICS](./FRONTEND_RESULTS_ANALYTICS.md) §2.2.1.1. The two surfaces differ in
  where the reasoning is stored, not in what the learner is told.

The tryout review block, not this runner, is where an explanation is shown after submit. It shows one
only when the question's latest version equals the version the session froze (strict version matching,
Product Owner 2026-11-09); otherwise it says "Pembahasan untuk soal ini belum tersedia."
([FRONTEND_RESULTS_ANALYTICS](./FRONTEND_RESULTS_ANALYTICS.md) §2.2.3).
- The explanation is labelled *"Penjelasan soal"*, and an AI-origin question keeps its badge.
- "Lanjut" moves to the next question; the feedback block stays available for the answered question.

## 10. Accessibility of the runner

- Focus moves to the stem heading on each question change, announced.
- Option list is a real radio group; TKP uses the same control with different wording.
- The autosave status, the remaining-time text and the unanswered count are `aria-live="polite"`.
- A paused clock is announced in text, not indicated by an icon alone.
- Keyboard-only completion of a session is required (NFR-4).
