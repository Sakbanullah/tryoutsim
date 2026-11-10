# MVP Scope

Canonical statement of **what ships in MVP and where the cut lines are**. Features derive from
[PRD.md](./PRD.md) §9; nothing here adds a feature.

---

## 1. In scope

All feature areas of [PRD.md](./PRD.md) §9, at the depth described there:

| Area | Depth |
|---|---|
| Beranda | Latest result, submateri metrics (reportable only), top-3 weaknesses, recent history (no config badge), learner pending actions, two start entry points |
| Tryout | Package start (full simulation + three subtests), config bound server-side, accumulated-active-time countdown, navigate/flag, autosave + resume, submit-with-blanks confirmation, result with explanations only after end |
| Latihan | Submateri picker with stock, untimed default, feedback after every answer, per-option TKP weights, deliberate repeats stated first |
| Progres | Per-test/submateri accuracy and attainment, mean + per-submateri response time, trend (≥3 comparable sessions), consistency, coverage, both difficulty fields, history deletion |
| Generation | N questions for a competency set, background job, progress, layered validation (T→Q→K→S), review, provenance, failure taxonomy, restart handling. **No cancel, pause or resume** |
| Personalised | Deterministic weakness set, numeric evidence, approved material offer, targeted drill, AI ordering/explanation only. A **standalone study-plan feature is out of scope** (§2) |
| Question bank | Text search + filters (no saved filters), full validation + sampling + version history, lifecycle, report/triage, quarantine, repair, manual one-by-one creation |
| Materi | Manual or AI-drafted, version history, taxonomy-bound or free note, source requirements, approval gate |
| AI config | Provider CRUD with presets, connection test, model list + manual Model ID, global default + per-feature overrides, capability flags (auto + manual), write-only key, no fallback, no token/cost |
| Exam config | List, basis + `Belum Terverifikasi` notice, user-supplied threshold approval, invalidation withholds verdict only |
| Packages | Built-in tryout/latihan packages, custom packages from template with immutable versions, repeat warnings |
| Backup / restore | Automatic + manual, verified archives, retention, migration wizard, keys excluded |
| Notifications | In-app centre, persisted events, unread state, deep links; no OS notifications |

The frontend may run on mock data before the backend is approved; the backend implements the same
contracts over PostgreSQL 18 ([API_SPECIFICATION.md](../backend/API_SPECIFICATION.md) ↔
[FRONTEND_DATA_CONTRACTS.md](../frontend/FRONTEND_DATA_CONTRACTS.md)).

## 2. Cut lines (explicitly out)

| Out of scope | Rationale | Revisit when |
|---|---|---|
| Multi-device sync of a live database | Single local user (O-6); cross-device **restore** exists instead | never for MVP — the PostgreSQL choice ([ADR-002](../decisions/ADR-002-sqlite.md)) makes this *possible* later, but it is not in scope |
| Shareable results / PDF export | single user | user requests |
| Image generation for figural items | cost + scope; placeholder assets first | post-MVP |
| Spaced-repetition beyond due-date plan | complexity | validated need |
| Login / accounts / roles / PIN | no-auth default (ADR-009) | a documented threat justifies it |
| Automated frontend tests | manual verification (ADR-007) | user reopens |
| **CSV/Excel question import, bulk question editing** | bypasses per-question validation and the form | after a bulk-entry need is validated |
| **Saved/named question filters** | filter state in the URL is enough | user asks for named views |
| **OS / Windows notifications** | in-app centre is the single surface | never for MVP |
| **Pause, resume or cancel of a generation job** | PO decision 2026-11-08; a job runs to completion, restart handles interruption | PO reopens |
| **Standalone Rencana Belajar feature and its route** | not approved; recommendations and AI-ordered guidance already live on the result and Progres screens | PO approves it explicitly |
| **Cross-provider AI fallback** | would mix provenance silently | never; the user switches routing |
| **Token / cost reporting** | app is not a billing surface | never for MVP |
| **Auto-start on login / service install** | launcher only | user asks |
| **Other recruitment pathways** | CPNS-only product (§4 of PRD) | a new PO decision, not a bug fix |

## 3. Shipped exam configs

Fixed in [CPNS_2026_REGULATIONS](../examination/CPNS_2026_REGULATIONS.md) §4.4:

| Config | State | Offered |
|---|---|---|
| `skd-cpns-2024` | `historical` | yes — replay of 2024 rules |
| `skd-cpns-2026-provisional` | `provisional` (**Belum Terverifikasi**) | yes — sessions run; no threshold verdict unless approved |
| `skd-sekolah-kedinasan-2026` | `official_verified` (other pathway), `dataProvenance: 'legacy'` | **no** — retained as evidence/replay record only |

**No `official_verified` CPNS 2026 config exists.** Sessions therefore start on a temporary config that is
labelled **Belum Terverifikasi**, and no screen claims an official pass/fail verdict
([CPNS_2026_REGULATIONS](../examination/CPNS_2026_REGULATIONS.md) §4.2, §4.4).

## 4. Sizing / batching default

Question-generation batch size is chosen so review sits ≤ 60 s per question
([PRD.md](./PRD.md) §13 success metrics). **Sampling quota is an unresolved product parameter**: the
workflow (validate → sample → approve) is in scope, the number is not yet approved and no replacement
value is assumed ([QUESTION_SPECIFICATION.md](../examination/QUESTION_SPECIFICATION.md) §6.2). Batch size
is a product constant, not a rule.
