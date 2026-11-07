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
| Signed / posted | 29 Juli 2024 (signed Abdullah Azwar Anas) · JDIH status *Berlaku* |
| Source | https://jdih.menpan.go.id/dokumen-hukum/keputusan-menteri-pendayagunaan-aparatur-negara-dan-reformasi-birokrasi-nomor-321-tahun-2024-tentang-nilai-ambang-batas-seleksi-kompetensi-dasar-seleksi-penerimaan-pegawai-negeri-sipil-tahun-anggaran-2024 |
| Full text fetched | https://data-jdih.menpan.go.id/dokumen/2024kepmenpanrb321.pdf (**image scan**; text extracted by rendering pages and reading them; OCR text layer absent) |
| Fetch date | 2026-11-07 |

| Diktum | Rule | Tier |
|---|---|---|
| KELIMA | SKD duration **130 (seratus tiga puluh) minutes**. | `HISTORICAL` |
| KEENAM | **110** items: TWK **30**, TIU **35**, TKP **45**. | `HISTORICAL` |
| KETUJUH | TWK/TIU: correct **5**, wrong or blank **0**. TKP: each answer worth **1–5**, blank **0**. | `HISTORICAL` |
| KEDELAPAN | Maximum cumulative score **550**: TWK **150**, TIU **175**, TKP **225**. | `HISTORICAL` |
| KESEMBILAN | NAB = the minimum score every participant must meet. | `HISTORICAL` |
| KEDUA BELAS | NAB: **TWK 65**, **TIU 80**, **TKP 166** — for penetapan kebutuhan umum and penetapan kebutuhan khusus Putra/Putri Kalimantan. | `HISTORICAL` |
| KEEMPAT BELAS | NAB exempted for: cumlaude graduates, diaspora, penyandang disabilitas, Putra/Putri Papua, Putra/Putri Daerah Tertinggal. | `HISTORICAL` |
| KELIMA BELAS | Cumlaude + diaspora: cumulative SKD ≥ **311**, TIU ≥ **85**. | `HISTORICAL` |
| KEENAM BELAS | Disabilitas, Papua, Daerah Tertinggal: cumulative SKD ≥ **286**, TIU ≥ **60**. | `HISTORICAL` |

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
| KEDELAPAN | NAB: TWK **65**, TIU **80**, TKP **156**. |
| KESEMBILAN–KESEPULUH | Affirmation: cumulative SKD ≥ **281**, TIU ≥ **55**. |

**What this comparison does and does not license.**

- *Does* license: the TWK/TIU/TKP material framework (Diktum KEDUA) is the framework used in the 2026
  assessment year, and matches the CPNS 2024 framework. The sub-domains in
  [COMPETENCY_TAXONOMY.md](./COMPETENCY_TAXONOMY.md) therefore have a real regulatory footing — as the
  **2026 Sekolah Kedinasan** framework, which is `VERIFIED-2026` for that pathway.
- *Does not* license: treating 100 minutes, TKP NAB 156, or the affirmation numbers as CPNS 2026 rules.
  CPNS is a different pathway with its own Kepmen. Note the *observable variation* between the two
  obtained instruments (130 min vs 100 min; TKP NAB 166 vs 156) — evidence that duration and NAB do
  change between instruments, and that neither may be assumed for CPNS 2026.

**Product consequence.** The shipped default practice configuration uses the framework stable across
both instruments and is `provisional` because duration and NAB for CPNS 2026 are unknown (§4.4). The
2026 Sekolah Kedinasan instrument supplies **framework and corroboration only** — never a CPNS rule,
and never a claim of official status (§8 rule 5). Scoring carries this through as provisional. See
`skd-cpns-2026-provisional` in §4.4.

---

## 3. Historical record (never presented as current)

| Year | Rule | Tier | Evidence | Fetch date |
|---|---|---|---|---|
| 2021 | SKD = 110 soal in 100 minutes (title only; body not extractable) | `HISTORICAL` | https://www.bkn.go.id/peserta-calon-pns-2021-akan-berkompetisi-dalam-100-menit-untuk-menjawab-110-soal-skd-dengan-cat-bkn/ (30/07/2021) | 2026-11-07 |
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
  pathway: 'CPNS' | 'SEKOLAH_KEDINASAN';
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
};

type BasisRef = {
  document: string;           // e.g. "Keputusan Menteri PANRB"
  number: string;             // instrument ID, e.g. "321/2024"
  effectiveDate?: string;
  tier: EvidenceTier;         // VERIFIED-2026 | VERIFIED-2026-SEKOLAH-KEDINASAN | VERIFIED-CURRENT | HISTORICAL | UNVERIFIED
  pathway?: 'CPNS' | 'SEKOLAH_KEDINASAN';  // selection pathway the instrument governs
  examYear?: number;          // cycle the instrument applies to
  scope?: string;             // what the document actually covers, e.g. "SKD CPNS", "SKD sekolah kedinasan"
  sourceUrl?: string;
  fetchedAt?: string;
};

// A VERIFIED-2026 basis is authority for a config only when BOTH pathway and examYear match the
// config's own. A Sekolah Kedinasan instrument may appear in a CPNS config only as
// VERIFIED-2026-SEKOLAH-KEDINASAN (corroboration). SCORING_METHODOLOGY.md §6.7 (PF-12) enforces this.
```

### 4.2 States

| State | Meaning | May score practice sessions? |
|---|---|---|
| `official_verified` | Every rule field traces to a `VERIFIED-2026` CPNS basis. | Yes |
| `historical` | A real prior-cycle CPNS rule set. Immutable. | Yes — only for sessions belonging to its own `examYear` |
| `provisional` | User-approved derivation from `historical`/`VERIFIED-CURRENT` basis, with `UNVERIFIED` fields explicitly carried. | Yes — only with a valid approval record (§4.3) |

A `historical` config is never edited or promoted in place. Promotion creates a **new** `provisional`
config with `derivedFrom: <historical id>`.

### 4.3 Approval record

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

**Validity rule.** An approval is valid for a config only if all four of `configId`, `configVersion`,
`scoringVersion`, `regulatoryBasisHash` match the config at scoring time. Any edit that bumps
`configVersion`, any scoring change that bumps `scoringVersion`, or any change to the basis set (new
document, corrected effective date, tier promotion or demotion) invalidates the approval silently and
blocks scoring until the user re-approves. `approvedByUserAt` alone is never sufficient.

**Enforcement points.**

1. Approving in the UI shows the four values being approved.
2. Starting a scored session checks approval validity.
3. Submitting a scored session re-checks it (protects against an edit mid-session).
4. Any report rendering a provisional config shows its `notice` and the approval timestamp.

### 4.4 Shipped configurations at MVP

| id | year | pathway | state | basis | scoreable |
|---|---|---|---|---|---|
| `skd-cpns-2024` | 2024 | CPNS | `historical` | Kepmen PANRB 321/2024 (full text) | Replay only |
| `skd-cpns-2026-provisional` | 2026 | CPNS | `provisional` (unapproved) | Permen PANRB 6/2024 Pasal 30; Kepmen PANRB 321/2024 (2024 numbers); Kepmen PANRB 406/2026 (framework only); UNV-01…UNV-05 | No, until approved |
| `skd-sekolah-kedinasan-2026` | 2026 | SEKOLAH_KEDINASAN | `official_verified` | Kepmen PANRB 406/2026 (full text) | Not offered in MVP — different pathway |

No `official_verified` **CPNS** configuration exists, because no CPNS-2026 instrument was found.

**Default carried fields in `skd-cpns-2026-provisional`:** counts 30/35/45, weights 5/0 and 1–5, max
550 — carried from 321/2024 because they are identical in the 2026 instrument for the other pathway
and unchanged since at least 2021. **Duration** carried as 130 minutes with an explicit "2024 value,
not confirmed for CPNS 2026" warning. **NAB** carried as 65/80/**166** with an explicit "2024 value,
2026 Sekolah Kedinasan uses 156 — CPNS 2026 value unknown" warning. Both are named in
`acknowledgedWarnings` at approval.

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
| UNV-05 | Session duration | Carried 130 min (2024 value) | 2024 CPNS = 130; 2026 Sekolah Kedinasan = 100 — varies per instrument, so cannot be derived | Same as UNV-01 |
| UNV-06 | Whether a CPNS 2026 instrument has been issued but not yet published | Unknown | Absence of evidence, not evidence of absence | Check BKN/PANRB at each planning review |
| UNV-07 | Whether 2026 selection operates under Permen PANRB 6/2024 or a successor | Likely 6/2024; no successor located | Instrument still *Berlaku* on BPK | Monitor BPK status field |
| UNV-08 | Official competency sub-domains within TWK/TIU/TKP | **Resolved** — see note | Kepmen PANRB 406/2026 Diktum KEDUA states them verbatim | — |

**UNV-08 resolution note.** The sub-domain list is now sourced from a `VERIFIED-2026` document
(406/2026 Diktum KEDUA). It is `VERIFIED-2026` **for Sekolah Kedinasan**. Because the same framework
is used in CPNS 2024's practitioner material and the 2026 assessment year, the taxonomy ships as
`VERIFIED-2026-SEKOLAH-KEDINASAN` — a node tier that is explicitly pathway-tagged, so no document
claims it is a published *CPNS 2026* kisi-kisi. Promoting it to plain `VERIFIED-2026` requires a CPNS
instrument.

UNV-01…UNV-05 may not be filled by "reasonable assumption" without a `provisional` config and an
approval record.

---

## 8. Product rules derived from this record

1. Every question carries a competency ID from [COMPETENCY_TAXONOMY.md](./COMPETENCY_TAXONOMY.md), never a free-text subject.
2. No question, screen, or document labels content "Soal Resmi CPNS 2026".
3. Practice sessions must select an exam config and display its `notice` before starting.
4. Scoring with a config whose fields derive from `UNVERIFIED` basis is blocked until approved.
5. An instrument's pathway tag never silently transfers. Sekolah Kedinasan rules may inform the
   provisional config's basis list, but the UI must name the pathway whenever a rule came from it.
   Such a rule stays `VERIFIED-2026` *for its own pathway* and remains `UNVERIFIED` for CPNS — it never
   upgrades a CPNS field's evidence tier, and never lets scoring present itself as official.
6. When a CPNS-2026 instrument is obtained, the 2026 config is created as a **new**
   `official_verified` config; existing provisional configs and sessions are left intact.
