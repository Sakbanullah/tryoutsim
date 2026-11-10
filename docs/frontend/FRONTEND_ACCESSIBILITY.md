# Frontend Accessibility

Accessibility contract for the UI. Baseline, not optional.

---

## 1. Standards

- WCAG 2.1 AA: contrast, keyboard, focus, semantics, target size.
- Semantic HTML first; ARIA only where native semantics are insufficient.
- Verification is manual (ADR-007) — nothing here claims automated coverage.

## 2. Non-negotiable behaviours

| Concern | Requirement |
|---|---|
| Keyboard | every action operable without a mouse; visible focus ring (2 px `--accent`, 2 px offset); no `outline: none` without a replacement |
| Focus order | logical DOM order; dialogs trap focus and restore it on close |
| Targets | ≥ 44 × 44 px in the dock, the option list and every primary action |
| Colour | state never colour-only — text or icon always accompany ([DESIGN_SYSTEM](./DESIGN_SYSTEM.md) §5) |
| Forms | labelled inputs; errors linked via `aria-describedby`; errors also stated in text |
| Numbers | percentages carry their counts (`72% (18/25)`) |
| Motion | `prefers-reduced-motion` respected; no essential information by motion alone |
| Zoom | usable at 200 % zoom and 360 px width; no horizontal scroll |
| Live regions | autosave status, submit progress, remaining-time text, paused-clock notice and unanswered count announced via `aria-live="polite"` |

## 3. Exam-screen specifics

| Element | Requirement |
|---|---|
| Question stem | heading semantics, `18px` minimum, measure ≤ 68 characters |
| Options | a real radio group for TWK/TIU; **for TKP, a radio group styled as "choose the best response" — still one selectable option, no weight shown, no "correct" affordance** |
| Selection feedback | border + check icon + `aria-checked`; never colour alone |
| Navigation | prev/next buttons labelled "Soal sebelumnya" / "Soal berikutnya"; a jump list with answered/unanswered state conveyed by text + icon |
| Autosave | "Tersimpan" / "Belum tersimpan" text, `aria-live` |
| Ujian tanpa waktu | when the bound config asserts no duration, the start screen must *say* the session has no time limit — absence of a timer is not silently hidden |
| Submit confirm | lists the unanswered count in text, with the count also read to screen readers |

## 4. TKP disclosure

TKP never shows a key. After answering in Latihan, feedback lists **each option's weight and why it earns
that weight**, conveyed as text ("mendapat 4 dari 5 poin"), never an icon-only ✓. No phrasing implies a
single correct response exists. In a tryout this block appears only on the result screen.

## 4.1 Result review block (Tinjau jawaban)

| Element | Requirement |
|---|---|
| Block structure | each question is a region with a heading — "No. {n} — TWK/TIU/TKP" — so a screen-reader user can jump block to block; the parts inside are a description list (term: "Jawabanmu", "Pembahasan"; value: the content). Not a two-cell wrapping table |
| Status | word **and** icon **and** semantic tone, never colour alone (§2 Colour). The icon carries `aria-hidden`; the word is the accessible text |
| TKP status | "Dijawab · nilai 4 dari 5" is one text node, so the value is read with the state and never as a bare number. The **Pencapaian** badge is a separate labelled element, not a colour cue |
| Correct answer | its own term/value pair ("Jawaban yang benar"), present in the accessibility tree only when rendered — a wrong answer is not announced twice by both status and correction |
| TKP option table | a real `<table>` with `<th scope="col">` Opsi · Nilai · Alasan; the chosen row carries a **Dipilih** text mark in its own cell, not a colour or a background alone |
| Semantic tone on a TKP row | never `--danger` (§3 Exam-screen specifics, DESIGN_SYSTEM §4); a lower weight is not an error |
| Missing reasoning | "Alasan per opsi belum tersedia untuk soal ini." rendered as text, not an empty cell alone |
| Explanation unavailable | "Pembahasan untuk soal ini belum tersedia." rendered as a normal paragraph in part 6's place — the absence is announced, never an empty region |
| Latihan link in the notice | a real link with an accessible name; focusable; **absent entirely** when no material relation resolves (a disabled or empty link is not rendered) |
| Contrast | normal text meets **4.5:1** against its surface in both themes, including status text, table cells and the muted note ([DESIGN_SYSTEM](./DESIGN_SYSTEM.md) §2) |
| Pagination | the page position ("3 / 4") is announced; moving pages moves focus to the review heading, as before |

## 5. Beginner-friendliness

- One primary action per screen; secondary actions visually subordinate.
- Every disabled control explains **why** in a line beneath it.
- Errors say what happened and what to do next, in that order.
- No jargon: see the wording table in [DESIGN_SYSTEM](./DESIGN_SYSTEM.md) §10.

## 6. Verification (manual)

1. Keyboard-only pass over Beranda → Tryout → package detail → runner → confirm → result.
2. Screen-reader pass over the runner (including the paused clock) and result.
3. Contrast check of every token pair in [DESIGN_SYSTEM](./DESIGN_SYSTEM.md) §2, plus each review-block
   status (Benar / Salah / Tidak dijawab / TKP) in both themes at 4.5:1.
4. Phone-width (360 px) and desktop pass; dock present on both.
5. Zoom 200 % pass.
6. Keyboard-only pass over the seven Kelola items and the sampling screen.

A failure in 1–5 blocks the frontend gate.
