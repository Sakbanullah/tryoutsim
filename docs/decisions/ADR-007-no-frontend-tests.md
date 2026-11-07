# ADR-007 — No automated frontend tests

- **Status**: Accepted
- **Date**: 2026-11-07

## Context

The user explicitly forbade frontend automated tests and installing a frontend test framework. The UI is single-user with heavy manual verification value on the exam flows.

## Decision

No automated frontend tests. Verification is manual (keyboard, screen-reader, contrast, phone width) per [FRONTEND_ACCESSIBILITY.md](../frontend/FRONTEND_ACCESSIBILITY.md) §4.

## Consequences

- No frontend test dependency, ever, unless the user reopens ([MVP_SCOPE.md](../product/MVP_SCOPE.md) §2).
- A failed manual accessibility pass blocks the frontend gate.
- This constraint is permanent for MVP, not a deferral.