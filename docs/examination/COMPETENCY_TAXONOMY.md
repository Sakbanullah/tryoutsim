# Competency Taxonomy

Canonical source of **competency identifiers**. Every question, result, recommendation and learning
material references nodes defined here. No other document redefines these IDs.

Related: [CPNS_2026_REGULATIONS.md](./CPNS_2026_REGULATIONS.md) §2.3 · [SCORING_METHODOLOGY.md](./SCORING_METHODOLOGY.md) ·
[QUESTION_SPECIFICATION.md](./QUESTION_SPECIFICATION.md) · [RECOMMENDATION_ENGINE.md](../ai/RECOMMENDATION_ENGINE.md)

---

## 1. Evidence basis

| Level | Source | Tier |
|---|---|---|
| SKD = TWK + TIU + TKP | Permen PANRB 6/2024 Pasal 30(3) | `VERIFIED-CURRENT` |
| **Domain and sub-domain names below** | Names read verbatim in a fetched 2026 assessment-year document, plus prior CPNS-cycle SKD practice; full record in [CPNS_2026_REGULATIONS.md](./CPNS_2026_REGULATIONS.md) §2.3 | `EVIDENCE-BACKED-NOT-CPNS-2026` |
| The same framework for CPNS specifically | No CPNS-2026 kisi-kisi obtained | not claimed |

`EVIDENCE-BACKED-NOT-CPNS-2026` means: **the names below are the working structure of this product; they
are not a published CPNS 2026 kisi-kisi.** The evidence record that produced the names is kept in
[CPNS_2026_REGULATIONS.md](./CPNS_2026_REGULATIONS.md) §2.3 and §8 (UNV-08, BR-E1). That record is an
evidence register, **not** product scope: the product is CPNS-only ([PRD.md](../product/PRD.md) §4), and
no other pathway appears in any screen, package, config list or report.

> **Renamed 2026-11-08.** The former tier name `EVIDENCE-BACKED-NOT-CPNS-2026` is retired: a node tier
> must not be readable as a verification claim for another pathway. Node IDs and node data are
> unchanged, so historical records keep resolving. Recorded in
> [../audit/SYSTEM_REVISION_REPORT.md](../audit/SYSTEM_REVISION_REPORT.md) §A3.

Consequence: the taxonomy **ships as data with a tier per node**, so when a CPNS-2026 instrument
publishes its own kisi-kisi, the editor changes node data only — schema, analytics and prompts are
unaffected.

---

## 2. Identifier format

```
<TEST>.<DOMAIN>.<SUBDOMAIN>          // nested
<TEST>.<DOMAIN>                       // domain-level roll-up key
```

- `TEST` ∈ `TWK` | `TIU` | `TKP`
- Segments are `SCREAMING_SNAKE_CASE`, stable, never reused, never renamed. Display labels live in
  `label.id` / `label.en`, so a label change never breaks history.
- Every node carries `tier`, `deprecated`, and optional `replacedBy`.

```ts
type CompetencyNode = {
  id: string;              // "TIU.NUMERIK.DERET"
  test: 'TWK' | 'TIU' | 'TKP';
  parentId: string | null;
  label: { id: string; en?: string };
  officialGoal?: string;   // the regulation's stated purpose, transcribed (§6)
  tier: 'EVIDENCE-BACKED-NOT-CPNS-2026' | 'UNVERIFIED' | 'DEPRECATED';
  // 'CPNS-2026-VERIFIED' is reserved for a node backed by a fetched CPNS 2026 kisi-kisi. No node ships with it.
  deprecated?: boolean;
  replacedBy?: string;
};
```

---

## 3. TWK — Tes Wawasan Kebangsaan

**Five domains, no sub-domains.**

| id | label (id) | tier |
|---|---|---|
| `TWK.NASIONALISME` | Nasionalisme | `EVIDENCE-BACKED-NOT-CPNS-2026` |
| `TWK.INTEGRITAS` | Integritas | `EVIDENCE-BACKED-NOT-CPNS-2026` |
| `TWK.BELA_NEGARA` | Bela negara | `EVIDENCE-BACKED-NOT-CPNS-2026` |
| `TWK.PILAR_NEGARA` | Pilar negara | `EVIDENCE-BACKED-NOT-CPNS-2026` |
| `TWK.BAHASA_NEGARA` | Bahasa negara | `EVIDENCE-BACKED-NOT-CPNS-2026` |

> **Correction recorded.** An earlier draft of this file listed `TWK.PANCASILA`, `TWK.UUD45`,
> `TWK.BHINEKA`, `TWK.NKRI`. Pancasila, UUD 1945, NKRI and Bhinneka Tunggal Ika are **contents of
> `TWK.PILAR_NEGARA`**, not separate domains. Those IDs are not in the taxonomy and must not appear
> in any data, prompt, or UI. Audit finding AUD-01.

---

## 4. TIU — Tes Intelegensia Umum

| id | label (id) | tier |
|---|---|---|
| `TIU.VERBAL.ANALOGI` | Analogi | `EVIDENCE-BACKED-NOT-CPNS-2026` |
| `TIU.VERBAL.SILOGISME` | Silogisme | `EVIDENCE-BACKED-NOT-CPNS-2026` |
| `TIU.VERBAL.ANALITIS` | Analitis | `EVIDENCE-BACKED-NOT-CPNS-2026` |
| `TIU.NUMERIK.BERHITUNG` | Berhitung | `EVIDENCE-BACKED-NOT-CPNS-2026` |
| `TIU.NUMERIK.DERET` | Deret angka | `EVIDENCE-BACKED-NOT-CPNS-2026` |
| `TIU.NUMERIK.PERBANDINGAN_KUANTITATIF` | Perbandingan kuantitatif | `EVIDENCE-BACKED-NOT-CPNS-2026` |
| `TIU.NUMERIK.SOAL_CERITA` | Soal cerita | `EVIDENCE-BACKED-NOT-CPNS-2026` |
| `TIU.FIGURAL.ANALOGI` | Figural — analogi | `EVIDENCE-BACKED-NOT-CPNS-2026` |
| `TIU.FIGURAL.KETIDAKSAMAAN` | Figural — ketidaksamaan | `EVIDENCE-BACKED-NOT-CPNS-2026` |
| `TIU.FIGURAL.SERIAL` | Figural — serial | `EVIDENCE-BACKED-NOT-CPNS-2026` |

Domain roll-ups: `TIU.VERBAL`, `TIU.NUMERIK`, `TIU.FIGURAL`.

---

## 5. TKP — Tes Karakteristik Pribadi

**Six domains, no sub-domains.**

| id | label (id) | tier |
|---|---|---|
| `TKP.PELAYANAN_PUBLIK` | Pelayanan publik | `EVIDENCE-BACKED-NOT-CPNS-2026` |
| `TKP.JEJARING_KERJA` | Jejaring kerja | `EVIDENCE-BACKED-NOT-CPNS-2026` |
| `TKP.SOSIAL_BUDAYA` | Sosial budaya | `EVIDENCE-BACKED-NOT-CPNS-2026` |
| `TKP.TIK` | Teknologi informasi dan komunikasi | `EVIDENCE-BACKED-NOT-CPNS-2026` |
| `TKP.PROFESIONALISME` | Profesionalisme | `EVIDENCE-BACKED-NOT-CPNS-2026` |
| `TKP.ANTI_RADIKALISME` | Anti radikalisme | `EVIDENCE-BACKED-NOT-CPNS-2026` |

TKP questions are scenario-based with weighted options — see
[SCORING_METHODOLOGY.md](./SCORING_METHODOLOGY.md) §3.2.

---

## 6. Goal statements (for prompt grounding)

Used verbatim in generation prompts so a question targets a stated competency goal, not a model's guess
at what "integritas" means. **These goals are working product data, not published CPNS 2026 text** (§1).
Prompts must never present them as official wording
([PROMPT_SPECIFICATION.md](../ai/PROMPT_SPECIFICATION.md) §1 rule 2).

| Node | Goal |
|---|---|
| `TWK.NASIONALISME` | Mampu mewujudkan kepentingan nasional melalui cita-cita dan tujuan yang sama dengan tetap mempertahankan identitas nasional |
| `TWK.INTEGRITAS` | Mampu menjunjung tinggi kejujuran, ketangguhan, komitmen dan konsistensi sebagai satu kesatuan sikap untuk mencapai tujuan nasional |
| `TWK.BELA_NEGARA` | Mampu berperan aktif dalam mempertahankan eksistensi bangsa dan negara |
| `TWK.PILAR_NEGARA` | Mampu membentuk karakter positif melalui pemahaman dan pengamalan nilai-nilai dalam Pancasila, UUD 1945, NKRI dan Bhinneka Tunggal Ika |
| `TWK.BAHASA_NEGARA` | Mampu menggunakan bahasa Indonesia sebagai bahasa persatuan yang sangat penting kedudukannya dalam kehidupan bermasyarakat, berbangsa, dan bernegara |
| `TIU.VERBAL.ANALOGI` | Bernalar melalui perbandingan dua konsep kata yang memiliki hubungan tertentu, lalu menggunakan konsep hubungan tersebut pada situasi lain |
| `TIU.VERBAL.SILOGISME` | Menarik kesimpulan dari dua pernyataan yang diberikan |
| `TIU.VERBAL.ANALITIS` | Menganalisis informasi yang diberikan dan menarik kesimpulan |
| `TIU.NUMERIK.BERHITUNG` | Kemampuan hitung sederhana |
| `TIU.NUMERIK.DERET` | Melihat pola hubungan angka |
| `TIU.NUMERIK.PERBANDINGAN_KUANTITATIF` | Menarik kesimpulan berdasarkan dua data kuantitatif |
| `TIU.NUMERIK.SOAL_CERITA` | Analisis kuantitatif dari informasi yang diberikan |
| `TIU.FIGURAL.ANALOGI` | Bernalar melalui perbandingan dua gambar yang memiliki hubungan tertentu, lalu menggunakan konsep hubungan tersebut pada situasi lain |
| `TIU.FIGURAL.KETIDAKSAMAAN` | Melihat perbedaan beberapa gambar |
| `TIU.FIGURAL.SERIAL` | Melihat pola hubungan dalam bentuk gambar |
| `TKP.PELAYANAN_PUBLIK` | Menampilkan perilaku keramahtamahan dalam bekerja yang efektif agar bisa memenuhi kebutuhan dan kepuasan orang lain sesuai dengan tugas dan wewenang yang dimiliki |
| `TKP.JEJARING_KERJA` | Membangun dan membina hubungan, bekerja sama, berbagi informasi dan berkolaborasi dengan orang lain secara efektif |
| `TKP.SOSIAL_BUDAYA` | Beradaptasi dan bekerja secara efektif dalam masyarakat majemuk |
| `TKP.TIK` | Memanfaatkan teknologi informasi secara efektif untuk meningkatkan kinerja |
| `TKP.PROFESIONALISME` | Melaksanakan tugas dan fungsi sesuai dengan tuntutan jabatan |
| `TKP.ANTI_RADIKALISME` | Menjaring informasi dari individu tentang pengetahuan terhadap anti radikalisme, kecenderungan bersikap, dan bertindak saat menanggapi stimulus dengan beberapa alternatif situasi |

---

## 7. Usage rules

1. Every question has exactly one **leaf** competency ID. Domain IDs are roll-up keys only.
2. Analytics aggregates at any level by prefix match (`TIU.NUMERIK.*`). Storing only the leaf makes
   every level derivable.
3. A deprecated node keeps its ID on historical records; new questions cannot select it.
4. Figural questions reference an image asset. The asset is part of question provenance, not of the
   taxonomy.
5. Recommendation learning-material mapping keys on the same IDs.
6. A new taxonomy release (e.g. on a CPNS-2026 kisi-kisi) keeps old IDs, sets `replacedBy` where the
   mapping is known, and bumps `tier` on surviving nodes.
7. Shipping a node with tier `UNVERIFIED` requires the node to be visibly marked in the question
   editor; none ship at MVP.
8. **Leaf nodes are the Latihan unit.** The Latihan picker lists leaf nodes (submateri) with their
   `label.id`; a package targets one or more leaves
   ([PACKAGE_SPECIFICATION.md](../product/PACKAGE_SPECIFICATION.md) §6).
9. **Materials map to nodes or to nothing.** A competency- or domain-scoped material binds to a node here;
   a free note binds to no node and never affects competency analytics
   ([MATERIAL_SPECIFICATION.md](./MATERIAL_SPECIFICATION.md) §2).

---

## 8. Seed data location

Ships as a typed constant in `frontend/src/mocks/taxonomy.ts` (mock layer) and as a seed table in the
backend schema (`competency_nodes`). Both derive from this document; the document is canonical and
any divergence is a bug. No frontend or backend file was changed by the 2026-11-08 revision.
