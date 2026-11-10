# AI Provider Architecture

Canonical source for **how the app talks to external AI providers**: the interface, the provider record,
the presets, model discovery, capability handling, the **one global default**, failure behaviour and what
the product deliberately does **not** report. Referenced by [PRD.md](../product/PRD.md) §9.9
(FR-C1…FR-C8) and O-5.

Backend-only. All keys and requests stay server-side and never reach the browser
([SECURITY.md](../architecture/SECURITY.md), [SECRETS.md](../backend/SECRETS.md)).

---

## 1. Abstraction goal

The app must be provider-independent: switching provider/model changes only AI *outputs*, never
scoring, analytics, or recommendations ([PRD.md](../product/PRD.md) O-5, §13.6). So the provider is a
**single interface** that everything else depends on, never a concrete vendor.

**Offline is the baseline.** With no provider configured, expiry, or an unreachable endpoint, every
non-AI feature keeps working: packages, sessions, scoring, results, analytics, materials, reports,
backup and restore ([DEPLOYMENT_AND_BACKUP.md](../architecture/DEPLOYMENT_AND_BACKUP.md) §1.1).

## 2. Interface

```ts
type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

type ChatRequest = {
  modelId: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: { type: 'json_object' } | undefined;   // capability-gated, §6
  stream?: boolean;
};

type ChatResponse = {
  content: string;            // raw text or JSON string; caller parses/validates
  finishReason: 'stop' | 'length' | 'tool_calls' | 'error';
  usage?: { promptTokens: number; completionTokens: number };   // accepted, never persisted (§9)
};

type ProviderTransport = {
  listModels(): Promise<string[]>;                       // optional per provider (§5)
  chat(req: ChatRequest): Promise<ChatResponse>;
  // Same shape regardless of caller: latency in milliseconds, or a scrubbed reason on failure.
  test(): Promise<{ ok: true; latencyMs: number } | { ok: false; latencyMs: number; reason: string }>;
};
```

One interface, N adapters. The adapter does not parse output — it returns raw content; parsing and
validation are the caller's job ([QUESTION_GENERATION.md](./QUESTION_GENERATION.md),
[AI_VALIDATION.md](./AI_VALIDATION.md)).

## 3. Provider record and presets

```ts
type ProviderPreset = 'openrouter' | 'openai_compatible' | 'ollama' | 'custom';

type Provider = {
  id: string;                    // opaque
  name: string;                  // shown in the UI
  preset: ProviderPreset;
  baseUrl: string;               // OpenAI-compatible base
  keyRef: string | null;         // reference to OS secure storage; NOT the raw key; null for keyless providers
  headers: Record<string, string>;
  timeoutMs: number;
  retries: number;               // capped; exponential backoff
  extraParams: Record<string, unknown>;   // forwarded verbatim, visible to the user
  createdAt: string;
};
```

| Preset | `baseUrl` default | Key |
|---|---|---|
| `openrouter` | `https://openrouter.ai/api/v1` | required |
| `openai_compatible` | user-supplied (any OpenAI-compatible gateway) | usually required |
| `ollama` | `http://127.0.0.1:11434/v1` | none |
| `custom` | user-supplied | optional |

A preset only prefills `baseUrl` (and, for Ollama, the keyless shape). It is **not** a claim about what
the endpoint supports: capabilities are detected (§6), never implied by the preset.

- The key is stored **write-only** in OS secure storage via a reference; the UI shows only a masked tail
  (FR-C6, NFR-7, [SECRETS.md](../backend/SECRETS.md) §2).
- `extraParams` are surfaced to the user so nothing is applied silently.
- **Scrub before display (SEC-2).** Every string that can leave the adapter — `test().reason`, a job's
  stored raw message (§7), a transport error — passes one scrubber that strips the `Authorization`
  header value, anything matching the stored key or its last 4 digits, and any `sk-…`-shaped token.
  The stored raw message is the scrubbed text, not the wire text.

## 4. One global default, per-feature overrides

```ts
type AiRouting = {
  default: { providerId: string; modelId: string } | null;   // one global default
  perTask: Partial<Record<Task, { providerId: string; modelId: string }>>;  // overrides
};
```

Four tasks route to a provider+model pair ([PRD.md](../product/PRD.md) FR-C4):

| Task | id | Used by |
|---|---|---|
| Question | `question` | [QUESTION_GENERATION.md](./QUESTION_GENERATION.md) |
| Explanation | `explanation` | question generation (per-question rationale) |
| Material | `material` | [RECOMMENDATION_ENGINE.md](./RECOMMENDATION_ENGINE.md) learning-material draft |
| Analysis | `analysis` | recommendation ordering/explanation |

**Resolution order:** `perTask[task]` if set, else `default`. A task is *unmapped* only when both are
absent. There is no third fallback and no cross-provider fallback (§7).

A task may be unmapped; then that task's feature is disabled with a clear reason, never a silent
failure (FR-C7):

| Task unmapped | Effect |
|---|---|
| `question` | `POST /generation-jobs` returns `409 CONFLICT reason:"task_unmapped"` |
| `explanation` | generation still creates drafts; `explanation` left empty and flagged for the user to fill |
| `material` | recommendation offers `{ status: 'none', action: 'generate_material' }` and the action is disabled with the reason |
| `analysis` | recommendation ranking runs **without** the model — deterministic order, no narrative. It never falls back to an invented one |

## 5. Model selection

- **Auto list when supported.** If the provider answers `listModels()`, the UI offers the returned ids as
  a picker. The list is a convenience, never a guarantee that an id works — that is what the connection
  test is for.
- **Manual Model ID is always available.** Some gateways do not expose `/models`, some return a partial
  list, and some accept aliases. The user can type any model id, and it is accepted without being checked
  against the list.
- **Connection test before use.** A provider+model pair may be used by a job only after a successful
  `test()` call for that pair, recorded with a timestamp. Editing `baseUrl`, key or model resets it.
  - A job created against an untested pair is refused with `409 CONFLICT reason:"provider_untested"`.
  - A test failure surfaces the scrubbed reason and offers retry; it never silently disables the feature.

## 6. Capability flags — detected, then correctable

Per (provider, model) the app records:

```ts
type ModelCapabilities = {
  supportsJsonMode: boolean;
  supportsStreaming: boolean;
  maxContextTokens: number | null;
  source: 'auto' | 'manual';     // where the current values came from
  detectedAt: string | null;     // when auto-detection last ran
};
```

| Rule | Detail |
|---|---|
| **Detected automatically** | On the connection test the backend probes what it can (response format acceptance, streaming, a model-info route when the provider exposes one) and fills the fields it can establish. |
| **Manually correctable** | Every field is editable. A manual edit sets `source = 'manual'` and is never overwritten by a later auto-detection unless the user clears it. |
| **Never assume all models are equal** | There is no global default capability table. A model with nothing detected and nothing set has `supportsJsonMode = false`, `supportsStreaming = false`, `maxContextTokens = null` — the conservative reading, never an optimistic one. |
| **Capabilities gate requests** | The adapter drops `responseFormat` when unsupported and the prompt falls back to fenced JSON ([PROMPT_SPECIFICATION.md](./PROMPT_SPECIFICATION.md) §4). It never sends a parameter the model was not configured to accept. |
| **Capabilities gate job sizing** | `maxContextTokens` bounds a batch ([GENERATION_JOBS.md](../backend/GENERATION_JOBS.md) §3). A missing or too-small value reduces the questions per call; it never truncates a prompt silently. |

## 7. Failure behaviour — no automatic fallback

| Provider condition | Product behaviour |
|---|---|
| Timeout | Single retry with backoff (cap from `retries`), **same provider and model**; then the job batch is marked `timeout`, raw message stored |
| 401/403 auth | No retry; batch marked `auth`; tell the user the key is rejected |
| 429 rate limit | Retry up to cap honouring `Retry-After` when present; else `rate_limit` |
| 5xx / connection refused | Retry to cap; then `unavailable` |
| Malformed / non-JSON | Not a transport error — handled by [AI_VALIDATION.md](./AI_VALIDATION.md) |

Rules:

1. **No automatic fallback to another provider or model.** Switching providers changes outputs
   unpredictably and would silently mix provenance inside one batch. A failure is reported and the user
   chooses: retry the same pair, or change the routing and retry.
2. **Clear error, manual retry.** Every failure carries a category, the provider/model it happened on, and
   the scrubbed message; retry is an explicit action
   ([NOTIFICATION_SPECIFICATION.md](../backend/NOTIFICATION_SPECIFICATION.md) §2).
3. **Partial output is kept.** A batch that produced N valid questions before failing keeps them; the job
   reports partial counts ([GENERATION_JOBS.md](../backend/GENERATION_JOBS.md) §3).
4. **A provider request is never resumable mid-flight.** Retry starts a new request; it never claims to
   continue the failed one (§9 of the jobs doc).

## 8. Request construction

- Model resolution: §4.
- Prompts come from [PROMPT_SPECIFICATION.md](./PROMPT_SPECIFICATION.md) templates, grounded with the
  taxonomy goals ([COMPETENCY_TAXONOMY.md](../examination/COMPETENCY_TAXONOMY.md) §6).
- `maxTokens`, `temperature` and batching are decided per task by the backend, bounded by the capability
  record (§6); they are not user-tunable per job in MVP.

## 9. What the product does not report

| Not shown / not stored | Why |
|---|---|
| Token counts, cost, price, "usage this month" | The user pays the provider directly and the app is not a billing surface. `usage` may be read from a response and is **discarded** — never persisted, never rendered |
| A "cheapest/fastest model" recommendation | Would require unverified claims about providers |
| A global "provider health" score | A single success or failure is not a health metric |

This applies equally to **generation jobs**: a job screen shows status, counts, batches, and failures —
never tokens, cost or a rate.

## 10. Backend integration

The concrete who-calls-whom lives in
[PROVIDER_INTEGRATION.md](../backend/PROVIDER_INTEGRATION.md). This file owns the interface, the record,
the presets, the default routing and the capability rule; the backend owns the job queue, persistence and
routing.
