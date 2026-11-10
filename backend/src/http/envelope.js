/**
 * The success and error envelopes of docs/backend/API_SPECIFICATION.md §2–§3.
 * Every 2xx body is `{ data, meta: { version } }`; every non-2xx body is
 * `{ error: { code, message, details, requestId } }`. Nothing else is ever
 * written to a response.
 */

/** The contract version this server obeys; the frontend matches it (§2). */
export const CONTRACT_VERSION = '1.0.0';

/**
 * Build a success body.
 *
 * @param {unknown} data
 * @returns {{data: unknown, meta: {version: string}}}
 */
export function success(data) {
  return { data, meta: { version: CONTRACT_VERSION } };
}

/**
 * Build an error body.
 *
 * @param {{code: string, message: string, details?: unknown}} error
 * @param {string} requestId
 * @returns {{error: {code: string, message: string, details: unknown, requestId: string}}}
 */
export function failure(error, requestId) {
  return {
    error: {
      code: error.code,
      message: error.message,
      details: error.details ?? null,
      requestId,
    },
  };
}
