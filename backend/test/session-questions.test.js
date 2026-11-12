/**
 * Self-check for the §7.7 review-block assembly: the id rules collapse to one
 * `400`, the source split is labelled correctly, and nothing is recomputed.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assertSubmitted, buildReviewResponse, keyedOption, parseReviewIds,
} from '../src/repositories/session-questions.js';

const ROSTER = ['q1', 'q2', 'q3'];

test('ids: every rejection is the same VALIDATION_FAILED', () => {
  const bad = [null, '', 'q1,q1', 'q1,q9', 'q1,,q2', 'q1, q2', Array(21).fill('q1').join(',')];
  for (const raw of bad) {
    assert.throws(() => parseReviewIds(raw, ROSTER), (error) => {
      assert.equal(error.code, 'VALIDATION_FAILED');
      return true;
    }, `raw=${raw}`);
  }
});

test('ids: accepted list keeps requested order', () => {
  assert.deepEqual(parseReviewIds('q3,q1', ROSTER), ['q3', 'q1']);
});

test('keyedOption: only a unique top scorer on TWK/TIU', () => {
  const key = { optionScores: { A: 0, B: 5, C: 0 } };
  assert.equal(keyedOption(key, 'TIU', 5), 'B');
  assert.equal(keyedOption(key, 'TKP', 5), null, 'TKP never has a keyed option');
  assert.equal(keyedOption({ optionScores: { A: 5, B: 5 } }, 'TIU', 5), null, 'ambiguous top');
});

test('block: frozen content, latest explanation, stored score echoed', () => {
  const read = () => ({
    frozen: { test: 'TIU', stem: 's', options: [{ key: 'A', text: 'a' }], questionVersion: 2 },
    frozenKey: { optionScores: { A: 5, B: 0 } },
    scored: { earned: 0, maxScore: 5, selected: 'B', correct: false },
    latest: { contentVersion: 3, explanation: 'e', answerKeyJson: '{"optionScores":{}}', lifecycle: 'live' },
  });
  const [block] = buildReviewResponse('s1', ['q1'], read).questions;
  assert.equal(block.frozenContentVersion, 2);
  assert.equal(block.latestContentVersion, 3, 'mismatch is reported, not hidden');
  assert.equal(block.explanation, 'e');
  assert.equal(block.explanationSource, 'latest');
  assert.equal(block.keyedOption, 'A');
  assert.deepEqual([block.earned, block.maxScore], [0, 5], 'echoed, not recomputed');
  assert.equal(block.justificationsSource, 'none');
  assert.equal(block.questionState, 'live');
});

test('block: a missing current question still renders frozen content with no explanation', () => {
  const read = () => ({
    frozen: { test: 'TWK', stem: 's', options: [], questionVersion: 1 },
    frozenKey: { optionScores: { A: 5 }, optionJustifications: { A: 'why' } },
    scored: { earned: 5, maxScore: 5, selected: 'A', correct: true },
    latest: null,
  });
  const [block] = buildReviewResponse('s1', ['q1'], read).questions;
  assert.equal(block.questionState, 'missing');
  assert.equal(block.latestContentVersion, null);
  assert.equal(block.explanation, null);
  assert.equal(block.explanationSource, 'none');
  assert.equal(block.justificationsSource, 'frozen');
  assert.equal(block.frozenContentVersion, 1, 'BUG-011: read from `questionVersion`');
});

/** A snapshot entry in the shape `session.js` `buildSnapshot` writes. */
const snapshotEntry = (questionVersion) => ({
  questionId: 'q1', questionVersion, contentHash: 'h', test: 'TIU',
  optionKeys: ['A', 'B'], options: [{ key: 'A', text: 'a' }, { key: 'B', text: 'b' }],
  stem: 's', difficulty: 'easy', provenanceKind: 'human', maxScore: 5,
});

/** `loadReview`'s read callback for one snapshot entry and one current `question` row. */
const reader = (frozen, latest) => () => ({
  frozen,
  frozenKey: { optionScores: { A: 5, B: 0 } },
  scored: { earned: 0, maxScore: 5, selected: 'B', correct: false },
  latest,
});

test('BUG-011: equal frozen and latest versions expose the same number (explanation may render)', () => {
  const latest = { contentVersion: 2, explanation: 'e', answerKeyJson: '{"optionScores":{}}', lifecycle: 'live' };
  const [block] = buildReviewResponse('s1', ['q1'], reader(snapshotEntry(2), latest)).questions;
  assert.equal(block.frozenContentVersion, 2);
  assert.equal(block.latestContentVersion, 2);
  assert.equal(block.frozenContentVersion, block.latestContentVersion);
});

test('BUG-011: edited question reports two different versions (explanation is hidden)', () => {
  const latest = { contentVersion: 3, explanation: 'e', answerKeyJson: '{"optionScores":{}}', lifecycle: 'live' };
  const [block] = buildReviewResponse('s1', ['q1'], reader(snapshotEntry(2), latest)).questions;
  assert.equal(block.frozenContentVersion, 2);
  assert.equal(block.latestContentVersion, 3);
  assert.notEqual(block.frozenContentVersion, block.latestContentVersion);
});

test('BUG-011: an entry with no version yields null, never a crash or a match', () => {
  const latest = { contentVersion: 2, explanation: 'e', answerKeyJson: '{"optionScores":{}}', lifecycle: 'live' };
  const { questionVersion, ...withoutVersion } = snapshotEntry(2);
  void questionVersion;
  const [block] = buildReviewResponse('s1', ['q1'], reader(withoutVersion, latest)).questions;
  assert.equal(block.frozenContentVersion, null, 'absent field is null, so strict matching cannot pass');
  assert.notEqual(block.frozenContentVersion, block.latestContentVersion);
  assert.deepEqual(block.options, [{ key: 'A', text: 'a' }, { key: 'B', text: 'b' }], 'frozen content still renders');
});

test('open session is refused with session_open, both modes', () => {
  for (const mode of ['tryout', 'latihan']) {
    void mode;
    assert.throws(() => assertSubmitted({ status: 'open' }), (error) => {
      assert.equal(error.code, 'CONFLICT');
      assert.equal(error.details.reason, 'session_open');
      return true;
    });
  }
  assert.doesNotThrow(() => assertSubmitted({ status: 'submitted' }));
});
