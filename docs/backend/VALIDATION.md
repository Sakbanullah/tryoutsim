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
| `enum` | discriminators | `state`, `pathway`, `test`, `mode`, `lifecycle`, `notification.type`, `job.status` fixed sets |
| `unknown_field` | every body | a field not in the documented request shape is rejected, never ignored |
| `iso_utc` | timestamps | ISO-8601 `Z` |

## 2. Domain rules (by resource)

### exam-config approval (`POST /exam-configs/:id/approval`)

| path | rule |
|---|---|
| `body.configId` | `id_format`; must equal path `:id` |
| `body.acknowledgedWarnings` | must contain every outstanding UNV warning id the config carries |

The four bound values (`configId`, `configVersion`, `scoringVersion`, `regulatoryBasisHash`) are
server-computed from the current config at approval time — **the client never supplies them**
(they are bound server-side, preventing a forged approval). `approvedByUserAt`/`approvedBy` are
server-recorded evidence, not bound values
([CPNS_2026_REGULATIONS](../examination/CPNS_2026_REGULATIONS.md) §4.3). Only `configId` and
`acknowledgedWarnings` is client input.

### question (`POST/PATCH /questions`)

| path | rule |
|---|---|
| `test` | `enum` `TWK`/`TIU`/`TKP` |
| `competencyId` | must resolve to an existing competency in the taxonomy for that `test` |
| `options` | ≥ 2, non-empty text; TKP requires per-option weight in `[1,5]` (SC-05) |
| `answerKey` | points to an existing option; TKP key = weight map, no single "correct" |
| `lifecycle` | transitions per [QUESTION_SPECIFICATION](../examination/QUESTION_SPECIFICATION.md) §3 |
| `provenance` | present on create (BR-Q1) |
| `difficultyAiInitial` | `enum` `easy`/`medium`/`hard` |
| `difficulty.empirical` | **not a request field** — the server derives it, so a client cannot set it |

Structural/semantic question validity (V-01…V-12) is [QUESTION_SPECIFICATION](../examination/QUESTION_SPECIFICATION.md) §5,
not a field rule. There is **no** request that creates more than one question (no import, no bulk edit);
`POST /questions/bulk` accepts only `active → archived` ids.

### question report (`POST /questions/:id/reports`)

| path | rule |
|---|---|
| `severity` | `enum` `critical` / `non_critical` |
| `category` | `enum` `wrong_key` / `ambiguous` / `typo` / `explanation_unclear` / `other` |
| `note` | `non_empty` when `category = 'other'` |

### batch sampling (`POST /question-batches/:batchId/sample`)

| path | rule |
|---|---|
| `outcome` | `enum` `clean` / `findings` / `systemic` |
| `findings[]` | required and non-empty when `outcome === 'findings'`; each must be a question id of that batch |

The sampling **quota** is not a validation rule: it is an unresolved product parameter
([QUESTION_SPECIFICATION](../examination/QUESTION_SPECIFICATION.md) §6.2 rule 3). No minimum sample size
is enforced here until the Product Owner approves one.

### session (`POST /packages/:id/sessions`)

| path | rule |
|---|---|
| `mode` | `enum` `tryout`/`latihan`; must match the package's `mode` |
| `packageVersion` | optional `finite_integer` ≥ 1; must exist for that package |

**No `configId` and no `roster` are accepted.** The config is bound server-side to the newest usable CPNS
config and the roster is assembled server-side
([PACKAGE_SPECIFICATION](../product/PACKAGE_SPECIFICATION.md) §3–§4). An unknown field is rejected
(`VALIDATION_FAILED rule:"unknown_field"`), so an old client cannot quietly send one.

### answers (`PATCH /sessions/:id/answers`)

| path | rule |
|---|---|
| `questionId` | `id_format`; must be in the session's frozen roster |
| `selected` | one of the frozen option keys, or `null` |
| `elapsedActiveMs` | `finite_integer` ≥ 0 |
| `flagged` | boolean, optional |

Everything beyond this is preflight + scoring (§6, §11 of scoring).

### material (`POST/PATCH /materials`)

| path | rule |
|---|---|
| `contentType` | `enum` `conceptual`/`strategy`/`factual`/`legal`/`historical`/`policy` |
| `scope` | one of `{ kind: 'competency'|'domain', competencyId }` or `{ kind: 'free', note }` |
| `sources[]` | required and non-empty for factual/legal/historical/policy (M-03) |
| `status` | `draft`/`approved`/`retired`; `approved` only through `POST /materials/:id/approve` |

### package (`POST /packages`, `POST /packages/:id/versions`)

| path | rule |
|---|---|
| `kind` | `enum` `full_simulation`/`subtest`/`submateri` |
| `test` | required for `subtest`/`submateri`; forbidden for `full_simulation` |
| `competencyIds[]` | required for `submateri`; every id a non-deprecated leaf of that `test` |
| `itemCount` | `int_range` 1..500 |
| `difficultyMix` | shares sum to `itemCount`; keys in `easy`/`medium`/`hard` |
| `repeatPolicy` | `enum` `avoid_answered`/`allow_repeat` |

A package edit is a **new version**; `PUT /packages/:id` does not exist.

### provider (`POST/PATCH /providers`)

| path | rule |
|---|---|
| `preset` | `enum` `openrouter`/`openai_compatible`/`ollama`/`custom` |
| `baseUrl` | non-empty, http(s) schema, no credentials in URL |
| `defaultModel` | non-empty; any string is accepted (manual Model ID is allowed) |
| `headers/*` | never accept an `Authorization` value from response path back into storage (write-only) |
| `timeoutMs` | `int_range` positive |

Key handling is [SECRETS.md](./SECRETS.md); the key itself is never a validated request field
because it is never read back (`keyLast4` only).

### AI routing (`PUT /ai-routing`)

| path | rule |
|---|---|
| `default` | `{ providerId, modelId }` or `null`; both must resolve when non-null |
| `perTask.*` | same shape; the union of keys is the four task ids; an unknown task id is rejected |

### generation (`POST /generation-jobs`)

| path | rule |
|---|---|
| `competencyIds[]` | non-empty; each a valid leaf |
| `count` | `int_range` 1..session-max, batch sized so review ≤ 60 s/q (PRD §12) |

The routed provider+model pair must have a successful connection test recorded, else
`409 CONFLICT reason:"provider_untested"` ([AI_PROVIDER_ARCHITECTURE](../ai/AI_PROVIDER_ARCHITECTURE.md) §5).

### backup settings (`PUT /settings/backup`)

| path | rule |
|---|---|
| `folder` | absolute path, existing and writable; otherwise `VALIDATION_FAILED rule:"folder_unavailable"` |
| `keepLastN` | `int_range` 1..365 |
| `maxAgeDays` | `int_range` 1..3650 |

Rules: [DEPLOYMENT_AND_BACKUP](../architecture/DEPLOYMENT_AND_BACKUP.md) §2.3.

## 3. Boundary

- Semantic **scoring** rules → `PREFLIGHT_FAILED` ([SCORING_METHODOLOGY](../examination/SCORING_METHODOLOGY.md) §6).
- **Approval** mismatch → the verdict-only codes `APPROVAL_MISSING` / `APPROVAL_INVALID` /
  `APPROVAL_VERSION_MISMATCH` (inside a `200` result); a malformed threshold block →
  `THRESHOLD_CONFIG_INVALID` ([API_SPECIFICATION](./API_SPECIFICATION.md) §4).
- Field rules here are the only source of `VALIDATION_FAILED`.