# Frontend GAP and Unresolved-Decision Register

Every place where the frontend specification could not be completed from an existing contract, and every
owner decision the frontend depends on. Created by the frontend documentation revision (2026-11-08); IDs
are stable and never renumbered.

**Rules for this file.** A `GAP` means the requirement is real but no documented contract supports it. A
`CONFLICT` means two canonical documents disagree; both are cited and *neither* is treated as
authoritative here. Nothing in this file changes a backend, examination, product or security document.
Resolving an entry is an owner act recorded in [../AUDIT.md](../AUDIT.md).

Status key: `OPEN` (blocking a flow) · `OPEN (later phase)` · `RESOLVED` (fixed — kept so the record is
complete).

**Round 4 (2026-11-08) changed the answer for most entries in §1–§3.** The contracts they named as missing
now exist in [API_ENDPOINTS](../backend/API_ENDPOINTS.md) and
[API_SPECIFICATION](../backend/API_SPECIFICATION.md) §7.4–§7.6. Entries are kept with their original text,
a `RESOLVED` status and the contract that closed them.

---

## 1. Learning-flow GAPs

| ID | Flow | Original gap | Status now | Closed by |
|---|---|---|---|---|
| **GAP-F1** | Tryout, results | No endpoint listed sessions or results | **RESOLVED** | `GET /sessions` (history, newest first, filters) |
| **GAP-F2** | Exam runner | No endpoint returned the questions a session contains | **RESOLVED** | `GET /sessions/:id` runner payload; keys/explanations excluded for a tryout |
| **GAP-F3** | Exam runner | `PATCH /sessions/:id/answers` body undefined | **RESOLVED** | `PATCH /sessions/:id/answers`: `{ questionId, selected, flagged?, elapsedActiveMs }` |
| **GAP-F4** | Exam runner | Flag persistence undocumented | **RESOLVED** | `flagged` in the autosave body, stored on `answer_sheet` |
| **GAP-F5** | Exam runner, timer | No field returned a deadline; no expiry rule | **RESOLVED** | Accumulated active time: `activeMs`/`runningSince`/`durationMs` in `Session`, expiry evaluated on resume (scoring §8.1) |
| **GAP-F6** | Exam runner | No route distinguished "content without key" from "content with key" | **RESOLVED** | Runner payload carries no `answerKey`/`explanation` for a tryout; Latihan feedback only through `POST /sessions/:id/answer-feedback` |
| **GAP-F7** | Result | Tryout per-question explanation unsettled (FR-T6 vs FR-P4) | **RESOLVED — decision:** explanations **only after the session ends**; Latihan shows them after each answer | PRD FR-T6/FR-P4, `FRONTEND_EXAM_FLOW.md` §9 |
| **GAP-F14** | Result | No documented way to read a question's **frozen** content, key and TKP weights after submit: `ScoreResult.byQuestion` carries none of them, `GET /sessions/:id` excludes keys/explanations, and `GET /questions/:id` is the Kelola view returning live content | **RESOLVED — decision 2026-11-09 (P-1b), route shape confirmed (T-05):** `GET /sessions/:id/questions?ids=…` — frozen snapshot content + key + weights, explanation on strict version match, `submitted` sessions only | [API_SPECIFICATION](../backend/API_SPECIFICATION.md) §7.7, E78 |
| **GAP-F15** | Result | TKP had no per-option **reasoning** data, only one explanation string, while the review block must state why each option earns its weight | **RESOLVED (contract shape) — decision 2026-11-09 (P-3b, T-04):** `answerKey.optionJustifications` on the question ([QUESTION_SPECIFICATION](../examination/QUESTION_SPECIFICATION.md) §1.2, V-13), frozen with the key; back-fill not required (T-03). **Open:** storage/version mechanics (E78-T2) | `FRONTEND_RESULTS_ANALYTICS.md` §2.2.1.1 |
| **GAP-F16** | Result | Questions whose answers predate GAP-F15 have no per-option reasoning, and explanations could mismatch the frozen wording | **RESOLVED (behaviour) — decisions 2026-11-09 (R-A/R-B/R-C, T-01, T-03):** mismatch hides the explanation with a stated notice; a Latihan link only for a resolved material relation; missing justifications render every weight + one sentence. **Open:** version-identity and material-resolution mechanisms (E78-T4, T-02) | `FRONTEND_RESULTS_ANALYTICS.md` §2.2.3, §2.2.4 |

## 2. Latihan, Beranda, Progres GAPs

| ID | Flow | Original gap | Status now | Closed by |
|---|---|---|---|---|
| **GAP-F8** | Latihan | No endpoint listed questions for practice | **RESOLVED** | `GET /latihan/submateri` (leaves + stock) and `POST /packages/:id/sessions` (server assembles the roster) |
| **GAP-F9** | Beranda | `GET /bootstrap` shape one abbreviated line | **RESOLVED** | `GET /bootstrap`: `{ taxonomy, packages[], providers[], questionBankSummary, analyticsReady, notifications.unreadCount, defaults }` — **no exam-config list** |
| **GAP-F10** | Beranda, Progres | "Pending actions" had no endpoint | **RESOLVED** | `GET /notifications` (unread + `action` severity) plus `GET /question-batches` |
| **GAP-F11** | Progres | `TrendSeries` shape undefined | **RESOLVED** | `TrendSeries` in [FRONTEND_DATA_CONTRACTS](./FRONTEND_DATA_CONTRACTS.md) §3 |
| **GAP-F12** | Progres | Recommendation payloads undefined | **RESOLVED** | `GET /recommendations/weaknesses`, `POST /recommendations/drill`, `MaterialOffer`. The `/study-plan` pair was withdrawn with the standalone plan feature |
| **GAP-F13** | Progres | Top-level taxonomy evidence overstatement risk | **RESOLVED (wording)** | Node tier renamed `EVIDENCE-BACKED-NOT-CPNS-2026`; the learner area renders **no tier badge** — the taxonomy is a study structure, not an evidence claim |

## 3. Kelola-area GAPs

| ID | Flow | Original gap | Status now | Closed by |
|---|---|---|---|---|
| **GAP-M1** | Review draft | `FieldEdit` shape undefined | **OPEN (low)** | Edit mode renders the question form and sends the full edited fields; `FieldEdit[]` is not used by the UI until typed |
| **GAP-M2** | Generation | `POST /generation-jobs` body untyped; plurality disagreed | **RESOLVED** | Body is `{ competencyIds[], difficulty, count }` — plural, matching VALIDATION §2 |
| **GAP-M3** | Generation | Job detail shape undefined | **RESOLVED** | `JobReport` in [FRONTEND_DATA_CONTRACTS](./FRONTEND_DATA_CONTRACTS.md) §3 |
| **GAP-M4** | Bank Soal | Duplicate cluster shape undefined | **OPEN (low)** | Clusters render as `{ contentHash, questionIds[], count }` from `GET /questions/duplicates`; full typing deferred |
| **GAP-M5** | Bank Soal | `GET /questions` response shape undefined | **RESOLVED** | Paginated `Question` list with per-facet counts |
| **GAP-M6** | AI settings | `keyLast4` absent from `Provider` | **RESOLVED** | `GET /providers` returns `keyLast4` + `hasKey`; key material never serialised |
| **GAP-M7** | AI settings | `POST /providers` body untyped | **RESOLVED** | Create takes `preset`, `baseUrl`, `key` (write-only), `timeoutMs`, `headers`, `extraParams`, `defaultModel` |
| **GAP-M8** | AI settings | `PUT /providers/:id/task-map` body untyped | **RESOLVED (replaced)** | `GET/PUT /ai-routing` with `default` + `perTask`; capabilities via `PUT /providers/:id/capabilities` |
| **GAP-M9** | Exam config | `ConfigSummary` used but undefined | **OPEN (low)** | The dialog renders `ExamConfig` fields directly; `ConfigSummary` remains an alias without a separate type |
| **GAP-M10** | Exam config | `PATCH /exam-configs/:id` missing | **RESOLVED (by decision)** | A config change is a **new version** (`POST /exam-configs`); in-place edit does not exist by design |
| **GAP-M11** | Exam config | Outstanding `UNV-*` ids not exposed | **RESOLVED** | `GET /exam-configs/:id` returns `outstandingWarnings[]`; each adjusted value acknowledges its warning id |
| **GAP-M12** | Exam config, bank | `SubtestStructure` never defined | **OPEN (low)** | Not rendered; instructions show item counts from the package definition instead |

## 4. Cross-cutting contracts

| ID | Area | What is missing | Status |
|---|---|---|---|
| **GAP-X1** | Security | Required client header `X-Tryoutsim-Client: 1` belongs in the API contract, not only SECURITY §2 | `OPEN (placement)` — the frontend treats it as mandatory |
| **GAP-X2** | Contract version | Current `meta.version` string not enumerated | `OPEN (low)` — the frontend compares for equality only |
| **GAP-X3** | Error union | `RATE_LIMITED` `retryAfterMs` bundling | `RESOLVED` (2026-11-08) |
| **GAP-X4** | `bucketUnit` | `bucketUnit` appears in the scoring doc but not in the wire example | `CONFLICT` — treated as optional and ignored |
| **GAP-X5** | Answer sheet on submit | Whether submit re-sends answers | `RESOLVED` — submit reads the **saved** sheet; the client sends no answers |
| **GAP-X6** | Practice answer keys | Whether practice payloads disclose keys | `RESOLVED` — `POST /sessions/:id/answer-feedback` returns key, explanation and per-option weights |
| **GAP-X7** | Recommended materials | Success shape never documented; MVP returned an absence envelope | `RESOLVED` — `MaterialOffer` union with `available` / `draft_available` / `none`; DB-1 superseded |

## 5. Owner decisions the frontend depends on

| ID | Decision | Status / resolution | Source |
|---|---|---|---|
| **U-F1** | Does MVP ship a countdown? | **Decided.** Accumulated active time; a countdown exists only when the bound config asserts a duration | Owner decision 2026-11-08, scoring §8.1 |
| **U-F2** | Does the runner receive keys/explanations? | **Decided.** No, never before submit in a tryout; Latihan via the feedback route | FRONTEND_EXAM_FLOW §2, §9 |
| **U-F3** | Tryout explanations shown or hidden? | **Decided.** Shown **after the session ends** only | PRD FR-T6 |
| **U-F4** | Is manual subject practice in MVP? | **Decided.** Yes — by submateri, through packages | PACKAGE_SPECIFICATION §6 |
| **U-F5** | `TrendSeries` shape | **Decided.** Defined; rendered only where reportable | ANALYTICS_ENGINE §6 |
| **U-F6** | Recommendation payloads | **Decided.** Defined; AI orders and explains only. A standalone plan feature is **not in MVP** | RECOMMENDATION_ENGINE §6-§7 |
| **U-F7** | Generation: one competency or many? | **Decided.** Many — `competencyIds[]` | VALIDATION §2 |
| **U-F8** | Where do outstanding warning ids come from? | **Decided.** `outstandingWarnings[]` on the config detail | API_ENDPOINTS §2 |
| **U-F9** | Navigation placement | **Decided.** Five-item dock; Belajar + Kelola split | FRONTEND_INFORMATION_ARCHITECTURE §2, §4 |
| **U-F10** | Management area not access-controlled | Documented limitation, unchanged | FRONTEND_PRD §5 |
| **U-F11** | How a tryout roster is assembled | **Decided.** Server-side from the package version; the client never assembles a roster | PACKAGE_SPECIFICATION §4 |
| **U-F12** | Ship the runner with a recovery limitation? | **Decided.** No limitation ships: autosave + resume are contractual | API_SPECIFICATION §7.5 |

## 6. What is explicitly *not* a GAP

- **Authentication.** No auth exists by design ([AUTHENTICATION](../backend/AUTHENTICATION.md), ADR-009).
  The UI has no login.
- **Accounts / roles / multi-user.** Out of scope ([MVP_SCOPE](../product/MVP_SCOPE.md) §2).
- **PDF export, sync, figural image generation, CSV/Excel import, bulk editing, saved filters, OS
  notifications, job pause/resume, AI fallback, token/cost display.** Out of scope by decision
  ([MVP_SCOPE](../product/MVP_SCOPE.md) §2).
- **Materials bank.** In MVP — [MATERIAL_SPECIFICATION](../examination/MATERIAL_SPECIFICATION.md). DB-1 is
  superseded.
- **A config selector in the learner area.** Not a gap; a deliberate removal (AUD-67).
- **Explanations stored in the session snapshot.** Not a gap to close now. The snapshot keeps text,
  options and keys, not explanations ([DATABASE_SCHEMA](../backend/DATABASE_SCHEMA.md) §`session_snapshot`).
  The explanation is shown only on strict version equality with the frozen version (PO 2026-11-09), so
  R-A is closed behaviourally; what remains is the version-identity mechanism (E78-T4). Storing the
  explanation in the snapshot would be a separate decision touching scoring §7.2 and backup size.
- **Comparing a latest explanation against the frozen wording for consistency.** Not a gap; a heuristic
  the UI must not perform — strict version matching replaced it (FRONTEND_RESULTS_ANALYTICS §2.2.3).

## 7. Questions on the review block (2026-11-09)

Statuses below are the **final** ones after the Product Owner decisions of 2026-11-09 (see AUD-78).

| # | Question | Decision | Status |
|---|---|---|---|
| T-01 | Is a latest explanation guaranteed to apply to the frozen wording? | **DECIDED.** Strict version matching: the explanation is shown only when its version equals the frozen snapshot version; otherwise it is hidden. No AI relevance check, no manual compatibility judgement | Product **RESOLVED**. Mechanism: **UNRESOLVED — TECHNICAL DESIGN REQUIRED** (E78-T4) |
| T-02 | What happens when no explanation is available? | **DECIDED.** The block says "Pembahasan untuk soal ini belum tersedia." — never hidden silently. A Latihan navigation link is offered **only** for a valid, relevant material relation; no invented destination | Behaviour **RESOLVED**. Material-relation resolution: **UNRESOLVED — TECHNICAL DESIGN REQUIRED**. Whether the link belongs in this notice and its final copy: **UNRESOLVED — PO DECISION REQUIRED** (final copy not stated) |
| T-03 | Historical TKP keys without `optionJustifications` | **DECIDED.** Back-fill not required; such questions stay usable; every option and weight renders; the block states the per-option reasoning is unavailable; nothing invented; no automatic migration or back-fill. New questions must meet V-13 before activation | **RESOLVED**. History is not claimed to satisfy V-13 |
| T-04 | Where `optionJustifications` live | **DECIDED (direction):** inside `AnswerKey`, beside `optionScores` ([QUESTION_SPECIFICATION](../examination/QUESTION_SPECIFICATION.md) §1.2) | **UNRESOLVED — TECHNICAL DESIGN REQUIRED** (E78-T2): database storage, serialisation/deserialisation of the snapshot, reading historical keys, any migration, V-13 enforcement before activation |
| T-05 | Route shape for E78 | **DECIDED.** `GET /sessions/:id/questions?ids=id1,id2,…` — max 20 ids, all roster members, duplicates/malformed/unknown/outside-session all rejected with the same `400`, `submitted` only, UI still 5 per page, one batch per page | **RESOLVED** (final API contract) |
| T-06 | Deleted or archived question | **Answered:** archival never removes a question from past sessions (QUESTION_SPECIFICATION §7.2); frozen content and key still render, `questionState` names the state. **No route in the contract deletes a question row** | **UNRESOLVED — TECHNICAL DESIGN REQUIRED** if a hard delete is ever added; not active today |
