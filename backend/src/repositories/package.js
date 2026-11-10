/**
 * Package aggregate: listing, current version, availability (API_ENDPOINTS §3, PACKAGE_SPECIFICATION §2–§4, §5).
 *
 * Reads only; selection itself lives in `session.js` because it needs the same eligibility query.
 */

import { notFound } from '../errors.js';
import { parseJson } from '../domain/exam-config.js';
import { estimateSelection } from './session.js';

/**
 * Rows of `package` joined with their highest `package_version` (the current version).
 * @param {import('../generated/prisma/client.ts').PrismaClient} prisma
 * @param {'tryout' | 'latihan' | null} mode
 * @returns {Promise<object[]>}
 */
export async function listPackages(prisma, mode) {
  if (mode) {
    return prisma.$queryRaw`
      SELECT p."id", p."mode", p."source", p."retiredAt",
             v."version" AS "currentVersion", v."definitionJson", v."titleId",
             v."examConfigId", v."examConfigVersion"
      FROM "package" p
      JOIN LATERAL (
        SELECT "version", "definitionJson", "titleId", "examConfigId", "examConfigVersion" FROM "package_version"
        WHERE "packageId" = p."id" ORDER BY "version" DESC LIMIT 1
      ) v ON true
      WHERE p."mode" = ${mode}
      ORDER BY p."mode", v."titleId"`;
  }
  return prisma.$queryRaw`
    SELECT p."id", p."mode", p."source", p."retiredAt",
           v."version" AS "currentVersion", v."definitionJson", v."titleId",
           v."examConfigId", v."examConfigVersion"
    FROM "package" p
    JOIN LATERAL (
      SELECT "version", "definitionJson", "titleId", "examConfigId", "examConfigVersion" FROM "package_version"
      WHERE "packageId" = p."id" ORDER BY "version" DESC LIMIT 1
    ) v ON true
    ORDER BY p."mode", v."titleId"`;
}

/**
 * One package with the version a new session would use: the requested version when it exists, else the current
 * one.
 * @param {import('../generated/prisma/client.ts').PrismaClient} prisma
 * @param {string} packageId
 * @param {number | null} [version]
 * @returns {Promise<{pkg: object, version: object} | null>}
 */
export async function findPackage(prisma, packageId, version = null) {
  const pkg = await prisma.package.findUnique({ where: { id: packageId } });
  if (!pkg) return null;
  let row;
  if (version !== null) {
    row = await prisma.packageVersion.findUnique({ where: { packageId_version: { packageId, version } } });
  } else {
    row = await prisma.packageVersion.findFirst({ where: { packageId }, orderBy: { version: 'desc' } });
  }
  if (!row) return null;
  return { pkg, version: row };
}

/**
 * The package view shared by the list and the detail route (FRONTEND_DATA_CONTRACTS `Package`). Selection is a live
 * preview (§4.4); the start re-runs it and freezes the result.
 * @param {import('../generated/prisma/client.ts').PrismaClient} prisma
 * @param {{pkg: object, version: object}} found
 * @returns {Promise<object>}
 */
export async function toPackageView(prisma, { pkg, version }) {
  const definition = parseJson(version.definitionJson);
  // ponytail: the list evaluates the package's own repeat policy; a tryout that policy cannot fill still starts
  // by repeating (the §4.3 warning), so only the detail route's start button can be conservative to one item.
  const policy = definition?.repeatPolicy === 'avoid_answered' ? 'avoid_answered' : 'allow_repeat';
  const selection = definition ? await estimateSelection(prisma, definition, policy) : null;
  const availability = availabilityOf({ pkg, definition, selection });

  return {
    id: pkg.id,
    mode: pkg.mode,
    source: pkg.source,
    titleId: version.titleId,
    version: version.version,
    definition,
    examConfigId: version.examConfigId ?? null,
    examConfigVersion: version.examConfigVersion ?? null,
    availability,
    retiredAt: pkg.retiredAt,
  };
}

/**
 * Stock, need, repeat count and startability (§4.3). A package is startable when the roster can be filled with at
 * least one question: zero eligible stock is the only hard stop; a shortfall under `avoid_answered` is a warning.
 * @param {{pkg: object, definition: object | null, selection: {eligibleTotal: number, selected: number, required: number, repeatCount: number} | null}} input
 * @returns {object}
 */
export function availabilityOf({ definition, selection }) {
  const required = selection?.required ?? definition?.itemCount ?? 0;
  const eligible = selection?.eligibleTotal ?? 0;
  const unavailableReason = !definition
    ? 'Definisi paket tidak dapat dibaca.'
    : required <= 0
      ? 'Paket tidak menetapkan jumlah soal.'
      : eligible === 0
        ? 'Belum ada soal layak untuk paket ini. Tambahkan soal di Bank Soal.'
        : selection.selected < required
          ? `Stok soal layak kurang ${required - selection.selected} soal.`
          : null;

  return {
    eligibleStock: eligible,
    requiredStock: required,
    repeatCount: selection?.repeatCount ?? 0,
    startable: definition !== null && required > 0 && selection.selected > 0,
    unavailableReason,
  };
}

/**
 * Load one package view or throw `NOT_FOUND`.
 * @param {import('../generated/prisma/client.ts').PrismaClient} prisma
 * @param {string} packageId
 * @param {number | null} [version]
 * @returns {Promise<object>}
 */
export async function requirePackageView(prisma, packageId, version = null) {
  const found = await findPackage(prisma, packageId, version);
  if (!found) throw notFound('package', packageId);
  return toPackageView(prisma, found);
}
