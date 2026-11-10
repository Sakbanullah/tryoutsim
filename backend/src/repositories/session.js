/**
 * Session aggregate: roster selection, the frozen snapshot, answer writes, the clock, submit, `/score`, `/result`,
 * review and deletion (API_SPECIFICATION §7.3–§7.7, SCORING_METHODOLOGY §7–§8.1, DATABASE_SCHEMA §2).
 *
 * The live bank is read once, at creation, to assemble the roster (PACKAGE_SPECIFICATION §4). After that a session
 * reads only its snapshot, except the two checks DATABASE_SCHEMA §1 names: PF-12 and PF-13 compare the frozen
 * snapshot with the live config/approval rows — which can only withhold a verdict, never change a score.
 * Nothing here computes a score: `domain/scoring.js` does.
 */

import { createHash, randomUUID } from 'node:crypto';
import { AppError, conflict, notFound } from '../errors.js';
import { translateDbError } from '../db/errors.js';
import { buildApprovalRef, currentApproval, evaluateApproval } from '../domain/approval.js';
import { parseJson, toScoringRules, toThresholdSet } from '../domain/exam-config.js';
import { preflight } from '../domain/preflight.js';
import { scoreSession } from '../domain/scoring.js';
import { activeNow, assessWrite, isExpired, pause, resume } from '../domain/session-clock.js';
import { assertOpen, assertSubmittable } from '../domain/session-state.js';
import { assertSubmitted as assertReviewable, buildReviewResponse, parseReviewIds } from './session-questions.js';
import { addStoredVerdict, loadScoreResult, writeScoreResult } from './score-result.js';

/** Hard ceiling on a roster's size, so a malformed definition cannot ask for an unbounded selection. */
const MAX_ROSTER = 500;

/** The local user's identity string, recorded as approval evidence (single local user, ADR-009). */
export const LOCAL_USER = 'local-user';

/** Pre-flight codes that are a threshold-set block (SCORING_METHODOLOGY §11.1 item 2, §5.3). */
const THRESHOLD_BLOCK_CODES = ['THRESHOLD_CONFIG_INVALID', 'THRESHOLD_NOT_INTEGER', 'THRESHOLD_EXCEEDS_MAX', 'THRESHOLDS_REQUIRE_APPROVAL'];

/**
 * Convert a stored `optionsJson`/`options_json` value to the `[{key, text}]` shape the snapshot holds.
 * @param {string} json an options array, or an object with an `options` array
 * @returns {Array<{key: string, text: string}>}
 */
function parseOptions(json) {
  const parsed = parseJson(json);
  const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.options) ? parsed.options : [];
  return list.filter((o) => typeof o?.key === 'string' && typeof o?.text === 'string').map((o) => ({ key: o.key, text: o.text }));
}

/**
 * Eligible stock for a package definition (PACKAGE_SPECIFICATION §4.1): active, dynamically eligible, matching the
 * definition's test and — for `submateri` — its competencies.
 * @param {import('../generated/prisma/client.ts').PrismaClient} prisma
 * @param {object} definition
 * @returns {Promise<object[]>} rows ordered by id, so selection starts from a stable base
 */
async function eligibleQuestions(prisma, definition) {
  const tests = definition.kind === 'full_simulation' ? ['TWK', 'TIU', 'TKP'] : [definition.test];
  const competencies = definition.competencyIds ?? null;
  return prisma.$queryRaw`
    SELECT q."id" AS "questionId", q."test", q."competencyId", q."optionsJson", q."answerKeyJson",
           q."contentVersion" AS "version", q."contentHash"
    FROM "question" q
    WHERE q."lifecycle" = 'active' AND q."dynamicEligible" = 1
      AND q."test" = ANY(${tests}::text[])
      AND (${competencies === null} OR q."competencyId" = ANY(${competencies ?? []}::text[]))
    ORDER BY q."id"`;
}

/**
 * Answered-before index for a set of question ids (§4.2 partition).
 * @param {import('../generated/prisma/client.ts').PrismaClient} prisma
 * @param {string[]} questionIds
 * @returns {Promise<Map<string, {lastAnsweredAt: string | null, answerCount: number}>>}
 */
async function answeredHistory(prisma, questionIds) {
  if (questionIds.length === 0) return new Map();
  const rows = await prisma.$queryRaw`
    SELECT "questionId", "lastAnsweredAt", "answerCount" FROM "observed_question_history"
    WHERE "questionId" = ANY(${questionIds}::text[])`;
  return new Map(rows.map((row) => [row.questionId, { lastAnsweredAt: row.lastAnsweredAt, answerCount: row.answerCount }]));
}

/**
 * Build the roster (PACKAGE_SPECIFICATION §4.2). `avoid_answered`: unseen first, then seen items least-recently
 * answered; `allow_repeat`: everything, still least-recently answered first. Ties keep the repository's id order.
 * @param {object[]} eligible
 * @param {number} required the definition's `itemCount`
 * @param {'avoid_answered' | 'allow_repeat'} policy
 * @param {Map<string, {lastAnsweredAt: string | null}>} history
 * @returns {{selected: object[], repeatCount: number}}
 */
export function selectRoster(eligible, required, policy, history) {
  const last = (q) => history.get(q.questionId)?.lastAnsweredAt ?? '';
  const unseen = () => eligible.filter((q) => !history.has(q.questionId));
  const seen = () => eligible.filter((q) => history.has(q.questionId)).sort((a, b) => (last(a) < last(b) ? -1 : last(a) > last(b) ? 1 : 0));

  // ponytail: §4.2 step 5 (difficulty mix, then created-time) is not applied — the bank has no created-time column
  // and the repository supplies a stable id order. Add it when a creation timestamp exists.
  const pool = policy === 'allow_repeat' ? [...seen(), ...unseen()] : [...unseen(), ...seen()];
  const selected = pool.slice(0, Math.min(required, MAX_ROSTER));
  return { selected, repeatCount: selected.filter((q) => history.has(q.questionId)).length };
}

/**
 * Live preview of a selection for the package view (no write, §4.4).
 * @returns {Promise<{eligibleTotal: number, selected: number, required: number, repeatCount: number}>}
 */
export async function estimateSelection(prisma, definition, policy) {
  const eligible = await eligibleQuestions(prisma, definition);
  const history = await answeredHistory(prisma, eligible.map((q) => q.questionId));
  const { selected, repeatCount } = selectRoster(eligible, definition.itemCount ?? 0, policy, history);
  return { eligibleTotal: eligible.length, selected: selected.length, required: definition.itemCount ?? 0, repeatCount };
}

/** A config a session may bind: CPNS, seed data, verified or provisional (CPNS_2026_REGULATIONS §4.2.1). */
const USABLE_CONFIG = { pathway: 'CPNS', dataProvenance: 'seed', state: { in: ['official_verified', 'provisional'] } };

/**
 * Resolve the config a new session binds (CPNS_2026_REGULATIONS §4.2.1): order 1, the version's pinned config when
 * it is still usable and its `configVersion` matches the pin; order 2, the latest usable CPNS config —
 * `official_verified` first, then `provisional`, newest version first. `legacy` rows are never candidates.
 * @param {{examConfigId?: string | null, examConfigVersion?: number | null}} version the `package_version` row
 * @returns {Promise<{config: object, resolution: 'pinned' | 'fallback' | 'resolved'}>} `fallback` when a pin
 *   exists but is no longer usable
 */
async function resolveConfig(prisma, version) {
  const pinned = version.examConfigId
    ? await prisma.examConfig.findFirst({ where: { ...USABLE_CONFIG, id: version.examConfigId, configVersion: version.examConfigVersion } })
    : null;
  if (pinned) return { config: pinned, resolution: 'pinned' };

  const rows = await prisma.examConfig.findMany({ where: USABLE_CONFIG, orderBy: [{ configVersion: 'desc' }, { id: 'asc' }] });
  const config = rows.find((row) => row.state === 'official_verified') ?? rows[0];
  if (!config) throw conflict('session', 'no_usable_config', 'No CPNS examination configuration can back a session.');
  return { config, resolution: version.examConfigId ? 'fallback' : 'resolved' };
}

/**
 * SHA-256 over the ordered roster ids (PACKAGE_SPECIFICATION §5 `rosterHash`).
 * @param {string[]} ids
 * @returns {string} hex digest
 */
function rosterDigest(ids) {
  return createHash('sha256').update(ids.join('\n')).digest('hex');
}

/**
 * The `session_snapshot` columns for a roster (SCORING_METHODOLOGY §7). `questionsJson` also carries each question's
 * `maxScore` so `byQuestion[].maxScore` survives an edit (DATABASE_SCHEMA §2).
 * @param {object} input see `createSession`
 * @returns {object} snapshot columns, minus `sessionId`
 */
function buildSnapshot({ roster, config, basisRefs, thresholdsRow, approvalRows, packageBinding, repeatCount, attemptedBefore, durationMs, snapshotVersion }) {
  const questions = roster.map((q) => {
    const key = parseJson(q.answerKeyJson);
    const options = parseOptions(q.optionsJson);
    return {
      questionId: q.questionId,
      questionVersion: q.version,
      contentHash: q.contentHash,
      test: q.test,
      competencyId: q.competencyId,
      optionKeys: options.map((o) => o.key),
      options,
      maxScore: key?.maxScore ?? null,
    };
  });

  return {
    snapshotVersion,
    questionsJson: JSON.stringify(questions),
    answerKeysJson: JSON.stringify(roster.map((q) => ({ questionId: q.questionId, ...parseJson(q.answerKeyJson) }))),
    configJson: JSON.stringify({
      configId: config.id,
      configVersion: config.configVersion,
      scoringVersion: config.scoringVersion,
      examYear: config.examYear,
      pathway: config.pathway,
      state: config.state,
      regulatoryBasisHash: config.regulatoryBasisHash,
      regulatoryBasis: basisRefs.map((b) => ({ tier: b.tier, pathway: b.pathway, examYear: b.examYear })),
      scoringRules: toScoringRules(config),
      notice: config.notice,
    }),
    thresholdsJson: JSON.stringify(toThresholdSet(thresholdsRow)),
    approvalJson: JSON.stringify(buildApprovalRef({ configId: config.id, configVersion: config.configVersion }, approvalRows)),
    packageBindingJson: JSON.stringify(packageBinding),
    timingJson: JSON.stringify({ mode: 'accumulated_active', durationMs, activeMsAtStart: 0, autoSubmitOnExpiry: durationMs !== null }),
    rosterJson: JSON.stringify({ repeatCount, attemptedBefore }),
    // ponytail: the taxonomy has no version column; the config's exam year stands in for it until one exists.
    taxonomyVersion: String(config.examYear),
  };
}

/**
 * Normalise a stored `session_snapshot` row to the plain shape pre-flight and scoring consume (see `scoring.js`).
 * @param {object} row `session_snapshot` row
 * @returns {object}
 */
export function normaliseSnapshot(row) {
  const config = parseJson(row.configJson) ?? {};
  const thresholds = parseJson(row.thresholdsJson);
  const approvalRef = parseJson(row.approvalJson);
  const basis = config.regulatoryBasis ?? [];
  const source = thresholds && thresholds.mode !== 'none' ? thresholds.source : null;

  return {
    snapshotVersion: row.snapshotVersion,
    taxonomyVersion: row.taxonomyVersion,
    configId: config.configId,
    configVersion: config.configVersion,
    scoringVersion: config.scoringVersion,
    examYear: config.examYear,
    pathway: config.pathway,
    state: config.state,
    regulatoryBasisHash: config.regulatoryBasisHash,
    scoringRules: config.scoringRules,
    // §5.4: a threshold whose basis is a VERIFIED-2026 instrument for this config's own pathway needs no approval.
    thresholdBasisIsAuthority: source?.tier === 'VERIFIED-2026' && source?.pathway === config.pathway,
    thresholds: thresholds?.mode === 'none' ? { mode: 'none' } : thresholds ?? null,
    thresholdMode: thresholds?.mode ?? 'none',
    questions: parseJson(row.questionsJson),
    answerKeys: parseJson(row.answerKeysJson),
    provisionalApproval: approvalRef?.approval ?? null,
    sourceApprovalRowId: approvalRef?.source?.rowId ?? null,
    packageBinding: parseJson(row.packageBindingJson),
    timing: parseJson(row.timingJson),
    basis,
  };
}

/**
 * The competency registry PF-07 needs. `competency` carries no version column, so every row is the registry.
 * @returns {Promise<Map<string, {test: string, deprecated: boolean}>>}
 */
async function taxonomyFor(prisma) {
  const rows = await prisma.competency.findMany({ select: { id: true, test: true, tier: true } });
  return new Map(rows.map((row) => [row.id, { test: row.test, deprecated: row.tier === 'DEPRECATED' }]));
}

/**
 * Create a session from a package version (POST /packages/:id/sessions, API_SPECIFICATION §7.4). `session` and
 * `session_snapshot` are written in one transaction (DB-6).
 * @param {import('../generated/prisma/client.ts').PrismaClient} prisma
 * @param {{pkg: object, version: object}} found
 * @param {'tryout' | 'latihan'} mode
 * @param {string} nowIso server clock, ISO-8601 UTC
 * @returns {Promise<{session: object, snapshotVersion: string, configResolution: 'pinned' | 'fallback' | 'resolved'}>}
 *   see `resolveConfig`
 */
export async function createSession(prisma, { pkg, version }, mode, nowIso) {
  if (pkg.retiredAt !== null) throw conflict('package', 'package_retired', 'This package has been retired.');
  if (pkg.mode !== mode) throw conflict('session', 'mode_mismatch', 'The session mode must match the package mode.');

  const definition = parseJson(version.definitionJson);
  if (!definition) throw conflict('package', 'definition_unreadable', 'The package definition cannot be read.');

  const eligible = await eligibleQuestions(prisma, definition);
  const history = await answeredHistory(prisma, eligible.map((q) => q.questionId));
  const { selected, repeatCount } = selectRoster(eligible, definition.itemCount ?? 0, definition.repeatPolicy, history);
  if (selected.length === 0) {
    throw new AppError('CONFLICT', 'No eligible question can fill this package.', {
      resource: 'package',
      reason: 'no_eligible_stock',
      shortfall: { required: definition.itemCount ?? 0, eligible: eligible.length },
    });
  }

  const { config, resolution: configResolution } = await resolveConfig(prisma, version);
  const [basisRefs, thresholdsRow, approvalRows] = await Promise.all([
    prisma.basisRef.findMany({ where: { examConfigId: config.id }, orderBy: { id: 'asc' } }),
    prisma.thresholds.findUnique({ where: { examConfigId: config.id } }),
    prisma.provisionalApproval.findMany({ where: { configId: config.id }, orderBy: { approvedByUserAt: 'desc' } }),
  ]);

  const sessionId = `ses_${randomUUID()}`;
  const rosterHash = rosterDigest(selected.map((q) => q.questionId));
  // SCORING_METHODOLOGY §8.1: a tryout's clock is the config's duration; a practice (`latihan`) session has none and
  // never expires.
  const durationMs = mode === 'tryout' && config.durationMinutes !== null ? config.durationMinutes * 60_000 : null;
  const snapshotVersion = `s1-${nowIso}-${rosterHash.slice(0, 8)}`;
  const snapshot = buildSnapshot({
    roster: selected,
    config,
    basisRefs,
    thresholdsRow,
    approvalRows,
    packageBinding: { packageId: pkg.id, packageVersion: version.version, mode, kind: definition.kind, rosterHash },
    repeatCount,
    attemptedBefore: selected.filter((q) => history.has(q.questionId)).length,
    durationMs,
    snapshotVersion,
  });

  try {
    const session = await prisma.$transaction(async (tx) => {
      const created = await tx.session.create({
        data: {
          id: sessionId,
          examConfigId: config.id,
          configVersion: config.configVersion,
          scoringVersion: config.scoringVersion,
          mode,
          packageId: pkg.id,
          packageVersion: version.version,
          rosterJson: JSON.stringify(selected.map((q) => q.questionId)),
          status: 'open',
          activeMs: 0,
          runningSince: nowIso,
          durationMs,
          startedAt: nowIso,
          submittedAt: null,
        },
      });
      await tx.sessionSnapshot.create({ data: { sessionId, ...snapshot } });
      return created;
    });
    return { session, snapshotVersion, configResolution };
  } catch (error) {
    translateDbError(error, { resource: 'session', id: sessionId });
  }
}

/**
 * One session or `NOT_FOUND`.
 * @returns {Promise<object>}
 */
export async function requireSession(prisma, sessionId) {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) throw notFound('session', sessionId);
  return session;
}

/**
 * The session's frozen snapshot or a `409` (a session without a snapshot never legitimately started).
 * @returns {Promise<object>} normalised snapshot
 */
async function requireSnapshot(prisma, sessionId) {
  const row = await prisma.sessionSnapshot.findUnique({ where: { sessionId } });
  if (!row) throw conflict('session', 'snapshot_missing', 'This session has no frozen snapshot.');
  return normaliseSnapshot(row);
}

/**
 * Session history (GET /sessions, API_ENDPOINTS §4), newest first, with each row's stored result total.
 * @param {{mode: string | null, status: string | null, from: string | null, to: string | null}} filter
 * @returns {Promise<object[]>} rows of `toSessionSummary`
 */
export async function listSessions(prisma, { mode, status, from, to }) {
  return prisma.$queryRaw`
    SELECT s."id", s."mode", s."status", s."packageId", s."packageVersion", s."examConfigId", s."startedAt",
           s."submittedAt", r."totalJson"
    FROM "session" s
    LEFT JOIN "score_result" r ON r."sessionId" = s."id"
    WHERE (${mode}::text IS NULL OR s."mode" = ${mode}::text)
      AND (${status}::text IS NULL OR s."status" = ${status}::text)
      AND (${from}::text IS NULL OR s."startedAt" >= ${from}::text)
      AND (${to}::text IS NULL OR s."startedAt" <= ${to}::text)
    ORDER BY s."startedAt" DESC, s."id" DESC`;
}

/**
 * A history row (FRONTEND_DATA_CONTRACTS `SessionSummary`; `scored` is derived from the stored result, one fact in
 * one place).
 * @param {object} row
 * @returns {object}
 */
export function toSessionSummary(row) {
  const total = row.totalJson === null ? null : JSON.parse(row.totalJson);
  return {
    id: row.id,
    mode: row.mode,
    status: row.status === 'submitted' && total ? 'scored' : row.status,
    packageId: row.packageId,
    packageVersion: row.packageVersion,
    configId: row.examConfigId,
    startedAt: row.startedAt,
    submittedAt: row.submittedAt,
    totalEarned: total?.earned ?? null,
    totalPossible: total?.possible ?? null,
  };
}

/**
 * The runner payload (GET /sessions/:id): frozen content and saved answers; keys and explanations excluded
 * (API_ENDPOINTS §4). `expired` is server-computed, never decided by the client (§8.1 rule 4).
 * @returns {Promise<object>}
 */
export async function loadRunner(prisma, sessionId, nowMs) {
  const session = await requireSession(prisma, sessionId);
  const snapshot = await requireSnapshot(prisma, sessionId);
  const answers = await prisma.answerSheet.findMany({ where: { sessionId } });
  const answerById = new Map(answers.map((a) => [a.questionId, a]));

  return {
    sessionId,
    configId: session.examConfigId,
    mode: session.mode,
    status: session.status,
    durationMs: session.durationMs,
    activeMs: activeNow(session, nowMs),
    runningSince: session.runningSince,
    expired: isExpired(session, session.durationMs, nowMs),
    questions: (snapshot.questions ?? []).map((q) => {
      const saved = answerById.get(q.questionId);
      return {
        questionId: q.questionId,
        test: q.test,
        competencyId: q.competencyId,
        options: q.options ?? [],
        selected: saved?.selectedOption ?? null,
        flagged: saved ? saved.flagged === 1 : false,
        elapsedActiveMs: saved?.elapsedActiveMs ?? 0,
      };
    }),
  };
}

/**
 * Autosave one answer, its flag and the clock in one write (PATCH /sessions/:id/answers, API_SPECIFICATION §7.5).
 * The write also pauses the clock (§8.1 rule 2), so an answer is never stored without its time.
 * @param {{questionId: string, selected: string | null, flagged: boolean, elapsedActiveMs: number}} input
 * @returns {Promise<{savedAt: string, activeMs: number, expired: boolean}>}
 */
export async function saveAnswer(prisma, sessionId, input, nowMs, nowIso) {
  const session = await requireSession(prisma, sessionId);
  assertOpen(session);
  if (assessWrite(session, session.durationMs, nowMs).expired) {
    throw conflict('session', 'session_expired', 'The session has reached its time limit.');
  }

  const snapshot = await requireSnapshot(prisma, sessionId);
  const question = (snapshot.questions ?? []).find((q) => q.questionId === input.questionId);
  const fields = [];
  if (!question) fields.push({ path: 'questionId', message: 'questionId must belong to this session.', rule: 'membership' });
  if (input.selected !== null && question && !question.optionKeys.includes(input.selected)) {
    fields.push({ path: 'selected', message: 'selected must be one of the question options.', rule: 'enum' });
  }
  if (fields.length > 0) throw new AppError('VALIDATION_FAILED', 'One or more fields are invalid.', { fields });

  const previous = await prisma.answerSheet.findUnique({ where: { sessionId_questionId: { sessionId, questionId: input.questionId } } });
  const activeMs = activeNow(session, nowMs);
  // `elapsedActiveMs` is the time spent on the question: this save's banked time less what was already recorded.
  const elapsedActiveMs = Math.max(0, input.elapsedActiveMs - (previous?.elapsedActiveMs ?? 0));
  const answer = {
    selectedOption: input.selected,
    answerTimestampMs: input.elapsedActiveMs,
    elapsedActiveMs,
    flagged: input.flagged ? 1 : 0,
  };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.answerSheet.upsert({
        where: { sessionId_questionId: { sessionId, questionId: input.questionId } },
        create: { sessionId, questionId: input.questionId, ...answer },
        update: answer,
      });
      const updated = await tx.session.updateMany({ where: { id: sessionId, status: 'open' }, data: { activeMs, runningSince: null } });
      if (updated.count === 0) assertOpen(session);
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    translateDbError(error, { resource: 'session', id: sessionId });
  }

  return { savedAt: nowIso, activeMs, expired: isExpired({ activeMs, runningSince: null }, session.durationMs, nowMs) };
}

/**
 * Persist the active time and clear `runningSince` (POST /sessions/:id/pause). Idempotent while open.
 * @returns {Promise<{activeMs: number, runningSince: null}>}
 */
export async function pauseSession(prisma, sessionId, nowMs) {
  const session = await requireSession(prisma, sessionId);
  assertOpen(session);
  const next = pause(session, nowMs);
  const updated = await prisma.session.updateMany({ where: { id: sessionId, status: 'open' }, data: next });
  if (updated.count === 0) assertOpen(await requireSession(prisma, sessionId));
  return next;
}

/**
 * Re-arm the clock, or report expiry (POST /sessions/:id/resume, §8.1 rules 3–4).
 * @returns {Promise<{activeMs: number, runningSince: string | null, expired: boolean}>}
 */
export async function resumeSession(prisma, sessionId, nowMs, nowIso) {
  const session = await requireSession(prisma, sessionId);
  assertOpen(session);
  const next = resume(session, session.durationMs, nowMs, nowIso);
  const data = { activeMs: next.activeMs, runningSince: next.runningSince };
  const updated = await prisma.session.updateMany({ where: { id: sessionId, status: 'open' }, data });
  if (updated.count === 0) assertOpen(await requireSession(prisma, sessionId));
  return { ...data, expired: next.expired };
}

/**
 * Pre-flight and score the frozen snapshot, then assemble the full `ScoreResult` (§2.2/§5) — `timing` and
 * `scoredAt` included, computed once here and never again. Shared by submit and `/score`; a blocking pre-flight
 * failure writes nothing (API_SPECIFICATION §7.3). PF-12/PF-13 read the live config and approval rows
 * (DATABASE_SCHEMA §1).
 * @param {{questionId: string, selected: string | null}[]} sheets
 * @param {number} nowMs server clock, for the evidence-only `timing` block
 * @param {string} nowIso server clock, ISO-8601 UTC, recorded as `scoredAt`
 * @returns {Promise<object>} the `ScoreResult`, not yet stored
 */
async function scoreOnce(prisma, session, sheets, nowMs, nowIso) {
  const snapshot = await requireSnapshot(prisma, session.id);
  const [taxonomy, liveConfig, liveThresholds, approvalRows] = await Promise.all([
    taxonomyFor(prisma),
    prisma.examConfig.findUnique({ where: { id: session.examConfigId } }),
    prisma.thresholds.findUnique({ where: { examConfigId: session.examConfigId } }),
    prisma.provisionalApproval.findMany({ where: { configId: session.examConfigId }, orderBy: { approvedByUserAt: 'desc' } }),
  ]);

  const outcome = preflight({
    snapshot,
    // PF-12 reads the config's own `BasisRef[]`, frozen into the snapshot (SCORING_METHODOLOGY §6.7). Synthesising
    // one from the live config would drop every other basis and turn a mismatch into a false pass.
    basisRefs: snapshot.basis,
    sheets,
    taxonomy,
    liveConfig: { pathway: liveConfig?.pathway, examYear: liveConfig?.examYear },
    thresholdsForDiff: { approved: snapshot.thresholds, current: toThresholdSet(liveThresholds) },
  });
  if (!outcome.ok) throw blockingError(outcome);

  const result = scoreSession({ session: { id: session.id }, snapshot, sheets: outcome.sheets });

  // PF-13 was decided inside pre-flight from the frozen approval; a re-score sees the current approval instead
  // (SCORING_METHODOLOGY §11 "lapsed but config unchanged").
  const approval = currentApproval({ configId: snapshot.configId, configVersion: snapshot.configVersion }, approvalRows)
    ?? snapshot.provisionalApproval;
  const decision = evaluateApproval({
    thresholds: { mode: snapshot.thresholdMode },
    approval,
    frozen: { configId: snapshot.configId, configVersion: snapshot.configVersion, scoringVersion: snapshot.scoringVersion, regulatoryBasisHash: snapshot.regulatoryBasisHash },
    live: { configId: liveConfig?.id, configVersion: liveConfig?.configVersion, scoringVersion: liveConfig?.scoringVersion, regulatoryBasisHash: liveConfig?.regulatoryBasisHash },
    thresholdsForDiff: { approved: snapshot.thresholds, current: toThresholdSet(liveThresholds) },
  });

  // §5.6: the score is always stored; `approval` is present iff a verdict was authorized; the threshold evaluation
  // travels as `verdict`, distinct from the score, so `verdict: null` ⟺ no verdict possible.
  const stored = {
    ...result,
    approval: decision.approval,
    verdict: decision.verdictAllowed ? result.thresholds : null,
    withheld: decision.withheld,
    // §5 `timing` and `packageBinding`: evidence only, never a scoring input.
    timing: { activeMs: activeNow(session, nowMs), durationMs: session.durationMs },
    packageBinding: snapshot.packageBinding,
    // AUD-88: stored with the row, so no read path has to reconstruct the payload's shape.
    scoredAt: nowIso,
  };
  return stored;
}

/**
 * Score the frozen snapshot and store the result (write-once). A blocking pre-flight failure throws and writes
 * nothing.
 * @returns {Promise<object>} the `ScoreResult` as computed
 */
async function scoreAndStore(prisma, session, sheets, nowMs, nowIso) {
  const result = await scoreOnce(prisma, session, sheets, nowMs, nowIso);
  await writeScoreResult(prisma, { sessionId: session.id, result });
  return result;
}

/** The score fields of a result, as canonical JSON: equal strings ⟺ equal scoring (API_SPECIFICATION §7.3). */
export function scoreFingerprint(result) {
  const { total, byTest, byCompetency, byQuestion, thresholds, snapshotVersion } = result;
  return JSON.stringify({ snapshotVersion, total, byTest, byCompetency, byQuestion, thresholds });
}

/**
 * The ranked blocking error of a failed pre-flight (SCORING_METHODOLOGY §11.1): regulatory scope (1) →
 * `THRESHOLD_CONFIG_INVALID` (2) → `PREFLIGHT_FAILED` (3). Every failure is listed whatever code wins.
 * @returns {AppError}
 */
export function blockingError({ errors }) {
  const codes = errors.map((e) => e.code);
  const regulatory = codes.filter((code) => code.startsWith('REGULATORY_'));
  if (regulatory.length > 0) {
    return new AppError(regulatory[0], 'The regulatory scope of this configuration does not match its frozen snapshot.', {
      errors,
      changed: regulatory.map((code) => ({ field: 'regulatoryBasis', approved: null, current: code })),
    });
  }
  if (codes.some((code) => THRESHOLD_BLOCK_CODES.includes(code))) {
    return new AppError('THRESHOLD_CONFIG_INVALID', 'The threshold configuration of this session is not usable.', {
      errors,
      changed: errors.filter((e) => THRESHOLD_BLOCK_CODES.includes(e.code)).map((e) => ({ field: 'thresholds', approved: null, current: e.code })),
      thresholds: null,
    });
  }
  return new AppError('PREFLIGHT_FAILED', 'This session cannot be scored; nothing was recorded.', { errors });
}

/**
 * Submit: score the stored answers, then freeze the session (`open → submitted`).
 * @param {{questionId: string, selected: string | null}[]} [overrideSheets] `POST /sessions/:id/submit` may carry the
 *   final answer set; absent, the stored answers are scored
 * @returns {Promise<object>} the stored `ScoreResult`
 */
export async function submitSession(prisma, sessionId, overrideSheets, nowMs, nowIso) {
  const session = await requireSession(prisma, sessionId);
  assertSubmittable(session);

  const sheets = overrideSheets ?? completeSheets(await requireSnapshot(prisma, sessionId), await storedSheets(prisma, sessionId));
  const stored = await scoreAndStore(prisma, session, sheets, nowMs, nowIso);

  try {
    const updated = await prisma.session.updateMany({
      where: { id: sessionId, status: 'open' },
      data: { status: 'submitted', submittedAt: nowIso, activeMs: activeNow(session, nowMs), runningSince: null },
    });
    if (updated.count === 0) assertSubmittable(await requireSession(prisma, sessionId));
  } catch (error) {
    if (error instanceof AppError) throw error;
    translateDbError(error, { resource: 'session', id: sessionId });
  }
  return pickResult(stored, stored.verdict);
}

/**
 * Re-score a submitted session (POST /sessions/:id/score, API_SPECIFICATION §7.3). A stored result with a verdict is
 * returned unchanged (idempotency row). A stored result whose `verdict` is `null` is re-scored on its frozen
 * snapshot to add a verdict only: every score field must come out identical, else `409 verdict_only_change_forbidden`
 * (SCORING_METHODOLOGY §7). A session without a result is scored and stored — the path after a pre-flight abort.
 * @returns {Promise<object>}
 */
export async function rescoreSession(prisma, sessionId, nowMs, nowIso) {
  const session = await requireSession(prisma, sessionId);
  if (session.status !== 'submitted') {
    throw conflict('session', session.status === 'open' ? 'not_submitted' : 'not_resubmittable', 'Only a submitted session can be scored.');
  }
  const stored = await loadScoreResult(prisma, sessionId);
  // A blank is stored as a missing row, so both paths complete the sheet set the same way submit does (PF-01).
  const sheets = completeSheets(await requireSnapshot(prisma, sessionId), await storedSheets(prisma, sessionId));
  if (stored === null) {
    const scored = await scoreAndStore(prisma, session, sheets, nowMs, nowIso);
    const row = await loadScoreResult(prisma, sessionId);
    // A concurrent submit may have written first; the stored row wins.
    return row ? pickResult(row.result, row.verdict) : pickResult(scored, scored.verdict);
  }
  if (stored.verdict !== null) return pickResult(stored.result, stored.verdict);

  const fresh = await scoreOnce(prisma, session, sheets, nowMs, nowIso);
  if (scoreFingerprint(fresh) !== scoreFingerprint(stored.result)) {
    throw conflict('session', 'verdict_only_change_forbidden', 'A stored result may only gain its verdict; its score cannot change.');
  }
  // A verdict-only condition (`withheld` other than null) is reported, not written: there is no verdict to add.
  if (fresh.verdict !== null) await addStoredVerdict(prisma, { sessionId, verdict: fresh.verdict, approval: fresh.approval, withheld: fresh.withheld });
  const row = await loadScoreResult(prisma, sessionId);
  return pickResult(row.result, row.verdict);
}

/** The stored answers of a session as pre-flight/scoring sheets. */
async function storedSheets(prisma, sessionId) {
  return (await prisma.answerSheet.findMany({ where: { sessionId } })).map(toSheet);
}

/**
 * Every roster question exactly once (PF-01, SCORING_METHODOLOGY §6). A question the user left untouched has no
 * `answer_sheet` row at all, so submitting without an explicit answer set fills in `selected: null` — a blank that
 * never earns credit (invariant 11) — instead of failing `SHEET_COUNT_MISMATCH`. Duplicate rows are passed through
 * untouched so PF-02 still reports them; this only adds missing ids.
 * @param {object} snapshot normalised snapshot
 * @param {{questionId: string, selected: string | null}[]} stored
 * @returns {{questionId: string, selected: string | null}[]}
 */
function completeSheets(snapshot, stored) {
  const present = new Set(stored.map((sheet) => sheet.questionId));
  const missing = (snapshot.questions ?? [])
    .filter((question) => !present.has(question.questionId))
    .map((question) => ({ questionId: question.questionId, selected: null }));
  return [...stored, ...missing];
}

/**
 * The `ScoreResult` wire shape (API_SPECIFICATION §5): the stored row's fields verbatim plus `verdict` — the stored
 * threshold evaluation, else `null`. `withheld` is part of the stored payload; nothing is projected here.
 * @param {object} result `loadScoreResult().result`
 * @param {object | null} verdict the stored `verdictJson`, decoded
 * @returns {object}
 */
function pickResult(result, verdict) {
  return { ...result, verdict };
}

/**
 * An `answer_sheet` row as the pre-flight/scoring `AnswerSheet` (SCORING_METHODOLOGY §2.2).
 * @param {object} row
 * @returns {{questionId: string, selected: string | null}}
 */
export function toSheet(row) {
  return { questionId: row.questionId, selected: row.selectedOption };
}

/**
 * `GET /sessions/:id/result`: the stored `ScoreResult`, never recomputed (DATABASE_SCHEMA §2).
 * @returns {Promise<object>}
 */
export async function loadResult(prisma, sessionId) {
  await requireSession(prisma, sessionId);
  const stored = await loadScoreResult(prisma, sessionId);
  if (!stored) throw conflict('session', 'not_scored', 'This session has no stored result yet. Submit it or call /score.');
  return pickResult(stored.result, stored.verdict);
}

/**
 * `GET /sessions/:id/questions?ids=` (API_SPECIFICATION §7.7), assembled by the pinned `session-questions` module.
 * @returns {Promise<object>}
 */
export async function loadReview(prisma, sessionId, rawIds) {
  const session = await requireSession(prisma, sessionId);
  const snapshot = await requireSnapshot(prisma, sessionId);
  const ids = parseReviewIds(rawIds, JSON.parse(session.rosterJson));
  assertReviewable(session);

  const stored = await loadScoreResult(prisma, sessionId);
  if (!stored) throw conflict('session', 'not_scored', 'This session has no stored result yet.');
  const scoredById = new Map(stored.result.byQuestion.map((row) => [row.questionId, row]));
  const frozenById = new Map((snapshot.questions ?? []).map((q) => [q.questionId, q]));
  const keyById = new Map((snapshot.answerKeys ?? []).map((k) => [k.questionId, k]));
  const latest = await prisma.question.findMany({ where: { id: { in: ids } } });
  const latestById = new Map(latest.map((q) => [q.id, q]));

  return buildReviewResponse(sessionId, ids, (id) => ({
    frozen: frozenById.get(id),
    frozenKey: keyById.get(id),
    scored: scoredById.get(id),
    latest: latestById.get(id) ?? null,
  }));
}

/**
 * `GET /sessions/:id/deletion-impact` (API_ENDPOINTS §5, ANALYTICS_ENGINE §7.6): the consequences shown before the
 * confirm step, in plain language.
 * @returns {Promise<{derivedChanges: string[], sessionsAffected: number}>}
 */
export async function deletionImpact(prisma, sessionId) {
  const session = await requireSession(prisma, sessionId);
  const stored = await loadScoreResult(prisma, sessionId);
  const derivedChanges = stored
    ? [
      'Hasil sesi ini keluar dari riwayat dan analisis, dan aplikasi tidak dapat memulihkannya.',
      'Tren, konsistensi, atau kelemahan yang memakai sesi ini berubah atau hilang.',
      'Tingkat kesulitan empiris soal yang dijawab di sini dapat kembali menjadi "belum cukup data".',
      'Sesi lain tidak terpengaruh; cadangan yang dibuat sebelumnya mungkin masih memuat data sebelum penghapusan.',
      'Catatan tanpa isi bahwa sesi ini pernah ada tetap disimpan.',
    ]
    : ['Sesi ini belum dinilai, jadi tidak memberi kontribusi analitik; hanya catatan riwayatnya yang dihapus.',
      'Catatan tanpa isi bahwa sesi ini pernah ada tetap disimpan.'];
  return { derivedChanges, sessionsAffected: 1 };
}

/**
 * Delete one session through the only permitted path, `tryoutsim.delete_session` (DATABASE_SCHEMA §2 D-1). The runtime
 * role holds no DELETE on the session family; no raw DELETE is ever issued here.
 * @returns {Promise<boolean>} false when no such session exists (mapped to `404` with nothing more)
 */
export async function deleteSession(prisma, sessionId) {
  const [row] = await prisma.$queryRaw`SELECT tryoutsim.delete_session(${sessionId}) AS "deleted"`;
  return row?.deleted === true;
}
