# Business Rules

Canonical list of business rules that do **not** already live in a dedicated spec. Where a rule has
a home spec, this file only points to it — it does not duplicate text (no-doc-duplication rule).
Rule IDs are stable and referenced from [AUDIT.md](../AUDIT.md).

---

## 1. Exam-config & approval (→ [CPNS_2026_REGULATIONS](../examination/CPNS_2026_REGULATIONS.md))

- **BR-E1 — pathway separation.** A `SEKOLAH_KEDINASAN` basis is never cited as CPNS authority
  (regulations §8). §8 also anchors the Sekolah path.
- **BR-E2 — provisional gating.** A `provisional` config cannot become active or be offered for
  scoring without a valid `ProvisionalApproval` (regulations §4.3).
- **BR-E3 — approval integrity.** The four bound values `{configId, configVersion, scoringVersion,
  regulatoryBasisHash}` must all match at submit; any mismatch → 409, stored unscored
  (scoring §11).
- **BR-E4 — no invented 2026 instrument.** Where no CPNS-2026 SKD instrument is verified, shipped
  configs are `historical`/`provisional`, never `official_verified`
  (regulations §4.4, UNV-01…08).

## 2. Scoring (→ [SCORING_METHODOLOGY](../examination/SCORING_METHODOLOGY.md))

- **BR-S1 — deterministic pure function.** `scoreSession` over (answers, frozen snapshot,
  scoringVersion); integers only; no clocks/network (§8).
- **BR-S2 — `correct` semantics.** TWK/TIU `true|false|null(null=unanswered)`; TKP `null`, no
  "correct" option, attainment = `earned/possible` (§4).
- **BR-S3 — ordered preflight.** PF-00…PF-13 before SC-01…SC-08, ordered so no check throws on
  already-rejected input (§6.3).

## 3. Questions (→ [QUESTION_SPECIFICATION](../examination/QUESTION_SPECIFICATION.md))

- **BR-Q1 — provenance on arrival.** Any created question carries `Provenance` (source, model,
  provider, generation info) (§2).
- **BR-Q2 — validation gates.** `draft`→`active` requires V-01…V-12 (and SC-01…SC-08 for scoring
  consistency) to pass (§5).
- **BR-Q3 — lifetime.** `draft`/`active`/`archived` with legal transitions only (§3).

## 4. AI (→ [AI_PROVIDER_ARCHITECTURE](../ai/AI_PROVIDER_ARCHITECTURE.md))

- **BR-A1 — write-only keys.** Store by reference, display masked tail, never in logs/responses
  (§3, FR-C6).
- **BR-A2 — non-AI degrades.** All non-AI flows work with no provider configured (§4, FR-C7).
- **BR-A3 — no secret echo.** Provider errors never echo the auth header/key
  ([SECURITY](../architecture/SECURITY.md) §3).

## 5. Analytics & recommendations (→ [ANALYTICS_ENGINE](../backend/ANALYTICS_ENGINE.md),
[RECOMMENDATION_ENGINE](../ai/RECOMMENDATION_ENGINE.md))

- **BR-L1 — evidence, not adjectives.** Weakness claims must carry numeric justification from
  analytics (recommendation §3).
- **BR-L2 — reportable only.** Below-minimum-sample cells are `insufficient_data`, never stated as
  weaknesses or "zero" (analytics §3.2, recommendation §2).

---

## Cross-cutting

- **BR-X1 — no doc duplication.** A rule lives in exactly one canonical doc; here only points.
- **BR-X2 — frontend reads, backend computes.** The frontend renders backend-contract data and
  never recomputes scores/metrics ([FRONTEND_DATA_CONTRACTS](../frontend/FRONTEND_DATA_CONTRACTS.md)).

Changes to any of these rules are catalogued with the audit register, not silently edited.