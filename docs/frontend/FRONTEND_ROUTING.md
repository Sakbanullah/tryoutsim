# Frontend Routing

Route table and behaviour. Screen map is [FRONTEND_INFORMATION_ARCHITECTURE.md](./FRONTEND_INFORMATION_ARCHITECTURE.md);
this file fixes URLs, guards, and what the URL may carry.

---

## 1. Route table

| Path | Screen | Area | Guard |
|---|---|---|---|
| `/` | Beranda | Belajar | — |
| `/tryout` | Pilih tryout (packages) | Belajar | — |
| `/tryout/sesi/:id` | Ujian berlangsung | Belajar | session `open` |
| `/tryout/sesi/:id/konfirmasi` | Konfirmasi kirim | Belajar | session `open` |
| `/tryout/sesi/:id/hasil` | Hasil | Belajar | session `submitted` |
| `/latihan` | Pilih submateri | Belajar | — |
| `/latihan/sesi/:id` | Latihan berlangsung | Belajar | session `open` |
| `/latihan/sesi/:id/hasil` | Ringkasan latihan | Belajar | session `submitted` |
| `/tryout/:packageId` | Detail paket + petunjuk | Belajar | package exists, not retired |
| `/progres` | Perkembangan | Belajar | — |
| `/progres/kompetensi/:id` | Detail submateri | Belajar | — |
| `/lainnya` | Daftar Kelola | Kelola | — |
| `/lainnya/soal` | Bank Soal | Kelola | — |
| `/lainnya/soal/:id` | Detail soal | Kelola | question exists |
| `/lainnya/review` | Review Soal | Kelola | — |
| `/lainnya/materi` | Materi | Kelola | — |
| `/lainnya/materi/:id` | Detail materi | Kelola | material exists |
| `/lainnya/generasi` | Generasi AI | Kelola | — |
| `/lainnya/generasi/:jobId` | Progres generasi | Kelola | job exists |
| `/lainnya/ai` | Pengaturan AI | Kelola | — |
| `/lainnya/ujian` | Konfigurasi ujian | Kelola | — |
| `/lainnya/ujian/:id` | Detail + persetujuan | Kelola | config exists, `pathway: 'CPNS'` |
| `/lainnya/paket` | Manajemen Paket | Kelola | — |
| `/lainnya/paket/:id` | Detail paket + versi | Kelola | package exists |
| `/lainnya/notifikasi` | Pusat pemberitahuan | Kelola (shell) | — |
| `/lainnya/pengaturan` | Pengaturan (backup, restore, data) | Kelola | — |

Matching order is load-bearing: every `/tryout/sesi/...` and `/latihan/sesi/...` route is declared
**before** `/tryout/:packageId`, so a session id is never read as a package id.

Route **renames** from earlier revisions (old paths are gone, not aliased): `/analytics` → `/progres`,
`/practice` → `/latihan`, `/questions` → `/lainnya/soal`, `/generation` → `/lainnya/generasi`,
`/ai` → `/lainnya/ai`, `/exam-configs/:id` → `/lainnya/ujian/:id`. Decision **U-F9**. Added 2026-11-08:
`/lainnya/review`, `/lainnya/materi`, `/lainnya/paket`, `/lainnya/notifikasi`, `/lainnya/pengaturan`,
and `/tryout/:packageId` replacing `/tryout/:configId`.

`/progres/paket` (standalone Rencana Belajar) is **not a route in MVP** — the feature is not approved
([MVP_SCOPE](../product/MVP_SCOPE.md) §2). Recommendations and the learning sequence render inside
`/tryout/sesi/:id/hasil`, `/progres` and `/progres/kompetensi/:id`.

## 2. URL content rules

- URLs carry **ids only** — package id, session id, question id, job id, competency id. All opaque
  ([API_SPECIFICATION](../backend/API_SPECIFICATION.md) §1).
- **No config id in any learner URL.** A session's config is server-bound and appears only on its result
  payload, never in a route.
- **No answer, score, threshold or selection data in the URL or the query string.** Bank Soal filters are
  the documented exception: they live in the query string so a refresh keeps them, and they are persisted
  as a named view **nowhere** ([FRONTEND_PAGE_SPECIFICATIONS](./FRONTEND_PAGE_SPECIFICATIONS.md) §Bank
  Soal).
- Selected answer, flag, tab and scroll state live in the tab's memory or the module store
  ([FRONTEND_STATE_MANAGEMENT](./FRONTEND_STATE_MANAGEMENT.md) §2), never in the URL — so a pasted
  link can never expose a choice.

## 3. Guards

| Guard | Behaviour |
|---|---|
| `/hasil` on an `open` session | redirect to the runner — no premature result (FR-T6) |
| `/hasil` before the session is submitted | never reached: the result route requires `submitted` |
| `/hasil` on a `submitted` session whose verdict is absent | render the score **and** the "ambang batas belum terverifikasi" note; never a pass/fail badge ([FRONTEND_RESULTS_ANALYTICS](./FRONTEND_RESULTS_ANALYTICS.md) §5) |
| `/tryout/:packageId` for a retired package | render the detail read-only with a "paket tidak lagi ditawarkan" note; "Mulai" disabled with the reason |
| `/lainnya/ujian/:id` for a `legacy` config | `404` — the route never exposes a retained non-CPNS config |
| Unknown id | a single "tidak ditemukan" screen with a back link; never a blank page |
| `CONTRACT_MISMATCH` (426) | a full-screen notice asking the user to reload; no partial rendering |

## 4. Navigation behaviour

- **Leaving a runner** pauses the clock: the pending autosave (answer + clock) is flushed first, then
  navigation proceeds ([FRONTEND_EXAM_FLOW](./FRONTEND_EXAM_FLOW.md) §6). A failed autosave keeps the user
  on the runner with a persistent "belum tersimpan" indicator — it never silently discards, and it never
  leaves the clock running.
- **Refreshing a runner** re-loads the session with its saved answers and the resumed clock. The browser
  back button asks for confirmation before leaving, because leaving pauses a timed session.
- **Returning to the app** with an `open` session offers "Lanjutkan sesi" from Beranda; the route is the
  same runner path.
- **Notification deep links** use `link.route` + `link.entityId` from the notification record; the target
  screen re-fetches its own contract ([NOTIFICATION_SPECIFICATION](../backend/NOTIFICATION_SPECIFICATION.md) §3).

## 5. Determinism

Same path + same ids → same screen. No navigation state beyond ids; the router library is an
implementation detail ([FRONTEND_IMPLEMENTATION_PLAN](./FRONTEND_IMPLEMENTATION_PLAN.md) §3).
