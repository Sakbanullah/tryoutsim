/**
 * Request-body validation primitives.
 *
 * Field rules themselves live in docs/backend/VALIDATION.md and in each domain
 * module; this file only knows how to *collect* failures so they come back as
 * one `VALIDATION_FAILED` with every offending path, not as a first-error abort.
 * Messages never echo the submitted value.
 */

import { validationError } from '../errors.js';

/**
 * Collects field errors, then throws once so the caller sees all of them.
 */
export class FieldErrors {
  /** @type {{path: string, message: string, rule: string}[]} */
  #fields = [];

  /**
   * Record a failure.
   * @param {string} path dotted path into the body, e.g. `sheets[3].selectedOption`
   * @param {string} message
   * @param {string} rule the rule name, e.g. `required`, `max_length`
   * @returns {this}
   */
  add(path, message, rule) {
    this.#fields.push({ path, message, rule });
    return this;
  }

  /** @returns {boolean} */
  get any() {
    return this.#fields.length > 0;
  }

  /** Throw `VALIDATION_FAILED` carrying every recorded field. */
  throwIfAny() {
    if (this.any) throw validationError(this.#fields);
  }
}

/**
 * Assert that a parsed body is a plain object.
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
export function asObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw validationError([{ path: '', message: 'Body must be a JSON object.', rule: 'type' }]);
  }
  return /** @type {Record<string, unknown>} */ (value);
}

/**
 * Check that a value is a non-empty string.
 * @param {FieldErrors} errors
 * @param {Record<string, unknown>} body
 * @param {string} name
 * @returns {string | undefined}
 */
export function requiredString(errors, body, name) {
  const value = body[name];
  if (typeof value !== 'string' || value.length === 0) {
    errors.add(name, `${name} is required.`, 'required');
    return undefined;
  }
  return value;
}

/**
 * Reject a body key that the documented request shape does not have
 * (VALIDATION.md §1 `unknown_field`). `lifecycle`, `provenance.kind` and
 * `difficulty.empirical` are deliberately absent everywhere: the server owns them.
 *
 * @param {FieldErrors} errors
 * @param {Record<string, unknown>} body
 * @param {readonly string[]} allowed
 */
export function rejectUnknownFields(errors, body, allowed) {
  for (const key of Object.keys(body)) {
    if (!allowed.includes(key)) errors.add(key, `${key} is not accepted.`, 'unknown_field');
  }
}

/**
 * Check that a value is a non-empty string after trimming, and at most `max` characters.
 *
 * @param {FieldErrors} errors
 * @param {unknown} value
 * @param {string} path
 * @param {number} max
 * @param {{min?: number}} [options] minimum trimmed length, default 1
 * @returns {string | undefined} the original (untrimmed) value
 */
export function boundedText(errors, value, path, max, { min = 1 } = {}) {
  if (typeof value !== 'string' || value.trim().length < min) {
    errors.add(path, `${path} must be non-empty.`, 'non_empty');
    return undefined;
  }
  if (value.length > max) {
    errors.add(path, `${path} accepts at most ${max} characters.`, 'max_length');
    return undefined;
  }
  return value;
}

/**
 * Check that an array has at most `max` items and no duplicates.
 * @param {FieldErrors} errors
 * @param {unknown} value
 * @param {string} path
 * @param {number} max
 * @returns {string[] | undefined}
 */
export function uniqueStringArray(errors, value, path, max) {
  if (!Array.isArray(value)) {
    errors.add(path, `${path} must be an array.`, 'type');
    return undefined;
  }
  if (value.length > max) {
    errors.add(path, `${path} accepts at most ${max} items.`, 'max_items');
    return undefined;
  }
  if (!value.every((item) => typeof item === 'string' && item.length > 0)) {
    errors.add(path, `${path} must contain non-empty strings.`, 'items');
    return undefined;
  }
  if (new Set(value).size !== value.length) {
    errors.add(path, `${path} must not contain duplicates.`, 'unique_items');
    return undefined;
  }
  return /** @type {string[]} */ (value);
}
