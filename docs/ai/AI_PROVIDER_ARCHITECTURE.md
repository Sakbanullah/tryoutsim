# AI Provider Architecture

Canonical source for **how the app talks to external AI providers**. Referenced by
[PRD.md](../product/PRD.md) §8.8 (FR-C1…FR-C7) and O-5.

Backend-only. All keys and requests stay server-side and never reach the browser
([SECURITY.md](../architecture/SECURITY.md)).

---

## 1. Abstraction goal

The app must be provider-independent: switching provider/model changes only AI *outputs*, never
scoring, analytics, or recommendations ([PRD.md](../product/PRD.md) O-5, §13.6). So the provider is a
**single interface** that everything else depends on, never a concrete vendor.

## 2. Interface

```ts
type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

type ChatRequest = {
  modelId: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: { type: 'json_object' } | undefined;   // capability-gated, §5
  stream?: boolean;
};

type ChatResponse = {
  content: string;            // raw text or JSON string; caller parses/validates
  finishReason: 'stop' | 'length' | 'tool_calls' | 'error';
  usage?: { promptTokens: number; completionTokens: number };
};

type ProviderTransport = {
  listModels(): Promise<string[]>;
  chat(req: ChatRequest): Promise<ChatResponse>;
  test(): Promise<{ ok: boolean; error?: string }>;   // returns the provider's exact error text
};
```

One interface, N adapters (gateway / OpenAI-compatible). The adapter does not parse output — it
returns raw content; parsing and validation are the caller's job (see
[QUESTION_GENERATION.md](./QUESTION_GENERATION.md) and [AI_VALIDATION.md](./AI_VALIDATION.md)).

## 3. Provider record

```ts
type Provider = {
  id: string;                    // e.g. "9router"
  name: string;
  baseUrl: string;               // OpenAI-compatible base
  keyRef: string;                // reference to a write-only secret store entry; NOT the raw key
  headers: Record<string, string>;
  timeoutMs: number;
  retries: number;               // capped; exponential backoff
  extraParams: Record<string, unknown>;   // forwarded verbatim, visible to the user
  createdAt: string;
};
```

- The key is stored **write-only** via a reference; the UI shows only a masked tail (FR-C6, NFR-7).
- `extraParams` are surfaced to the user so nothing is applied silently.

## 4. Task → model mapping

Four tasks route to a provider+model pair ([PRD.md](../product/PRD.md) FR-C4):

| Task | id | Used by |
|---|---|---|
| Question | `question` | [QUESTION_GENERATION.md](./QUESTION_GENERATION.md) |
| Explanation | `explanation` | question generation (per-question rationale) |
| Material | `material` | [RECOMMENDATION_ENGINE.md](./RECOMMENDATION_ENGINE.md) learning-material draft |
| Analysis | `analysis` | analysis/recommendation reasoning (optional) |

A task may be unmapped; then that task's feature is disabled with a clear reason, never a silent
failure (FR-C7).

## 5. Capability flags

Per (provider, model) the user can edit (defaults guessed from a known-model table, `FR-C5`):

- `supportsJsonMode` — whether `responseFormat: json_object` is honored.
- `supportsStreaming` — whether `stream` is honored.
- `maxContextTokens` — the model's context window.

These **gate request parameters**, not the interface: the adapter drops `responseFormat` when
unsupported and the generation layer falls back to "emit JSON inside a code fence, then parse"
([PROMPT_SPECIFICATION.md](./PROMPT_SPECIFICATION.md)).

## 6. Timeout, retry, error mapping

| Provider condition | Product behaviour |
|---|---|
| Timeout | Single retry with backoff (cap from `retries`); then job marked `timeout`, raw message stored |
| 401/403 auth | No retry; job marked `auth`; tell the user the key is rejected |
| 429 rate limit | Retry up to cap honoring `Retry-After` when present; else `rate_limit` |
| Malformed / non-JSON | Not a transport error — handled by [AI_VALIDATION.md](./AI_VALIDATION.md) |

Each failure carries a **category** and the provider's raw message is viewable (FR-G6, US-B4).

## 7. Backend integration

The concrete who-calls-whom lives in
[PROVIDER_INTEGRATION.md](../backend/PROVIDER_INTEGRATION.md). This file owns the interface and the
record; the backend owns the job queue, persistence and routing.