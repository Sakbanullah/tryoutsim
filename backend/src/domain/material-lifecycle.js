/**
 * Material status, versioning and approval (MATERIAL_SPECIFICATION §1, §5, §6).
 *
 * The record is one row plus an append-only version history (`material_version`, T-10).
 * Approval is bound to a **version number**: a later edit bumps `version`, which makes the
 * old approval refer to a version that is no longer current, and the material
 * recommendable only while `approvalVersion === version` and `status === 'approved'`.
 */

import { conflict } from '../errors.js';

export const MATERIAL_STATUSES = Object.freeze(['draft', 'approved', 'retired']);
export const CONTENT_TYPES = Object.freeze([
  'conceptual', 'strategy', 'factual', 'legal', 'historical', 'policy',
]);
/** §3 provenance kinds. */
export const MATERIAL_PROVENANCE_KINDS = Object.freeze(['manual', 'ai_drafted', 'ai_drafted_reviewed']);
/** §4: content types that must cite a source (M-03). */
export const SOURCED_CONTENT_TYPES = Object.freeze(['factual', 'legal', 'historical', 'policy']);
/** §4 `SourceRef.tier`, plus the fifth evidence tier of CPNS_2026_REGULATIONS §0. */
export const SOURCE_TIERS = Object.freeze([
  'VERIFIED-2026', 'VERIFIED-CURRENT', 'HISTORICAL', 'VERIFIED-ABSENCE', 'UNVERIFIED',
]);

/**
 * §1: selectable for recommendation only when approved **and** approved at the current version.
 * @param {{status: string, version: number, approvalVersion: number | null}} material
 * @returns {boolean}
 */
export function isRecommendable(material) {
  return material.status === 'approved' && material.approvalVersion === material.version;
}

/**
 * A material edit is a new version and returns to `draft` (§5); the previous version stays
 * readable. `retired` is not revived by an edit: retiring is the user's explicit act and
 * nothing in §5 describes un-retiring.
 *
 * @param {{status: string, version: number}} material
 * @returns {{version: number, status: 'draft'}}
 */
export function nextVersion(material) {
  return { version: material.version + 1, status: 'draft' };
}

/**
 * Refuse retiring a retired material. §5 only says retired leaves the pool; there is no
 * documented second retirement, and silently returning success would claim an act happened.
 * @param {{status: string}} material
 */
export function assertRetirable(material) {
  if (material.status === 'retired') {
    throw conflict('material', 'illegal_transition', 'The material is already retired.');
  }
}

/**
 * §5 approval: an explicit act on the current version. Approving a retired material is not
 * described, so it is refused rather than allowed to re-enter the pool by implication.
 * @param {{status: string, version: number}} material
 * @returns {{status: 'approved', approvalVersion: number}}
 */
export function approvalOf(material) {
  if (material.status === 'retired') {
    throw conflict('material', 'illegal_transition', 'A retired material cannot be approved.');
  }
  return { status: 'approved', approvalVersion: material.version };
}

/**
 * A `SourceRef` as §4 defines it.
 * @typedef {{document: string, number: string, article?: string, url?: string, fetchedAt?: string, tier: string}} SourceRef
 */

/**
 * Check a `SourceRef` shape: `document`, `number` and `tier` are required (M-04).
 * @param {unknown} source
 * @returns {string[]} the offending field names, empty when valid
 */
function sourceProblems(source) {
  if (source === null || typeof source !== 'object') return ['document', 'number', 'tier'];
  const value = /** @type {Record<string, unknown>} */ (source);
  const problems = [];
  for (const field of ['document', 'number', 'tier']) {
    if (typeof value[field] !== 'string' || value[field].length === 0) problems.push(field);
  }
  if (typeof value.tier === 'string' && !SOURCE_TIERS.includes(value.tier)) problems.push('tier');
  return problems;
}

/**
 * Run M-01…M-05 (the blocking checks of §6) against one material version.
 *
 * M-02 needs the taxonomy; the caller resolves the node and passes `taxonomyNode`, so this
 * function stays pure. M-06 is a flag-only heuristic and is not run.
 *
 * @param {{title: string, body: string, contentType: string, scope: {kind: string, competencyId?: string},
 *   sources: unknown[], provenance: {kind: string}}} input
 * @param {{exists: boolean, deprecated: boolean} | null} taxonomyNode the node a
 *   competency/domain scope names; `null` for a `free` scope
 * @returns {{id: string, passed: boolean, message?: string}[]}
 */
export function validateMaterial(input, taxonomyNode) {
  /** @type {{id: string, passed: boolean, message?: string}[]} */
  const checks = [];
  const check = (id, passed, message) => checks.push(passed ? { id, passed } : { id, passed, message });

  check('M-01', input.title.trim().length > 0 && input.body.trim().length > 0, 'Title and body are required.');
  check(
    'M-02',
    input.scope.kind === 'free' || (taxonomyNode !== null && taxonomyNode.exists && !taxonomyNode.deprecated),
    'The scope names a competency that does not exist or is deprecated.',
  );

  const sources = Array.isArray(input.sources) ? input.sources : [];
  check(
    'M-03',
    !SOURCED_CONTENT_TYPES.includes(input.contentType) || sources.length > 0,
    'This content type requires at least one source.',
  );

  const problems = sources.flatMap((source) => sourceProblems(source));
  check('M-04', problems.length === 0, 'Every source needs a document and a number.');

  const ai = input.provenance.kind === 'ai_drafted' || input.provenance.kind === 'ai_drafted_reviewed';
  check('M-05', !ai || !carriesOfficialClaim(input.title, input.body), 'AI-drafted material carries an official-claim string.');

  return checks;
}

/** §6 M-05 prohibited strings, the same class as QUESTION_SPECIFICATION §2.1 layer 3. */
export const PROHIBITED_MATERIAL_CLAIMS = Object.freeze(['materi resmi', 'materi bkn', 'logo resmi', 'official logo']);

/**
 * @param {string} title
 * @param {string} body
 * @returns {boolean} true when either text carries a prohibited claim
 */
export function carriesOfficialClaim(title, body) {
  const text = `${title}\n${body}`.toLowerCase();
  return PROHIBITED_MATERIAL_CLAIMS.some((phrase) => text.includes(phrase));
}

/**
 * The blocking check ids a material fails (empty when approvable).
 * @param {{id: string, passed: boolean, message?: string}[]} checks
 * @returns {string[]}
 */
export function failedChecks(checks) {
  return checks.filter((check) => !check.passed).map((check) => check.id);
}
