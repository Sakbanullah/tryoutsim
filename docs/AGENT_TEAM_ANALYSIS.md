# Agent Team Analysis — TryoutSim Backend

Status: **analysis only** · 2026-11-09 · Produced before Gate 3 opens. This file defines no agent, changes
no other document, and starts no implementation. Every recommendation below is grounded in the documents
listed in §1; nothing about tech stack, authentication or architecture is assumed beyond what they state.

Canonical sources consulted: `AGENTS.md`, `docs/roadmap/DEVELOPMENT_ROADMAP.md`,
`docs/backend/API_SPECIFICATION.md`, `API_ENDPOINTS.md`, `VALIDATION.md`, `ERROR_HANDLING.md`,
`BUSINESS_RULES.md`, `DATABASE_SCHEMA.md`, `ERD.md`, `MIGRATION_STRATEGY.md`, `GENERATION_JOBS.md`,
`SECRETS.md`, `docs/examination/SCORING_METHODOLOGY.md` §5–§11, `docs/architecture/SYSTEM_ARCHITECTURE.md`
§2–§5, `DEPLOYMENT_AND_BACKUP.md`, `docs/decisions/ADR-001…010`, `docs/AUDIT.md`,
`docs/audit/INDEPENDENT_DOCUMENTATION_AUDIT.md`, `BACKEND_TEMP.md`, `.claude/agents/*.md`, and
`frontend/src/{data,mock}` with `frontend/scripts/check-fixtures.ts` / `check-mock-routes.ts`.

---

## 1. Architecture and backend scope

### 1.1 What the backend must be

| Fact | Evidence | Consequence for a team |
|---|---|---|
| One local process, **modular monolith**, one local PostgreSQL 18 database | ADR-002, ADR-003, SYSTEM_ARCHITECTURE §3 | Modules are folder/interface seams, not network services. Teams can work in parallel per module but share one file tree, one process and one database. |
| Loopback only, **no auth**, single local user | ADR-009, API_SPECIFICATION §1 | No auth module, no roles. Every endpoint is same-user; "authorization" is ownership, not identity. |
| Backend stack **decided** (2026-11-10): PostgreSQL 18, Node 24, `node:http`, `node:test`, **Prisma ORM 7** with the `pg` driver adapter | ADR-002, ADR-008 (revised), ADR-011, SYSTEM_ARCHITECTURE §5 | No implementer may substitute a framework, a second ORM or a second driver on their own; `backend-developer.md` requires confirming any other framework with the Product Owner first. ADR-010 (frontend) remains `Proposed`. |
| Prisma ORM; raw SQL where it fits; no migration *framework* beyond Prisma Migrate | ADR-008, ADR-011, MIGRATION_STRATEGY §7 | Migration runner is Prisma Migrate, subject to additive-first + immutability; generated SQL is reviewed, and the constraint layer (CHECK, append-only triggers, DB-4 cascade) is hand-written SQL (ADR-011 §6). |
| Scoring is a **pure function** over (answers, frozen snapshot, scoringVersion); integers only | AGENTS constraint 4, SCORING_METHODOLOGY §8 | The one module with a hard test obligation (§8 property test, AUD-52). |
| Scoring reads snapshots; **pre-flight reads live rows** to detect approval drift | DATABASE_SCHEMA §1 exception, BR-E3 | A subtle seam: two different data-access modes in one module. A single agent owning scoring must understand both. |
| Secrets in **OS credential store**, write-only, `keyLast4` | SECRETS §2, DATABASE_SCHEMA `secret_ref`, DB-4 ordering | Adapter class on Windows Credential Manager / Keychain / Secret Service; a platform-bound piece. |
| Startup sequence is **ordered** (lock → migrations → job inspection → health) | DEPLOYMENT_AND_BACKUP §1.2 | The launcher, migrations, job recovery and health route are coupled at start; they are not independent modules. |
| Generation jobs are server-owned, batched, restart-safe, **no pause/resume/cancel** | GENERATION_JOBS §1–§5, API_ENDPOINTS §8 | Two-table persistence, atomic per batch, a restart inspection on boot. |
| Backup is verified-before-rename, keys excluded, restore is a wizard with compatibility check | DEPLOYMENT_AND_BACKUP §2–§3 | Filesystem + PostgreSQL (`pg_dump`/`pg_restore`) coupling; destructive restore path needs the strictest review. |
| Every error is a **closed registry**; `APPROVAL_*` are 200-body outcomes, not HTTP errors | API_SPECIFICATION §4, ERROR_HANDLING | One shared error module; any module inventing a code is a contract break. |
| Frontend already speaks the contract through one seam (`api = mockClient`) | `frontend/src/data/client.ts`, `index.ts` | Wiring the frontend later is a client swap, not a rewrite. Not the backend team's first task. |

### 1.2 Current state

- `backend/` contains only `README.md` ("Not started"). No code, no schema, no migrations.
- 73 markdown files in `docs/`; the contract set is unusually complete and internally cross-referenced.
- Gate 2 (frontend re-alignment to the revised docs) is **not** closed in the roadmap, so Gate 3 is not
  open anyway ([DEVELOPMENT_ROADMAP.md](./roadmap/DEVELOPMENT_ROADMAP.md)). This analysis is preparation,
  not a start signal.
- `BACKEND_TEMP.md` lists 5 open implementation decisions (#1–#5). Two have since been decided in
  canonical docs (secret store; job persistence shape + restart). **#3, #4 and #5 are partly stale and
  must be reconciled before a backend team starts**, or two implementers will implement different things.

### 1.3 Scale, honestly

The API is ~85 endpoints across 11 areas; the schema has ~20 tables. That is a **large** backend for one
person but not large in the distributed-systems sense: one process, one DB, no concurrency beyond
a single local user. The risk is not coordination at scale; it is **correctness of the scoring/approval seam and
the immutability guarantees**. A team that optimises for throughput while weakening those is worse than a
smaller, more careful one.

---

## 2. Work domains

Domains are cut where (a) the canonical docs already draw a boundary, and (b) a change in one is unlikely
to touch the same files as a change in another.

| ID | Domain | Canonical doc(s) | Key endpoints | Hard properties |
|---|---|---|---|---|
| **D0** | Foundation / platform | SYSTEM_ARCHITECTURE, ERROR_HANDLING, API_SPECIFICATION §1–4, DEPLOYMENT_AND_BACKUP §1 | `/health`, envelope + error mapper, request validation primitives, launcher, single-instance lock, startup sequence | Every other module imports this. Must land first. |
| **D1** | Storage / schema / migrations | DATABASE_SCHEMA, ERD, MIGRATION_STRATEGY | all persistence | Additive-first, `schema_migrations` checksums, hard-stop on failure, immutability. Also owns the cross-store DB-4 ordering for secrets once D5 exists. |
| **D2** | Exam config, approval, packages, **sessions, scoring, analytics, history** | CPNS_2026_REGULATIONS §4, SCORING_METHODOLOGY, PACKAGE_SPECIFICATION, ANALYTICS_ENGINE | `/exam-configs*`, `/packages*`, `/sessions*`, `/analytics*`, `/latihan/submateri`, `/bootstrap` | Scoring purity; snapshot immutability; ordered preflight PF-00…PF-13 / SC-01…SC-08; approval/verdict split; active-time clock; derived-on-read analytics; deletion tombstone. **This is the single densest domain and the one no other agent may touch.** |
| **D3** | Question bank + materials | QUESTION_SPECIFICATION, MATERIAL_SPECIFICATION, VALIDATION | `/questions*`, `/question-reports*`, `/question-batches*`, `/materials*` | Seven-state lifecycle, append-only history, activation gate, content-hash staleness, sampling gate, material approval-by-version. |
| **D4** | AI integration: providers, routing, generation jobs | AI_PROVIDER_ARCHITECTURE, GENERATION_JOBS, SECRETS, AI_VALIDATION | `/providers*`, `/ai-routing`, `/generation-jobs*` | Write-only secrets, scrubbing, OS store adapter, two-table job persistence, batch atomicity, restart inspection. |
| **D5** | Notifications, recommendations, backup/restore, settings | NOTIFICATION_SPECIFICATION, RECOMMENDATION_ENGINE, DEPLOYMENT_AND_BACKUP §2–§3 | `/notifications*`, `/recommendations*`, `/backups*`, `/restores*`, `/settings/backup` | Verified-backup rule; destructive restore with pre-copy; recommendation evidence rules; notification idempotency (`type`,`entityId`). |

D5 is a deliberate grouping of "small, mostly independent" modules. It is less cohesive than D2/D3/D4 but
each of its parts is small and security/irreversibility-sensitive in a similar way.

---

## 3. Dependency matrix

`→` = "must exist before". `shared` = both read/write the same table or module but can proceed in parallel
against an agreed interface.

| | D0 Foundation | D1 Storage | D2 Scoring/sessions | D3 Questions/materials | D4 AI | D5 Notif/reco/backup |
|---|---|---|---|---|---|---|
| **D0** | — | D0 → D1 | D0 → D2 | D0 → D3 | D0 → D4 | D0 → D5 |
| **D1** | | — | D1 → D2 (schema for session/snapshot/result) | D1 → D3 | D1 → D4 (provider/job tables, DB-4 ordering) | D1 → D5 (notification/backup tables) |
| **D2** | | | — | shared: questions frozen into snapshots; D3 lifecycle gates what is selectable | shared: `bootstrap` exposes question-bank summary; scoring never calls AI | shared: D2 writes session-derived rows D5 analytics-ish views read; notifications on session events MAY be deferred |
| **D3** | | | shared (drafts from D4 arrive at `draft`) | — | D4 → D3 (drafts are D3 rows; D3 owns lifecycle/validation records) | shared (notifications on critical reports) |
| **D4** | | | | | — | shared (generation_failed etc. raise notifications) |
| **D5** | | | | | | — |

Reading the matrix:

- **D0 and D1 are true prerequisites.** Nothing meaningful can be built without the envelope/error
  module and the schema/migration runner. They are also small relative to D2–D4 — this is the reason the
  team is not 4 equal implementers from day one.
- **D2 is the spine.** D3 (what may be frozen), D4 (what may be generated), D5 (events to notify) all
  touch it. D2 cannot be parallelised internally without fighting over one set of files, and its owner
  cannot be one of four people rotating.
- **D3 and D4 have the cleanest external boundary** once D1 is done: D4 produces drafts as `question`
  rows; D3 owns everything after arrival. They can run in parallel after D2's snapshot contract is stable
  enough to freeze content (not after D2 is *finished*).
- **D5 is the safe parallel filler** for domains waiting on D2/D4.

---

## 4. Recommended team composition

### 4.1 Verdict on the 1 + 4 + 2 hypothesis

**1 Lead + 4 Implementers + 2 Testers is over-sized for this project and mis-shaped.**

Reasons, from the project's actual conditions:

1. **The work is not four parallel tracks.** The domain cut yields D0, D1, D2, D3, D4, D5 = six
   domains, of which D0/D1 are serial prerequisites and D2 is roughly 40–50 % of the backend by contract
   volume (scoring, preflight, sessions, snapshots, analytics, history, configs, packages). Four equal
   implementers work only for a short middle phase; before that there are 0–2 productive tracks, after it
   1–2.
2. **A 4-way split tempts splitting D2.** D2 is a correctness monolith by design. Two agents editing
   `scoreSession`, preflight and the snapshot module in parallel is the single largest risk to the audit-clean
   scoring guarantee. The team should be shaped so that never happens.
3. **Two independent testers has no defined non-overlapping split.** Testing here is not volume-driven;
   it is three narrow, deep obligations: scoring property/preflight, persistence atomicity/immutability,
   and API contract conformance. A second *general* tester mostly overlaps either with the first or with
   the existing read-only reviewers.
4. **`AGENTS.md` already provides independent review as a process, not a role.** `code-reviewer`,
   `database-reviewer`, `api-reviewer` are established read-only definitions. Adding a *general* Tester
   duplicates them; adding a *test-author/writer* fills a gap they do not cover (see §4.2).
5. **`AGENTS.md` caps scale explicitly.** "Never run every agent just because it is available"; a 7-agent
   team on a first-migration-of-an-empty-directory is the opposite of that.
6. **Gate order constrains the start.** Backend does not start until frontend is approved. The team can be
   sized in phases (§4.3) rather than all at once.

### 4.2 The real testing gap

The existing reviewers are **read-only auditors** (`tools: Read, Grep, Glob, Bash`). None of them writes a
test, and `ADR-008` forbids adding a test framework speculatively.

What the project **does** have, and what it **must** have:

- Existing runnable checks: `frontend/scripts/check-fixtures.ts` and `check-mock-routes.ts` (Node's own
  type stripping + `registerHooks`, no test framework) — this is the established pattern.
- A documented backend obligation: SCORING_METHODOLOGY §8 — "a property test asserting
  `scoreSession(x)` deep-equals `scoreSession(x)` belongs in the backend test suite when the backend is
  built"; AUDIT AUD-52 — "purity/idempotence and pre-flight cases must become real tests when the backend is
  built".

Therefore the second pair of "testers" should not be two general testers. They should be:

- **T1 — Test author / verifier (writes and runs executable checks).** Owns the scoring property + preflight
  table, persistence atomicity/immutability checks, and one contract-conformance harness mapping endpoints
  to `API_ENDPOINTS.md`. Uses the repo's existing no-framework pattern unless the Product Owner approves a
  backend runner (ADR-008).
- **R1 — Independent review, *pooled from existing definitions*, not a new agent.** After each domain
  lands: `code-reviewer` for D0/D3/D4, `database-reviewer` for D1/D2 persistence, `api-reviewer` for the
  D0/D2 seam. They are read-only and do not overlap T1 because they audit code, not run tests.

That gives a real 3-way separation: **author (implementer) ∈ test author (T1) ∈ reviewer (R1)**, with R1
outside the change and T1 outside D2's author.

### 4.3 Recommended composition

**Phase 1 (foundation, ~the first third of the work): 1 Lead + 2 Implementers + 1 Test author.**

| Member | Owns |
|---|---|
| **Lead** | Task split, interface freezes, cross-domain review merge, `docs/AUDIT.md` entries, scope discipline. The Lead also owns D1 (storage/migrations) because D1 is the schema contract everyone else depends on and must not be delegated to a separate owner of an overlapping domain. |
| **Implementer A** | D0 Foundation: envelope, error mapper, validation primitives, health, startup/launcher skeleton. |
| **Implementer B** | D2 start: schema for session/snapshot/result, `scoreSession` pure function, preflight ordering. |
| **T1** | Scoring property + preflight conformance harness first (it can be written before D2 is complete, against the doc's worked cases). |

**Phase 2 (parallel domains, once D0+D1 interfaces are frozen): 1 Lead + 3 Implementers + 1 Test author.**
The Lead retains D1 + integration; the three implementers take D2, D3 and D4/D5 respectively.

**Do not exceed 4 concurrent worker agents.** Above that, `AGENTS.md`'s "never give two file-overlapping
edit tasks to different agents" becomes hard to honour because D2's seams reach into every other domain.

### 4.4 Alternative shapes (recorded, not chosen)

- **Alternative A — 1 Lead + 3 Implementers (D2, D3, D4+5), 2 reviewers only.** Simpler, fully inside
  `AGENTS.md`'s review model. Weakness: no test author; AUD-52 and §8's property test stay documentation
  until someone with edit scope writes them.
- **Alternative B — 1 Lead + 2 Implementers + 2 test-authors.** Fits the "two halves" of the contract
  (D2 spine vs D3/D4/D5 periphery) but serialises D3 and D4. Good if the Lead also implements, as in §4.3
  but with a second test author starting persistence checks early.
- **Alternative C — the user's 1+4+2.** Rejected for the reasons in §4.1.

**Recommendation: §4.3.**

---

## 5. Hierarchy and responsibilities

```
Product Owner
  └─ Lead (orchestrator + D1 storage/migrations owner)
       ├─ Implementer A   (D0 Foundation)
       ├─ Implementer B   (D2 Scoring/sessions — the spine; never time-sliced)
       ├─ Implementer C   (D3 Questions/materials)            [Phase 2]
       ├─ Implementer D   (D4 AI + D5 peripheral)             [Phase 2, can start as 2 tracks]
       └─ T1 Test author (writes/runs checks; not in the change)
  Independent review pool (not on the team, invoked per landing):
       code-reviewer · database-reviewer · api-reviewer
```

| Role | Owns | May not | Reports |
|---|---|---|---|
| **Lead** | Task graph, interface freezes, dependency merge, audit entries, final integration; D1. | Write D2 scoring logic; approve its own domain without independent review; mutate Product Owner decisions. | Gate-level status to the Product Owner. |
| **Implementer** (each) | One domain only. | Edit another domain's files; invent contract shapes; change the schema without Lead sign-off; run Git. | Domain file list, contract references, what was verified, what is blocked. |
| **T1** | Test/check files and the harness. | Edit implementation to make a test pass (that is a defect report back to the impl owner); claim a test passed without executing it. | Pass/fail with real output, coverage gaps, defects with file refs. |
| **Review pool** | Review only, read-only per their definitions. | Modify code during a review; overlap another reviewer's domain in the same audit round. | Findings by severity, what was checked and found sound, what was not checked. |

---

## 6. Implementation task split

### 6.1 Dependency order and hand-off nodes

```
N1  D0 envelope + error mapper + validation primitives   (A)
       └─ exported as the only way a route responds
N1' D1 migration runner + baseline schema (all tables)   (Lead)
       └─ interface freeze: table/column names + repository signatures
N2  D2 core: snapshot, scoreSession, preflight, submit/score   (B)
N3  D2 periphery: configs, packages, sessions runner, autosave clock, analytics, history (B, after N2)
N4  D3 question bank + materials        (C)  ─ depends on N1' only for tables; on N2 for snapshot freeze contract
N5  D4 providers/routing plus secrets adapter;  D5 notifications/backup/restore (D)  ─ depends on N1, N1'
N6  integration: launcher/startup order, `bootstrap`, frontend client swap (Lead)
```

### 6.2 Per-implementer task cards

Each card names its contract (not a restated rule), its completion evidence, and its forbidden
cross-edit. A task is not "done" because code exists; it is done when its completion evidence exists.

| Task | Contract | Completion evidence | Forbidden |
|---|---|---|---|
| A-1 Envelope & error mapper | API_SPECIFICATION §2–§4 | Every code in the closed registry maps to its envelope; unknown field → `unknown_field` | inventing a code |
| A-2 Validation primitives | VALIDATION §1 | table-driven mapping rule id → `{path,message,rule}` | duplicating validation in a route |
| A-3 Health & startup skeleton | DEPLOYMENT_AND_BACKUP §1.2, step numbering respected | `/health` only after lock+migrations+job inspection | serving before migrations succeed |
| Lead-1 Migration runner | MIGRATION_STRATEGY §2 | numbered, transactional, `schema_migrations` with checksum, hard-stop on failure | destructive migration without recovery path |
| Lead-2 Baseline schema | DATABASE_SCHEMA §2, ERD | ~20 tables appear with the documented names; DB-6 atomic write points located | adding columns "for later" |
| B-1`scoreSession` pure fn | SCORING_METHODOLOGY §2–§5, §8 | integer-only result; deep-equal property on same input | reading clock/network/live config |
| B-2 Preflight PF/SC ordered | SCORING §6.1–§6.3, §11.1 | every PF/SC case from the doc's worked table reproduced; ranking correct | collecting checks that throw on already-rejected input |
| B-3 Snapshot freeze | SCORING §7, DATABASE_SCHEMA `session_snapshot` | PF-00/PF-10 satisfied; nothing read live that feeds scoring | touching live question keys inside scoring |
| B-4 Submit/score split | API §7.3, ERROR_HANDLING §4 | idempotency rules; APPROVAL_* are 200-body cases | erroring a verdict-only condition |
| B-5 Sessions runner/autosave/clock | SCORING §8.1, API §7.5 | answer and active time in one write; expiry on resume | client-decided expiry/mutation |
| B-6 Configs/packages/analytics/history | API §2–§6, ANALYTICS §6–§7 | derived-on-read analytics; mixed comparability; deletion tombstone content-free | storing analytics |
| C-1 Question lifecycle | QUESTION_SPECIFICATION §3, §6.5 | seven legal transitions; illegal → 409 `illegal_transition`; append-only history | skipping `human_reviewed` |
| C-2 Validation records, duplicates, activation gate | QUESTION §5, §6.3; V-01…V-12 | stale-by-contentHash; `activate` refuses on failed/absent T | new state machine |
| C-3 Materials | MATERIAL_SPECIFICATION §2–§5 | approval bound to version; sources required for factual kinds | recommending unapproved material |
| D-1 Providers group | AI_PROVIDER_ARCHITECTURE §3–§7, VALIDATION §2 providers | write-only key end-to-end; `keyLast4` only; scrubber | returning any key material |
| D-2 Secrets adapter | SECRETS §2, DB-4 | create: secret-then-row with purge on failure; delete: row-then-secret | key stored in the database |
| D-3 Generation jobs | GENERATION_JOBS §1–§5 | two-table, batch atomicity, restart inspection, no pause/cancel | adding cancel |
| D-4 Notifications/recommendations | NOTIFICATION §2, RECOMMENDATION §2.1, §7 | idempotent `(type,entityId)`; deterministic weakness set; no study-plan table | AI inventing a weakness |
| D-5 Backup/restore/settings | DEPLOYMENT_AND_BACKUP §2–§3 | verify-before-rename; keys excluded; compatibility check writes nothing | pruning on failure |
| Lead-2/Frontend integration | frontend `data/index.ts` seam; API mapping | `api` points at HTTP client; mock removed or retained per approval | touching frontend feature logic |

---

## 7. Testing task split

Testing is cut by **property type**, which is what makes it non-overlapping, not by endpoint count.

| Slot | Owner | Covers | Why non-overlapping |
|---|---|---|---|
| **T-A Scoring & preflight** | T1 | Property: same (snapshot, answers) → deep-equal result. Table: every PF-00…PF-13 / SC-01…SC-08 case from the doc's worked examples; ranking §11.1. Integer-only. | Touches only `scoreSession` and preflight. No DB, no HTTP. |
| **T-B Persistence integrity** | T1 (or `database-reviewer` as an advisory audit) | Snapshot/score immutability (no update path rewrites a stored result); atomicity of the documented one-transaction writes (DB-6); migrate → replay of an old session resolves. | Touches schema and repositories only. Unaffected by scoring internals. |
| **T-C Contract conformance** | T1 (or `api-reviewer` as an advisory audit) | Each endpoint in `API_ENDPOINTS.md` returns the documented status and envelope; every error code appears in its documented place; `APPROVAL_*` never surfaces as an HTTP error; unknown field rejected. | Touches the HTTP seam only. |
| **T-D Failure-mode checks** | T1 | Provider failure taxonomy surfacing, restart inspection table, backup verify/fail path. | Provider/OS-adapter and backup modules only. |
| **R Independent review** | pooled reviewers | Logic, security, architecture, conventions (§5). | Read-only, per file set, after a landing. |

Two rules make the split real:

- **A test file has one owner.** If T-A and T-B both need a fixture, the fixture lives in a shared harness
  module owned by T1 — not duplicated.
- **A reviewer never runs while an implementer is editing the same files** (`AGENTS.md` safeguard). Review
  is a gate after a landing, not an activity during it.

---

## 8. Communication and coordination

### 8.1 Lead → implementer

The Lead sends a **task card** (§6.2 style): domain, contract references, completion evidence, forbidden
edits, and its dependency node. A card is refuseable only by conditions the card names; questions go back to
the Lead, never sideways to another implementer.

### 8.2 Implementer ↔ implementer

Implementers **do not edit each other's files** and do not negotiate interfaces directly. The Lead freezes
the shared interface (e.g. the snapshot shape, the repository signatures) at N1'/N2 and it becomes the
contract for everyone else. If B needs a repository method C owns, B asks the Lead, who adds it to C's card.
This keeps a single writer per file and removes the need for cross-agent chat.

### 8.3 Tester receiving implementations

T1 receives a **landing note** from the Lead naming (a) the files, (b) the contract sections they implement,
(c) the completion evidence the implementer claims. T1 verifies against the document, executes the checks
itself, and reports real output. T1 does not receive the implementer's narrative as evidence of behaviour.

### 8.4 Guaranteeing real tests, not agent reports

1. **T1 executes.** Every reported pass carries the command and its output. Nothing is accepted from an
   agent's prose (same rule as `code-reviewer.md`).
2. **Independence by author.** T1 must not be the author of the code it tests. If the Lead must temporarily
   own a test file, that fact is recorded and the reviewer covers it.
3. **The contract is the oracle.** When a test and a doc disagree, the doc is the source of truth and the
   disagreement is raised as a finding — the test is not "adjusted to pass".
4. **Evidence in the landing note.** The implementer states what was verified mechanically; T1 re-runs it.
   A claim that cannot be re-run is treated as unverified.

### 8.5 Feedback and bug repair

1. T1 reports a defect with file:line, the contract rule, the concrete failing input, and the failing
   command output.
2. The defect goes to **the domain's implementer** (single writer), not to T1's own edit.
3. The implementer fixes, re-runs its own evidence, and returns to the Lead.
4. T1 re-runs the failing check plus the adjacent slot's regression check.
5. A defect that touches two domains goes through the Lead, who decides which single writer changes the
   interface — never both.

---

## 9. Integration and conflict strategy

| Concern | Rule | Rationale from the docs |
|---|---|---|
| **File ownership** | One writer per file at any time; ownership mapped by domain folder. | `AGENTS.md`: never give two file-overlapping edit tasks to different agents. |
| **Shared interface** | Frozen by the Lead at N1'/N2; changes go through the Lead. | D2's snapshot shape is the binding contract for D3 and D4. |
| **Schema** | Single owner (Lead). Additive-first; migration edits are new migrations. | MIGRATION_STRATEGY §1–§2; applied migrations never edited. |
| **Error/registry** | Owned by D0. New codes require Lead + audit entry. | API_SPECIFICATION §4; ERROR_HANDLING §1. |
| **Rules and guarantees** | Any change recorded in `docs/AUDIT.md` with a severity. | `AGENTS.md` doing-work rule 3; contribution checklist. |
| **Contract inconsistency found during work** | STOP; raise as a finding; do not silently pick one document. | audit register rule in `AGENTS.md`. |
| **Integration point** | Lead merges at the completion evidence of each node in §6.1; the launcher/startup order (N6) is the last to wire because it depends on D4's job inspection. | DEPLOYMENT_AND_BACKUP §1.2. |

**Conflict recovery order:** stop → Lead decides the single writer → interface change (if any) via N1'/N2 →
audit entry (if a rule/guarantee changed) → resume.

---

## 10. Risks and mitigations

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | **D2 split across agents** and two interpretations of preflight/approval diverge. | High if 4 parallel implementers | Critical (score/verdict integrity) | Single D2 owner in every phase; interface freeze; T-A covers it independently. |
| 2 | **Stack chosen by an implementer** before the Product Owner confirms (docs say "candidates"). | Medium | High (rewrite, dependency-policy breach) | Every task card states "no framework may be chosen without PO confirmation"; Lead verifies before N1. |
| 3 | **Stale `BACKEND_TEMP.md`** (#1, #2 now decided; #3–#5 partly stale) causing two implementers to differ. | Medium | Medium | Reconcile `BACKEND_TEMP.md` against canonical docs before Gate 3 (escalation, not this file's change). |
| 4 | **Schema drift** from the canonical doc. | Medium | High | Lead owns the schema; T-B checks table/column names against `DATABASE_SCHEMA.md` §2; `database-reviewer` advisory. |
| 5 | **Approval/verdict drift** implemented as HTTP errors. | Medium | Critical | Error mapper's closed registry; T-A and T-C each assert `APPROVAL_*` is a 200-body case. |
| 6 | **Immutable history rewritten** by a convenience update path. | Medium | Critical | T-B; `database-reviewer`; no update paths to `score_result` in review. |
| 7 | **Secrets leaking** into a row/log/error. | Low-Medium | Critical | D-2 adapter owned by one implementer; DB-4 ordering; `code-reviewer` security pass. |
| 8 | **Test authorship degenerates** into an implementer testing itself. | High | High (false confidence) | T1 is not the D2 author; `code-reviewer` checks test provenance. |
| 9 | **Reviewer saturation** (every agent run on every change). | Medium | Medium (days lost) | Review graph by domain and node; run a reviewer only after a landing. |
| 10 | **Duplicate agent definitions** created to give "testers" a name. | Medium | Medium (repository rule breach) | Do not create new agent definitions; use T1 as an assignment to an existing role (`backend-developer` with test scope) or a task assigned to `code-reviewer` only for reading, **never** writing (§12). |
| 11 | **Phases overlap** because a waiting implementer starts on the next domain early. | Medium | Medium | The Lead's task cards explicitly foreground the dependency node; parallel start only where §3 says "shared". |
| 12 | **ADR-008 breached** by adding a test framework "for the team". | Medium | Medium | T1 uses the existing no-framework pattern; a framework requires the Product Owner. |

---

## 11. Complexity and bottlenecks

### 11.1 Complexity by domain

| Domain | Size (endpoints, tables) | Reasoning depth | Change frequency after first pass | Where the time actually goes |
|---|---|---|---|---|
| D0 | ~1 route + cross-cutting | High (every envelope) | Low | Error envelope and closed registry correctness |
| D1 | 0 routes, ~20 tables | High | Low but every change touches all | Baseline schema fidelity; migration runner |
| D2 | ~30 routes, ~6 tables | **Highest** | Medium | Preflight ordering, scoring purity, snapshot immutability, approval/verdict split, active-time clock |
| D3 | ~20 routes, ~6 tables | High | Medium | Seven-state lifecycle, append-only history, activation gate |
| D4 | ~16 routes, ~4 tables | High | Medium | Secret adapter, batch atomicity, restart inspection |
| D5 | ~20 routes, ~3 tables | Medium | Medium | Restore path, notification idempotency |

### 11.2 Bottlenecks

1. **D2 owner** — the hard dependency of both D3 and D4 until the snapshot contract is frozen, and the
   final integrator's counterpart. One person's pace sets the phase 2 start.
2. **Lead's schema freeze (N1')** — everything waits on it. It should be the first parallel deliverable,
   not last.
3. **The T1 scoring harness** — it can be written before D2 finishes, but if it waits for D2, it becomes
   the phase-2 bottleneck.
4. **The Secret adapter (D-2)** — platform-specific and narrow; a fast-start item for D, since D-1 and D-3
   need it.

### 11.3 Time shape (relative, not a schedule)

```
Phase 1:  Lead(schema)            ███████
          A(D0)                   ████
          B(D2 core)                    ██████████
          T1(scoring harness)           ██████████
          ── D3/D4/D5 wait for interface freeze ──
Phase 2:  B(D2 periphery)                     ███████████
          C(D3)                               █████████
          D(D4+D5)                            █████████████
          Lead(integration, N6)                                  █████
```

The wait is real and should be used, not hidden: D3/D4 owners can read their contracts and write interface
expectations while D2's snapshot shape freezes, but cannot edit until the Lead opens the node.

---

## 12. Claude Code configuration recommendation

### 12.1 Distinctions that must drive the configuration

- **Agent definition** — the markdown file in `.claude/agents/` (`name`, `description`, `tools`, `model`,
  `skills`). A reusable *capability*.
- **Teammate** — a person/agent-role in this analysis filling a role (Lead, Implementer A…) for this project.
- **Task / assignment** — a bounded unit handed to a teammate (§6.2 card).

None of (Lead, Implementer A–D, T1) requires a new definition file. Each maps to:

| Teammate | Reused definition | Note |
|---|---|---|
| Lead | `backend-developer` (lead scope) + orchestration done by the main agent/human | The Lead is a role, not a new agent. |
| Implementer A–D | `backend-developer` | Same definition, different task cards; one file-owner per domain. |
| T1 | `backend-developer` (test-author scope) **or** an assignment to `code-reviewer` extended with the narrow edit permission **only if the Product Owner approves**. | `code-reviewer`, `database-reviewer`, `api-reviewer` are defined read-only (`tools: Read, Grep, Glob, Bash`). Do not silently widen their `tools` list; that changes a repository rule. |
| Review pool | `code-reviewer`, `database-reviewer`, `api-reviewer` on their existing definitions | Use each for its stated domain. |

### 12.2 What not to do

- **Do not create duplicate agent definitions** (e.g. `tester.md`, `lead.md`). `AGENTS.md` names the six
  project agents and forbids duplicates.
- **Do not give `api-reviewer` an edit permission** "for testing". `api-reviewer.md` is explicitly an audit
  role; a contract conformance test is authored by T1 and read by `api-reviewer`.
- **Do not run reviewers while the files they audit are edited** (`AGENTS.md`).

### 12.3 Concrete configuration

1. **Keep the six existing definitions as they are.** Adding a defender or a unit-test author would require
   your approval as a repository rule change; the current settings give what the structure needs.
2. **Use the task card as the unit of delegation.** Each card names one domain, its contract refs,
   completion evidence and forbidden edits. This is the mechanism that keeps `AGENTS.md`'s "one writer per
   file" enforcible when several `backend-developer` instances run.
3. **Model/effort for team members.** Use `inherit` (as the definitions do) for the implementers and the
   Lead; keep reviewers on the normal tier. The one case that warrants a higher tier is **T1 on the scoring
   harness and the D2 implementer**, because that is where a subtle error costs the most.
4. **Parallelism cap: 3 concurrent implementations.** Run the two reviewer roles in parallel after a
   landing (they read, don't edit). Never run all six project agents at once.
5. **Coordination surface.** The Lead's task graph and interface-freeze notes are the single coordination
   artifact (in `BACKEND_TEMP.md` during implementation, which is already its stated role). All cross-domain
   interface changes appear there before code.
6. **Do not configure an automated agent-to-agent messaging surface.** This project's coordination need is
   small and its failure risk is large (two agents agreeing on something neither document says). The Lead
   passes contracts, not implementers.

---

## 13. Summary of recommendations

1. **Composition: 1 Lead + 2 implementers + 1 test author in Phase 1; 1 Lead + 3 + 1 in Phase 2.** Not
   1+4+2. The work is one serial spine (D2) and two small prerequisites (D0/D1), not four parallel tracks.
2. **The Lead also owns D1** (schema/migrations) — its freeze is the first blocker for everyone.
3. **D2 has exactly one owner for the life of the project.** It contains scoring, preflight, snapshots,
   approval/verdict and the clock; a split there is the largest correctness risk.
4. **T1 is the real testing gap** — a test *author* writing executable checks in the existing no-framework
   pattern (SCORING §8, AUD-52; frontend `scripts/check-*.ts` precedent). The existing three reviewers
   remain read-only and supply independent review; they are not general testers.
5. **No new agent definitions.** All roles reuse `backend-developer` and the three reviewers; a T1 role that
   needs edit scope that `code-reviewer` lacks is a task assigned to `backend-developer`, not a widened
   reviewer.
6. **Freeze the interface before parallelising.** D3 and D4 start only after N1' (schema) and N2 (snapshot
   contract) are frozen by the Lead. While waiting, their owners write interface expectations, not code.
7. **Test-authoring and review use the canonical doc as the oracle.** A test is never tuned to pass; a finding
   is never applied silently; every rule change goes to `docs/AUDIT.md` with a severity.
8. **Resolve `BACKEND_TEMP.md` staleness and the stack decision with the Product Owner before Gate 3.**
   Items #1 and #2 are already decided in canonical docs; #3–#5 and the framework choice are not. A team
   starting against a stale scratchpad is the second-largest coordination risk after D2 splitting.
9. **Cap at 3 concurrent implementations and never run every agent.** This is what makes "one writer per
   file" hold in practice.

---

## 14. What this file is not

- It is **not** an approval of the backend or Gate 3. Gate 2 must close first
  ([DEVELOPMENT_ROADMAP.md](./roadmap/DEVELOPMENT_ROADMAP.md)).
- It does **not** change any canonical document, audit entry or agent definition.
- It is **not** a schedule. The time shape in §11.3 is relative and is here to show the wait points, not to
  set dates.
- It records the Product Owner's 1+4+2 hypothesis, evaluates it, and recommends an alternative **subject to
  the Product Owner's approval**. No implementation step follows without that approval.
