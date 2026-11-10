/**
 * `/questions`, `/materials`, `/taxonomy` request contract (no database).
 *
 * The routes themselves need PostgreSQL; what is checkable without it — the body parsers, which
 * decide every `400` before a query runs — is what these tests exercise. A refusal here is the one
 * a user sees, so the assertions are on the error code and the offending path.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseCreateBody } from '../src/routes/questions.js';
import { parseMaterialBody } from '../src/routes/materials.js';
import { activationBlockers } from '../src/domain/question-lifecycle.js';
import { validateMaterial, failedChecks } from '../src/domain/material-lifecycle.js';

/** Assert a parser threw `VALIDATION_FAILED` naming `path`. */
const rejects = (fn, path) => {
  assert.throws(fn, (error) => {
    assert.equal(error.code, 'VALIDATION_FAILED');
    assert.ok(error.details.fields.some((field) => field.path === path), `expected a failure on ${path}`);
    return true;
  });
};

const VALID_QUESTION = {
  test: 'TIU',
  competencyId: 'TIU.1',
  stem: 'Which number continues the sequence?',
  options: [{ key: 'A', text: '1' }, { key: 'B', text: '2' }, { key: 'C', text: '3' }, { key: 'D', text: '4' }],
  answerKey: { optionScores: { A: 0, B: 0, C: 0, D: 5 }, maxScore: 5 },
  explanation: 'The sequence doubles.',
  difficultyAiInitial: 'medium',
};

test('question create: a documented body is accepted unchanged', () => {
  const parsed = parseCreateBody(VALID_QUESTION);
  assert.equal(parsed.test, 'TIU');
  assert.equal(parsed.stimulus, null, 'an absent optional field is null, not undefined');
  assert.equal(parsed.options.length, 4);
});

test('question create: every field rule names its own path', () => {
  rejects(() => parseCreateBody({ ...VALID_QUESTION, test: 'XYZ' }), 'test');
  rejects(() => parseCreateBody({ ...VALID_QUESTION, difficultyAiInitial: 'harder' }), 'difficultyAiInitial');
  rejects(() => parseCreateBody({ ...VALID_QUESTION, options: [] }), 'options');
  rejects(() => parseCreateBody({ ...VALID_QUESTION, stem: '' }), 'stem');
  rejects(() => parseCreateBody({ ...VALID_QUESTION, competencyId: '' }), 'competencyId');
});

test('question create: server-owned fields cannot be supplied', () => {
  for (const field of ['lifecycle', 'dynamicEligible', 'contentHash', 'provenance']) {
    rejects(() => parseCreateBody({ ...VALID_QUESTION, [field]: 'x' }), field);
  }
});

test('question create: all failures come back in one response', () => {
  assert.throws(() => parseCreateBody({ test: 'XYZ', stem: '' }), (error) => {
    const paths = error.details.fields.map((field) => field.path);
    for (const path of ['test', 'stem', 'competencyId', 'options', 'explanation', 'difficultyAiInitial']) {
      assert.ok(paths.includes(path), path);
    }
    return true;
  });
});

const VALID_MATERIAL = {
  title: 'Deret dan pola bilangan',
  contentType: 'factual',
  scope: { kind: 'competency', competencyId: 'TIU.1' },
  provenance: { kind: 'manual' },
  sources: [{ document: 'Permenpan', number: '1/2026', tier: 'VERIFIED-2026' }],
  body: 'Pola bilangan adalah susunan yang mengikuti aturan tertentu.',
};

test('material create: a documented body is accepted; a free scope needs no competency', () => {
  assert.equal(parseMaterialBody(VALID_MATERIAL, { requireAll: true }).title, VALID_MATERIAL.title);
  assert.equal(parseMaterialBody({ ...VALID_MATERIAL, scope: { kind: 'free' } }, { requireAll: true }).scope.kind, 'free');
});

test('material create: scope and provenance enums, and the sourced-type rule', () => {
  rejects(() => parseMaterialBody({ ...VALID_MATERIAL, scope: { kind: 'subject' } }, { requireAll: true }), 'scope');
  rejects(() => parseMaterialBody({ ...VALID_MATERIAL, scope: { kind: 'domain' } }, { requireAll: true }), 'scope.competencyId');
  rejects(() => parseMaterialBody({ ...VALID_MATERIAL, provenance: { kind: 'ai' } }, { requireAll: true }), 'provenance.kind');
  rejects(() => parseMaterialBody({ ...VALID_MATERIAL, contentType: 'unknown' }, { requireAll: true }), 'contentType');
});

test('material edit: partial bodies are accepted, an empty one is not', () => {
  assert.deepEqual(Object.keys(parseMaterialBody({ title: 'Baru' }, { requireAll: false })), ['title']);
  rejects(() => parseMaterialBody({}, { requireAll: false }), '');
});

test('material approval: M-03 requires a source for a sourced content type only', () => {
  const noSources = { ...VALID_MATERIAL, sources: [] };
  assert.deepEqual(failedChecks(validateMaterial(noSources, { exists: true, deprecated: false })), ['M-03']);
  assert.deepEqual(
    failedChecks(validateMaterial({ ...noSources, contentType: 'conceptual', scope: { kind: 'free' } }, null)),
    [],
    'a conceptual material needs no source and no taxonomy node',
  );
});

test('material approval: a deprecated scope and an official-claim string are refused', () => {
  assert.ok(failedChecks(validateMaterial(VALID_MATERIAL, { exists: true, deprecated: true })).includes('M-02'));
  const claim = { ...VALID_MATERIAL, provenance: { kind: 'ai_drafted' }, title: 'Materi resmi CPNS' };
  assert.ok(failedChecks(validateMaterial(claim, { exists: true, deprecated: false })).includes('M-05'));
});

test('activation gate: a quarantined question is not activatable, whatever else is true', () => {
  const reasons = activationBlockers({
    question: { lifecycle: 'quarantined', contentHash: 'h', answerKeyValidatedAt: 'a', provenanceJson: '{}' },
    latestValidation: { result: 'pass', contentHash: 'h' },
    acceptedByUser: true,
  });
  assert.deepEqual(reasons, ['illegal_state']);
});
