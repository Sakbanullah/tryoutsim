/**
 * Process configuration, read once at start from the environment.
 *
 * Nothing here has a fallback that would let the app run in a degraded mode: a
 * missing connection variable is a start failure with a stated remedy
 * (docs/architecture/DEPLOYMENT_AND_BACKUP.md §1.5). Credentials are never read
 * from a file in the repository and never logged.
 */

/** Read a required environment variable, failing the start when it is absent. */
function required(name) {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(
      `${name} is not set. See docs/architecture/DEPLOYMENT_AND_BACKUP.md §1.5 ` +
        `for the one-time database provisioning steps.`,
    );
  }
  return value;
}

/** Read an optional integer environment variable with a documented default. */
function integer(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer, got ${JSON.stringify(raw)}.`);
  }
  return value;
}

/**
 * Build the runtime configuration.
 *
 * The app connects as `tryoutsim_app` through `DATABASE_URL_APP`; the migration
 * URL (`DATABASE_URL`) is deliberately not read here, so the serving process
 * cannot run a migration even by accident.
 *
 * Pool values follow SCHEMA_CONTRACT_REVIEW §3: a bounded pool and a finite
 * connect timeout, because `pg`'s default connect timeout is "wait forever".
 *
 * @returns {{port: number, host: string, databaseUrl: string, pool: {max: number, connectionTimeoutMillis: number, statementTimeoutMs: number, idleInTransactionTimeoutMs: number}}}
 */
export function loadConfig() {
  return {
    host: process.env.HOST ?? '127.0.0.1',
    port: integer('PORT', 4317),
    databaseUrl: required('DATABASE_URL_APP'),
    pool: {
      max: integer('PGPOOL_MAX', 5),
      connectionTimeoutMillis: integer('PGPOOL_CONNECT_TIMEOUT_MS', 5000),
      statementTimeoutMs: integer('PG_STATEMENT_TIMEOUT_MS', 30000),
      idleInTransactionTimeoutMs: integer('PG_IDLE_IN_TX_TIMEOUT_MS', 15000),
    },
  };
}
