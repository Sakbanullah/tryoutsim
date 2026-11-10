/**
 * The `node:http` server: reads the body, dispatches through the router, and
 * writes exactly one envelope per response.
 *
 * Rules held here so no handler has to remember them:
 * - the base path is `/api/v1` and the process binds loopback only (SECURITY §2);
 * - a JSON body is parsed once, with a size cap, and a malformed body is a
 *   `VALIDATION_FAILED`, never a crash;
 * - an unexpected exception becomes a `500` with a request id and no internal
 *   detail — the stack goes to the log, never to the client (ERROR_HANDLING §2).
 */

import { createServer } from 'node:http';
import { AppError, UnhandledError } from '../errors.js';
import { failure, success } from './envelope.js';
import { newRequestId } from './request-id.js';

/** Largest accepted request body. Session saves are small; uploads are not an API here. */
const MAX_BODY_BYTES = 1024 * 1024;

/**
 * Read and parse a JSON request body.
 * @param {import('node:http').IncomingMessage} req
 * @returns {Promise<unknown>} parsed body, or `undefined` when empty
 */
function readJson(req) {
  return new Promise((resolve, reject) => {
    /** @type {Buffer[]} */
    const chunks = [];
    let size = 0;

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new AppError('VALIDATION_FAILED', 'Request body is too large.', {
          fields: [{ path: '', message: 'Body exceeds 1 MiB.', rule: 'max_bytes' }],
        }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8');
      if (text.length === 0) {
        resolve(undefined);
        return;
      }
      try {
        resolve(JSON.parse(text));
      } catch {
        reject(new AppError('VALIDATION_FAILED', 'Request body is not valid JSON.', {
          fields: [{ path: '', message: 'Body must be valid JSON.', rule: 'json' }],
        }));
      }
    });

    req.on('error', reject);
  });
}

/**
 * Write one response.
 * @param {import('node:http').ServerResponse} res
 * @param {number} status
 * @param {unknown} body
 */
function send(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(text),
    'cache-control': 'no-store',
        });
  res.end(text);
}

/**
 * Build the HTTP server.
 *
 * @param {{router: ReturnType<import('./router.js').createRouter>, logger?: {info: Function, error: Function}}} options
 * @returns {import('node:http').Server}
 */
export function createHttpServer({ router, logger = console }) {
  return createServer(async (req, res) => {
    const requestId = newRequestId();
    const startedAt = Date.now();

    try {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      if (!url.pathname.startsWith('/api/v1/')) {
        throw new AppError('NOT_FOUND', 'No such route.', { resource: 'route', id: url.pathname });
      }

      const match = router.match(req.method ?? 'GET', url.pathname.slice('/api/v1'.length));
      if (match === null) {
        throw new AppError('NOT_FOUND', 'No such route.', { resource: 'route', id: url.pathname });
      }
      if ('allowed' in match) {
        res.setHeader('allow', match.allowed.join(', '));
        throw new AppError('CONFLICT', 'Method not allowed for this route.', {
          resource: 'route',
          reason: 'method_not_allowed',
        });
      }

      const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await readJson(req);
      const { status = 200, data } = await match.handler({ params: match.params, body, query: url.searchParams });
      if (status === 204) {
        res.writeHead(204, { 'cache-control': 'no-store' });
        res.end();
      } else {
        send(res, status, success(data));
      }
    } catch (error) {
      if (error instanceof AppError) {
        send(res, error.status, failure(error, requestId));
      } else {
        logger.error(JSON.stringify({
          level: 'error', event: 'unhandled', requestId, message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        }));
        const unhandled = new UnhandledError(requestId, error);
        send(res, unhandled.status, failure(unhandled, requestId));
      }
    } finally {
      logger.info(JSON.stringify({
        level: 'info', event: 'request', requestId, method: req.method,
        path: req.url, status: res.statusCode, durationMs: Date.now() - startedAt,
      }));
    }
  });
}
