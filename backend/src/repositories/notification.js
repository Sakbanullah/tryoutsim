/**
 * Notification persistence (NOTIFICATION_SPECIFICATION §2–§5).
 *
 * Writers: `raise` is idempotent per `(type, entityId)` — the table's unique key
 * — so a repeated producer run never duplicates (§4 rule 2). A re-raised event
 * updates `params` and clears `readAt`. A terminal job outcome is written in the
 * same transaction as the job's terminal state (§5) by passing `tx` from the
 * generation runner; the API's read/mark routes use the client directly.
 */

import { notFound } from '../errors.js';
import { newId, nowIso } from '../db/ids.js';

/** `type` → severity, title key, client route (NOTIFICATION_SPECIFICATION §2, FRONTEND_ROUTING). */
export const EVENT_TYPES = Object.freeze({
  generation_completed: { severity: 'info', titleKey: 'notif.generation_completed', route: '/lainnya/generasi/:id' },
  generation_failed: { severity: 'error', titleKey: 'notif.generation_failed', route: '/lainnya/generasi/:id' },
  generation_interrupted: { severity: 'warning', titleKey: 'notif.generation_interrupted', route: '/lainnya/generasi/:id' },
  batch_awaiting_sampling: { severity: 'action', titleKey: 'notif.batch_awaiting_sampling', route: '/lainnya/review' },
});

/** Filters accepted by `GET /notifications` (API_ENDPOINTS §9). */
const NOTIFICATION_TYPES = Object.freeze([
  'generation_completed',
  'generation_failed',
  'generation_interrupted',
  'batch_awaiting_sampling',
  'validation_completed',
  'backup_succeeded',
  'backup_failed',
  'restore_completed',
  'question_reported',
  'question_quarantined',
]);

/** Default page size; `limit` is capped so one poll cannot pull the whole table. */
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * Raise (or refresh) one notification. Inside a caller's transaction when `tx`
 * is given, so the notification and the state it reports commit together.
 *
 * @param {object} options
 * @param {any} options.database a Prisma client or transaction
 * @param {string} options.type
 * @param {string} options.entityId
 * @param {Record<string, string|number>} options.params values only — never a key, never a score
 * @param {string} [options.route] client route; `:id` is replaced by `entityId`
 * @returns {Promise<object>} the stored row
 */
export async function raise({ database, type, entityId, params, route }) {
  const meta = /** @type {Record<string, {severity: string, titleKey: string, route: string}>} */ (EVENT_TYPES)[type];
  if (meta === undefined) throw new Error(`Unknown notification type ${type}.`);
  if (Object.values(params).some((value) => typeof value !== 'string' && typeof value !== 'number')) {
    throw new Error('Notification params must be strings or numbers.');
  }
  const link = { route: (route ?? meta.route).replace(':id', entityId), entityId };
  const where = { type_entityId: { type, entityId } };
  return database.notification.upsert({
    where,
    create: {
      id: newId(),
      type,
      severity: meta.severity,
      titleKey: meta.titleKey,
      paramsJson: JSON.stringify(params),
      linkJson: JSON.stringify(link),
      entityId,
      createdAt: nowIso(),
      readAt: null,
      dismissedAt: null,
    },
    update: { paramsJson: JSON.stringify(params), linkJson: JSON.stringify(link), readAt: null, dismissedAt: null },
  });
}

/**
 * Decode a stored row to the §3 `Notification` wire shape.
 * @param {{id: string, type: string, severity: string, titleKey: string, paramsJson: string, linkJson: string | null, createdAt: string, readAt: string | null, dismissedAt: string | null}} row
 */
export function toNotificationView(row) {
  return {
    id: row.id,
    type: row.type,
    severity: row.severity,
    titleKey: row.titleKey,
    params: JSON.parse(row.paramsJson),
    link: row.linkJson === null ? undefined : JSON.parse(row.linkJson),
    createdAt: row.createdAt,
    readAt: row.readAt,
    dismissedAt: row.dismissedAt,
  };
}

/**
 * `GET /notifications`: newest first, filterable by `unread`, `type`, `limit`.
 *
 * @param {any} prisma
 * @param {{unread?: string | null, type?: string | null, limit?: string | null}} query
 * @returns {Promise<{items: object[], unreadCount: number}>}
 */
export async function listNotifications(prisma, { unread, type, limit }) {
  const where = {
    ...(unread === 'true' ? { readAt: null } : {}),
    ...(type ? { type: NOTIFICATION_TYPES.includes(type) ? type : '__unknown__' } : {}),
  };
  const take = limit === null || limit === undefined ? DEFAULT_LIMIT : Math.min(Math.max(Number.parseInt(limit, 10) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const [rows, unreadCount] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, take }),
    prisma.notification.count({ where: { readAt: null } }),
  ]);
  return { items: rows.map(toNotificationView), unreadCount };
}

/**
 * `PATCH /notifications/:id`: mark read/unread, dismissed/undismissed.
 *
 * @param {any} prisma
 * @param {string} id
 * @param {{read?: boolean, dismissed?: boolean}} body
 * @returns {Promise<object>}
 */
export async function markNotification(prisma, id, body) {
  const data = {};
  if (body.read !== undefined) data.readAt = body.read ? nowIso() : null;
  if (body.dismissed !== undefined) data.dismissedAt = body.dismissed ? nowIso() : null;
  try {
    return toNotificationView(await prisma.notification.update({ where: { id }, data }));
  } catch (error) {
    if (/** @type {{code?: string}} */ (error)?.code === 'P2025') throw notFound('notification', id);
    throw error;
  }
}

/**
 * `POST /notifications/read-all`: return the rows marked, so the client can
 * replace its list without a second read.
 *
 * @param {any} prisma
 * @returns {Promise<object[]>}
 */
export async function markAllRead(prisma) {
  const now = nowIso();
  const rows = await prisma.notification.findMany({ where: { readAt: null } });
  await prisma.notification.updateMany({ where: { readAt: null }, data: { readAt: now } });
  return rows.map((row) => toNotificationView({ ...row, readAt: now }));
}
