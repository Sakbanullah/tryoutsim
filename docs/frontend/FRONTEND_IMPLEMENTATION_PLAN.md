# Frontend Implementation Plan

Deferred. Nothing here runs yet; it executes only after the frontend gate opens
([DEVELOPMENT_ROADMAP](../roadmap/DEVELOPMENT_ROADMAP.md) Gate 2). Reference set:
[FRONTEND_API_MAPPING](./FRONTEND_API_MAPPING.md) · [FRONTEND_GAP_REGISTER](./FRONTEND_GAP_REGISTER.md) ·
[FRONTEND_PAGE_SPECIFICATIONS](./FRONTEND_PAGE_SPECIFICATIONS.md).

---

## 1. Gating

- Activates **only** on explicit approval of this documentation set, frontend-first (mock data), then
  backend at Gate 3.
- No automated frontend tests (ADR-007). Verification is the manual checklist in
  [FRONTEND_ACCESSIBILITY](./FRONTEND_ACCESSIBILITY.md) §6.

## 2. Order (dependency-first)

1. Scaffold (candidate React + TS + Vite + Tailwind, ADR-010) + token layer ([DESIGN_SYSTEM](./DESIGN_SYSTEM.md)).
2. Contract types ([FRONTEND_DATA_CONTRACTS](./FRONTEND_DATA_CONTRACTS.md) §3–§5) + mock client emitting
   real envelopes including the 15 error codes ([FRONTEND_MOCK_DATA_STRATEGY](./FRONTEND_MOCK_DATA_STRATEGY.md)).
3. UI primitives ([FRONTEND_COMPONENT_ARCHITECTURE](./FRONTEND_COMPONENT_ARCHITECTURE.md) §2) + bottom dock.
4. Shell + the 26 routes ([FRONTEND_ROUTING](./FRONTEND_ROUTING.md)) with guards.
5. Screens in learning order: Beranda → Tryout pilih → package detail → runner → konfirmasi → hasil →
   Progres → Latihan, then the seven Kelola items (Bank Soal, Review Soal, Materi,
   Generasi AI, Pengaturan AI, Konfigurasi Ujian, Manajemen Paket), then Pengaturan and the
   notification centre. There is no Rencana Belajar screen in MVP
   ([MVP_SCOPE](../product/MVP_SCOPE.md) §2).
6. Manual verification pass → **frontend gate decision**.

## 3. What each screen may build against

| Endpoint status ([API_MAPPING](./FRONTEND_API_MAPPING.md) §2) | Build rule |
|---|---|
| Supported (69) | Typed client + mock with the same shape |
| Partial (4, all `low`) | Full wiring on the documented part; the open sub-shape is flagged in a dev-only note and its gap id stays open |
| Not called (1 — `/health`) | No screen, no mock |

No screen is blocked by a missing contract for MVP scope.

## 4. Fixed vs chosen

| Fixed (contract) | Chosen at implementation |
|---|---|
| routes, data shapes, screens, no-recompute rule, dock placement | router lib, CSS approach within Tailwind, file layout |
| no premature state/query library | when one is added (triggers: [FRONTEND_STATE_MANAGEMENT](./FRONTEND_STATE_MANAGEMENT.md) §7) |
| mock returns real envelopes incl. errors | fixture content |

## 5. Non-goals

- No backend implementation (Gate 3 only).
- No provider/network calls from the frontend (mock layer only).
- No scope additions ([MVP_SCOPE](../product/MVP_SCOPE.md) §2).

## 6. Open before start

Not blocking the plan, but each must be answered or consciously accepted before the corresponding
screen is wired to a real backend: **U-F1…U-F12**
([FRONTEND_GAP_REGISTER](./FRONTEND_GAP_REGISTER.md) §5) and the open owner items
([SYSTEM_REVISION_REPORT](./../audit/SYSTEM_REVISION_REPORT.md) §8, [../AUDIT.md](../AUDIT.md) open
findings).
The stack stays Proposed until approval.
