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
 * The reason is the failure's scrubbed message; the key never reached it. `code` is the registry code
 * (API_SPECIFICATION §4) so the UI can say *why* the test failed rather than one generic sentence; it carries no
 * key, header or body.
 * @param {unknown} error
 * @returns {{ok: false, reason: string, code: string}}
 */
export function failedTest(error) {
  if (error instanceof ProviderFailure) return { ok: false, reason: error.message, code: error.code };
  return {
    ok: false,
    reason: 'The provider test could not be completed.',
    code: genericFailureCode(error),
  };
}

/**
 * The registry code of a failure that is not a `ProviderFailure`: a provider throwing one of the registry codes
 * itself keeps it, anything else is `PROVIDER_UNAVAILABLE` with the scrubbed message.
 * @param {unknown} error
 * @returns {string}
 */
function genericFailureCode(error) {
  const code = /** @type {{code?: unknown}} */ (error)?.code;
  return typeof code === 'string' && PROVIDER_CODES.has(code) ? code : 'PROVIDER_UNAVAILABLE';
}

/** The provider codes the test result may carry (API_SPECIFICATION §4, ERROR_HANDLING). */
const PROVIDER_CODES = new Set(['PROVIDER_AUTH_FAILED', 'RATE_LIMITED', 'PROVIDER_TIMEOUT', 'PROVIDER_UNAVAILABLE']);
