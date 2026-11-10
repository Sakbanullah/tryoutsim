/**
 * The T-layer validation run (QUESTION_SPECIFICATION §5): V-01…V-13 over one
 * question's current content, recorded as a `ValidationRecord` (§5.1 shape).
 *
 * Pure: no clock, no database, no provider. The caller supplies the duplicate
 * facts it read from the bank and the timestamp.
 *
 * Only checks whose rule the canonical docs state completely are implemented.
 * A check whose parameter is undecided is **not run**, so it neither passes nor
 * blocks by assumption (see `NOT_RUN` below and the open questions reported with
 * this module).
 */

import { createHash } from 'node:crypto';
import { OPTION_KEYS, validateAnswerKey } from './scoring-key.js';

/** Version of the rules in this file; stored on every record it produces. */
export const VALIDATOR_VERSION = 't-layer/1';

/**
 * Documented checks this module does not run, with the reason. They are omitted from
 * the record rather than reported as passed or failed, so nothing here asserts a
 * verdict on content it did not examine. Listed here so the omission is explicit.
 */
export const NOT_RUN = Object.freeze({
  'V-03': 'stem length bounds are config bounds (QUESTION_SPECIFICATION §5.1 "e.g. 20–600") — no approved value',
  'V-04': 'explanation minimum length is a config value — no approved value',
  'V-07': 'heuristic, does not block activation — deferred',
  'V-09': 'near-duplicate token set is an undefined algorithm — deferred',
  'V-10': 'no documented structure links explanation text to each option weight',
  'V-11': 'the question has no sourceRefs column (QUESTION_SPECIFICATION §1 vs DATABASE_SCHEMA §2)',
});

const DIFFICULTIES = Object.freeze(['easy', 'medium', 'hard']);
const PROVENANCE_KINDS = Object.freeze([
  'ai_generated', 'ai_generated_human_reviewed', 'human_authored', 'official_historical',
]);

/** A provenance kind is AI-origin when a provider made it (QUESTION_SPECIFICATION §2). */
export function isAiOrigin(provenanceKind) {
  return provenanceKind === 'ai_generated' || provenanceKind === 'ai_generated_human_reviewed';
}

/**
 * The official-claim strings V-12 rejects on AI-origin content (QUESTION_SPECIFICATION §2.1
 * layer 3). Case-insensitive substring match.
 */
export const PROHIBITED_CLAIMS = Object.freeze([
  'soal resmi',
  'soal cpns',
  'soal bkn',
  'official logo',
  'logo resmi',
]);

/**
 * Find the prohibited strings in one text.
 * @param {string} text
 * @returns {string[]} the matched fragments (for the check message, never the text)
 */
export function prohibitedClaims(text) {
  const lower = text.toLowerCase();
  return PROHIBITED_CLAIMS.filter((phrase) => lower.includes(phrase));
}

/**
 * contentHash — sha256 over stem + options + explanation (QUESTION_SPECIFICATION §1). The key is
 * excluded; `optionJustifications` therefore never affects it (§1.2 "Versioning").
 *
 * @param {{stem: string, options: unknown, explanation: string}} content
 * @returns {string} hex digest
 */
export function contentHash({ stem, options, explanation }) {
  return createHash('sha256').update(JSON.stringify([stem, options, explanation])).digest('hex');
}

/**
 * Parse and shape-check the options list: exactly five, A–E in order, non-empty,
 * unique text (V-02).
 * @param {unknown} options
 * @returns {string[] | null} the option keys, or null when malformed
 */
function optionKeys(options) {
  if (!Array.isArray(options) || options.length !== OPTION_KEYS.length) return null;
  const keys = [];
  const texts = new Set();
  for (const [index, option] of options.entries()) {
    if (option === null || typeof option !== 'object') return null;
    const { key, text } = /** @type {{key?: unknown, text?: unknown}} */ (option);
    if (key !== OPTION_KEYS[index]) return null;
    if (typeof text !== 'string' || text.trim().length === 0) return null;
    if (texts.has(text)) return null;
    texts.add(text);
    keys.push(key);
  }
  return keys;
}

/**
 * Run V-01…V-13 (the subset with a complete rule) over one question.
 *
 * @param {object} input
 * @param {string} input.questionId
 * @param {{test: string, competency: {id: string, tier: string} | null, stem: string, options: unknown,
 *   answerKey: unknown, explanation: string, provenance: {kind: string}, difficultyAiInitial: string}} input.question
 * @param {string} input.contentHash the hash of the stored content being validated
 * @param {number} input.contentVersion
 * @param {{exactMatch: number, nearMatches: number}} input.duplicates bank facts for V-08/V-09
 * @param {string} input.validatedAt ISO-8601 UTC
 * @returns {{contentVersion: number, contentHash: string, layers: {layer: 'T', result: string, checks: {id: string, passed: boolean, message?: string}[]}[], result: string, validatorVersion: string, validatedAt: string}}
 */
export function runTechnicalValidation({ questionId, question, contentHash: hash, contentVersion, duplicates, validatedAt }) {
  /** @type {{id: string, passed: boolean, message?: string}[]} */
  const checks = [];
  const check = (id, passed, message) => checks.push(passed ? { id, passed } : { id, passed, message });

  const fieldsPresent =
    typeof question.test === 'string' &&
    typeof question.stem === 'string' && question.stem.trim().length > 0 &&
    typeof question.explanation === 'string' && question.explanation.trim().length > 0 &&
    question.options !== undefined &&
    question.answerKey !== undefined &&
    question.provenance !== null && typeof question.provenance === 'object';
  check('V-01', fieldsPresent, 'A required field is missing or mistyped.');

  const keys = optionKeys(question.options);
  check('V-02', keys !== null, 'Options must be exactly A–E with non-empty, unique text.');

  const competencyOk = question.competency !== null && question.competency.tier !== 'DEPRECATED';
  check('V-05', competencyOk, 'The competency does not exist or is deprecated.');

  const keyResult = keys === null
    ? { ok: /** @type {const} */ (false) }
    : tryKey({ questionId, test: question.test, optionKeys: keys, answerKey: question.answerKey });
  check('V-06', keyResult.ok, keyResult.ok ? undefined : 'The answer key is invalid.');

  const provenanceKind =
    question.provenance !== null && typeof question.provenance === 'object'
      ? /** @type {{kind?: unknown}} */ (question.provenance).kind
      : undefined;
  const provenanceOk = typeof provenanceKind === 'string' && PROVENANCE_KINDS.includes(provenanceKind);
  check('V-12a', provenanceOk, 'Provenance must be present with a known kind (BR-Q1).');

  const claims = provenanceOk && isAiOrigin(provenanceKind)
    ? [...prohibitedClaims(question.stem), ...prohibitedClaims(question.explanation)]
    : [];
  check('V-12', claims.length === 0, claims.length === 0 ? undefined : 'AI-origin content carries an official-claim string.');

  check('V-13', keyResult.ok && keyV13(question.test, keyResult.ok ? keyResult.key : null),
    'Option justifications do not match the key.');

  check('V-08', duplicates.exactMatch === 0, 'contentHash matches an existing non-archived question.');

  const difficultyOk = DIFFICULTIES.includes(question.difficultyAiInitial);
  check('V-01b', difficultyOk, 'difficultyAiInitial must be easy, medium or hard.');

  if (contentHash({ stem: question.stem, options: question.options, explanation: question.explanation }) !== hash) {
    checks.push({ id: 'V-00', passed: false, message: 'The supplied hash does not match the content.' });
  }

  const failed = checks.some((c) => !c.passed);
  const flagged = duplicates.nearMatches > 1 && !failed;
  const result = failed ? 'fail' : flagged ? 'flagged' : 'pass';

  return {
    contentVersion,
    contentHash: hash,
    layers: [{ layer: 'T', result, checks }],
    result,
    validatorVersion: VALIDATOR_VERSION,
    validatedAt,
  };
}

/**
 * Run the key rule without letting it throw, so V-06 and V-13 share one evaluation.
 * @param {{questionId: string, test: string, optionKeys: string[], answerKey: unknown}} input
 * @returns {{ok: true, key: object} | {ok: false}}
 */
function tryKey(input) {
  try {
    return { ok: true, key: validateAnswerKey(input) };
  } catch {
    return { ok: false };
  }
}

/**
 * V-13 is part of V-06's key validation; this names it so the record carries the id explicitly.
 * @param {string} test
 * @param {object | null} key a key that already passed `validateAnswerKey`
 * @returns {boolean}
 */
function keyV13(test, key) {
  if (key === null) return false;
  if (test !== 'TKP') return /** @type {{optionJustifications: unknown}} */ (key).optionJustifications === null;
  return /** @type {{optionJustifications: object | null}} */ (key).optionJustifications !== null;
}

/**
 * Whether a record says the content currently stored passed. A record is stale when its hash
 * differs from the question's current hash (DATABASE_SCHEMA §2 `validation_record`).
 * @param {{result: string, contentHash: string} | null} record
 * @param {string} currentHash
 * @returns {boolean}
 */
export function isPassingForCurrentHash(record, currentHash) {
  return record !== null && record.result === 'pass' && record.contentHash === currentHash;
}
