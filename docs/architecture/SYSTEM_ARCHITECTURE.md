# System Architecture

Canonical source for **what the system is made of and how the pieces talk**. Not a deployment script.

Local-first, single-user. One process serves a browser UI and speaks to one external dependency: the
configured AI provider.

---

## 1. Context

```mermaid
flowchart LR
  U[User browser] <--> A[TryoutSim app]
  A <--> P[AI provider\n(gateway / OpenAI-compatible)]
  A <--> DB[(SQLite)]
```

- **No cloud account, no multi-user server** ([PRD.md](../product/PRD.md) §4, O-6).
- The only network call is to the provider ([PRD.md](../product/PRD.md) NFR-1).
- Backend binds `127.0.0.1`; no auth by default ([SECURITY.md](./SECURITY.md),
  [AUTHENTICATION.md](../backend/AUTHENTICATION.md)).

## 2. Components

| Component | Owns | Canonical doc |
|---|---|---|
| Frontend (React + TS + Vite + Tailwind, proposed) | UI, mock-data layer until backend approval | `docs/frontend/*` |
| API gateway | HTTP surface, one process | [API_SPECIFICATION.md](../backend/API_SPECIFICATION.md) |
| Exam/scoring domain | configs, sessions, scoring, thresholds, snapshots | [SCORING_METHODOLOGY.md](../examination/SCORING_METHODOLOGY.md) |
| Analytics | metrics from scores + timing | [ANALYTICS_ENGINE.md](../backend/ANALYTICS_ENGINE.md) |
| Recommendation | weaknesses, materials, study plan | [RECOMMENDATION_ENGINE.md](../ai/RECOMMENDATION_ENGINE.md) |
| Question bank | question CRUD, lifecycle, provenance | [QUESTION_SPECIFICATION.md](../examination/QUESTION_SPECIFICATION.md) |
| AI integration | provider transport, generation jobs | [AI_PROVIDER_ARCHITECTURE.md](../ai/AI_PROVIDER_ARCHITECTURE.md) |
| Storage | SQLite persistence + migrations | [DATABASE_SCHEMA.md](../backend/DATABASE_SCHEMA.md) |

## 3. Deployment shape

A **modular monolith** (see ADR on this): one backend process, modules separated by folder and
interface, not by service/network. One SQLite database file per user; migrations versioned (NFR-9).

## 4. Data flow summary

The end-to-end flows (bootstrap, generate, score, analyze) are in [DATA_FLOW.md](./DATA_FLOW.md).
Data-flow **invariants**:

- Scores are a pure function of a frozen [session snapshot](../examination/SCORING_METHODOLOGY.md §7) —
  never the live question bank/config.
- Analytics flows **from** scores, never back into them (scoring ↔ analytics separation).
- AI output changes nothing except the question bank; it never touches scoring/analytics (O-5).

## 5. Stack decision status

Stack and library choices are **candidates, not decided** — see
[ARCHITECTURE_DECISIONS.md](./ARCHITECTURE_DECISIONS.md) and the ADRs under
[decisions/](../decisions/README.md). The architecture above is a shape, not a dependency list.

## 6. Boundaries

- This file names components and their seams; it does not restate scoring rules, API paths, or schema.
- Frontend-internal architecture is [FRONTEND_COMPONENT_ARCHITECTURE.md](../frontend/FRONTEND_COMPONENT_ARCHITECTURE.md).
- Backend-internal execution is the `docs/backend/*` set.