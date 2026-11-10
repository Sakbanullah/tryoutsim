/**
 * Material storage: the `material` row plus its append-only `material_version` history
 * (T-10). Every content write is a new version row; the row itself only caches the current
 * version and the approval bound to a version (MATERIAL_SPECIFICATION §1, §5).
 */

import { notFound } from '../errors.js';
import { translateDbError } from '../db/errors.js';

const COLUMNS = `id, title, "contentType", "scopeJson", status, "provenanceJson", version,
  "sourcesJson", "approvalVersion", "approvedAt"`;

/**
 * Map a material row plus its body to the wire record (§1).
 * @param {Record<string, any>} row
 * @param {string} body
 * @returns {object}
 */
export function toMaterial(row, body) {
  return {
    id: row.id,
    title: row.title,
    contentType: row.contentType,
    scope: JSON.parse(row.scopeJson),
    status: row.status,
    provenance: JSON.parse(row.provenanceJson),
    sources: JSON.parse(row.sourcesJson),
    version: row.version,
    body,
    approval: row.approvalVersion === null
      ? null
      : { version: row.approvalVersion, approvedByUserAt: row.approvedAt },
  };
}

/**
 * A material with the body of its current version, or `null`.
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {string} id
 * @returns {Promise<object | null>}
 */
export async function findMaterial(db, id) {
  const { rows } = await db.query(
    `SELECT ${COLUMNS}, v."bodyJson" FROM "material" m
     JOIN "material_version" v ON v."materialId" = m.id AND v.version = m.version
     WHERE m.id = $1`,
    [id],
  );
  return rows[0] ? toMaterial(rows[0], JSON.parse(rows[0].bodyJson).body) : null;
}

/**
 * A material or `404 NOT_FOUND`.
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {string} id
 * @returns {Promise<object>}
 */
export async function requireMaterial(db, id) {
  const material = await findMaterial(db, id);
  if (material === null) throw notFound('material', id);
  return material;
}

/**
 * The version history, oldest first (§5 "the previous version stays readable").
 * @param {import('pg').Pool} pool
 * @param {string} materialId
 * @returns {Promise<{version: number, body: string}[]>}
 */
export async function versionHistory(pool, materialId) {
  const { rows } = await pool.query(
    `SELECT version, "bodyJson" FROM "material_version" WHERE "materialId" = $1 ORDER BY version`,
    [materialId],
  );
  return rows.map((row) => ({ version: row.version, body: JSON.parse(row.bodyJson).body }));
}

/**
 * List materials with the same filters the route accepts.
 * @param {import('pg').Pool} pool
 * @param {{scope?: string, contentType?: string, status?: string}} filters
 * @returns {Promise<object[]>}
 */
export async function listMaterials(pool, filters) {
  /** @type {string[]} */
  const clauses = [];
  /** @type {string[]} */
  const params = [];
  const add = (sql, value) => {
    params.push(value);
    clauses.push(sql.replace('?', `$${params.length}`));
  };
  if (filters.scope !== undefined) add(`"scopeJson"::jsonb ->> 'kind' = ?`, filters.scope);
  if (filters.contentType !== undefined) add(`"contentType" = ?`, filters.contentType);
  if (filters.status !== undefined) add(`status = ?`, filters.status);
  const { rows } = await pool.query(
    `SELECT ${COLUMNS}, v."bodyJson" FROM "material" m
     JOIN "material_version" v ON v."materialId" = m.id AND v.version = m.version
     ${clauses.length === 0 ? '' : `WHERE ${clauses.join(' AND ')}`}
     ORDER BY m.id`,
    params,
  );
  return rows.map((row) => toMaterial(row, JSON.parse(row.bodyJson).body));
}

/**
 * Insert a material at version 1 in `draft` (no approval), plus its first version row.
 * @param {import('pg').PoolClient} tx
 * @param {{id: string, title: string, contentType: string, scope: object, provenance: object,
 *   sources: object[], body: string}} material
 * @returns {Promise<void>}
 */
export async function insertMaterial(tx, material) {
  try {
    await tx.query(
      `INSERT INTO "material" (id, title, "contentType", "scopeJson", status, "provenanceJson",
         version, "sourcesJson")
       VALUES ($1,$2,$3,$4,'draft',$5,1,$6)`,
      [material.id, material.title, material.contentType, JSON.stringify(material.scope),
        JSON.stringify(material.provenance), JSON.stringify(material.sources)],
    );
    await insertVersion(tx, material.id, 1, material.body);
  } catch (error) {
    translateDbError(error, { resource: 'material', id: material.id });
  }
}

/**
 * Append a `material_version` row (append-only).
 * @param {import('pg').PoolClient} tx
 * @param {string} materialId
 * @param {number} version
 * @param {string} body
 * @returns {Promise<void>}
 */
export async function insertVersion(tx, materialId, version, body) {
  try {
    await tx.query(
      `INSERT INTO "material_version" ("materialId", version, "bodyJson") VALUES ($1,$2,$3)`,
      [materialId, version, JSON.stringify({ body })],
    );
  } catch (error) {
    translateDbError(error, { resource: 'material', id: materialId });
  }
}

/**
 * Rewrite the cached current version of a material. Callers only pass values the domain
 * module produced (`nextVersion`, `approvalOf`), never a status the contract disallows.
 * @param {import('pg').PoolClient} tx
 * @param {string} id
 * @param {{title?: string, contentType?: string, scope?: object, provenance?: object,
 *   sources?: object[], version?: number, status?: 'draft' | 'approved' | 'retired',
 *   approvalVersion?: number | null, approvedAt?: string | null}} patch
 * @returns {Promise<void>}
 */
export async function updateMaterial(tx, id, patch) {
  const json = { scope: 'scopeJson', provenance: 'provenanceJson', sources: 'sourcesJson' };
  const columns = Object.keys(patch);
  if (columns.length === 0) return;
  const sets = columns.map((column, index) => {
    const name = json[/** @type {keyof typeof json} */ (column)] ?? column;
    return `"${name}" = $${index + 2}`;
  });
  const values = columns.map((column) => {
    const value = patch[/** @type {keyof typeof patch} */ (column)];
    return column in json ? JSON.stringify(value) : value;
  });
  try {
    await tx.query(`UPDATE "material" SET ${sets.join(', ')} WHERE id = $1`, [id, ...values]);
  } catch (error) {
    translateDbError(error, { resource: 'material', id });
  }
}
