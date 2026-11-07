# ADR-006 — Frontend-first gate

- **Status**: Accepted
- **Date**: 2026-11-07

## Context

The UI is the product's main risk (exam flows, disclosure rules, approval UX). Building the backend first would delay discovering that the UX/contracts are wrong.

## Decision

Frontend first: build the UI on mock data behind a contract-complete mock layer ([FRONTEND_MOCK_DATA_STRATEGY.md](../frontend/FRONTEND_MOCK_DATA_STRATEGY.md)), get approval, then implement the backend to the same contracts.

## Consequences

- Contracts are front-loaded ([API_SPECIFICATION.md](../backend/API_SPECIFICATION.md) ↔ [FRONTEND_DATA_CONTRACTS.md](../frontend/FRONTEND_DATA_CONTRACTS.md)).
- Backend starts only after frontend approval ([DEVELOPMENT_ROADMAP.md](../roadmap/DEVELOPMENT_ROADMAP.md) Gate 2–3).
- The mock layer exercises error envelopes (incl. `changed[]`) before the backend exists.