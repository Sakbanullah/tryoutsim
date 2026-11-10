/**
 * The error registry and the application error type.
 *
 * The registry is the closed set of docs/backend/API_SPECIFICATION.md §4. An
 * HTTP status is a shorthand, never the source of truth: the client reads
 * `error.code`. Adding a code here without adding it to that table is a
 * contract change and belongs in docs/AUDIT.md.
 */

/** `code` → HTTP status. Keep in sync with API_SPECIFICATION §4. */
export const ERROR_STATUS = Object.freeze({
  VALIDATION_FAILED: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PROVIDER_UNAVAILABLE: 502,
  PROVIDER_AUTH_FAILED: 502,
  RATE_LIMITED: 429,
  PROVIDER_TIMEOUT: 504,
  PREFLIGHT_FAILED: 422,
  THRESHOLD_CONFIG_INVALID: 409,
  REGULATORY_PATHWAY_MISMATCH: 409,
  REGULATORY_YEAR_MISMATCH: 409,
  REGULATORY_SCOPE_UNVERIFIED: 409,
  CONTRACT_MISMATCH: 426,
  UNSUPPORTED: 501,
});

/**
 * An error that maps to exactly one registry code and one HTTP status.
 *
 * `message` is shown to the user and must never contain a secret, an auth
 * header or a stack trace (API_SPECIFICATION §3, SECRETS §2).
 */
export class AppError extends Error {
  /**
   * @param {keyof ERROR_STATUS} code
   * @param {string} message
   * @param {unknown} [details]
   * @param {{cause?: unknown}} [options]
   */
  constructor(code, message, details = null, options = {}) {
    super(message, options);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
  }

  /** @returns {number} */
  get status() {
    return ERROR_STATUS[this.code];
  }
}

/**
 * A failure with no registry code: an unexpected exception. It is deliberately
 * not in `ERROR_STATUS` because no handler may raise it — the server maps an
 * unhandled throw to this, so the client still receives the §3 envelope.
 */
export class UnhandledError extends Error {
  /**
   * @param {string} requestId
   * @param {unknown} cause
   */
  constructor(requestId, cause) {
    super('Something went wrong. Please try again.', { cause });
    this.name = 'UnhandledError';
    this.code = 'INTERNAL';
    this.details = null;
    this.status = 500;
    this.requestId = requestId;
  }
}

/** A validation failure carrying `details.fields` (API_SPECIFICATION §4). */
export function validationError(fields) {
  return new AppError('VALIDATION_FAILED', 'One or more fields are invalid.', { fields });
}

/** A missing resource. */
export function notFound(resource, id) {
  return new AppError('NOT_FOUND', `${resource} not found.`, { resource, id });
}

/** A legal-transition or lifecycle refusal with a fixed reason string. */
export function conflict(resource, reason, message) {
  return new AppError('CONFLICT', message, { resource, reason });
}
