/**
 * publishFixtures — findings, a reason and request helpers shared by the publish-flow tests.
 *
 * Why: the publish tests need the same error, warning and hint (one of each severity, PROD-003) and the same way to
 *      call `/api/content/:id/…` as a test principal; one place keeps the tests short and alike.
 * Spec: PROD-003, UD-022
 * Invariants:
 *   - The findings have the shape of `Finding` (../../src/validation/types.ts); their messages are fixed Nynorsk text.
 * Collaborators: ./apiTestbed.ts.
 * Tests: apps/server/test/http/api/publishRoutes.int.test.ts, apps/server/test/http/api/publishGuards.int.test.ts,
 *   apps/server/test/content/publishedSave.int.test.ts
 */
import request from 'supertest';
import type { ContentValidator, Finding } from '../../src/validation/types.js';
import type { ApiTestbed, TestPrincipal } from './apiTestbed.js';

/** One day in milliseconds. */
export const DAY = 24 * 60 * 60 * 1000;

/** An error: an image without alternative text. */
export const altError: Finding = {
  ruleId: 'V-IMG-ALT',
  severity: 'error',
  requirement: 'UD-021',
  path: 'media.params.alt',
  message: 'Skriv ein alternativ tekst.',
};
/** A warning: no default language. */
export const langWarning: Finding = {
  ...altError,
  ruleId: 'V-LANG',
  severity: 'warning',
  path: 'metadata.defaultLanguage',
};
/** A hint: the text refers to colour. */
export const colourHint: Finding = {
  ...altError,
  ruleId: 'V-COLOUR-WORDS',
  severity: 'hint',
  path: 'question',
};
/** A reason for `altError`, with spaces the server trims. */
export const altReason = {
  ruleId: altError.ruleId,
  path: altError.path,
  reason: '  Biletet er pynt, alt kjem.  ',
};

/**
 * A validator that always finds the same findings.
 * @param found - The findings.
 * @returns The validator.
 */
export const findingsOnly =
  (...found: Finding[]): ContentValidator =>
  () =>
    found;

/**
 * Calls `/api/content/<path>` as a principal.
 * @param tb - The API testbed.
 * @param method - `get` or `post`.
 * @param path - The path after `/api/content/`, e.g. `<id>/publish`.
 * @param who - The principal.
 * @returns The supertest request, ready for `.send()`.
 */
export function contentApi(tb: ApiTestbed, method: 'get' | 'post', path: string, who: TestPrincipal) {
  const call = request(tb.app);
  const url = `/api/content/${path}`;
  return (method === 'get' ? call.get(url) : call.post(url)).set(...who.header);
}

/**
 * The `updatedAt` an author's check of the findings returns.
 * @param tb - The API testbed.
 * @param id - The activity.
 * @param who - The principal.
 * @returns The ISO string to send back with a publish or unpublish request.
 */
export const checkedUpdatedAt = async (tb: ApiTestbed, id: string, who: TestPrincipal): Promise<string> =>
  (await contentApi(tb, 'get', `${id}/findings`, who)).body.updatedAt as string;
