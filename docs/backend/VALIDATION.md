# Validation

Field-level validation rules for API requests. This file is the backend side of the contract; the
frontend mirror is [FRONTEND_DATA_CONTRACTS.md](../frontend/FRONTEND_DATA_CONTRACTS.md). Each rule
maps to a `VALIDATION_FAILED` entry `{ path, message, rule }`
([API_SPECIFICATION.md](./API_SPECIFICATION.md) §4).

Scoring-specific validation (PF-xx/SC-xx) is **not** repeated here — those are
[SCORING_METHODOLOGY.md](../examination/SCORING_METHODOLOGY.md) §6.1, surfaced as
`PREFLIGHT_FAILED`, not `VALIDATION_FAILED`.

---

## 1. Shared primitive rules

| rule id | applies to | definition |
|---|---|---|
| `id_format` | every `:id` | opaque non-empty string; no client parsing into sub-parts |
| `non_empty` | strings | trimmed length ≥ 1 |
| `finite_integer` | counts/scores/timing | integer, `Number.isSafeInteger` |
| `int_range` | bounded ints | `min ≤ v ≤ max` |
| `enum` | discriminators | `state`, `pathway`, `test`, `mode`, `lifecycle` fixed sets |
| `iso_utc` | timestamps | ISO-8601 `Z` |

## 2. Domain rules (by resource)

### exam-config approval (`POST /exam-configs/:id/approve`)

| path | rule |
|---|---|
| `body.configId` | `id_format`; must equal path `:id` |
| `body.acknowledgedWarnings` | must contain every outstanding UNV warning id the config carries |

The four bound values (`configVersion`, `scoringVersion`, `regulatoryBasisHash`, `approvedByUserAt`)
are server-computed from the current config at approve time — **the client never supplies them**
(they are bound server-side, preventing a forged approval). Only `acknowledgedWarnings` (and any
capture of the warning list) is client input.

### question (`POST/PATCH /questions`)

| path | rule |
|---|---|
| `test` | `enum` `TWK`/`TIU`/`TKP` |
| `competencyId` | must resolve to an existing competency in the taxonomy for that `test` |
| `options` | ≥ 2, non-empty text; TKP requires per-option weight in `[1,5]` (SC-05) |
| `answerKey` | points to an existing option; TKP key = weight map, no single "correct" |
| `lifecycle` | transitions per [QUESTION_SPECIFICATION](../examination/QUESTION_SPECIFICATION.md) §3 |
| `provenance` | present on create (BR-Q1) |

Structural/semantic question validity (V-01…V-12) is [QUESTION_SPECIFICATION](../examination/QUESTION_SPECIFICATION.md) §5,
not a field rule.

### session (`POST /sessions`)

| path | rule |
|---|---|
| `configId` | `id_format` + must exist; `state` must permit scoring |
| `mode` | `enum` `tryout`/`practice` |
| `roster` | non-empty item ids, integrity PF-00 |

### submission (`POST /sessions/:id/submit`)

| path | rule |
|---|---|
| `answers[].selectedOption` | one of the freeze snapshot's option ids, or `null` |

Everything beyond this is preflight + scoring (§6, §11 of scoring).

### provider (`POST/PATCH /providers`)

| path | rule |
|---|---|
| `baseUrl` | non-empty, http(s) schema, no credentials in URL |
| `defaultModel` | non-empty |
| `headers/*` | never accept an `Authorization` value from response path back into storage (write-only) |
| `timeoutMs` | `int_range` positive |

Key handling is [SECRETS.md](./SECRETS.md); the key itself is never a validated request field
because it is never read back (`keyLast4` only).

### generation (`POST /generation-jobs`)

| path | rule |
|---|---|
| `competencyId` | valid competency |
| `count` | `int_range` 1..session-max, batch sized so review ≤ 60 s/q (PRD §12) |

## 3. Boundary

- Semantic **scoring** rules → `PREFLIGHT_FAILED` ([SCORING_METHODOLOGY](../examination/SCORING_METHODOLOGY.md) §6).
- **Approval** mismatch → `APPROVAL_INVALID` / `APPROVAL_VERSION_MISMATCH` /
  `THRESHOLD_CONFIG_INVALID` ([API_SPECIFICATION](./API_SPECIFICATION.md) §4.2).
- Field rules here are the only source of `VALIDATION_FAILED`.