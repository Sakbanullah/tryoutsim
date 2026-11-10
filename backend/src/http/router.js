/**
 * A minimal path router for `node:http`.
 *
 * `node:http` has no routing, so this is the smallest thing that matches
 * `/api/v1/sessions/:id` style paths and named parameters. Patterns are declared
 * once by each domain module; this file knows nothing about any domain.
 */

/**
 * Compile a pattern like `/api/v1/sessions/:id/answers` into a matcher.
 * @param {string} pattern
 * @returns {{segments: {literal?: string, param?: string}[], length: number}}
 */
function compile(pattern) {
  const segments = pattern
    .split('/')
    .filter((part) => part.length > 0)
    .map((part) =>
      part.startsWith(':') ? { param: part.slice(1) } : { literal: part },
    );
  return { segments, length: segments.length };
}

/**
 * Create a router.
 * @returns {{add: (method: string, pattern: string, handler: Function) => void, match: (method: string, pathname: string) => {handler: Function, params: Record<string, string>} | null}}
 */
export function createRouter() {
  /** @type {{method: string, compiled: ReturnType<typeof compile>, handler: Function}[]} */
  const routes = [];

  return {
    /**
     * Register a handler.
     * @param {string} method uppercase HTTP method
     * @param {string} pattern
     * @param {(ctx: {params: Record<string, string>, body: unknown, query: URLSearchParams}) => Promise<{status?: number, data: unknown}>} handler
     */
    add(method, pattern, handler) {
      routes.push({ method: method.toUpperCase(), compiled: compile(pattern), handler });
    },

    /**
     * Find the handler for a request. A path that matches a pattern under a
     * different method is reported so the server can answer 405 rather than 404.
     * @param {string} method
     * @param {string} pathname
     * @returns {{handler: Function, params: Record<string, string>} | {allowed: string[]} | null}
     */
    match(method, pathname) {
      const parts = pathname.split('/').filter((part) => part.length > 0);
      /** @type {string[]} */
      const allowed = [];

      for (const route of routes) {
        if (route.compiled.length !== parts.length) continue;
        /** @type {Record<string, string>} */
        const params = {};
        let ok = true;
        for (let i = 0; i < parts.length; i += 1) {
          const segment = route.compiled.segments[i];
          if (segment.literal !== undefined) {
            if (segment.literal !== parts[i]) { ok = false; break; }
          } else {
            params[segment.param] = decodeURIComponent(parts[i]);
          }
        }
        if (!ok) continue;
        if (route.method === method.toUpperCase()) return { handler: route.handler, params };
        allowed.push(route.method);
      }

      return allowed.length > 0 ? { allowed } : null;
    },
  };
}
