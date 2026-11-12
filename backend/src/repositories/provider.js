/**
 * Provider persistence and the DB-4 two-store ordering
 * (DATABASE_SCHEMA §2 "Provider writes span two stores"; SECRETS §2–§3).
 *
 * - Create: write the OS credential first, then the row. A failed row insert
 *   purges the credential before the error is returned — a secret without a
 *   provider is the leak class NFR-7 forbids, a provider without a secret is not.
 * - Delete: delete the row (one transaction; the DB-4 trigger refuses while a job
 *   is queued/running — `23503` → `409 CONFLICT`, mapped, never re-checked here),
 *   then purge the credential. A failed purge is logged with the entry name only.
 *   The Windows store has no prefix enumeration, so the startup retry covers the
 *   one case it can see: an entry whose provider id no longer has a row
 *   (`purgeOrphanedSecret`).
 *
 * The key itself is never passed to the database, logged, or returned: only
 * `keyLast4` and `hasKey` reach `secret_ref`.
 */

import { notFound } from '../errors.js';
import { translateDbError } from '../db/errors.js';
import { newId, nowIso } from '../db/ids.js';
import { conservativeCapabilities, mergeDetected } from '../domain/provider-models.js';
import { createProviderClient } from '../domain/provider-client.js';
import { keyLast4 } from '../secrets/secret-store.js';

/** The store kind written to `secret_ref`; the platform store's own kind is the truth. */
const SUPPORTED_STORE_KINDS = ['windows_credential_manager', 'macos_keychain', 'secret_service'];

/**
 * The deps a provider service needs.
 * @typedef {object} ProviderDeps
 * @property {any} prisma
 * @property {{kind: string, write: Function, read: Function, delete: Function}} secretStore
 * @property {string} installId
 * @property {{info: Function, error: Function}} [logger]
 * @property {import('../secrets/secret-store.js').entryName} [nameFor] overridable for tests
 */

/**
 * Build the provider service used by the routes and the generation runner.
 * @param {ProviderDeps} deps
 */
export function createProviderStore({ prisma, secretStore, installId, logger = console, nameFor }) {
  const entryFor = nameFor ?? ((/** @type {string} */ id) => `${installId}/${id}`);

  /** @param {string} providerId */
  const entryNameOf = (providerId) => entryFor(providerId);

  /**
   * Read a key for the transport, at send time. Also reconciles `hasKey`: a key
   * deleted from the OS store outside the app is reported `hasKey: false`
   * (SECRETS §2), never silently replaced.
   * @param {string} providerId
   * @returns {Promise<string | null>}
   */
  async function readKey(providerId) {
    const ref = await prisma.secretRef.findUnique({ where: { providerId } });
    if (ref === null || ref.hasKey !== 1) return null;
    const key = await secretStore.read(ref.storeEntryName);
    if (key === null && ref.hasKey === 1) {
      await prisma.secretRef.update({ where: { providerId }, data: { hasKey: 0 } });
    }
    return key;
  }

  /**
   * Create a provider in DB-4 order: secret first, row second, purge on failure.
   * @param {{preset: string, baseUrl: string, defaultModel: string, timeoutMs: number, headers: Record<string, string>, extraParams: Record<string, unknown>, key: string | null}} input
   * @returns {Promise<object>} the row, with `secretRef`
   */
  async function create(input) {
    if (!SUPPORTED_STORE_KINDS.includes(secretStore.kind)) {
      throw new Error(`Secret store kind ${secretStore.kind} is not one of the schema's store kinds.`);
    }
    const id = newId();
    const entry = entryNameOf(id);
    const hasKey = input.key !== null;

    if (hasKey) await secretStore.writeVerified(entry, /** @type {string} */ (input.key));

    try {
      return await prisma.$transaction(async (tx) => {
        const row = await tx.provider.create({
          data: {
            id,
            providerId: id,
            preset: input.preset,
            baseUrl: input.baseUrl,
            defaultModel: input.defaultModel,
            timeoutMs: input.timeoutMs,
            headersJson: JSON.stringify(input.headers),
            extraParamsJson: JSON.stringify(input.extraParams),
            capabilityFlagsJson: JSON.stringify(conservativeCapabilities()),
            testedAt: null,
            modelCacheJson: null,
          },
        });
        const secret = await tx.secretRef.create({
          data: {
            providerId: id,
            keyLast4: hasKey ? keyLast4(/** @type {string} */ (input.key)) : '',
            hasKey: hasKey ? 1 : 0,
            storeEntryName: entry,
            storeKind: secretStore.kind,
          },
        });
        return { ...row, secretRef: secret };
      });
    } catch (error) {
      if (hasKey) {
        // The row did not commit, so the credential must not survive it.
        await secretStore.delete(entry).catch((purgeError) => {
          logger.error(JSON.stringify({ level: 'error', event: 'secret_orphan', providerId: id, entry, message: purgeError.message }));
        });
      }
      translateDbError(error, { resource: 'provider', id });
    }
  }

  /**
   * Edit a provider. A key edit replaces only the credential and its tail; a
   * `null` key removes it. Editing `baseUrl`, `key` or `defaultModel` clears
   * `testedAt`, so the pair must be retested (AI_PROVIDER_ARCHITECTURE §5).
   *
   * @param {string} id
   * @param {{baseUrl?: string, defaultModel?: string, timeoutMs?: number, headers?: Record<string, string>, extraParams?: Record<string, unknown>, key?: string | null}} patch
   * @returns {Promise<object>}
   */
  async function update(id, patch) {
    const existing = await prisma.provider.findUnique({ where: { id }, include: { secretRef: true } });
    if (existing === null) throw notFound('provider', id);
    const ref = existing.secretRef;
    const resetsTest =
      (patch.baseUrl !== undefined && patch.baseUrl !== existing.baseUrl) ||
      (patch.defaultModel !== undefined && patch.defaultModel !== existing.defaultModel) ||
      // `undefined` leaves the key untouched (SECRETS §3); only a write or a removal resets the test.
      patch.key !== undefined;

    /** @type {Record<string, unknown>} */
    const data = {};
    if (patch.baseUrl !== undefined) data.baseUrl = patch.baseUrl;
    if (patch.defaultModel !== undefined) data.defaultModel = patch.defaultModel;
    if (patch.timeoutMs !== undefined) data.timeoutMs = patch.timeoutMs;
    if (patch.headers !== undefined) data.headersJson = JSON.stringify(patch.headers);
    if (patch.extraParams !== undefined) data.extraParamsJson = JSON.stringify(patch.extraParams);
    if (resetsTest) data.testedAt = null;

    if (patch.key === undefined) {
      return prisma.provider.update({ where: { id }, data, include: { secretRef: true } });
    }

    const entry = ref?.storeEntryName ?? entryNameOf(id);
    const previousKey = ref?.hasKey === 1 ? await secretStore.read(entry) : null;
    if (patch.key !== null) await secretStore.writeVerified(entry, patch.key);

    try {
      return await prisma.$transaction(async (tx) => {
        const row = await tx.provider.update({ where: { id }, data });
        const secret = await tx.secretRef.upsert({
          where: { providerId: id },
          create: {
            providerId: id,
            keyLast4: patch.key === null ? '' : keyLast4(/** @type {string} */ (patch.key)),
            hasKey: patch.key === null ? 0 : 1,
            storeEntryName: entry,
            storeKind: secretStore.kind,
          },
          update: {
            keyLast4: patch.key === null ? '' : keyLast4(/** @type {string} */ (patch.key)),
            hasKey: patch.key === null ? 0 : 1,
            storeEntryName: entry,
            // A key written after a macOS/Linux store change follows the live store.
            storeKind: secretStore.kind,
          },
        });
        return { ...row, secretRef: secret };
      });
    } catch (error) {
      // Restore the previous credential: the transaction did not commit, so the
      // stored tail still names the old key (DB-4 order, mirrored).
      if (previousKey !== null) await secretStore.write(entry, previousKey).catch(() => undefined);
      else if (patch.key !== null) await secretStore.delete(entry).catch(() => undefined);
      translateDbError(error, { resource: 'provider', id });
    }
  }

  /**
   * Delete a provider: row first (one transaction), credential second.
   * @param {string} id
   * @returns {Promise<void>}
   */
  async function remove(id) {
    const existing = await prisma.provider.findUnique({ where: { id }, include: { secretRef: true } });
    if (existing === null) throw notFound('provider', id);
    const entry = existing.secretRef?.storeEntryName ?? entryNameOf(id);

    try {
      await prisma.$transaction(async (tx) => {
        // The DB-4 trigger deletes finished jobs (and their batches) itself and
        // raises 23503 while a job is queued/running. Nothing is re-checked here.
        await tx.provider.delete({ where: { id } });
      });
    } catch (error) {
      translateDbError(error, { resource: 'provider', id });
    }

    try {
      await secretStore.delete(entry);
    } catch (purgeError) {
      // The row is gone; the credential is unreachable and is retried at startup.
      logger.error(JSON.stringify({
        level: 'error', event: 'secret_orphan', providerId: id, entry,
        message: purgeError instanceof Error ? purgeError.message : String(purgeError),
      }));
    }
  }

  /**
   * Startup retry for an orphaned credential. Called for a provider id whose row
   * is known to be gone; the entry name is derived by convention because the
   * `secret_ref` row went with the provider.
   * @param {string} providerId
   * @returns {Promise<boolean>} whether an entry was deleted
   */
  async function purgeOrphanedSecret(providerId) {
    return secretStore.delete(entryNameOf(providerId));
  }

  /**
   * Record a passing test: `testedAt` for the pair, and detected capabilities
   * merged without overwriting a manual correction (AI_PROVIDER_ARCHITECTURE §6).
   * @param {string} id
   * @param {{detected: {jsonMode: boolean | null}}} result
   */
  async function recordTest(id, result) {
    const existing = await prisma.provider.findUnique({ where: { id } });
    if (existing === null) throw notFound('provider', id);
    const stored = JSON.parse(existing.capabilityFlagsJson);
    // A field the probe could not establish (`null`) keeps its stored value; a
    // manual correction is never overwritten (mergeDetected).
    const detected = {
      jsonMode: result.detected.jsonMode ?? stored.jsonMode?.value ?? false,
      streaming: stored.streaming?.value ?? false,
      maxContext: stored.maxContext?.value ?? null,
    };
    const merged = mergeDetected(stored, detected);
    return prisma.provider.update({
      where: { id },
      data: { testedAt: nowIso(), capabilityFlagsJson: JSON.stringify(merged) },
      include: { secretRef: true },
    });
  }

  /**
   * Store the last `listModels()` result. Display only: it never decides whether
   * a typed model is allowed (AI_PROVIDER_ARCHITECTURE §5).
   * @param {string} id
   * @param {string[]} models
   */
  async function cacheModels(id, models) {
    return prisma.provider.update({ where: { id }, data: { modelCacheJson: JSON.stringify(models) } });
  }

  /**
   * Replace the manually corrected capability fields (§6). Fields absent from
   * `patch` keep their stored value.
   * @param {string} id
   * @param {object} patch from `parseCapabilities`
   */
  async function setCapabilities(id, patch) {
    const existing = await prisma.provider.findUnique({ where: { id } });
    if (existing === null) throw notFound('provider', id);
    const stored = JSON.parse(existing.capabilityFlagsJson);
    return prisma.provider.update({
      where: { id },
      data: { capabilityFlagsJson: JSON.stringify({ ...stored, ...patch }) },
      include: { secretRef: true },
    });
  }

  /**
   * Read one provider with its secret reference.
   * @param {string} id
   */
  async function get(id) {
    return prisma.provider.findUnique({ where: { id }, include: { secretRef: true } });
  }

  /**
   * List providers with secret references, stable order.
   * @returns {Promise<object[]>}
   */
  async function list() {
    return prisma.provider.findMany({ include: { secretRef: true }, orderBy: { id: 'asc' } });
  }

  return { create, update, remove, get, list, readKey, recordTest, cacheModels, setCapabilities, purgeOrphanedSecret };
}

/**
 * Build the transport for a stored provider row (PROVIDER_INTEGRATION §1–§3).
 * The key is read at send time; it is never part of the returned object.
 *
 * @param {object} options
 * @param {object} options.row a `provider` row
 * @param {(providerId: string) => Promise<string | null>} options.readKey
 * @param {typeof fetch} [options.fetchImpl]
 */
export async function transportFor({ row, readKey, fetchImpl }) {
  let flags = {};
  try {
    flags = JSON.parse(row.capabilityFlagsJson);
  } catch {
    flags = {};
  }
  return createProviderClient({
    providerId: row.id,
    baseUrl: row.baseUrl,
    headers: JSON.parse(row.headersJson),
    timeoutMs: row.timeoutMs,
    retries: 1,
    extraParams: JSON.parse(row.extraParamsJson),
    capabilitiesFor: () => flags,
    getKey: () => readKey(row.id),
    fetchImpl,
  });
}
