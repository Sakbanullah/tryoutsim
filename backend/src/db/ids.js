/**
 * Opaque ids and timestamps for new rows.
 *
 * Ids are random UUIDs — opaque, C-collated in the database, never parsed by a
 * client (AUD-06). Timestamps are ISO-8601 UTC strings, the column type every
 * `*Json`/`*At` column uses in this schema.
 */

import { randomUUID } from 'node:crypto';

/** @returns {string} a fresh opaque id */
export function newId() {
  return randomUUID();
}

/** @returns {string} the current time as ISO-8601 UTC */
export function nowIso() {
  return new Date().toISOString();
}
