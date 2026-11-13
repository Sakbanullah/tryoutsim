/**
 * `/providers` and `/ai-routing` (API_ENDPOINTS §8; AI_PROVIDER_ARCHITECTURE
 * §3–§6; SECRETS §1–§3).
 *
 * Every response is built by `toProviderView`, which names its fields one by
 * one: the key is not among them, in any status — only `keyLast4` and `hasKey`
 * (SECRETS §1). The key read from a request body goes only into the OS-store
 * write; its last-4 tail is all `secret_ref` ever sees.
 */

import { AppError, notFound, validationError } from '../errors.js';
import { FieldErrors, asObject } from '../http/validation.js';
import { parseCapabilities } from '../domain/provider-models.js';
import { parseCreateProvider, parseUpdateProvider, toProviderView } from '../domain/provider-input.js';
import { parseRoutingBody, toWireRouting } from '../domain/routing.js';
import { loadRouting, saveRouting } from '../repositories/routing.js';
import { transportFor } from '../repositories/provider.js';

/**
 * Register the provider and routing routes.
 *
 * @param {ReturnType<import('../http/router.js').createRouter>} router
 * @param {{prisma: any, providerStore: any, fetchImpl?: typeof fetch}} deps
 */
export function registerProviderRoutes(router, { prisma, providerStore, fetchImpl }) {
  const view = (row) => toProviderView(row, row.secretRef ?? null);
  const load = () => loadRouting(prisma);

  /**
   * Read a provider or throw `NOT_FOUND`.
   * @param {string} id
   */
  async function requireProvider(id) {
    const row = await providerStore.get(id);
    if (row === null) throw notFound('provider', id);
    return row;
  }

  /**
   * Run a provider call, mapping its registered failure to the envelope
   * (ERROR_HANDLING §3).
   * @param {string} providerId
   * @param {() => Promise<any>} call
   */
  async function guarded(providerId, call) {
    try {
      return await call();
    } catch (error) {
      const code = /** @type {{code?: string, message?: string, details?: Record<string, any>}} */ (error)?.code;
      const message = /** @type {{message?: string}} */ (error)?.message ?? 'The provider call failed.';
      const details = /** @type {{details?: Record<string, any>}} */ (error)?.details ?? {};
      if (code === 'PROVIDER_AUTH_FAILED') throw new AppError('PROVIDER_AUTH_FAILED', message, { providerId });
      if (code === 'RATE_LIMITED') throw new AppError('RATE_LIMITED', message, { providerId, retryAfterMs: details.retryAfterMs ?? null });
      if (code === 'PROVIDER_TIMEOUT') throw new AppError('PROVIDER_TIMEOUT', message, { providerId, timeoutMs: details.timeoutMs });
      if (code === 'PROVIDER_UNAVAILABLE') {
        throw new AppError('PROVIDER_UNAVAILABLE', message, { providerId, reason: details.reason ?? 'provider_error' });
      }
      throw error;
    }
  }

  /** List providers, keys as masked tails only (200). */
  router.add('GET', '/providers', async () => {
    const rows = await providerStore.list();
    return { data: rows.map(view) };
  });

  /** Create a provider; DB-4 order, key write-only (201, 400, 409). */
  router.add('POST', '/providers', async ({ body }) => {
    const input = parseCreateProvider(asObject(body));
    let created;
    try {
      created = await providerStore.create(input);
    } finally {
      // The key was placed in a local; it is not part of any error or log.
      input.key = null;
    }
    return { status: 201, data: view(created) };
  });

  /** Edit a provider; the key is left untouched unless a new one is submitted (200, 400, 404). */
  router.add('PATCH', '/providers/:id', async ({ params, body }) => {
    const patch = parseUpdateProvider(asObject(body));
    let updated;
    try {
      updated = await providerStore.update(params.id, patch);
    } finally {
      if ('key' in patch) patch.key = null;
    }
    return { data: view(updated) };
  });

  /** Remove a provider: row first, then credential; 409 while a job is active (204, 404, 409). */
  router.add('DELETE', '/providers/:id', async ({ params }) => {
    await providerStore.remove(params.id);
    return { status: 204, data: null };
  });

  /** Connection test + capability probe; a failed test is a 200 result (PROVIDER_INTEGRATION §5). */
  router.add('POST', '/providers/:id/test', async ({ params, body }) => {
    const row = await requireProvider(params.id);
    const supplied = body === undefined ? {} : asObject(body);
    // A body id wins; else the row's default model; else the first model the endpoint last listed.
    // Without one of those there is nothing to send the one-token chat to.
    const cached = typeof row.modelCacheJson === 'string' ? JSON.parse(row.modelCacheJson) : null;
    const listed = Array.isArray(cached) ? cached.find((id) => typeof id === 'string' && id.length > 0) : undefined;
    const modelId = typeof supplied.modelId === 'string' && supplied.modelId.length > 0
      ? supplied.modelId
      : (row.defaultModel || listed);
    if (typeof modelId !== 'string' || modelId.length === 0) {
      throw validationError([{
        path: 'modelId',
        message: 'A model id is required to test this provider. Muat daftar model, lalu pilih satu sebagai model default.',
        rule: 'required',
      }]);
    }
    const transport = await transportFor({ row, readKey: providerStore.readKey, fetchImpl });
    const result = await guarded(params.id, () => transport.test(modelId));
    if (!result.ok) return { data: { ok: false, latencyMs: result.latencyMs, reason: result.reason, code: result.code } };
    await providerStore.recordTest(params.id, result);
    return { data: { ok: true, latencyMs: result.latencyMs, detected: result.detected } };
  });

  /** Refresh the model list; display data only, never an allow-list (§5). */
  router.add('POST', '/providers/:id/models', async ({ params }) => {
    const row = await requireProvider(params.id);
    const transport = await transportFor({ row, readKey: providerStore.readKey, fetchImpl });
    const models = await guarded(params.id, () => transport.listModels());
    await providerStore.cacheModels(params.id, models);
    return { data: models };
  });

  /** Manual capability correction; sets `source: 'manual'` (200, 400, 404). */
  router.add('PUT', '/providers/:id/capabilities', async ({ params, body }) => {
    const errors = new FieldErrors();
    const patch = parseCapabilities(asObject(body), errors);
    errors.throwIfAny();
    return { data: view(await providerStore.setCapabilities(params.id, patch)) };
  });

  /** The one global model, `null` when none is set (200). */
  router.add('GET', '/ai-routing', async () => ({ data: toWireRouting(await load()) }));

  /**
   * Set the global model. There are no per-task routes: any field other than
   * `default` is refused; a body without `default` leaves it untouched
   * (200, 400).
   */
  router.add('PUT', '/ai-routing', async ({ body }) => {
    const raw = asObject(body);
    const input = parseRoutingBody(raw);
    const existing = await load();

    /** @type {import('../domain/routing.js').Routing} */
    const merged = { default: 'default' in raw ? input.default : existing.default };

    if (merged.default !== null) {
      const provider = await prisma.provider.findUnique({ where: { id: merged.default.providerId } });
      if (provider === null) {
        throw validationError([{ path: 'default.providerId', message: 'Provider does not exist.', rule: 'exists' }]);
      }
    }

    await saveRouting(prisma, merged);
    return { data: toWireRouting(await load()) };
  });
}
