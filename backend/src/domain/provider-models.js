/**
 * Provider presets, capability records and `listModels` parsing
 * (AI_PROVIDER_ARCHITECTURE §3, §5, §6).
 *
 * A preset only prefills `baseUrl` and the keyless shape. It is never a claim
 * about capability: a model with nothing detected and nothing set reads
 * conservatively — no JSON mode, no streaming, unknown context (§6).
 */

/** The closed preset set (DATABASE_SCHEMA C-16). */
export const PRESETS = Object.freeze({
  openrouter: { baseUrl: 'https://openrouter.ai/api/v1', requiresKey: true },
  openai_compatible: { baseUrl: null, requiresKey: false },
  ollama: { baseUrl: 'http://127.0.0.1:11434/v1', requiresKey: false },
  custom: { baseUrl: null, requiresKey: false },
});

/** Default request timeout; overridable per provider (`timeoutMs`, DATABASE_SCHEMA B-16). */
export const DEFAULT_TIMEOUT_MS = 60000;

/**
 * The conservative capability record of a model nobody has probed or corrected.
 *
 * Wire shape is the frontend contract (`ModelCapabilities` in
 * FRONTEND_DATA_CONTRACTS.md): each field carries its `source`.
 * @returns {{jsonMode: {value: boolean, source: 'detected'|'manual'}, streaming: {value: boolean, source: 'detected'|'manual'}, maxContext: {value: number|null, source: 'detected'|'manual'}}}
 */
export function conservativeCapabilities() {
  return {
    jsonMode: { value: false, source: 'detected' },
    streaming: { value: false, source: 'detected' },
    maxContext: { value: null, source: 'detected' },
  };
}

/**
 * The preset's default `baseUrl`.
 * @param {string} preset
 * @returns {string | null}
 */
export function presetBaseUrl(preset) {
  return PRESETS[preset]?.baseUrl ?? null;
}

/**
 * Whether the preset needs a key. A stored secret always wins over the preset:
 * the user may have entered one for a `custom` gateway.
 * @param {string} preset
 * @returns {boolean}
 */
export function presetRequiresKey(preset) {
  return PRESETS[preset]?.requiresKey ?? false;
}

/**
 * Normalise a base URL: http(s) only, no credentials, no trailing slash, no
 * trailing `/chat/completions` (the transport appends the route).
 *
 * @param {unknown} value
 * @param {import('../http/validation.js').FieldErrors} errors
 * @param {string} path
 * @returns {string | undefined}
 */
export function checkBaseUrl(value, errors, path) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    errors.add(path, 'A base URL is required for this preset.', 'required');
    return undefined;
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    errors.add(path, 'The base URL must be an absolute http(s) URL.', 'url');
    return undefined;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    errors.add(path, 'The base URL must use http or https.', 'scheme');
    return undefined;
  }
  if (url.username || url.password) {
    errors.add(path, 'The base URL must not contain credentials.', 'no_credentials');
    return undefined;
  }
  return `${url.origin}${url.pathname.replace(/\/+$/, '').replace(/\/chat\/completions$/, '')}`;
}

/**
 * Reject a stored header that would carry credentials: the `Authorization` header
 * is materialised from the secret at send time, never stored (SECRETS §3, SEC-3).
 *
 * @param {unknown} headers
 * @param {import('../http/validation.js').FieldErrors} errors
 * @returns {Record<string, string> | undefined}
 */
export function checkHeaders(headers, errors) {
  if (headers === undefined) return {};
  if (headers === null || typeof headers !== 'object' || Array.isArray(headers)) {
    errors.add('headers', 'headers must be an object of strings.', 'type');
    return undefined;
  }
  /** @type {Record<string, string>} */
  const out = {};
  for (const [name, value] of Object.entries(/** @type {Record<string, unknown>} */ (headers))) {
    if (name.toLowerCase() === 'authorization' || name.toLowerCase() === 'proxy-authorization') {
      errors.add(`headers.${name}`, 'The Authorization header is set from the stored key and cannot be stored.', 'credential_header');
    } else if (typeof value !== 'string') {
      errors.add(`headers.${name}`, 'Header values must be strings.', 'type');
    } else {
      out[name] = value;
    }
  }
  return out;
}

/**
 * Parse an OpenAI-compatible `/models` body into model ids. The list is a
 * convenience: it never decides whether a typed model id is allowed (§5).
 * @param {unknown} body
 * @returns {string[] | null} ids, or `null` when the body is not a model list
 */
export function parseModelList(body) {
  const data = /** @type {{data?: unknown}} */ (body)?.data;
  if (!Array.isArray(data)) return null;
  const ids = data
    .map((entry) => /** @type {{id?: unknown}} */ (entry)?.id)
    .filter((id) => typeof id === 'string' && id.length > 0);
  return /** @type {string[]} */ (ids);
}

/**
 * Merge auto-detected capabilities with the stored record. A field whose stored
 * `source` is `manual` is never overwritten by a later detection (§6).
 *
 * @param {ReturnType<typeof conservativeCapabilities>} stored
 * @param {{jsonMode: boolean, streaming: boolean, maxContext: number | null}} detected
 * @returns {ReturnType<typeof conservativeCapabilities>}
 */
export function mergeDetected(stored, detected) {
  /** @param {'jsonMode'|'streaming'|'maxContext'} field */
  const pick = (field) => (stored?.[field]?.source === 'manual' ? stored[field] : { value: detected[field], source: 'detected' });
  return {
    jsonMode: /** @type {{value: boolean, source: 'detected'}} */ (pick('jsonMode')),
    streaming: /** @type {{value: boolean, source: 'detected'}} */ (pick('streaming')),
    maxContext: /** @type {{value: number|null, source: 'detected'}} */ (pick('maxContext')),
  };
}

/**
 * Validate the body of `PUT /providers/:id/capabilities`. Every field is
 * editable and a manual edit sets `source: 'manual'` (§6). A field the body does
 * not mention keeps its stored value.
 *
 * @param {Record<string, unknown>} body
 * @param {import('../http/validation.js').FieldErrors} errors
 * @returns {Partial<ReturnType<typeof conservativeCapabilities>>}
 */
export function parseCapabilities(body, errors) {
  /** @type {Partial<ReturnType<typeof conservativeCapabilities>>} */
  const out = {};
  const known = new Set(['jsonMode', 'streaming', 'maxContext']);
  for (const key of Object.keys(body)) {
    if (!known.has(key)) errors.add(key, `${key} is not a capability field.`, 'unknown_field');
  }
  for (const field of ['jsonMode', 'streaming']) {
    const entry = body[field];
    if (entry === undefined) continue;
    const value = /** @type {{value?: unknown}} */ (entry)?.value;
    if (typeof value !== 'boolean') {
      errors.add(`${field}.value`, `${field} must be a boolean.`, 'type');
      continue;
    }
    out[/** @type {'jsonMode'|'streaming'} */ (field)] = { value, source: 'manual' };
  }
  if (body.maxContext !== undefined) {
    const value = /** @type {{value?: unknown}} */ (body.maxContext)?.value;
    if (value !== null && !(Number.isSafeInteger(value) && /** @type {number} */ (value) > 0)) {
      errors.add('maxContext.value', 'maxContext must be a positive integer or null.', 'int_range');
    } else {
      out.maxContext = { value: /** @type {number|null} */ (value), source: 'manual' };
    }
  }
  if (!errors.any && Object.keys(out).length === 0) {
    errors.add('', 'At least one capability field is required.', 'required');
  }
  return out;
}
