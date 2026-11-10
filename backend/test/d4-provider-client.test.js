/**
 * D4 self-check: the OpenAI-compatible transport maps every provider condition to
 * the registry code and failure category of ERROR_HANDLING §3 and
 * QUESTION_GENERATION §6, never leaks the key, and gates `response_format` on the
 * capability record. No socket: `fetchImpl` is injected.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildChatBody, createProviderClient, mapHttpStatus, retryAfterMs } from '../src/domain/provider-client.js';
import { ProviderFailure } from '../src/domain/provider-errors.js';

const KEY = 'sk-test-0123456789abcdefWXYZ';

/**
 * Build a transport with a scripted fetch.
 * @param {(url: string, init: any) => Promise<Response> | Response} handler
 * @param {object} [overrides]
 */
function client(handler, overrides = {}) {
  /** @type {any[]} */
  const calls = [];
  const transport = createProviderClient({
    providerId: 'p1',
    baseUrl: 'https://example.test/v1',
    headers: {},
    timeoutMs: 1000,
    retries: 1,
    extraParams: {},
    capabilitiesFor: () => ({ jsonMode: { value: false } }),
    getKey: async () => KEY,
    fetchImpl: (async (url, init) => {
      calls.push({ url, init });
      return handler(String(url), init);
    }),
    ...overrides,
  });
  return { transport, calls };
}

/** A JSON response. */
function json(status, body, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
}

/** Assert a thrown ProviderFailure's registry code and category. */
async function expectFailure(promise, code, category) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof ProviderFailure);
    assert.equal(error.code, code);
    assert.equal(error.failureCategory, category);
    assert.ok(!error.message.includes(KEY), 'the failure message carries the key');
    return true;
  });
}

test('401 and 403 are auth, never retried, never echoed', async () => {
  for (const status of [401, 403]) {
    let calls = 0;
    const { transport } = client(() => {
      calls += 1;
      return json(status, { error: { message: `bad key ${KEY}` } });
    });
    await expectFailure(transport.chat({ modelId: 'm', messages: [] }), 'PROVIDER_AUTH_FAILED', 'auth');
    assert.equal(calls, 1, 'auth must not be retried');
  }
});

test('429 is rate-limited, retried up to the cap, retryAfterMs parsed', async () => {
  let calls = 0;
  const { transport } = client(() => {
    calls += 1;
    return json(429, {}, { 'retry-after': '0' });
  });
  await assert.rejects(transport.chat({ modelId: 'm', messages: [] }), (error) => {
    assert.equal(error.code, 'RATE_LIMITED');
    assert.equal(error.failureCategory, 'rate_limit');
    assert.equal(error.details.retryAfterMs, 0);
    return true;
  });
  assert.equal(calls, 2, 'one retry after the first 429');
});

test('429 then success resolves inside the retry cap', async () => {
  let calls = 0;
  const { transport } = client(() => {
    calls += 1;
    if (calls === 1) return json(429, {});
    return json(200, { choices: [{ message: { content: '{"questions":[]}' }, finish_reason: 'stop' }] });
  });
  const answer = await transport.chat({ modelId: 'm', messages: [] });
  assert.equal(answer.content, '{"questions":[]}');
  assert.equal(calls, 2);
});

test('5xx is unavailable after the cap', async () => {
  let calls = 0;
  const { transport } = client(() => {
    calls += 1;
    return json(503, {});
  });
  await expectFailure(transport.chat({ modelId: 'm', messages: [] }), 'PROVIDER_UNAVAILABLE', 'provider_error');
  assert.equal(calls, 2);
});

test('connection refused and timeout map to their codes', async () => {
  await assert.rejects(
    client(() => {
      throw new TypeError('fetch failed');
    }).transport.chat({ modelId: 'm', messages: [] }),
    (error) => error.code === 'PROVIDER_UNAVAILABLE' && error.failureCategory === 'provider_error',
  );
  await assert.rejects(
    client(() => {
      throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    }).transport.chat({ modelId: 'm', messages: [] }),
    (error) => error.code === 'PROVIDER_TIMEOUT' && error.failureCategory === 'timeout' && error.details.timeoutMs === 1000,
  );
});

test('a non-JSON body is malformed_response, PROVIDER_UNAVAILABLE', async () => {
  await assert.rejects(
    client(() => new Response('<html>proxy</html>', { status: 200 })).transport.chat({ modelId: 'm', messages: [] }),
    (error) => error.code === 'PROVIDER_UNAVAILABLE' && error.details.reason === 'malformed_response',
  );
});

test('a missing key is refused before any request is sent', async () => {
  let calls = 0;
  const { transport } = client(
    () => {
      calls += 1;
      return json(200, {});
    },
    { getKey: async () => null },
  );
  await assert.rejects(transport.chat({ modelId: 'm', messages: [] }), (error) => error.code === 'PROVIDER_AUTH_FAILED');
  assert.equal(calls, 0);
});

test('the key travels only in the Authorization header', async () => {
  const { transport, calls } = client((url) => (url.endsWith('/models') ? json(200, { data: [{ id: 'a' }] }) : json(200, { choices: [{ message: { content: 'ok' } }] })));
  await transport.chat({ modelId: 'm', messages: [{ role: 'user', content: 'hi' }] });
  await transport.listModels();
  for (const { init } of calls) {
    assert.equal(init.headers.authorization, `Bearer ${KEY}`);
    assert.ok(!JSON.stringify(init.body ?? '').includes(KEY), 'the key must not be in a request body');
  }
});

test('response_format is sent only with the JSON-mode capability', () => {
  const messages = [{ role: 'user', content: 'x' }];
  assert.equal(buildChatBody({ model: 'm', messages, capabilities: { jsonMode: { value: true } } }).response_format?.type, 'json_object');
  assert.equal(buildChatBody({ model: 'm', messages, capabilities: { jsonMode: { value: false } } }).response_format, undefined);
  assert.equal(buildChatBody({ model: 'm', messages, capabilities: null }).response_format, undefined);
});

test('chat bodies carry no stream flag and no usage', async () => {
  const { transport, calls } = client(() =>
    json(200, { choices: [{ message: { content: 'x' }, finish_reason: 'stop' }], usage: { prompt_tokens: 5, completion_tokens: 2 } }),
  );
  const answer = await transport.chat({ modelId: 'm', messages: [] });
  assert.deepEqual(Object.keys(answer).sort(), ['content', 'finishReason']);
  assert.equal('stream' in JSON.parse(calls[0].init.body), false);
});

test('test() returns a value on failure and throws only for a missing key', async () => {
  const failing = client(() => json(401, {})).transport;
  const result = await failing.test('m');
  assert.equal(result.ok, false);
  assert.equal(typeof result.reason, 'string');
  assert.ok(!result.reason.includes(KEY));

  const ok = client((url, init) =>
    JSON.parse(init.body).response_format ? json(400, {}) : json(200, { choices: [{ message: { content: 'OK' } }] }),
  ).transport;
  const passing = await ok.test('m');
  assert.equal(passing.ok, true);
  assert.equal(passing.detected.jsonMode, false, 'a refused response_format is detected false');
  assert.equal(passing.detected.streaming, null, 'unprobed fields stay null');
  assert.equal(passing.detected.maxContext, null);
});

test('listModels returns ids and rejects a malformed list', async () => {
  const ids = await client(() => json(200, { data: [{ id: 'a' }, { id: 'b' }, {}] })).transport.listModels();
  assert.deepEqual(ids, ['a', 'b']);
  await assert.rejects(client(() => json(200, { models: [] })).transport.listModels(), (error) => error.code === 'PROVIDER_UNAVAILABLE');
});

test('status mapping and Retry-After parsing are pure', () => {
  assert.equal(mapHttpStatus(401, new Headers()).code, 'PROVIDER_AUTH_FAILED');
  assert.equal(mapHttpStatus(429, new Headers({ 'retry-after': '2' })).details.retryAfterMs, 2000);
  assert.equal(mapHttpStatus(429, new Headers()).details.retryAfterMs, null);
  assert.equal(mapHttpStatus(500, new Headers()).code, 'PROVIDER_UNAVAILABLE');
  assert.equal(retryAfterMs(new Headers({ 'retry-after': 'not-a-date' })), null);
});
