# User Stories

Canonical backlog of user-facing stories. Requirement IDs (`FR-*`) come from [PRD.md](./PRD.md) §9 and
are not redefined here. Exam rules are canonical in
[CPNS_2026_REGULATIONS.md](../examination/CPNS_2026_REGULATIONS.md); packages in
[PACKAGE_SPECIFICATION.md](./PACKAGE_SPECIFICATION.md); materials in
[MATERIAL_SPECIFICATION.md](../examination/MATERIAL_SPECIFICATION.md).

Single actor: **the user** (one person, on their own machine). No other roles exist.

Story format: `US-<area><n>` · role · want · so that · acceptance · FR refs.

---

## Bank Soal & generation (B)

| ID | Story | Acceptance | FR |
|---|---|---|---|
| US-B1 | As the user, I want to generate N questions for a competency set so that I have fresh material without writing it myself. | Choose subtest → submateri leaves → difficulty → count. The run continues if I navigate away or close the browser. Progress shows batches done/total; cancel stops further batches and keeps completed ones; there is no pause. | FR-G1, FR-G2, FR-G8 |
| US-B2 | As the user, I want every generated question to arrive as a draft with a visible provenance block so that I know it is AI-made. | Draft list shows provider, model, prompt template + version, generation id, **batch id**, timestamp, validation results. No question is usable on arrival. | FR-G3, FR-G5 |
| US-B3 | As the user, I want to review a **sample** of a finished batch so that clearing 20 generated questions does not take an hour. | Sampling screen shows the sample the backend drew, with its size stated, and every quality flag of those items; I record clean / findings / systemic. Median time per sampled question ≤ 60 s. The **quota is an unresolved parameter** and is never derived by the UI. | FR-G4, FR-G7 |
| US-B4 | As the user, I want a failed batch to tell me *why* it failed, so that I can fix the cause. | Each failure carries a category (timeout / auth / rate limit / malformed JSON / schema violation / provider error / interrupted), the scrubbed raw message is viewable, and retry runs on the same provider+model. | FR-G6 |
| US-B5 | As the user, I want to find a question by text, submateri, difficulty, provenance or lifecycle so that I can manage a growing bank. | Text search + filters combine (subtest, submateri, both difficulty fields, status, origin, provider/model/batch, created from/to); result count shown; filters live in the URL and survive a refresh, but are **not** saved as named views. | FR-Q1 |
| US-B6 | As the user, I want to see every validation layer and the sampling outcome so that I can decide whether to fix or discard. | Row detail lists layer T checks V-01…V-12, layer Q rating, layer K findings, the sampling record, and ties them to `contentHash`. Editing invalidates the record and sets sampling back to pending. | FR-Q2, FR-Q8 |
| US-B7 | As the user, I want near-duplicate clusters surfaced so that my bank does not fill with paraphrases. | Cluster view groups by normalised token hash; the user can archive a whole cluster. | FR-Q5 |
| US-B8 | As the user, I want to add one question by hand without any batch process. | A single form; the question runs the same technical validation, needs key validation, and needs no sampling. | FR-Q6 |
| US-B9 | As the user, I want to report a bad question and have a wrong key handled immediately. | Reporting from a session, result or bank. A **critical** report (wrong key / ambiguous) quarantines the question at once and notifies me; a non-critical one queues in Review Soal. The final decision is mine. | FR-Q7 |
| US-B10 | As the user, I want a fix to become a new version without rewriting history. | Editing creates `contentVersion + 1`; the old version, its validation and the sessions that used it stay readable. A question used in an active session never changes for that session. A repaired question returns only after re-validation and, for an AI batch question, re-sampling. | FR-Q8 |

## Tryout (T)

| ID | Story | Acceptance | FR |
|---|---|---|---|
| US-T1 | As the user, I want to start a tryout by its name without answering technical questions. | I pick *Simulasi SKD Lengkap*, *TWK*, *TIU* or *TKP*. The server binds the newest usable CPNS config; no config is shown or chosen. | FR-T1, FR-T2 |
| US-T2 | As the user, I want a timer that counts only the time I am actually working so that leaving the app does not rob me. | Leaving the runner pauses the clock; returning resumes it; remaining time is computed from accumulated active time server-side. Reload restores the same remaining time. | FR-T2, NFR-3 |
| US-T3 | As the user, I want to move between questions and flag ones to revisit. | Number grid with per-question state (answered / flagged / blank); keyboard shortcuts for next/prev/flag. | FR-T3, NFR-4 |
| US-T4 | As the user, I want my answers saved continuously and my session resumable at any time. | Answers persist ≤ 2 s after selection with their elapsed time; reopening the app offers "Lanjutkan sesi" and restores selection, flags and position. | FR-T4 |
| US-T5 | As the user, I want to submit even with blanks, but be warned first. | Confirm dialog states the unanswered and flagged counts; a second confirmation is required when blanks remain; blanks then score as blanks. | FR-T5, FR-T8 |
| US-T6 | As the user, I want the score after the session ends, and the explanations only then. | Result shows score, per-test breakdown, strengths/weaknesses per submateri and a recommendation. No key and no explanation is available mid-session. | FR-T6 |
| US-T7 | As the user, I want the result to be honest about what is not verified. | The result shows the score. It shows a pass/fail verdict **only** from an approved threshold set; otherwise it states that no passing threshold is verified for CPNS 2026 — never "belum lulus". | FR-T7 |

## Latihan (P)

| ID | Story | Acceptance | FR |
|---|---|---|---|
| US-P1 | As the user, I want to drill one submateri, e.g. Analogi or Deret Angka. | The picker lists taxonomy leaves with the stock available; selection is a submateri + length; a weakness drill pre-fills it. | FR-P1, FR-L4 |
| US-P2 | As the user, I want practice untimed by default so that I can think. | Untimed default; an optional countdown uses the same active-time rule and never consumes time while I am away. | FR-P2 |
| US-P3 | As the user, I want the explanation right after each answer so that I learn while going. | Feedback after every answer: result, key, explanation. For TKP, **each option's weight** and why it earns it. | FR-P4 |
| US-P4 | As the user, I want to be told when a drill will repeat questions I have already seen. | The start screen states the repeat count when eligible unseen stock is short; Latihan may repeat deliberately. | FR-P5 |

## Hasil & Progres (A)

| ID | Story | Acceptance | FR |
|---|---|---|---|
| US-A1 | As the user, I want to see accuracy per submateri after a session. | Every submateri with ≥ 5 answered questions shows its metric + n; below threshold shows "Belum cukup data (n=…)". TKP shows attainment, never "benar/salah". | FR-A1, FR-D2 |
| US-A2 | As the user, I want to see whether I am improving per submateri. | Trend needs ≥ 3 comparable sessions; below that, "butuh ≥3 sesi". | FR-A2, FR-A7 |
| US-A3 | As the user, I want to distinguish "not enough data" from "zero correct". | A submateri with n=2, 0 correct never outranks n=40, 55 % in the weakness list. | FR-A4 |
| US-A4 | As the user, I want to know when two results are not comparable. | Results under different `configVersion`/`scoringVersion` are never merged into one trend; the incomparability is stated. No config badge is needed in Progres to say so. | FR-A5 |
| US-A5 | As the user, I want a home screen that tells me where I stand and what to do next. | Beranda shows the latest result, top-3 weaknesses with evidence, recent sessions (mode + result, **no config badge**), learner pending actions, and the two start buttons plus "Lanjutkan sesi". **No configuration status.** | FR-D1, FR-D4, FR-D5, FR-D6 |
| US-A6 | As the user, I want practice and tryout to look and behave the same so that I do not re-learn the screen. | Runner layout, navigation and flagging are identical across modes; only timing and feedback differ. | FR-P3 |
| US-A7 | As the user, I want Progres to go deeper than one session when I have enough data. | Progres shows trend, consistency and response-time profile per submateri, each gated by its sample, and practice coverage with attempted/available counts. | FR-A6, FR-A7 |
| US-A8 | As the user, I want to delete history I no longer want, knowing what it costs. | Before deleting, the app states what will change (trend, consistency, weaknesses, empirical difficulty). Deletion removes the session, its snapshot, answers and result in one transaction; a content-free tombstone makes the empty panel explainable. | FR-A8, FR-H4 |

## Rekomendasi & Urutan Belajar (L)

A standalone editable **Rencana Belajar** feature is not in MVP; recommendations and the learning sequence
render where the weaknesses already appear ([MVP_SCOPE](./MVP_SCOPE.md) §2).

| ID | Story | Acceptance | FR |
|---|---|---|---|
| US-L1 | As the user, I want to be told what to study next, with the numbers that justify it. | Each weakness row shows submateri, metric kind, n, session count, gap vs my own mean, difficulty mix, coverage, response time, consistency and trend where reportable. No adjective-only justifications. | FR-L1, FR-L2 |
| US-L2 | As the user, I want learning material for each weakness, clearly labelled by origin and source status. | The offer is `available` (approved version), `draft_available` (exists, not yet approved) or `none` + generate action. Material labels its origin and, where relevant, "Sumber belum terverifikasi". | FR-L3, FR-M5 |
| US-L3 | As the user, I want a one-click drill from a recommendation. | "Latih ini" creates a submateri drill package and starts a Latihan session; the repeat count is stated first. | FR-L4 |
| US-L4 | As the user, I want the order of what to study next, and I do not want it silently reordered. | The sequence is shown on the result and in Progres with its reason; a recomputation replaces the display, never a document the user cannot see. No editable plan screen exists in MVP. | FR-L5, FR-L6 |
| US-L5 | As the user, I want AI to explain and sequence, not to invent. | AI output is validated as a permutation of the closed weakness set plus explanatory text; unknown ids are dropped, missing ones appended deterministically, numeric claims discarded. AI failure leaves the deterministic list intact. | FR-L7 |

## Materi (M)

| ID | Story | Acceptance | FR |
|---|---|---|---|
| US-M1 | As the user, I want to write or AI-draft material per competency. | Create manually or via the `material` task; a draft has status `draft`. | FR-M1 |
| US-M2 | As the user, I want AI material to stay a draft until I approve it. | Approval binds a specific version; any edit creates a new version and returns to `draft`; only approved versions are recommended. | FR-M2 |
| US-M3 | As the user, I want free notes outside the taxonomy that do not distort my analytics. | A free-note material binds no node and never appears in a competency metric. | FR-M3 |
| US-M4 | As the user, I want factual material to cite something. | Factual/legal/historical/policy material requires ≥ 1 source; conceptual/strategy material does not. An unverified source is labelled and never presented as official. | FR-M4, FR-M5 |

## Config & AI (C, E)

| ID | Story | Acceptance | FR |
|---|---|---|---|
| US-C1 | As the user, I want to add any OpenAI-compatible provider so that I am not locked to one vendor. | Pick a preset (OpenRouter / OpenAI-compatible / Ollama / custom), set base URL, headers, timeout, retries, extra params; the key is write-only. The connection test shows the scrubbed provider error (`keyLast4` only). | FR-C1, FR-C2 |
| US-C2 | As the user, I want one sensible default with the option to override per feature. | One global default provider+model; optional overrides for question, explanation, material, analysis. An unmapped feature is disabled with a reason. | FR-C4 |
| US-C3 | As the user, I want my API key never displayed again after entry, and never exported. | Key lives in OS secure storage; only a masked tail is shown; never in a response body, log, backup or bundle. | FR-C6, NFR-7 |
| US-C4 | As the user, I want the app to be useful before I configure any AI provider. | All non-AI features work offline; empty-state copy explains what AI adds. | FR-C7 |
| US-C5 | As the user, I want to pick a model even when the provider cannot list them. | Model list when supported; manual Model ID always accepted; capabilities auto-detected and manually correctable. | FR-C3, FR-C5 |
| US-C6 | As the user, I want a provider failure to be clear, not silently swapped. | A failure names the provider, model and scrubbed reason; retry is manual on the same pair; no automatic fallback; no token or cost figures anywhere. | FR-C8 |
| US-E1 | As the user, I want to manage exam configuration away from my study screens. | Everything sits in **Kelola → Konfigurasi Ujian**: config list, evidence basis, `Belum Terverifikasi` notice. Nothing about it appears on Beranda or Progres. | FR-E1, FR-E2 |
| US-E2 | As the user, I want to approve thresholds deliberately. | Dialog shows config id, configVersion, scoringVersion, regulatoryBasisHash, the warnings accepted, and the `notice`. | FR-E3 |
| US-E3 | As the user, I want a rule change to break approval automatically without blocking my practice. | Any version bump invalidates approval; later results show the score with no verdict and name what changed. Sessions still start and score. | FR-E4 |
| US-E4 | As the user, I want to study even when the 2026 rules are not verified. | Tryouts start on a temporary config labelled **Belum Terverifikasi**, built from documented references; I may adjust a value but cannot enter one without a documented basis. | FR-E5, FR-E6 |

## Paket, backup, notifikasi (K, H, N)

| ID | Story | Acceptance | FR |
|---|---|---|---|
| US-K1 | As the user, I want both a full simulation and single-subtest tryouts. | Built-in *Simulasi SKD Lengkap* (TWK+TIU+TKP) plus *TWK*, *TIU*, *TKP* packages. | FR-K1 |
| US-K2 | As the user, I want my own package built from a template. | Create from a template; save = new immutable version; a started session stays pinned to the version it used. | FR-K3 |
| US-K3 | As the user, I want to avoid seeing the same questions again while I still have unseen ones. | Selection avoids previously answered questions while eligible stock suffices; a repeat is warned before start and counted in the result's roster summary. | FR-K4 |
| US-H1 | As the user, I want a backup I can trust. | Automatic and manual to my folder; each archive is verified before it is called a success; a failure is reported as failure with the reason and a notification. | FR-H1, FR-H2 |
| US-H2 | As the user, I want to move to another machine. | Restore wizard validates compatibility, previews what will be replaced, restores verbatim, and asks for keys again (never exported). | FR-H3 |
| US-N1 | As the user, I want to know when background work finishes without watching the screen. | Jobs, sampling, backups, reports and restores raise in-app notifications with an unread badge and a deep link; no OS notification is used. | FR-N1, FR-N2 |
| US-N2 | As the user, I want the app to survive a restart without lying about jobs. | Leftover jobs are inspected; only safe work resumes; the rest are marked `interrupted` with a retry action; partial results are kept; no duplicate questions are created. | FR-N3 |

---

## Non-goals (explicitly not stories)

Multi-user accounts · login/logout · teacher or admin roles · cloud sync of a live database · sharing
results · PDF export · mobile native app · payment · public leaderboards · CSV/Excel import · bulk
question editing · saved filters · OS notifications · pause/resume of a generation job · cross-provider
AI fallback · token/cost reporting · any non-CPNS recruitment pathway.
