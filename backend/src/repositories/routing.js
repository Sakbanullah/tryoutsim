/**
 * The single `ai_routing` row (DATABASE_SCHEMA §2; AI_PROVIDER_ARCHITECTURE §4).
 *
 * The row is created on first write. `defaultProviderId` has no FK in the
 * schema, so a stale id is possible after a provider delete; the resolver reports
 * it as `provider_missing` and never falls back to another provider.
 */

import { decodeStoredRouting, encodeStoredRouting } from '../domain/routing.js';
import { ROUTING_ID } from '../domain/routing.js';

/**
 * Read the row, or `null` before the first write.
 * @param {any} database
 */
export async function loadRoutingRow(database) {
  return database.aiRouting.findUnique({ where: { id: ROUTING_ID } });
}

/**
 * Read and decode the routing record.
 * @param {any} database
 * @returns {Promise<import('../domain/routing.js').Routing>}
 */
export async function loadRouting(database) {
  return decodeStoredRouting(await loadRoutingRow(database));
}

/**
 * Replace the row with the given record (upsert: the single row is created once).
 * @param {any} database
 * @param {import('../domain/routing.js').Routing} routing
 */
export async function saveRouting(database, routing) {
  const row = encodeStoredRouting(routing);
  const { id, ...values } = row;
  return database.aiRouting.upsert({ where: { id }, create: row, update: values });
}
