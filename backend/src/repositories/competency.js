/**
 * Competency (taxonomy node) reads. The taxonomy's content is canonical in
 * COMPETENCY_TAXONOMY.md; this file only reads what the seeded `competency` table holds and
 * derives the leaf/domain distinction from the id format (§2), so no second taxonomy is
 * defined here.
 */

/**
 * Format of a taxonomy id: `<TEST>.<DOMAIN>` or `<TEST>.<DOMAIN>.<SUBDOMAIN>` (COMPETENCY_TAXONOMY §2).
 * @param {string} id
 * @returns {boolean}
 */
export function isTaxonomyIdFormat(id) {
  return /^(TWK|TIU|TKP)(\.[A-Z][A-Z0-9_]*){1,2}$/.test(id);
}

/**
 * A node is a leaf when no other node names it as parent; a domain otherwise.
 * @param {string} id
 * @param {Set<string>} parentIds
 * @returns {'leaf' | 'domain'}
 */
export function kindOf(id, parentIds) {
  return parentIds.has(id) ? 'domain' : 'leaf';
}

const COLUMNS = `id, "parentId", test, label, goal, tier`;

/**
 * Map a `competency` row to the wire node.
 * @param {Record<string, any>} row
 * @param {Set<string>} parentIds
 * @returns {object}
 */
function toNode(row, parentIds) {
  return {
    id: row.id,
    test: row.test,
    parentId: row.parentId,
    label: row.label,
    goal: row.goal,
    // `DEPRECATED` is how COMPETENCY_TAXONOMY §2's `deprecated` flag is stored (DATABASE_SCHEMA C-12).
    tier: row.tier,
    deprecated: row.tier === 'DEPRECATED',
    kind: kindOf(row.id, parentIds),
  };
}

/**
 * Every node of one test, or of the whole taxonomy.
 * @param {import('pg').Pool} pool
 * @param {'TWK' | 'TIU' | 'TKP' | null} test
 * @returns {Promise<object[]>}
 */
export async function listNodes(pool, test) {
  const { rows } = test === null
    ? await pool.query(`SELECT ${COLUMNS} FROM "competency" ORDER BY id`)
    : await pool.query(`SELECT ${COLUMNS} FROM "competency" WHERE test = $1 ORDER BY id`, [test]);
  const { rows: parents } = await pool.query(`SELECT DISTINCT "parentId" AS id FROM "competency" WHERE "parentId" IS NOT NULL`);
  const parentIds = new Set(parents.map((row) => row.id));
  return rows.map((row) => toNode(row, parentIds));
}

/**
 * The node a scope names, or `null`. Used by the material validator (M-02) and authoring (V-05).
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {string} id
 * @returns {Promise<{id: string, test: string, tier: string, exists: true, deprecated: boolean, kind: string} | null>}
 */
export async function findNode(db, id) {
  const { rows } = await db.query(
    `SELECT ${COLUMNS},
            EXISTS (SELECT 1 FROM "competency" child WHERE child."parentId" = c.id) AS "hasChildren"
     FROM "competency" c WHERE id = $1`,
    [id],
  );
  const row = rows[0];
  if (!row) return null;
  return { ...toNode(row, row.hasChildren ? new Set([row.id]) : new Set()), exists: true };
}

/**
 * Every leaf (non-deprecated) with its eligible stock, for the Latihan picker (API_ENDPOINTS §3).
 * @param {import('pg').Pool} pool
 * @returns {Promise<{competencyId: string, test: string, label: string, availableQuestions: number}[]>}
 */
export async function leavesWithStock(pool) {
  const { rows } = await pool.query(
    `SELECT c.id AS "competencyId", c.test, c.label,
            (SELECT count(*)::int FROM "question" q
              WHERE q."competencyId" = c.id AND q.lifecycle = 'active' AND q."dynamicEligible" = 1) AS "availableQuestions"
     FROM "competency" c
     WHERE c.tier <> 'DEPRECATED'
       AND NOT EXISTS (SELECT 1 FROM "competency" child WHERE child."parentId" = c.id)
     ORDER BY c.id`,
  );
  return rows;
}
