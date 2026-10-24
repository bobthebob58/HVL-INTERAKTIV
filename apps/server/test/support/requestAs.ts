/**
 * requestAs — a supertest request made as one test person, with the header that names them.
 *
 * Why: the HTTP tests send almost every request as a test actor (./httpTestbed.ts) or principal (./apiTestbed.ts);
 *      one helper keeps each such call on one line, and the header on every one of them.
 * Spec: H5P-006
 * Tests: shared by the tests under apps/server/test/http.
 */
import type { Express } from 'express';
import request from 'supertest';

/**
 * Starts a request to `app` as one person.
 * @param app - The Express app.
 * @param who - The test actor or principal; its header is set on the request.
 * @param method - The HTTP method.
 * @param path - The path, with its query.
 * @returns The supertest request, ready for `.send()` or to be awaited.
 */
export function requestAs(
  app: Express,
  who: { readonly header: readonly [string, string] },
  method: 'get' | 'post' | 'put' | 'delete' | 'patch',
  path: string,
): request.Test {
  const call = request(app);
  return call[method](path).set(...who.header);
}
