# Frontend Information Architecture

Navigation and screen map for the single-user app. Routes are fixed here; page details are
[FRONTEND_PAGE_SPECIFICATIONS.md](./FRONTEND_PAGE_SPECIFICATIONS.md); routing mechanics are
[FRONTEND_ROUTING.md](./FRONTEND_ROUTING.md); unresolved contracts are
[FRONTEND_GAP_REGISTER.md](./FRONTEND_GAP_REGISTER.md).

---

## 1. Two areas, one application

| Area | Who it is for | Entry | Tone |
|---|---|---|---|
| **Belajar** (learning) | the CPNS candidate | main navigation | plain Indonesian, guided |
| **Kelola** (management) | the owner — the only user; *not* a separate role ([AUTHENTICATION](../backend/AUTHENTICATION.md), ADR-009) | main navigation → **Lainnya** | denser, but same language rules |

**There is no access control between the areas.** ADR-009 (no auth, single local user) means anyone at
the machine can review questions, approve configs, or edit providers. The management screens live in
this app and are reachable by anyone who opens it; the UI does not pretend otherwise
([FRONTEND_PRD](./FRONTEND_PRD.md) §5, GAP U-F10). Management items are **never** in the learning
section of the dock.

**Why the split exists.** The learner should never have to make a technical decision to study. A
first-time candidate picking a package must not be asked which exam config, which scoring version or
which package version to use. Those live in Kelola, where the owner manages them.

## 2. Primary navigation — bottom dock (five items)

| # | Item | Route | Purpose |
|---|---|---|---|
| 1 | **Beranda** | `/` | where I stand and what to do next |
| 2 | **Tryout** | `/tryout` | pick and sit an exam simulation |
| 3 | **Latihan** | `/latihan` | practice one submateri |
| 4 | **Progres** | `/progres` | trends, consistency, coverage over sessions |
| 5 | **Lainnya** | `/lainnya` | the **Kelola** area |

- On phone widths the dock is pinned to the bottom, five equal targets, ≥ 44 × 44 px.
- On desktop the same dock is **kept** as a centered bar (max ~560 px) above the content or flushed to
  the bottom of the viewport — it is never replaced by a sidebar ([DESIGN_SYSTEM](./DESIGN_SYSTEM.md) §7).
- Reading width: 640–720 px content column; the exam runner caps at 720 px on desktop
  ([DESIGN_SYSTEM](./DESIGN_SYSTEM.md) §6).
- The notification bell sits in the shell (top bar), not in the dock
  ([NOTIFICATION_SPECIFICATION](../backend/NOTIFICATION_SPECIFICATION.md) §7).

## 3. Screen map

```
/                              Beranda
/tryout                        Pilih Tryout (built-in + custom packages)
/tryout/:packageId             Detail paket + Petunjuk + mulai
/tryout/sesi/:id        Ujian berlangsung  (runner; mode tryout)
/tryout/sesi/:id/konfirmasi      Konfirmasi kirim
/tryout/sesi/:id/hasil           Hasil
/latihan                       Pilih submateri (stock per submateri; drill tertarget)
/latihan/sesi/:id                Latihan berlangsung (runner; mode latihan)
/latihan/sesi/:id/hasil          Ringkasan latihan
/progres                       Perkembangan (trend, consistency, coverage, response time)
/progres/kompetensi/:id        Detail submateri (drill-down)
/lainnya                       Daftar Kelola
/lainnya/soal                  Bank Soal
/lainnya/soal/:id              Detail soal (validasi, sampling, riwayat versi)
/lainnya/review                Review Soal (laporan + batch menunggu sampel)
/lainnya/materi                Materi
/lainnya/materi/:id            Detail materi + versi + sumber
/lainnya/generasi              Generasi AI
/lainnya/generasi/:jobId       Progres generasi (batch, status, retry)
/lainnya/ai                    Pengaturan AI (provider, default, override, kapabilitas)
/lainnya/ujian                 Konfigurasi Ujian
/lainnya/ujian/:id             Detail konfigurasi + persetujuan
/lainnya/paket                 Manajemen Paket
/lainnya/paket/:id             Detail paket + riwayat versi
/lainnya/notifikasi            Pusat pemberitahuan
```

**No `/tryout/:configId` route exists.** A tryout is chosen by package, never by config
([PACKAGE_SPECIFICATION](../product/PACKAGE_SPECIFICATION.md) §3).

Screens that **do not exist** because no route or contract supports them are listed with their GAP id
in [FRONTEND_PAGE_SPECIFICATIONS](./FRONTEND_PAGE_SPECIFICATIONS.md) §"Not specified".

## 4. "Lainnya" structure — the Kelola area

Seven items. The set is closed; adding one is an IA change recorded in
[../AUDIT.md](../AUDIT.md).

| # | Item | Route | Owns |
|---|---|---|---|
| 1 | **Bank Soal** | `/lainnya/soal` | Question list, filters, manual create, detail, versions, quarantine/archive |
| 2 | **Review Soal** | `/lainnya/review` | Reported questions and batches awaiting sampling; the user's final decisions |
| 3 | **Materi** | `/lainnya/materi` | Material records, versions, sources, approval |
| 4 | **Generasi AI** | `/lainnya/generasi` | Generation jobs, per-batch status, retry |
| 5 | **Pengaturan AI** | `/lainnya/ai` | Providers, presets, global default, per-feature overrides, capability flags |
| 6 | **Konfigurasi Ujian** | `/lainnya/ujian` | Config list, evidence basis, `Belum Terverifikasi` notice, threshold approval |
| 7 | **Manajemen Paket** | `/lainnya/paket` | Built-in package review, custom packages, version history |

Also in Kelola (not counted as one of the seven): **Pengaturan** — backup folder, retention, restore
wizard, data location ([DEPLOYMENT_AND_BACKUP](../architecture/DEPLOYMENT_AND_BACKUP.md) §2–§4).

An item with no supporting route is **omitted**, not rendered as a disabled stub — a disabled item
implies a working feature the user cannot reach ([USER_JOURNEYS](../product/USER_JOURNEYS.md) "must
not happen: silent empty result"). Every one of the seven has a defined contract
([API_ENDPOINTS](../backend/API_ENDPOINTS.md)).

## 5. Latihan subject names

| Test | Shown as | Sub-line |
|---|---|---|
| TWK | **Wawasan Kebangsaan** | soal tentang negara, ideologi, dan kebangsaan |
| TIU | **Kemampuan Berpikir** | soal logika, hitung, dan penalaran |
| TKP | **Situasi dan Perilaku Kerja** | pilih sikap yang paling mencerminkan diri kamu |

Deeper grouping uses the taxonomy's `label.id` ([COMPETENCY_TAXONOMY](../examination/COMPETENCY_TAXONOMY.md) §3–5),
matched by `parentId`. Taxonomy **ids are never shown** — only labels. **Leaves are the Latihan unit**
("submateri": Analogi, Silogisme, Deret Angka…)
([PACKAGE_SPECIFICATION](../product/PACKAGE_SPECIFICATION.md) §6). The tier badge for a node is not
rendered in the learner path (it is a data-quality label, not a study cue); it appears in the question
editor.

## 6. IA invariants

- **Renders only what the backend returns.** No screen derives a score, percentage or rank
  ([FRONTEND_DATA_CONTRACTS](./FRONTEND_DATA_CONTRACTS.md) §1, BR-X2).
- **The learner never chooses a config.** The server binds the newest usable CPNS config at session
  creation. No screen in Belajar lists, names or badges a config.
- **No config status on Beranda, and no config info on Progres.** Beranda shows the learner's next
  action; Progres shows analysis. A result that is not comparable across rule versions says so in its
  own text, without naming a config id.
- **`Belum Terverifikasi` appears where its meaning matters**: the result footnote when a threshold
  verdict is involved, and Kelola → Konfigurasi Ujian. It never appears as a start prerequisite.
- **The answer key and explanations are never shown before submit in a tryout.** Latihan shows feedback
  after each answer by design ([FRONTEND_EXAM_FLOW](./FRONTEND_EXAM_FLOW.md) §9).
- **Every question carries its provenance badge** ([QUESTION_SPECIFICATION](../examination/QUESTION_SPECIFICATION.md) §2.1).
- **Management is one tap in, and labelled** ("Kelola") so a beginner never lands there by accident.
