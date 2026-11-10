/**
 * Exam-config aggregate: management list, detail and approval (API_ENDPOINTS §2, API_SPECIFICATION §7.2,
 * CPNS_2026_REGULATIONS §4.1–§4.4).
 *
 * Only `pathway: 'CPNS'` rows with `dataProvenance: 'seed'` are addressable: a retained `legacy` row is evidence only
 * and is never returned by a selectable route (AGENTS.md constraint 2). Approval appends one row and changes nothing
 * on the config itself (§4.3).
 */

import { randomUUID } from 'node:crypto';
import { AppError, conflict, notFound } from '../errors.js';
import { currentApproval } from '../domain/approval.js';
import { toConfigSummary, toExamConfig } from '../domain/exam-config.js';
import { LOCAL_USER } from './session.js';

/** Newest approval first; `id` breaks ties (two rows can share a timestamp within one millisecond). */
const APPROVAL_ORDER = Object.freeze([{ approvedByUserAt: 'desc' }, { id: 'desc' }]);

/**
 * A config is addressable through these routes only when it is a CPNS seed row.
 * @param {object} config `exam_config` row
 * @returns {boolean}
 */
function isAddressable(config) {
  return config.pathway === 'CPNS' && config.dataProvenance === 'seed';
}

/**
 * The approval with the highest `approvedByUserAt` (CPNS_2026_REGULATIONS §4.3: "the newest is current").
 * @param {object[]} rows `provisional_approval` rows, newest first
 * @returns {object | null}
 */
export function newestApproval(rows) {
  return rows.length === 0 ? null : currentApproval({ configId: rows[0].configId, configVersion: rows[0].configVersion }, rows);
}

/**
 * Which of the config's carried `UNV-*` ids the §7.2 request must acknowledge. No stored column lists them (open
 * question recorded in the task report), so the set is derived from the config's own strings: `notice` and each
 * `basis_ref.title` are scanned for `UNV-…` tokens. Nothing is ever inferred beyond what those strings say.
 * @param {object} config
 * @param {object[]} basisRefs
 * @returns {string[]} distinct ids, in first-appearance order
 */
export function outstandingWarnings(config, basisRefs) {
  const text = [config.notice, ...basisRefs.map((row) => row.title)].join('\n');
  return [...new Set(text.match(/\bUNV-[A-Za-z0-9_-]*[A-Za-z0-9]\b/g) ?? [])];
}

/**
 * Every approval for a config version.
 * @param {import('../generated/prisma/client.ts').PrismaClient} prisma
 * @param {string} configId
 * @returns {Promise<object[]>}
 */
async function approvalsFor(prisma, configId) {
  return prisma.provisionalApproval.findMany({ where: { configId }, orderBy: APPROVAL_ORDER });
}

/**
 * GET /exam-configs: CPNS configs with state, versions and approval status; `legacy` rows are excluded.
 * @param {import('../generated/prisma/client.ts').PrismaClient} prisma
 * @returns {Promise<object[]>}
 */
export async function listExamConfigs(prisma) {
  const [configs, thresholdRows, approvals] = await Promise.all([
    prisma.examConfig.findMany({ where: { pathway: 'CPNS', dataProvenance: 'seed' }, orderBy: [{ configVersion: 'desc' }, { id: 'asc' }] }),
    prisma.thresholds.findMany(),
    prisma.provisionalApproval.findMany({ orderBy: APPROVAL_ORDER }),
  ]);
  const thresholdsById = new Map(thresholdRows.map((row) => [row.examConfigId, row]));
  const approvalsByConfig = new Map();
  for (const row of approvals) {
    const list = approvalsByConfig.get(row.configId) ?? [];
    list.push(row);
    approvalsByConfig.set(row.configId, list);
  }

  return configs.map((config) => {
    const approval = approvalsByConfig.has(config.id) ? currentApproval({ configId: config.id, configVersion: config.configVersion }, approvalsByConfig.get(config.id)) : null;
    return {
      ...toConfigSummary(config, thresholdsById.get(config.id) ?? null),
      examYear: config.examYear,
      dataProvenance: config.dataProvenance,
      approvedAt: approval?.approvedByUserAt ?? null,
    };
  });
}

/**
 * One config with its basis, thresholds and newest approval, or `NOT_FOUND` (a `legacy` row is not addressable).
 * @param {import('../generated/prisma/client.ts').PrismaClient} prisma
 * @param {string} configId
 * @returns {Promise<object>} `toExamConfig` plus `config` (the raw row, for internal callers)
 */
async function loadConfig(prisma, configId) {
  const config = await prisma.examConfig.findUnique({ where: { id: configId } });
  if (!config || !isAddressable(config)) throw notFound('exam_config', configId);
  const [basisRefs, thresholds, approvals] = await Promise.all([
    prisma.basisRef.findMany({ where: { examConfigId: configId }, orderBy: { id: 'asc' } }),
    prisma.thresholds.findUnique({ where: { examConfigId: configId } }),
    approvalsFor(prisma, configId),
  ]);
  return { config, basisRefs, thresholds, approval: newestApproval(approvals) };
}

/**
 * GET /exam-configs/:id (API_ENDPOINTS §2).
 * @param {import('../generated/prisma/client.ts').PrismaClient} prisma
 * @param {string} configId
 * @returns {Promise<object>}
 */
export async function getExamConfig(prisma, configId) {
  return toExamConfig(await loadConfig(prisma, configId));
}

/**
 * POST /exam-configs/:id/approval (API_SPECIFICATION §7.2). The four bound values are read server-side from the
 * config at this instant; the client supplies only `configId` and the acknowledgements.
 * @param {import('../generated/prisma/client.ts').PrismaClient} prisma
 * @param {string} configId path `:id`
 * @param {{configId?: unknown, acknowledgedWarnings?: unknown}} body already shape-checked by the route
 * @param {string} nowIso server clock
 * @returns {Promise<{approval: object, config: object}>}
 */
export async function approveConfig(prisma, configId, body, nowIso) {
  const loaded = await loadConfig(prisma, configId);
  const { config } = loaded;

  const fields = [];
  if (body.configId !== configId) fields.push({ path: 'configId', message: 'configId must equal the path id.', rule: 'matches_path' });
  const acknowledged = /** @type {string[]} */ (body.acknowledgedWarnings);
  const outstanding = outstandingWarnings(config, loaded.basisRefs);
  const missing = outstanding.filter((id) => !acknowledged.includes(id));
  if (missing.length > 0) {
    fields.push({ path: 'acknowledgedWarnings', message: `Every outstanding warning must be acknowledged: ${missing.join(', ')}.`, rule: 'acknowledge_all' });
  }
  if (fields.length > 0) throw new AppError('VALIDATION_FAILED', 'One or more fields are invalid.', { fields });

  if (config.state !== 'provisional') {
    throw conflict('exam_config', 'state_not_provisional', `Only a provisional config can be approved; this one is ${config.state}.`);
  }

  // Idempotency: an existing approval for the current four values is returned unchanged.
  const existing = currentApproval({ configId: config.id, configVersion: config.configVersion }, await approvalsFor(prisma, config.id));
  if (existing) {
    return { approval: existing, config: toConfigSummary(config, loaded.thresholds) };
  }

  const id = `apr_${randomUUID()}`;
  const approval = {
    id,
    configId: config.id,
    configVersion: config.configVersion,
    scoringVersion: config.scoringVersion,
    regulatoryBasisHash: config.regulatoryBasisHash,
    approvedByUserAt: nowIso,
    approvedBy: LOCAL_USER,
    acknowledgedWarningsJson: JSON.stringify(acknowledged),
  };
  // The table's columns only; `acknowledgedWarnings` is recomposed on read (`domain/approval.js`).
  await prisma.provisionalApproval.create({ data: approval });
  const { id: _id, acknowledgedWarningsJson: _json, ...wire } = approval;
  return { approval: { ...wire, acknowledgedWarnings: acknowledged }, config: toConfigSummary(config, loaded.thresholds) };
}
