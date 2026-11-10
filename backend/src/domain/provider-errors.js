/**
 * Transport error types shared by `provider-client.js` and `generation.js`.
 *
 * Each carries the `failureCategory` of QUESTION_GENERATION §6 it lands on, so a
 * batch records the canonical id and no caller re-derives it from an HTTP status.
 */

/**
 * A provider call failed. `message` is already scrubbed and safe to store/show.
 */
export class ProviderFailure extends Error {
  /**
   * @param {'timeout'|'auth'|'rate_limit'|'unavailable'|'provider_error'} kind
   * @param {string} code the registry code (API_SPECIFICATION §4)
   * @param {string} message scrubbed, user-facing
   * @param {{retryAfterMs?: number|null, timeoutMs?: number, reason?: string}} [details]
   */
  constructor(kind, code, message, details = {}) {
    super(message);
    this.name = 'ProviderFailure';
    this.kind = kind;
    this.code = code;
    this.details = details;
  }

  /** @returns {typeof FAILURE_CATEGORY[keyof typeof FAILURE_CATEGORY]} the batch failure category */
  get failureCategory() {
    return FAILURE_CATEGORY[this.kind];
  }
}

/** QUESTION_GENERATION §6 ids for a batch that failed at the transport. */
export const FAILURE_CATEGORY = Object.freeze({
  timeout: 'timeout',
  auth: 'auth',
  rate_limit: 'rate_limit',
  unavailable: 'provider_error',
  provider_error: 'provider_error',
});

/**
 * A key was never configured for a provider that needs one.
 * @param {string} providerId
 * @returns {ProviderFailure}
 */
export function keyMissingFailure(providerId) {
  return new ProviderFailure('auth', 'PROVIDER_AUTH_FAILED', 'This provider has no API key. Enter one in AI settings.', {
    reason: 'key_missing',
  });
}

/**
 * The batch `failureCategory` (QUESTION_GENERATION §6) for any thrown value.
 * @param {unknown} error
 * @returns {string}
 */
export function failureCategoryForError(error) {
  if (error instanceof ProviderFailure) return error.failureCategory;
  return 'provider_error';
}

/**
 * A failed connection test as a value, not a throw (PROVIDER_INTEGRATION §5).
 * The reason is the failure's scrubbed message; the key never reached it.
 * @param {unknown} error
 * @returns {{ok: false, reason: string}}
 */
export function failedTest(error) {
  if (error instanceof ProviderFailure) return { ok: false, reason: error.message };
  return { ok: false, reason: 'The provider test could not be completed.' };
}
