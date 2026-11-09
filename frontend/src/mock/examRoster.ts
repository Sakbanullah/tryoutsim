import type { SessionQuestion } from '../types/contracts'
import { QUESTIONS } from './questions'

/**
 * `MOCK DATA — NOT FROM API` (GAP-F2, GAP-F8, U-F11)
 *
 * The roster a session is created with, and the content it renders.
 * No documented route returns "the active questions for this config": `GET /questions` is a
 * management listing that includes keys, and `GET /exam-configs/:id` returns rules, not a candidate
 * set. The real roster assembly is a gap (U-F11); the mock fixes it here so the screen exists.
 *
 * Content is stripped to what a running exam may show: no `answerKey`, no `explanation`.
 */
export const EXAM_ROSTER: SessionQuestion[] = QUESTIONS.filter((q) => q.lifecycle === 'active').map((q) => ({
  questionId: q.id,
  test: q.test,
  competencyId: q.competencyId,
  difficulty: q.difficulty,
  stem: q.stem,
  asset: q.asset,
  options: q.options,
  provenanceKind: q.provenance.kind,
}))

/** A short weakness drill: three items across the tested areas (GAP-F12 supplies the real shape). */
export const DRILL_ROSTER: SessionQuestion[] = [EXAM_ROSTER[0], EXAM_ROSTER[5], EXAM_ROSTER[12]].filter(
  (q): q is SessionQuestion => Boolean(q),
)
