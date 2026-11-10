/**
 * `/notifications` (API_ENDPOINTS §9; NOTIFICATION_SPECIFICATION §6).
 */

import { validationError } from '../errors.js';
import { asObject } from '../http/validation.js';
import { listNotifications, markAllRead, markNotification } from '../repositories/notification.js';

/**
 * Register the notification routes.
 * @param {ReturnType<import('../http/router.js').createRouter>} router
 * @param {{prisma: any}} deps
 */
export function registerNotificationRoutes(router, { prisma }) {
  /** List, newest first, with filters (200). */
  router.add('GET', '/notifications', async ({ query }) => {
    const { items, unreadCount } = await listNotifications(prisma, {
      unread: query.get('unread'),
      type: query.get('type'),
      limit: query.get('limit'),
    });
    return { data: { items, unreadCount } };
  });

  /** Mark read / dismissed (200, 400, 404). */
  router.add('PATCH', '/notifications/:id', async ({ params, body }) => {
    const input = asObject(body);
    const fields = [];
    for (const [key, value] of Object.entries(input)) {
      if (key !== 'read' && key !== 'dismissed') fields.push({ path: key, message: `${key} cannot be set.`, rule: 'unknown_field' });
      else if (typeof value !== 'boolean') fields.push({ path: key, message: `${key} must be a boolean.`, rule: 'type' });
    }
    if (fields.length === 0 && Object.keys(input).length === 0) {
      fields.push({ path: '', message: 'read or dismissed is required.', rule: 'required' });
    }
    if (fields.length > 0) throw validationError(fields);
    return { data: await markNotification(prisma, params.id, { read: input.read, dismissed: input.dismissed }) };
  });

  /** Mark every unread as read (200). */
  router.add('POST', '/notifications/read-all', async () => ({ data: await markAllRead(prisma) }));
}
