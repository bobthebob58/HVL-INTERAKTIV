/**
 * staleCookieClearing — adds the order to delete a dead session cookie when an answer's headers are written, and
 * only to an answer that no cache keeps.
 *
 * Why: a browser that sends a dead session ID would send it on every request until it closes, so the server
 *      clears it. The order is a `Set-Cookie` header, and a request for a file that is the same for everyone (H5P
 *      core, a library file, a web-app chunk) is answered `public`: a shared cache that kept such an answer would
 *      hand the order to other people, whose live cookie it deletes (D-142). Which answer a route gives is known
 *      only when it writes its headers, so the decision is made there.
 * Spec: AUTH-003
 * Invariants:
 *   - The order is added only when the answer's `Cache-Control` says `no-store` or `private`. An answer without
 *     `Cache-Control` gets `no-store` and the order: it answers one browser's cookie.
 *   - An answer that names any other caching (`public`, `max-age`, `no-cache`) never carries the order; the dead
 *     cookie is cleared by the next answer that is about the person.
 *   - An answer that already sets the session cookie (a login) is left as it is.
 *   - `Cache-Control` is read where a route put it: on the response, or in the headers given to `writeHead`.
 * Collaborators: ./portalSessionMiddleware.ts (the only caller), ./sessionCookies.ts.
 * Tests: apps/server/test/auth/session/staleCookieClearing.test.ts,
 *   apps/server/test/auth/session/portalSessionMiddleware.int.test.ts
 */
import type { Response } from 'express';
import { expiredSessionCookie, SESSION_COOKIE, setCookie } from './sessionCookies.js';

/** The `Cache-Control` among the headers handed to `writeHead`: an object, or Node's flat `[name, value, …]`. */
function cacheControlIn(headers: unknown): string | undefined {
  if (typeof headers !== 'object' || headers === null) return undefined;
  const pairs: (readonly unknown[])[] = Array.isArray(headers)
    ? headers.flatMap((name: unknown, index) => (index % 2 === 0 ? [[name, headers[index + 1]]] : []))
    : Object.entries(headers);
  const found = pairs.find(([name]) => String(name).toLowerCase() === 'cache-control');
  return found === undefined ? undefined : String(found[1]);
}

/** True when a `Cache-Control` value keeps the answer out of every shared cache. */
const keptByNoCache = (cacheControl: string): boolean =>
  cacheControl.split(',').some((directive) => {
    const [name = ''] = directive.trim().toLowerCase().split('=', 1);
    return name === 'no-store' || name === 'private';
  });

const setsSessionCookie = (res: Response): boolean =>
  [res.getHeader('Set-Cookie') ?? []].flat().some((value) => String(value).startsWith(`${SESSION_COOKIE}=`));

/** Adds the order to an answer whose headers are about to be written, when the invariants allow it. */
function addClearingOrder(res: Response, given: unknown): void {
  if (res.headersSent || setsSessionCookie(res)) return;
  const cacheControl = cacheControlIn(given) ?? res.getHeader('Cache-Control');
  // WHY: an answer that says nothing about caching and clears a cookie is about one browser.
  if (cacheControl === undefined) res.setHeader('Cache-Control', 'no-store');
  // SECURITY: `public`, `max-age` and `no-cache` answers may be kept and handed to other people (D-142).
  else if (!keptByNoCache(String(cacheControl))) return;
  setCookie(res, expiredSessionCookie());
}

/**
 * Arranges for a dead session cookie to be cleared by this response, unless a cache may keep the response.
 * @param res - The response of a request that sent a session cookie naming no live session; nothing sent yet.
 * @spec AUTH-003
 */
export function clearSessionCookieOnUncachedAnswer(res: Response): void {
  const writeHead = res.writeHead as (...args: unknown[]) => Response;
  // WHY: Node writes the headers through `writeHead`, also when a route only calls `end`, `send` or `pipe`.
  res.writeHead = ((...args: unknown[]) => {
    addClearingOrder(res, args.at(-1));
    return Reflect.apply(writeHead, res, args);
  }) as typeof res.writeHead;
}
