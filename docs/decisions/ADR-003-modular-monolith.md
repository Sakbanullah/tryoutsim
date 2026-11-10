# ADR-003 — Modular monolith

- **Status**: Accepted
- **Date**: 2026-11-07

## Context

The app has distinct domains (scoring, questions, analytics, AI, recommendations) but one user and one machine. Splitting into services buys resilience/scale this app never needs while adding IPC, deployment, and secret-spread cost.

## Decision

One backend process, **modular monolith**: modules separated by folder and interface, not by network. One process, one local PostgreSQL 18 database ([ADR-002](ADR-002-sqlite.md)). See [SYSTEM_ARCHITECTURE.md](../architecture/SYSTEM_ARCHITECTURE.md) §2–3.

## Consequences

- Simple deployment and one local process; endpoint surface stays behind one API.
- Module seams are enforced by discipline (interface) not runtime (no network), matching the single-user scale.
- If multi-user/scale ever appears, boundaries are drawn so a later split is possible — but not done now (YAGNI).