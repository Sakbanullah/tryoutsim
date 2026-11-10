# Prompt Specification

Canonical source for **every prompt template** the app sends to a provider. Prompts are versioned and
their ground-truth content traces to
[CPNS_2026_REGULATIONS.md](../examination/CPNS_2026_REGULATIONS.md) and
[COMPETENCY_TAXONOMY.md](../examination/COMPETENCY_TAXONOMY.md); no other document defines prompt text.

---

## 1. Rules

1. **Versioned.** Each template has `id` + `version`. A change is a new version, never an edit — a
   generation job records the exact `promptTemplateId` + `promptVersion` it ran with (provenance).
2. **Grounded.** Templates may only assert exam facts that are tiered in
   [CPNS_2026_REGULATIONS.md](../examination/CPNS_2026_REGULATIONS.md). A template that contains an
   `UNVERIFIED` fact marks it "not confirmed — base on general knowledge, do not present as official".
3. **Injected from data.** Competency goals come from
   [COMPETENCY_TAXONOMY.md](../examination/COMPETENCY_TAXONOMY.md) §6 verbatim; the template has a
   `{{goal}}` slot, not a hard-coded description.
4. **JSON contract in the template.** The template names the exact output schema and the fallback when
   `json_object` mode is unsupported (emit JSON fenced in a code block). Schema is validated by
   [AI_VALIDATION.md](./AI_VALIDATION.md) and then [QUESTION_SPECIFICATION.md](../examination/QUESTION_SPECIFICATION.md) §5.
5. **No secrets.** Templates never contain provider keys or URLs.

## 2. Template inventory

| id | Task | Purpose |
|---|---|---|
| `question.twk/tkp/tiu` | `question` | Generate a stem + 5 options + answer key for one competency |
| `explanation` | `explanation` | Explain the rationale behind a keyed/weighted answer |
| `material` | `material` | Draft a learning material for a weak competency |
| `analysis` | `analysis` | (optional) NL summary of a result, strictly from supplied numbers |

This document specifies structure and invariant text; the exact wording is a seed-data file (mock
`frontend/src/mocks/prompts.ts`, backend `prompt_templates` table) that derives from here.

## 3. Question template — structure (canonical)

For a competency node `C` in test `T`, with `{{goal}}` from the taxonomy and `{{count}}` questions:

```
[system] Anda menyusun soal latihan. Bahasa Indonesia. Format JSON saja.
Konteks: ini soal LATIHAN AI, bukan soal resmi CPNS/BKN.

[user]
Buat {{count}} soal pilihan ganda untuk kompetensi:
  test: {{T}}
  kompetensi: {{label.id}}
  tujuan resmi kompetensi (untuk dasar, bukan untuk dicantumkan): {{goal}}
  tingkat kesulitan: {{difficulty}}

Setiap soal:
- 5 opsi bertanda A, B, C, D, E.
- Untuk TKP (Tes Karakteristik Pribadi): skenario perilaku; setiap opsi diberi bobot 1–5
  (5 = paling tepat), tanpa opsi bernilai 0. Sertakan juga "optionJustifications": untuk SETIAP
  huruf opsi, satu kalimat mengapa opsi itu memperoleh bobot tersebut.
- Untuk TWK/TIU: tepat satu jawaban benar; tanpa "optionJustifications".
- Kunci jawaban disertakan sebagai struktur optionScores (lihat skema).
- TIDAK menuliskan "Soal Resmi", "Soal CPNS/BKN", atau logo resmi.

Output JSON sesuai skema:
{ "questions": [ { "stem": ..., "options": [{"key":"A","text":...}, ...],
  "answerKey": { "optionScores": {...}, "optionJustifications": {"A": "...", ...},
                 "unansweredScore": 0, "maxScore": 5 },
  "explanation": ... } ] }
```

`optionJustifications` is TKP-only and belongs to the answer key
([QUESTION_SPECIFICATION](../examination/QUESTION_SPECIFICATION.md) §1.2); it is what the review screen
shows beside each option's weight.

The factual content slot `{{goal}}` and the prohibition on official framing are invariant; the rest is
wording. A CPNS-2026 instrument change updates the taxonomy data, not this template body.

## 4. Fallback when JSON mode unsupported

The template appends: *"Jika mode JSON tidak tersedia, keluarkan JSON di dalam fence ```json```."*
The parser accepts either, per [AI_VALIDATION.md](./AI_VALIDATION.md).