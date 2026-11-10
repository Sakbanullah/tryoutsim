/**
 * The OpenAI-compatible transport (AI_PROVIDER_ARCHITECTURE §2, §7;
 * PROVIDER_INTEGRATION §1–§5).
 *
 * One interface — `listModels`, `chat`, `test` — for every preset; no vendor
 * SDK. Every throw is a `ProviderFailure` carrying the registry code of
 * ERROR_HANDLING §3 and the batch `failureCategory` of QUESTION_GENERATION §6.
 * Request construction and status mapping are pure and exported so the wire
 * shape is testable without a socket; `fetchImpl` is injected.
 */

import {
  ProviderFailure,
  failedTest,
  keyMissingFailure,
} from './provider-errors.js';
import { scrub } from './scrub.js';

/** Backoff base for a retry (§7 "backoff"); doubles per attempt. */
const RETRY_BASE_MS = 250;

/**
 * The request for one chat call.
 *
 * `response_format` is sent only when the capability record says the model
 * accepts it; otherwise the prompt's fenced-JSON fallback applies and no
 * parameter the model was not configured for is sent (§6). `stream` is never
 * sent: MVP generation reads a whole response.
 *
 * @param {{model: string, messages: {role: string, content: string}[], temperature?: number, maxTokens?: number, capabilities?: {jsonMode?: {value: boolean}} | null}} req
 * @returns {{model: string, messages: {role: string, content: string}[], temperature?: number, max_tokens?: number, response_format?: {type: 'json_object'}}}
 */
export function buildChatBody(req) {
  /** @type {Record<string, unknown>} */
  const body = { model: req.model, messages: req.messages };
  if (typeof req.temperature === 'number') body.temperature = req.temperature;
  if (typeof req.maxTokens === 'number') body.max_tokens = req.maxTokens;
  if (req.capabilities?.jsonMode?.value === true) body.response_format = { type: 'json_object' };
  return /** @type {ReturnType<typeof buildChatBody>} */ (body);
}

/**
 * Read `Retry-After` (seconds or HTTP date) as milliseconds.
 * @param {Headers} headers
 * @returns {number | null}
 */
export function retryAfterMs(headers, now = Date.now) {
  const raw = headers.get('retry-after');
  if (raw === null) return null;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.trunc(seconds * 1000);
  const at = Date.parse(raw);
  return Number.isNaN(at) ? null : Math.max(0, at - now());
}

/**
 * Map a non-2xx provider answer to a `ProviderFailure` (ERROR_HANDLING §3).
 * @param {number} status
 * @param {Headers} headers
 * @returns {ProviderFailure}
 */
export function mapHttpStatus(status, headers) {
  if (status === 401 || status === 403) {
    return new ProviderFailure('auth', 'PROVIDER_AUTH_FAILED', 'The provider rejected the API key.');
  }
  if (status === 429) {
    return new ProviderFailure('rate_limit', 'RATE_LIMITED', 'The provider rate limit was reached.', {
      retryAfterMs: retryAfterMs(headers),
    });
  }
  return new ProviderFailure('unavailable', 'PROVIDER_UNAVAILABLE', `The provider answered with HTTP ${status}.`, {
    reason: `http_${status}`,
  });
}

/**
 * Turn a thrown transport error into a registry failure, scrubbed.
 * @param {unknown} error
 * @param {{timeoutMs: number, key: string | null}} context
 * @returns {ProviderFailure}
 */
export function mapTransportError(error, { timeoutMs, key }) {
  const name = /** @type {{name?: string}} */ (error)?.name;
  const message = scrub(error instanceof Error ? error.message : String(error), key);
  if (name === 'TimeoutError' || name === 'AbortError') {
    return new ProviderFailure('timeout', 'PROVIDER_TIMEOUT', `The provider did not answer within ${timeoutMs} ms.`, {
      timeoutMs,
    });
  }
  return new ProviderFailure('unavailable', 'PROVIDER_UNAVAILABLE', `The provider could not be reached: ${message}`, {
    reason: 'connection_refused',
  });
}

/**
 * Wait for a backoff delay. The transport, unlike scoring, may read a clock.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.min(Math.max(ms, 1), 8000)));
}

/**
 * Build the transport for one provider configuration.
 *
 * @param {object} options
 * @param {string} options.providerId
 * @param {string} options.baseUrl normalised, no trailing slash
 * @param {Record<string, string>} options.headers stored headers (never Authorization)
 * @param {number} options.timeoutMs
 * @param {number} options.retries bounded retry count (§7 "cap from `retries`")
 * @param {Record<string, unknown>} options.extraParams forwarded verbatim into chat bodies
 * @param {(modelId: string) => {jsonMode?: {value: boolean}} | null} options.capabilitiesFor the stored capability record for a model
 * @param {() => Promise<string | null>} options.getKey reads the key at send time
 * @param {typeof fetch} [options.fetchImpl] injected in tests
 */
export function createProviderClient({
  providerId,
  baseUrl,
  headers,
  timeoutMs,
  retries,
  extraParams,
  capabilitiesFor,
  getKey,
  fetchImpl = fetch,
}) {
  /**
   * One HTTP attempt, JSON body. Throws a `ProviderFailure` on any non-2xx,
   * timeout, connection error or non-JSON body.
   * @param {string} path
   * @param {{method?: string, body?: unknown, key: string}} options
   * @returns {Promise<any>}
   */
  async function send(path, { method = 'GET', body, key }) {
    /** @type {Record<string, string>} */
    const requestHeaders = { accept: 'application/json', ...headers, authorization: `Bearer ${key}` };
    if (body !== undefined) requestHeaders['content-type'] = 'application/json';

    let response;
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        method,
        headers: requestHeaders,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      throw mapTransportError(error, { timeoutMs, key });
    }
    if (!response.ok) throw mapHttpStatus(response.status, response.headers);

    try {
      return JSON.parse(await response.text());
    } catch {
      throw new ProviderFailure('provider_error', 'PROVIDER_UNAVAILABLE', 'The provider returned a body that is not JSON.', {
        reason: 'malformed_response',
      });
    }
  }

  /**
   * The §7 retry policy: `auth` never retries; timeout, rate limit and
   * unavailability retry up to `retries`, preferring `Retry-After`. The key is
   * re-read for each attempt.
   * @template T
   * @param {(key: string) => Promise<T>} operation
   * @returns {Promise<T>}
   */
  async function withRetry(operation) {
    for (let attempt = 0; ; attempt += 1) {
      const key = await getKey();
      if (key === null) throw keyMissingFailure(providerId);
      try {
        return await operation(key);
      } catch (error) {
        if (!(error instanceof ProviderFailure) || error.kind === 'auth' || attempt >= retries) throw error;
        const advised = error.kind === 'rate_limit' ? error.details.retryAfterMs : null;
        await sleep(advised ?? RETRY_BASE_MS * 2 ** attempt);
      }
    }
  }

  /**
   * Probe whether the model accepts `response_format: json_object` (§6).
   * `true` = accepted, `false` = refused, `null` = not established.
   * An auth failure rethrows: the key is wrong, which is the test's real answer.
   * @param {string} modelId
   * @returns {Promise<boolean | null>}
   */
  async function probeJsonMode(modelId) {
    const key = await getKey();
    if (key === null) throw keyMissingFailure(providerId);
    try {
      await send('/chat/completions', {
        method: 'POST',
        key,
        body: {
          ...extraParams,
          model: modelId,
          messages: [{ role: 'user', content: 'Reply with {"ok":true}.' }],
          max_tokens: 16,
          response_format: { type: 'json_object' },
        },
      });
      return true;
    } catch (error) {
      if (error instanceof ProviderFailure && error.kind === 'auth') throw error;
      return error instanceof ProviderFailure && error.code === 'PROVIDER_UNAVAILABLE' ? false : null;
    }
  }

  return {
    /** `GET /models` → ids. A convenience list, never an allow-list (§5). */
    async listModels() {
      const body = /** @type {{data?: unknown}} */ (await withRetry((key) => send('/models', { key })));
      const data = body?.data;
      if (!Array.isArray(data)) {
        throw new ProviderFailure('provider_error', 'PROVIDER_UNAVAILABLE', 'The provider returned no model list.', {
          reason: 'malformed_response',
        });
      }
      return /** @type {{id?: unknown}[]} */ (data)
        .map((entry) => entry?.id)
        .filter((id) => typeof id === 'string' && id.length > 0);
    },

    /**
     * `POST /chat/completions`. Returns raw content; parsing and validation are
     * the caller's job (§2). `usage` is read and discarded (§9).
     * @param {{modelId: string, messages: {role: string, content: string}[], temperature?: number, maxTokens?: number}} req
     * @returns {Promise<{content: string, finishReason: string}>}
     */
    async chat(req) {
      const body = {
        ...extraParams,
        ...buildChatBody({ ...req, model: req.modelId, capabilities: capabilitiesFor(req.modelId) }),
      };
      const answer = await withRetry((key) => send('/chat/completions', { method: 'POST', body, key }));
      const choice = /** @type {{choices?: {message?: {content?: unknown}, finish_reason?: string}[]}} */ (answer)?.choices?.[0];
      if (typeof choice?.message?.content !== 'string') {
        throw new ProviderFailure('provider_error', 'PROVIDER_UNAVAILABLE', 'The provider returned no message content.', {
          reason: 'malformed_response',
        });
      }
      return { content: choice.message.content, finishReason: choice.finish_reason ?? 'stop' };
    },

    /**
     * The connection test of PROVIDER_INTEGRATION §5: a minimal one-token chat,
     * then the capability probe. Throws `keyMissingFailure` for a provider that
     * needs a key and has none — that is a refusal, not a test result.
     * @param {string} modelId
     * @returns {Promise<{ok: true, latencyMs: number, detected: {jsonMode: boolean | null, streaming: null, maxContext: null}} | {ok: false, latencyMs: number, reason: string}>}
     */
    async test(modelId) {
      if ((await getKey()) === null) throw keyMissingFailure(providerId);
      const startedAt = Date.now();
      try {
        await withRetry((key) =>
          send('/chat/completions', {
            method: 'POST',
            key,
            body: { ...extraParams, model: modelId, messages: [{ role: 'user', content: 'Reply with OK.' }], max_tokens: 1 },
          }),
        );
        const jsonMode = await probeJsonMode(modelId);
        return {
          ok: true,
          latencyMs: Date.now() - startedAt,
          // Streaming and context size are not probed: an unverified value stays
          // `null` and reads conservatively (§6). Only a provider `model` route
          // could establish context, and no canonical doc defines one.
          detected: { jsonMode, streaming: null, maxContext: null },
        };
      } catch (error) {
        if (error instanceof ProviderFailure && error.kind === 'auth' && error.details.reason === 'key_missing') throw error;
        return { ...failedTest(error), latencyMs: Date.now() - startedAt };
      }
    },
  };
}
