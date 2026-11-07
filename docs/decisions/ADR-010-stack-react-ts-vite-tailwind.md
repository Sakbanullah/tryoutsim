# ADR-010 — React + TypeScript + Vite + Tailwind

- **Status**: Proposed (not yet ratified)
- **Date**: 2026-11-07

## Context

The frontend stack is the current leading candidate selected earlier. It is **not yet a mandate**: the frontend gateway approves it, not this record.

## Decision

Candidate stack: React + TypeScript, Vite build, Tailwind for styling. It becomes `Accepted` only when the frontend implementation gate opens ([DEVELOPMENT_ROADMAP.md](../roadmap/DEVELOPMENT_ROADMAP.md) Gate 2).

## Consequences

- Design/frontend docs are written in that idiom but keep the contract (data shapes, routes, tokens) framework-agnostic so the choice is revisable at gate time.
- No dependency from this candidate is installed or added before ratification (ADR-008).
- See [FRONTEND_IMPLEMENTATION_PLAN.md](../frontend/FRONTEND_IMPLEMENTATION_PLAN.md) §3 for fixed-vs-chosen split.