# User Stories

Canonical backlog of user-facing stories. Requirement IDs (`FR-*`) come from [PRD.md](./PRD.md) §8 and
are not redefined here. Exam rules are canonical in
[CPNS_2026_REGULATIONS.md](../examination/CPNS_2026_REGULATIONS.md).

Single actor: **the user** (one person, on their own machine). No other roles exist.

Story format: `US-<area><n>` · role · want · so that · acceptance · FR refs.

---

## Bank Soal & generation (B)

| ID | Story | Acceptance | FR |
|---|---|---|---|
| US-B1 | As the user, I want to generate N questions for a competency so that I have fresh material without writing it myself. | Choose test → competency (any level) → difficulty → count → config. Progress shows batches done/total. Cancel stops further batches and keeps completed ones. | FR-G1, FR-G2 |
| US-B2 | As the user, I want every generated question to arrive as a draft with a visible provenance block so that I know it is AI-made. | Draft list shows provider, model, prompt template + version, generation id, timestamp. No question is `active` on arrival. | FR-G3, FR-G5 |
| US-B3 | As the user, I want to review drafts in one screen so that reviewing 20 questions does not take an hour. | Keyboard: accept/edit/reject/regenerate per question. Bulk accept only for drafts that passed all blocking validations. Median time per question ≤ 60 s (§PRD success metric). | FR-G4 |
| US-B4 | As the user, I want a failed batch to tell me *why* it failed, so that I can fix the cause. | Each failure carries a category (timeout / auth / rate limit / malformed JSON / schema violation / provider error) and the provider's raw message is viewable. Retry available per batch. | FR-G6 |
| US-B5 | As the user, I want to find a question by text, competency, difficulty, provenance or lifecycle so that I can manage a growing bank. | Filters combine; result count shown; filters survive a refresh. | FR-Q1 |
| US-B6 | As the user, I want to see all validations a question failed so that I can decide whether to fix or discard. | Row detail lists each check V-01…V-12 with pass/fail and message, tying to `contentHash`. Editing invalidates the record. | FR-Q2 |
| US-B7 | As the user, I want near-duplicate clusters surfaced so that my bank does not fill with paraphrases. | Cluster view groups by normalised token hash; user can archive a whole cluster. | FR-Q5 |

## Try Out (T)

| ID | Story | Acceptance | FR |
|---|---|---|---|
| US-T1 | As the user, I want to see what rule set a try out uses before I start so that I am not misled about "2026 rules". | Pre-session screen shows config name, state badge, `notice` text verbatim, and — if provisional and unapproved — a disabled Start with the reason. | FR-T1, FR-E2 |
| US-T2 | As the user, I want a timer that does not lie after a reload so that I am not robbed of time. | Remaining time = `deadline - now()`, recomputed from a stored ISO deadline. Reload mid-session restores the same remaining seconds (±1 s). | FR-T2, NFR-3 |
| US-T3 | As the user, I want to move between questions and flag ones to revisit. | Number grid with per-question state (answered / flagged / blank); keyboard shortcuts for next/prev/flag. | FR-T3, NFR-4 |
| US-T4 | As the user, I want my answers saved continuously so that a crash costs nothing. | Answers persist ≤ 2 s after selection; reload restores selection, flags, current index. | FR-T4 |
| US-T5 | As the user, I want to be warned about unanswered questions before submitting. | Confirm dialog states the unanswered count and the number flagged. | FR-T5 |
| US-T6 | As the user, I want my score immediately, without spoiling answers. | Result summary shows score, per-test breakdown, max — not per-question correctness until the review screen. | FR-T6 |
| US-T7 | As the user, I want to know when a submit could not be scored rather than seeing a fake zero. | If the config's approval became invalid mid-session, answers are stored `unscored` with an explanation and a path to re-approve and score. | FR-T7 |

## Latihan (P)

| ID | Story | Acceptance | FR |
|---|---|---|---|
| US-P1 | As the user, I want to drill the exact competency I am weak in. | Selection accepts test / domain / leaf and difficulty; session length is user-chosen. | FR-P1, FR-L4 |
| US-P2 | As the user, I want practice untimed by default so that I can think. | Untimed default; optional soft per-question timer that does not auto-submit. | FR-P2 |
| US-P3 | As the user, I want the explanation right after each question in practice so that I learn while going. | Explanation reveals on answer; reviewable afterwards. | FR-P4 |

## Hasil & analisis (A)

| ID | Story | Acceptance | FR |
|---|---|---|---|
| US-A1 | As the user, I want to see accuracy per competency after a session. | Every competency with ≥ 5 answered questions shows accuracy + n; below threshold shows "Belum cukup data (n=…)". | FR-A1, FR-D2 |
| US-A2 | As the user, I want to see whether I am improving per competency. | Trend over sessions with ≥ 3 data points; below that, "butuh ≥3 sesi". | FR-A2 |
| US-A3 | As the user, I want to distinguish "not enough data" from "zero correct". | A competency with n=2, 0 correct never outranks n=40, 55% in the weakness list. | FR-A4 |
| US-A4 | As the user, I want to know when two scores are not comparable. | Results scored under different `configVersion`/`scoringVersion` are never plotted on one trend line without an explicit incompatibility note. | FR-A5 |

## Rekomendasi & Rencana Belajar (L)

| ID | Story | Acceptance | FR |
|---|---|---|---|
| US-L1 | As the user, I want to be told what to study next, with the numbers that justify it. | Each weakness row shows competency, accuracy, n, and the gap vs the user's mean. No adjective-only justifications. | FR-L1, FR-L2 |
| US-L2 | As the user, I want learning material for each weakness, clearly labelled by origin. | Material rows show provenance (`AI` / `ditulis sendiri`) matching `QUESTION_SPECIFICATION.md` §2 badge rules. | FR-L3 |
| US-L3 | As the user, I want a one-click drill from a recommendation. | "Latih ini" opens a pre-filled practice session for that competency. | FR-L4 |
| US-L4 | As the user, I want a plan I can edit, and I do not want it silently rewritten. | Plan items are editable; recomputation proposes a diff the user applies or dismisses. | FR-L5, FR-L6 |

## Config & AI (C, E)

| ID | Story | Acceptance | FR |
|---|---|---|---|
| US-C1 | As the user, I want to add any OpenAI-compatible provider so that I am not locked to one vendor. | Base URL, key, headers, timeout, retries, extra params; connection test shows the provider's exact error. | FR-C1, FR-C2 |
| US-C2 | As the user, I want to point different tasks at different models to balance cost and quality. | Task→model mapping: question, explanation, material, analysis. | FR-C4 |
| US-C3 | As the user, I want my API key never displayed again after entry. | Key is write-only; only a masked tail is shown. Key never in a response body, log, or bundle. | FR-C6, NFR-7 |
| US-C4 | As the user, I want the app to be useful before I configure any AI provider. | All non-AI features work; empty-state copy explains what AI adds. | FR-C7 |
| US-E1 | As the user, I want to approve a provisional exam config deliberately. | Dialog shows config id, configVersion, scoringVersion, regulatoryBasisHash, the warnings being accepted, and the `notice`. | FR-E3 |
| US-E2 | As the user, I want approval to break automatically if the rules change. | Any version bump invalidates approval; scoring is blocked with a "perlu persetujuan ulang" message naming what changed. | FR-E4 |

---

## Non-goals (explicitly not stories)

Multi-user accounts · login/logout · teacher or admin roles · cloud sync · sharing results ·
PDF export · mobile native app · payment · public leaderboards.
