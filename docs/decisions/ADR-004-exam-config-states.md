# ADR-004 — Exam-config states + approval integrity

- **Status**: Accepted
- **Date**: 2026-11-07

## Context

CPNS 2026 SKD rules are not fully verified; presenting a provisional basis as official would be wrong ([CPNS_2026_REGULATIONS.md](../examination/CPNS_2026_REGULATIONS.md) §4.4, UNV-01…08). The user demanded a provisional config must not silently become active.

## Decision

Three config states — `official_verified` / `historical` / `provisional`. A `provisional` config may be scored only with a valid `ProvisionalApproval` binding four values `{configId, configVersion, scoringVersion, regulatoryBasisHash}`. Any mismatch at submit → 409 and the session is stored **unscored**.

## Consequences

- No silent approval drift: changes to config/version/basis/thresholds invalidate and force re-approval ([SCORING_METHODOLOGY.md](../examination/SCORING_METHODOLOGY.md) §11).
- The four bound values are server-computed; the client supplies only `acknowledgedWarnings` ([VALIDATION.md](../backend/VALIDATION.md) §2).
- Distinct error codes carry a bounded `changed[]` structure ([API_SPECIFICATION.md](../backend/API_SPECIFICATION.md) §4.2).