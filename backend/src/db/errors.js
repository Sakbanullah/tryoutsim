/**
 * Translation from database errors to the API's error registry.
 *
 * A constraint or trigger raising is a *rule* firing, not a crash: the caller gets
 * the registry code that rule belongs to. Anything unrecognised stays a 500, so a
 * missing mapping shows up as a bug rather than a plausible-looking 409.
 *
 * SQLSTATEs used here:
 * - `23001` — a `tryoutsim_*_guard` trigger refused an append-only or frozen write;
 * - `23503` — foreign key violation (a referenced row is missing or still in use);
 * - `23505` — unique violation;
 * - `23514` — `CHECK` violation;
 * - `42501` — insufficient privilege (the app role attempted a revoked operation).
 */

import { AppError, conflict, notFound } from '../errors.js';

/** @param {unknown} error */
function pgCode(error) {
  return /** @type {{code?: string}} */ (error)?.code;
}

/**
 * Prisma's own error codes that stand for a PostgreSQL rule the client maps away from the raw SQLSTATE. Prisma wraps
 * a foreign-key violation raised by a trigger (our `*_guard` functions use `ERRCODE = '23503'`) as `P2003` with no
 * `meta.field_name`, which is why it is matched by code and not by column.
 * @type {Record<string, string>}
 */
const PRISMA_CODES = Object.freeze({
  P2003: '23503',
  P2002: '23505',
});

/** The SQLSTATE a thrown error stands for: the raw one, or the one a Prisma code maps to. */
function ruleCode(error) {
  const prismaCode = pgCode(error);
  if (typeof prismaCode === 'string' && prismaCode in PRISMA_CODES) {
    return PRISMA_CODES[prismaCode];
  }
  const meta = /** @type {{meta?: {code?: string}}} */ (error)?.meta;
  return typeof meta?.code === 'string' ? meta.code : prismaCode;
}

/**
 * Map a database error to an `AppError` when it is a known rule, rethrow otherwise.
 *
 * @param {unknown} error
 * @param {{resource: string, id?: string}} context
 * @returns {never}
 */
export function translateDbError(error, context) {
  switch (ruleCode(error)) {
    case '23001':
      throw conflict(context.resource, 'immutable', 'That record is history and cannot be changed.');
    case '23505':
      throw conflict(context.resource, 'duplicate', 'That record already exists.');
    case '23503':
      throw conflict(context.resource, 'in_use', 'That record is still referenced by another record.');
    case '23514':
      throw new AppError('VALIDATION_FAILED', 'A stored value violates a rule.', {
        fields: [{ path: '', message: 'Value rejected by a database rule.', rule: 'check_constraint' }],
      });
    case '42501':
      throw new AppError('UNSUPPORTED', 'That operation is not available.', {
        feature: 'privileged_write',
      });
    case 'P2025':
      throw notFound(context.resource, context.id ?? '');
    default:
      throw error;
  }
}
