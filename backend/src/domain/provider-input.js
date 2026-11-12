/**
 * Request validation and wire shapes for `/providers` and `/ai-routing`
 * (VALIDATION §2; AI_PROVIDER_ARCHITECTURE §3–§6; SECRETS §1–§3).
 *
 * Pure. The key is read from the body and returned **only** inside the value the
 * route writes to the OS store; the wire shape never carries it — not on create,
 * not on update, not in an error (SECRETS §1).
 */

import { FieldErrors, rejectUnknownFields } from '../http/validation.js';
import { DEFAULT_TIMEOUT_MS, PRESETS, checkBaseUrl, checkHeaders, presetBaseUrl } from './provider-models.js';

/**
 * Upper bound on `timeoutMs`. Not a canonical value: it exists so a typo cannot
 * pin a request forever. See the D4 open questions.
 */
export const MAX_TIMEOUT_MS = 600000;

/** Upper bound on `retries` (AI_PROVIDER_ARCHITECTURE §7 "capped"). Not a canonical value. */
export const MAX_RETRIES = 3;

/** The `retries` column does not exist in `provider` (DATABASE_SCHEMA §2); default applied when absent. */
export const DEFAULT_RETRIES = 1;

/**
 * Read a positive bounded integer.
 * @param {FieldErrors} errors
 * @param {Record<string, unknown>} body
 * @param {string} name
 * @param {number} max
 * @returns {number | undefined}
 */
function integerField(errors, body, name, max) {
  const value = body[name];
  if (!Number.isSafeInteger(value) || /** @type {number} */ (value) < 1 || /** @type {number} */ (value) > max) {
    errors.add(name, `${name} must be an integer between 1 and ${max}.`, 'int_range');
    return undefined;
  }
  return /** @type {number} */ (value);
}

/**
 * Check the write-only `key` field. `null` means "no key" (keyless providers).
 * @param {FieldErrors} errors
 * @param {unknown} value
 * @returns {string | null | undefined} `undefined` when absent or invalid
 */
function keyField(errors, value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || value.trim().length === 0) {
    errors.add('key', 'An API key must be a non-empty string.', 'non_empty');
    return undefined;
  }
  if (value !== value.trim() || /\s/.test(value)) {
    errors.add('key', 'An API key must not contain spaces.', 'format');
    return undefined;
  }
  return value;
}

/**
 * Validate `POST /providers` (API_ENDPOINTS §8; VALIDATION §2 "provider").
 *
 * @param {Record<string, unknown>} body
 * @returns {{preset: string, baseUrl: string, defaultModel: string, timeoutMs: number, retries: number, headers: Record<string, string>, extraParams: Record<string, unknown>, key: string | null}}
 */
export function parseCreateProvider(body) {
  const errors = new FieldErrors();
  rejectUnknownFields(errors, body, ['preset', 'name', 'baseUrl', 'defaultModel', 'key', 'timeoutMs', 'retries', 'headers', 'extraParams']);

  const preset = body.preset;
  if (typeof preset !== 'string' || !(preset in PRESETS)) {
    errors.add('preset', `preset must be one of ${Object.keys(PRESETS).join(', ')}.`, 'enum');
  }

  // `name` has no column in `provider` (AI_PROVIDER_ARCHITECTURE §3 lists it; the
  // schema does not). It is accepted and ignored rather than rejected, so the
  // frontend create form is not broken by the schema's narrower record.
  const suppliedBaseUrl = body.baseUrl === undefined || body.baseUrl === null || body.baseUrl === ''
    ? presetBaseUrl(/** @type {string} */ (preset))
    : body.baseUrl;
  const baseUrl = checkBaseUrl(suppliedBaseUrl, errors, 'baseUrl');

  const defaultModel = body.defaultModel;
  if (defaultModel !== undefined) {
    if (typeof defaultModel !== 'string' || defaultModel.trim().length === 0) {
      errors.add('defaultModel', 'defaultModel must be a non-empty string.', 'non_empty');
    }
  }

  const timeoutMs = body.timeoutMs === undefined ? DEFAULT_TIMEOUT_MS : integerField(errors, body, 'timeoutMs', MAX_TIMEOUT_MS);
  const retries = body.retries === undefined ? DEFAULT_RETRIES : integerField(errors, body, 'retries', MAX_RETRIES);
  const headers = checkHeaders(body.headers, errors);
  const extraParams = checkExtraParams(body.extraParams, errors);
  const key = keyField(errors, body.key);

  if (key === null && typeof preset === 'string' && PRESETS[preset]?.requiresKey) {
    errors.add('key', 'This preset requires an API key.', 'required');
  }

  errors.throwIfAny();
  return {
    preset: /** @type {string} */ (preset),
    baseUrl: /** @type {string} */ (baseUrl),
    defaultModel: (defaultModel ?? '').trim(),
    timeoutMs: /** @type {number} */ (timeoutMs),
    retries: /** @type {number} */ (retries),
    headers: /** @type {Record<string, string>} */ (headers),
    extraParams: /** @type {Record<string, unknown>} */ (extraParams),
    key,
  };
}

/**
 * Validate `PATCH /providers/:id`. `baseUrl`, `headers` and `extraParams` are the
 * endpoints doc's editable fields; `defaultModel`, `key`, `timeoutMs` and
 * `retries` are accepted because AI_PROVIDER_ARCHITECTURE §5 says an edit to
 * baseUrl, key or model resets the test — and §3 lists them on the record.
 *
 * @param {Record<string, unknown>} body
 * @returns {{baseUrl?: string, defaultModel?: string, timeoutMs?: number, retries?: number, headers?: Record<string, string>, extraParams?: Record<string, unknown>, key?: string | null}}
 */
export function parseUpdateProvider(body) {
  const errors = new FieldErrors();
  rejectUnknownFields(errors, body, ['preset', 'name', 'baseUrl', 'defaultModel', 'key', 'timeoutMs', 'retries', 'headers', 'extraParams']);
  if ('preset' in body) errors.add('preset', 'preset cannot be changed; create a new provider.', 'immutable');
  if (Object.keys(body).length === 0) errors.add('', 'At least one field is required.', 'required');

  /** @type {{baseUrl?: string, defaultModel?: string, timeoutMs?: number, retries?: number, headers?: Record<string, string>, extraParams?: Record<string, unknown>, key?: string | null}} */
  const patch = {};
  if (body.baseUrl !== undefined) patch.baseUrl = checkBaseUrl(body.baseUrl, errors, 'baseUrl');
  if (body.defaultModel !== undefined) {
    if (typeof body.defaultModel !== 'string' || body.defaultModel.trim().length === 0) {
      errors.add('defaultModel', 'defaultModel must be a non-empty string.', 'non_empty');
    } else patch.defaultModel = body.defaultModel.trim();
  }
  if (body.timeoutMs !== undefined) patch.timeoutMs = integerField(errors, body, 'timeoutMs', MAX_TIMEOUT_MS);
  if (body.retries !== undefined) patch.retries = integerField(errors, body, 'retries', MAX_RETRIES);
  if (body.headers !== undefined) patch.headers = checkHeaders(body.headers, errors);
  if (body.extraParams !== undefined) patch.extraParams = checkExtraParams(body.extraParams, errors);
  // `key: null` removes the key; an absent `key` leaves it untouched (SECRETS §3).
  if ('key' in body) patch.key = keyField(errors, body.key);

  errors.throwIfAny();
  return patch;
}

/**
 * `extraParams` are forwarded verbatim into every chat body, so they may not
 * carry a model, messages or an auth header that would override the request.
 * @param {unknown} value
 * @param {FieldErrors} errors
 * @returns {Record<string, unknown> | undefined}
 */
function checkExtraParams(value, errors) {
  if (value === undefined) return {};
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    errors.add('extraParams', 'extraParams must be an object.', 'type');
    return undefined;
  }
  const reserved = new Set(['model', 'messages', 'authorization', 'api_key', 'stream']);
  for (const name of Object.keys(/** @type {Record<string, unknown>} */ (value))) {
    if (reserved.has(name.toLowerCase())) {
      errors.add(`extraParams.${name}`, `${name} is set by the backend and cannot be overridden.`, 'reserved_field');
    }
  }
  return /** @type {Record<string, unknown>} */ (value);
}

/**
 * The `Provider` wire shape of AI_PROVIDER_ARCHITECTURE §3 + `ProviderView`
 * (`keyLast4`, `hasKey`, `capabilities`). Built by allow-list: no column of a
 * row is spread into a response, so a future column cannot leak by accident.
 *
 * @param {{id: string, baseUrl: string, preset: string, defaultModel: string, timeoutMs: number, testedAt: string | null, capabilityFlagsJson: string, headersJson: string, extraParamsJson: string}} row
 * @param {{keyLast4: string, hasKey: number} | null} secret
 * @returns {object}
 */
export function toProviderView(row, secret) {
  const parsed = (/** @type {string} */ json) => {
    try {
      return JSON.parse(json);
    } catch {
      return null;
    }
  };
  /** @type {Record<string, {value: unknown, source: string}>} */
  const flags = parsed(row.capabilityFlagsJson) ?? {};
  /** @param {'jsonMode'|'streaming'|'maxContext'} field */
  const capability = (field) => ({
    value: flags[field]?.value ?? (field === 'maxContext' ? null : false),
    source: flags[field]?.source === 'manual' ? 'manual' : 'detected',
  });
  return {
    id: row.id,
    preset: row.preset,
    baseUrl: row.baseUrl,
    defaultModel: row.defaultModel,
    timeoutMs: row.timeoutMs,
    // `name`, `retries` and `createdAt` are part of the §3 record / the frontend
    // `Provider` type but have no column in `provider` (DATABASE_SCHEMA §2).
    // They are echoed with derived values so the wire shape matches the contract;
    // the schema gap is an open question in the D4 report.
    name: row.preset,
    retries: DEFAULT_RETRIES,
    createdAt: row.testedAt ?? '',
    keyRef: secret !== null && secret.hasKey === 1 ? 'os-credential-store' : '',
    keyLast4: secret?.keyLast4 ?? '',
    hasKey: secret !== null && secret.hasKey === 1,
    headers: parsed(row.headersJson) ?? {},
    extraParams: parsed(row.extraParamsJson) ?? {},
    testedAt: row.testedAt,
    // Last `POST …/models` result, so a reload shows the list again instead of an empty one.
    // Display only: it is never an allow-list (AI_PROVIDER_ARCHITECTURE §5).
    models: (() => {
      const cached = parsed(row.modelCacheJson);
      return Array.isArray(cached) ? cached.filter((id) => typeof id === 'string') : [];
    })(),
    capabilities: { jsonMode: capability('jsonMode'), streaming: capability('streaming'), maxContext: capability('maxContext') },
  };
}
