# Architecture Decisions (index)

Every significant decision is an ADR. This file is the index and status board, not the reasoning
(that lives in each ADR).

| ADR | Decision | Status |
|---|---|---|
| [ADR-001](../decisions/ADR-001-local-first-single-user.md) | Local-first, single-user, no cloud | Accepted |
| [ADR-002](../decisions/ADR-002-sqlite.md) | SQLite as the datastore | Accepted |
| [ADR-003](../decisions/ADR-003-modular-monolith.md) | Modular monolith, one process | Accepted |
| [ADR-004](../decisions/ADR-004-exam-config-states.md) | Three exam-config states + approval integrity | Accepted |
| [ADR-005](../decisions/ADR-005-provider-abstraction.md) | OpenAI-compatible provider abstraction | Accepted |
| [ADR-006](../decisions/ADR-006-frontend-first-gate.md) | Frontend-first; no backend until frontend approved | Accepted |
| [ADR-007](../decisions/ADR-007-no-frontend-tests.md) | No automated frontend tests; manual verification | Accepted |
| [ADR-008](../decisions/ADR-008-dependency-minimalism.md) | Minimal dependencies, justified | Accepted |
| [ADR-009](../decisions/ADR-009-no-auth.md) | No authentication by default | Accepted |
| [ADR-010](../decisions/ADR-010-stack-react-ts-vite-tailwind.md) | React + TS + Vite + Tailwind (candidate, not yet ratified) | Proposed |

Ratified decisions may only be reversed by a new ADR that supersedes this one (each ADR records its
`Supersedes`/`SupersededBy`).

The frontend stack (ADR-010) remains **Proposed**: it is the leading candidate, not a mandate. It
becomes `Accepted` only when the frontend implementation gate is approved (see
[PRD.md](../product/PRD.md) §10 and [AGENTS.md](../../AGENTS.md)).