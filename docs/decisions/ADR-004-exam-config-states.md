# ADR-004 — Exam-config states + approval integrity

- **Status**: Accepted
- **Date**: 2026-11-07

## Context

CPNS 2026 SKD rules are not fully verified; presenting a provisional basis as official would be wrong ([CPNS_2026_REGULATIONS.md](../examination/CPNS_2026_REGULATIONS.md) §4.4, UNV-01…08). The user demanded a provisional config must not silently become active.

## Decision

Three config states — `official_verified` / `historical` / `provisional`. A `provisional` config is **startable and scorable**; a threshold **verdict** additionally requires a valid `ProvisionalApproval` binding four values `{configId, configVersion, scoringVersion, regulatoryBasisHash}`. Any mismatch withholds the verdict (`verdict: null`) while the score is still written.

## Consequences

- No silent approval drift: changes to config/version/basis/thresholds invalidate the approval and withhold the verdict ([SCORING_METHODOLOGY.md](../examination/SCORING_METHODOLOGY.md) §11).
- The one canonical approval definition — fields, meaning, authorizer, timestamp semantics,
  invalidation, re-approval, persistence — is [CPNS_2026_REGULATIONS.md](../examination/CPNS_2026_REGULATIONS.md) §4.3.
- The four bound values are server-computed; the client supplies only `configId` +
  `acknowledgedWarnings` via `POST /exam-configs/:id/approval` ([VALIDATION.md](../backend/VALIDATION.md) §2).
  `approvedByUserAt`/`approvedBy` are recorded evidence, not bound values.
- Distinct error codes carry a bounded `changed[]` structure ([API_SPECIFICATION.md](../backend/API_SPECIFICATION.md) §4.2).