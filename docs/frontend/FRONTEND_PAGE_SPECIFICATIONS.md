# Frontend Page Specifications

Screen-by-screen specification. Data shapes: [FRONTEND_DATA_CONTRACTS](./FRONTEND_DATA_CONTRACTS.md).
Routes: [FRONTEND_ROUTING](./FRONTEND_ROUTING.md). Gaps: [FRONTEND_GAP_REGISTER](./FRONTEND_GAP_REGISTER.md).
Navigation: [FRONTEND_INFORMATION_ARCHITECTURE](./FRONTEND_INFORMATION_ARCHITECTURE.md). Exam runner detail:
[FRONTEND_EXAM_FLOW](./FRONTEND_EXAM_FLOW.md). Result & analytics:
[FRONTEND_RESULTS_ANALYTICS](./FRONTEND_RESULTS_ANALYTICS.md).

Each screen states: purpose · entry · exit · layout · API · states · responsive · accessibility ·
unresolved dependency. API calls are named exactly as in [API_ENDPOINTS](../backend/API_ENDPOINTS.md).

---

## 1. Beranda (`/`)

| Field | Value |
|---|---|
| Purpose | tell the learner where they stand and what to do next — never what the app is configured with |
| Target | learner |
| Entry | app root; dock "Beranda" |
| Exit | Tryout list, Latihan, Progres, continue an open session, last result |

**Layout (top → bottom)**
1. Greeting card (lavender wash): "Selamat belajar. Sudah siap mencoba tryout?" + mascot.
2. **Resume card** — only when an `open` session exists: "Lanjutkan sesi — TWK, soal 12 dari 30", with
   the remaining active time. Primary action while a session is open.
3. **Primary action** — "Mulai tryout" (goes to `/tryout`: *Simulasi SKD Lengkap* / *TWK* / *TIU* / *TKP*)
   and a secondary "Latihan". If no eligible stock exists for a package, the card states the reason and
   links to Kelola → Bank Soal / Generasi AI. **Never** a configuration reason.
4. Activity summary — per-test `earned/possible` from `GET /analytics` when a snapshot exists; otherwise
   the empty state.
5. **Titik lemah** — up to 3 weakest submateri with their numbers, each with "Latih ini".
6. Recent activity — last sessions (up to 10) as mode · date · result summary. **No config badge, no
   config state, no scoring version.**
7. Pending actions **that belong to the learner**: a batch awaiting sampling (links to Review Soal), a
   provider that is not configured (links to Pengaturan AI), an unreported backup failure.
8. "Cara memulai" — 3 short steps, first-run only: *pilih tryout → jawab soal → lihat hasil*.

**API**: `GET /bootstrap` (packages, providers, unread count); `GET /analytics` (optional);
`GET /sessions` (recent + open session); `GET /recommendations/weaknesses` (optional).

**States**
- Loading: skeleton of the cards.
- Empty (no questions at all): "Belum ada soal. Kamu bisa menambah soal dengan AI." — the app works
  without AI (FR-C7), so Latihan stays reachable if any submateri has stock.
- Error: "Gagal memuat beranda. Coba lagi."
- Success: the cards, with counts.

**Responsive**: single column at all widths; on desktop two columns (primary action | summary).
**A11y**: greeting is a heading; the resume card is the first focusable element when present.
**Unresolved**: none blocking. **Explicitly absent**: any exam-config control, badge or status
([FRONTEND_INFORMATION_ARCHITECTURE](./FRONTEND_INFORMATION_ARCHITECTURE.md) §6).

## 2. Tryout — Pilih paket (`/tryout`)

| Field | Value |
|---|---|
| Purpose | choose which simulation to sit, **by name** |
| Entry | dock "Tryout"; Beranda primary action |
| Exit | package detail; back to Beranda |

**Layout**: a card per package from `GET /packages?mode=tryout`:

| Package | Shows |
|---|---|
| **Simulasi SKD Lengkap** | TWK+TIU+TKP, item count, duration **only if the bound config asserts one**, stock status |
| **TWK** / **TIU** / **TKP** | subtest name, item count, duration if asserted, stock status |

Each card states availability: enough eligible stock → "Mulai"; short stock → the shortfall and the
repeat warning ("Sebagian soal akan diulang"); zero stock → "Belum cukup soal" with a link to Kelola →
Generasi AI.

**No exam config appears anywhere on this screen.** The config is bound by the server at session
creation ([PACKAGE_SPECIFICATION](../product/PACKAGE_SPECIFICATION.md) §3).

**API**: `GET /packages`.
**States**: loading skeleton; empty ("Belum ada paket tryout"); error + retry.
**A11y**: each card is one link; the stock status text is part of the link name.

## 3. Tryout — Detail & Petunjuk (`/tryout/:packageId`)

| Field | Value |
|---|---|
| Purpose | let the user read what the session contains and the honest caveat **before** starting |
| Entry | package card |
| Exit | session runner; back |

**Layout**
1. Title: package name + kind (Simulasi lengkap / Subtes).
2. **Isi sesi** — subtest composition and item count from the package definition and the assembly result.
   Duration is shown **only** when the bound config asserts one, as "Waktu: 100 menit (dihitung saat kamu
   mengerjakan)".
3. **Cara penilaian** — one paragraph: points per subtest ceiling, TKP has no wrong answer but weighted
   options, blanks score zero.
4. **Catatan** — the config's `notice` **only when a threshold verdict is involved**; otherwise a single
   line: "Skor dan analisis tetap tersedia. Ambang batas kelulusan CPNS 2026 belum terverifikasi."
   Never a "perlu persetujuan" lock.
5. Primary "Mulai" — starts `POST /packages/:id/sessions` with `{ mode: 'tryout' }`.

**API**: `GET /packages/:id`; on start `POST /packages/:id/sessions`.
**No roster is sent by the client and no config id is accepted** ([API_SPECIFICATION](../backend/API_SPECIFICATION.md) §7.4).
**States**: loading; `NOT_FOUND` → not-found screen; `409 no_eligible_stock` → reason with the shortfall;
`409 package_retired` → reason; `409 no_usable_config` → reason + link to Kelola → Konfigurasi Ujian
(occurring only when no CPNS config is startable at all; a `provisional` config is startable, so it does
not produce this error).
**A `provisional` config never blocks start**: the screen says "Soal dan skor tersedia. Ambang batas
kelulusan CPNS 2026 belum terverifikasi", in line with the result footnote
([CPNS_2026_REGULATIONS](../examination/CPNS_2026_REGULATIONS.md) §4.2.1).
**No config picker and no config badge** appear on this screen.
**A11y**: the caveat precedes the start button in DOM order.
**Unresolved**: none. The old `/tryout/:configId` screen and its "Perlu persetujuan" lock are **removed**
([CPNS_2026_REGULATIONS](../examination/CPNS_2026_REGULATIONS.md) §4.2).

## 4. Ujian berlangsung (`/tryout/sesi/:id`) and Latihan runner

Specified in [FRONTEND_EXAM_FLOW](./FRONTEND_EXAM_FLOW.md) — runner, navigation, options, autosave with
clock, submit, pause/resume, expiry, recovery.

## 5. Konfirmasi kirim (`/tryout/sesi/:id/konfirmasi`)

| Field | Value |
|---|---|
| Purpose | make submitting explicit, and make blanks a conscious choice |
| Behaviour | lists **answered / unanswered / flagged counts** from the server's saved sheet; names unanswered items by number; two actions: "Kembali ke soal" (secondary) and "Kirim jawaban" (danger). **When blanks remain, "Kirim jawaban" opens a second confirmation** stating "N soal belum dijawab dan akan bernilai 0." |

On confirm → `POST /sessions/:id/submit`.

| Response | UI |
|---|---|
| 200 `ScoreResult` | go to `.../hasil` |
| 200 with `verdict: null` | go to `.../hasil`; the result screen renders the no-verdict note from `withheld` |
| 422 `PREFLIGHT_FAILED` | stay on confirm; render `errors[]` by `path`, in words; "Belum ada yang dinilai" |
| 422 `PREFLIGHT_FAILED` / 409 `THRESHOLD_CONFIG_INVALID` / 409 `REGULATORY_*` | blocked state, answers kept |
| 409 `CONFLICT reason:"already_submitted"` | go to `.../hasil` |
| network | "Gagal mengirim. Jawabanmu aman." + retry; never a false success |

**A11y**: dialog semantics; focus on "Kembali ke soal" by default (the safe choice).

## 6. Hasil (`/tryout/sesi/:id/hasil`)

Specified in [FRONTEND_RESULTS_ANALYTICS](./FRONTEND_RESULTS_ANALYTICS.md) §2–§5. Explanations become
available here and only here for a tryout. **Tinjau jawaban** (§2.2 there) is a block per question, five
per page; its content is one `GET /sessions/:id/questions?ids=…` request per page (E78,
[API_SPECIFICATION](../backend/API_SPECIFICATION.md) §7.7) — never derived from the `ScoreResult` the
summary already holds.

## 7. Latihan — Pilih submateri (`/latihan`)

| Field | Value |
|---|---|
| Purpose | pick the exact submateri to drill |
| Entry | dock "Latihan"; Beranda; a weakness card; a material |
| Exit | drill start → runner |

**Layout**
1. Three subject sections (Wawasan Kebangsaan / Kemampuan Berpikir / Situasi dan Perilaku Kerja), each
   expandable to its **submateri** list with the stock available per submateri
   (`GET /latihan/submateri`).
2. A submateri row: label, one-line description, "N soal tersedia", and a "Latih" action. A row with zero
   stock is shown disabled with the reason "Belum ada soal untuk submateri ini".
3. Length choice (5 / 10 / 20 / semua yang tersedia) before starting.
4. **Repeat notice**: when eligible unseen stock is short, the start card states "N soal akan diulang
   karena stok soal baru belum cukup." Deliberate repeats are allowed in Latihan.
5. **Titik lemah** section — only when analytics has reportable cells — each with "Latih ini"
   (`POST /recommendations/drill`).

**API**: `GET /latihan/submateri`, `GET /packages?mode=latihan`, `POST /packages/:id/sessions`,
`GET /analytics`, `GET /recommendations/weaknesses`.
**States**: loading; empty taxonomy stock; error + retry.
**A11y**: sections are headings with expand/collapse; stock counts are read in the row label.
**Unresolved**: none.

## 8. Latihan berlangsung + Ringkasan

Runner shared with Tryout ([FRONTEND_EXAM_FLOW](./FRONTEND_EXAM_FLOW.md) §9 covers the differences:
no default deadline, **feedback after every answer**, TKP per-option weights). Summary: attained points
per answer, `—` for unanswered, explanations available for every question.

## 9. Progres (`/progres`), Detail submateri

Specified in [FRONTEND_RESULTS_ANALYTICS](./FRONTEND_RESULTS_ANALYTICS.md) §6–§7. Progres carries
**no config badge and no config filter**; incomparability across rule versions is stated in prose.

## 10. Lainnya (`/lainnya`)

| Element | Behaviour |
|---|---|
| Statement | "Semua pengaturan bisa diubah dari perangkat ini. Aplikasi ini tidak memakai akun." |
| **Kelola** group | the seven items of [FRONTEND_INFORMATION_ARCHITECTURE](./FRONTEND_INFORMATION_ARCHITECTURE.md) §4, in that order, each with a one-line description |
| **Pengaturan** group | Pengaturan (folder backup, retensi, pulihkan, lokasi data) |
| Pusat pemberitahuan | unread count + "Lihat semua" |
| Tentang | version string (`meta.version`), one paragraph on what the app is and what it does not claim |

Items whose route does not exist are omitted (IA §4).

## 11. Bank Soal (`/lainnya/soal`, `/lainnya/soal/:id`)

| Element | Behaviour |
|---|---|
| Search | text over stem (option: include explanations) |
| Filters | subtest, submateri (leaf or domain roll-up), difficulty `aiInitial`, difficulty `empirical`, status, origin, provider, model, batch, created from/to |
| Persistence | filters live in the query string so a refresh keeps them; **no named/saved views** |
| List rows | stem excerpt, subtest, submateri label, lifecycle badge, provenance badge, eligibility marker |
| Detail | full content, **layer T checks V-01…V-12**, layer Q rating, layer K findings, sampling record, review history, version list with the sessions that used each version |
| Manual create | one question at a time in a form; same technical validation, no sampling |
| Lifecycle actions | legal transitions only ([QUESTION_SPECIFICATION](../examination/QUESTION_SPECIFICATION.md) §3): accept/reject, activate, quarantine (reason), archive |
| Illegal action | rendered disabled with the reason ("Tidak bisa diaktifkan sebelum disetujui" / "Menunggu sampel batch") |
| Bulk | archive only: select `active` rows, then one `POST /questions/bulk` call (`active → archived`). **No bulk edit, no import** |
| Duplicates | clusters from `GET /questions/duplicates`, with a bulk-archive action |
| Report | report action available here too (`POST /questions/:id/reports`) |

**API**: `GET /questions`, `GET /questions/:id`, `POST /questions`, `PATCH /questions/:id`,
`PATCH /questions/:id/accept`, `POST /questions/:id/activate`, `POST /questions/:id/quarantine`,
`POST /questions/:id/archive`, `POST /questions/bulk`, `GET /questions/duplicates`,
`POST /questions/:id/reports`.

## 12. Review Soal (`/lainnya/review`)

| Element | Behaviour |
|---|---|
| Purpose | act on what the app flagged: reported questions and batches awaiting a sample |
| Pending batches | list from `GET /question-batches` with counts (`passedForSampling`, `quarantined`) and a "Tinjau sampel" action |
| Sampling screen | shows the sample the backend drew with its `sampleSize` (**quota unresolved** — rendered, never derived), **every Q/K flag of the sampled items**, the statement "Sampel sudah diperiksa, bukan jaminan seluruh soal benar", and three outcomes: bersih / temuan (pick the affected questions) / sistemik |
| Submit outcome | `POST /question-batches/:batchId/sample` |
| Reports queue | `GET /question-reports`, each row: question excerpt, severity, category, note, target version |
| Triage | `PATCH /question-reports/:id` with the user's final decision: `repaired` (opens the editor), `withdrawn`, `rejected` |
| Quarantine list | questions currently `quarantined` with the reason and the repair action |

**API**: `GET /question-batches`, `POST /question-batches/:batchId/sample`, `GET /question-reports`,
`PATCH /question-reports/:id`, `GET /questions?status=quarantined`.
**A11y**: the sampling outcome is a radio group with a required finding list when "temuan" is chosen.

## 13. Materi (`/lainnya/materi`, `/lainnya/materi/:id`)

| Element | Behaviour |
|---|---|
| List | title, scope (submateri / domain / catatan bebas), content type, status, origin, version |
| Create | manual editor, or "Buat dengan AI" (`POST /materials/:id/draft`, task `material`) |
| Detail | body of the current version, source list with each source's verification state, version history, approval state |
| Sources | required for factual/legal/historical/policy; an unverified source renders **"Sumber belum terverifikasi"** and the material states that its factual claim is unverified |
| Approve | approves **this version**; editing afterwards creates a new version and returns to `draft` |
| Retire | leaves the recommendation pool, stays readable |

**API**: `GET/POST /materials`, `GET/PATCH /materials/:id`, `POST /materials/:id/approve`,
`POST /materials/:id/retire`, `POST /materials/:id/draft`.
Rules: [MATERIAL_SPECIFICATION](../examination/MATERIAL_SPECIFICATION.md).

## 14. Generasi AI (`/lainnya/generasi`, `/lainnya/generasi/:jobId`)

| Element | Behaviour |
|---|---|
| Setup | submateri leaf set, difficulty, count (config is implied by the newest usable config) |
| Start | `POST /generation-jobs` → 202 job id. **The job keeps running if the user leaves or closes the browser** |
| Not configured | task `question` unmapped → 409 `reason:"task_unmapped"` → "Belum ada model untuk membuat soal. Atur di Pengaturan AI." |
| Untested pair | 409 `reason:"provider_untested"` → "Uji koneksi dulu di Pengaturan AI." |
| Progress | poll `GET /generation-jobs/:id`; status words: *Menunggu · Berjalan · Selesai · Gagal · Terhenti*; per-batch counts |
| Interrupted | status *Terhenti*, the reason, kept counts, and a "Coba lagi" action (never "melanjutkan") |
| Failure | `failureCategory` → plain text + retry on the same provider/model; scrubbed raw message viewable |
| Review | accept / reject each draft; edit opens the question editor |
| Costs | **no token or cost field is rendered anywhere on this screen** |

No cancel, pause or resume control exists on this screen (Product Owner decision, 2026-11-08). A running
job runs to completion.

**API**: `POST /generation-jobs`, `GET /generation-jobs`, `GET /generation-jobs/:id`,
`POST /generation-jobs/:id/retry`, `PATCH /questions/:id/accept`.

## 15. Pengaturan AI (`/lainnya/ai`)

| Element | Behaviour |
|---|---|
| Provider list | name, `baseUrl`, preset, `timeoutMs`, masked key tail, `hasKey`, last test result |
| Create | preset picker (**OpenRouter / OpenAI-compatible / Ollama / Custom**), base URL prefilled by the preset, key (`type=password`, write-only, never echoed), timeout, retries, headers, extra params |
| Test | `POST /providers/:id/test` → ok + latency, or scrubbed reason; the test also probes capabilities |
| Models | `POST /providers/:id/models` → list; **manual Model ID always accepted** (FR-C3) |
| Global default | one row: provider + model. Explicitly labelled "Dipakai untuk semua fitur kecuali yang diatur khusus" |
| Per-feature overrides | four rows: Soal, Penjelasan, Materi, Analisis → "Ikut default" or a specific pair |
| Capability flags | JSON mode, streaming, max context — each labelled with its source (`otomatis` / `diatur manual`); editing sets it to manual |
| Delete | confirm dialog ("Provider ini akan dihapus dari pengaturan") |
| Never shown | token counts, cost, price, "usage this month" |

**API**: `GET/POST/PATCH/DELETE /providers`, `POST /providers/:id/test`, `POST /providers/:id/models`,
`PUT /providers/:id/capabilities`, `GET/PUT /ai-routing`.

## 16. Konfigurasi Ujian (`/lainnya/ujian`, `/lainnya/ujian/:id`)

| Element | Behaviour |
|---|---|
| List | CPNS configs with state, year, version, approval state. **`Belum Terverifikasi`** rendered for `provisional` |
| Detail | basis list with tiers, thresholds as returned, `notice`, which sessions used this version |
| Temporary config | states the proposed values and their documented origin per field; an adjusted value must acknowledge its warning id |
| Approval dialog | shows the **four bound values** read-only *after* approval returns them; before that shows the context (state, notice) and the `acknowledgedWarnings` checkboxes |
| Approve | `POST /exam-configs/:id/approval` with `{ configId, acknowledgedWarnings }` — the client never sends the four values |
| Copy | "Tanpa persetujuan, hasil tetap tersedia tanpa status lulus/tidak lulus." **No start lock** |
| New version | "Simpan sebagai versi baru" — never an in-place edit of a shipped config |
| Edit | not available |

**API**: `GET /exam-configs`, `GET /exam-configs/:id`, `POST /exam-configs/:id/approval`,
`POST /exam-configs`.

## 17. Manajemen Paket (`/lainnya/paket`, `/lainnya/paket/:id`)

| Element | Behaviour |
|---|---|
| List | built-in and custom packages by mode; kind; version; item count; stock status |
| Built-in | readable, not editable — their definition is product data |
| Create | from a template (full simulation / subtest / submateri drill); pick subtest, submateri leaves, item count, difficulty mix, repeat policy |
| Edit | saving creates a **new version**; the previous version stays readable and any session that used it keeps its binding |
| Config pin | optional per package version, management-side only: "Paket ini memakai konfigurasi {state}". A `provisional` pin reads **Belum Terverifikasi**; if the pin is no longer usable the row says so and resolution falls back to the latest usable config ([CPNS_2026_REGULATIONS](../examination/CPNS_2026_REGULATIONS.md) §4.2.1) |
| Version history | list of versions with creation date and the sessions that used each |
| Retire | stops offering the package; existing sessions unaffected |

**API**: `GET /packages`, `GET /packages/:id`, `POST /packages`, `POST /packages/:id/versions`,
`POST /packages/:id/retire`.
Rules: [PACKAGE_SPECIFICATION](../product/PACKAGE_SPECIFICATION.md) §5.

## 18. Pengaturan (`/lainnya/pengaturan`)

| Element | Behaviour |
|---|---|
| Backup folder | current folder, "Pilih folder", copy-path action |
| Retention | keep last *N* backups (default 7), max age *D* days (default 30) — manual backups never pruned |
| Manual backup | "Backup sekarang"; while one runs, the button shows "Backup sedang berjalan" |
| Status | last success timestamp **and** last failure with its reason; a failure is never styled as success |
| Restore | wizard: choose archive → compatibility check → preview → confirm → restore → re-enter keys |
| Data location | path with a copy action |
| Keys | "Kunci API tidak disertakan dalam backup." |

**API**: `GET/PUT /settings/backup`, `POST /backups`, `GET /backups`, `POST /restores/validate`,
`POST /restores`.
Rules: [DEPLOYMENT_AND_BACKUP](../architecture/DEPLOYMENT_AND_BACKUP.md) §2–§3.

## 19. Pusat pemberitahuan (`/lainnya/notifikasi`)

| Element | Behaviour |
|---|---|
| List | newest first, grouped by day; each row shows severity, message, time and a deep link |
| Actions | mark read, dismiss, "Tandai semua dibaca" |
| Bell | shell surface with the unread count and a text alternative |

**API**: `GET /notifications`, `PATCH /notifications/:id`, `POST /notifications/read-all`.
Records: [NOTIFICATION_SPECIFICATION](../backend/NOTIFICATION_SPECIFICATION.md).

---

## Not specified (no route or no contract)

| Screen | Why | Gap / decision |
|---|---|---|
| Riwayat sesi penuh dengan filter | `GET /sessions` provides the list; a dedicated history screen is not in the approved navigation | Progres + Beranda cover it; revisit if the list grows |
| Soal yang disukai / spaced repetition | out of MVP | MVP_SCOPE §2 |
| CSV/Excel import | out of MVP by decision | MVP_SCOPE §2 |
| Named/saved filters | out of MVP by decision | MVP_SCOPE §2 |
| Any non-CPNS pathway screen | product is CPNS-only | PRD §4 |
