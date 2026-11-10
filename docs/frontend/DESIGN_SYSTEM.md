# Design System

Visual and interaction system for the frontend. Tokens are defined once here and referenced
everywhere. No CPNS or institutional branding — the app is a neutral study aid and never impersonates
a real body ([FRONTEND_PRD](./FRONTEND_PRD.md) §5).

**Direction: Playful Learning — friendly, clear, focused.** Welcoming without being childish; the
exam screen strips back to calm.

---

## 1. Principles

1. **Numbers, not adjectives** — every metric is shown with its raw counts.
2. **One meaning per state** — badges share semantics across every screen.
3. **Calm in the exam** — decoration never competes with the question.
4. **Beginner-first copy** — plain Indonesian; no technical vocabulary in UI text.
5. **Colour is never the only carrier** — every colour state has a word or icon beside it.

## 2. Colour tokens

```css
:root {
  /* surfaces */
  --bg:            #ffffff;
  --surface:       #f7f8fc;   /* cards */
  --surface-muted: #eef1f8;   /* table stripes, quiet blocks */
  --text:          #1b1f2a;
  --text-muted:    #5a6274;
  --border:        #e2e6ef;

  /* accents — primary bright blue */
  --accent:        #2563eb;
  --accent-weak:   #dbe6ff;   /* tint for selected states */
  --lavender:      #ece9ff;
  --lavender-ink:  #5b4fd1;
  --sunny:         #fff3c9;
  --sunny-ink:     #8a6200;

  /* semantic */
  --success:       #12805a;
  --success-weak:  #dff5ec;
  --warning:       #a86600;
  --warning-weak:  #fff1d6;
  --danger:        #c0263a;
  --danger-weak:   #fde6ea;
  --info:          #2d4fb5;
  --info-weak:     #e4ebff;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #12141b; --surface: #1b1e27; --surface-muted: #232733;
    --text: #e9ecf3; --text-muted: #a0a8b8; --border: #2c3140;
    --accent: #6c9bff; --accent-weak: #24365e;
    --lavender: #2a2746; --lavender-ink: #b9b0ff;
    --sunny: #3a3016; --sunny-ink: #f0cc72;
    --success: #4cc39a; --success-weak: #16362c;
    --warning: #e2a33c; --warning-weak: #3a2d12;
    --danger: #ff7d8b; --danger-weak: #3d1a20;
    --info: #93a9ff; --info-weak: #212c53;
  }
}
```

Contrast: body text on `--bg`/`--surface` meets 4.5:1; any text on a semantic `-weak` fill uses the
matching `-ink`/semantic colour, never pure `--text` on a saturated fill.

**Where colour is used**

| Colour | Use | Never |
|---|---|---|
| `--accent` | primary buttons, active nav item, focus ring, selected option border | large backgrounds |
| `--lavender` | secondary cards, empty-state illustrations, competency chips, the TKP **Pencapaian** badge and the chosen-option mark in the review block | exam screen |
| `--sunny` | provisional/notice highlights, first-time tips | error states |
| `--success` | *Benar*, saved indicator, verified basis | exam screen |
| `--warning` | *Belum Terverifikasi* notice, backup failure | a verdict |
| `--danger` | *Salah*, errors, destructive confirm | a TKP option ever |

## 3. Shape, spacing, type

- Radius: `--r-sm 8px` (inputs, badges) · `--r-md 14px` (cards) · `--r-lg 20px` (dialogs, hero),
  buttons `14px`. **No pill-shaped primary buttons**; badges may be pills.
- Spacing scale: `4 · 8 · 12 · 16 · 24 · 32 · 48`. Side gutter 16 px at phone widths.
- Shadows: one soft elevation only (`0 1px 2px rgba(16,24,40,.06), 0 1px 3px rgba(16,24,40,.1)`);
  no glow, no layered shadows.
- **Type** (not the default system stack — the two families do different jobs):
  - **Display / headings — Plus Jakarta Sans** (600/700). Indonesian-designed, slightly rounded
    terminals that match the soft cards without looking childish. Bundled, **self-hosted**, no
    network fetch (NFR-1 local-first).
  - **Body / UI — Inter** (400/500/600). Neutral, highly legible at 14–16 px, wide language support.
  - **Numeric readouts — tabular figures of Inter** (`font-variant-numeric: tabular-nums`) wherever a
    column of numbers stacks: result points, percent + counts, sample `n`. Never a separate mono face.
  - Sizes `14 / 16 / 18 / 22 / 28 / 34`; body 16 px, line-height 1.55; question stems 18 px / 1.6 with
    max measure **68 characters**. Headings set 34/28/22 with line-height 1.15 and `-0.01em` tracking;
    no all-caps labels anywhere.
  - Fallback stack if a face fails to load: `ui-sans-serif, system-ui, sans-serif`.
- **No gradients** except a subtle background wash on the Beranda hero card (lavender → white).
- **Signature element** (the one memorable thing): the point bar — a horizontal ladder made of one
  short tick per scored question, filled in `--accent` for earned points and left as a hairline
  `--border` tick when empty. It appears **only** on the result screen, once per test, so the learner
  reads "how much of this did I get" as a shape before reading numbers. It is derived only from
  `QuestionScore.earned` already in `ScoreResult` — never a new calculation — and carries a text
  equivalent. Progres has no per-question data, so it gets no bar. No other screen gets decoration.

## 4. Iconography and illustration

- A small consistent set of line icons at 20 px / 24 px, stroke 1.75.
- A single friendly mascot (a simple waving round character, blue-and-yellow) may appear **only** on Beranda empty states,
  the exam start screen, and the "selesai" screen — never inside a question or on a result metric.
- Illustrations are simple flat shapes in `--lavender` / `--sunny`; no stock photography.

## 5. State badges (shared semantics)

| State | Token | Label (Indonesian) | Where rendered |
|---|---|---|---|
| config `official_verified` | success | **Terverifikasi** | Kelola → Konfigurasi Ujian only |
| config `historical` | info | **Arsip {tahun}** | Kelola → Konfigurasi Ujian only |
| config `provisional` | warning-weak | **Belum Terverifikasi** | Kelola → Konfigurasi Ujian; result note only when a verdict is involved |
| config approval valid | warning | **Disetujui sementara** | Kelola → Konfigurasi Ujian only |
| provenance `ai_generated*` | lavender | **Latihan AI — bukan soal resmi** | every question surface |
| provenance `official_historical` | info | **Arsip {tahun} — bukan soal siklus berjalan** | every question surface |
| provenance `human_authored` | surface-muted | **Soal buatanmu** | every question surface |
| material draft | warning-weak | **Draf — belum disetujui** | Materi |
| material unverified source | warning-weak | **Sumber belum terverifikasi** | Materi, recommendation |
| sample `insufficient_data` | surface-muted | **Belum cukup data** | results, Progres |
| sample `zero_correct` | danger-weak | **0 benar dari n soal** | results, Progres |
| sample `zero_attainment` | danger-weak | **0 poin dari n soal** | results, Progres |
| sample `reportable` | success-weak | the metric itself | results, Progres |
| job `interrupted` | warning-weak | **Terhenti — bisa dicoba lagi** | Generasi AI, notification |
| backup `failed` | danger-weak | **Backup gagal** | Pengaturan, notification |
| answer `correct === true` | success | ✓ **Benar** | Tinjau jawaban block header, one per question |
| answer `correct === false` | danger | ✗ **Salah** | Tinjau jawaban block header, one per question |
| answer `selected === null` | surface-muted | — **Tidak dijawab** | Tinjau jawaban block header |
| TKP answered / unanswered | lavender (badge) | **Dijawab · nilai {earned} dari {maxScore}** / **Tidak dijawab · nilai …** + **Pencapaian** | Tinjau jawaban block header. **Never** success or danger — TKP has no correct/wrong state |

**No config badge is rendered anywhere in Belajar** — not on Beranda, not on Progres, not on the runner,
not on the result header ([FRONTEND_INFORMATION_ARCHITECTURE](./FRONTEND_INFORMATION_ARCHITECTURE.md) §6).

## 6. Exam-screen rules (restrictive)

- Background `--bg`; no mascot, no gradients, no lavender/sunny surfaces.
- One question card, one option list, one footer with navigation.
- Text-only timer showing accumulated active time; no animated countdown ring. A paused clock is shown
  as text ("Waktu berhenti"), never by colour alone.
- No colour on options except the selected border (`--accent`) and, after submit only, the result
  marking.
- Motion limited to a 120 ms fade between questions; none if `prefers-reduced-motion`.

## 7. Navigation

- **Bottom dock** on all widths — fixed at the bottom on phones, a centered bar of max 560 px on
  desktop. It is not converted to a sidebar (U-F9).
- Active item: `--accent` icon + label + a 3 px top indicator; inactive: `--text-muted`.
- Each item ≥ 44 × 44 px; labels always visible (no icon-only dock).

## 8. Component behaviour (shared)

| Component | Behaviour |
|---|---|
| Button (primary) | `--accent` fill, white text, radius 14, min height 44 |
| Button (secondary) | white/`--surface`, 1 px `--border`, `--text` |
| Button (disabled) | 40 % opacity **and** a reason line beneath ("Belum bisa dimulai — stok soal belum cukup") |
| Card | `--surface`, radius 14, padding 16–20, 1 px `--border` |
| Dialog | radius 20, max 480 px, focus-trapped, destructive action on the right in `--danger` |
| Input | 1 px `--border`, radius 8, focus ring 2 px `--accent` offset 2, error text below in `--danger` |
| Badge | pill, 12 px label, icon + text |
| Toast | bottom above dock, 4 s, dismissible, never carries the only copy of an error |

## 9. Data display

- **Point bar** (§3): one tick per roster question in roster order — filled (`--accent`) if
  `QuestionScore.earned > 0`, hairline otherwise. The bar carries no label of its own; the numbers
  beside it carry the meaning. Screen readers get "18 dari 25 soal mendapat poin".
- Percentages always integer with counts: `72% (18/25)`.
- `insufficient_data` → `—` with "Belum cukup data (n=3)".
- Median response time → `1,9 menit/soal (n=27)` — the `n` is mandatory.
- Money-like formatting is never used; points are whole integers with no unit suffix beyond
  "poin".

## 10. Content rules (UI copy)

| Avoid | Show instead |
|---|---|
| Submit session | **Kirim jawaban** |
| Question bank | **Bank Soal** |
| Analytics | **Progres** |
| Management area | **Kelola** (reached via **Lainnya**) |
| Try out | **Tryout** |
| Practice | **Latihan** |
| Exam configuration | **Konfigurasi Ujian** |
| Authentication / 401 | **Gagal masuk** (not used today — no login exists) |
| Loading | **Sedang memuat…** |
| Empty | **Belum ada data** |
| Retry request | **Coba lagi** |
| Endpoint / API / payload / schema / lifecycle / provider | *(never shown)* |

Technical identifiers (`competencyId`, `configId`, error codes, PF-xx) are **never** rendered as
labels; the UI translates them (e.g. `PF-01` → "Ada jawaban ganda untuk satu soal" when a message
exists, otherwise "Ada yang tidak sesuai pada jawabanmu" + "Coba lagi").

| Review-block label | Exact copy |
|---|---|
| Question identity | "No. {n} — **{TWK\|TIU\|TKP}**" (the test only; no competency id) |
| Your answer | **Jawabanmu:** Pilihan {key} — {option text} · **Jawabanmu:** Tidak dijawab |
| Status | **Benar** · **Salah** · **Tidak dijawab** · **Dijawab · nilai {earned} dari {maxScore}** · **Tidak dijawab · nilai {earned} dari {maxScore}** |
| TKP badge | **Pencapaian** |
| Correct answer (TWK/TIU, wrong only) | **Jawaban yang benar:** Pilihan {key} — {option text} |
| Explanation | **Pembahasan:** |
| TKP table headers | Opsi · Nilai · Alasan · **Dipilih** mark |
| Missing TKP reasoning | "Alasan per opsi belum tersedia untuk soal ini." |
| Explanation unavailable (version differs or none) | "Pembahasan untuk soal ini belum tersedia." |
| Latihan link beside that notice | only for a resolved material relation (T-02 — final copy open); never rendered otherwise |
| Content unavailable | "Isi soal belum bisa ditampilkan." |

## 11. Boundary

This is design, not implementation. Implementation framework: [FRONTEND_IMPLEMENTATION_PLAN](./FRONTEND_IMPLEMENTATION_PLAN.md).
Accessibility rules: [FRONTEND_ACCESSIBILITY](./FRONTEND_ACCESSIBILITY.md).
