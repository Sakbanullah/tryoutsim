# Schema Contract & Migration Workflow Review

Pre-implementation technical review for the Prisma ORM 7 data layer. **Status: review only.** No backend
code, Prisma schema, migration, database, role, credential or installation exists because of this document,
and none may be created until the Product Owner opens Gate 3 and authorises backend work.

- **Date**: 2026-11-10 (round 2 — five PO directives evaluated)
- **Decisions reviewed as fixed** (Product Owner): PostgreSQL 18 · Prisma ORM 7.10.1 · Node.js 24 ·
  `node:http` · `node:test` ([ADR-002](../decisions/ADR-002-sqlite.md), [ADR-008](../decisions/ADR-008-dependency-minimalism.md),
  [ADR-011](../decisions/ADR-011-orm-selection.md)) · migration role separate from runtime · app role without
  `CREATEDB` · partial indexes as custom SQL · DB-4 as FK `RESTRICT` + trigger · constraint inventory in
  `DATABASE_SCHEMA.md`.
- **Canonical sources this review reads, and does not restate**: [DATABASE_SCHEMA](./DATABASE_SCHEMA.md),
  [MIGRATION_STRATEGY](./MIGRATION_STRATEGY.md), [DEPLOYMENT_AND_BACKUP](../architecture/DEPLOYMENT_AND_BACKUP.md) §1.5,
  [ADR-011](../decisions/ADR-011-orm-selection.md) §6–§7.
- **Method**: four independent read-only reviews (immutability-trigger security; role design; Prisma v7
  Migrate documentation audit; constraint inventory), each against the canonical docs, then merged here with
  the disagreements resolved and flagged. Findings recorded as AUD-83.
- **What this document is for**: the concrete answers ADR-011 §7 leaves open. When Gate 3 opens its content
  is promoted into the canonical docs and this file becomes a pointer or is retired.

---

## 0. Summary

| Finding | Severity | Where |
|---|---|---|
| **The custom-GUC escape hatch proposed in round 1 is abusable and is withdrawn.** `tryoutsim.*` is a placeholder GUC: any role can set it in its own session, so the runtime role could unlock its own immutability guard. Replaced by least privilege + a `SECURITY DEFINER` delete function. | **high** | §1.3 |
| **A migration file on Prisma CLI 7 is NOT atomic.** v7 contains no atomicity statement; its patching page documents partial execution. The only "roll back every failed apply" text is ORM 8. Every migration must be written to be re-runnable. | **high** | §2.5 |
| **Custom objects under `migrate dev` drift detection are UNVERIFIED.** Round 1 asserted "never drift"; the v7 docs never say. This decides whether the custom-SQL approach meets a reset prompt on every dev run. | **high** | §2.4 |
| No constraint inventory existed anywhere. A full one is now proposed for `DATABASE_SCHEMA.md` — and it corrected two round-1 errors: a `pathway IN ('CPNS','SEKOLAH_KEDINASAN')` CHECK contradicts the CPNS-only rule, and a restore with `session_replication_role=replica` silently disables non-`ALWAYS` triggers. | **high** | §1.11 |
| The app role must own nothing and hold no `CREATEDB`; the migrator holds `CREATEDB` for the shadow DB. `DEPLOYMENT_AND_BACKUP` §1.5 and `MIGRATION_STRATEGY` §7 still describe the old single-role, app-owns-DB model — contradicting the directives, so corrected here and flagged for doc edit. | medium | §2.6, §6.4 |
| `session.deletedAt` is never observable: the same transaction that writes it deletes the row. Needs a PO decision to redefine or drop. | medium | §1.3, §5.5 |
| `session_deletion` was listed as append-only in round 1 but had no guard; now T-8. `answer_sheet` is content-bearing, so privilege — not only the trigger — must restrict it. | medium | §1.7 |
| ADR-011 §4.2's pool table was wrong (one `connectionTimeoutMillis` covers acquire *and* connect; the default is no timeout). | low | §3.2, §6.4 |
| `migrate dev --skip-generate` was **removed** in v7; `migrate dev` no longer generates or seeds. | low | §2.1 |

Directives 1–5 are addressed; three blockers are closed by them, four remain open (§5.0). No finding
reverses a prior Product Owner decision, and no recommendation here is presented as a new decision —
§5.5 lists what still needs PO.

---

## 1. Custom-SQL inventory

### 1.1 How the requirement is derived

There is **no list of constraint objects** anywhere in the repository. `DATABASE_SCHEMA.md` is a data
model (its own words: "not DDL"), so it states column semantics, closed sets and append-only *intent*, but
never says `CHECK (...)`. [validation/AUDIT_FINDINGS_RESOLUTION](../audit/AUDIT_FINDINGS_RESOLUTION.md)
records DB-4 and DB-6 as guarantees. Until Gate 3 writes them down, the exact constraint set does not
exist as a reviewable artefact.

That is the single largest risk in this area, and it is a **schema-source** risk, not a Prisma risk:
whatever Prisma cannot express is indistinguishable from what has not been specified yet.

**Plan:** at Gate 3, before any model is written, produce the constraint object list from these sources
below and record it as a new section of `DATABASE_SCHEMA.md`. Prisma models then implement it. The list
below is the starting inventory, marked by **confidence**.

### 1.2 What Prisma 7 can and cannot express

Verified against prisma.io org docs, retrieved 2026-11-10 (§6.2):

| Object | Prisma 7 | Mechanism |
|---|---|---|
| PK, FK, referential action | yes | `@id`, `@relation(onDelete:, onUpdate:)` |
| Unique, composite unique | yes | `@unique`, `@@unique` |
| Plain index, index sort order | yes | `@@index` |
| Partial index | **yes, behind `partialIndexes` preview flag** | `where:` argument on `@unique`/`@@unique`/`@@index` |
| Non-default index method (GIN, BRIN, GiST, HNSW) | **no** | custom SQL |
| `CHECK` constraint | **no — no `@@check` attribute in Prisma 7** | custom SQL |
| Exclusion constraint (`EXCLUDE USING`) | **no** | custom SQL |
| Trigger / trigger function | **no** ("Triggers … cannot be represented") | custom SQL |
| View | **no**, unless the `views` config + `externalTables` path is used | custom SQL |
| Extension (`pgcrypto`, `btree_gist`) | yes, via `postgresqlExtensions` | `extensions = [...]` in datasource |
| `CREATE INDEX CONCURRENTLY` | **no** in a migration transaction | custom SQL, only outside a transaction — and a single-user local app never needs it |

### 1.3 Append-only / immutability triggers

**Source of truth:** DATABASE_SCHEMA table headings — `provisional_approval` (l.81), `question_version`
(l.124), `question_report` (l.136), `validation_record` (l.154), `question_review` (l.167),
`session_snapshot` (l.237), `session_deletion` (l.255), `score_result` (l.283), `material_version`
(append-only per l.433), `package_version` (immutable per l.394). Guarantee text:
[SCORING_METHODOLOGY](../examination/SCORING_METHODOLOGY.md) §7, §7.2.

**Finding — the guard cannot be blanket.** Two operations that the documents require are updates or
deletes on "append-only" tables:

| Table | Documented operation that writes | Conflict |
|---|---|---|
| `session` | `deletedAt` "soft marker written only inside the delete transaction" (l.210) | `UPDATE` on a session row. `session` is *not* append-only, so this is fine — but any "no session update" rule would break it. |
| `session_snapshot`, `answer_sheet`, `score_result` | `DELETE /sessions/:id` removes "the session, its snapshot, its answers and its result in one transaction" (l.233, DB-6) | `DELETE` on three append-only tables. A `BEFORE DELETE` trigger that always raises **breaks DB-6**. |
| `observed_question_history` | "rebuilt on demand" (l.404) | a full `DELETE`/re-insert cycle on a derived table. If somebody marks it append-only by mistake, the rebuild stops working. |

#### Rejected: custom-GUC escape hatch

The earlier sketch in this section let the trigger allow `UPDATE`/`DELETE` whenever
`current_setting('tryoutsim.session_delete', true) = 'on'`, set with `SET LOCAL` as the first statement of
an interactive transaction. **This is abusable and is withdrawn.**

`tryoutsim.session_delete` is a *placeholder* GUC (two-part name, non-`pg_` prefix). PostgreSQL creates it
implicitly on first `SET`, it belongs to no role, and it carries no ACL. Any role may set it in its own
session. A runtime role holding `DELETE` on `session_snapshot` can therefore open its own transaction, set
the flag, delete, and commit — the trigger's guard is satisfied by the caller's own setting. `ALTER ROLE …
SET` and `ALTER DATABASE … SET` only change the *default* for new sessions; the role can still override it.
No PostgreSQL mechanism makes a user-defined placeholder GUC unsettable by an ordinary role.

The accompanying claim ("`delete /sessions/:id` must be an interactive transaction, never a batch array")
was correct on its own but moot: the flag was never the thing protecting the data.

#### Accepted: least privilege + a `SECURITY DEFINER` delete function

The only mechanism that cannot be turned on by the runtime role is a **privilege**. The design:

1. The append-only triggers raise **unconditionally** — no flag, no escape hatch, no `ALWAYS` exception.
   `session_snapshot` and `score_result` block `UPDATE` always and `DELETE` always (for the app).
2. The runtime role is **not granted** `UPDATE`/`DELETE` on `session`, `session_snapshot`, `answer_sheet`,
   `score_result` or `session_deletion` at all. This, not the trigger, is what closes the hole: GRANT is
   enforced before the trigger runs.
3. The one delete path is a `SECURITY DEFINER` function owned by the migration role, executable by the app:

```sql
-- sketch only; NOT executed, NOT reviewed by database-reviewer yet
CREATE FUNCTION tryoutsim.delete_session(p_session_id text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public            -- pin: never trust the caller's search_path
AS $$
DECLARE s public.session%ROWTYPE;
BEGIN
  SELECT * INTO s FROM public.session WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;       -- 404
  INSERT INTO public.session_deletion (…) VALUES (…, 'user_delete');   -- tombstone first
  UPDATE public.session SET "deletedAt" = now() WHERE id = p_session_id;
  DELETE FROM public.answer_sheet     WHERE "sessionId" = p_session_id;
  DELETE FROM public.score_result     WHERE "sessionId" = p_session_id;
  DELETE FROM public.session_snapshot WHERE "sessionId" = p_session_id;
  DELETE FROM public.session          WHERE id = p_session_id;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION tryoutsim.delete_session(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tryoutsim.delete_session(text) TO tryoutsim_app;
```

Called from the backend as one statement — `$executeRaw\`SELECT tryoutsim.delete_session(${id})\`` — so
atomicity is the function body's, not Prisma's, and DB-6 holds by construction. Ordering inside the body is
tombstone → soft marker → children → parent; FK `ON DELETE RESTRICT` from children to `session` makes a
wrong order fail loudly rather than silently orphan.

**Accepted: reject the GUC hatch; adopt the function.** Conditions on the function, all mandatory:

- `SET search_path` pinned and every name schema-qualified (a hijacked `search_path` is the classic
  `SECURITY DEFINER` escalation).
- No dynamic SQL; parameters bound, never interpolated. `RAISE` must not echo ids or row content.
- Returns `boolean` instead of throwing on a missing/absent session, so detail does not leak into a 500.
- The defining owner must **not** be a superuser and must not own the database — only these tables (see §2.7).
- Trigger functions get `REVOKE EXECUTE … FROM PUBLIC` (PostgreSQL grants `EXECUTE` to `PUBLIC` by default)
  and are never granted to the app.
- Triggers are created `ENABLE ALWAYS` so a restored dump that sets `session_replication_role=replica`
  cannot skip them.

**Bulk delete** (`POST /sessions/bulk-delete`) calls the function per id inside one interactive Prisma
transaction, or the contract must say it is per-session atomic. **Open contract item** — §5.6.

**`deletedAt` inconsistency, flagged not fixed:** `DATABASE_SCHEMA` l.210 calls `deletedAt` a soft marker
written inside the delete transaction, but the same transaction then deletes the row, so the marker is
never observable. Either redefine it as an in-transaction guard only, or drop it and let `session_deletion`
be the sole record. Both are schema changes needing the Product Owner.

**`observed_question_history` is derived, never immutable.** It is rebuilt on demand (l.404), so it gets no
append-only trigger and keeps normal DML. Naming it here stops a later implementer from "protecting" it.

**`answer_sheet` is not append-only** (it is patched while the session is open) but it *is* content-bearing,
so it also loses app `UPDATE`/`DELETE` through the role split (§2.7) and is written only by the app's normal
answer autosave path, which keeps `INSERT`/`UPDATE` while the session is open. Whether the app keeps direct
`UPDATE` on `answer_sheet` or it too becomes a function call is a Gate-3 design item.

**`session_deletion` needs a guard** (this section previously omitted it): append-only, tombstone written
only by the delete function, app granted `SELECT` only.

**Full trigger set** is in §1.7 (T-1 … T-13) with the per-table block/allow rule and its test.

**No trigger on `question`, `exam_config`, `provider`, `notification`, `backup_record`, `generation_job`,
`generation_batch`, `package`, `material`** — these legitimately update, and their history constraints, if
any, are business rules (§ `question_version` versions the content, not the row).

**Ordering and drift:** one trigger function created once (custom-SQL migration), one `CREATE TRIGGER` per
table (could be in the same migration or a later one). If a later table is added to the append-only set,
that is a *new* migration that adds a trigger, never an edit to an applied one (`_prisma_migrations`
checksum rejects an edited applied file).

### 1.4 DB-4 conditional cascade

**Source of truth:** DATABASE_SCHEMA l.325–338 — create order, delete order, and the `CASCADE`/`RESTRICT`
rule keyed on `generation_job.status`. The rule is **prose only**; no FK declares it.

**Finding:** PostgreSQL cannot express a data-dependent referential action. There are three candidate
shapes, none decided:

1. `generation_job.providerId` FK is `ON DELETE RESTRICT`; a `BEFORE DELETE ON provider` trigger deletes
   the finished jobs itself and lets `RESTRICT` reject the rest. One trigger, one FK, no application
   logic. **Preferred** — it keeps the guarantee in the database, and `RESTRICT` gives a `23503` that the
   endpoint maps to `409 CONFLICT`, exactly as l.336–337 says.
2. Two partial FKs — impossible in PostgreSQL without a very unusual constraint trigger; rejected.
3. Application-side: delete finished jobs first, then the provider, relying on `RESTRICT` for the rest.
   Keeps DB-4 partially outside the database; rejected for the same reason §1.3 is inside it.

**Recommendation:** shape 1, decided at Gate 3 with `database-reviewer` on the SQL. It also means the
"one transaction that also cascades" phrasing on l.332 is implemented as *one transaction that calls the
trigger*, which is a wording change to DATABASE_SCHEMA l.332 that Gate 3 must make.

**PO directive (2026-11-10):** the FK `RESTRICT` + trigger shape is directed; the final design still goes
through database review. Notes for that review:

- The trigger runs as the **table owner** (not `SECURITY DEFINER`), so it is not caller-controlled.
- It cannot be skipped by a role with only `DELETE` on `provider`; the app needs that grant because provider
  deletion is a user action, so the trigger is the enforcement point and must be `ENABLE ALWAYS`.
- `ON DELETE CASCADE` on `generation_batch.jobId` and `secret_ref.providerId` interacts: deleting finished
  jobs in the trigger cascades to their batches and secret refs automatically. The OS key is **not** purged
  by SQL; the app must purge it (DB-4 ordering).
- It must delete only `status IN ('completed','failed','interrupted')`; anything queued or running is left
  for `RESTRICT` to reject with `23503` → `409`.

**Adjacent referential actions the same review must confirm** (they were not in the earlier list): all
`exam_config`-referencing FKs are `RESTRICT` (configs are never deleted, l.325–338); `session.packageId,
packageVersion` is a composite FK to `package_version` `RESTRICT`; `answer_sheet.questionId` and
`question.competencyId` are `RESTRICT`; `ai_routing.defaultProviderId` is `SET NULL`.

### 1.5 `CHECK` constraint inventory

**Superseded by §1.12** (the full inventory). The earlier hand-derived list here contained errors — e.g. a
`pathway IN ('CPNS','SEKOLAH_KEDINASAN')` entry, which contradicts `DATABASE_SCHEMA` l.42: a retained
legacy `SEKOLAH_KEDINASAN` config is `dataProvenance='legacy'` and must never be offered, and AGENTS.md
constraint 2 makes the product CPNS-only. Any such constraining CHECK would either be wrong or would lock in
a value set the doc does not state. See §1.11 for the corrected rows and §1.12 for what is deliberately not
a DB constraint.

### 1.6 Cross-column and cross-table checks

`thresholds` present-ness per `mode` and the `<= maxScore` ceiling need the *config's* value. A `CHECK`
cannot read another table (a function in a `CHECK` is possible but dangerous: it is evaluated on every
write and is not captured in the schema diff). This must stay where
[SCORING_METHODOLOGY](../examination/SCORING_METHODOLOGY.md) §5.1/§5.3 already puts it: validation in the
scoring function, with the **config being frozen into the snapshot before scoring** (§7). The DB `CHECK`
should carry only the cheap intra-row part (`twk BETWEEN 0 AND 550`), never the cross-table part.

**This is a deliberate non-goal:** the DB does not re-implement scoring validation. Naming it here stops a
later implementer from "adding the missing check" and duplicating scoring rules.

### 1.7 Trigger set

Two trigger functions: `tryoutsim_fn_block_mutation()` (raises on `UPDATE OR DELETE OR TRUNCATE`) and, where
a column-level exception is needed, a per-table `WHEN` clause rather than a second function. All created
`ENABLE ALWAYS`. Covers the PO decision and closes the gap where §1.3 previously listed `session_deletion`
as a source of truth but gave it no guard.

| id | Table | App may | App may not | Test |
|---|---|---|---|---|
| T-1 | `provisional_approval` | INSERT | UPDATE, DELETE, TRUNCATE | UPDATE `approvedBy` → `23001` (`restrict_violation`) |
| T-2 | `question_version` | INSERT | UPDATE, DELETE, TRUNCATE | UPDATE `stem` → `23001` |
| T-3 | `question_report` | INSERT; UPDATE `resolution`,`resolvedAt` once (NULL→value) | UPDATE content columns; DELETE; TRUNCATE | `rejected`→`repaired` → `23001`; setting resolution once → ok |
| T-4 | `validation_record` | INSERT | UPDATE, DELETE, TRUNCATE | UPDATE `result` → `23001` |
| T-5 | `question_review` | INSERT | UPDATE, DELETE, TRUNCATE | DELETE → `23001` |
| T-6 | `session_snapshot` | INSERT | UPDATE, DELETE, TRUNCATE — **executed only via `tryoutsim.delete_session`** | as `tryoutsim_app`, `DELETE …` → `42501` (privilege, not trigger) |
| T-7 | `score_result` | INSERT | UPDATE, DELETE, TRUNCATE — deleted only via the delete function | `UPDATE …` as app → `42501`; re-score path must replace the row through a function or a permitted transaction (open, §5.6) |
| T-8 | `session_deletion` | INSERT (via the delete function only) | UPDATE, DELETE, TRUNCATE | `DELETE` as app → `42501`; even as owner a trigger raises `23001` |
| T-9 | `package_version` | INSERT | UPDATE, DELETE, TRUNCATE | UPDATE `definitionJson` → `23001` |
| T-10 | `material_version` | INSERT | UPDATE, DELETE, TRUNCATE | UPDATE `bodyJson` → `23001` |
| T-11 | `session` | INSERT, UPDATE while `open` (clock, `deletedAt`), status transition | reset `submittedAt`→NULL; `submitted`→`open` | state-machine assertion |
| T-12 | `answer_sheet` | INSERT/UPDATE while parent `session.status='open'`; DELETE only via the delete function | INSERT/UPDATE after submit | write at `submitted` → `23001` |
| T-13 | `thresholds` | INSERT | UPDATE, DELETE once the config version is historical | UPDATE `total` on an old config → `23001` |

**No trigger** on `question`, `exam_config`, `provider`, `notification`, `backup_record`, `generation_job`,
`generation_batch`, `package`, `material`, `observed_question_history`, `ai_routing`, `secret_ref`,
`competency`, `basis_ref` — these legitimately update and their history constraints are version rows or
business rules.

**Privilege is the first line, trigger the second.** GRANT decides before the trigger runs, so the zero-GUC
design stays safe even if a trigger is dropped by a later migration.

### 1.8 Exclusion constraints

**None — no documented invariant needs one.** Every uniqueness rule in the model is single-row or pair-row
and is expressible as `PRIMARY KEY`/`UNIQUE` (one snapshot per session, one result per session, one answer
per (session, question), one thresholds row per config). `EXCLUDE` would also require `btree_gist`, which
[ADR-008](../decisions/ADR-008-dependency-minimalism.md) does not allow without a need. Recorded as an
explicit **not-applicable** row so the inventory in `DATABASE_SCHEMA.md` is complete rather than silent.

### 1.9 Non-B-tree indexes

**None** by the same argument: no column has a documented text-search, JSON-containment or BRIN ordering
need, and all stored JSON is `TEXT` (never queried by containment). Revisit only with a measured query.

### 1.10 Partial indexes

**Product Owner decision: custom SQL migration, not the `partialIndexes` preview feature.** This supersedes
the earlier recommendation in this document. Consequences:

- They live in a `--create-only` migration file: `CREATE INDEX tryoutsim_idx_… ON … WHERE …`.
- Prisma's model view will not see them; the migration file is the record.
- They are **performance objects, not invariants**. Each needs a documented query and a measured reason
  (`EXPLAIN` showing the index used) before it is added.

| id | Table | Documented query | Predicate |
|---|---|---|---|
| P-1 | `question` | selector hot path (package sampling) | `lifecycle='active' AND dynamicEligible=1` |
| P-2 | `generation_job` | restart sweep (GENERATION_JOBS §5) and the DB-4 `RESTRICT` check | `status IN ('queued','running')` |
| P-3 | `session` | analytics scope (ANALYTICS_ENGINE §7.3) | `deletedAt IS NULL AND status='submitted'` |
| P-4 | `question_report` | open-report backlog | `resolution IS NULL` |
| P-5 | `notification` | notification centre, unread | `readAt IS NULL` |

Predicates must be re-checked against `DATABASE_SCHEMA` at Gate 3: a renamed column makes the migration fail
to apply (loud), not a silent bug.

### 1.11 `CHECK` inventory — proposed content for `DATABASE_SCHEMA.md`

Product Owner directive 5: the constraint inventory is recorded in `DATABASE_SCHEMA.md`. This is the
content for that section; it is written **here first** so it can be reviewed, and is not yet in the canonical
doc (writing it there is Gate-3 work). One row per object, columns: object · invariant and source · proposed
implementation · test.

The table is long; it is presented in grouped form, and every row follows the pattern. **Line references
are to `DATABASE_SCHEMA.md`.**

**A. Closed sets (enumerations).** Each is also a TypeScript union in exactly one canonical doc; the check,
the Prisma `enum` and the union must change together in one commit.

| id | Column | Values | Source |
|---|---|---|---|
| C-1 | `exam_config.state` | `official_verified\|historical\|provisional` | l.41 |
| C-2 | `exam_config.dataProvenance` | `seed\|legacy` | l.42 |
| C-3 | `basis_ref.pathway` | `NULL OR 'CPNS'` — **not** two pathways (see below) | l.42, AGENTS.md constraint 2 |
| C-4 | `basis_ref.tier` | 5 evidence tiers + `EVIDENCE-BACKED-NOT-CPNS-2026` | §0 of CPNS_2026_REGULATIONS |
| C-5 | `thresholds.mode` | `per_subtest_and_total\|per_subtest_only\|total_only\|none` | l.69 |
| C-6 | `question.test` | `TWK\|TIU\|TKP` | l.104 |
| C-7 | `question.lifecycle` | 7 values | l.112 |
| C-8 | `question_report.severity` · `category` · `resolution` | 2 / 5 / 3 values | l.144–147 |
| C-9 | `validation_record.result` | `pass\|fail\|flagged` | l.162 |
| C-10 | `question_review.decision` · `activity` | 6 / 5 values | l.175–176 |
| C-11 | `competency.tier` | `EVIDENCE-BACKED-NOT-CPNS-2026\|UNVERIFIED\|DEPRECATED` | l.194 |
| C-12 | `session.mode` · `status` | 2 / 3 values | l.202, l.205 |
| C-13 | `score_result.blockedErrorCode` | 5 codes | l.293 |
| C-14 | `session_deletion.deletionKind` | `'user_delete'` only | l.265 |
| C-15 | `provider.preset` | 4 values | l.306 |
| C-16 | `secret_ref.storeKind` | 3 values | l.314 |
| C-17 | `generation_job.status` | 5 values | l.345 |
| C-18 | `generation_batch.status` | 3 values | l.349 |
| C-19 | `notification.severity` · `type` | 4 values / NOTIFICATION_SPECIFICATION §2 | l.362 |
| C-20 | `backup_record.mode` · `status` | 2 / 2 values | l.374, 376 |
| C-21 | `package.mode` · `source` | 2 / 3 values | l.388 |
| C-22 | `material.contentType` · `status` | 6 / 3 values | l.426, 428 |

**B. Bounds and pairings.**

| id | Constraint | Source |
|---|---|---|
| C-23 | `exam_config.itemCount = twkCount + tiuCount + tkpCount`, all `>= 0` | l.44–45 |
| C-24 | `exam_config.twkWeight IN (0,5) AND tiuWeight IN (0,5)` | l.46 |
| C-25 | `exam_config.tkpWeightMin BETWEEN 1 AND 5 AND tkpWeightMin <= tkpWeightMax` | l.47 |
| C-26 | `exam_config.durationMinutes IS NULL OR > 0`, `maxScore > 0` | l.43, 48 |
| C-27 | `exam_config.scoringVersion > 0 AND configVersion > 0` | l.50–51 |
| C-28 | `thresholds`: presence of `twk/tiu/tkp/total` matches `mode` (four-branch `CHECK`); each value `>= 0` | l.70–71 (SCORING §5.1 is canonical for presence rules) |
| C-29 | `provisional_approval.scoringVersion > 0 AND configVersion > 0` | l.87–88 |
| C-30 | `question.dynamicEligible IN (0,1)`, `question.contentVersion > 0` | l.113, 119 |
| C-31 | `question.lifecycle = 'quarantined'` ⇒ `quarantinedReason` non-empty | l.115 |
| C-32 | `question.difficultyAiInitial IN ('easy','medium','hard')` | l.110 |
| C-33 | `question_report.resolution` and `resolvedAt` null together | l.147–148 |
| C-34 | `competency.parentId <> id` | l.191 |
| C-35 | `session.activeMs >= 0`, `session.durationMs IS NULL OR > 0`, `session.configVersion > 0 AND scoringVersion > 0` | l.201–208 |
| C-36 | `answer_sheet.flagged IN (0,1)`, `answerTimestampMs >= 0`, `elapsedActiveMs >= 0` | l.279–281 |
| C-37 | `session_deletion.questionCount >= 0`; `observed_question_history.answerCount >= 0` | l.263, 402 |
| C-38 | `provider.timeoutMs > 0`; `secret_ref.hasKey IN (0,1)` | l.307, 312 |
| C-39 | `generation_job.count >= 1`, `producedCount >= 0`, `quarantinedCount >= 0`, `partial IN (0,1)` | l.345–347 |
| C-40 | `backup_record.fileSizeBytes >= 0`, `schemaVersion >= 0`; on `status='failed'` both path and size are NULL | l.377–379 |
| C-41 | `package_version.version > 0`; `material.version > 0`; `material_version.version > 0` | l.390, 430, 433 |
| C-42 | `material.status='approved'` ⇒ `approvalVersion` and `approvedAt` both non-null, and null together | l.432 |

**Not a `CHECK` on `exam_config.pathway`.** The earlier draft had
`pathway IN ('CPNS','SEKOLAH_KEDINASAN')`. That is wrong two ways: `DATABASE_SCHEMA` states a retained
`SEKOLAH_KEDINASAN` config is `dataProvenance='legacy'` and never offered, and AGENTS.md constraint 2 makes
the product CPNS-only. `basis_ref.pathway` (C-3) is constrained to `CPNS` because it is the hash input for
CPNS 2026 scoring. If `exam_config` keeps a second value for evidence rows, it needs its own constraint tied
to `dataProvenance`, and that is a **Product Owner** question (§5.6), not an inference here.

**Structural facts the inventory must record:**

- **`_prisma_migrations` is owned by the migration role and is not part of the application schema.** No check
  references it; `DATABASE_SCHEMA.md` should say so explicitly (it already uses a different table name,
  `schema_migrations`, at l.39 — a naming inconsistency to fix).
- **Triggers must be `ENABLE ALWAYS`.** A plain `ENABLE` is disabled by `session_replication_role=replica`,
  which a restore can set. `ENABLE ALWAYS` is the only form that survives it.
- **A table rebuilt by a generated migration can silently lose custom objects.** Prisma's `diff` does not see
  triggers or CHECKs, so a later migration that drops and recreates a table drops them too. `MIGRATION_STRATEGY`
  already forbids destructive changes in review; this is the concrete reason why.
- **Every id/fk column is `TEXT`.** PostgreSQL compares by collation, so `'A'` ≠ `'a'` unless all ids use
  `COLLATE "C"`. Not decided; carried to §5.6.

### 1.12 Deliberately not a DB constraint

| Rule | Why | Where it lives |
|---|---|---|
| `thresholds.* <= exam_config.maxScore` (ceiling) | cross-table; the ceiling constant (`CEILING_POINTS`) is not a column | SCORING_METHODOLOGY §5.3 validation |
| a threshold set on a non-`VERIFIED-2026` basis requires an approval row | cross-table + snapshot | SCORING §5.4/§11 |
| `score_result.verdictJson IS NULL` iff no valid approval | derived from the snapshot | scoring function |
| `blockedErrorCode IS NULL` iff `totalJson` present | derived rank rule | scoring function |
| `session.durationMs` = `snapshot.timing.durationMs` | cross-table into a JSON blob | pre-flight |
| `session.rosterJson` has unique ids | content of a JSON array | pre-flight |
| question lifecycle transitions (`draft→active` only via `human_reviewed`) | a full state machine in a trigger would duplicate QUESTION_SPECIFICATION §3, and the column is documented as a *cache derivable from history* | app + QUESTION_SPECIFICATION |
| `session.status='submitted'` ⇒ a `score_result` row exists | the score write is a separate transaction from the submit | DB-6 transaction / app |
| `basis_ref` rows hash to `regulatoryBasisHash` | sha256 over ordered rows; not a `CHECK` | app |
| retention/purge of `notification` | policy, not a row invariant | backup/retention policy (not yet written) |

Each of these is named so a later implementer does **not** "add the missing check" and duplicate a rule
that has one canonical home.

### 1.13 Grants and default privileges

Prisma cannot express any privilege; `schema.prisma` has no GRANT and `migrate diff` never emits one.
Therefore every grant lives in **provisioning SQL**, not in a migration (a migration cannot run as the
provisioning superuser), and each migration that creates an append-only or session-family table carries a
`REVOKE` that undoes the schema-wide default. Full matrix, defaults and the ordering trap: §2.6.

| id | Object | Rule | Test |
|---|---|---|---|
| G-1 | roles | `tryoutsim_migrator` (CREATEDB), `tryoutsim_app` (NOCREATEDB, NOSUPERUSER) | `rolcreatedb` = false for the app |
| G-2 | schema defaults | SELECT/INSERT/UPDATE/DELETE on tables, USAGE/SELECT on sequences, EXECUTE revoked from PUBLIC | a table created by a new migration is readable by the app |
| G-3 | append-only tables | `SELECT, INSERT` only to the app | `UPDATE provisional_approval` as app → `42501` |
| G-4 | session family | `SELECT, INSERT`; `UPDATE` on app-owned columns only; no `DELETE` | `DELETE FROM session_snapshot` as app → `42501` |
| G-5 | `_prisma_migrations` | `SELECT` only to the app | `migrate status` succeeds; `INSERT` → `42501` |
| G-6 | functions | `REVOKE EXECUTE … FROM PUBLIC`; `EXECUTE` to the app only for `tryoutsim.delete_session` | `has_function_privilege(app, guard_fn, 'EXECUTE')` → false |
| G-7 | TRUNCATE | never granted | `TRUNCATE session` as app → `42501` |
| G-8 | ownership | every object owned by the migrator | `count(*) FROM pg_class WHERE relowner <> 'tryoutsim_migrator'::regrole` → 0 |

**Product Owner decision: custom SQL migration, not the `partialIndexes` preview feature.** This supersedes
the earlier §1.6 recommendation. Consequences:

- They live in a `--create-only` migration file, in the shape `CREATE INDEX tryoutsim_idx_… ON … WHERE …`.
- Prisma's model view will not see them; the migration file is the record.
- They are **performance objects, not invariants**. Each one needs a documented query and a measured
  reason before it is added (`EXPLAIN` showing the index used).

Candidates with a documented query:

| id | Table | Documented query | Predicate |
|---|---|---|---|
| P-1 | `question` | selector hot path (package sampling) | `lifecycle='active' AND dynamicEligible=1` |
| P-2 | `generation_job` | restart sweep (§5 of GENERATION_JOBS) and DB-4 RESTRICT check | `status IN ('queued','running')` |
| P-3 | `session` | analytics scope (ANALYTICS_ENGINE §7.3), grouped by config triple | `deletedAt IS NULL AND status='submitted'` |
| P-4 | `question_report` | open-report backlog | `resolution IS NULL` |
| P-5 | `notification` | notification centre, unread | `readAt IS NULL` |

Any predicate must be re-checked against `DATABASE_SCHEMA` at Gate 3 — an index name or predicate that
drifts from the column names is a migration that fails to apply, not a silent bug.

---

## 2. Migration workflow, verified

Every statement below was checked against the Prisma **v7** docs on 2026-11-10. The docs index contains
both v7 and ORM 8 material, so each claim names its version; ORM 8 statements are labelled and never applied
to v7.

### 2.1 `migrate dev` (development only)

Documented steps (prisma.io/docs/orm/v7/prisma-migrate/understanding-prisma-migrate/shadow-database,
CLI v7 `migrate dev`):

> "1. Reruns the existing migration history in the shadow database to detect schema drift 2. Applies pending
> migrations… 3. Generates a new migration… 4. Applies all unapplied migrations"

- Shadow database: **used**, created and dropped automatically per run.
- Drift → **prompt to reset (drop and recreate) the database**; the same prompt appears with `--create-only`.
- `--skip-generate` was **removed in v7** (upgrade guide). `migrate dev` no longer triggers `prisma generate`
  or seed scripts.
- A **migration history conflict** (filesystem migrations folder vs `_prisma_migrations`) also prompts a reset.

**Doc warning:** "Do not use the exact same values for `url` and `shadowDatabaseUrl` as that might delete
all the data in your database."

**Our consequence:** all custom SQL must live **inside migration files**. A hand-applied object is in the
live DB but not in the replayed history, so `migrate dev` calls it drift and offers to drop the database.

### 2.2 `migrate deploy` (the only command that writes to a real database)

> "applies all pending migrations and creates the database if it doesn't exist"

Characteristics, quoted: "Does **not** look for drift… Does **not** reset the database or generate
artifacts… Does **not** rely on a shadow database". The workflow page adds that it warns if applied
migrations have been modified.

Two consequences:

- **The app never runs `migrate deploy`.** Running it from the start path would let the app create the
  database, which the role split forbids (§2.6). Deploy is an explicit operator step.
- **`migrate deploy` does not detect drift**, so a hand-applied object survives a deploy silently. That is
  why `migrate status` on the start path is necessary and why manual DDL is forbidden.

**UNVERIFIED:** that `migrate deploy` creates a *missing* database on PostgreSQL 18 (docs state it with no
provider caveat; not observed).

### 2.3 Shadow database and `CREATEDB`

> "The user must be a super user or have `CREATEDB` privilege."

- There is **no separate shadow credential**: `prisma.config.ts` `datasource` holds only `url` and
  `shadowDatabaseUrl`.
- A configured `shadowDatabaseUrl` is "not dropped, but … reset at the start of the `migrate dev` command".
  The permissions paragraph is **unconditional** and never exempts a configured shadow DB, so **assume the
  datasource user still needs `CREATEDB`**.
- `migrations.initShadowDb` exists in v7: SQL run on the shadow database before migrations.

**Conclusion:** `CREATEDB` belongs to the **migration role's** URL, never the app's — which satisfies the PO
directive. Whether option E (pre-created shadow DB, no `CREATEDB` at all) works is **UNVERIFIED**; settled by
§5.1.

### 2.4 Drift detection — and a correction to this document

Documented: "Database schema drift occurs when your database schema is out of sync with your migration
history"; "the shadow database is required to detect schema drift"; the comparison is the end state of the
current migration history vs the development database. `migrate status` reports divergence but does **not**
introspect drift.

**Correction.** An earlier version of this document (§1.6, §2.1) stated that custom objects (triggers, CHECKs,
custom indexes) are "seen in both, so the comparison matches" and therefore never drift. **That was a
v6-era assumption, not a v7 documented fact.** The v7 docs never describe what a custom object does in the
drift comparison, and they note drift is caused by changes made "without using migrations".

**Therefore:** trigger/CHECK/custom-index behaviour under shadow replay and the drift comparison is
**UNVERIFIED**. It is the highest-value smoke test (§5.1 step 5) and decides whether the custom-SQL approach
triggers a reset prompt on every subsequent `migrate dev`.

### 2.5 Advisory lock, failed migrations, and atomicity

**Advisory lock:** taken by `migrate deploy`, `migrate dev`, `migrate resolve`; "**10 second timeout** (not
configurable)"; on timeout "you will need to run it again"; disable via
`PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK` (since 5.3.0). No timeout error text is documented.

**Failure codes (v7 error reference):**

- `P3018` — "A migration failed to apply. New migrations cannot be applied before the error is recovered from."
- `P3009` — "migrate found failed migrations in the target database, new migrations will not be applied".
- `P3014` — "Prisma Migrate could not create the shadow database."

`_prisma_migrations` carries `checksum`, `started_at`, `finished_at`, `rolled_back_at`, `logs`. `logs`
"stores the error". `resolve --rolled-back` registers a migration as rolled back "allowing it to be applied
again"; `--applied` considers it "successfully applied". Whether `--applied` writes a checksum is
**UNVERIFIED**.

**Atomicity — corrected.** The v7 docs contain **no** statement that a migration file applies atomically on
PostgreSQL. The only "Postgres and SQLite … roll back every failed apply" text belongs to **ORM 8**. The v7
*patching* page says the opposite:

> "Unfortunately this migration can only be partially executed." … "If the migration was partially run…
> Manually revert the steps that were completed"

**Conclusion: a migration file on Prisma CLI 7 is NOT atomic. Assume partial application is possible.**
`MIGRATION_STRATEGY` §7 and ADR-011 §5 no longer claim one transaction per migration (corrections applied).
Operational rule: write every migration so re-running a partially-applied one is safe —
`IF NOT EXISTS` on creates, `DROP … IF EXISTS` before `CREATE`, no non-idempotent `ALTER`.

**Replay of custom SQL:** the history is "rerun" in the shadow database. The docs instruct committing a
`--create-only` file, which implies verbatim replay, but never state that files execute verbatim or that
Prisma never regenerates an existing file. **UNVERIFIED**; §5.1 step 5.

### 2.6 Role design

PO directives: a migration role separate from the runtime role; `tryoutsim_app` never holds `CREATEDB`; the
runtime role holds no ownership and no unneeded DDL.

| Role | Login | Owns | Purpose |
|---|---|---|---|
| `tryoutsim_migrator` | yes | every table, sequence, function, `_prisma_migrations` | runs `migrate dev` (dev machine) and `migrate deploy`; **holds `CREATEDB`** (option D) |
| `tryoutsim_app` | yes | nothing | runtime DML only; **`NOCREATEDB NOSUPERUSER`** |
| `tryoutsim_test` | yes | schemas it creates in a throwaway DB | `node:test` only; optional |

**No separate NOLOGIN database-owner role.** YAGNI: the migrator owns the objects and the app owns nothing,
so ownership is already out of the app's hands. Revisit only if a deploy identity separate from the
developer is ever needed.

**Privilege matrix for `tryoutsim_app`:**

| Object class | Granted |
|---|---|
| `CONNECT` on database | yes |
| `TEMPORARY` on database | **no** — not granted; `REVOKE`d from `PUBLIC` |
| `USAGE` on schema `public` | yes |
| `CREATE` on schema `public` | **no** |
| Mutable tables | `SELECT, INSERT, UPDATE, DELETE` |
| Append-only tables (T-1…T-5, T-9, T-10) | `SELECT, INSERT` only |
| `session`, `answer_sheet`, `session_snapshot`, `score_result`, `session_deletion` | `SELECT, INSERT`; `UPDATE` only on the `session`/`answer_sheet` columns the app owns; **no `DELETE`** |
| `_prisma_migrations` | `SELECT` only (for `migrate status`) |
| Sequences | `USAGE, SELECT` |
| Functions | none, except `EXECUTE` on `tryoutsim.delete_session` |
| `TRUNCATE` anywhere | **never granted** |

**PUBLIC revokes required** (PostgreSQL grants these by default): `CONNECT` and `TEMPORARY` on the database;
`USAGE` and `CREATE` on schema `public` (PG15+ already removes `CREATE`; revoke explicitly anyway);
`EXECUTE ON FUNCTIONS` — granted to `PUBLIC` by default, which is why every trigger and guard function needs
`REVOKE EXECUTE … FROM PUBLIC`.

**Default privileges, run as the migrator, before the first migration:**

```sql
-- NOT EXECUTED — sketch
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO tryoutsim_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO tryoutsim_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
```

They apply only to objects created **by the role that runs them**, so migrations must always run as
`tryoutsim_migrator`. Because the table default grants `UPDATE`/`DELETE` on every new table, each custom-SQL
migration that creates an append-only or session-family table must **revoke** those in the same file.
**Ordering trap:** defaults must be set *before* the first migration, or every table created earlier is
unreadable by the app.

**Connection paths:**

| Path | Credential | Read by |
|---|---|---|
| Runtime | app URL, `tryoutsim_app` | `new PrismaPg({ connectionString })` |
| Migration | migrator URL, `tryoutsim_migrator` | `prisma.config.ts` `datasource.url` |
| Shadow (option E only) | migrator URL + `shadowDatabaseUrl` | `migrate dev` |

Passwords go in the OS credential store, read once at start ([SECRETS](./SECRETS.md) §2: write-only, by
reference, `keyLast4`). A non-secret connection string (host/port/db/role) may live in env vars; a password
in a checked-in file is rejected by DEPLOYMENT_AND_BACKUP §1.5.

**Start path:** the app spawns a short-lived `prisma migrate status` child with the migrator URL in its
environment (**UNVERIFIED** that this is the only requirement) and refuses to serve on exit ≠ 0. It never runs
`deploy`.

### 2.7 What the role split breaks

| Failure | Cause | Fix |
|---|---|---|
| App start fails "permission denied to create database" | app ran `migrate deploy` | app runs `status` only |
| `migrate status` exits 1 "no migration table" | no `SELECT` on `_prisma_migrations` | `GRANT SELECT` after the first deploy |
| Every query fails `permission denied for table` | defaults not set, or set by the wrong role | defaults as migrator, before the first migration |
| Trigger silently skipped after a restore | `session_replication_role=replica` disables non-`ALWAYS` triggers | create triggers `ENABLE ALWAYS` |
| Restore on another machine fails "role does not exist" | the dump carries `OWNER`/`GRANT` lines | provision roles first, or `--no-owner --no-privileges` (PO decision) |

## 3. Connection pool

### 3.1 Documented `pg` adapter defaults (Prisma v7)

| Behaviour | Field | Default |
|---|---|---|
| Pool size | `max` | `10` |
| Acquire timeout | `connectionTimeoutMillis` | `0` (no timeout) |
| Connection timeout | `connectionTimeoutMillis` | `0` (no timeout) |
| Idle timeout | `idleTimeoutMillis` | `10s` |
| Connection lifetime | `maxLifetimeSeconds` | `0` (no timeout) |

### 3.2 The ADR-011 §4.2 table is wrong

ADR-011 §4.2 shows "Acquire / connect timeout" as one row and adds "the absence of a connect timeout is set
explicitly". Two corrections:

1. `pg`'s single `connectionTimeoutMillis` covers **acquire** — Prisma's own translation table maps both
   v6 parameters onto it. There is no way to set each separately.
2. The default is `0` **already** — nothing needs to be "set explicitly" to get no timeout; what needs
   setting is a *finite* value.

**Fixed in ADR-011 §4.2 below** (§6.4 lists the edit).

### 3.3 Recommended values

| Field | Recommend | Why |
|---|---|---|
| `max` | **`5`** | Single user, one backend process, `node:http` with at most a handful of in-flight requests (an exam screen autosaves one answer at a time). 10 is the default and turns into 10 idle PostgreSQL backends costing `max-backends` (default 100) on a *desktop* install where other tools may connect. 5 covers every documented concurrent path: answer autosave, the generation-job poll, the analytics read. Raise only with a measurement. |
| `connectionTimeoutMillis` | **`5000`** (`5000` ms) | The start-time readiness check must fail inside a stated window rather than hang forever; 5 s is the v6 default migrate would restore, and well under any user's patience for a start failure. |
| `idleTimeoutMillis` | **`10000`** (leave default) | Fine for a desktop app: idle backends are released after 10 s. Lower to 2–5 s if the server's `max_connections` is tight; do not raise. |
| `maxLifetimeSeconds` | **`0`** (keep) | No pooler, no server-side connection recycling in this topology. |
| `statement_timeout` | **set on the role**, e.g. `30s` | Prisma has no statement timeout; a stuck query on a single-user desktop must surface as an error, not a frozen app. Set via `ALTER ROLE tryoutsim_app SET statement_timeout = '30s'` in provisioning, not per-connection. |
| `idle_in_transaction_session_timeout` | **set on the role**, e.g. `15s` | Prisma transactions have no time limit ("a transaction stays open for as long as your callback runs"). A bug that forgets to commit holds locks forever; this ends it. PostgreSQL 17+ also has `transaction_timeout`. |

### 3.4 Graceful shutdown

Documented behaviour: Prisma Client's `$disconnect()` releases connections. The `pg` pool's `end()` closes
the sockets.

Design (not implemented):

1. `server.close()` — stop accepting new HTTP connections; let in-flight requests finish.
2. Wait for in-flight **interactive transactions** to complete, with a deadline. A transaction torn down
   mid-flight is exactly the write DB-6 forbids being observed half-done, so the wait is bounded by
   `statement_timeout`, not by a fixed sleep.
3. `await prisma.$disconnect()` — the pool closes.
4. Hard-kill after a deadline (e.g. 10 s) with a logged reason.

**Clocks:** none in the scoring path, so a shutdown mid-scoring cannot produce a partial `score_result` —
the transaction either commits or it does not. That is already true today; this section only says the
shutdown must not *shorten* the window.

---

## 4. Integration testing with `node:test` against real PostgreSQL

### 4.1 Capability check on this machine

Node v24.19.0's `node:test` exposes `test`, `describe`, `it`, `before`, `beforeEach`, `after`,
`afterEach`, `mock`, `snapshot`, `skip`, `todo`, `only`, `run`, `suite` (checked locally, 2026-11-10).
Everything below is built from those; **no test framework is added** (ADR-008).

### 4.2 Isolation options, evaluated

| Option | Mechanics | Verdict for TryoutSim |
|---|---|---|
| **A. Disposable database per run** | `create database tryoutsim_test_<pid>`, `migrate deploy` into it, drop after | **works**, but needs a role that can create databases → the same `CREATEDB` question as §2.2, now for the test role. Slow-ish (migrate replay per run) but honest. |
| **B. Disposable schema per test file** | `CREATE SCHEMA slug; SET search_path`; the migrator applies the migrations into that schema | avoids `CREATEDB` entirely — the migrator owns the database. One schema per file, dropped in `after`. **Recommended.** |
| C. One transaction, rolled back per test | wrap each test in `BEGIN … ROLLBACK` | **fails here.** A `BEFORE UPDATE` trigger that raises rolls back *to the savepoint*, not out of the test — so the test's subsequent assertions see a partially rolled-back state. Worse, a `Serializable`-level test cannot be run inside a transaction whose whole point is to roll back: the conflict it is meant to provoke is never committed, so it never conflicts. |
| D. Truncate between tests | `TRUNCATE … RESTART IDENTITY CASCADE` | works and is fast, but `CASCADE`-truncating follows FKs into append-only tables the trigger protects; the trigger does not fire on `TRUNCATE` (PostgreSQL only has `BEFORE TRUNCATE` triggers). Possible, but it silently bypasses the very guard under test. |
| E. Snapshot fixture (`pg_dump`/restore) | slow, and restore is already a feature (§ backup) | not for unit-level tests. |

**Recommendation:** **B**, with C explicitly rejected. A file per module, one schema per file, `before`
applies migrations, `after` drops the schema. Tests within a file run sequentially (default); a test
needing a second concurrent connection (DB-6, `FOR UPDATE`, `Serializable` conflicts) opens it explicitly
with a second Prisma client — the configured `max` of 5 leaves room.

### 4.3 What each test type can and cannot prove

| Invariant | Testable where | Test shape |
|---|---|---|
| Trigger rejects `UPDATE`/`DELETE` on a snapshot | DB | insert, then attempt update, assert SQLSTATE `23000`-class |
| Delete transaction succeeds through the escape hatch | DB | `SET LOCAL` + delete, assert commit |
| DB-4 conditional cascade | DB | finished job deletes; `queued` job raises `23503` |
| DB-6 atomicity | DB | force an insert failure mid-transaction, assert nothing written |
| `Serializable` write-conflict handling (`P2034`) | DB, two connections | deliberately interleave |
| Scoring correctness | **not** DB — pure function, no database | `node:test` with plain values, no connection |
| Migration replay | DB | `migrate deploy` into an empty schema, assert `_prisma_migrations` count |
| **Concurrency** | DB, two connections | see above; no `node:test` concurrency option needed (`describe(..., { concurrency: true })` exists but is not used — parallel tests would fight the schema) |

**Deliberate non-goal:** no test framework, no test library beyond `node:test` + `node:assert`. Test
helpers live in `backend/test/` and are backend code — not created until Gate 3.

### 4.4 Cleanup discipline

- Schema dropped in `after`, not `afterEach` (one schema per file).
- If a test fails mid-transaction, the connection must be closed, not reused: a leaked pool connection
  shows up as a hang. `afterEach` asserts no open transaction.
- The test role needs the same `statement_timeout` as the app role, or a deadlock test hangs for minutes
  instead of failing.

---

## 5. ADR-011 §7 blocker ledger

### 5.0 Status

| # | Blocker (ADR-011 §7) | Plan | Status |
|---|---|---|---|
| 1 | Windows smoke test | §5.1 | **open** — nothing installed or run |
| 2 | Advisory-lock timeout at 10 s | §5.2 | **open** — documented (10 s, not configurable); app behaviour not exercised |
| 3 | Shadow-database provisioning | §2.3, §2.6 | **resolved by directive** — migrator holds `CREATEDB`, app does not (§5.5 confirms D vs E) |
| 4 | `node:test` isolation | §4.2 decision B | **open** — decided on paper, not built |
| 5 | `partialIndexes` preview flag | §1.10 | **closed by PO** — custom SQL, flag not used |
| 6 | Trigger replay under `migrate dev` | §5.3 | **open, and now the top risk** — v7 does not document custom-object drift behaviour (§2.4) |
| 7 | Trigger ↔ legitimate-write interaction | §1.3, §1.7 | **design closed** — zero-GUC, privilege + `SECURITY DEFINER` function; not tested |

Two blockers are closed by directive, five remain open. The one that could invalidate the whole custom-SQL
approach is **#6**: if a replayed trigger shows up as drift, every `migrate dev` offers to drop the database.

### 5.1 Windows smoke test — concrete steps (next stage, after PO approval)

Run in `backend/` only after Gate 3 opens and after PO approves installing dependencies:

1. `npm init -y` → add the four packages per ADR-011 §4.1 (versions from §6.1).
2. Throwaway `schema.prisma` with one model (e.g. `Probe{ id String @id }`) and a `prisma.config.ts` pointing
   at the migrator URL.
3. `npx prisma migrate dev --create-only --name probe` → assert a `migration.sql` file exists.
4. Append `CREATE TABLE probe_check (v int CONSTRAINT probe_v_pos CHECK (v > 0));` → `npx prisma migrate dev`
   → assert it applies.
5. `npx prisma migrate dev --create-only --name probe2` → **assert no drift prompt** (blocker 6). Then drop
   the CHECK by hand, run `migrate dev`, and record whether drift is reported — that answers the §2.4 open
   question in both directions.
6. 20-line `node:test`: `PrismaPg({ connectionString, max: 5, connectionTimeoutMillis: 5000 })`, one
   `$transaction` inserting two rows, both returned, `$disconnect()`.
7. **Atomicity observation** (§2.5): a migration containing `CREATE TABLE x (v int); INSERT INTO x VALUES
   ('not-an-int');` → run `migrate deploy`, assert `P3018`, then check **whether `x` still exists**. The v7
   docs say partial application is possible; this records what 7.10.1 actually does, whichever way it goes.
8. **Shadow-DB privilege observation** (option E): re-run step 3 with the migrator role set `NOCREATEDB` and
   a pre-created `shadowDatabaseUrl`. If it succeeds, option E is viable; if it fails `P3014`, option D stands.
9. **Role-split observation** (§2.6): as `tryoutsim_app` assert `CREATE TABLE` → `42501`,
   `DELETE FROM session_snapshot` → `42501`, `SELECT tryoutsim.delete_session(…)` → works,
   `migrate status` → exit 0.

**Evidence to record:** `prisma --version`, Node/npm, `psql -V`, `_prisma_migrations` row count, the
drift/no-drift result for step 5, the `x` existence result for step 7, the step-8 outcome, and each step-9 exit.

### 5.2 Advisory lock — how to observe it

Two `migrate deploy` processes back to back against the same database, the first holding the lock
(`SELECT pg_advisory_lock(...)` from a psql session on the same key is not documented, so the practical
test is one long migration plus a second deploy). Expected: the second deploy either waits up to 10 s or
fails; the app's start path treats **both** as a hard start failure, never "continuing while another
migration runs". The exact key Prisma uses is not documented — accept that and test behaviour, not the key.

### 5.3 Trigger drift — the test

Replay after adding a trigger migration, then:

1. `migrate dev --create-only --name next` → assert no drift prompt.
2. `psql -c "DELETE FROM session_snapshot WHERE ..."` **outside** the app → assert the trigger raises.
3. `migrate dev` again → this **is** drift? No — the failed delete changed nothing, so no drift. Then a
   legitimate `TRUNCATE`-free reset.
4. The positive test: apply the documented delete transaction (SET LOCAL + delete) via the app path →
   assert success and the tombstone row exists.

### 5.4 What would change a decision

- If step 7 of §5.1 shows a partial migration left behind, MIGRATION_STRATEGY §7's "one transaction each"
  claim must be removed and the recovery procedure written instead.
- If §2.2 option C works, option D's `CREATEDB` can be dropped from the migrator too.
- If the trigger escape hatch cannot be made to work with `SET LOCAL` (Prisma version behaviour), §1.3's
  delete design falls back to a session-scoped GUC set by the driver adapter — which needs a new decision.

### 5.5 Decisions that need the Product Owner

> **Status note (2026-11-10, PO).** Every question below is answered — D-1…D-8. The answers are recorded in
> the canonical docs, and this document is now a **working record of the reasoning**, not a source of rules:
> the enforced objects live in [DATABASE_SCHEMA](./DATABASE_SCHEMA.md) §3, the role split in
> [DEPLOYMENT_AND_BACKUP](../architecture/DEPLOYMENT_AND_BACKUP.md) §1.5, migration mechanics in
> [MIGRATION_STRATEGY](./MIGRATION_STRATEGY.md) §7. Where this document and those disagree, **they win**.

Five directives were given. What they settle and what they do not:

| Directive | Status | What is still open |
|---|---|---|
| 1. Migration role separate from runtime | **settled** — designed in §2.6 | nothing blocking; role names shown are proposals |
| 2. `tryoutsim_app` no `CREATEDB` | **settled** — the migrator holds it instead | confirm **option D vs E** (does the migrator keep `CREATEDB`, or drop it once a pre-created shadow DB is proven) |
| 3. Partial index = custom SQL, not preview flag | **settled** — §1.10 rewritten | nothing |
| 4. DB-4 = FK `RESTRICT` + trigger | **settled in shape** — §1.4 | final SQL passes database review at Gate 3 |
| 5. Constraint inventory in `DATABASE_SCHEMA.md` | **settled** — content proposed in §1.11/§1.12 | **permission to write it into the canonical doc** |

New questions this round raises, needing PO **before** the design can be called final:

1. **`SECURITY DEFINER` delete function (§1.3).** It replaces the GUC hatch, which the security review found
   abusable. It introduces a `SECURITY DEFINER` object the project has never used, and requires its owner to
   be a non-superuser that owns only these tables. Approve, or accept a weaker guarantee?
2. **`session.deletedAt`** — the marker is never observable (the row is deleted in the same transaction).
   Keep it as an in-transaction guard, or drop the column and let `session_deletion` be the only record?
3. **Bulk delete atomicity** (`POST /sessions/bulk-delete`): per-session atomic (loop the function) or all-or
   -nothing (one transaction wrapping N calls)? The function design supports the former only.
4. **`exam_config.pathway`**: is a second stored value authorised for legacy evidence rows, or does the
   column become `CPNS`-only? The doc currently says both a `pathway` set and "legacy is never offered".
5. **Id collation (`COLLATE "C"`)** on every TEXT id, or leave the server default? Affects every PK/FK.
6. **Restore across machines**: provision roles before restore, or `pg_dump --no-owner --no-privileges`?
   Affects DEPLOYMENT_AND_BACKUP §3.
7. **UNSPECIFIED invariants** found during the inventory: retention of `notification` rows; `contentHash` dedup
   scope (hard UNIQUE or soft reject); whether `generation_batch.draftQuestionIds` becomes a junction table;
   whether `answer_sheet` timestamps must be monotonic per session; whether `package.source='dynamic'` may
   have versions; the missing `perQuestionMax` column that SCORING §5.3's ceiling check needs.

Also unresolved and needing a doc decision, not a code decision: `DEPLOYMENT_AND_BACKUP` §1.5 still says the
app role **owns** the database and **creates it on first run**, and `MIGRATION_STRATEGY` §7 still says "the
app invokes `prisma migrate deploy` through its start path". Both contradict directives 1–2. Corrected here;
the canonical docs are edited only with PO approval.

---

## 6. Verification record

### 6.1 Version claims, re-verified 2026-11-10

| Claim | Value read | Source URL | Date read |
|---|---|---|---|
| `prisma` stable line | `7.10.1` (`prev` dist-tag); `latest` = `8.0.0-rc.33` | registry.npmjs.org via `npm view` | 2026-11-10 |
| `@prisma/client` | `7.10.1`, `engines.node: ^20.19 \|\| ^22.12 \|\| >=24.0` | same | 2026-11-10 |
| `@prisma/adapter-pg` | `7.10.1`, deps `pg ^8.16.3`, `@types/pg`, `postgres-array`, `@prisma/driver-adapter-utils` | same | 2026-11-10 |
| Node 24 supported | `^20.19.0`, `^22.12.0`, or `^24.0.0` | `https://www.prisma.io/docs/orm/v7/reference/system-requirements` | 2026-11-10 |
| PostgreSQL 18 supported | table lists PostgreSQL 9.6–18 | `https://www.prisma.io/docs/orm/v7/reference/supported-databases` | 2026-11-10 |
| ORM 8 is an RC | "Prisma ORM 8 is a release candidate … GA expected in October 2026" | `https://www.prisma.io/docs/orm/release-status` | 2026-11-10 |
| Partial indexes need the flag | `where` on `@unique`/`@@unique`/`@@index`, requires `partialIndexes` | `https://www.prisma.io/docs/orm/v7/prisma-schema/data-model/indexes` | 2026-11-10 |
| Triggers are custom SQL | "Stored procedures, Triggers, Views" cannot be represented | `https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/unsupported-database-features` | 2026-11-10 |
| Shadow DB needs `CREATEDB` | "The user must be a super user or have `CREATEDB` privilege" | `https://www.prisma.io/docs/orm/v7/prisma-migrate/understanding-prisma-migrate/shadow-database` | 2026-11-10 |
| Drift = live DB ≠ replayed history | steps 1–5 of the shadow-database page | same page | 2026-11-10 |
| Advisory lock 10 s, not configurable | development-and-production page, "Advisory locking" | `https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/development-and-production` | 2026-11-10 |
| `pg` pool defaults | `max` 10, `connectionTimeoutMillis` 0, `idleTimeoutMillis` 10 000, `maxLifetimeSeconds` 0 | `https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/databases-connections/connection-pool` | 2026-11-10 |
| Driver adapters are default in v7 | "Starting with Prisma ORM v7, relational datasources instantiate Prisma Client with driver adapters by default" | same | 2026-11-10 |
| Isolation levels available | `Serializable` etc. documented for Prisma Client v7 | `https://www.prisma.io/docs/orm/v7/prisma-client/queries/transactions` | 2026-11-10 |
| Transactions have no time limit | "There is no transaction timeout either… set `idle_in_transaction_session_timeout`" | docs (ORM 8 mdx in the docs index), applicable behaviour | 2026-11-10 |

### 6.2 Local environment (unchanged from the last round)

- Node `v24.19.0`, npm `11.17.0`.
- `psql (PostgreSQL) 18.1`; service `postgresql-x64-18` running; `pg_isready` accepts on `:5432`.
- No Prisma package installed; `backend/` contains only `README.md`.
- Repository HEAD still `79bff73`; 70 local modifications preserved, none reverted.

### 6.3 Documentation access

Direct `WebFetch` calls failed with a model-routing error and `npmjs.com` returned 403. Version claims
above were therefore taken from **registry.npmjs.org** through `npm view` and from **prisma.io** retrieved
directly over HTTPS and read locally. The `.md` variants of each prisma.io page are the published
Markdown source of the same page. No claim above rests on memory alone; every row names the page. Where a
claim could not be located (transaction-per-migration, the exact advisory-lock key) it is marked
**UNVERIFIED** rather than asserted.

### 6.4 Corrections this review makes to the docs

Applied in this round (documentation only, no rule or guarantee changed):

| File | Correction |
|---|---|
| `ADR-011` §4.2 | Pool table: one `connectionTimeoutMillis` covers acquire **and** connect; the default is *no* timeout, so a finite value must be set. |
| `ADR-011` §5 | "Each migration applies in one transaction" → **UNVERIFIED, and contradicted by v7's partial-execution text** (§2.5). |
| `ADR-011` §5 | Shadow-DB paragraph: `CREATEDB` lands on the datasource user; the app role never holds it. |
| `ADR-011` §6 | P-5 (trigger design → zero-GUC), P-6 (DB-4 is prose, not a Prisma gap; PO chose RESTRICT + trigger), new **P-13** grants. |
| `ADR-011` §7 | Blockers 3, 4, 7 rewritten to point at the decisions taken here. |
| `MIGRATION_STRATEGY` §7 | 10 s advisory lock quoted; atomicity marked unverified; `CREATEDB` moved to the migration role. |
| `DEPLOYMENT_AND_BACKUP` §1.5 | Two roles; the app never owns the database or creates it; never `CREATEDB`. |
| `README.md` | Link to this document. |
| `AUDIT.md` | C-28/C-29 lines; AUD-82 row; status line. |

**Not applied — needs PO approval first:**

| File | Correction |
|---|---|
| `DEPLOYMENT_AND_BACKUP` §1.5 | Remove "owner of the app database only" and "created by the app on first run" (the table at l.65–67 still says both). |
| `MIGRATION_STRATEGY` §7 | Line 89 still says "the app invokes `prisma migrate deploy` through its start path" — must become `migrate status`, with deploy as an operator step. |
| `MIGRATION_STRATEGY` §2, l.39 | Still names `schema_migrations`; the real table is `_prisma_migrations`. |
| `DATABASE_SCHEMA` §1/§2 | The constraint inventory (§1.11–§1.13), the trigger table, the DB-4 appendix, and the `pathway` question. |
| `DATABASE_SCHEMA` l.210 | `deletedAt` is never observable — redefine or drop (§5.5 item 2). |
