/**
 * routeParams — reads named path parameters of an Express 5 route as plain strings.
 *
 * Why: Express 5 hands a `:name` parameter over as a string and a `*name` wildcard as an array of path
 *      segments, and its types allow both (or nothing) for every name. Routes pass these values to Lumi as
 *      IDs and file names, so they are read through one place that answers 400 instead of passing on
 *      `undefined` or an array.
 * Spec: H5P-004
 * Invariants:
 *   - `pathParam` returns a non-empty string or throws HttpError 400.
 *   - `wildcardParam` joins the segments with "/"; Lumi's storage checks the result for traversal.
 *   - `contentIdParam` is `pathParam` in lower case: an activity ID has one spelling in every check and lock.
 * Collaborators: ./routes/*.
 * Tests: apps/server/test/http/router.int.test.ts
 */
import type { Request } from 'express';
import { HttpError } from './HttpError.js';

/**
 * A `:name` parameter.
 * @param req - The request.
 * @param name - Parameter name in the route path.
 * @returns The value.
 * @throws HttpError 400 when it is missing or not a single string.
 */
export function pathParam(req: Request, name: string): string {
  const value: unknown = req.params[name];
  if (typeof value !== 'string' || value === '') throw new HttpError(400, 'error.badRequest');
  return value;
}

/**
 * The `:contentId` parameter in its one stored form.
 * @param req - The request.
 * @returns The ID in lower case, as the database and the write lock hold it.
 * @throws HttpError 400 when it is missing or not a single string.
 */
export function contentIdParam(req: Request): string {
  // SECURITY: PostgreSQL reads a UUID in any case, a lookup by text and a lock key do not; one spelling for all,
  // so a check keyed on the ID cannot be passed by writing it in capitals (D-131).
  return pathParam(req, 'contentId').toLowerCase();
}

/**
 * A `*name` wildcard parameter as one relative path.
 * @param req - The request.
 * @param name - Wildcard name in the route path.
 * @returns The segments joined with "/".
 * @throws HttpError 400 when it is missing or empty.
 */
export function wildcardParam(req: Request, name: string): string {
  const value: unknown = req.params[name];
  const segments: unknown[] = Array.isArray(value) ? value : [value];
  const valid = segments.length > 0 && segments.every((s) => typeof s === 'string' && s !== '');
  if (!valid) throw new HttpError(400, 'error.badRequest');
  return segments.join('/');
}
