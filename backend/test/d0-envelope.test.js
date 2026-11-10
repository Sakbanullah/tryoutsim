/**
 * D0 self-check: the envelope, error registry and router behave as the contract
 * says, with no database involved (`node --test`).
 */

import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';
import { AppError, ERROR_STATUS, validationError } from '../src/errors.js';
import { CONTRACT_VERSION, failure, success } from '../src/http/envelope.js';
import { createRouter } from '../src/http/router.js';
import { createHttpServer } from '../src/http/server.js';
import { FieldErrors, uniqueStringArray } from '../src/http/validation.js';

test('success envelope carries the contract version', () => {
  assert.deepEqual(success({ a: 1 }), { data: { a: 1 }, meta: { version: CONTRACT_VERSION } });
});

test('error envelope is one object with a request id', () => {
  const body = failure(new AppError('NOT_FOUND', 'gone', { resource: 'x', id: '1' }), 'rid');
  assert.deepEqual(body, {
    error: { code: 'NOT_FOUND', message: 'gone', details: { resource: 'x', id: '1' }, requestId: 'rid' },
  });
  assert.equal(body.error.details === null, false);
});

test('registry statuses match the API table', () => {
  assert.equal(ERROR_STATUS.VALIDATION_FAILED, 400);
  assert.equal(new AppError('CONFLICT', 'x', {}).status, 409);
});

test('field errors are collected, not thrown one at a time', () => {
  const errors = new FieldErrors();
  uniqueStringArray(errors, ['a', 'a'], 'ids', 20);
  errors.add('name', 'name is required.', 'required');
  assert.deepEqual(errors.throwIfAny, errors.throwIfAny);
  assert.throws(() => errors.throwIfAny(), (error) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.code, 'VALIDATION_FAILED');
    assert.equal(error.details.fields.length, 2);
    assert.equal(error.details.fields[0].rule, 'unique_items');
    return true;
  });
});

test('router matches a parameter and reports a method mismatch separately', () => {
  const router = createRouter();
  router.add('GET', '/sessions/:id', async ({ params }) => ({ data: params }));
  const hit = router.match('GET', '/sessions/abc');
  assert.ok(hit && 'handler' in hit);
  assert.deepEqual(hit.params, { id: 'abc' });
  const other = router.match('DELETE', '/sessions/abc');
  assert.ok(other && 'allowed' in other);
  assert.deepEqual(other.allowed, ['GET']);
  assert.equal(router.match('GET', '/sessions'), null);
});

test('server writes the envelope and a 500 for an unhandled throw', async () => {
  const router = createRouter();
  router.add('GET', '/boom', async () => { throw new Error('secret detail'); });
  router.add('GET', '/ok', async () => ({ data: { fine: true } }));
  const silent = { info: () => {}, error: () => {} };
  const server = createHttpServer({ router, logger: silent });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = /** @type {import('node:net').AddressInfo} */ (server.address());
  const base = `http://127.0.0.1:${port}/api/v1`;

  try {
    const ok = await fetch(`${base}/ok`);
    assert.equal(ok.status, 200);
    assert.deepEqual(await ok.json(), { data: { fine: true }, meta: { version: CONTRACT_VERSION } });

    const boom = await fetch(`${base}/boom`);
    assert.equal(boom.status, 500);
    const boomBody = await boom.json();
    assert.equal(boomBody.error.code, 'INTERNAL');
    assert.doesNotMatch(boomBody.error.message, /secret detail/);

    const missing = await fetch(`${base}/nope`);
    assert.equal(missing.status, 404);
    assert.equal((await missing.json()).error.code, 'NOT_FOUND');

    const wrongMethod = await fetch(`${base}/ok`, { method: 'POST', body: '{}' });
    assert.equal(wrongMethod.status, 409, 'a path known only under another method is a method refusal, not a 404');
    assert.equal((await wrongMethod.json()).error.details.reason, 'method_not_allowed');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

before(() => {});
after(() => {});
