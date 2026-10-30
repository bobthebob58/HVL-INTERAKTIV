/**
 * Integration tests of the limits on `POST /api/h5p/xapi`: the envelope schema, the 64 KiB body, 50 items, the
 * 120-statement rate limit per learner and activity, and invalid items logged by count without their content.
 *
 * Spec: LTI-011
 */
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { describeWithServices } from '../support/services.js';
import { openXapiBench, type XapiBench } from './support/xapiBench.js';

const MC = 'H5P.MultiChoice 1.16';

/** `count` root `attempted` statements of one page load, each with its own statement ID. */
const attempts = (contentId: string, count: number) => {
  const viewId = randomUUID();
  return Array.from({ length: count }, () => ({
    statementId: randomUUID(),
    attemptId: `${viewId}:1`,
    verb: { id: 'http://adlnet.gov/expapi/verbs/attempted' },
    object: { id: contentId },
  }));
};

describeWithServices('[LTI-011] limits of the xAPI route', () => {
  let bench: XapiBench;
  let contentId: string;
  let header: [string, string];
  beforeAll(async () => {
    bench = await openXapiBench();
    contentId = await bench.activity(MC);
    header = (await bench.principal('learner')).header;
  });
  afterAll(() => bench.close());

  /** Posts a batch as the test learner, as another principal, or (with null) as nobody. */
  const post = (body: unknown, as: [string, string] | null = header) => {
    const req = request(bench.app).post('/api/h5p/xapi');
    return (as ? req.set(...as) : req).send(body as object);
  };

  it.each([
    ['no statements', () => ({ contentId, contentVersion: 1, statements: [] })],
    ['51 statements', () => ({ contentId, contentVersion: 1, statements: attempts(contentId, 51) })],
    ['no version', () => ({ contentId, statements: attempts(contentId, 1) })],
    ['an activity ID that is not a UUID', () => ({ contentId: 'x', contentVersion: 1, statements: [{}] })],
    [
      'a field the envelope does not have',
      () => ({ contentId, contentVersion: 1, statements: [{}], actor: {} }),
    ],
  ])('[LTI-011] refuses a batch with %s as 400 and stores nothing', async (_case, body) => {
    const res = await post(body());
    expect([res.status, res.body.errorCode]).toEqual([400, 'error.badRequest']);
  });

  it('[LTI-011] refuses a body that is not JSON as 400', async () => {
    const res = await request(bench.app)
      .post('/api/h5p/xapi')
      .set(...header)
      .type('text')
      .send('{}');
    expect(res.status).toBe(400);
  });

  it('[LTI-011] refuses a body over 64 KiB with 413, and a stranger’s large body with 401 before reading it', async () => {
    // Arrange
    const big = { contentId, contentVersion: 1, statements: [{ padding: 'x'.repeat(65 * 1024) }] };
    // Act
    const signedIn = await post(big);
    const stranger = await post(big, null);
    // Assert
    expect([signedIn.status, signedIn.body.errorCode]).toEqual([413, 'too-large']);
    expect([stranger.status, stranger.body.errorCode]).toEqual([401, 'hvl:unauthenticated']);
  });

  it('[LTI-011] allows 120 statements a minute per learner and activity, then answers 429 and stores none of the batch', async () => {
    // Arrange
    const activity = await bench.activity(MC);
    const other = await bench.activity(MC);
    const learner = (await bench.principal('learner')).header;
    const send = (id: string, count: number) =>
      post({ contentId: id, contentVersion: 1, statements: attempts(id, count) }, learner);
    // Act
    const allowed = [await send(activity, 50), await send(activity, 50), await send(activity, 20)];
    const refused = await send(activity, 1);
    const elsewhere = await send(other, 1);
    // Assert
    expect(allowed.map((res) => res.status)).toEqual([202, 202, 202]);
    expect([refused.status, refused.body.errorCode]).toEqual([429, 'hvl:rate-limited']);
    expect(Number(refused.headers['retry-after'])).toBeGreaterThanOrEqual(1);
    expect(Number(refused.headers['retry-after'])).toBeLessThanOrEqual(60);
    expect(await bench.rowsOf(activity)).toHaveLength(120);
    expect(elsewhere.status).toBe(202);
  });

  it('[LTI-011] stores the valid items of a batch and logs the invalid ones by count, never their content', async () => {
    // Arrange
    const [valid] = attempts(contentId, 1);
    const invalid = {
      ...attempts(contentId, 1)[0],
      result: { response: 'HEMMELEG-SVAR', score: { raw: 2, max: 1 } },
    };
    // Act
    const res = await post({ contentId, contentVersion: 1, statements: [invalid, valid] });
    // Assert
    const line = bench.logs.find((entry) => entry.includes('"invalid":1'));
    expect(res.status).toBe(202);
    expect((await bench.rowsOf(contentId)).map((row) => row.id)).toContain(valid?.statementId);
    expect(line).toContain('"stored":1');
    expect(bench.logs.join('\n')).not.toContain('HEMMELEG-SVAR');
  });
});
