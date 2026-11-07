# AI Output Validation

Canonical source for the **AI-output-specific** guardrails applied to provider responses **before**
they enter the question data model. The canonical question-schema validation (V-01…V-12) is
[QUESTION_SPECIFICATION.md](../examination/QUESTION_SPECIFICATION.md) §5 and is **not** restated here.

This file is deliberately narrow, to avoid duplicating the schema: it owns only what concerns
*AI-generated* content.

---

## 1. Layer order

```
provider raw response
  → A. parse (JSON / fenced JSON fallback)          [this file]
  → B. structural shape check                        [this file]
  → C. question schema validation V-01…V-12          [QUESTION_SPECIFICATION.md §5]
  → D. lifecycle draft → human_reviewed → active     [QUESTION_SPECIFICATION.md §3]
```

AI validation is A + B. Anything that is true for *human-authored* questions too lives in C, not here.

## 2. A — parse

- Accept the object, or a fenced ```` ```json ```` block per
  [PROMPT_SPECIFICATION.md](./PROMPT_SPECIFICATION.md) §4.
- Failure → `malformed_json`.

## 3. B — structural shape checks

| ID | Check | Failure category |
|---|---|---|
| AI-01 | top-level object, `questions` is a non-empty array | `schema_violation` |
| AI-02 | each item has `stem`, `options` (array of `{key,text}`), `answerKey`, `explanation` | `schema_violation` |
| AI-03 | `optionScores` is an object keyed by the same `key` values as `options` | `schema_violation` |
| AI-04 | option keys are a subset of `A..E`, distinct | `schema_violation` |
| AI-05 | no `optionScores` value is negative or non-numeric | `schema_violation` |
| AI-06 | no prohibited string: "Soal Resmi", "Soal CPNS/BKN", official logo reference | `schema_violation` (and blocks, per §2.1) |

AI-01…05 mirror, but do not replace, V-01/V-02 and SC-01…SC-08: the AI checks run on the *raw
provider payload* before it is shaped into a `Question`; V/SC rules run on the constructed record and
carry the config in force. The overlap is intentional (defence in depth), not duplication.

## 4. Answer-key plausibility (advisory only)

For TWK/TIU output, if exactly one option is marked full score, the pipeline may pre-populate an
"accept" suggestion — but **only** the user accepting it and SC-04 passing makes it `active`. There is
no automatic key-authoring. TKP is never auto-judged "correct"; the user assigns weights and
[SCORING_METHODOLOGY.md](../examination/SCORING_METHODOLOGY.md) §6.1 validates them.

## 5. What this file does NOT do

- It does **not** assign a lifecycle state (that is [QUESTION_SPECIFICATION.md](../examination/QUESTION_SPECIFICATION.md) §3).
- It does **not** judge TKP "correctness" (attainment only, [SCORING_METHODOLOGY.md](../examination/SCORING_METHODOLOGY.md) §9).
- It does **not** define weakness/recommendation logic ([RECOMMENDATION_ENGINE.md](./RECOMMENDATION_ENGINE.md)).