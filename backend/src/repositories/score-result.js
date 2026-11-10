/**
 * `score_result` aggregate: the stored result of a scored session (DATABASE_SCHEMA §2, SCORING_METHODOLOGY §2.2).
 *
 * Write-once. T-7 rejects every UPDATE and the runtime role holds no UPDATE/DELETE on the table, so a stored result
 * can neither be edited nor replaced — the row *is* the result. A second scoring run therefore reads the first one
 * back instead of writing (API_SPECIFICATION §7.3 idempotency row). The one permitted transition is adding a
 * withheld verdict, which goes through `tryoutsim.add_session_verdict` (AUD-85, PO 2026-11-10).
 */

import { translateDbError } from '../db/errors.js';

/**
 * Insert the result of one scoring run. An existing row wins: calling twice with different content is refused by the
 * primary key, and the caller reads the original back (`loadScoreResult`).
 * @param {import('../generated/prisma/client.ts').PrismaClient} prisma
 * @param {object} input
 * @param {string} input.sessionId
 * @param {object} input.result `ScoreResult` (§2.2), including `approval` and `verdict`
 * @returns {Promise<void>}
 */
export async function writeScoreResult(prisma, { sessionId, result }) {
  const { verdict, approval, withheld, ...score } = result;
  try {
    // `skipDuplicates`: the first result of a session is the only one; a later run never overwrites it.
    await prisma.scoreResult.createMany({
      data: [{
        sessionId,
        snapshotVersion: score.snapshotVersion,
        totalJson: JSON.stringify(score.total),
        byTestJson: JSON.stringify(score.byTest),
        byCompetencyJson: JSON.stringify(score.byCompetency),
        byQuestionJson: JSON.stringify(score.byQuestion),
        thresholdsJson: JSON.stringify(score.thresholds),
        verdictJson: verdict === undefined || verdict === null ? null : JSON.stringify(verdict),
        approvalJson: approval === undefined || approval === null ? null : JSON.stringify(approval),
        verdictWithheldJson: withheld === undefined || withheld === null ? null : JSON.stringify(withheld),
        timingJson: JSON.stringify(score.timing),
        scoredAt: score.scoredAt,
        blockedErrorCode: null,
      }],
      skipDuplicates: true,
    });
  } catch (error) {
    translateDbError(error, { resource: 'score_result', id: sessionId });
  }
}

/**
 * Add the verdict to a stored result that has none (AUD-85, API_SPECIFICATION §7.3). The row's score columns are
 * untouched by construction — the database function only writes the three verdict columns, and T-7 refuses every
 * other change. Returns `false` when the row already carries a verdict (the call is then a no-op).
 * @param {import('../generated/prisma/client.ts').PrismaClient} prisma
 * @param {{sessionId: string, verdict: object, approval: object | null, withheld: object | null}} input
 * @returns {Promise<boolean>}
 */
export async function addStoredVerdict(prisma, { sessionId, verdict, approval, withheld }) {
  try {
    const [row] = await prisma.$queryRaw`
      SELECT tryoutsim.add_session_verdict(
        ${sessionId}, ${JSON.stringify(verdict)}::jsonb, ${approval === null ? null : JSON.stringify(approval)}::jsonb,
        ${withheld === null ? null : JSON.stringify(withheld)}::jsonb) AS "added"`;
    return row.added;
  } catch (error) {
    translateDbError(error, { resource: 'score_result', id: sessionId });
  }
}

/**
 * The stored result of a session in the `ScoreResult` wire shape (§5), or `null` when it has none.
 * @param {import('../generated/prisma/client.ts').PrismaClient} prisma
 * @param {string} sessionId
 * @returns {Promise<{result: object, verdict: object | null} | null>}
 */
export async function loadScoreResult(prisma, sessionId) {
  // `packageBinding` is frozen on the snapshot at creation and read back with the result; never recomputed (AUD-88).
  const row = await prisma.scoreResult.findUnique({
    where: { sessionId },
    include: { session: { select: { snapshot: { select: { packageBindingJson: true, configJson: true } } } } },
  });
  if (!row) return null;
  // `configId`/`configVersion`/`scoringVersion` belong to the `ScoreResult` wire shape (§5) but are not stored on
  // `score_result`: they are the snapshot's own frozen values, the only source that can never drift.
  const frozen = row.session?.snapshot?.configJson == null ? null : JSON.parse(row.session.snapshot.configJson);
  return {
    result: {
      sessionId: row.sessionId,
      ...(frozen === null ? {} : { configId: frozen.configId, configVersion: frozen.configVersion, scoringVersion: frozen.scoringVersion }),
      snapshotVersion: row.snapshotVersion,
      total: JSON.parse(row.totalJson),
      byTest: JSON.parse(row.byTestJson),
      byCompetency: JSON.parse(row.byCompetencyJson),
      byQuestion: JSON.parse(row.byQuestionJson),
      thresholds: JSON.parse(row.thresholdsJson),
      approval: row.approvalJson === null ? null : JSON.parse(row.approvalJson),
      withheld: row.verdictWithheldJson === null ? null : JSON.parse(row.verdictWithheldJson),
      timing: JSON.parse(row.timingJson),
      packageBinding: row.session?.snapshot?.packageBindingJson == null ? null : JSON.parse(row.session.snapshot.packageBindingJson),
      scoredAt: row.scoredAt,
    },
    verdict: row.verdictJson === null ? null : JSON.parse(row.verdictJson),
  };
}
