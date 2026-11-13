/**
 * The AI routing record (AI_PROVIDER_ARCHITECTURE §4): exactly one global
 * default `{providerId, modelId}` — the one model every AI task uses.
 *
 * There is no per-task override and no task-specific resolution: nothing in
 * the backend can route a task to a different model (product decision: one
 * global model). The legacy `perTaskJson` column is still written as `{}` and
 * is never read; it is not part of the wire shape.
 *
 * Stored in the single `ai_routing` row (`ai_routing` is one row by design;
 * DATABASE_SCHEMA §2). This module keeps the decision logic pure.
 */

import { FieldErrors, rejectUnknownFields } from '../http/validation.js';

/** The id of the single routing row. */
export const ROUTING_ID = 'default';

/**
 * @typedef {{providerId: string, modelId: string}} Route
 * @typedef {{default: Route | null}} Routing
 */

/** An empty routing record: no global model — every AI feature is disabled with its reason. */
export function emptyRouting() {
  return { default: null };
}

/**
 * Validate a body of `PUT /ai-routing` (VALIDATION §2 "AI routing"). The body
 * carries `default` (`{providerId, modelId}` or `null`); any other field,
 * including a legacy `perTask`, is a field error — never silently ignored.
 *
 * @param {Record<string, unknown>} body
 * @returns {Routing}
 */
export function parseRoutingBody(body) {
  const errors = new FieldErrors();
  const routing = emptyRouting();

  rejectUnknownFields(errors, body, ['default']);

  /**
   * Read the `{providerId, modelId}` pair. Both null = no global model; one null
   * and one set is not a pair.
   * @param {unknown} value
   * @param {string} path
   * @returns {Route | null | undefined} `undefined` when invalid
   */
  const pair = (value, path) => {
    if (value === null) return null;
    if (value === undefined || typeof value !== 'object' || Array.isArray(value)) {
      errors.add(path, `${path} must be an object or null.`, 'type');
      return undefined;
    }
    const { providerId, modelId } = /** @type {{providerId?: unknown, modelId?: unknown}} */ (value);
    const p = providerId ?? null;
    const m = modelId ?? null;
    if ((p === null) !== (m === null)) {
      errors.add(path, 'providerId and modelId must both be set or both be null.', 'pair');
      return undefined;
    }
    if (p === null) return null;
    if (typeof p !== 'string' || typeof m !== 'string' || p.length === 0 || m.length === 0) {
      errors.add(path, 'providerId and modelId must be non-empty strings.', 'non_empty');
      return undefined;
    }
    return { providerId: p, modelId: m };
  };

  if ('default' in body) {
    const route = pair(body.default, 'default');
    if (route !== undefined) routing.default = route;
  }

  errors.throwIfAny();
  return routing;
}

/**
 * The wire shape: the global default as stored (no per-task map exists).
 *
 * @param {Routing} routing
 * @returns {{default: {providerId: string | null, modelId: string | null}}}
 */
export function toWireRouting(routing) {
  return {
    default: { providerId: routing.default?.providerId ?? null, modelId: routing.default?.modelId ?? null },
  };
}

/**
 * Decode the stored `ai_routing` row. `perTaskJson` is read by nothing: an
 * override stored by an older build has no effect.
 *
 * @param {{defaultProviderId: string | null, defaultModel: string | null} | null} row
 * @returns {Routing}
 */
export function decodeStoredRouting(row) {
  if (row === null || row.defaultProviderId === null || row.defaultModel === null) return emptyRouting();
  return { default: { providerId: row.defaultProviderId, modelId: row.defaultModel } };
}

/**
 * Encode a routing record for the `ai_routing` row. `perTaskJson` stays `{}`
 * because the column is NOT NULL and unused.
 * @param {Routing} routing
 * @returns {{id: string, defaultProviderId: string | null, defaultModel: string | null, perTaskJson: string}}
 */
export function encodeStoredRouting(routing) {
  return {
    id: ROUTING_ID,
    defaultProviderId: routing.default?.providerId ?? null,
    defaultModel: routing.default?.modelId ?? null,
    perTaskJson: '{}',
  };
}

/**
 * The one model the whole app uses: `default.modelId` of a provider that still
 * exists. No task id is consulted, so no stored override can send a different
 * model than the chosen one.
 *
 * @param {Routing} routing
 * @param {Set<string>} providerIds ids of the providers that exist now
 * @returns {{status: 'mapped', route: Route, source: 'default'} | {status: 'unmapped', effect: 'global_model_unset' | 'provider_missing'}}
 */
export function resolveGlobalRoute(routing, providerIds) {
  if (routing.default === null) return { status: 'unmapped', effect: 'global_model_unset' };
  if (!providerIds.has(routing.default.providerId)) return { status: 'unmapped', effect: 'provider_missing' };
  return { status: 'mapped', route: routing.default, source: 'default' };
}

/**
 * Whether a successful test of this provider+model pair is on record. Any other
 * model makes the pair untested (AI_PROVIDER_ARCHITECTURE §5).
 *
 * @param {{testedAt: string | null, defaultModel: string}} provider
 * @param {string} modelId
 * @returns {boolean}
 */
export function isPairTested(provider, modelId) {
  return provider.testedAt !== null && provider.defaultModel === modelId;
}
