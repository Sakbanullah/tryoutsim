/**
 * D4 self-check: the one global model, the tested-pair rule, stored routing
 * round-trip and the `/ai-routing` body rules (AI_PROVIDER_ARCHITECTURE §4–§5;
 * VALIDATION §2; product decision: one global AI model, no per-task override).
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AppError } from '../src/errors.js';
import {
  decodeStoredRouting, emptyRouting, encodeStoredRouting, isPairTested, parseRoutingBody,
  resolveGlobalRoute, toWireRouting,
} from '../src/domain/routing.js';

const D = { providerId: 'p-d', modelId: 'm-d' };

test('the global default is the only route; no task id is consulted', () => {
  assert.deepEqual(resolveGlobalRoute({ default: D }, new Set(['p-d'])), { status: 'mapped', route: D, source: 'default' });
});

test('no global model: unmapped with the reason, never another provider', () => {
  assert.deepEqual(resolveGlobalRoute(emptyRouting(), new Set(['p-d'])), { status: 'unmapped', effect: 'global_model_unset' });
  assert.deepEqual(resolveGlobalRoute({ default: D }, new Set(['p-q'])), { status: 'unmapped', effect: 'provider_missing' });
});

test('the tested pair is the provider defaultModel with testedAt set', () => {
  assert.equal(isPairTested({ testedAt: '2026-11-10T00:00:00.000Z', defaultModel: 'm' }, 'm'), true);
  assert.equal(isPairTested({ testedAt: '2026-11-10T00:00:00.000Z', defaultModel: 'm' }, 'other'), false);
  assert.equal(isPairTested({ testedAt: null, defaultModel: 'm' }, 'm'), false);
});

test('stored routing round-trips through the single row', () => {
  const row = encodeStoredRouting({ default: D });
  assert.equal(row.id, 'default');
  assert.equal(row.perTaskJson, '{}', 'the legacy column stays empty and unused');
  assert.deepEqual(decodeStoredRouting(row), { default: D });
  assert.deepEqual(decodeStoredRouting(null), emptyRouting());
});

test('a stale perTask override in the row is ignored by the decoder', () => {
  const legacy = { defaultProviderId: 'p', defaultModel: 'm', perTaskJson: JSON.stringify({ question: { providerId: 'p-x', modelId: 'm-x' } }) };
  assert.deepEqual(decodeStoredRouting(legacy), { default: { providerId: 'p', modelId: 'm' } });
  // An unreadable value is equally irrelevant: the default still decodes.
  assert.deepEqual(decodeStoredRouting({ defaultProviderId: 'p', defaultModel: 'm', perTaskJson: '{not json' }), { default: { providerId: 'p', modelId: 'm' } });
});

test('wire shape carries the global default only', () => {
  assert.deepEqual(toWireRouting({ default: D }), { default: D });
  assert.deepEqual(toWireRouting(emptyRouting()), { default: { providerId: null, modelId: null } });
});

test('body validation: perTask, half pair, unknown field, bad type', () => {
  const rejected = (body) =>
    assert.throws(() => parseRoutingBody(body), (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.code, 'VALIDATION_FAILED');
      assert.ok(error.details.fields.length > 0);
      return true;
    });
  rejected({ perTask: { question: { providerId: 'p', modelId: 'm' } } });
  rejected({ default: D, perTask: [] });
  rejected({ default: { providerId: 'p', modelId: null } });
  rejected({ extra: true });
  rejected({ default: 'p' });
});

test('body validation: the global pair parses, null included', () => {
  assert.deepEqual(parseRoutingBody({ default: null }), { default: null });
  assert.deepEqual(parseRoutingBody({ default: D }), { default: D });
});
