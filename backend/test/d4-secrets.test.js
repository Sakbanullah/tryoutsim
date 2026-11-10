/**
 * D4 self-check: secrets are write-only. The masked tail is the only value that
 * leaves the store, the memory store behaves like the OS store for the DB-4
 * ordering, and the scrubber strips key shapes from anything that can be stored
 * or shown (SECRETS §1–§3; AI_PROVIDER_ARCHITECTURE §3 SEC-2).
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { scrub } from '../src/domain/scrub.js';
import { toProviderView } from '../src/domain/provider-input.js';
import { parseCreateProvider, parseUpdateProvider } from '../src/domain/provider-input.js';
import { AppError } from '../src/errors.js';
import { entryName, keyLast4, createMemorySecretStore, STORE_KINDS } from '../src/secrets/secret-store.js';

const KEY = 'sk-live-abcdefghijklmnopQRST';

test('keyLast4 is the last four characters and nothing more', () => {
  assert.equal(keyLast4(KEY), 'QRST');
  assert.equal(keyLast4(KEY).length, 4);
  assert.equal(keyLast4('abc'), 'abc');
  assert.throws(() => keyLast4(''));
});

test('entry names are install-scoped and carry no key material', () => {
  const name = entryName('install-a', 'provider-1');
  assert.equal(name, 'tryoutsim/install-a/provider/provider-1');
  assert.notEqual(entryName('install-a', 'p'), entryName('install-b', 'p'));
  assert.throws(() => entryName('', 'p'));
});

test('the store kind is one the schema accepts', () => {
  assert.ok(STORE_KINDS.includes(createMemorySecretStore().kind));
});

test('memory store: write / read / delete behave like the OS store', async () => {
  const store = createMemorySecretStore();
  await store.write('n', KEY);
  assert.equal(await store.read('n'), KEY);
  assert.equal(await store.delete('n'), true);
  assert.equal(await store.read('n'), null);
  assert.equal(await store.delete('n'), false);
  await assert.rejects(store.write('n', ''));
});

test('scrubber removes the stored key, Authorization values and sk- tokens', () => {
  assert.ok(!scrub(`failed with ${KEY}`, KEY).includes(KEY));
  assert.equal(scrub('Authorization: Bearer abcdefghijklmnop'), '[redacted]');
  assert.equal(scrub('key sk-ABCDEFGHIJKLMNOP rejected'), 'key [redacted] rejected');
  assert.equal(scrub('x-api-key: zzzzzzzzzzzz'), '[redacted]');
  // The masked tail is shown by design (SECRETS §1) and must survive.
  assert.ok(scrub('stored key ending QRST').includes('QRST'));
});

test('the provider wire shape never contains the key', () => {
  const row = {
    id: 'p1', preset: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1', defaultModel: 'm', timeoutMs: 1000,
    testedAt: null, capabilityFlagsJson: '{}', headersJson: '{}', extraParamsJson: '{}',
  };
  const view = toProviderView(row, { keyLast4: keyLast4(KEY), hasKey: 1 });
  assert.equal(view.keyLast4, 'QRST');
  assert.equal(view.hasKey, true);
  assert.equal(JSON.stringify(view).includes(KEY), false);
  assert.equal(toProviderView(row, null).hasKey, false);
});

test('create input keeps the key only in the returned value, never in a field error', () => {
  const input = parseCreateProvider({ preset: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1', key: KEY, defaultModel: 'm' });
  assert.equal(input.key, KEY);
  for (const body of [
    { preset: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1' },
    { preset: 'nope', baseUrl: 'https://x.test/v1', key: KEY },
    { preset: 'custom', baseUrl: 'https://x.test/v1', key: `${KEY} with space` },
    { preset: 'custom', baseUrl: 'https://x.test/v1', key: KEY, headers: { Authorization: `Bearer ${KEY}` } },
  ]) {
    assert.throws(() => parseCreateProvider(body), (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(JSON.stringify(error.message).includes(KEY), false);
      assert.equal(JSON.stringify(error.details).includes(KEY), false);
      return true;
    });
  }
});

test('an Authorization header cannot be stored; a stored header is kept', () => {
  const input = parseCreateProvider({ preset: 'custom', baseUrl: 'https://x.test/v1', headers: { 'x-app': 'tryoutsim' } });
  assert.deepEqual(input.headers, { 'x-app': 'tryoutsim' });
});

test('an Ollama preset needs no key; OpenRouter does', () => {
  assert.equal(parseCreateProvider({ preset: 'ollama' }).key, null);
  assert.throws(() => parseCreateProvider({ preset: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1' }), (error) => error.code === 'VALIDATION_FAILED');
});

test('PATCH leaves the key untouched when absent and null removes it', () => {
  assert.equal('key' in parseUpdateProvider({ baseUrl: 'https://y.test/v1' }), false);
  assert.equal(parseUpdateProvider({ key: null }).key, null);
  assert.equal(parseUpdateProvider({ key: KEY }).key, KEY);
  assert.throws(() => parseUpdateProvider({ preset: 'ollama' }), (error) => error.code === 'VALIDATION_FAILED');
});
