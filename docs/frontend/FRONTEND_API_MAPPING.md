# Frontend API Mapping

The endpoint inventory the frontend is specified against, and the reverse mapping from every screen to
the endpoints it calls. Source of truth: [API_ENDPOINTS](../backend/API_ENDPOINTS.md); contract details:
[API_SPECIFICATION](../backend/API_SPECIFICATION.md), [ERROR_HANDLING](../backend/ERROR_HANDLING.md).

All paths are relative to `/api/v1`. All responses use `{ data, meta: { version } }` or
`{ error: { code, message, details, requestId } }` ([FRONTEND_DATA_CONTRACTS](./FRONTEND_DATA_CONTRACTS.md) §2).
Every state-changing request carries `X-Tryoutsim-Client: 1` (GAP-X1).

**Auth**: none. Every route is unauthenticated by design (ADR-009,
[AUTHENTICATION](../backend/AUTHENTICATION.md)); the server binds to loopback only.

Classification: **L** = Belajar area · **M** = Kelola area · **I** = shell/plumbing · **U** = unused by
the frontend. Status: **Supported** = request and response typed · **Partial** = typed but one
sub-shape still open (gap id) · **GAP** = contract missing.

---

## 1. Endpoint inventory (75 routes)

### 1.1 Bootstrap · 1

| ID | Method | Path | Purpose | Class | Status | Source |
|---|---|---|---|---|---|---|
| E01 | GET | `/bootstrap` | first-paint snapshot: taxonomy, packages, providers summary, bank summary, unread count, defaults — **no exam-config list** | I | Supported | API_ENDPOINTS §1 |

### 1.2 Exam configs (Kelola only) · 4

| ID | Method | Path | Class | Status |
|---|---|---|---|---|
| E02 | GET | `/exam-configs` | M | Supported — CPNS rows only |
| E03 | GET | `/exam-configs/:id` | M | Supported — includes `outstandingWarnings[]` |
| E04 | POST | `/exam-configs/:id/approval` | M | Supported |
| E05 | POST | `/exam-configs` | M | Supported — new temporary version |

### 1.3 Packages and Latihan · 6

| ID | Method | Path | Class | Status |
|---|---|---|---|---|
| E06 | GET | `/packages` | L + M | Partial — availability, `repeatCount`, `unavailableReason`; package `definition` detail GAP-M12 |
| E07 | GET | `/packages/:id` | L + M | Supported |
| E08 | POST | `/packages` | M | Supported — custom from template |
| E09 | POST | `/packages/:id/versions` | M | Supported — new version |
| E10 | POST | `/packages/:id/retire` | M | Supported |
| E11 | GET | `/latihan/submateri` | L | Supported — leaves + stock |

### 1.4 Sessions and scoring · 14

| ID | Method | Path | Class | Status |
|---|---|---|---|---|
| E12 | POST | `/packages/:id/sessions` | L | Supported — server assembles roster, binds config |
| E13 | GET | `/sessions` | L | Supported — history, newest first |
| E14 | GET | `/sessions/:id` | L | Supported — runner payload + saved answers + clock |
| E15 | PATCH | `/sessions/:id/answers` | L | Supported — answer + flag + clock |
| E16 | POST | `/sessions/:id/pause` | L | Supported |
| E17 | POST | `/sessions/:id/resume` | L | Supported — returns expired state |
| E18 | POST | `/sessions/:id/answer-feedback` | L | Supported — Latihan only |
| E19 | POST | `/sessions/:id/submit` | L | Supported |
| E20 | POST | `/sessions/:id/score` | L | Supported |
| E21 | GET | `/sessions/:id/result` | L | Supported — **no** question content or explanation (§7.7) |
| E78 | GET | `/sessions/:id/questions?ids=…` | L | Supported — Tinjau jawaban blocks: frozen content + key + weights, batch 1–20 roster ids (PO-approved contract). Any bad id = one `400`; `submitted` sessions only |
| E22 | DELETE | `/sessions/:id` | L | Supported |
| E23 | POST | `/sessions/bulk-delete` | L | Supported |
| E24 | GET | `/sessions/:id/deletion-impact` | L | Supported |

### 1.5 Analytics · 2

| ID | Method | Path | Class | Status |
|---|---|---|---|---|
| E25 | GET | `/analytics` | L | Supported — no `configId` filter in the UI |
| E26 | GET | `/analytics/trends?competencyId=<id>` | L | Supported |

### 1.6 Questions · 15

| ID | Method | Path | Class | Status |
|---|---|---|---|---|
| E27 | GET | `/questions` | M | Partial — text + filters; cluster detail GAP-M4 |
| E28 | GET | `/questions/duplicates` | M | Partial — GAP-M4 |
| E29 | GET | `/questions/:id` | M | Supported |
| E30 | POST | `/questions` | M | Supported — manual, one at a time |
| E31 | PATCH | `/questions/:id` | M | Supported — bumps `contentVersion` |
| E32 | PATCH | `/questions/:id/accept` | M | Partial — `FieldEdit` GAP-M1 |
| E33 | POST | `/questions/:id/activate` | M | Supported |
| E34 | POST | `/questions/:id/archive` | M | Supported |
| E35 | POST | `/questions/:id/quarantine` | M | Supported |
| E36 | POST | `/questions/bulk` | M | Supported — archive only |
| E37 | POST | `/questions/:id/reports` | L + M | Supported — report from a result or the bank |
| E38 | GET | `/question-reports` | M | Supported |
| E39 | PATCH | `/question-reports/:id` | M | Supported — final decision |
| E40 | POST | `/question-batches/:batchId/sample` | M | Supported |
| E41 | GET | `/question-batches` | M | Supported |

### 1.7 Materials · 7

| ID | Method | Path | Class | Status |
|---|---|---|---|---|
| E42 | GET | `/materials` | M | Supported |
| E43 | GET | `/materials/:id` | M | Supported |
| E44 | POST | `/materials` | M | Supported |
| E45 | PATCH | `/materials/:id` | M | Supported — new version |
| E46 | POST | `/materials/:id/approve` | M | Supported |
| E47 | POST | `/materials/:id/retire` | M | Supported |
| E48 | POST | `/materials/:id/draft` | M | Supported — 202 job |

### 1.8 Generation jobs · 4

| ID | Method | Path | Class | Status |
|---|---|---|---|---|
| E49 | POST | `/generation-jobs` | M | Supported — `competencyIds[]`, no token/cost |
| E50 | GET | `/generation-jobs` | M | Supported |
| E51 | GET | `/generation-jobs/:id` | M | Supported |
| E53 | POST | `/generation-jobs/:id/retry` | M | Supported |

### 1.9 Providers and routing · 9

| ID | Method | Path | Class | Status |
|---|---|---|---|---|
| E54 | GET | `/providers` | M | Supported — `keyLast4` + `hasKey` |
| E55 | POST | `/providers` | M | Supported — preset, write-only key |
| E56 | PATCH | `/providers/:id` | M | Supported |
| E57 | DELETE | `/providers/:id` | M | Supported — credential purged |
| E58 | POST | `/providers/:id/test` | M | Supported — test + capability probe |
| E59 | POST | `/providers/:id/models` | M | Supported |
| E60 | PUT | `/providers/:id/capabilities` | M | Supported — manual correction |
| E61 | GET | `/ai-routing` | M | Supported |
| E62 | PUT | `/ai-routing` | M | Supported — default + per-task |

### 1.10 Notifications · 3

| ID | Method | Path | Class | Status |
|---|---|---|---|---|
| E63 | GET | `/notifications` | I | Supported |
| E64 | PATCH | `/notifications/:id` | I | Supported |
| E65 | POST | `/notifications/read-all` | I | Supported |

### 1.11 Backup, restore, health · 7

| ID | Method | Path | Class | Status |
|---|---|---|---|---|
| E66 | GET | `/settings/backup` | M | Supported |
| E67 | PUT | `/settings/backup` | M | Supported |
| E68 | POST | `/backups` | M | Supported — 202 |
| E69 | GET | `/backups` | M | Supported |
| E70 | POST | `/restores/validate` | M | Supported |
| E71 | POST | `/restores` | M | Supported — 202 |
| E72 | GET | `/health` | I | Supported — launcher readiness |

### 1.12 Recommendations · 3

| ID | Method | Path | Class | Status |
|---|---|---|---|---|
| E73 | GET | `/recommendations/weaknesses` | L | Supported |
| E74 | GET | `/recommendations/materials` | L | Supported — `MaterialOffer` |
| E75 | POST | `/recommendations/drill` | L | Supported |

E76/E77 (`GET`/`PUT /study-plan`) are **retired**: the standalone plan feature is not in MVP. Ids are not
reused.

## 2. Counts

| Measure | Count |
|---|---|
| Routes documented in [API_ENDPOINTS](../backend/API_ENDPOINTS.md) | **75** |
| E-ids in this file | **75** (E01–E78 minus E52, E76, E77) |
| Called by a specified screen | 74 |
| Not called by a screen | 1 — E72 `/health` (launcher only) |
| Supported | 71 |
| Partial (low, gap id named) | 4 — E27, E28 (GAP-M4), E32 (GAP-M1), E06 `definition` detail (GAP-M12) |

Section counts: 1 + 4 + 6 + 14 + 2 + 15 + 7 + 4 + 9 + 3 + 7 + 3 = **75**.

**`E36` is now in both tables.** `E36 POST /questions/bulk` is the bulk **archive** action; its route row
is in [API_ENDPOINTS](../backend/API_ENDPOINTS.md) §6 (`active → archived` only). The mapping keeps the row
because [PRD](../product/PRD.md) FR-Q4 keeps bulk archive and drops bulk activate and bulk edit. The route
was already part of the written contract at HEAD (PRD FR-Q4, API_ENDPOINTS §6 prose, VALIDATION); adding the
missing table row restored the contract, it did not add a capability. The Product Owner **approved** bulk archive for MVP on 2026-11-09 (`active → archived` only, ids
validated, one transaction, unsupported transitions rejected, no bulk editing, activation or import) —
see [AUDIT](../AUDIT.md) AUD-74.

**`E78` is new, not restored.** `GET /sessions/:id/questions` was added by the Product Owner decision of
2026-11-09 (Tinjau jawaban revision, option P-1b): the review block's content and key come from the
session snapshot, and its explanation is shown only when the question's latest version equals the frozen
one (strict version matching). Contract: [API_SPECIFICATION](../backend/API_SPECIFICATION.md) §7.7. The
`?ids=` batch form (1–20 roster ids, identical `400` for every bad id) is the **approved final API
contract** (Product Owner 2026-11-09), replacing the single-id sketch. It takes the next free id, E78;
the three retired ids below stay retired.

**Retired ids** (never reused): E52 `POST /generation-jobs/:id/cancel` — MVP jobs have no cancel, pause or
resume; E76 `GET /study-plan`, E77 `PUT /study-plan` — the standalone Rencana Belajar feature is not in MVP
(Product Owner, 2026-11-08).

## 3. Reverse mapping — screen → endpoints

| Screen (route) | Endpoints | Walkthrough |
|---|---|---|
| Beranda `/` | E01, E25, E13, E63, E73 (E13 `GET /sessions` carries the open session; resume happens on route entry, so E17 belongs to the runner) | PAGE_SPEC §1 |
| Tryout pilih `/tryout` | E06 | §2 |
| Tryout detail `/tryout/:packageId` | E07, E12 | §3 |
| Runner `/tryout/sesi/:id` | E14, E15, E16, E17 | EXAM_FLOW |
| Konfirmasi `/tryout/sesi/:id/konfirmasi` | E19 | PAGE_SPEC §5 |
| Hasil `/tryout/sesi/:id/hasil` | E21, E78, E20, E24, E22, E73, E74, E75, E37 | RESULTS_ANALYTICS §2–§5 |
| Latihan `/latihan` | E11, E06, E12, E25, E73 | PAGE_SPEC §7 |
| Latihan runner `/latihan/sesi/:id` | E14, E15, E18, E19, E21 | EXAM_FLOW §9 |
| Progres `/progres` | E25, E26, E73 | RESULTS_ANALYTICS §6 |
| Detail submateri `/progres/kompetensi/:id` | E25, E26, E42, E75 | §7 |
| Lainnya `/lainnya` | E01, E63 | PAGE_SPEC §10 |
| Bank Soal `/lainnya/soal` | E27, E28, E30, E36, E37 | §11 |
| Bank Soal detail `/lainnya/soal/:id` | E29, E31, E32, E33, E34, E35, E37 | §11 |
| Review Soal `/lainnya/review` | E41, E40, E38, E39, E35 | §12 |
| Materi `/lainnya/materi` | E42, E44, E48 | §13 |
| Materi detail `/lainnya/materi/:id` | E43, E45, E46, E47 | §13 |
| Generasi AI `/lainnya/generasi` | E49, E50 | §14 |
| Generasi detail `/lainnya/generasi/:jobId` | E51, E53, E32 | §14 |
| Pengaturan AI `/lainnya/ai` | E54–E62 | §15 |
| Konfigurasi Ujian `/lainnya/ujian` | E02, E05 | §16 |
| Konfigurasi detail `/lainnya/ujian/:id` | E03, E04 | §16 |
| Manajemen Paket `/lainnya/paket` | E06, E08 | §17 |
| Manajemen Paket detail `/lainnya/paket/:id` | E07, E09, E10 | §17 |
| Pengaturan `/lainnya/pengaturan` | E66–E71 | §18 |
| Pusat pemberitahuan `/lainnya/notifikasi` | E63, E64, E65 | §19 |

## 4. Contract conflicts the mapping exposes

| # | Conflict | Stance |
|---|---|---|
| 1 | `bucketUnit` present in [SCORING_METHODOLOGY](../examination/SCORING_METHODOLOGY.md) §2.2 but not in the [API_SPECIFICATION](../backend/API_SPECIFICATION.md) §5 example | Treated as optional and ignored (GAP-X4) |
| 2 | `SubtestStructure` / `ScoringRules` detail never defined | Instructions show package item counts instead (GAP-M12) |
| 3 | `ConfigSummary` used by the approval dialog but not separately typed | Dialog reads `ExamConfig` fields directly (GAP-M9) |

## 5. Coverage summary

- **75 routes** documented and typed; **71 Supported**, **4 partial** on a sub-shape only, all `low`
  (E06 `definition` — GAP-M12, E27/E28 — GAP-M4, E32 — GAP-M1); E72 `/health` is launcher-only (§2).
- Every Belajar screen and every Kelola screen has a complete endpoint set.
- The mock layer demonstrates every screen without a backend
  ([FRONTEND_MOCK_DATA_STRATEGY](./FRONTEND_MOCK_DATA_STRATEGY.md)).
- **No endpoint, field, status code or error code in this file was invented** — each row cites
  [API_ENDPOINTS](../backend/API_ENDPOINTS.md), which cites the canonical domain doc.
