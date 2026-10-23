/**
 * requestBodies — the body parsers of the H5P routes, with limits and H5P's form field names.
 *
 * Why: the H5P client sends forms with jQuery's `libraries[]=…` names and JSON for saves. Express 5's simple
 *      form parser keeps `libraries[]` as the key, so it is normalised to `libraries`; the extended parser
 *      (qs) is not used, so no nested objects or prototype keys can be built from a form.
 * Spec: H5P-004, SEC-005
 * Invariants:
 *   - Form bodies: at most 20 MB and 1000 fields; learner state: at most 2 MB; JSON saves: at most 20 MB.
 *   - A key ending in `[]` becomes the key without it, always holding an array.
 *   - `req.body` is always an object after these parsers (Express 5 leaves it undefined otherwise).
 * Collaborators: ./routes/ajaxRoutes.ts, ./routes/userDataRoutes.ts, ./routes/contentRoutes.ts.
 * Tests: apps/server/test/http/router.int.test.ts
 */
import express, { type NextFunction, type Request, type RequestHandler, type Response } from 'express';

const normaliseArrays = (req: Request, _res: Response, next: NextFunction): void => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (key.endsWith('[]')) result[key.slice(0, -2)] = Array.isArray(value) ? value : [value];
    else result[key] = value;
  }
  req.body = result;
  next();
};

/**
 * Parses an urlencoded form.
 * @param limit - Largest body, e.g. `'20mb'`.
 * @returns Middleware that leaves a plain object in `req.body`.
 */
export const formBody = (limit: string): RequestHandler[] => [
  express.urlencoded({ extended: false, limit, parameterLimit: 1000 }),
  normaliseArrays,
];

/** Parses a JSON body of at most 20 MB (content saves). */
export const jsonBody: RequestHandler[] = [
  express.json({ limit: '20mb' }),
  (req: Request, _res: Response, next: NextFunction) => {
    req.body ??= {};
    next();
  },
];
