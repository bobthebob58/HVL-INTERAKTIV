/**
 * Integration tests for the per-person limits of the studio's routes (D-128): the planner, the mappe's preview and
 * export together, and new activities from a pattern, which share their limit with new activities from the editor.
 * Past a limit the answer is 429 `hvl:rate-limited` with `Retry-After`; another person goes on.
 *
 * Spec: PROD-007, PED-031, MAPPE-001
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createH5pRouteLimits, CREATIONS_PER_TEN_MINUTES } from '../../../src/http/h5pRouteLimits.js';
import {
  MAPPE_REQUESTS_PER_TEN_MINUTES,
  PLANNER_REQUESTS_PER_TEN_MINUTES,
} from '../../../src/learningDesign/http/studioRouteLimits.js';
import { openApiTestbed, type TestPrincipal } from '../../support/apiTestbed.js';
import { requestAs } from '../../support/requestAs.js';
import { describeWithServices } from '../../support/services.js';

const LIMITED = { status: 429, errorCode: 'hvl:rate-limited' };
const answerOf = (res: { status: number; body: { errorCode?: string } }) => ({
  status: res.status,
  ...(res.body.errorCode ? { errorCode: res.body.errorCode } : {}),
});

describeWithServices('[PROD-007] the per-person limits of the studio routes', () => {
  const tb = openApiTestbed();
  let colleague: TestPrincipal;
  beforeAll(async () => {
    colleague = await tb.principal('author');
  });
  afterAll(() => tb.close());

  it('[PED-031] the planner past a person’s limit is 429 with Retry-After; another person goes on', async () => {
    // Arrange
    const author = await tb.principal('author');
    const planner = (who: TestPrincipal) =>
      requestAs(tb.app, who, 'get', '/api/learning-design/planner?courseCode=SYK110');
    // Act
    const statuses = new Set<number>();
    for (let n = 0; n < PLANNER_REQUESTS_PER_TEN_MINUTES; n += 1)
      statuses.add((await planner(author)).status);
    const past = await planner(author);
    const other = await planner(colleague);
    // Assert
    expect(statuses).toEqual(new Set([200]));
    expect(answerOf(past)).toEqual(LIMITED);
    expect(Number(past.headers['retry-after'])).toBeGreaterThan(0);
    expect(other.status).toBe(200);
  }, 120_000);

  it('[MAPPE-001] the mappe’s preview and export count together: past the limit both are 429; another person goes on', async () => {
    // Arrange
    const author = await tb.principal('author');
    const mine = await tb.content(author.principal.userId, { title: 'Blåbærquiz' });
    const theirs = await tb.content(colleague.principal.userId, { title: 'Tyttebærquiz' });
    const ask = (who: TestPrincipal, path: string, id: string) =>
      requestAs(tb.app, who, 'post', path).send({ contentIds: [id], locale: 'nn' });
    // Act: all but one of the limit as previews, the last one as an export
    const statuses = new Set<number>();
    for (let n = 0; n < MAPPE_REQUESTS_PER_TEN_MINUTES - 1; n += 1)
      statuses.add((await ask(author, '/api/mappe/preview', mine)).status);
    statuses.add((await ask(author, '/api/mappe/export?format=md', mine)).status);
    const past = [
      await ask(author, '/api/mappe/preview', mine),
      await ask(author, '/api/mappe/export?format=md', mine),
    ];
    const other = await ask(colleague, '/api/mappe/preview', theirs);
    // Assert
    expect(statuses).toEqual(new Set([200]));
    expect(past.map(answerOf)).toEqual([LIMITED, LIMITED]);
    expect(Number(past[0]?.headers['retry-after'])).toBeGreaterThan(0);
    expect(other.status).toBe(200);
  }, 120_000);

  it('[PROD-007] an activity from a pattern counts with new activities from the editor: past their limit it is 429, before anything is built', async () => {
    // Arrange: as many new activities as the limit allows, counted as the editor's save counts them
    const author = await tb.principal('author');
    const editorLimit = createH5pRouteLimits(tb.redis).creations;
    for (let n = 0; n < CREATIONS_PER_TEN_MINUTES; n += 1) await editorLimit.take(author.principal.userId);
    const fromPattern = (who: TestPrincipal) =>
      requestAs(tb.app, who, 'post', '/api/patterns/no-such-pattern/activities').send({ locale: 'nn' });
    // Act
    const past = await fromPattern(author);
    const other = await fromPattern(colleague);
    // Assert: the colleague's request is read (and refused for its body), the author's is not
    expect(answerOf(past)).toEqual(LIMITED);
    expect(Number(past.headers['retry-after'])).toBeGreaterThan(0);
    expect(other.status).toBe(400);
  });
});
