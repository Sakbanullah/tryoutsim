/**
 * The SEC-2 scrubber (AI_PROVIDER_ARCHITECTURE §3, SECRETS §3).
 *
 * Every string that can leave the adapter or the job runner — a `test().reason`,
 * a stored raw response, a transport error message — passes this function before
 * it is displayed, stored or logged. It removes, in order:
 *
 * 1. any `Authorization` header value (or the `Bearer …` tail of one);
 * 2. the exact stored key, when one is supplied;
 * 3. any `sk-…`-shaped token (the last-4 digits are kept visible by design —
 *    SECRETS §1 shows `keyLast4` — so they are deliberately not scrubbed here).
 */

/** A token shape that must never survive scrubbing. */
const SECRET_SHAPES = [
  /\bsk-[A-Za-z0-9_-]{8,}/g, // OpenAI / OpenRouter-style key
  /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/g,
  // A header echoed in a message: the value runs to the end of its line, because
  // `Authorization: Bearer …` has a space in it.
  /\b(?:authorization|proxy-authorization|api[-_]?key|x-api-key)\s*[:=]\s*[^\r\n]+/gi,
];

/**
 * Remove secrets from a string.
 *
 * @param {string} text
 * @param {string | null} [key] the key in use, when known
 * @returns {string}
 */
export function scrub(text, key = null) {
  let out = String(text);
  if (typeof key === 'string' && key.length >= 4) out = out.split(key).join('[redacted]');
  for (const pattern of SECRET_SHAPES) out = out.replace(pattern, '[redacted]');
  return out;
}
