/**
 * Retiring a package (PACKAGE_SPECIFICATION §5 "deleting a package retires it"; API_ENDPOINTS §3
 * `POST /packages/:id/retire`): the row keeps `retiredAt`, leaves the list, and its versions stay readable.
 * Checked against a fake Prisma client, so no database is needed.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AppError } from '../src/errors.js';
import { listPackages, retirePackage } from '../src/repositories/package.js';

/** A package with one version, over the two calls `retirePackage` and `listPackages` make. */
function fakePrisma(pkg) {
  let row = { ...pkg };
  const calls = { update: [], raw: [], findVersion: 0 };
  return {
    calls,
    package: {
      findUnique: async ({ where }) => (where.id === row.id ? { ...row } : null),
      // The conditional UPDATE of BUG-002: the same `where` a real `updateMany` gets.
      updateMany: async ({ where, data }) => {
        const matches = where.id === row.id && (where.retiredAt !== null || row.retiredAt === null);
        if (!matches) return { count: 0 };
        calls.update.push({ where, data });
        row = { ...row, ...data };
        return { count: 1 };
      },
    },
    packageVersion: {
      findFirst: async () => {
        calls.findVersion += 1;
        return { packageId: pkg.id, version: 1, definitionJson: '{}', titleId: 'Uji', examConfigId: null, examConfigVersion: null };
      },
    },
    // Only the "no mode" branch of listPackages is exercised; it returns no rows, which is enough.
    $queryRaw: async (strings) => {
      calls.raw.push(strings.join('?'));
      return [];
    },
  };
}

const PKG = { id: 'pkg-1', mode: 'tryout', source: 'custom', retiredAt: null };

test('retire sets retiredAt once and leaves versions in place', async () => {
  const prisma = fakePrisma(PKG);
  const retired = await retirePackage(prisma, 'pkg-1', '2026-11-12T00:00:00.000Z');
  assert.equal(retired.pkg.retiredAt, '2026-11-12T00:00:00.000Z');
  assert.equal(retired.version.version, 1);
  assert.deepEqual(prisma.calls.update, [{ where: { id: 'pkg-1', retiredAt: null }, data: { retiredAt: '2026-11-12T00:00:00.000Z' } }]);
});

test('retiring an unknown package is NOT_FOUND and writes nothing', async () => {
  const prisma = fakePrisma(PKG);
  await assert.rejects(() => retirePackage(prisma, 'nope', '2026-11-12T00:00:00.000Z'), (error) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.status, 404);
    return true;
  });
  assert.equal(prisma.calls.update.length, 0);
});

test('retiring a retired package is a 409 conflict and writes nothing', async () => {
  const prisma = fakePrisma({ ...PKG, retiredAt: '2026-11-01T00:00:00.000Z' });
  await assert.rejects(() => retirePackage(prisma, 'pkg-1', '2026-11-12T00:00:00.000Z'), (error) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.status, 409);
    assert.equal(error.details.reason, 'illegal_transition');
    return true;
  });
  assert.equal(prisma.calls.update.length, 0);
});

test('the list query skips retired packages in both branches', async () => {
  for (const mode of ['tryout', null]) {
    const prisma = fakePrisma(PKG);
    await listPackages(prisma, mode);
    assert.equal(prisma.calls.raw.length, 1);
    assert.match(prisma.calls.raw[0], /p\."retiredAt" IS NULL/);
  }
});
