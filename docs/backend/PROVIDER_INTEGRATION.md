# Provider Integration

Canonical source for how the backend wraps the configured AI provider. The interface contract is
[AI_PROVIDER_ARCHITECTURE.md](../ai/AI_PROVIDER_ARCHITECTURE.md) §2; this file is the backend-side
integration behaviour (transport, errors, secrets).

---

## 1. Transport

- One `ProviderTransport` implementation speaks an OpenAI-compatible chat interface
  (`listModels`, `chat`, `test`) — exactly the three methods in
  [AI_PROVIDER_ARCHITECTURE](../ai/AI_PROVIDER_ARCHITECTURE.md) §2. No provider-specific SDK beyond
  that surface.
- Outbound only; loopback binding of the API has no bearing on provider egress (the provider is the
  sole allowed network call, [PRD](../product/PRD.md) NFR-1).

## 2. Request mapping

`ChatRequest` → provider wire format:

| field | source |
|---|---|
| `model` | task→model map (FR-C4) or `defaultModel` |
| `messages` | built from [PROMPT_SPECIFICATION](../ai/PROMPT_SPECIFICATION.md) templates, grounded with injected goals |
| `responseFormat` | `json_object` when `jsonMode` capability is on |
| `maxContext` / `timeoutMs` | capability flag + provider setting |

Capability flags are **auto-detected on the connection test and manually correctable**; a model with
neither is treated conservatively (no JSON mode, no streaming, unknown context)
([AI_PROVIDER_ARCHITECTURE](../ai/AI_PROVIDER_ARCHITECTURE.md) §6).

## 2.1 Routing and the tested-pair rule

- The pair used by a request is `perTask[task]` if set, else the single global default
  ([AI_PROVIDER_ARCHITECTURE](../ai/AI_PROVIDER_ARCHITECTURE.md) §4).
- A job is refused with `409 CONFLICT reason:"provider_untested"` unless a successful test for that
  provider+model pair is recorded after the last edit to `baseUrl`, key or model.
- **No cross-provider fallback.** A failure is returned; the retry goes to the same pair unless the user
  changes the routing ([AI_PROVIDER_ARCHITECTURE](../ai/AI_PROVIDER_ARCHITECTURE.md) §7).

## 3. Secrets on the wire

- The transport obtains the key from [SECRETS.md](./SECRETS.md) at send time; it is injected into
  the auth header and **masked before any error marshalling** ([ERROR_HANDLING](./ERROR_HANDLING.md) §2).
- `headers`/`extraParams` are user-visible and forwarded as configured; nothing is forwarded silently.

## 4. Error mapping

Transport conditions map to envelope codes per [ERROR_HANDLING.md](./ERROR_HANDLING.md) §3. A
provider returning a JSON that fails the parse step is a `malformed_json` generation failure, not a
transport error ([QUESTION_GENERATION](../ai/QUESTION_GENERATION.md) §5).

## 5. Connection test

`POST /providers/:id/test` runs a minimal smoke (listModels or a 1-token chat) **and the capability
probe**, and returns the `ProviderTransport.test()` result of
[AI_PROVIDER_ARCHITECTURE](../ai/AI_PROVIDER_ARCHITECTURE.md) §2 —
`{ ok: true, latencyMs }` or `{ ok: false, latencyMs, reason }` — inside the success envelope, since a
failed test is a *result*, not an API error. `reason` is scrubbed by the SEC-2 scrubber before it is
returned ([AUTHENTICATION](./AUTHENTICATION.md), [API_ENDPOINTS](./API_ENDPOINTS.md) §8). A successful
test records `testedAt` and stores the detected capabilities with `source: 'auto'`.

## 5.1 Usage is read and discarded

A response's `usage` object is never persisted and never rendered, for any feature or job
([AI_PROVIDER_ARCHITECTURE](../ai/AI_PROVIDER_ARCHITECTURE.md) §9).

## 6. Boundary

Provider abstraction rationale/decision: [ADR-005](../architecture/ARCHITECTURE_DECISIONS.md) and
[AI_PROVIDER_ARCHITECTURE](../ai/AI_PROVIDER_ARCHITECTURE.md). This file does not redefine the
interface.