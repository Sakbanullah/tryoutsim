# Backend Agent Team Execution Plan

Status: **planning only — Gate 3 is not open** · 2026-11-09 (corrected) · This document defines a team and
its execution; it changes no canonical document, agent definition or roadmap gate. Nothing described here
may begin until every condition in §15 is met. Phase 0 begins only **after** §15 holds; it refines the
approved direction into concrete paths and does not retroactively satisfy any Gate 3 condition (§8).

Companion analysis: [docs/AGENT_TEAM_ANALYSIS.md](../AGENT_TEAM_ANALYSIS.md) (the evaluation behind this
plan). This plan is the **operational instruction** a future Claude Code session executes.

---

## 1. Purpose and scope

### 1.1 Purpose

Give a future session a concrete, executable definition of the seven-member backend team: who owns what,
which files may change and by whom, the order work starts, what "done" means for every task, how members
talk to one another, and what must be true before a single line of backend code is written.

### 1.2 In scope

- The team structure, roles and re-use of existing agent definitions.
- Domain, file and contract ownership.
- Dependency graph, phases, entry/exit criteria.
- Communication, parallel-testing, acceptance and escalation rules.
- Blockers and the exact pre-Gate-3 condition list.

### 1.3 Out of scope

- Backend implementation, schema DDL, API code, test code.
- Selecting a backend framework, HTTP library, migration tool or test framework (ADR-008; framework
  remains unapproved). The data access is **decided, not open**: Prisma ORM 7 over PostgreSQL 18
  ([ADR-011](../decisions/ADR-011-orm-selection.md), `Accepted`); this plan does not select or install it.
- Creating agent definitions, editing agent definitions, or editing any canonical document.
- Closing Gate 2 or opening Gate 3.
- Running tests or producing evidence of implementation readiness.
- Any Git operation.

---

## 2. Team structure (fixed — seven runtime members)

Exactly seven runtime members. Additional workers are not authorised by this plan.

| # | Member | Scope | Runtime identity |
|---|---|---|---|
| 1 | **Team Lead / Orchestrator** | Orchestration, cross-domain decisions, integration, evidence report. Also inherits any orphaned domain task only when §14.4 authorises it. | **The main Claude Code session.** No separate Lead agent. |
| 2 | **Builder 1** | D0 Foundation → D1 Storage/Schema/Migrations → D5 Notifications, Recommendations, Backup, Restore, Settings (**D5 only after D0 and D1 are complete and D5's dependencies are satisfied**). | `backend-developer` |
| 3 | **Builder 2** | D2 Exam Configuration, Approval, Packages, Sessions, Scoring, Analytics, History. **Sole owner for the life of the project.** | `backend-developer` |
| 4 | **Builder 3** | D3 Question Bank and Materials. | `backend-developer` |
| 5 | **Builder 4** | D4 AI Providers, Routing, Secrets, Generation Jobs. **D4 only — no D5.** | `backend-developer` |
| 6 | **Tester 1** | Core logic + persistence testing: scoring purity, preflight, snapshots, immutability, transaction boundaries. | `backend-developer`, test scope only (§3.3) |
| 7 | **Tester 2** | API contract + integration testing: envelopes, validation, error mapping, provider failure modes, startup, backup/restore, frontend-seam integration. | `backend-developer`, test scope only (§3.3) |

The three read-only reviewers (§3.4) are **not** runtime members. They are invoked as independent review
passes in Phase 4 and do not hold file ownership.

---

## 3. Existing agent-definition mapping

### 3.1 Rules

- **No duplicate definitions.** Do not create `lead.md`, `tester.md`, `builder*.md` or similar.
- **Builders use `backend-developer.md`** as written.
- **Testers use `backend-developer.md`**, with the task-scope restriction in §3.3 stated in every task card.
- **Reviewers remain read-only** (`tools: Read, Grep, Glob, Bash`). Do not widen their tools.
- **The Lead is the main session**, not an agent definition.

### 3.2 `backend-developer.md` — what it already guarantees

Already enforces, so a task card need not repeat it: Gate 3 must be open before implementation; canonical
docs must be read; architecture is a modular monolith over **PostgreSQL 18** through **Prisma ORM 7** with
the `pg` driver adapter ([ADR-011](../decisions/ADR-011-orm-selection.md)), with raw SQL where it fits, **no
second ORM or query builder**, **no second driver**, **no HTTP framework** (`node:http` only) and
**`node:test` only** — any other
undocumented framework must be confirmed with the Product Owner first; scoring is a pure function; no
invented regulatory value; approval drift withholds the verdict only; historical data is immutable; secrets
are write-only; CPNS only; frontend out of scope unless authorised; **no Git operations**; state exactly
what was verified and record rule/guarantee changes in `docs/AUDIT.md`.

### 3.3 Tester task-scope restriction (must appear verbatim in every Tester card)

> **Test scope only.** You may create and edit **only** test and fixture files listed in the file-ownership
> map (§6), and you may execute tests. You must **not** modify production implementation files. If a test
> fails, report the defect to the owning builder (via the Lead where §9.6 applies) with file:line, the
> contract rule, the failing input and the real command output. You must not edit production code to make a
> test pass. You must not claim a test passed without executing it and quoting its output.

### 3.4 Read-only reviewer mapping (Phase 4)

| Reviewer | Review target | Why |
|---|---|---|
| `code-reviewer` | D0, D3, D4, D5 code; test provenance; integration seam | General correctness/security/convention review, stated in its definition. |
| `database-reviewer` | D1 schema/migrations; D2 persistence and immutability; backup/restore data safety | Its definition owns schema, transactions, immutability, migration safety. |
| `api-reviewer` | D0 envelope/error mapper; D2 route surface; contract conformance vs `API_ENDPOINTS.md` | Its definition owns path/method/payload/response/error-code conformance. |

No reviewer reviews a file set that a builder or tester is editing at the same moment (`AGENTS.md`
safeguard).

---

## 4. Role responsibilities

### 4.1 Team Lead (main session)

Owns: the task graph; interface freezes (§7.3); cross-domain decisions; sequential review scheduling;
integrating and reconciling findings (no Git operation); `docs/AUDIT.md` entries for changed rules/guarantees; the final
evidence report; scope discipline (no unrequested features, no invented contracts); the Gate conditions
(§15). Also owns the **architectural and schema authority** — approval of schema/migration proposals and
definition of repository interface contracts — without owning D1 implementation files (§6.1).

Must not: write D2 scoring logic; approve its own work without independent review; change ADRs, Product Owner
decisions, gates or canonical docs; run a reviewer while its audited files are being edited; start any work
before §15 is satisfied.

### 4.2 Builders (each)

Own one domain at a time per the phase schedule. Read their canonical docs before writing. Respect the
file-ownership map. Never edit another domain's files or a shared contract file (§6.4) without the Lead's
coordination. Report back: files changed, contract sections implemented, what was verified mechanically and
how, what is blocked or unverified.

### 4.3 Testers (each)

Own only their test-file families (§6.3). Verify against the canonical document (the oracle), not against a
builder's narrative. Report defects to owners. Re-run the failing check plus the adjacent regression check
after a fix.

### 4.4 Reviewers (invoked only)

Read-only per their definitions; report findings by severity with evidence; do not modify code during review;
no Git.

---

## 5. Domain ownership matrix

| Domain | Owner | Canonical contracts | Acceptance owner |
|---|---|---|---|
| **D0** Foundation — envelope, error mapper, validation primitives, health, startup skeleton | Builder 1 | API_SPECIFICATION §1–§4; ERROR_HANDLING; VALIDATION §1; DEPLOYMENT_AND_BACKUP §1.2 | Lead |
| **D1** Storage — schema, migrations, repositories, transaction boundaries | Builder 1 | DATABASE_SCHEMA; ERD; MIGRATION_STRATEGY | Lead |
| **D2** Exam config, approval, packages, sessions, scoring, preflight, snapshots, clock, analytics, history, bootstrap | **Builder 2 (sole owner all phases)** | CPNS_2026_REGULATIONS §4; SCORING_METHODOLOGY §2–§11; PACKAGE_SPECIFICATION; ANALYTICS_ENGINE; API_SPECIFICATION §5–§7 | Lead |
| **D3** Question bank, reports, batches, sampling, materials | Builder 3 | QUESTION_SPECIFICATION; MATERIAL_SPECIFICATION; VALIDATION §2 (question, material) | Lead |
| **D4** Providers, routing, secrets adapter, generation jobs | Builder 4 | AI_PROVIDER_ARCHITECTURE; GENERATION_JOBS; SECRETS; AI_VALIDATION; VALIDATION §2 (provider, routing, generation) | Lead |
| **D5** Notifications, recommendations, backup/restore, settings | **Builder 1 (after D0 and D1 complete and D5 dependencies satisfied)** | NOTIFICATION_SPECIFICATION; RECOMMENDATION_ENGINE; DEPLOYMENT_AND_BACKUP §2–§3; VALIDATION §2 (backup) | Lead |

Rule: **D2 is never split.** Scoring, preflight, snapshots, sessions and approval remain with Builder 2 in
every phase. No other builder, tester or reviewer owns any part of these responsibilities.

---

## 6. File ownership and collision-prevention policy

### 6.1 Production file ownership

Ownership is by domain folder once the Lead finalizes the backend module layout at Phase 0 (after §15 is
satisfied). The map below fixes *who*; the exact repository-relative paths are recorded in the Phase-0
file-ownership map and must be consistent with the modular-monolith shape (ADR-003) and the framework
decision the Product Owner made before Gate 3.

**D1 rule:** the Lead is the architectural and schema authority (§4.1) but owns **no D1 implementation
file**. Schema implementation, migration files, the migration runner and repositories are all Builder 1's.

| Owner | Production files |
|---|---|
| **Builder 1** | all D0 module files — **startup primitives, startup skeleton, envelope/error mapper, validation primitives, `/health` implementation**; all D1 production files (schema implementation, migration files, migration runner, repositories); all D5 module files once D5 starts |
| **Builder 2** | all D2 module files: scoring, preflight, snapshot, session, clock, config, package, analytics, history, bootstrap |
| **Builder 3** | all D3 module files |
| **Builder 4** | all D4 module files |
| **Lead (integration only)** | the separate **launcher / application integration file(s)** that assemble the final startup sequence in Phase 4, and the frontend client swap file(s) |
| **Lead (contract only — no implementation file)** | repository **interface contract** definitions (§6.4) |

**Startup ownership split (no shared file):** Builder 1 owns the startup *primitives* and skeleton; the Lead
owns the *launcher/integration* files that wire them together in Phase 4. The final sequence is exactly
`lock → migrations → job inspection → /health`. If a single file needs a change, only its designated owner
edits it; every other member submits a request through the Lead.

### 6.1.1 Phase-0 file-ownership map (mandatory before any parallel editing)

The Lead produces, in Phase 0, a table of exact repository-relative paths covering **every** column below.
Parallel editing does not begin until this table exists and each row has one owner.

| Group | Must list | Owner |
|---|---|---|
| D0 production | each D0 file | Builder 1 |
| D1 production | schema, migration files, migration runner, repositories | Builder 1 |
| D2 production | each D2 file | Builder 2 |
| D3 production | each D3 file | Builder 3 |
| D4 production | each D4 file | Builder 4 |
| D5 production | each D5 file | Builder 1 |
| Tester 1 tests + fixtures | each test and fixture file | Tester 1 |
| Tester 2 tests + fixtures | each test and fixture file | Tester 2 |
| Shared contracts | interface-contract file(s) that every domain imports | Lead defines/approves; initial author is the domain owner |
| Shared fixtures | one harness module per shared fixture | Tester 1 (generic) / Tester 2 (HTTP-shaped), recorded per fixture |
| Integration-owned | launcher / application integration file(s), frontend client swap file(s) | Lead (Phase 4) |

Rules:

- Every identified production, test, fixture, shared-contract and integration file has **exactly one named
  owner**.
- A path that cannot yet be determined is marked **UNRESOLVED**.
- An **UNRESOLVED** path **cannot be edited and cannot be included in a parallel task**.
- Any task that depends on such a path stays **blocked** until the Lead resolves and records the exact path
  and owner.
- No file may be edited concurrently by more than one member.
- **Phase 0 exit requires** every path needed by a task about to start to be resolved and assigned.
- Unrelated future paths are **not** invented prematurely. No path is invented before the repository and the
  approved module layout are inspected (§15 conditions 4 and 6).

### 6.2 No two agents edit the same production file simultaneously

- Ownership is exclusive per file. A builder who needs a change in another domain's file requests it through
  the Lead (§9.4); the Lead adds it to the owner's task. No builder edits another's file, even to "quickly fix".
- Shared code that would be cross-edited (the envelope, the error mapper, validation primitives, the schema
  runner, the migration files) is owned by exactly one member = **Builder 1**. Everyone imports it.
- The Lead never edits a production file except the integration-owned files in §6.1.

### 6.3 Test file ownership

| Owner | Test files |
|---|---|
| **Tester 1** | scoring purity/property tests; preflight case table; snapshot freeze tests; persistence atomicity, immutability, migration→replay tests |
| **Tester 2** | envelope/error-map contract suite; HTTP contract conformance suite over `API_ENDPOINTS.md`; validation rule suite; provider failure classification suite; startup-sequence and backup/restore flow suites |

A shared fixture lives in one harness module owned by Tester 1 (if generic) or Tester 2 (if HTTP-shaped); it
is not duplicated into the other's files. Ownership of each shared fixture is recorded in the Phase-0 map.

### 6.4 Shared-contract ownership

| Contract | Owner | Change process |
|---|---|---|
| Envelope, error registry, validation primitives (D0 public surface) | Builder 1 → Lead after D0 freeze | Lead coordinates; audit entry if a rule changes |
| Schema (tables, columns, DB-6 transaction points) | Lead approves; **Builder 1 proposes and implements** | Builder 1 proposes; Lead approves; new migration only; no in-place edit of an applied migration |
| Snapshot shape / frozen-session interface (between D2, D3, D4) | Builder 2 in Phase 1, **frozen** at N2 | Lead coordinates; all affected builders notified |
| Generation→question hand-off (D4 writes drafts that D3 owns) | Lead | Cross-domain interface; both builders notified |
| Repository interface contract consumed by every domain | **Lead defines and approves**; Builder 1 implements it | Interface freeze at N1' |

**If a shared contract changes:** the Lead notifies every affected member, updates the ownership map and
the relevant task cards, and records the change where §5 of `AGENTS.md` requires. It is never left only in an
agent-to-agent message (§11.4).

---

## 7. Dependency graph

### 7.1 Nodes

```
N0  Phase-0 outputs: dependency graph, ownership map, exact paths, unresolved decisions, acceptance criteria (Lead)
N1  D0 envelope + error mapper + validation primitives                           (Builder 1)
N1' D1 migration runner + baseline schema + repositories                         (Builder 1; Lead approves)  ← interface freeze
N2  D2 core: snapshot, scoreSession, preflight, submit/score                      (Builder 2)              ← snapshot freeze
N3  D2 periphery: configs, packages, session runner, autosave clock, analytics, history, bootstrap (Builder 2)
N4  D3 question bank + materials                                                  (Builder 3)
N5  D4 providers/routing/secrets adapter/generation jobs                          (Builder 4)
N5' D5 notifications/recommendations/backup/restore/settings                      (Builder 1, after N1/N1' and D5 tables exist)
N6  Integration: launcher/startup order, frontend client swap                     (Lead, Phase 4)
N6T N6-dependent integration checks: startup order, frontend seam, cross-domain    (Tester 2, after N6; Tester 1 regression)
N7  Independent review + final regression + evidence report                       (Lead, after N6T)
T1  Tester 1 checks: scoring/preflight/snapshot/persistence (parallel from Phase 1)
T2  Tester 2 checks: envelope/contract/provider failures; domain-level backup/restore once D5 exists
```

**Phase boundary on the graph:** T1/T2 run through Phases 1–3. **No edge from N6 to N7 bypasses N6T**, and
**no Phase-3 criterion references N6T**.

### 7.2 Edges

| From | To | Meaning |
|---|---|---|
| N0 | every node | Phase-0 outputs gate all work |
| N1 | N1', N2, N4, N5 | Every route responds through D0 |
| N1' | N2, N4, N5 | Tables, migrations and repository signatures must exist |
| N2 | N3 | Configs/packages/sessions/analytics sit on frozen snapshots |
| N2 | N4 (shared) | D3 code can begin on lifecycle/material tables after N1'; its **selection/snapshot integration** waits for N2's freeze |
| N1 (only) | N5 | D4 needs the envelope but not D2 |
| N1, N1' | N5' | D5 is Builder 1's after D0/D1; its notification/backup tables must exist |
| N5 → N4 | draft hand-off | D4 writes `question` rows in `draft`; **D3 owns everything after arrival** (lifecycle, validation, review). The boundary is frozen at N2. |
| N3, N4, N5, N5' | N6 | Integration needs the domains present |
| N2 | N5 (shared) | `bootstrap` exposes question-bank summary and providers; N3's bootstrap work coordinates with N5's provider module |
| N1, N1', N2, N3, N4, N5, N5' | T1, T2 | Each check slot starts when its measured surface exists — never waits for unrelated domains. **Domain-level backup/restore checks start when D5 (N5') lands.** |
| T1, T2 | N6 | Integration needs the domain evidence (Phase 3 exit) |
| N6 | N6T | N6-dependent checks (**startup order, frontend seam, cross-domain**) cannot run before N6 exists |
| N6T | N7 | The final evidence report follows completed N6T and the final regression |
| T1 (regression rerun) | N7 | Core/persistence regression is rerun after N6 lands (see §8 Phase 4) |
| every node | N7 | Reviews cover each domain landing, not only the end |

### 7.3 Freeze points (the Lead declares and records each)

- **N1' interface freeze** — table/column names, repository interface contract, migration numbering
  convention (Builder 1 implements; Lead approves the contract).
- **N2 snapshot freeze** — the frozen-session snapshot shape and the draft-arrival boundary between D4 and
  D3.
- **D0 error-registry freeze** — no new codes after N1 without the Lead and an audit entry.

---

## 8. Execution phases and entry/exit criteria

> **Every phase is conditional on §15.** These criteria assume Gate 3 has been legitimately opened by the
> Product Owner. They do not open it.

**No circular dependency.** §15 lists what the **Product Owner** must decide *before* Gate 3 opens, including
the **initial architectural module-layout direction** (approve the shape and domain folders). Phase 0 then
**refines** that approved direction into concrete repository-relative paths and exact file ownership. Phase 0
does **not** satisfy any §15 condition retroactively, and nothing in Phase 0 decides a framework, ORM or test
runner the Product Owner has not already approved.

### Phase 0 — Team Initialization (after Gate 3)

**Entry:** **all ten §15 conditions already satisfied and recorded by the Product Owner.** **Work:** Lead
reads `AGENTS.md`, the roadmap, backend specs, architecture docs, ADRs, agent definitions; produces the
dependency graph (§7), the **exact-path file-ownership map** (§6.1.1), blockers list (§12), shared contracts
and acceptance criteria (§11); records unresolved decisions as `UNRESOLVED`, which block the tasks that depend
on them; turns the approved module-layout direction into concrete implementation paths. Builders and testers
read their domain docs only; they produce no code in Phase 0.

Also in Phase 0, the Lead:
- creates the **task cards** (builders and testers);
- verifies that **every Tester card contains the exact §3.3 restriction verbatim** — a missing or altered
  restriction **blocks that Tester assignment**.

**Exit:** the Phase-0 outputs exist and are recorded in the implementation worklog; **every path needed by a
task about to start has exactly one named owner** (no `UNRESOLVED` row remains for such a task); each
member's domain and files are unambiguous; all Tester cards carry the §3.3 restriction; all seven members
hold their assignments.

### Phase 1 — Foundation and Core

**Entry:** Phase 0 exit. **Work:** Builder 1 starts D0 then D1; Builder 2 starts D2 only when N1 is stable;
Builders 3 and 4 inspect dependencies and prepare **interface expectations** without editing unstable shared
contracts; **Tester 1 and Tester 2 prepare and, where the surface exists, execute tests from the start**
(§10, §7.2 `→ T1, T2`). Testers need not wait for unrelated domains.

**Exit:** N1 done (envelope/error mapper/validation); N1' frozen (schema, repositories, migration runner);
D2 core at N2 with scoring/preflight passing Tester 1's checks; each test slot has a running suite for every
surface already built.

### Phase 2 — Parallel Domain Implementation

**Entry:** N1' frozen, **N2 snapshot freeze** in place. **Work:** Builder 2 → D2 periphery (N3); Builder 3 →
D3 (N4); Builder 4 → D4 (N5); Builder 1 → D5 (N5') once N1/N1' are complete and D5's tables exist. Testers
write **and execute** against each landed surface as it appears.

**Exit:** all domain routes produce documented envelope/error shapes; Tester 1 and Tester 2 suites cover
their domains; **domain-level** backup/restore behaviour is tested once D5 (N5') exists; no open blocking
defect older than one fix cycle. N6-dependent checks are **not** required here.

### Phase 3 — Final Domain Testing and Regression

**Entry:** Phase 2 exit. **Phase 3 is not the start of testing** — it is the **consolidation** stage, and it
covers the **domain surface only**. **Tester 1** completes and closes core logic, scoring, preflight,
snapshots, persistence integrity, immutability and transaction-boundary coverage. **Tester 2** completes and
closes API contracts, validation, error mapping, provider failure modes and domain-level backup/restore.
Both run full regression over the available domain surface. Defects go to the domain owner; the owner fixes;
testers retest independently.

**Explicit exclusion:** N6-dependent tests — **startup-order integration, frontend-client-swap integration and
cross-domain integration** — are **not** part of Phase-3 exit criteria. Phase 3 does **not** claim integration
coverage is complete; that claim is made only after Phase 4's N6T.

**Exit:** every **domain-level** acceptance criterion in §11 has its evidence; no open critical/high defect;
Tester 1 and Tester 2 each sign off their scope in their own report with real command output.

### Phase 4 — Integration, Integration Testing and Independent Review

**Entry:** Phase 3 exit. **Work, in order:**

1. **Lead implements N6** — the launcher / application integration files (startup order exactly
   `lock → migrations → job inspection → /health`) and the frontend client swap behind the existing `api`
   seam.
2. **After N6 exists**, **Tester 2** executes N6-dependent integration tests (N6T): startup-order,
   frontend-seam and cross-domain integration.
3. **Tester 1** reruns the relevant core and persistence regression after integration.
4. Defects go to the owning builder, or to the **Lead** for integration-owned files (§6.1). Owners fix;
   testers retest.
5. **Final regression** runs after fixes.
6. **Independent reviewers** (`code-reviewer`, `database-reviewer`, `api-reviewer`) run **only after** their
   target files are stable and no longer being edited; their findings are reconciled by the Lead.
7. Lead writes the evidence-based completion report (N7).

**Exit:** N6T evidence exists (integration coverage is complete **only now**); reviewers' blocking/should-fix
findings resolved or explicitly deferred with Product Owner approval; final regression evidence recorded; the
completion report names what was built, what was verified and how, and what remains unverified or blocked.

---

## 9. Direct communication protocol

### 9.1 Enabled

Members may message one another directly to resolve implementation dependencies, interface expectations,
test failures and integration questions. Direct communication is encouraged **for facts and questions**, not
for decisions.

### 9.2 Lead-owned decisions

Cross-domain architectural decisions are the Lead's. A builder may propose; the Lead decides and records it.

### 9.3 Schema and migration changes

Coordinated with **Builder 1 and the Lead**. Builder 1 owns the schema implementation, migration files and
migration runner; Builder 1 does not apply a schema change without the Lead's approval; applied migrations are
never edited; a change is a new migration file written by Builder 1.

### 9.4 Cross-domain API contract changes

Communicated to the Lead. The Lead decides whether the change is a documented contract (canonical doc
update, outside this plan's scope) or an implementation detail; it is recorded in the worklog.

### 9.5 Cannot be changed unilaterally

ADRs, requirements and Product Owner decisions. A member who believes one is wrong raises the conflict and
stops; does not implement around it.

### 9.6 Unresolved disagreements

Escalate to the Lead. The Lead decides; if the Lead cannot decide without the Product Owner, the matter stops
and escalates.

### 9.7 Documentation of agreements

Relationships and agreements that matter must be recorded in the task card or the implementation worklog
(or a canonical doc when §5 of `AGENTS.md` requires), **not left only in agent messages**. An agreement that
exists only in chat did not happen.

---

## 10. Parallel testing strategy

### 10.1 Split by property type, not endpoint count

| Slot | Owner | Boundary |
|---|---|---|
| Core logic & persistence | Tester 1 | `scoreSession`, preflight, snapshots, persistence, migrations, immutability. No HTTP. |
| Contract & integration | Tester 2 | HTTP surface, envelopes, error mapping, provider failure modes, startup, backup/restore, frontend seam. No scoring internals. |

### 10.2 Testing runs in parallel with implementation

- **Testing starts as soon as the relevant implementation or a stable contract is available** — in Phase 1
  for what N1/N1' produce, in Phase 2 for each domain as it lands. No tester waits for unrelated domains.
- Testers work **independently** of the implementation owner for that surface (no shared producer).
- Phase 3 is the **final testing and regression** stage; it consolidates coverage and closes outstanding
  defects. It is never the first point testing begins.

### 10.3 Rules

- Each test file has exactly one owner; shared fixtures live in one harness module with a recorded owner.
- Tester 1 must not be the author of the code it tests (Builder 2 is the D2 author). If the Lead must
  temporarily own a test file, record it and have `code-reviewer` cover it.
- **The canonical document is the oracle.** A test and a document disagreeing is a finding, not a test to
  adjust.
- A tester runs tests **itself** and quotes the real output; an implementer's narrative is not evidence.
- Test framework: **none added speculatively** (ADR-008). Use the repository's established no-framework
  pattern (Node's own runner and assertion per the existing `frontend/scripts/check-*.ts`). A framework is a
  Product Owner decision, not a team decision.

---

## 11. Acceptance criteria and evidence requirements

### 11.1 Universal completion evidence (every task)

1. The files changed and why, at repo-relative paths.
2. The contract section each change implements (document + section reference).
3. **What was verified mechanically** — exact command run and its exact output; never "tests passed" without
   output.
4. What is unverified or blocked, named explicitly.
5. Any rule/guarantee change recorded in `docs/AUDIT.md` with a severity.

### 11.2 Per-domain acceptance (minimum)

| Domain | Acceptance |
|---|---|
| D0 | Every closed-registry code and envelope shape is observable on a route; unknown fields rejected; no code invented. |
| D1 | `schema_migrations` with checksums; a failing migration is a hard start failure; DB-6 atomic write points exist; no destructive step without a documented recovery path. |
| D2 | Scoring pure and integer-only (same input → deep-equal result); all PF-00…PF-13 / SC-01…SC-08 cases reproduce their documented outcomes; §11.1 ranking holds; snapshots immutable; `APPROVAL_*` are 200-body cases, never HTTP errors; preflight reads live rows for drift only; expiry evaluated on resume only. |
| D3 | Seven legal transitions only; illegal transitions return 409 `illegal_transition`; history append-only; activation gate refuses without passing T on current hash; material approval bound to a version. |
| D4 | Keys never returned/logged; `keyLast4` only; DB-4 create/delete ordering; batches atomic; restart inspection matches the documented table; no cancel/pause/resume. |
| D5 | Notifications idempotent on `(type,entityId)`; recommendation weakness set deterministic; backup verified before rename and never pruned on failure; restore performs a compatibility check that writes nothing. |

### 11.3 Integration acceptance (Lead)

The startup order is exactly `lock → migrations → job inspection → /health`; the frontend client swap respects
the existing `api` seam without feature-logic edits; the final regression covers every §11.2 row. **This
integration acceptance is verified only after N6 exists — i.e. in Phase 4 (N6T), not as a Phase-3 exit
criterion.**

---

## 12. Blockers and Product Owner decisions

Verified against the repository on 2026-11-09.

| # | Blocker | State | Evidence | Resolution owner |
|---|---|---|---|---|
| B1 | **Gate 2 not closed** | Open — all three Gate 2 checkboxes unchecked | `docs/roadmap/DEVELOPMENT_ROADMAP.md` Gate 2 | Product Owner (manual verification; ADR-007) |
| B2 | **Gate 3 not open** | Open — Gate 3 checklist unchecked; roadmap says "only after frontend approval" | same file, Gate 3 | Product Owner |
| B3 | **Backend framework and ORM undecided** | Open — stack "candidates, not decided"; no backend ADR; `backend-developer.md` requires PO confirmation for an undocumented framework | `SYSTEM_ARCHITECTURE.md` §5, `ARCHITECTURE_DECISIONS.md`, `.claude/agents/backend-developer.md`, `BACKEND_TEMP.md` #4 | Product Owner |
| B4 | **`BACKEND_TEMP.md` staleness** | Open — #1 (secret store) and #2 (job persistence) are decided in `SECRETS.md` §2 and `GENERATION_JOBS.md` §4; #3 overlaps §5 there; #4 tooling is genuinely open; #5 "server clock" is stated in the roadmap open-items list and must be consolidated | `BACKEND_TEMP.md`, roadmap "Open integration items" | Lead reconciles and escalates; PO approves any decision |
| B5 | **ADR-008 constrains test tooling** | Accepted | `ADR-008`; `docs/AGENT_TEAM_ANALYSIS.md` §4.2 | Tester work uses the no-framework pattern unless the PO reopens |
| B6 | **Implementation must not start before approvals** | Enforced | `AGENTS.md` constraint 7; roadmap phase order; `backend-developer.md` | Lead enforces |

**None of these is resolved by this plan.** Each remaining decision is listed for the Product Owner in the final
report.

---

## 13. Integration and review process

1. The Lead **integrates and verifies** each domain at its completion evidence, in dependency order (N1 → N1'
   → N2 → N3/N4/N5/N5' → N6). Integration means in-tree verification against the contract — **no Git
   operation**: no merge, commit, push, rebase or branch change (multi-agent Git work is out of scope for this
   plan).
2. Integration (N6) wires the startup order and the frontend client swap **behind the existing seam**
   (`frontend/src/data/index.ts`), without editing frontend feature logic.
3. Review scheduling: one reviewer at a time per file set; never while that set is being edited. Default
   mapping §3.4.
4. Findings: blocking/should-fix/nit per the reviewers' definitions. Blocking and should-fix findings must be
   **resolved before implementation completion is accepted**. The Lead **cannot** independently advance or
   change a roadmap gate; any roadmap gate status change remains exclusively subject to the **Product
   Owner's explicit approval** and the canonical roadmap procedure. A nit is fixed or recorded.
5. Final regression after fixes; final evidence report (§11.3) from the Lead.
6. **No Git operation** at any point: no commit, push, merge, rebase, branch change or history rewrite.

---

## 14. Failure escalation and reassignment rules

### 14.1 Escalate to the Lead

- A test and a document conflict.
- A builder needs another domain's file.
- A cross-domain interface is wrong or missing.
- A shared contract would change.
- A discussion between members has been unresolved after one exchange.
- A blocker in §12 appears mid-work.

### 14.2 Stop and escalate to the Product Owner

- A canonical doc contradicts another and neither can be treated as authoritative silently.
- A Product Owner decision or ADR appears wrong.
- A framework/ORM/test-framework choice is needed.
- A change would alter a rule or guarantee beyond the documents.

### 14.3 Reassignment

A builder may be reassigned by the Lead if it reports blocked status twice on the same node with no movement,
or if a file-ownership conflict cannot be resolved by sequencing. Reassignment keeps the **D2 sole-owner rule**
intact: no task from D2 is split across builders.

### 14.4 Orphaned tasks

The Lead inherits an orphaned task only if there is no feasible reassignment; the inheritance is recorded in
the worklog. The Lead does not inherit D2 implementation work.

---

## 15. Conditions required before Gate 3 implementation begins

All must be true, and the Lead must verify each and record the verification, before **any** builder starts.
These are **Product-Owner decisions taken before Gate 3**, not Phase-0 activities.

1. **Gate 2 is closed** — the Product Owner's manual verification completed, checked in the roadmap by the
   Product Owner.
2. **Gate 3 is opened** — the Product Owner's explicit approval recorded in the roadmap.
3. **Re-baselined documentation is approved** — the Gate 0 re-baseline approval item is checked.
4. **Backend framework decided** by the Product Owner, recorded in an ADR, including the ORM/none decision.
   This plan does not select it. *Status 2026-11-10: runtime/HTTP/test decided ([ADR-002](../decisions/ADR-002-sqlite.md));
   ORM decided as **Prisma ORM 7** ([ADR-008](../decisions/ADR-008-dependency-minimalism.md),
   [ADR-011](../decisions/ADR-011-orm-selection.md), `Accepted`). The HTTP framework remains undecided and
   no framework is authorised: `node:http` only until the PO decides otherwise.*
5. **`BACKEND_TEMP.md` reconciled** with the canonical docs; open items #1 and #2 closed by reference to
   `SECRETS.md` §2 and `GENERATION_JOBS.md` §4; #3–#5 either decided or carried with an owner and a decision
   date.
6. **Initial architectural module-layout direction approved** — the domain-folder shape is accepted and
   consistent with a modular monolith (ADR-003) and the decided framework. It is a **direction**, not the
   final paths; Phase 0 refines it into exact paths.
7. **Test tooling position confirmed** against ADR-008 — the no-framework pattern is the default unless the
   Product Owner approves a runner.
8. **`docs/AUDIT.md` entry policy restated** — every rule/guarantee change during implementation is recorded
   with a severity.
9. **Agent-definition checks** — no new agent definitions; the read-only reviewers unchanged; the Tester
   task-scope restriction in §3.3 **approved as a mandatory rule**, and this plan explicitly requires its
   **verbatim inclusion in every Tester task card**. (The cards themselves are created in Phase 0; §15 does
   not require any Phase-0 artifact to exist, and no task card is required for Phase 0 to begin.)
10. **The seven-member structure is authorised** by the Product Owner in writing.

Until all ten hold, the team does not start. This document is prepared **for** that moment.

**Then** Phase 0 begins and the Lead finalizes the concrete module layout, the exact file-ownership map
(§6.1.1), the dependency graph, the task cards, the acceptance criteria and the unresolved-decision register,
and assigns all seven members. Phase 0 does not satisfy, weaken or replace any of the ten conditions above.

---

## 16. What this plan is not

- Not an approval. Not an execution. Not a framework choice.
- Not a change to any canonical document, agent definition or roadmap gate.
- Not permission to spawn the team.
- It records a structure and a discipline; responsibility for the Product Owner decisions stays with the
  Product Owner.
