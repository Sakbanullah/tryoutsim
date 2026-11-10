/**
 * `GET /bootstrap` (API_ENDPOINTS §1): the read-only snapshot the app paints itself from.
 *
 * It carries **no exam-config list**: the learner never selects a config (PACKAGE_SPECIFICATION §3,
 * decision B3). Everything here is read through the repositories that already own the data, so the
 * route adds no second query shape.
 */

import { listPackages } from '../repositories/package.js';
import { listNotifications } from '../repositories/notification.js';
import { toProviderView } from '../domain/provider-input.js';

/** The statuses a question bank counts separately on the bank screen. */
const LIFECYCLES = Object.freeze(['draft', 'ai_validated', 'human_reviewed', 'active', 'quarantined', 'archived', 'withdrawn']);

/**
 * `{ total, active, byLifecycle }` over the whole bank (not one filtered page).
 * @param {import('pg').Pool} pool
 * @returns {Promise<{total: number, active: number, byLifecycle: Record<string, number>}>}
 */
async function questionBankSummary(pool) {
  const { rows } = await pool.query(
    `SELECT lifecycle, count(*)::int AS count FROM "question" GROUP BY lifecycle`,
  );
  /** @type {Record<string, number>} */
  const byLifecycle = Object.fromEntries(LIFECYCLES.map((state) => [state, 0]));
  let total = 0;
  for (const row of rows) {
    byLifecycle[row.lifecycle] = row.count;
    total += row.count;
  }
  return { total, active: byLifecycle.active ?? 0, byLifecycle };
}

/**
 * Register `/bootstrap`.
 * @param {ReturnType<import('../http/router.js').createRouter>} router
 * @param {{pool: import('pg').Pool, prisma: any, providerStore?: any}} deps
 */
export function registerBootstrapRoutes(router, { pool, prisma, providerStore }) {
  router.add('GET', '/bootstrap', async () => {
    const [packages, summary, notifications, providers] = await Promise.all([
      listPackages(prisma, null),
      questionBankSummary(pool),
      listNotifications(prisma, { unread: 'true', type: null, limit: null }),
      providerStore === undefined ? Promise.resolve([]) : providerStore.list(),
    ]);
    return {
      data: {
        // Every node of one taxonomy; the client groups by `test` and `parentId`.
        taxonomy: (await pool.query(
          `SELECT id, test, "parentId", label, goal, tier FROM "competency" ORDER BY id`,
        )).rows,
        packages,
        providers: providers.map((row) => toProviderView(row, row.secretRef ?? null)),
        questionBankSummary: summary,
        // Analytics is derived on read and answers as soon as any session has a stored result.
        analyticsReady: (await prisma.scoreResult.count()) > 0,
        notifications: { unreadCount: notifications.unreadCount },
        defaults: { mode: 'tryout', pageSize: 20 },
      },
    };
  });
}
