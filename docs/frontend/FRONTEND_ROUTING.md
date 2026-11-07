# Frontend Routing

Route and navigation contract. Routes are fixed in IA
([FRONTEND_INFORMATION_ARCHITECTURE.md](./FRONTEND_INFORMATION_ARCHITECTURE.md)); this file fixes route
behaviour and URLs.

---

## 1. Route table

| Path | Screen | Guard |
|---|---|---|
| `/` | Dashboard | — |
| `/tryout` | Try Out start | — |
| `/tryout/:id` | Runner | — |
| `/tryout/:id/result` | Result | requires that session submitted/blocked |
| `/practice` | Practice start | — |
| `/practice/:id` | Practice runner | — |
| `/questions` | Question bank | — |
| `/questions/:id` | Question detail | — |
| `/generation` | Generation setup | — |
| `/generation-jobs/:id/review` | Generation review | job is completed |
| `/analytics` | Analytics | — |
| `/analytics/:competencyId` | Competency drill-down | — |
| `/ai` | AI config | — |
| `/exam-configs/:id` | Config detail + approval | — |
| `/study-plan` | Study plan editor | — |

## 2. URL & state

- URLs carry resource ids only (opaque strings, [API_SPECIFICATION](../backend/API_SPECIFICATION.md) §1);
  no score/threshold data in the query string.
- Navigating away from a runner with an unsaved flag/answer triggers autosave first (FR-T4), then a
  confirm if a submission is in-flight (not an incomplete silent discard).

## 3. Guards

- `/tryout/:id/result` with an `open` session redirects back to `/tryout/:id` (no premature result).
- `/generation-jobs/:id/review` redirects to `/generation` while the job is not `completed`.

## 4. Determinism

- Same path + same id → same screen. No navigation state stored in URL beyond ids; any
  selection/tab state lives in the module store, not the URL
  ([FRONTEND_STATE_MANAGEMENT.md](./FRONTEND_STATE_MANAGEMENT.md)).

## 5. Boundary

Link/router framework is an implementation detail ([FRONTEND_IMPLEMENTATION_PLAN.md](./FRONTEND_IMPLEMENTATION_PLAN.md));
URLs above are the contract and must not differ.