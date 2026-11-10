/**
 * D4 self-check: batch planning, the partial-output aggregation, the restart
 * decision, output parsing and the generation request rules (GENERATION_JOBS §2,
 * §3, §5; QUESTION_GENERATION §5–§7).
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AppError } from '../src/errors.js';
import {
  aggregateJob, extractQuestions, isRetryable, parseJsonOutput, planBatches, restartDecision, toJobReport,
} from '../src/domain/generation.js';
import { parseGenerationRequest } from '../src/domain/generation-input.js';

test('batching splits the count and never exceeds the per-call size', () => {
  assert.deepEqual(planBatches({ count: 12, maxContext: null }), [5, 5, 2]);
  assert.deepEqual(planBatches({ count: 3, maxContext: null }), [3]);
  assert.equal(planBatches({ count: 100, maxContext: null }).reduce((a, b) => a + b, 0), 100);
});

test('a small context yields more, smaller batches and never zero', () => {
  assert.deepEqual(planBatches({ count: 10, maxContext: 4500 }), [2, 2, 2, 2, 2]);
  const tiny = planBatches({ count: 3, maxContext: 100 });
  assert.deepEqual(tiny, [1, 1, 1]);
});

test('partial output: questions from successful batches are counted and kept', () => {
  const batches = [
    { status: 'completed', produced: 5, quarantined: 0 },
    { status: 'completed', produced: 5, quarantined: 1 },
    { status: 'failed', produced: 0, quarantined: 0 },
  ];
  assert.deepEqual(aggregateJob(batches), { status: 'completed', produced: 10, quarantined: 1, partial: true, awaitingSampling: true });
});

test('a complete job is not partial; a job with no successful batch fails', () => {
  assert.equal(aggregateJob([{ status: 'completed', produced: 2, quarantined: 0 }]).partial, false);
  const failed = aggregateJob([{ status: 'failed', produced: 0, quarantined: 0 }, { status: 'failed', produced: 0, quarantined: 0 }]);
  assert.equal(failed.status, 'failed');
  assert.equal(failed.partial, false, 'nothing produced means nothing partial');
});

test('an interrupted batch with earlier output is partial', () => {
  const aggregate = aggregateJob([{ status: 'completed', produced: 4, quarantined: 0 }, { status: 'interrupted', produced: 0, quarantined: 0 }]);
  assert.equal(aggregate.status, 'completed');
  assert.equal(aggregate.partial, true);
});

test('restart: queued resumes, running with a sent batch interrupts, terminal untouched', () => {
  assert.deepEqual(restartDecision({ id: 'j', status: 'queued' }, [{ id: 'b1', status: 'queued' }]), { action: 'resume' });
  assert.deepEqual(
    restartDecision({ id: 'j', status: 'running' }, [{ id: 'b1', status: 'committed' }, { id: 'b2', status: 'sent' }, { id: 'b3', status: 'queued' }]),
    { action: 'interrupt', markBatches: ['b2'], dropBatches: ['b3'] },
  );
  for (const status of ['completed', 'failed', 'interrupted']) {
    assert.deepEqual(restartDecision({ id: 'j', status }, []), { action: 'none' });
  }
});

test('a restart never resumes a sent batch that produced nothing', () => {
  const decision = restartDecision({ id: 'j', status: 'running' }, [{ id: 'b1', status: 'sent' }]);
  assert.equal(decision.action, 'interrupt');
  assert.deepEqual(decision.markBatches, ['b1']);
});

test('retry is offered for failed and interrupted only', () => {
  assert.equal(isRetryable('failed'), true);
  assert.equal(isRetryable('interrupted'), true);
  for (const status of ['queued', 'running', 'completed']) assert.equal(isRetryable(status), false);
});

test('output parsing accepts bare JSON and a fenced block', () => {
  assert.deepEqual(parseJsonOutput('{"questions":[]}'), { questions: [] });
  assert.deepEqual(parseJsonOutput('```json\n{"questions":[]}\n```'), { questions: [] });
  assert.equal(parseJsonOutput('Sorry, I cannot.'), null);
  assert.equal(extractQuestions({ items: [] }), null);
  assert.equal(extractQuestions({ questions: [{ stem: 'a' }, 'junk', null] }).length, 1);
});

test('the job report carries counts, batches and no token/cost field', () => {
  const job = { id: 'j1', status: 'completed', count: 6, producedCount: 4, quarantinedCount: 1, partial: 1 };
  const batches = [{ id: 'j1-b1', status: 'completed', failureCategory: null, draftQuestionIds: '["a","b"]' }, { id: 'j1-b2', status: 'failed', failureCategory: 'timeout', draftQuestionIds: '[]' }];
  const report = toJobReport(job, batches, [{ questionId: 'a', stem: 's', lifecycle: 'draft' }]);
  assert.equal(report.partial, true);
  assert.deepEqual(report.failureCategories, { timeout: 1 });
  assert.equal(report.batches[1].failureCategory, 'timeout');
  const text = JSON.stringify(report).toLowerCase();
  for (const banned of ['token', 'cost', 'price', 'usage']) assert.equal(text.includes(banned), false, `report leaks ${banned}`);
});

test('generation request: unknown field, bad count, bad difficulty, empty set are field errors', () => {
  const bad = [
    { competencyIds: ['c1'], count: 1, difficulty: 'easy', providerId: 'p' },
    { competencyIds: ['c1'], count: 0, difficulty: 'easy' },
    { competencyIds: ['c1'], count: 1000, difficulty: 'easy' },
    { competencyIds: ['c1'], count: 1, difficulty: 'impossible' },
    { competencyIds: [], count: 1, difficulty: 'easy' },
    { competencyIds: ['c1', 'c1'], count: 1, difficulty: 'easy' },
  ];
  for (const body of bad) {
    assert.throws(() => parseGenerationRequest(body), (error) => error instanceof AppError && error.code === 'VALIDATION_FAILED');
  }
  assert.deepEqual(parseGenerationRequest({ competencyIds: ['c1'], count: 2, difficulty: 'medium' }), {
    competencyIds: ['c1'], count: 2, difficulty: 'medium',
  });
});
