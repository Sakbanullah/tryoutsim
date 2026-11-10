/**
 * Request validation for the D2 routes (VALIDATION §1–§2). Each parser collects every field error and throws one
 * `VALIDATION_FAILED`; an unknown field is rejected, never ignored (`unknown_field`).
 */

import { validationError } from '../errors.js';

/**
 * Describe what a body parser accepts.
 * @typedef {{
 *   name: string,
 *   required?: boolean,
 *   kind: 'string' | 'int' | 'boolean' | 'enum' | 'stringArray' | 'object',
 *   values?: readonly string[],
 *   min?: number,
 *   max?: number,
 *   itemMax?: number,
 *   minItems?: number,
 * }} FieldRule
 */

/** `id_format` (VALIDATION §1): an opaque non-empty identifier without whitespace. */
export function isId(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 256 && !/\s/.test(value);
}

/**
 * Parse a JSON body against the documented request shape.
 * @param {unknown} body
 * @param {FieldRule[]} rules
 * @param {{allowExtra?: boolean}} [options] `allowExtra` is only for fields whose shape is a free-form definition
 * @returns {Record<string, unknown>} the accepted fields only
 */
export function parseBody(body, rules, { allowExtra = false } = {}) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw validationError([{ path: '', message: 'Body must be a JSON object.', rule: 'type' }]);
  }
  const input = /** @type {Record<string, unknown>} */ (body);
  const fields = [];

  for (const rule of rules) {
    const value = input[rule.name];
    if (value === undefined) {
      if (rule.required) fields.push({ path: rule.name, message: `${rule.name} is required.`, rule: 'required' });
      continue;
    }
    const failure = checkValue(rule, value);
    if (failure) fields.push({ path: rule.name, message: `${rule.name} is invalid.`, rule: failure });
  }

  if (!allowExtra) {
    const known = new Set(rules.map((rule) => rule.name));
    for (const key of Object.keys(input)) {
      if (!known.has(key)) fields.push({ path: key, message: `${key} is not accepted here.`, rule: 'unknown_field' });
    }
  }

  if (fields.length > 0) throw validationError(fields);
  const result = {};
  for (const rule of rules) if (input[rule.name] !== undefined) result[rule.name] = input[rule.name];
  return result;
}

/**
 * Check one value against its rule.
 * @param {FieldRule} rule
 * @param {unknown} value
 * @returns {string | null} the failing rule id, `null` when valid
 */
function checkValue(rule, value) {
  switch (rule.kind) {
    case 'string':
      return typeof value === 'string' && value.trim().length > 0 ? null : 'non_empty';
    case 'int':
      if (!Number.isSafeInteger(value)) return 'finite_integer';
      if ((rule.min !== undefined && value < rule.min) || (rule.max !== undefined && value > rule.max)) return 'int_range';
      return null;
    case 'boolean':
      return typeof value === 'boolean' ? null : 'type';
    case 'enum':
      return typeof value === 'string' && rule.values.includes(value) ? null : 'enum';
    case 'stringArray':
      if (!Array.isArray(value)) return 'type';
      if (rule.itemMax !== undefined && value.length > rule.itemMax) return 'max_items';
      if (rule.minItems !== undefined && value.length < rule.minItems) return 'min_items';
      if (!value.every((item) => typeof item === 'string' && item.trim().length > 0)) return 'items';
      if (new Set(value).size !== value.length) return 'unique_items';
      return null;
    case 'object':
      return value !== null && typeof value === 'object' && !Array.isArray(value) ? null : 'type';
    default:
      throw new Error(`Unknown field kind ${rule.kind}`);
  }
}

/**
 * Parse a repeated/CSV query parameter into distinct non-empty ids (comma-separated or repeated keys).
 * @param {URLSearchParams} query
 * @param {string} name
 * @returns {string[]}
 */
export function queryIds(query, name) {
  return query.getAll(name).flatMap((value) => value.split(',')).map((value) => value.trim()).filter(Boolean);
}
