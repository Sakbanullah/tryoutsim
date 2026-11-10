/**
 * The AI routing record (AI_PROVIDER_ARCHITECTURE §4): one global default plus
 * per-task overrides, and the resolution order `perTask[task]` → `default` →
 * unmapped. There is no third fallback and no cross-provider fallback.
 *
 * Stored in the single `ai_routing` row (`ai_routing` is one row by design;
 * DATABASE_SCHEMA §2). This module keeps the decision logic pure.
 */

import { FieldErrors, rejectUnknownFields } from '../http/validation.js';

/** The four routable tasks (AI_PROVIDER_ARCHITECTURE §4). Closed set. */
export const TASKS = Object.freeze(['question', 'explanation', 'material', 'analysis']);

/** The id of the single routing row. */
export const ROUTING_ID = 'default';

/** What each task does when it is unmapped (§4 table). */
const UNMAPPED_EFFECT = Object.freeze({
  question: 'job_refused',
  explanation: 'draft_without_explanation',
  material: 'offer_disabled',
  analysis: 'deterministic_order',
});

/** An empty routing record: no default, no override (every task follows it). */
export function emptyRouting() {
  return { default: null, perTask: {} };
}

/**
 * @typedef {{providerId: string, modelId: string}} Route
 * @typedef {{default: Route | null, perTask: Partial<Record<string, Route | null>>}} Routing
 */

/**
 * Validate a body of `PUT /ai-routing` (VALIDATION §2 "AI routing").
 *
 * The body is a full routing record: `default` (`{providerId, modelId}` or
 * `null`) and `perTask` with every task id and a route or `null` for each
 * ("Ikut default"). A null pair and an absent task both mean "follow the
 * default", by construction; anything else is a field error, never ignored.
 *
 * Folding a *partial* update onto the stored record is the route's job; this
 * function only validates what one body says.
 *
 * @param {Record<string, unknown>} body
 * @returns {Routing}
 */
export function parseRoutingBody(body) {
  const errors = new FieldErrors();
  const routing = emptyRouting();

  rejectUnknownFields(errors, body, ['default', 'perTask']);

  /**
   * Read one `{providerId, modelId}` pair. Both null = follow the default; one
   * null and one set is not a pair.
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

  if ('perTask' in body) {
    const perTask = body.perTask;
    if (perTask === null || typeof perTask !== 'object' || Array.isArray(perTask)) {
      errors.add('perTask', 'perTask must be an object.', 'type');
    } else {
      for (const [task, value] of Object.entries(/** @type {Record<string, unknown>} */ (perTask))) {
        if (!TASKS.includes(task)) {
          errors.add(`perTask.${task}`, `${task} is not a routable task.`, 'enum');
          continue;
        }
        const route = pair(value, `perTask.${task}`);
        if (route !== undefined) routing.perTask[task] = route;
      }
    }
  }

  errors.throwIfAny();
  return routing;
}

/**
 * Fold a parsed or stored routing into the wire shape.
 *
 * In the record, an absent `perTask[task]` and an explicit `null` both mean
 * "follow the default". The wire keeps them distinct (the frontend's
 * `TaskMapEntry` has `providerId: string | null`), so this reads a record that
 * stores explicit nulls.
 *
 * @param {Routing} routing
 * @returns {{default: {providerId: string | null, modelId: string | null}, perTask: {task: string, providerId: string | null, modelId: string | null}[]}}
 */
export function toWireRouting(routing) {
  return {
    default: { providerId: routing.default?.providerId ?? null, modelId: routing.default?.modelId ?? null },
    perTask: TASKS.map((task) => ({
      task,
      providerId: routing.perTask[task]?.providerId ?? null,
      modelId: routing.perTask[task]?.modelId ?? null,
    })),
  };
}

/**
 * Decode the stored `ai_routing` row (`defaultProviderId`, `defaultModel`,
 * `perTaskJson`) into a routing record.
 *
 * @param {{defaultProviderId: string | null, defaultModel: string | null, perTaskJson: string} | null} row
 * @returns {Routing}
 */
export function decodeStoredRouting(row) {
  if (row === null) return emptyRouting();
  /** @type {Routing} */
  const routing = emptyRouting();
  if (row.defaultProviderId !== null && row.defaultModel !== null) {
    routing.default = { providerId: row.defaultProviderId, modelId: row.defaultModel };
  }
  /** @type {Record<string, {providerId?: unknown, modelId?: unknown} | null>} */
  let stored = {};
  try {
    stored = JSON.parse(row.perTaskJson) ?? {};
  } catch {
    // A routing override that cannot be read is dropped, not guessed: the task
    // falls back to the default by the documented order.
    stored = {};
  }
  for (const task of TASKS) {
    const entry = stored[task];
    if (entry && typeof entry.providerId === 'string' && typeof entry.modelId === 'string') {
      routing.perTask[task] = { providerId: entry.providerId, modelId: entry.modelId };
    }
  }
  return routing;
}

/**
 * Encode a routing record for the `ai_routing` row.
 * @param {Routing} routing
 * @returns {{id: string, defaultProviderId: string | null, defaultModel: string | null, perTaskJson: string}}
 */
export function encodeStoredRouting(routing) {
  /** @type {Record<string, {providerId: string, modelId: string}>} */
  const perTask = {};
  for (const task of TASKS) if (routing.perTask[task]) perTask[task] = /** @type {Route} */ (routing.perTask[task]);
  return {
    id: ROUTING_ID,
    defaultProviderId: routing.default?.providerId ?? null,
    defaultModel: routing.default?.modelId ?? null,
    perTaskJson: JSON.stringify(perTask),
  };
}

/**
 * The resolution order of §4: `perTask[task]`, else `default`. A task is
 * unmapped only when both are absent — there is no third fallback.
 *
 * @param {Routing} routing
 * @param {string} task
 * @returns {{status: 'mapped', route: Route, source: 'override'|'default'} | {status: 'unmapped', task: string, effect: string}}
 */
export function resolveRoute(routing, task) {
  if (!TASKS.includes(task)) {
    return { status: 'unmapped', task, effect: 'unknown_task' };
  }
  const override = routing.perTask[task];
  if (override) return { status: 'mapped', route: override, source: 'override' };
  if (routing.default) return { status: 'mapped', route: routing.default, source: 'default' };
  return {
    status: 'unmapped',
    task,
    effect: /** @type {Record<string, string>} */ (UNMAPPED_EFFECT)[task],
  };
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
