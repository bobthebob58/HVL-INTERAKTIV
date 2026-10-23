/**
 * apiBodies — parses and checks `/api` request bodies against the contract's zod schemas.
 *
 * Why: DOC-012 makes the zod schemas in `@hvl-interaktiv/api-contract` the request contract, and D-077 has the server
 *      validate with exactly those schemas, so a body the document does not allow never reaches a handler.
 * Spec: DOC-012, SEC-005
 * Invariants:
 *   - Only `application/json` bodies are read, with a size limit per route; anything else leaves no body and fails
 *     the schema.
 *   - A body that fails its schema is 400 `error.badRequest`; the zod issues are never sent back.
 * Collaborators: ./meRoutes.ts, ./publishRoutes.ts, ./contentSharingRoutes.ts, @hvl-interaktiv/api-contract.
 * Tests: apps/server/test/http/api/meRoutes.int.test.ts, apps/server/test/http/api/publishRoutes.int.test.ts
 */
import express, { type RequestHandler } from 'express';
import type { z } from 'zod';
import { HttpError } from '../HttpError.js';

/**
 * A JSON body parser for one route.
 * @param limit - Largest body, e.g. `'2kb'`.
 * @returns Express middleware.
 */
export const apiJson = (limit: string): RequestHandler => express.json({ limit });

/**
 * Checks a request body against its schema.
 * @param schema - The contract's request schema.
 * @param body - `req.body` (undefined when the request had no JSON body).
 * @returns The parsed body, with the schema's trimming applied.
 * @throws HttpError 400 `error.badRequest` when the body does not match.
 */
export function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new HttpError(400, 'error.badRequest');
  return result.data;
}
