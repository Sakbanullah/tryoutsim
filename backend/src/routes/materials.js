/**
 * `/materials` (API_ENDPOINTS §7).
 *
 * Every content write is a new `material_version` row; the `material` row only caches the
 * current version and the approval bound to a version (MATERIAL_SPECIFICATION §1, §5). The
 * blocking checks M-01…M-05 run at approval, not at save, so a draft may be incomplete.
 */

import { randomUUID } from 'node:crypto';
import { nowIso } from '../db/ids.js';
import { conflict, notFound, validationError } from '../errors.js';
import { asObject, FieldErrors } from '../http/validation.js';
import {
  MATERIAL_PROVENANCE_KINDS, approvalOf, assertRetirable, failedChecks, nextVersion,
  validateMaterial, CONTENT_TYPES,
} from '../domain/material-lifecycle.js';
import {
  findMaterial, insertMaterial, insertVersion, listMaterials, requireMaterial, updateMaterial,
  versionHistory,
} from '../repositories/material.js';
import { findNode } from '../repositories/competency.js';

const SCOPE_KINDS = Object.freeze(['competency', 'domain', 'free']);

/**
 * Read the create/edit body's fields and report every failure at once.
 * @param {unknown} body
 * @param {{requireAll: boolean}} options
 * @returns {{title?: string, contentType?: string, scope?: object, provenance?: object,
 *   sources?: object[], body?: string}}
 */
export function parseMaterialBody(body, { requireAll }) {
  const input = asObject(body);
  const errors = new FieldErrors();
  const allowed = ['title', 'contentType', 'scope', 'provenance', 'sources', 'body'];
  for (const key of Object.keys(input)) {
    if (!allowed.includes(key)) errors.add(key, `${key} is not accepted.`, 'unknown_field');
  }
  const need = (key) => requireAll || input[key] !== undefined;

  if (need('title') && (typeof input.title !== 'string' || input.title.trim().length === 0)) {
    errors.add('title', 'title is required.', 'required');
  }
  if (need('body') && (typeof input.body !== 'string' || input.body.trim().length === 0)) {
    errors.add('body', 'body is required.', 'required');
  }
  if (need('contentType') && !CONTENT_TYPES.includes(input.contentType)) {
    errors.add('contentType', 'contentType is not an accepted value.', 'enum');
  }
  if (need('scope')) {
    const scope = input.scope;
    if (scope === null || typeof scope !== 'object' || Array.isArray(scope) || !SCOPE_KINDS.includes(scope.kind)) {
      errors.add('scope', 'scope.kind must be competency, domain or free.', 'enum');
    } else if (scope.kind !== 'free' && typeof scope.competencyId !== 'string') {
      errors.add('scope.competencyId', 'scope.competencyId is required for this scope.', 'required');
    }
  }
  if (need('provenance')) {
    const provenance = input.provenance;
    if (provenance === null || typeof provenance !== 'object' || !MATERIAL_PROVENANCE_KINDS.includes(provenance.kind)) {
      errors.add('provenance.kind', 'provenance.kind is not an accepted value.', 'enum');
    }
  }
  if (need('sources') && !Array.isArray(input.sources)) {
    errors.add('sources', 'sources must be an array.', 'type');
  }
  if (!requireAll && Object.keys(input).length === 0) {
    errors.add('', 'At least one field is required.', 'required');
  }
  errors.throwIfAny();

  const accepted = {};
  for (const key of allowed) if (input[key] !== undefined) accepted[key] = input[key];
  return accepted;
}

/**
 * Run `work(client)` inside one transaction.
 * @param {import('pg').Pool} pool
 * @param {(client: import('pg').PoolClient) => Promise<any>} work
 */
async function inTransaction(pool, work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Register the material routes.
 * @param {ReturnType<import('../http/router.js').createRouter>} router
 * @param {{pool: import('pg').Pool}} deps
 */
export function registerMaterialRoutes(router, { pool }) {
  router.add('GET', '/materials', async ({ query }) => {
    const filters = {};
    const errors = new FieldErrors();
    for (const [key, value] of query) {
      if (!['scope', 'contentType', 'status'].includes(key)) {
        errors.add(key, `${key} is not a filter.`, 'unknown_field');
        continue;
      }
      filters[key] = value;
    }
    errors.throwIfAny();
    return { data: await listMaterials(pool, filters) };
  });

  router.add('GET', '/materials/:id', async ({ params }) => {
    const material = await requireMaterial(pool, params.id);
    return { data: { ...material, versionHistory: await versionHistory(pool, material.id) } };
  });

  router.add('POST', '/materials', async ({ body }) => {
    const input = parseMaterialBody(body, { requireAll: true });
    const id = `mat-${randomUUID()}`;
    await inTransaction(pool, async (tx) => {
      if (input.scope.kind !== 'free') {
        const node = await findNode(tx, input.scope.competencyId);
        if (node === null) {
          throw validationError([{ path: 'scope.competencyId', message: 'The scope names a competency that does not exist.', rule: 'exists' }]);
        }
      }
      await insertMaterial(tx, {
        id,
        title: input.title,
        contentType: input.contentType,
        scope: input.scope,
        provenance: input.provenance,
        sources: input.sources,
        body: input.body,
      });
    });
    return { status: 201, data: await findMaterial(pool, id) };
  });

  router.add('PATCH', '/materials/:id', async ({ params, body }) => {
    const material = await requireMaterial(pool, params.id);
    const input = parseMaterialBody(body, { requireAll: false });
    const next = nextVersion(material);
    const merged = {
      title: input.title ?? material.title,
      contentType: input.contentType ?? material.contentType,
      scope: input.scope ?? material.scope,
      provenance: input.provenance ?? material.provenance,
      sources: input.sources ?? material.sources,
    };
    await inTransaction(pool, async (tx) => {
      await insertVersion(tx, material.id, next.version, input.body ?? material.body);
      await updateMaterial(tx, material.id, {
        ...merged,
        version: next.version,
        status: next.status,
        // §5: a new version carries no approval; the previous one stays on its version row.
        approvalVersion: null,
        approvedAt: null,
      });
    });
    return { data: await findMaterial(pool, material.id) };
  });

  router.add('POST', '/materials/:id/approve', async ({ params }) => {
    const material = await requireMaterial(pool, params.id);
    const node = material.scope.kind === 'free' ? null : await findNode(pool, material.scope.competencyId);
    const checks = validateMaterial(material, node);
    const failed = failedChecks(checks);
    if (failed.length > 0) {
      throw validationError(failed.map((checkId) => ({
        path: 'material',
        message: `${checkId} did not pass.`,
        rule: checkId,
      })));
    }
    const approval = approvalOf(material);
    await inTransaction(pool, async (tx) => {
      await updateMaterial(tx, material.id, {
        status: approval.status,
        approvalVersion: approval.approvalVersion,
        approvedAt: nowIso(),
      });
    });
    return { data: { ...(await requireMaterial(pool, material.id)), checks } };
  });

  router.add('POST', '/materials/:id/retire', async ({ params }) => {
    const material = await requireMaterial(pool, params.id);
    assertRetirable(material);
    await inTransaction(pool, async (tx) => {
      await updateMaterial(tx, material.id, { status: 'retired' });
    });
    return { data: await requireMaterial(pool, material.id) };
  });
}
