# Backend Agent Team — Coordination Specification

Status: **PROPOSAL — documentation only; PO decisions U-1…U-4 closed 2026-11-09** · 2026-11-09 · This document defines the coordination discipline for
the seven-member backend team described in
[BACKEND_AGENT_TEAM_EXECUTION_PLAN.md](./BACKEND_AGENT_TEAM_EXECUTION_PLAN.md) (hereafter **the Plan**). It
changes no canonical document, no agent definition and no roadmap gate. **Gate 3 remains closed**; nothing
here is permission to spawn the team, create a task board, or write backend code.

Authority order when these documents disagree: canonical docs (`AGENTS.md` canonical-doc table) → the Plan →
this specification. Where this specification extends the Plan, the Plan prevails.

---

## 1. Architecture overview

### 1.1 What this system coordinates

Seven runtime roles (Plan §2) working on six dependency-ordered domains (Plan §7). The coordination problem is
narrow: **who may write which file, what state each unit of work is in, and what happens when an owner stops.**
It is not a distributed-systems problem — one process, one repository, one Decision authority (the Lead).

### 1.2 Three layers, one truth

| Layer | Artifact | Owner | Answers |
|---|---|---|---|
| **Transport** | Native `SendMessage` (Mode A) or files under `coordination/messages/` (Mode B) | sender | "How does a question reach a member?" |
| **Status of record** | `docs/roadmap/task-board/phase-N.md` | **Lead only** | "What is the state of a unit of work?" |
| **Deliverable transfer** | `docs/roadmap/task-board/handoff-ledger.md` | **Lead only** | "What did a producer hand to a consumer, and was it accepted?" |

Transport is **never** a source of truth (Plan §9.7: an agreement that exists only in a message did not
happen). The board is the single official record of status and dependency. The ledger is the official record of
cross-domain transfer.

### 1.3 Single Writer Policy

Exactly one writer exists for each coordination artifact: **the Team Lead** (the main session).

- Members do **not** edit the board or the ledger. They report to the Lead in their task response; the Lead
  writes the row.
- This removes concurrent-write conflict by construction rather than by locking (§7).
- The Lead's own rows (Phase-0 outputs, N6 integration) are written by the Lead and marked `Lead` in the
  `Owner` column; the Lead is not exempt from the acceptance rule of §4.5.
- **Rationale:** the Plan already gives the Lead "the task graph" and "the task cards" (Plan §4.1, §8 Phase 0).
  This specification makes that ownership explicit and file-backed.

### 1.4 Mode selection — evidence, not assumption

Mode is chosen from **observed** harness capability, re-tested at Phase-0 start, not from expectation.

| Capability | Observation (2026-11-09, Claude Code 2.1.319) | Evidence level |
|---|---|---|
| Direct agent-to-agent message delivery (`SendMessage`) | **Present.** Two spawned agents addressed each other by name; a message was delivered and a reply returned with content. | `VERIFIED-CURRENT` — observed in this repository's session. |
| Agent naming / addressing | **Present.** Named spawns were addressable by name. | `VERIFIED-CURRENT` |
| Native Agent Team object (team membership separate from spawn) | **Not observed.** Spawning produced subagents; no team membership object was created. | `VERIFIED-ABSENCE` (of observation, not of existence) |
| Native shared task list (create / assign / transition) | **Not available.** No such tool was present in the tool set; no board state existed outside the conversation. | `VERIFIED-ABSENCE` |

**Rule (PO decision U-3, 2026-11-09):** the native shared task list is **not assumed available**. If one later
appears it is a **working aid only**; it never automatically replaces or changes a Markdown board status. The
Markdown Task Board remains the sole official source of status and dependency (§3.5.7).

### 1.5 Modes

The current condition is **not** native task coordination: native messaging is verified present, a native shared
task list and native dependency management are not (§1.4). The modes are therefore named for what they carry.

| Mode | When | Composition |
|---|---|---|
| **Mode A — Hybrid Native Messaging** (default) | Native messaging verified at the §1.6 probe | Native `SendMessage` transport + Markdown board and ledger as the record |
| **Mode B — File-Based Fallback** | Only when the §1.6 probe cannot deliver a message | File inbox/outbox transport + the same Markdown board and ledger |

There is no "native-only" mode, because no native task list exists to carry status. Both modes share the
message format (§2.6) and the same two record artifacts.

Mode A is recommended because messaging is verified present, a shared task list is not, and even a hypothetical
native task list would not by itself satisfy "`DONE` only after verification" (Plan §11, §3.5.6 here).

### 1.6 Phase-0 capability probe (mandatory, before any board exists)

Run by the Lead at Phase-0 start, **after** all ten §15 conditions of the Plan hold. Record the result in
`phase-0.md` under a `Capability probe` heading.

1. Spawn two members (Builder 1, Builder 2) — reuse `backend-developer`; **create no agent definition**.
2. Each sends the other one fact-and-question message by name.
3. Record: delivered? replied? content preserved? The exact message text is pasted into `phase-0.md`.
4. Check whether a native task-list tool is present in the tool set. Record yes/no with the tool name.
5. Select the mode from §1.5 and record **why**, quoting the probe rows.

If step 2 fails, select **file-based** and create `coordination/messages/` (§6). Do not silently continue with
Anemic Mode A — a member that cannot be addressed must be reached by polling (§8.4).

### 1.7 What this specification deliberately does not do

- It does not duplicate the Phase-0 outputs (§6.1.1 file-ownership map, task cards). The board **references**
  them; it does not restate the taxonomy.
- It does not restate canonical contracts. Every row points at a document and section (§9).
- It does not add a second tracking system. A native task list, if it ever exists, is an operational aid only
  (U-3).

---

## 2. Communication protocol

### 2.1 One message format, two transports

Mode A and Mode B carry the **same** message object. Only the carriage differs. This is what prevents two
coordination mechanisms from drifting apart.

```
FROM:      <member name>
TO:        <member name | LEAD>
TYPE:      QUESTION | ANSWER | FACT | BLOCKER | DEFECT | ESCALATION | ACK
REF:       <TASK-ID | HANDOFF-ID | NONE>
BODY:      <plain text; cite document and section for every claim>
RESPONSE-REQUIRED: YES | NO
```

- `TYPE` is closed. A new value requires the Lead and a line in `phase-N.md`.
- `REF` binds a message to the unit of work it concerns. `NONE` is allowed only for introductions.
- Every claim in `BODY` cites `document §section`. An uncited claim is a question, not a fact.

### 2.2 What may travel by message

| Allowed (Plan §9.1) | Not allowed — must be written down |
|---|---|
| Questions about a contract section | A decision (Lead-owned, Plan §9.2) |
| Facts observed by running a command | A change to a shared contract (Plan §6.4) |
| Defect reports with file:line and real output | A task status change (`DONE` is the Lead's, §4.5) |
| Blocker notification | A handoff (must be a ledger row, §5) |
| Clarification of a task card | A rule or guarantee change (must be `docs/AUDIT.md`, `AGENTS.md` doing-work rule 3) |

A message that announces a decision does not create the decision. The Lead writes it in the board or ledger;
until then it has not happened.

### 2.3 Acknowledgement

- `RESPONSE-REQUIRED: YES` messages are acknowledged with `TYPE: ACK` **or** answered. An ACK says
  "received and understood"; it does **not** say "agreed" and never changes a status.
- An ACK states the `REF` it acknowledges, so a stub ACK for the wrong task is detectable.
- Default timeout: **one Lead check-in cycle** (§8.4). A missing response is a failure condition (§8).

### 2.4 Mode A — Hybrid Native Messaging

- Members message by name. The Lead may address any member; any member may address the Lead.
- Member-to-member messages are permitted for `QUESTION`, `FACT`, `DEFECT` and `ACK` only.
  `DECISION`, status change and handoff are **not** member-to-member traffic.
- No Markdown file is created per conversation (the Plan's §9.7 records only *agreements*, not chats).
- The Lead records any `BLOCKER` and `ESCALATION` in the board row's `Blockers` cell when the row is next
  touched. It is not required to log ordinary Q&A.

### 2.5 Mode B — File-Based Fallback

Only when §1.6 step 2 fails. Directory layout in §6.

- Each member has `coordination/messages/inbox/<member>/` and `coordination/messages/outbox/<member>/`.
- A message is one file: `MSG-<ULID>.md` carrying the §2.1 header as front matter and the body below.
- **Immutability:** a message file is written once and never edited. A reply is a **new** file in the
  responder's outbox, with `REF` carrying the original `MSG-ID`. Overwriting is therefore impossible by
  construction — an agent's write scope is its own outbox only.
- **Delivery:** Mode B has no push. The sender writes to its own outbox, then **copies** the file into the
  recipient's inbox in the same operation; if the copy fails the message is not sent and the sender reports a
  blocker. Delivery is a copy, not a move, so the sender keeps the audit trail.
- **Read path:** the recipient polls its inbox at session start and at every check-in boundary (§8.4). The Lead
  polls all inboxes and routes anything addressed `LEAD`.
- **Unanswered messages remain recorded** because nothing is deleted. A message is closed by an `ACK` reply
  file, not by removal.
- The Team Lead manages routing when a member cannot be addressed directly: the sender writes to the Lead's
  inbox, the Lead forwards by copying into the recipient's inbox, and records the forwarding in its own outbox.

### 2.6 Equivalence requirement (the evaluation the task asks for)

Both modes **do** use the same protocol and message format. Verified by:

1. The §2.1 object is the only format in either mode.
2. Mode switching mid-run does not rewrite history: messages already sent as native are acknowledged in the
   board row by reference text; messages sent as files keep their IDs.
3. The pairing *(TYPE, REF)* has the same meaning in both.

A message's **durability**, not its format, differs: Mode A leaves no persistent artifact, which is why §2.2
forbids decisions from travelling that way.

---

## 3. Task Board specification

### 3.1 Shape

One file per phase: `docs/roadmap/task-board/phase-0.md` … `phase-4.md`. The phase split mirrors the Plan §8
and keeps each file inside one execution window. A single board file was rejected: it would grow monotonically
and mix states from closed and open phases.

Each file contains exactly two tables: **Tasks** and **Status history**.

### 3.2 Task row schema

Markdown table, one row per unit of work. `|` inside cells is written `\|`.

| Column | Rule |
|---|---|
| `Task ID` | `<PHASE>-<DOMAIN>-<NN>`, e.g. `P1-D2-03`. Stable for the life of the task; never reused. |
| `Title` | Short noun phrase. |
| `Owner` | Exactly one member name (Plan §2). Never "Lead + Builder". |
| `Status` | One of the five values in §3.3. |
| `Deps` | Comma-separated Task IDs or Plan node names (`N1'`). Empty only on nodes with no prerequisites. |
| `Input requirements` | Pointer to the contract sections the task needs; no restated rules. |
| `Deliverables` | Files or artifacts expected at DONE. |
| `Acceptance criteria` | Verifiable statements; points at Plan §11 where a domain row already defines them. |
| `Blockers` | Empty, or `BLK-<NN>: <one line> — owner: <who resolves>`. |
| `Reviewer` | Reviewer name from Plan §3.4, or `none` for Phase-0 and Lead integration tasks where §3.4 does not apply. |
| `Evidence` | Path or command-and-output summary once submitted. Empty before submission. |

### 3.3 Statuses and permitted transitions

| Status | Meaning |
|---|---|
| `PENDING` | Exists, not started. |
| `IN_PROGRESS` | Owner has started and deps are satisfied. |
| `BLOCKED` | Cannot proceed. `Blockers` is non-empty. |
| `IN_REVIEW` | Work submitted; reviewer or consumer is checking. |
| `DONE` | **Lead-verified.** `Evidence` is non-empty and acceptance criteria are met. |

Permitted transitions (written by the Lead only):

```
PENDING ──▶ IN_PROGRESS ──▶ IN_REVIEW ──▶ DONE
   ▲            │   ▲            │
   │            ▼   │            │
   └──────── BLOCKED ◀───────────┘
                (unblock returns to the status it left)
```

- `PENDING → IN_PROGRESS` requires every `Deps` row to be `DONE`.
- `BLOCKED` returns to the status it left, recorded in `Status history`; it never jumps to `DONE`.
- `IN_REVIEW → IN_PROGRESS` is a rejection return; the reason goes in `Status history`.
- `DONE → SUPERSEDED`: see §4.6 — cancellation only, never reactivation.

### 3.4 Status history

Append-only table below the Tasks table:

| When (UTC) | Task ID | From | To | By | Reason | Evidence ref |
|---|---|---|---|---|---|---|

The history table is the audit trail for the board. It is never edited; a correction is a new row.

### 3.5 Rules (mapped to the requirement list)

1. **One owner per task** — enforced by the column rule (§3.2) and checked when the Lead writes the row.
2. **Clear output and acceptance** — both columns required; an empty `Acceptance criteria` cell makes the row
   invalid and the task cannot start.
3. **Dependency gate** — `PENDING → IN_PROGRESS` needs every dep `DONE`; a dep that is `BLOCKED` leaves the
   dependent task `PENDING` and named in `Blockers`, never skipped.
4. **Members report; Lead records** — a member's completion report is input to the Lead's write, not a status.
5. **Lead owns official status** — Single Writer Policy (§1.3).
6. **`DONE` only after verification** — requires a verification artifact: real command output (testers), an
   accepted handoff (§5.6), or reviewer finding reconciliation (Lead). A member's prose is never evidence
   (Plan §11.1, `code-reviewer.md`).
7. **Native status ≠ verified status** — if a native shared task list ever exists, its state goes in a separate
   `Native` column marked `working`; it never maps directly to `DONE`. A native "done" with no evidence
   column filled stays `IN_REVIEW` on the board. **The board wins.**
8. **No duplicate tracking** — the board holds *record of status and dependency only*. The Phase-0 file-
   ownership map (§6.1.1) and the task cards (§8 Phase 0) stay where the Plan puts them; the board links.

### 3.6 Board lifecycle

- **Location (PO decision U-1):** `docs/roadmap/task-board/` — `phase-0.md` … `phase-4.md` and one
  `handoff-ledger.md`. The directory is committed: it is the official record, not transport scratch (U-4).
- **Creation:** Phase 0, by the Lead, after the §15 conditions hold. Not before — the files do not exist
  today and creating them now would be a record of work that cannot legally start; **this specification does
  not create them**.
- **Closing a phase:** `phase-N.md` is closed when every row is `DONE` or `SUPERSEDED` and the Plan §8 exit
  criteria are met. The file is then frozen (read-only in practice) and kept as the record.
- **Freezing:** a frozen phase file may be edited only to append to `Status history`.

---

## 4. Handoff specification

### 4.1 When a handoff is required

Only when **one domain's deliverable becomes another member's input**. The Plan §5, §7.2 give a closed set.
A handoff is **not** created for a question, a defect, or a normal status change.

### 4.2 Ledger shape

`docs/roadmap/task-board/handoff-ledger.md` — one table, one row per handoff, all phases. Per-phase split was
rejected: the point of a ledger is to see `SUPERSEDED` chains across time.

| Column | Rule |
|---|---|
| `Handoff ID` | `HO-<NN>`; never reused. |
| `Producer` | Member handing over. |
| `Consumer` | Member receiving. |
| `Related Task` | Task ID(s) whose work produced it, and the consuming task ID(s). |
| `Summary` | One or two sentences: what is being transferred. |
| `Deliverables` | Files / artifacts, repo-relative paths. |
| `Changed file paths` | Exact paths the producer wrote for this handoff. |
| `Contracts/interfaces` | The named interface or contract document §section being handed over. |
| `Technical decisions` | Decisions the producer made that bind the consumer; each points at where it is recorded. |
| `Known limitations` | Explicit gaps; "none known" is a claim with evidence. |
| `Validation evidence` | Command run and its real output, or a pointer to the row's `Evidence`. |
| `Consumer instructions` | What the consumer must verify before accepting. |
| `Acceptance status` | One of §4.3. |

### 4.3 Handoff statuses

| Status | Set by | Meaning |
|---|---|---|
| `DRAFT` | Producer (reports it; Lead may record early) | Prepared, not yet offered. |
| `SUBMITTED` | Lead, on the producer's report | Offered; consumer notified. |
| `ACKNOWLEDGED` | Consumer, via `ACK` | Received. **Not accepted.** |
| `ACCEPTED` | Consumer, after the §4.5 checks pass | Deliverable is the consumer's to build on. |
| `REJECTED` | Consumer, with specific reason | See §4.6. |
| `SUPERSEDED` | **Lead, manual** | Replaced by a later handoff; the Lead records reason and the replacing ID (§4.7). |

### 4.4 Rules (mapped to the requirement list)

1. **Producer creates** — the producer supplies every field; an empty `Consumer instructions` cell makes the
   row invalid.
2. **Consumer inspects** — against the canonical contract, not against the producer's summary (Plan §4.3).
3. **Consumer must acknowledge** — `SUBMITTED → ACKNOWLEDGED` is a required step; skipping it to `ACCEPTED`
   is a violation.
4. **`ACKNOWLEDGED` ≠ `ACCEPTED`** — separate states, separate rows in `Status history`.
5. **Rejection names the defect** — §4.6.
6. **Lead resolves cross-ownership conflict** — Plan §9.6, §14.1.
7. **Not a replacement for canonical docs** — the ledger points; it never becomes a rule.
8. **Not for every message** — §4.1.

### 4.5 Consumer acceptance procedure

1. Read the canonical document sections named in `Contracts/interfaces`.
2. Run the `Validation evidence` command yourself (testers: Plan §3.3, §10.3; a producer's narrative is not
   evidence).
3. Check `Changed file paths` against the Phase-0 ownership map: every path belongs to the producer.
4. If all pass: report `ACCEPTED` to the Lead with your own command output.
5. If any fails: `REJECTED`.

### 4.6 Rejection

A `REJECTED` row must fill `Known limitations` or `Consumer instructions` with the specific defect: file:line,
the contract rule, the failing input, and the real command output. A rejection without a specific defect is
invalid and the Lead returns it. Rejected work returns to the producer's task as `IN_PROGRESS` (rejection
return, §3.3).

### 4.7 `SUPERSEDED` is manual

Set only by the Lead, with: the reason, the `Handoff ID` of the replacement (or `none — withdrawn`), and a
timestamp. There is no automatic supersession: a later handoff over the same contract does not silently retire
an earlier one — a consumer may still be building on it. This was chosen over automation because silent
supersession is exactly the hidden-drift failure the project guards against.

### 4.8 No-duplication rule (the ledger is not a second specification)

The Handoff Ledger records **facts about a transfer**, never the content of a contract.

| Cell | May contain | Must not contain |
|---|---|---|
| `Contracts/interfaces` | A document name and §section, plus a symbol name (e.g. `Plan §6.4 — repository interface`) | Enum values, column lists, signatures, error codes, rule text |
| `Technical decisions` | One line naming the decision and **where it is recorded** (board row, plan section, `docs/AUDIT.md`) | The decision's full rationale or restated rule |
| `Deliverables` / `Changed file paths` | Repo-relative paths | Code snippets or schema fragments |
| `Validation evidence` | Command, and a pointer to `Evidence` | A copied specification section |
| `Consumer instructions` | Pointers to the acceptance sections the consumer must read | The acceptance criteria re-typed |

Test: if deleting the ledger would lose a rule, the cell is wrong. The ledger is a **log of transfers between
owners**; the canonical docs remain the only place a rule lives (`AGENTS.md` canonical-doc rule). A row that
needs more than a pointer is a signal that the underlying contract is not documented where it should be — the
Lead raises that as a finding instead of writing it into the ledger.

### 4.9 Handoff status is independent of task status

The two tables are not coupled. A task may be `IN_REVIEW` with an `ACKNOWLEDGED` but not `ACCEPTED` handoff, or
`DONE` for the producer while the consumer has not started. The **only** binding rule is **§3.5 rule 3 (dependency
gate)**: the consuming task cannot leave `PENDING` until the relevant handoff row is `ACCEPTED`. That link is
written across both tables; neither table copies the other's state.

---

## 5. Handoff points (only those with a consumer)

Derived from Plan §7.2. Every row has a real consumer; nothing here is speculative.

Every handoff has exactly one producer and one consumer. Deliverables and acceptance are named; the ledger row
carries full detail but only **pointers** to contracts (§4.4 rule 7, §9.4) — no contract text is copied.

| # | Producer | Consumer | Trigger (node → consuming task) | Deliverable | Acceptance criteria |
|---|---|---|---|---|---|
| H1 | Builder 1 (D1) | Builder 2 (D2) | N1' interface freeze → D2 core (N2) | Repository interface implementation for D2's tables; exact paths | Consumer re-runs the check; signatures match Plan §6.4 contract; `Changed file paths` ⊆ Builder 1 rows of the Phase-0 map |
| H2 | Builder 1 (D1) | Builder 3 (D3) | N1' → D3 (N4) | Question/material tables, migrations and repository access | Migrations apply on a clean file; D3 table and column names match `DATABASE_SCHEMA.md` §2; no D3-owned file touched by Builder 1 |
| H3 | Builder 1 (D1) | Builder 4 (D4) | N1' → D4 (N5) | Provider/job tables + DB-4 create/delete ordering in the repository layer | DB-4 ordering observable in the repository contract; `DATABASE_SCHEMA.md` names match; `SECRETS.md` §2 unchanged |
| H4 | Builder 2 (D2) | Builder 3 (D3) | N2 snapshot freeze → D3 selection/snapshot integration | Frozen snapshot shape and the draft-arrival boundary | Snapshot shape matches the N2 freeze row; D3 may read frozen content only, never live question keys (Plan §11.2 D2) |
| H5 | Builder 4 (D4) | Builder 3 (D3) | N5 → D3 lifecycle handling (N4) | `question` drafts written as `draft` rows | Draft arrives in `draft` state only; every lifecycle transition after arrival is D3's (Plan §7.2) |
| H6 | **Builder 2 (D2) → Tester 1** | Tester 1 | each D2 landing (N2, N3) → Tester 1 core/persistence slot | D2 implementation files + the evidence Builder 2 claims | Tester 1 reruns the command itself; scoring purity, preflight cases, snapshot immutability per Plan §11.2 D2; no production file edited by Tester 1 |
| H7 | **Builder 1 (D0/D1), Builder 2 (D2), Builder 3 (D3), Builder 4 (D4) → Tester 2** | Tester 2 | each landing (N1, N1', N2–N3, N4, N5) → Tester 2 contract/integration slot | HTTP surface, envelopes, error mapping for that domain | Every endpoint matches `API_ENDPOINTS.md`; error codes from the closed registry; `APPROVAL_*` never an HTTP error (Plan §11.2) |
| H8 | Builders 1–4 | Lead | N3, N4, N5, N5' complete → N6 integration | Each builder's domain evidence, joined per the board | Lead verifies in-tree; startup order `lock → migrations → job inspection → /health` holds (Plan §11.3) |
| H9 | Builder 1 (D1) | Builder 1 (D5) | D5 tables existing → D5 implementation (N5') | D5 tables and repository access | Consumer task cannot start until this row is `ACCEPTED`; recorded because it is the only consumer-gated transfer inside one owner |

**H6 and H7 source disambiguation.** Both are **one handoff per landing, per producer**, not one permanent
handoff:

- **H6** has exactly one producer, **Builder 2**, because Tester 1's slot covers only D2's scoring, preflight,
  snapshots and persistence (Plan §10.1). Builder 2's own D0/D1 dependencies reach Tester 1 only through the
  N1/N1' test slots that Builder 1's landings create under **H7**. Each D2 landing opens a new `HO-<NN>`
  (`HO-06a`, `HO-06b`, …) with the same producer/consumer pair.
- **H7** is opened **once per producer landing** by each of Builder 1 (D0, D1), Builder 2 (D2 routes), Builder 3
  (D3) and Builder 4 (D4 circuits) — the producer is named per row, never "any builder". Builder 2 therefore
  has two outgoing handoffs at a landing: **H6 to Tester 1** and **H7 to Tester 2**, with identical
  `Changed file paths` and *different* consumer instructions (H6: core/persistence oracle; H7: HTTP/contract
  oracle). Neither consumer is given the other's acceptance authority.
- A producer may **not** substitute H6 for H7 or the reverse; they are separate rows with separate
  `Acceptance status`.

**Explicitly not handoffs:** D0 → everything (D0 is a runtime import, covered by the N1 freeze and the board's
dependency gate); Tester → Builder defect reports (`DEFECT` message, not a handoff); Lead → member task cards
(these are the board rows, not transfers of a deliverable); schema changes (Plan §6.4 has its own process).

---

## 6. File-based fallback structure

Created **only** if §1.6 selects Mode B. The minimum that makes §2.5 work, and nothing else.

```
coordination/
  messages/
    inbox/<member>/            # written by senders (copy), read by <member>
    outbox/<member>/           # written and held by <member>
  README.md                    # one page: the §2.1 format and the §2.5 delivery rule
```

**No separate directory** for decision records (those go to `docs/AUDIT.md` or the board) or for evidence
(the board's `Evidence` cell points at it). Adding either would duplicate an existing owner.

### 6.0 Git exclusion (PO decision U-4)

- `coordination/messages/` is **not committed**. When (and only when) the directory is first created, add
  `coordination/messages/` to `.gitignore` and record the addition in the board's `Status history`.
- The directory is **not created while Mode A runs**. No `.gitignore` rule is added today; this document
  performs no Git operation.
- `docs/roadmap/task-board/` **is** committed — it is the official record (U-1), not a transport scratch pad.

### 6.1 Write permission matrix (file mode)

| Path | May write | Must not write |
|---|---|---|
| `coordination/messages/outbox/<self>/` | that member | anyone else |
| `coordination/messages/inbox/<member>/` | any sender (delivery copy only, new files only) | the recipient editing a received file |
| `docs/roadmap/task-board/*` | **Lead only** | every member |
| `docs/AUDIT.md` | Lead, **within U-2 restrictions** (record only; no PO decision, no gate change, no history rewrite) | every member |

- No agent writes to another agent's outbox. No file is edited after creation. This is the concurrent-write
  mechanism: **one writer per file, guaranteed by the path**, not by a lock file.
- A lock file was rejected — it introduces its own failure mode (stale lock) for a conflict that cannot occur
  when each writer owns a distinct path.

---

## 7. Ownership and permission matrix (all modes)

Production file ownership is **not** restated here — it is Plan §6.1/§6.1.1. This matrix covers only
**coordination artifacts** and the non-negotiable scopes.

| Member | Runtime definition (Plan §2) | Coordination artefacts | Production scope | May not |
|---|---|---|---|---|
| Lead (main session) | — | **sole writer** of board + ledger | integration files only (Plan §6.1) | write D2 logic; self-verify own integration without review |
| Builder 1 | `backend-developer` | reports only | D0, D1, D5 (Plan §6.1) | edit D2/D3/D4 files; edit the board |
| Builder 2 | `backend-developer` | reports only | all D2 | split D2; edit another domain |
| Builder 3 | `backend-developer` | reports only | all D3 | edit another domain |
| Builder 4 | `backend-developer` | reports only | all D4 | touch D5 |
| Tester 1 | `backend-developer`, test scope (Plan §3.3) | reports only | Tester 1 test + fixture files | edit production code |
| Tester 2 | `backend-developer`, test scope (Plan §3.3) | reports only | Tester 2 test + fixture files | edit production code |
| `code-reviewer`, `database-reviewer`, `api-reviewer` | their definitions, read-only | none | none | any write |

**No new agent definition is created by this specification** (Plan §3.1; `AGENTS.md`).

---

## 8. Failure handling

Each row states **detection**, **action**, and **record**. No row recovers silently.

| # | Condition | Detection | Action | Record |
|---|---|---|---|---|
| F1 | Member does not respond | No ACK/reply by the next check-in (§8.4) | Escalate to Lead; Lead queries the member once more, then reassigns per Plan §14.3 | Board `Blockers`, history row |
| F2 | Message not acknowledged | `RESPONSE-REQUIRED: YES` with no `ACK` after one check-in | Re-send once with same `REF`; second miss = F1 | transport only until F1 |
| F3 | Handoff rejected | Consumer reports `REJECTED` | Consumer's specific defect is written; producer task returns to `IN_PROGRESS`; fix and re-offer as a **new `HO-<NN>`** — the rejected row is never edited | Ledger row + history |
| F4 | Dependency not done | `PENDING → IN_PROGRESS` attempt with an unmet dep | Refused by the Lead; the consumer waits and reports status `BLOCKED` on the board | Board row |
| F5 | Task blocked | Owner reports `BLOCKER` | Lead records `Blockers` cell; Lead resolves or escalates (Plan §14) | Board `Blockers` + history |
| F6 | Two members need the same file | Owner's report, or the Lead compares a submitted `Changed file paths` against the Phase-0 map | **Stop both writes.** Lead assigns one writer (Plan §6.2, §14.3); the other waits | Board history with both task IDs |
| F7 | Producer and consumer contracts differ | Consumer's acceptance check (§4.5) finds a shape the contract doc does not state | `REJECTED`; if the doc itself is ambiguous, escalate to the Product Owner (Plan §14.2) — never pick one | Ledger row + audit if a rule changes |
| F8 | Native messaging unavailable | §1.6 probe fails, or a message send errors | Switch to Mode B for the remainder; announce in the board's `Status history`; no replay of delivered native messages | `phase-N.md` note |
| F9 | Native shared task list unavailable | §1.6 step 4 returns no | **Nothing changes** (U-3). The board is the only official tracker (§3.5.7); no compensating mechanism is invented | §1.4 table |
| F10 | Member stops before finishing | No report at the expected check-in; partial files present | Lead treats partial work as unaccepted; task returns to `IN_PROGRESS` or is reassigned; partial files are named in `Blockers` | Board history |
| F11 | Status out of sync (member believes `DONE`, board says `IN_REVIEW`) | Divergence found at any contact | **The board wins.** The member re-submits evidence; a `DONE` without evidence is reverted to `IN_REVIEW` | History row, reason `status reconciliation` |
| F12 | Lead stops before writing | Board shows `IN_PROGRESS`; work exists without a row update | On resume, the Lead reconciles only from files and evidence on disk — never from memory of a past session. Unverifiable work stays `IN_REVIEW` | History row |
| F13 | Two reports arrive simultaneously | Both messages present at one check-in | Lead processes in **dependency order** (Plan §7.1), not arrival order; a conflicting write to the same contract is F7 | History rows in order written |

### 8.2 Concurrency scenarios the task names

| Scenario | Handling |
|---|---|
| **Lead stops** | F12. The board is the only resume point; no status is inferred from conversation history. |
| **Simultaneous reports** | F13. Order is dependency order; the Lead is the serialization point (Single Writer Policy means there is no concurrent board write at all). |
| **Deferred handoff** | A `SUBMITTED` row with no consumer activity keeps the consumer task `PENDING`. It does not expire; the Lead raises it at the next check-in (F1 applies to the consumer, not the handoff). |
| **Status desync** | F11. Board wins; evidence is the arbiter. |

### 8.3 What is not a mechanism

- No heartbeat, no daemon, no watcher. Polling only (§8.4).
- No automatic status change by any agent except the Lead writing the file.
- No "assume it worked".

### 8.4 Check-in discipline (realistic polling)

File-based messaging does **not** mean real-time delivery, and Mode A does not mean a member is always awake.

- **Boundaries:** the Lead runs a check-in at each of these points — before writing any board row, after each
  task submission, and at the start of every execution phase (Plan §8).
- **Members:** at session start and before reporting, each member polls its inbox once (Mode B) or reads its
  delivered messages (Mode A). A member reports whether it checked.
- **The Lead's check-in cycle is the timeout unit** (§2.3). There is no wall-clock timeout, because the Plan
  has no schedule and an idle session is not a failure.
- **Latency:** a member that is not running cannot receive. The Lead therefore only expects a response from a
  member it has spawned or will spawn; a parked member is reached when spawned, and its inbox accumulates
  (Mode B) rather than being dropped.

---

## 9. Integration with the Backend Agent Team Execution Plan

### 9.1 Mapping

| Plan section | Coordinated by |
|---|---|
| §2 seven members | `Owner` column; `phase-N.md` crew list |
| §3.1–§3.3 agent definitions, tester restriction | Board rows; the §3.3 verbatim block is quoted in each Tester row's `Acceptance criteria` cell by reference to Plan §3.3 (not restated) |
| §4 roles | §7 matrix here |
| §5 domain ownership | Board `Task ID` prefix (`P1-D2-*`) and handoff H1–H5 |
| §6.1–§6.4 file ownership, shared contracts | Ownership map stays in Phase 0; ledger `Changed file paths` is checked against it (F6) |
| §7 nodes N0–N7, edges, freezes | `Deps` column names the node (`N1'`, `N2`); a freeze is a `DONE` row the Lead declares in history |
| §8 phases | One board file per phase |
| §9 communication | §2 of this specification refines it (see §1.2 carve-out) |
| §11 acceptance | `Acceptance criteria` cell points at Plan §11 |
| §14 escalation | F1, F5, F7, F10 |
| §15 gate conditions | Board is not created until all ten hold; the capability probe (§1.6) records that fact |

### 9.2 Conflict resolved by this specification

`docs/AGENT_TEAM_ANALYSIS.md` §12.3 item 6 says: "Do not configure an automated agent-to-agent messaging
surface." Plan §9.1 says: "Members may message one another directly… encouraged for facts and questions, not
for decisions."

**Resolution (Product Owner decision, 2026-11-09). Direction: `BACKEND_AGENT_TEAM_EXECUTION_PLAN.md` §9.1
supersedes `AGENT_TEAM_ANALYSIS.md` §12.3 item 6.** The Plan is the operational instruction and is the later,
more specific authority (Plan §1.1); the Analysis is an evaluation whose recommendation is not binding on the
Plan. Read the supersession in that direction only — the Analysis does not supersede the Plan.

Superseded text: `AGENT_TEAM_ANALYSIS.md` §12.3 item 6, "Do not configure an automated agent-to-agent messaging
surface."

Governing text: Plan §9.1–§9.7, as narrowed by §2.2 of this specification. Direct messaging is permitted
**only** for facts and questions; it may never carry a decision, a contract change, a status, or a handoff.

Scope of the supersession: §12.3 item 6 only. §12.1 (definitions of agent definition / teammate / task) and
§12.2 ("do not create duplicate agent definitions") remain in force and are honoured by §7.

Preserved concern: both documents guard against "two agents agreeing on something neither document says". That
is preserved by §2.2, §2.4 and §3.5.6, not weakened.

Recording (U-2): the supersession is to be recorded as **one AUDIT entry** in `docs/AUDIT.md` under the Lead's
U-2 authority — it *records* the PO decision above; it creates no rule. **That entry is not written by this
document** (no audit change is authorised in this task's scope). Neither source document is edited.

### 9.3 Where the domain ownership stays untouched

D2 sole-owner, D5 under Builder 1, testers without production edit rights, the Lead's integration authority and
the Product Owner's product authority are Plan decisions. This specification **consumes** them; it does not
restate, amend or reinterpret them.

---

## 10. Example workflow — D1 → D2

### 10.1 Board view (`phase-1.md` excerpts)

| Task ID | Title | Owner | Status | Deps | Acceptance criteria | Evidence |
|---|---|---|---|---|---|---|
| P1-D1-04 | Repository interface implementation | Builder 1 | DONE | P1-D1-03 | Contract §6.4; `npm run <check>` output | `evidence/P1-D1-04.txt` |
| P1-D2-01 | `scoreSession` pure function | Builder 2 | PENDING | P1-D1-04 | Plan §11.2 D2 row | — |

Because `P1-D1-04` is `DONE`, Builder 2 may start.

### 10.2 Ledger row

```
| HO-01 | Builder 1 | Builder 2 | P1-D1-04 → P1-D2-01 | Repository interface for session/snapshot rows |
  Deliverables: backend/<repo modules> | Changed: backend/<...> |
  Contracts: Plan §6.4 repository interface | Decisions: none beyond the contract |
  Known limitations: no update path for scored rows, by design |
  Validation: `<command>` → `<output first line>` | Consumer: run the check, compare signatures |
  ACCEPTED |
```

### 10.3 Sequence

1. Builder 1 finishes `P1-D1-04`, reports with real command output.
2. Lead writes `DONE` (evidence non-empty) and adds `HO-01` as `DRAFT`, then `SUBMITTED`.
3. Lead messages Builder 2: `TYPE: FACT, REF: HO-01`.
4. Builder 2 sends `ACK, REF: HO-01`; Lead writes `ACKNOWLEDGED`.
5. Builder 2 runs the validation itself and compares signatures to Plan §6.4. Pass → reports `ACCEPTED`; Lead
   writes `ACCEPTED` and moves `P1-D2-01` to `IN_PROGRESS`.
6. If the signature differs from the contract → `REJECTED` with file:line and output; `P1-D1-04` returns to
   `IN_PROGRESS`; `HO-02` is opened on re-submission.

---

## 11. Example workflow — implementation → Tester

1. Builder 2 lands D2 core (`N2`). Board row `P1-D2-03` → `IN_REVIEW`; handoff `HO-05` `SUBMITTED`.
2. Tester 1 acknowledges (`ACK`) → `ACKNOWLEDGED`.
3. Tester 1 verifies **against the canonical doc**, not Builder 2's summary (Plan §10.3), and runs its own
   suite. Pass → `ACCEPTED`; Tester 1's task moves to `IN_REVIEW`; Lead writes.
4. Fail → `REJECTED` with file:line, contract rule, failing input and command output; `P1-D2-03` returns
   `IN_PROGRESS`.
5. Builder 2 fixes and re-submits (`HO-06`, referencing `HO-05`). Lead marks `HO-05` `SUPERSEDED` (manual,
   §4.7) with reason "replaced by HO-06 after REJECTED".
6. Tester 1 re-runs the failing check **plus** its adjacent regression check (Plan §14.1 / §4.3).
7. `DONE` for `P1-D2-03` requires Tester 1's `ACCEPTED` **and** the Lead's evidence check; Tester 1's own task
   goes `DONE` only on Tester 1's evidence (Plan §11.1).

---

## 12. Risks, limitations and unresolved decisions

### 12.1 Risks

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| R1 | Board rows drift from reality because the Lead lags | Medium | F11 reconciliation; history rows; check-in before every write |
| R2 | Ledger becomes a second home for contract facts | High (duplication) | §4.4 rule 7; `Contracts/interfaces` cells carry pointers only |
| R3 | A member treats a native "done" as `DONE` | High | §3.5.7; F11 |
| R4 | Handoff overhead on every landing | Medium | §4.1 closed set H1–H9 only |
| R5 | A stopped member's absence is invisible in Mode B | Medium | F1 uses the Lead check-in cycle, not wall-clock |
| R6 | Mode A leaves no artifact for a later session | Medium | enforced §2.2: nothing durable travels by message |
| R7 | `SUPERSEDED` chains become hard to read | Low | One ledger, replacement ID mandatory |
| R8 | The specification itself drifts from the Plan | Medium | Authority order (§1) and §9.1 mapping |

### 12.2 Limitations

- The system assumes the Lead is the main session and is running whenever status changes. A Lead that never
  resumes leaves the board stale; F12 makes the recovery explicit but cannot make it automatic.
- Mode B latency is check-in-bounded; a parked agent cannot receive in real time (§8.4).
- The shared task list is absent today; if it appears, §3.5.7 governs and nothing else changes.
- The capability probe (§1.6) is a Phase-0 activity and must be re-run on any harness upgrade.

### 12.3 `PROPOSAL` — decided in this specification, awaiting ratification

| Item | Proposed decision | Ratify when |
|---|---|---|
| P-1 | Board split per phase instead of one file | First Phase-0 write |
| P-2 | `Status history` table on every phase file | First Phase-0 write |
| P-3 | One ledger for all phases, not per phase | First handoff |
| P-4 | No lock file; ownership by path (§6.1) | Mode B activation |
| P-5 | Check-in cycle replaces wall-clock timeout (§8.4) | Phase-0 probe |

### 12.4 Product Owner decisions (closed 2026-11-09)

| # | Decision | Effect in this specification |
|---|---|---|
| **U-1** | **APPROVED** — the board lives in `docs/roadmap/task-board/`: `phase-0.md` … `phase-4.md` plus one `handoff-ledger.md`. | §3.1, §4.2, §3.6. Created in Phase 0 only; not created now. |
| **U-2** | **APPROVED WITH RESTRICTIONS** — the Lead may add audit entries that **record** PO-authorised decisions and changes. The Lead may not make a PO decision, change a roadmap gate, or alter audit history retrospectively, and may not record an unapproved recommendation as a final decision. | §9.2, F7, and the Lead's row in §7. |
| **U-3** | **APPROVED** — the Markdown board is the sole official source of status and dependency; a native task list, if it appears, is an operational aid that never automatically replaces or changes Markdown status. | §1.4, §1.5, §3.5.7. |
| **U-4** | **APPROVED** — `coordination/messages/` is not committed; a matching `.gitignore` rule is added **only if** that directory is ever created. It is not created while Mode A runs. | §6, §6.2. No Git operation is performed here. |

No unresolved Product Owner items remain in this specification. The Plan §15 conditions still gate all work.

---

## 13. What this document is not

- Not an approval of the backend, of Gate 3, or of any team member.
- Not permission to create `docs/roadmap/task-board/`, `coordination/`, or to spawn the seven-member team.
- Not a change to any canonical document, agent definition, roadmap gate or ownership decision.
- Not a replacement for Plan §6.1.1, §11 or §15.
