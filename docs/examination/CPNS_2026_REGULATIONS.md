# CPNS Examination Regulations — Evidence Record

> **Nothing in this document is a confirmed 2026 CPNS rule unless its tier is `VERIFIED-2026`.**
> Research cutoff: **2026-11-07**. Every row carries its own tier, source, fetch date, and scope.
> Status of the 2026 cycle in this record: **CPNS 2026 recruitment is officially announced; no
> CPNS-2026-specific SKD instrument has been issued.** See §1.

This file is the **canonical source** for exam rules, scoring, and thresholds. Other documents
reference this file and `SCORING_METHODOLOGY.md`; they do not restate its tables.

Related: [COMPETENCY_TAXONOMY.md](./COMPETENCY_TAXONOMY.md) · [SCORING_METHODOLOGY.md](./SCORING_METHODOLOGY.md) ·
[QUESTION_SPECIFICATION.md](./QUESTION_SPECIFICATION.md) · [DATA_FLOW.md](../architecture/DATA_FLOW.md)

---

## 0. Evidence tiers

A claim is `VERIFIED-2026` only when one fetched document establishes **all** of:

| # | Requirement |
|---|-------------|
| 1 | Document number and title |
| 2 | Publication date |
| 3 | Effective date |
| 4 | Issuing authority (BKN / KemenPANRB / President / etc.) |
| 5 | Scope = general CPNS recruitment (not Sekolah Kedinasan, not PPPK, not internal JF assessment) |
| 6 | Explicit applicability to the 2026 CPNS cycle, or an effective range demonstrably covering it |
| 7 | The claim appears in the document body (not a nav link, teaser, or search snippet) |

Failing any one item downgrades the claim:

- `VERIFIED-CURRENT` — meets 1–5 and 7, and its effective range covers 2026, but the instrument was
  issued for an earlier cycle (no 2026-specific CPNS instrument found). Usable as "rule currently in
  force", not as "2026 CPNS rule".
- `HISTORICAL` — a real instrument for a named prior cycle (e.g. CPNS 2024). Kept for replay; never
  presented as current.
- `VERIFIED-ABSENCE` — a documented search that found nothing. Proves we looked, not that the thing
  does not exist.
- `UNVERIFIED` — model knowledge, secondary reporting, or undated. Listed in §7.

**Not evidence:** a government domain alone, a page title, an announcement mentioning a regulation
number, or a search-result snippet.

**Scope note.** A regulation that applies to *Sekolah Kedinasan* does **not** establish a rule for
*CPNS recruitment*. The two are separate selection pathways with separate NAB instruments. A
Sekolah Kedinasan 2026 instrument is therefore evidence of the 2026 *framework*, not of 2026 *CPNS
thresholds*.

---

## 1. Status of the 2026 CPNS cycle

| Claim | Tier | Evidence | Fetch date |
|---|---|---|---|
| KemenPANRB announced CPNS recruitment will be carried out in 2026; priority formations named include Polisi Hutan, Manggala Agni, Guru Sekolah Terintegrasi, Guru Sekolah Unggul Garuda. | `VERIFIED-CURRENT` (announcement, not a rule) | Press Release No. **378/HUMAS-MENPANRB/2026**, 6 November 2026 · https://menpan.go.id/file-media/2026/11/07/final-press-release-penataan-dan-pengadaan-cpns.pdf | 2026-11-07 |
| No CPNS-2026-specific SKD instrument (Kepmen NAB) was located on BPK, BKN JDIH, or KemenPANRB JDIH. | `VERIFIED-ABSENCE` | Searches in §6 | 2026-11-07 |
| SSCASN *Dasar Hukum* page reads "Belum ada dasar hukum untuk seleksi ini." | `VERIFIED-CURRENT` | https://sscasn.bkn.go.id/dasar-hukum | 2026-11-07 |
| SSCASN's public landing surface is titled for **Seleksi Sekolah Kedinasan 2026**; no CPNS 2026 timeline is published there. | `VERIFIED-CURRENT` | https://sscasn.bkn.go.id/ | 2026-11-07 |
| BKN declared circulating "CPNS 2026" recruitment posters to be **hoaks**. | `VERIFIED-CURRENT` | BKN announcement dated 2026-06-04 | 2026-11-07 |
| BKN's announcement feed (through 2026-11-06) contains no CPNS 2026 SKD announcement. | `VERIFIED-CURRENT` | https://www.bkn.go.id/category/publikasi/pengumuman/ | 2026-11-07 |

**Consequence for the product:** the app may say "CPNS 2026 recruitment has been announced". It may
**not** say "these are the CPNS 2026 SKD rules". It prepares against the rule set currently in force
(§2) and must say so.

---

## 2. Rules currently in force (general CPNS)

### 2.1 Governing instrument

| Field | Value |
|---|---|
| Instrument | Peraturan Menteri PANRB Nomor 6 Tahun 2024 tentang Pengadaan Pegawai Aparatur Sipil Negara |
| Tier | `VERIFIED-CURRENT` (meets 1–5,7; effective 2024-07-23; no later amending instrument located) |
| Signed / promulgated / effective | Berita Negara 2024 No. 404; berlaku 23 Juli 2024 |
| Source | https://peraturan.bpk.go.id/Details/294203/permen-panrb-no-6-tahun-2024 |
| Full text fetched | https://peraturan.bpk.go.id/Download/353562/2024permenpanrb006.pdf (30 pp.) |
| Status on BPK | *Berlaku* |
| Repeals | Permen PANRB 27/2021 (PNS procurement), Permen PANRB 14/2023 (PPPK JF) |
| Fetch date | 2026-11-07 |

Verified claims from its body:

| Claim | Article | Tier |
|---|---|---|
| The instrument uses the term *Pegawai ASN*, replacing *PNS* terminology. | Pasal 1 | `VERIFIED-CURRENT` |
| SKD uses CAT BKN. | Pasal 30(1) | `VERIFIED-CURRENT` |
| SKD assesses alignment between applicant competencies and the PNS basic competency standard. | Pasal 30(2) | `VERIFIED-CURRENT` |
| SKD covers exactly three sub-tests: **Tes Wawasan Kebangsaan (TWK), Tes Intelegensia Umum (TIU), Tes Karakteristik Pribadi (TKP)**. | Pasal 30(3) a–c | `VERIFIED-CURRENT` |
| SKD results are published for at most 3× the job requirement, by highest rank among those meeting the Nilai Ambang Batas. | Pasal 31(5) | `VERIFIED-CURRENT` |
| Tie-break at the 3× boundary is by TKP, then TIU, then TWK; if still tied, the applicant proceeds to SKB. | Pasal 31(6)–(7) | `VERIFIED-CURRENT` |
| Kelulusan selection rules are set by a **Keputusan Menteri**. | Pasal 43(2) | `VERIFIED-CURRENT` |
| Nilai Ambang Batas is likewise set by a Keputusan Menteri. | Pasal 43(3) | `VERIFIED-CURRENT` |

**Not in this instrument:** per-subtest question counts, session duration, per-answer scoring values,
threshold numbers. Delegated to a Keputusan Menteri (§2.3).

### 2.2 CAT administration

| Field | Value |
|---|---|
| Instrument | Peraturan Badan Kepegawaian Negara Nomor 5 Tahun 2024 tentang Prosedur Penyelenggaraan Seleksi dengan Metode Computer Assisted Test BKN |
| Tier | `VERIFIED-CURRENT` |
| Signed / promulgated | 2024-08-12 / 2024-08-14 |
| Source | https://jdih.bkn.go.id/Detail_peraturan/breaking/2584 |
| Full text fetched | http://jdih.bkn.go.id/common/dokumen/2024peraturanlembagapemerintahnonkementerian5-2584.pdf (32 pp.) |
| Fetch date | 2026-11-07 |

| Claim | Tier |
|---|---|
| The regulation governs *procedure* (venue readiness, registration, participant conduct, invigilation, reporting) for CAT BKN. | `VERIFIED-CURRENT` |
| It contains **no** question counts, durations, or scoring weights for any subtest. | `VERIFIED-CURRENT` (searched: 0 hits for `TWK`, `TIU`, `TKP`, `110`, `bobot`) |
| Participants must arrive at least 60 minutes before the session; PPI registration closes 5 minutes before start. | `VERIFIED-CURRENT` |

### 2.3 Nilai Ambang Batas and SKD composition — by cycle

The NAB and the SKD composition (counts, duration, weights) are set per cycle by a Keputusan
Menteri. Two instruments have been obtained in full.

#### (a) CPNS 2024 — Kepmen PANRB 321/2024 · `HISTORICAL`

| Field | Value |
|---|---|
| Instrument | Keputusan Menteri PANRB Nomor **321 Tahun 2024** tentang Nilai Ambang Batas Seleksi Kompetensi Dasar Seleksi Penerimaan Pegawai Negeri Sipil Tahun Anggaran 2024 |
| Tier | `HISTORICAL` — scope = CPNS, but explicitly **TA 2024**, not 2026 |
| Signed / posted | 29 Juli 2024 (`tanggal_penetapan: 2024-07-29` in the JDIH API record) · JDIH status *Berlaku*. **FL-15 note:** `.research/kepmen321_2024.txt` is a 150-byte stub (8 nav URLs, no body) and contains no date; the "27 Juli 2026" in `.research/kepmen406_2026.txt` is the *406/2026* signing date, not 321's. Provenance for 321 comes from the JDIH metadata + the image-scan PDF, not from that stub. |
| Source | https://jdih.menpan.go.id/dokumen-hukum/keputusan-menteri-pendayagunaan-aparatur-negara-dan-reformasi-birokrasi-nomor-321-tahun-2024-tentang-nilai-ambang-batas-seleksi-kompetensi-dasar-seleksi-penerimaan-pegawai-negeri-sipil-tahun-anggaran-2024 |
| Full text fetched | https://data-jdih.menpan.go.id/dokumen/2024kepmenpanrb321.pdf (**image scan**; text extracted by rendering pages and reading them; OCR text layer absent) |
| Fetch date | 2026-11-07 |

| Diktum | Rule | Tier |
|---|---|---|
| KETIGA | SKD "dilaksanakan dalam durasi waktu **100 (seratus) menit**" — the **base** duration for an ordinary participant. | `HISTORICAL` |
| KEEMPAT | The duration in KETIGA is **excepted** for "pelamar penyandang disabilitas sensorik netra yang melamar pada kebutuhan khusus penyandang disabilitas." | `HISTORICAL` |
| KELIMA | SKD "bagi pelamar sebagaimana dimaksud pada Diktum **KEEMPAT**" runs **130 (seratus tiga puluh) minutes** — i.e. the *exemption* duration, not the instrument's duration. | `HISTORICAL` |
| KEENAM | **110** items: TWK **30**, TIU **35**, TKP **45**. | `HISTORICAL` |
| KETUJUH | TWK/TIU: correct **5**, wrong or blank **0**. TKP: each answer worth **1–5**, blank **0**. | `HISTORICAL` |
| KEDELAPAN | Maximum cumulative score **550**: TWK **150**, TIU **175**, TKP **225**. | `HISTORICAL` |
| KESEMBILAN | 2024-partner SKD values are valid until the next CPNS period's SKD values apply. | `HISTORICAL` |
| KESEPULUH | Prior-period values are void for a candidate who sits the following period's selection. | `HISTORICAL` |
| KESEBELAS | "Nilai ambang batas SKD adalah **nilai minimal yang harus dipenuhi** oleh setiap peserta seleksi" — the NAB *definition*. | `HISTORICAL` |
| KEDUA BELAS | NAB values: **TWK 65**, **TIU 80**, **TKP 166**. | `HISTORICAL` |
| KETIGA BELAS | KEDUA BELAS **applies to** "penetapan kebutuhan umum dan penetapan kebutuhan khusus putra/putri Kalimantan" — the scope of that clause, stated separately. | `HISTORICAL` |
| KEEMPAT BELAS | KEDUA BELAS is **excluded** for five categories of kebutuhan khusus: (a) Putra/Putri Lulusan Terbaik berpredikat "Dengan Pujian"/Cumlaude; (b) Diaspora; (c) Penyandang Disabilitas; (d) Putra/Putri Papua; (e) Putra/Putri Daerah Tertinggal. | `HISTORICAL` |
| KELIMA BELAS | For (a) cumlaude and (b) diaspora: cumulative SKD **≥ 311**; TIU **≥ 85**. | `HISTORICAL` |
| KEENAM BELAS | For (c) disabilitas, (d) Papua, (e) Daerah Tertinggal: cumulative SKD **≥ 286**; TIU **≥ 60**. | `HISTORICAL` |

**Reading the duration diktums together (REG-1).** The instrument's duration for the ordinary
candidate is **100 minutes** (KETIGA). **130** is the duration granted by KELIMA to the single group
carved out by KEEMPAT, and only that group. Any document, config or warning that writes "2024 SKD
duration = 130 minutes" without that scope is wrong. Which of the two applies to a CPNS-2026
*general-candidate* practice drill is **not established** — see UNV-09.

**Reading the NAB diktums together (REG-2).** The instrument does **not** publish one NAB. KEDUA
BELAS is scoped by KETIGA BELAS to the general track plus one special track; KEEMPAT BELAS removes
five categories from it; KELIMA BELAS and KEENAM BELAS then set their own cumulative + TIU minima.
A consumer must name the clause it applies. `KESEBELAS` — not `KESEMBILAN` — is the NAB definition.
**Re-derivation is honest about direction.** Of the two cumulative minima, one **got harder and one
got easier** than the general clause: KELIMA BELAS (cumlaude / diaspora) at 311 is *stricter* than
KEDUA BELAS's general clause, while KEENAM BELAS at 286 is *more lenient* than 65/80/166 would
suggest on its own. Direction is stated so nobody reads a cumulative threshold as a stricter gate
than it is. See [SCORING_METHODOLOGY.md](./SCORING_METHODOLOGY.md) §5.

#### (b) Sekolah Kedinasan 2026 — Kepmen PANRB 406/2026 · `VERIFIED-2026` **for Sekolah Kedinasan only**

| Field | Value |
|---|---|
| Instrument | Keputusan Menteri PANRB Nomor **406 Tahun 2026** tentang Nilai Ambang Batas Seleksi Kompetensi Dasar Seleksi Penerimaan Peserta Didik Sekolah Kedinasan Tahun Anggaran 2026 |
| Tier | `VERIFIED-2026` for **Sekolah Kedinasan**. **Not evidence for CPNS 2026 thresholds.** |
| Signed | 27 Juli 2026 (signed Rini Widyantini) · JDIH status *Berlaku* |
| Source | https://jdih.menpan.go.id/dokumen-hukum/keputusan-menteri-pendayagunaan-aparatur-negara-dan-reformasi-birokrasi-nomor-406-tahun-2026-tentang-nilai-ambang-batas-seleksi-kompetensi-dasar-seleksi-penerimaan-peserta-didik-sekolah-kedinasan-tahun-anggaran-2026 |
| Full text fetched | https://data-jdih.menpan.go.id/dokumen/2026kepmenpanrb406.pdf (text layer present) |
| Fetch date | 2026-11-07 |

| Diktum | Rule |
|---|---|
| KEDUA | SKD material framework — the five TWK / three TIU-domain / six TKP competencies. Canonical transcription in [COMPETENCY_TAXONOMY.md](./COMPETENCY_TAXONOMY.md) §3–5. |
| KETIGA | Duration **100 (seratus) minutes**. |
| KEEMPAT | **110** items: TWK 30, TIU 35, TKP 45. |
| KELIMA | TWK/TIU correct 5, wrong/blank 0. TKP lowest **1**, highest **5**, blank 0. |
| KEENAM | Maximum **550**: TWK 150, TIU 175, TKP 225. |
| KETUJUH | NAB is "nilai minimal yang harus dipenuhi oleh setiap peserta seleksi" — the NAB *definition*. |
| KEDELAPAN | NAB values: TWK **65**, TIU **80**, TKP **156**. |
| KESEMBILAN | KEDELAPAN is **excepted** for peserta from designated "daerah tertentu yang mendapat afirmasi", proposed by the administering K/L and approved by the Menteri. |
| KESEPULUH | For those afirmasi participants: cumulative SKD **≥ 281**; TIU **≥ 55**. |

The cumulative 281 sits below 65+80+156 = 301 for the same reason as in 321/2024: the cumulative
stop is taken independently of the sub-test stops, not summed from them. The doc's earlier
numbering ("KETUJUH" for the definition, "KESEMBILAN–KESEPULUH") was off by one against the
instrument; both are now recorded verbatim (REG-4).

**What this comparison does and does not license.**

- *Does* license: the TWK/TIU/TKP material framework (Diktum KEDUA) is the framework used in the 2026
  assessment year, and matches the CPNS 2024 framework. The sub-domains in
  [COMPETENCY_TAXONOMY.md](./COMPETENCY_TAXONOMY.md) therefore have a real regulatory footing — as the
  **2026 Sekolah Kedinasan** framework, which is `VERIFIED-2026` for that pathway.
- *Does not* license: treating 100 minutes, TKP NAB 156, or the affirmation numbers as CPNS 2026 rules.
  CPNS is a different pathway with its own Kepmen. Note the *observable variation* between the two
  obtained instruments (321/2024 base 100 min, exemption 130 min; 406/2026 100 min; TKP NAB 166 vs
  156) — evidence that duration and NAB do change between instruments, and that neither may be
  assumed for CPNS 2026.

**Product consequence.** The shipped default practice configuration uses the framework stable across
both instruments and is `provisional` because duration and NAB for CPNS 2026 are unknown (§4.4). The
2026 Sekolah Kedinasan instrument supplies **framework and corroboration only** — never a CPNS rule,
and never a claim of official status (§8 rule 5). Scoring carries this through as provisional. See
`skd-cpns-2026-provisional` in §4.4.

---

## 3. Historical record (never presented as current)

| Year | Rule | Tier | Evidence | Fetch date |
|---|---|---|---|---|
| 2021 | SKD = 110 soal in 100 minutes (title only; body not extractable — REG-5: the cached page supplies the title, not the operative text, so this row is **not used by any config**) | `HISTORICAL` | https://www.bkn.go.id/peserta-calon-pns-2021-akan-berkompetisi-dalam-100-menit-untuk-menjawab-110-soal-skd-dengan-cat-bkn/ (30/07/2021) | 2026-11-07 |
| 2024 | SKD components are TIU, TWK, TKP with passing grade and characteristics per material type | `HISTORICAL` | https://www.bkn.go.id/3-juta-pelamar-cpns-2024-berkompetisi-di-tahap-skd/ | 2026-11-07 |
| 2024 | SKD rules governed by Kepmen PANRB 321/2024 | `HISTORICAL` — **now obtained in full**, §2.3(a) | same as above | 2026-11-07 |
| 2024 | SKD uses Peraturan BKN 5/2024 | `HISTORICAL` (citation); the regulation itself is `VERIFIED-CURRENT` per §2.2 | same | 2026-11-07 |
| 2024 | PerBKN 5/2024 replaces PerBKN 2/2021 | `HISTORICAL` (BKN news) | https://www.bkn.go.id/skd-2024-akan-gunakan-ketentuan-terbaru-cat-bkn/ (29/08/2024) | 2026-11-07 |

Historical rules are stored as `historical` exam configurations, immutable, tagged with their cycle,
and usable only for replaying sessions recorded against that cycle.

---

## 4. Exam configuration model

Canonical definition. All other documents reference this section.

### 4.1 Configuration identity

```ts
type ExamConfig = {
  id: string;                 // stable identity, e.g. "skd-cpns-2024"
  examYear: number;           // cycle the rule set describes
  pathway: 'CPNS' | 'SEKOLAH_KEDINASAN';  // storage enum; only 'CPNS' is offered (§8 rule 7)
  state: 'official_verified' | 'historical' | 'provisional';
  configVersion: number;      // bumps on any content change
  scoringVersion: number;     // bumps on any scoring-rule change
  regulatoryBasis: BasisRef[];// ordered; hashed into regulatoryBasisHash
  structure: SubtestStructure[];
  scoring: ScoringRules;      // shape defined in SCORING_METHODOLOGY.md §5
  thresholds?: ThresholdSet;
  notice: string;             // human-readable limitation text, rendered in UI
  derivedFrom?: string;       // config id this was derived from
  effectiveFrom?: string;     // ISO date, only when a document establishes it
  dataProvenance: 'seed' | 'legacy';  // 'legacy' = shipped before the CPNS-only scope (§8 rule 8)
};

type BasisRef = {
  document: string;           // e.g. "Keputusan Menteri PANRB"
  number: string;             // instrument ID, e.g. "321/2024"
  effectiveDate?: string;
  tier: EvidenceTier;         // VERIFIED-2026 | VERIFIED-CURRENT | HISTORICAL | VERIFIED-ABSENCE | UNVERIFIED | EVIDENCE-BACKED-NOT-CPNS-2026
  pathway?: 'CPNS' | 'SEKOLAH_KEDINASAN';  // selection pathway the instrument governs
  examYear?: number;          // cycle the instrument applies to
  scope?: string;             // what the document actually covers, e.g. "SKD CPNS", "SKD sekolah kedinasan"
  sourceUrl?: string;
  fetchedAt?: string;
};

// A VERIFIED-2026 basis is authority for a config only when BOTH pathway and examYear match the
// config's own. A basis backed by an instrument from another recruitment pathway may appear in a CPNS
// config only as EVIDENCE-BACKED-NOT-CPNS-2026 (corroboration). SCORING_METHODOLOGY.md §6.7 (PF-12)
// enforces this.
```

### 4.2 States

| State | Meaning | Startable? | Threshold verdict? |
|---|---|---|---|
| `official_verified` | Every rule field traces to a `VERIFIED-2026` CPNS basis. | Yes | Yes |
| `historical` | A real prior-cycle CPNS rule set. Immutable. | Yes — replay of its own `examYear` only | Only for its own cycle's threshold clause |
| `provisional` | Derivation from `historical`/`VERIFIED-CURRENT` basis, with `UNVERIFIED` fields explicitly carried. | **Yes — always.** A tryout is never blocked for want of a verified instrument | **No** — a verdict requires a valid approval record (§4.3) |

A `historical` config is never edited or promoted in place. Promotion creates a **new** `provisional`
config with `derivedFrom: <historical id>`.

**Startable ≠ verdict-capable.** This is the operative distinction:

1. **A provisional config is startable without an approval.** The learner can sit a full tryout on it
   today; scoring runs on the config the session froze. The absence of a CPNS 2026 instrument must not
   make the product unusable ([PRD.md](../product/PRD.md) FR-E5).
2. **An approval gates the verdict, not the session.** "Lulus/tidak lulus terhadap NAB" is rendered only
   when a valid approval exists for the four bound values (§4.3). Without it the result shows the score
   and per-submateri analysis and states, in the result, that **no passing threshold is verified for
   CPNS 2026** — never "belum lulus" and never "lulus".
3. **Approval is still required to carry thresholds at all.** A `provisional` config with a
   `ThresholdSet` (needed to *compute* a verdict, `mode ≠ 'none'`) is approved through §4.3, exactly as
   before. A config with `mode: 'none'` needs no approval to be started, because it can emit no verdict.
4. **The user-visible state name is `Belum Terverifikasi`.** Everywhere the learner sees a state, a
   `provisional` config renders **Belum Terverifikasi** — never a green or "official" treatment, never a
   lock that blocks starting. The internal state string stays `provisional`
   ([DESIGN_SYSTEM.md](../frontend/DESIGN_SYSTEM.md) §5).
5. **The state information stays out of the learner path.** Where the state appears is owned by
   [FRONTEND_INFORMATION_ARCHITECTURE.md](../frontend/FRONTEND_INFORMATION_ARCHITECTURE.md): the learner
   never picks or inspects a config to start a session; the state is shown where a result's meaning
   depends on it (the result screen's footnote and **Kelola → Konfigurasi Ujian**).

**Temporary config, proposed values.** When no verified CPNS 2026 config exists, the system offers a
temporary (`provisional`) config built from documented prior references (321/2024 etc.). The proposal is
computed from cited values only; the user may adjust a value, and every adjusted value must carry the
`acknowledgedWarnings` id of the uncertainty it resolves. A value with **no documented basis can never be
entered** — there is no free-text rule field in the config editor
([VALIDATION.md](../backend/VALIDATION.md) §2).

**Snapshot.** A session copies the config identity and every rule it scored under into its snapshot,
including the state, the basis hash and the approval reference
([SCORING_METHODOLOGY.md](./SCORING_METHODOLOGY.md) §7). A later config version or a later approval never
changes a finished session's meaning.

### 4.2.1 Configuration resolution when no verified config exists

The learner **never selects a technical configuration** (Product Owner decision). Resolution is internal to
package management and session creation; it is not a step in the learner flow and not a screen.

**Resolution order when a session is created** (`POST /packages/:id/sessions`):

| Order | Candidate | Chosen when |
|---|---|---|
| 1 | A config the **package** names explicitly and that is still usable | the package was created with a pinned config (§ below) |
| 2 | The **latest usable CPNS config** for the package's `mode` — `official_verified`, else `provisional` | no pin, or the pin is no longer usable |
| 3 | **No usable config** → `409 CONFLICT reason:"no_usable_config"` | no CPNS config row is startable at all |

Rows with `dataProvenance: 'legacy'` (any non-CPNS pathway) are **never** candidates.

**A package may not require a verified configuration.** Any package — built-in or custom — is defined by
its subtest composition, roster rules and repeat policy. The config is resolved per session, not stored as
a requirement on the package. A package therefore cannot be "blocked until a verified config exists": it
starts on whatever the resolution order yields, and the result says what that was.

**How the state is communicated without a selection step:**

| Surface | What appears | What never appears |
|---|---|---|
| Package list / detail | package name, composition, item counts, availability, repeat warning | no config name, no config state, no picker |
| Runner header | timer, progress, mode | no config identity |
| Result screen | score, per-submateri analysis, and a plain-language footnote: the basis was **Belum Terverifikasi** and **no passing threshold is verified** for CPNS 2026 | no "lulus / tidak lulus" (the verdict is withheld, §4.3) |
| Kelola → Konfigurasi Ujian | full state, basis, values, approval | — |

Wording of the footnote is fixed by [DESIGN_SYSTEM.md](../frontend/DESIGN_SYSTEM.md) §5; the rule that the
learner never chooses a config is [FRONTEND_INFORMATION_ARCHITECTURE.md](../frontend/FRONTEND_INFORMATION_ARCHITECTURE.md)
§6.

**Custom packages** created from a template (`POST /packages`, `POST /packages/:id/versions`) record the
composition and version only. If the creator needs a specific rule set, they pin a config in **Kelola →
Manajemen Paket**; a pin is a management-side reference to `configId` + `configVersion`, stored on the
package version, and the learner still never sees or chooses it. When a pinned config stops being usable,
resolution falls through to step 2 and the package detail states why the pin no longer applies — it does
not fail silently.

**No fabricated parameters.** A `provisional` config carries only values derived from cited references, and
every `UNVERIFIED` field keeps its warning id. Nothing is filled in to make a package startable.

**Score always, verdict conditionally.** A session on a `provisional` config computes a full score from the
frozen snapshot. A threshold verdict is rendered only with a valid approval (§4.3, SCORING_METHODOLOGY §5.6).

### 4.3 Approval record — canonical

This is the **one** definition of a provisional approval. `SCORING_METHODOLOGY.md` §2.2 (`ScoreApprovalRef`),
§7 (`SessionSnapshot.provisionalApproval`) and §11 (PF-13), `VALIDATION.md` §2, `BUSINESS_RULES.md`
BR-E3, `DATABASE_SCHEMA.md` `provisional_approval`, ADR-004 and `AGENTS.md` non-negotiable 3 all use
this shape; none of them restates or varies it.

Provisional approval is bound to the exact configuration the user reviewed:

```ts
type ProvisionalApproval = {
  configId: string;
  configVersion: number;
  scoringVersion: number;
  regulatoryBasisHash: string; // sha256 over ordered BasisRef[] (document|number|effectiveDate|tier)
  approvedByUserAt: string;    // ISO timestamp
  approvedBy: string;          // local user identity string
  acknowledgedWarnings: string[]; // ids of warning texts shown in the dialog
};
```

**What each field means — and which two bind.**

| Field | Meaning | Binds? |
|---|---|---|
| `configId` | Which configuration record was approved. Two provisional configs can share a version number; without this the approval is ambiguous. | **Yes** |
| `configVersion` | The content version of the rules the user read. Bumps on any value change. | **Yes** |
| `scoringVersion` | The scoring-rule version. Bumps on any rule change. | **Yes** |
| `regulatoryBasisHash` | Opaque sha256 over the ordered `BasisRef[]`. Binds the *evidence*, so a tier change or a corrected effective date invalidates without any value changing. | **Yes** |
| `approvedByUserAt` | When the approval was granted (ISO-8601 UTC). A timestamp, never an identity of *which* config was approved. | No — evidence |
| `approvedBy` | Who approved (the single local user's identity string). Recorded for the audit trail, not compared. | No — evidence |
| `acknowledgedWarnings` | Ids of the `UNV-*` warnings rendered in the dialog and ticked. Kept verbatim so a later reader sees exactly what was waved through. | No — evidence |

The four bolded fields are **the approval-bound values**. `approvedByUserAt` and `approvedBy` are
provenance, not identity: a fresh approval for the same four values remains valid, and a matching
timestamp for a different `configId` is invalid.

**Who or what authorizes.** The single local user. There is no second approver, no policy engine and
no automatic approval: `POST /exam-configs/:id/approval` records the user's explicit act
([API_ENDPOINTS.md](../backend/API_ENDPOINTS.md) §2). The server computes the four bound values from
the config as it stands at that instant and refuses the approval if the submitted
`acknowledgedWarnings` omit any outstanding warning — so an approval can never describe a rule set
that was not read.

**Timestamp semantics.** `approvedByUserAt` is server clock, UTC, millisecond precision
(`2026-11-07T14:30:00.000Z`), recorded at the moment the approval row is written. It is evidence of
*when*, never an input to validity, scoring, determinism or ordering of two approvals for the same
version (the later row simply replaces the earlier one — see persistence below).

**Invalidation.** An approval is valid for a config only if all four bound values match the config at
the moment of scoring. Any edit that bumps `configVersion`, any scoring change that bumps
`scoringVersion`, or any change to the basis set (new document, corrected effective date, tier
promotion or demotion) invalidates it **silently** — there is no background job and no flag to
clear; validity is recomputed, never stored. The effect of a lapsed approval is the loss of the
**threshold verdict**, never the loss of the ability to sit a session (§4.2).

**Re-approval.** Re-approval is a new row for the (possibly new) four values; it does not edit the
old one. A session already frozen against the old values stays bound to the old values and is
**permanently unscored** under the new ones (§11 of the scoring doc) — the app never silently
re-scores an old session under rules the user approved later.

**Persistence and verification.** The approval is persisted as an append-only event row
(`DATABASE_SCHEMA.md` `provisional_approval`, keyed by `(configId, configVersion)`, newest wins for
"current"), **and** copied verbatim into `SessionSnapshot.provisionalApproval` at session start. A
score result carries `ScoreApprovalRef` — the same object — so any past result can be verified
against its own record without reading the current config, the current approval, or any hash
content (hashes are compared opaque and never rendered). Verification therefore reduces to: re-hash
the frozen `BasisRef[]`, compare the four values in the snapshot, compare the snapshot against the
result.

**Enforcement points.**

1. Approving in the UI shows the four bound values being approved.
2. Starting a session records the config version; it does **not** require a valid approval (§4.2).
3. Submitting a scored session re-checks approval **for the verdict only** (protects against an edit
   mid-session). A lapsed approval yields a score without a threshold verdict, never an unscored
   session.
4. Any report rendering a provisional config shows its `notice` and, when approved, the approval
   timestamp.

### 4.4 Shipped configurations at MVP

| id | year | pathway | state | basis (`regulatoryBasis`) | offered |
|---|---|---|---|---|---|
| `skd-cpns-2024` | 2024 | CPNS | `historical` | Kepmen PANRB 321/2024 (full text) | Yes — replay of 2024 rules |
| `skd-cpns-2026-provisional` | 2026 | CPNS | `provisional` (**Belum Terverifikasi**) | Permen PANRB 6/2024 Pasal 30; Kepmen PANRB 321/2024 (2024 numbers) | Yes — sessions run; no threshold verdict unless approved |
| `skd-sekolah-kedinasan-2026` | 2026 | SEKOLAH_KEDINASAN | `official_verified` | Kepmen PANRB 406/2026 (full text) | **No — `dataProvenance: 'legacy'`.** Retained as an evidence and replay record only (§8 rule 8) |

`regulatoryBasis` lists **documents only**. `UNV-*` entries are unresolved *questions*, not
instruments, and can never appear in a `BasisRef[]` or in the hash it produces (REG-3). The
uncertainties they record shape the `notice` and `acknowledgedWarnings`, which are separate fields.

**406/2026 is not in the CPNS config's basis (REG-3).** A `BasisRef` is a citation, and
[AGENTS.md](../../AGENTS.md) non-negotiable 2 forbids citing a Sekolah Kedinasan instrument as CPNS
authority. 406/2026 therefore appears on exactly one row — `skd-sekolah-kedinasan-2026`, where it is
authority. What the CPNS config carries that happens to *match* 406/2026 (counts, weights, maximum)
is carried **from 321/2024 alone**, which states all of them; the match is a corroboration note in
this document, not a basis entry.

No `official_verified` **CPNS** configuration exists, because no CPNS-2026 instrument was found.

**Default carried fields in `skd-cpns-2026-provisional`:** counts 30/35/45, weights 5/0 and 1–5, max
550 — carried from 321/2024 (KEENAM, KETUJUH, KEDELAPAN), unchanged since at least 2021.**Duration** in the shipped default is **not asserted**: no `durationMinutes` is carried and the
config's timing rule is "user-chosen length, no exam-length claim". 321/2024 gives two durations
(base 100 under KETIGA, exemption 130 under KELIMA for the KEEMPAT group) and neither is established
for a 2026 general candidate (UNV-09). A provisional config *may* carry 100 (base) or 130 (exemption) as `durationMinutes`
with the matching `acknowledgedWarnings` id, but the shipped default does not.
**Thresholds** in the shipped default are **not asserted**: no `ThresholdSet` is carried
(`mode: 'none'`). The reason is in [SCORING_METHODOLOGY.md](./SCORING_METHODOLOGY.md) §5.5 — the
instrument publishes different thresholds per `formasi` track and the app has no track. A
provisional config *may* carry TWK 65 / TIU 80 / TKP 166 (+ `total: 311` for the cumulative stop)
named KEDUA BELAS / KETIGA BELAS in `source.scope`, at which point the approval warning must say:
"2024 general-track values; 2026 Sekolah Kedinasan uses 156 / 281 — CPNS 2026 unknown."

---

## 5. Determinism and provenance requirements

- Scoring is a pure function of (answers, answer key, scoring version) — see `SCORING_METHODOLOGY.md`.
- Exam-config edits never mutate records already written: sessions store their own `configId`,
  `configVersion`, `scoringVersion`.
- A user approving a provisional config is recorded as an event, not as a mutable flag.

---

## 6. Research log (2026-11-07)

Fetched, disposably, into `D:\tryoutsim\.research\` (git-ignored):

| Source | Result |
|---|---|
| https://www.bkn.go.id/ | Reachable; announcement list; no CPNS 2026 SKD item |
| https://www.bkn.go.id/category/publikasi/pengumuman/ | Pages 1–22; latest 2026-11-06; no CPNS 2026 SKD |
| https://sscasn.bkn.go.id/ | "Seleksi Sekolah Kedinasan 2026"; CPNS data absent |
| https://sscasn.bkn.go.id/dasar-hukum | "Belum ada dasar hukum untuk seleksi ini." |
| https://sscasn.bkn.go.id/faq, /buku-petunjuk | Client-rendered ("Memuat Data…"); no content without JS |
| https://www.menpan.go.id/ | 6.6 KB redirect stub; press release PDFs linked separately |
| https://menpan.go.id/file-media/.../final-press-release-penataan-dan-pengadaan-cpns.pdf | **Press Release 378/HUMAS-MENPANRB/2026** — CPNS 2026 recruitment announced |
| https://jdih.menpan.go.id/ | JS SPA; documents reachable by slug pattern `/dokumen-hukum/keputusan-menteri-...-nomor-{N}-tahun-{Y}-tentang-{id}`; keyword search unreliable |
| https://data-jdih.menpan.go.id/dokumen/{year}kepmenpanrb{N}.pdf | Direct PDF download; **worked** for 321/2024 and 406/2026 |
| https://peraturan.bpk.go.id/Search | Full-text search; used for Permen PANRB 6/2024 |
| https://jdih.bkn.go.id/ | Live; 1,841 documents; year filter and PDF full text |
| https://www.bkn.go.id/wp-json/wp/v2/search | Search API; used for 2021/2024 CPNS articles |

Queries that returned nothing relevant: `CPNS 2026`, `SKD 2025`, `seleksi CASN 2025`,
`nilai ambang batas`, `Kepmen 173/2023`, `Kepmen 168/2024`. Searches were executed once each; no
retry loops were run.

**Extraction note.** 321/2024 is a pure image scan (no text layer, 17 chars per page). Pages were
extracted as JPEG with `pypdf` and read visually. Claims from that instrument in §2.3(a) were read
from the rendered page, not inferred.

---

## 7. Uncertainty register

| ID | Item | Current state | Why unresolved | Verification step |
|---|---|---|---|---|
| UNV-01 | CPNS 2026 NAB (TWK/TIU/TKP) | Unknown. 2024 = 65/80/166; 2026 Sekolah Kedinasan = 65/80/156 | No CPNS-2026 Kepmen exists as of cutoff | Re-check KemenPANRB JDIH when SSCASN CPNS 2026 registration opens |
| UNV-02 | TWK/TIU per-answer value | Carried 5 / 0 | Identical in 2024 CPNS and 2026 Sekolah Kedinasan | Same as UNV-01 |
| UNV-03 | TKP per-option weights | **Unknown for CPNS 2026.** Carried 1–5, blank 0, as a provisional value | 2024 CPNS instrument states 1–5; the 2026 Sekolah Kedinasan instrument also states 1–5, but that is a different pathway and is *corroboration, not authority* | Same as UNV-01 |
| UNV-04 | Per-subtest counts (30/35/45, total 110) | Carried | Identical in both obtained instruments and in 2021 | Same as UNV-01 |
| UNV-05 | Session duration for a CPNS 2026 **general** candidate | **Not carried.** 321/2024: base 100 (KETIGA), exemption 130 (KELIMA, for the KEEMPAT group only) | No instrument establishes either value for 2026 CPNS | Re-check KemenPANRB JDIH when the CPNS-2026 instrument is issued |
| UNV-06 | Whether a CPNS 2026 instrument has been issued but not yet published | Unknown | Absence of evidence, not evidence of absence | Check BKN/PANRB at each planning review |
| UNV-07 | Whether 2026 selection operates under Permen PANRB 6/2024 or a successor | Likely 6/2024; no successor located | Instrument still *Berlaku* on BPK | Monitor BPK status field |
| UNV-08 | Official competency sub-domains within TWK/TIU/TKP | **Resolved** — see note | Kepmen PANRB 406/2026 Diktum KEDUA states them verbatim | — |
| UNV-09 | Which duration a CPNS 2026 general-candidate drill runs (100 base or 130 exemption) | **Unknown**; no value shipped | 321/2024's two durations are both 2024-scoped and pathway-adjacent, not 2026 CPNS | Same as UNV-05 |
| UNV-10 | Which NAB clause a CPNS practice drill is scored against (general / cumlaude / diaspora / disabilitas / Papua / Daerah Tertinggal) | **Unknown — owner decision**, not derivable | The app has no `formasi`; 321/2024 scopes KEDUA BELAS (KETIGA BELAS) and re-thresholds five categories (KEEMPAT–KEENAM BELAS) | Needs an owner product decision: see `docs/audit/AUDIT_FINDINGS_RESOLUTION.md` |
| UNV-11 | Which main competence a CPNS 2026 SKD instrument names (the taxonomy's training level is `VERIFIED-2026` for Sekolah Kedinasan only) | Unknown; taxonomy carries it as `VERIFIED-CURRENT` at CPNS level | Carries AUD-53 | See [docs/AUDIT.md](../AUDIT.md) AUD-53 (accepted-risk until a CPNS instrument appears) |

**UNV-08 resolution note.** The sub-domain list is read verbatim from a fetched 2026 document. That
document's scope is **not** CPNS 2026, so the taxonomy ships the names under the node tier
`EVIDENCE-BACKED-NOT-CPNS-2026` ([COMPETENCY_TAXONOMY.md](./COMPETENCY_TAXONOMY.md) §1) — explicitly not
a published *CPNS 2026* kisi-kisi. That tier is a product-data label; the evidence tier of the *document*
stays what §2.3 records. Promoting any node to `CPNS-2026-VERIFIED` requires a CPNS instrument. Nothing
here puts another pathway in product scope (UNV-11, §8 rule 7).

UNV-01…UNV-05, UNV-09 and UNV-10 may not be filled by "reasonable assumption" without a `provisional`
config and an approval record.

---

## 8. Product rules derived from this record

1. Every question carries a competency ID from [COMPETENCY_TAXONOMY.md](./COMPETENCY_TAXONOMY.md), never a free-text subject.
2. No question, screen, or document labels content "Soal Resmi CPNS 2026".
3. A session binds a config server-side at creation and freezes it; the learner is never asked to choose
   a config, and no config state is shown as a prerequisite to starting
   ([PACKAGE_SPECIFICATION.md](../product/PACKAGE_SPECIFICATION.md) §3).
4. Scoring runs on the config the session froze. A threshold **verdict** additionally requires a valid
   approval (§4.3); without one the result states that no passing threshold is verified for CPNS 2026.
5. An instrument's pathway tag never silently transfers. Sekolah Kedinasan rules may inform the
   provisional config's basis list, but the UI must name the pathway whenever a rule came from it.
   Such a rule stays `VERIFIED-2026` *for its own pathway* and remains `UNVERIFIED` for CPNS — it never
   upgrades a CPNS field's evidence tier, and never lets scoring present itself as official.
6. When a CPNS-2026 instrument is obtained, the 2026 config is created as a **new**
   `official_verified` config version; existing provisional configs and sessions are left intact.
7. **The product offers the CPNS pathway only.** No screen, package, selector, report or prompt lists
   another pathway. The Sekolah Kedinasan config exists in storage for evidence and replay, is never
   returned by a selectable-config route, and never appears in the learner area.
8. **Nothing historical is deleted.** The legacy config keeps its id, its basis and its rows
   (`dataProvenance: 'legacy'`); any session recorded against it keeps scoring from its own snapshot.
   Migrations are additive ([MIGRATION_STRATEGY.md](../backend/MIGRATION_STRATEGY.md) §2).
