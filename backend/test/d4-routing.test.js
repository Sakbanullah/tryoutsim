/**
 * D4 self-check: routing resolution order, the tested-pair rule, stored routing
 * round-trip and the `/ai-routing` body rules (AI_PROVIDER_ARCHITECTURE §4–§5;
 * VALIDATION §2).
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AppError } from '../src/errors.js';
import {
  TASKS, decodeStoredRouting, emptyRouting, encodeStoredRouting, isPairTested, parseRoutingBody,
  resolveRoute, toWireRouting,
} from '../src/domain/routing.js';

const Q = { providerId: 'p-q', modelId: 'm-q' };
const D = { providerId: 'p-d', modelId: 'm-d' };

test('perTask wins, then default, then unmapped — no third fallback', () => {
  const routing = { default: D, perTask: { question: Q } };
  assert.deepEqual(resolveRoute(routing, 'question'), { status: 'mapped', route: Q, source: 'override' });
  assert.deepEqual(resolveRoute(routing, 'material'), { status: 'mapped', route: D, source: 'default' });
  const bare = { default: null, perTask: {} };
  assert.equal(resolveRoute(bare, 'analysis').status, 'unmapped');
  assert.equal(resolveRoute(bare, 'question').effect, 'job_refused');
  assert.equal(resolveRoute(bare, 'analysis').effect, 'deterministic_order');
});

test('an explicit null override follows the default', () => {
  assert.deepEqual(resolveRoute({ default: D, perTask: { question: null } }, 'question'), {
    status: 'mapped', route: D, source: 'default',
  });
});

test('unknown task is not routable', () => {
  assert.deepEqual(resolveRoute({ default: D, perTask: {} }, 'backup'), { status: 'unmapped', task: 'backup', effect: 'unknown_task' });
});

test('the tested pair is the provider defaultModel with testedAt set', () => {
  assert.equal(isPairTested({ testedAt: '2026-11-10T00:00:00.000Z', defaultModel: 'm' }, 'm'), true);
  assert.equal(isPairTested({ testedAt: '2026-11-10T00:00:00.000Z', defaultModel: 'm' }, 'other'), false);
  assert.equal(isPairTested({ testedAt: null, defaultModel: 'm' }, 'm'), false);
});

test('stored routing round-trips through the single row', () => {
  const row = encodeStoredRouting({ default: D, perTask: { question: Q } });
  assert.equal(row.id, 'default');
  assert.deepEqual(decodeStoredRouting(row), { default: D, perTask: { question: Q } });
  assert.deepEqual(decodeStoredRouting(null), emptyRouting());
});

test('an unreadable perTaskJson drops overrides instead of guessing', () => {
  assert.deepEqual(decodeStoredRouting({ defaultProviderId: 'p', defaultModel: 'm', perTaskJson: '{not json' }), { default: { providerId: 'p', modelId: 'm' }, perTask: {} });
});

test('wire shape lists all four tasks, null where unmapped', () => {
  const wire = toWireRouting({ default: D, perTask: { analysis: Q } });
  assert.deepEqual(wire.default, D);
  assert.deepEqual(wire.perTask.map((entry) => entry.task), [...TASKS]);
  assert.deepEqual(wire.perTask.find((entry) => entry.task === 'analysis'), { task: 'analysis', ...Q });
  assert.deepEqual(wire.perTask.find((entry) => entry.task === 'question'), { task: 'question', providerId: null, modelId: null });
});

test('body validation: unknown task, half pair, unknown field, bad type', () => {
  const rejected = (body) =>
    assert.throws(() => parseRoutingBody(body), (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.code, 'VALIDATION_FAILED');
      assert.ok(error.details.fields.length > 0);
      return true;
    });
  rejected({ perTask: { backup: Q } });
  rejected({ default: { providerId: 'p', modelId: null } });
  rejected({ extra: true });
  rejected({ default: 'p' });
  rejected({ perTask: [] });
});

test('body validation: a full record parses, nulls included', () => {
  const parsed = parseRoutingBody({ default: null, perTask: { question: Q, analysis: null } });
  assert.deepEqual(parsed, { default: null, perTask: { question: Q, analysis: null } });
});
