# MVP Scope

Canonical statement of **what ships in MVP and where the cut lines are**. Features derive from
[PRD.md](./PRD.md) §8; nothing here adds a feature.

---

## 1. In scope

All nine feature areas of [PRD.md](./PRD.md) §8, at the depth described there:

| Area | Depth |
|---|---|
| Dashboard | Latest result, competency accuracy (≥5 answered), top-3 weaknesses, recent history, pending actions |
| Try Out | Notice-first start, deadline timer + auto-submit, navigate/flag, autosave, immediate score, unscored-on-block |
| Practice | Any competency level + difficulty, untimed default, inline explanations |
| Generation | N questions, progress/cancel, validation routing, review, provenance, failure taxonomy |
| Analytics | Per-test/competency accuracy (TWK/TIU) + attainment (TKP), mean response time, trend, difficulty, sample rules |
| Personalised | Weakness ranking, numeric evidence, material, drill, editable plan |
| Question bank | List/filter, detail validations, lifecycle, bulk ops, duplicate clusters |
| AI config | Provider CRUD, test connection, model listing, task→model map, capability flags, write-only key |
| Exam config | List, basis+notice, four-value approval, auto-invalidate |

The frontend may run on mock data before the backend is approved; the backend implements the same
contracts over SQLite ([API_SPECIFICATION.md](../backend/API_SPECIFICATION.md) ↔
[FRONTEND_DATA_CONTRACTS.md](../frontend/FRONTEND_DATA_CONTRACTS.md)).

## 2. Cut lines (explicitly out)

| Out of scope | Rationale | Revisit when |
|---|---|---|
| Multi-device sync | Single local user (O-6) | never for MVP |
| Shareable results / PDF export | single user | user requests |
| Image generation for figural items | cost + scope; placeholder assets first | post-MVP |
| Spaced-repetition beyond due-date plan | complexity | validated need |
| Login / accounts / roles | no-auth default (ADR-009) | a documented threat justifies it |
| Automated frontend tests | manual verification (ADR-007) | user reopens |

## 3. Shipped exam configs

Fixed in [CPNS_2026_REGULATIONS](../examination/CPNS_2026_REGULATIONS.md) §4.4:

| Config | State | Offered |
|---|---|---|
| `skd-cpns-2024` | `historical` | replay only |
| `skd-cpns-2026-provisional` | `provisional` (unapproved) | no, until approved |
| `skd-sekolah-kedinasan-2026` | `official_verified` (other pathway) | not offered in MVP |

**No `official_verified` CPNS 2026 config exists** — recorded so no screen claims otherwise
([CPNS_2026_REGULATIONS](../examination/CPNS_2026_REGULATIONS.md) §4.4).

## 4. Sizing / batching default

Question-generation batch size is chosen so review sits ≤ 60 s per question
([PRD.md](./PRD.md) §12). The constant is a data value, not a rule; see
[QUESTION_GENERATION.md](../ai/QUESTION_GENERATION.md) §3.