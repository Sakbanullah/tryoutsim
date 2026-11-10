/**
 * Request ids: opaque, per request, used only for correlating a response with a
 * log line. They carry no user, session or content information.
 */

import { randomUUID } from 'node:crypto';

/** @returns {string} a fresh opaque request id */
export function newRequestId() {
  return randomUUID();
}
