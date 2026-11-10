# Frontend PRD

Frontend-side product requirements, derived from [PRD.md](../product/PRD.md) §9. This file declares
**what the UI does**; data shapes are [FRONTEND_DATA_CONTRACTS.md](./FRONTEND_DATA_CONTRACTS.md);
screens are [FRONTEND_PAGE_SPECIFICATIONS.md](./FRONTEND_PAGE_SPECIFICATIONS.md).

---

## 1. Scope & stance

- The frontend **renders backend-contract data and never recomputes** scores, metrics, coverage or
  ranking (BR-X2).
- Before the backend exists it runs on a **mock layer** with the same envelopes
  ([FRONTEND_MOCK_DATA_STRATEGY](./FRONTEND_MOCK_DATA_STRATEGY.md)).
- No automated frontend tests (ADR-007); verification is the manual checklist in
  [FRONTEND_ACCESSIBILITY](./FRONTEND_ACCESSIBILITY.md) §6.
- Stack is the **leading candidate** React + TS + Vite + **Tailwind** (ADR-010, Proposed).
- **A first-time CPNS candidate who has never used a study app can start a first tryout without
  reading a manual, and without making a single technical choice.** That is the acceptance bar.

## 2. Two areas

| Area | User | Responsibility |
|---|---|---|
| **Belajar** | the learner | Beranda, Tryout, Latihan, Progres |
| **Kelola** | the owner (same person, no separate account) | Bank Soal, Review Soal, Materi, Generasi AI, Pengaturan AI, Konfigurasi Ujian, Manajemen Paket |

Full item list and routes: [FRONTEND_INFORMATION_ARCHITECTURE](./FRONTEND_INFORMATION_ARCHITECTURE.md) §2, §4.

Management is **not** access-controlled: there is no login, no role, no account
([AUTHENTICATION](../backend/AUTHENTICATION.md), ADR-009). Anyone who opens the app on this machine can
use every management screen. The UI states this plainly on the Lainnya screen rather than implying a
permission boundary that does not exist (U-F10). Management items are reachable only through
"Lainnya", never in the Belajar section of the dock.

## 3. Feature coverage

Every PRD §9 requirement, with its frontend surface:

| FR | Frontend surface | Status |
|---|---|---|
| FR-D1 latest result | Beranda card (`GET /analytics`) | supported |
| FR-D2 submateri metrics ≥ threshold | Beranda card, Progres | supported |
| FR-D3 top-3 weaknesses | Beranda list; ranking backend-owned | supported |
| FR-D4 recent history, **no config badge** | Beranda list (`GET /sessions`) | supported |
| FR-D5 learner pending actions | notifications + `GET /question-batches` | supported |
| FR-D6 start entry points + resume | Beranda cards | supported |
| FR-T1 package start, config server-bound | `/tryout`, `/tryout/:packageId` | supported |
| FR-T2 accumulated-active-time countdown | runner header, server-confirmed `activeMs` | supported |
| FR-T3 navigate + flag | grid + prev/next, flag persisted | supported |
| FR-T4 autosave / resume | autosave with clock, Beranda "Lanjutkan sesi" | supported |
| FR-T5 submit + blanks confirmation | `/tryout/sesi/:id/konfirmasi` | supported |
| FR-T6 result + explanations only after end | `/tryout/sesi/:id/hasil` | supported |
| FR-T7 no verdict without approval | result note | supported |
| FR-T8 blank never correct | per-question row `—` | supported |
| FR-P1 submateri picker with stock | `/latihan` | supported |
| FR-P2 untimed default, same clock rule | runner | supported |
| FR-P3 same runner | shared runner component | supported |
| FR-P4 feedback after each answer, TKP weights | runner feedback block | supported |
| FR-P5 repeat count stated before start | start card | supported |
| FR-A1…FR-A7 analysis surfaces | `/progres`, `/progres/kompetensi/:id` | supported |
| FR-A8 delete history with consequences | result screen §5.1 | supported |
| FR-G1…FR-G8 generation | `/lainnya/generasi`, notification centre | supported |
| FR-Q1…FR-Q8 bank, review, reports | `/lainnya/soal`, `/lainnya/review` | supported |
| FR-L1…FR-L7 recommendations + learning sequence | result, Beranda, Progres (no standalone plan screen) | supported |
| FR-M1…FR-M5 materials | `/lainnya/materi`, `/lainnya/materi/:id` | supported |
| FR-C1…FR-C8 AI configuration | `/lainnya/ai` | supported |
| FR-E1…FR-E6 exam configuration | `/lainnya/ujian`, `/lainnya/ujian/:id` | supported |
| FR-K1…FR-K4 packages | `/lainnya/paket`, package cards | supported |
| FR-H1…FR-H3 backup / restore | `/lainnya/pengaturan` | supported |
| FR-H4 history deletion consequences | delete dialog | supported |
| FR-N1…FR-N3 notifications | bell + `/lainnya/notifikasi` | supported |

Remaining partial contracts are listed in [FRONTEND_GAP_REGISTER](./FRONTEND_GAP_REGISTER.md) §3–§4 and
are all `low`.

## 4. Hard rules

- **TWK/TIU** show `Benar` / `Salah` / `— (tidak dijawab)`; an unanswered item is never "salah".
- **TKP** never shows a correct option or a right/wrong count — only attained points and, in Latihan,
  each option's weight with the reason it earns that weight.
- **A verdict is rendered only where a valid approval supports one.** A `provisional` config still
  starts and still scores; only `verdict` is withheld
  ([SCORING_METHODOLOGY](../examination/SCORING_METHODOLOGY.md) §5.6). Never "lulus/tidak lulus".
- **The learner never chooses a config, a package version or a scoring rule.** The server binds them.
- **No config status on Beranda and no config information on Progres.** Rules live in Kelola.
- **Explanations are hidden mid-tryout**; Latihan shows them after each answer.
- **Provider keys are never shown** beyond a masked tail, and never requested from the browser.
- **No invented copy about the exam.** No duration, item count, NAB or pass rule appears in UI copy
  unless it came from a returned field.
- **No token or cost figure** appears anywhere.

## 5. Non-functional (frontend slice)

- Responsive 360 px → desktop; 16 px gutter; no horizontal scroll (NFR-8).
- Keyboard operable; WCAG 2.1 AA (NFR-4, NFR-5, [FRONTEND_ACCESSIBILITY](./FRONTEND_ACCESSIBILITY.md)).
- Local-first: the frontend talks only to `127.0.0.1` (NFR-1).
- Empty database renders meaningfully (NFR-10).
- Session state survives reload, closed browser and app restart (NFR-3).
- No secret in the bundle or browser storage (NFR-7).

## 6. Out of scope

Fixed by [MVP_SCOPE](../product/MVP_SCOPE.md) §2: multi-device sync, shareable results, PDF export,
figural image generation, spaced repetition, login/accounts/roles, automated frontend tests, CSV/Excel
import, bulk question editing, saved filters, OS notifications, job pause/resume, cross-provider
fallback, token/cost display, any non-CPNS recruitment pathway, and every `/study-plan` or
`/progres/paket` route (the standalone Rencana Belajar feature is not in MVP; the learning sequence
renders inline).

## 7. Unsupported requirements

Everything in PRD §9 now has a supporting contract. Residual partials (all low, non-blocking) are on the
[FRONTEND_GAP_REGISTER](./FRONTEND_GAP_REGISTER.md): `FieldEdit` (GAP-M1), duplicate-cluster detail
(GAP-M4), `ConfigSummary` alias (GAP-M9), `SubtestStructure`/`ScoringRules` detail (GAP-M12),
`X-Tryoutsim-Client` placement (GAP-X1), `meta.version` enumeration (GAP-X2), `bucketUnit` (GAP-X4).
