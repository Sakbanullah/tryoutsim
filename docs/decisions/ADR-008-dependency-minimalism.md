# ADR-008 — Dependency minimalism

- **Status**: Accepted (revised 2026-11-10: the ORM prohibition is lifted by Product Owner decision; the
  minimalism principle is unchanged)
- **Date**: 2026-11-07 (original) · 2026-11-10 (revision)

## Context

A local app with no server has no reason to carry a large dependency surface; each added dependency is a
licence, security, and upgrade load ([SECURITY.md](../architecture/SECURITY.md) §1).

The original decision (2026-11-07) also prohibited an ORM outright. A **Product Owner decision
(2026-11-10)** supersedes that prohibition: TryoutSim uses an ORM with PostgreSQL 18
([ADR-002](ADR-002-sqlite.md)). The reasoning is the same portfolio/multi-user trajectory as the datastore
change — a typed, schema-derived data layer is part of the product's intended shape.

## Decision

**Minimal dependencies, each justified against a concrete feature.** Stdlib / native platform wins over a
library ([SYSTEM_ARCHITECTURE.md](../architecture/SYSTEM_ARCHITECTURE.md) §5). No heavy state/query
library on the frontend, no test framework added speculatively.

**An ORM is permitted, and one is intended.** The framework decision (product-owner approved in principle,
2026-11-10) is:

- **One ORM** provides the typed data layer against PostgreSQL 18: **Prisma ORM** (Product Owner decision,
  2026-11-10; [ADR-011](ADR-011-orm-selection.md), `Accepted`). Its dependency family is `prisma` (dev),
  `@prisma/client`, `@prisma/adapter-pg` and `pg` — the single driver, declared directly. No second ORM,
  query builder or driver ([ADR-011](ADR-011-orm-selection.md) §4).
- The ORM is **one added dependency family**, not an unbounded licence to add libraries. A query builder,
  a migration framework *in addition to* the ORM's own, or a second data-access library still requires its
  own justification.
- **Raw SQL remains available and is used where the ORM is the wrong tool** (complex analytics aggregates,
  atomic multi-statement invariants, schema-level constraints). Using an ORM does not mean every query
  goes through it.

## Consequences

- "Add a library" is a deliberate decision with a stated trigger ([FRONTEND_STATE_MANAGEMENT.md](../frontend/FRONTEND_STATE_MANAGEMENT.md) §4), not a default.
- The ORM's transitive dependency tree is part of the security surface; it is accepted as one deliberate
  exception and stays within the single-ORM constraint above ([SECURITY.md](../architecture/SECURITY.md) §1).
- Smaller attack/audit surface than an unconstrained stack; larger than the original no-ORM position. That
  growth is the cost of the PO decision, recorded, not hidden.
- Refusals to add are recorded, and re-opened only when the trigger is observed.

## Supersedes / superseded

- **Supersedes**: the "No ORM" clause of the 2026-11-07 ADR-008 as originally recorded (PO, 2026-11-10).
- **Not superseded**: the minimalism principle, the "stdlib first" rule, the no-heavy-frontend-state-library
  rule, and the requirement that every added dependency be justified.

Exact ORM → [ADR-011](ADR-011-orm-selection.md) (**Accepted 2026-11-10 — Prisma ORM**).
