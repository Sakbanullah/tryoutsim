/**
 * `/packages` (API_ENDPOINTS §3) and session creation (API_SPECIFICATION §7.4).
 *
 * Read-only here: package authoring belongs to another domain. Starting a session is the only write, and it is the
 * only way to start one (API_ENDPOINTS §4).
 */

import { notFound, validationError } from '../errors.js';
import { parseBody } from '../domain/validate.js';
import { findPackage, listPackages, requirePackageView, toPackageView } from '../repositories/package.js';
import { createSession, loadRunner } from '../repositories/session.js';

/**
 * Register the package routes.
 * @param {ReturnType<import('../http/router.js').createRouter>} router
 * @param {{prisma: object, now: () => number, nowIso: () => string}} deps
 */
export function registerPackageRoutes(router, { prisma, now, nowIso }) {
  /** Packages with availability, filtered by `mode` (200, 400). */
  router.add('GET', '/packages', async ({ query }) => {
    const mode = query.get('mode');
    if (mode !== null && mode !== 'tryout' && mode !== 'latihan') {
      throw validationError([{ path: 'mode', message: 'mode must be tryout or latihan.', rule: 'enum' }]);
    }
    const rows = await listPackages(prisma, mode);
    return { data: await Promise.all(rows.map((row) => toPackageView(prisma, { pkg: row, version: row }))) };
  });

  /** One package at its current version, with startability (200, 404). */
  router.add('GET', '/packages/:id', async ({ params }) => ({ data: await requirePackageView(prisma, params.id) }));

  /** Start a session: roster, config binding and snapshot in one transaction (201, 400, 404, 409). */
  router.add('POST', '/packages/:id/sessions', async ({ params, body }) => {
    const input = parseBody(body, [
      { name: 'mode', required: true, kind: 'enum', values: ['tryout', 'latihan'] },
      { name: 'packageVersion', kind: 'int', min: 1 },
    ]);
    const version = /** @type {number | null} */ (input.packageVersion ?? null);
    if (!(await prisma.package.findUnique({ where: { id: params.id }, select: { id: true } }))) {
      throw notFound('package', params.id);
    }
    const found = await findPackage(prisma, params.id, version);
    if (!found) throw notFound('package_version', `${params.id}@${version ?? 'current'}`);

    const { session, configResolution } = await createSession(prisma, found, /** @type {'tryout' | 'latihan'} */ (input.mode), nowIso());
    return {
      status: 201,
      data: {
        session: {
          sessionId: session.id,
          configId: session.examConfigId,
          mode: session.mode,
          packageId: session.packageId,
          packageVersion: session.packageVersion,
          status: session.status,
          startedAt: session.startedAt,
        },
        runner: await loadRunner(prisma, session.id, now()),
        configResolution,
      },
    };
  });
}
