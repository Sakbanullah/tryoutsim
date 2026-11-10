# Business Rules

Canonical list of business rules that do **not** already live in a dedicated spec. Where a rule has
a home spec, this file only points to it — it does not duplicate text (no-doc-duplication rule).
Rule IDs are stable and referenced from [AUDIT.md](../AUDIT.md). Existing IDs keep their meaning; a
changed rule keeps its ID and states what changed.

---

## 1. Exam-config & approval (→ [CPNS_2026_REGULATIONS](../examination/CPNS_2026_REGULATIONS.md))

- **BR-E1 — pathway separation.** A `SEKOLAH_KEDINASAN` basis is never cited as CPNS authority
  (regulations §8). **Revised 2026-11-08:** the product offers the CPNS pathway only; the Sekolah
  Kedinasan config is a retained evidence/replay record with `dataProvenance: 'legacy'` and is never
  offered (regulations §4.4, §8 rule 7).
- **BR-E2 — startable vs verdict.** A `provisional` config may be started and scored without an approval;
  a **threshold verdict** requires a valid `ProvisionalApproval`. Without one the result carries no
  verdict and says no passing threshold is verified for CPNS 2026 (regulations §4.2, scoring §5.6).
  *(Supersedes the earlier "cannot be offered for scoring without approval".)*
- **BR-E3 — approval integrity.** The four bound values `{configId, configVersion, scoringVersion,
  regulatoryBasisHash}` must all match at submit; any mismatch withholds the **verdict** and keeps the
  **score** (scoring §11). *(Supersedes "409, stored unscored".)*
- **BR-E4 — no invented 2026 instrument.** Where no CPNS-2026 SKD instrument is verified, shipped
  configs are `historical`/`provisional`, never `official_verified` (regulations §4.4, UNV-01…08).
- **BR-E5 — latest config is bound server-side.** A new session binds the newest usable CPNS config
  version; the learner never selects one (regulations §4.2, [PACKAGE_SPECIFICATION](../product/PACKAGE_SPECIFICATION.md) §3).

## 2. Scoring (→ [SCORING_METHODOLOGY](../examination/SCORING_METHODOLOGY.md))

- **BR-S1 — deterministic pure function.** `scoreSession` over (answers, frozen snapshot,
  scoringVersion); integers only; no clocks/network (§8).
- **BR-S2 — `correct` semantics.** TWK/TIU `true|false|null(null=unanswered)`; TKP `null`, no
  "correct" option, attainment = `earned/possible` (§4).
- **BR-S3 — ordered preflight.** PF-00…PF-13 before SC-01…SC-08, ordered so no check throws on
  already-rejected input (§6.3).
- **BR-S4 — blank is never credit.** Unanswered scores `unansweredScore` (= 0 for every shipped config)
  and is excluded from the accuracy denominator (§3.3, §1 invariant 11).
- **BR-S5 — score and verdict are separate.** A session is always scored; `passed` exists only with
  thresholds and a valid approval (§5.6). A missing verdict is never rendered as "belum lulus".
- **BR-S6 — active time is the duration.** A session's elapsed time is accumulated active time; leaving
  pauses, returning resumes, expiry is evaluated on resume (§8.1).

## 3. Questions (→ [QUESTION_SPECIFICATION](../examination/QUESTION_SPECIFICATION.md))

- **BR-Q1 — provenance on arrival.** Any created question carries `Provenance` (origin, provider,
  model, prompt + version, generation id, **batch id**, timestamps) (§2).
- **BR-Q2 — validation gates.** Reaching `active` requires `human_reviewed` first,
  `answerKeyValidatedAt` set, the latest T (V-01…V-13) run passing against the current `contentHash`,
  **and** the provenance's sampling gate satisfied when the question came from an AI batch (§3.3, §6.3).
- **BR-Q3 — lifetime.** Seven states — `draft` → `ai_validated` → `human_reviewed` → `active` →
  `archived`, plus `quarantined` and `rejected` — with only the transitions in §3. A direct
  `draft`→`active`, `ai_validated`→`active` or `quarantined`→`active` is not a legal transition.
- **BR-Q4 — `active` is not `eligible`.** Selection additionally requires `dynamicEligible = true`
  ([PACKAGE_SPECIFICATION](../product/PACKAGE_SPECIFICATION.md) §4.1).
- **BR-Q5 — no import, no bulk edit.** Manual entry is one question at a time; CSV/Excel import and bulk
  editing are out of MVP scope (MVP_SCOPE §3).
- **BR-Q6 — sampling is not a guarantee.** The app states what was sampled and keeps the report and
  withdrawal path open after publication (§6.5).
- **BR-Q7 — history is retention, not deletion.** Question versions, validation records and review
  entries are never deleted (§7.2).

## 4. AI (→ [AI_PROVIDER_ARCHITECTURE](../ai/AI_PROVIDER_ARCHITECTURE.md))

- **BR-A1 — write-only keys.** Stored in OS secure storage by reference, displayed as a masked tail,
  never in logs/responses/bundles (§3, FR-C6, [SECRETS](./SECRETS.md) §2).
- **BR-A2 — non-AI degrades.** All non-AI flows work with no provider configured, unreachable provider
  or expired key (§4, FR-C7).
- **BR-A3 — no secret echo.** Provider errors never echo the auth header/key
  ([SECURITY](../architecture/SECURITY.md) §3).
- **BR-A4 — no automatic fallback.** A failed provider/model is reported; retry stays on the same pair
  until the user changes the routing (§7).
- **BR-A5 — no token/cost reporting.** Usage may be read and is discarded; no token or cost figure is
  stored or shown, for any feature or job (§9).

## 5. Analytics & recommendations (→ [ANALYTICS_ENGINE](../backend/ANALYTICS_ENGINE.md),
[RECOMMENDATION_ENGINE](../ai/RECOMMENDATION_ENGINE.md))

- **BR-L1 — evidence, not adjectives.** Weakness claims must carry numeric justification from
  analytics (recommendation §3).
- **BR-L2 — reportable only.** Below-minimum-sample cells are `insufficient_data`, never stated as
  weaknesses or "zero" (analytics §3.2, recommendation §2).
- **BR-L3 — AI orders, never invents.** The weakness set is closed deterministically before any model
  call; AI may order the study sequence and write explanation text only (recommendation §2.1, §6).
- **BR-L4 — deletion is explicit and explained.** A session leaves analytics only by a user delete, which
  states its consequences and leaves a content-free tombstone
  ([ANALYTICS_ENGINE](./ANALYTICS_ENGINE.md) §7). A tombstone is **not** a permanent purge, and no purge
  exists until the Product Owner approves one. Hiding and deleting are different operations and never
  share a label.

## 6. Jobs & notifications (→ [GENERATION_JOBS](./GENERATION_JOBS.md),
[NOTIFICATION_SPECIFICATION](./NOTIFICATION_SPECIFICATION.md))

- **BR-J1 — server-owned execution.** A job continues when the browser closes; outcomes arrive in the
  in-app notification centre.
- **BR-J2 — no OS notifications.** No Windows toast, no permission request.
- **BR-J3 — restart is survived meaningfully.** Safe work resumes; unsafe in-flight work becomes
  `interrupted` with a retry action; partial results are kept; no duplicate questions (jobs §5).

## 7. Material (→ [MATERIAL_SPECIFICATION](../examination/MATERIAL_SPECIFICATION.md))

- **BR-M1 — draft until approved.** AI-drafted material is not recommendable until the user approves a
  specific version (§5).
- **BR-M2 — sourced where it asserts facts.** Factual/legal/historical/policy material needs a verifiable
  source; an unverified source is labelled and never presented as official (§4).
- **BR-M3 — unmapped material is inert.** A free note never affects competency analytics (§2).

## 8. Deployment & data (→ [DEPLOYMENT_AND_BACKUP](../architecture/DEPLOYMENT_AND_BACKUP.md))

- **BR-D1 — local only.** Loopback bind, one machine, no cloud storage of app data (§1).
- **BR-D2 — one-command start.** Backend ready before the browser opens; clean shutdown (§1.2–§1.3).
- **BR-D3 — failed backup is not success.** Unverified or unwritable destination → failed run with a
  notification (§2.2).
- **BR-D4 — keys never travel.** Backups exclude keys; a restore asks for re-entry (§2.1, SECRETS §2).
- **BR-D5 — no deletion of historical records by a migration.** Additive-first; a destructive step needs
  a documented recovery path ([MIGRATION_STRATEGY](./MIGRATION_STRATEGY.md) §1–§2).

---

## Cross-cutting

- **BR-X1 — no doc duplication.** A rule lives in exactly one canonical doc; here only points.
- **BR-X2 — frontend reads, backend computes.** The frontend renders backend-contract data and
  never recomputes scores/metrics ([FRONTEND_DATA_CONTRACTS](../frontend/FRONTEND_DATA_CONTRACTS.md)).

Changes to any of these rules are catalogued with the audit register, not silently edited.
