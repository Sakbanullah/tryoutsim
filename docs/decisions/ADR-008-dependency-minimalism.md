# ADR-008 — Dependency minimalism

- **Status**: Accepted
- **Date**: 2026-11-07

## Context

A local app with no server has no reason to carry a large dependency surface; each added dependency is a licence, security, and upgrade load ([SECURITY.md](../architecture/SECURITY.md) §1).

## Decision

Minimal dependencies, each justified against a concrete feature. Stdlib / native platform wins over a library ([SYSTEM_ARCHITECTURE.md](../architecture/SYSTEM_ARCHITECTURE.md) §3). No ORM, no heavy state/query library, no test framework added speculatively.

## Consequences

- "Add a library" is a deliberate decision with a stated trigger ([FRONTEND_STATE_MANAGEMENT.md](../frontend/FRONTEND_STATE_MANAGEMENT.md) §4), not a default.
- Smaller attack/audit surface.
- Refusals to add are recorded, and re-opened only when the trigger is observed.