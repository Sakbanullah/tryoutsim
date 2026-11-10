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
 * Map a database error to an `AppError` when it is a known rule, rethrow otherwise.
 *
 * @param {unknown} error
 * @param {{resource: string, id?: string}} context
 * @returns {never}
 */
export function translateDbError(error, context) {
  switch (pgCode(error)) {
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
