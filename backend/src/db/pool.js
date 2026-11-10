/**
 * The single PostgreSQL connection pool for the serving process.
 *
 * One pool, `pg` only — no second driver (ADR-008, ADR-011). The pool connects as
 * the app role, so any statement the runtime issues is limited by that role's
 * grants; migrations are an operator step under a different role.
 *
 * Session-level timeouts are applied on every connection because Prisma has no
 * statement or transaction timeout and a stuck transaction would otherwise hold
 * a pool slot forever (SCHEMA_CONTRACT_REVIEW §3).
 */

import pg from 'pg';

/**
 * Create the pool. The caller owns its lifecycle and must `end()` it on shutdown.
 *
 * @param {ReturnType<import('../config.js').loadConfig>['pool'] & {databaseUrl: string}} options
 * @returns {pg.Pool}
 */
export function createPool({ databaseUrl, max, connectionTimeoutMillis, statementTimeoutMs, idleInTransactionTimeoutMs }) {
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    max,
    connectionTimeoutMillis,
    idleTimeoutMillis: 10000,
    // Applied to every new connection, so no code path has to remember them.
    options: `-c statement_timeout=${statementTimeoutMs} -c idle_in_transaction_session_timeout=${idleInTransactionTimeoutMs}`,
  });

  // An idle client losing its socket must not take the process down; the next
  // query reconnects or fails into the normal request error path.
  pool.on('error', (error) => {
    console.error(JSON.stringify({ level: 'error', event: 'pg_pool_error', message: error.message }));
  });

  return pool;
}

/**
 * Probe the connection for the health route.
 * @param {pg.Pool} pool
 * @returns {Promise<void>} resolves when the database answers, rejects otherwise
 */
export async function ping(pool) {
  await pool.query('SELECT 1');
}
