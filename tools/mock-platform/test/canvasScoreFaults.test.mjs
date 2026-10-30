/**
 * Tests for the mock Canvas's AGS fault injection: score posts that answer 503, 404 or 429 with Retry-After or arrive
 * late, and line-item reads that fail, as the grade worker's retry and orphan rules (D-104) must meet them.
 *
 * Spec: LTI-012
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { scoreBody, startServiceBench } from './serviceBench.mjs';

let bench;
let token;

beforeAll(async () => {
  bench = await startServiceBench();
  token = await bench.token();
});
afterAll(() => bench.close());
afterEach(() => bench.canvas.clearFaults());

/** A fresh line item in its own course, so tests never share results. */
const freshLineItem = () =>
  bench.canvas.ags.addLineItem({
    courseId: `course-${crypto.randomUUID()}`,
    label: 'Quiz',
    scoreMaximum: 100,
  }).id;
const statusesOf = async (requests) => {
  const statuses = [];
  for (const request of requests) statuses.push((await request()).status);
  return statuses;
};

describe('[LTI-012] mock Canvas AGS faults', () => {
  it('[LTI-012] answers injected 503s, then accepts the next post, and records each fault', async () => {
    const url = freshLineItem();
    bench.canvas.ags.failNextScores({ count: 2, status: 503 });
    const statuses = await statusesOf(
      Array.from({ length: 3 }, () => () => bench.postScore(url, scoreBody(), token)),
    );
    expect(statuses).toEqual([503, 503, 200]);
    expect(bench.canvas.ags.scorePosts.slice(-3).map((post) => post.fault)).toEqual([true, true, false]);
  });

  it('[LTI-012] answers an injected 404 while a line-item read still finds the line item', async () => {
    // Arrange
    const url = freshLineItem();
    bench.canvas.ags.failNextScores({ status: 404 });
    // Act
    const statuses = await statusesOf([
      () => bench.postScore(url, scoreBody(), token),
      () => bench.get(url, token),
    ]);
    // Assert
    expect(statuses).toEqual([404, 200]);
  });

  it('[LTI-012] answers an injected 429 with Retry-After, and an injected delay before serving', async () => {
    // Arrange
    const url = freshLineItem();
    bench.canvas.ags.failNextScores({ status: 429, retryAfter: 5 });
    bench.canvas.ags.failNextScores({ delayMs: 300 });
    // Act
    const limited = await bench.postScore(url, scoreBody(), token);
    const started = Date.now();
    const delayed = await bench.postScore(url, scoreBody(), token);
    // Assert
    expect([limited.status, limited.headers.get('retry-after')]).toEqual([429, '5']);
    expect(delayed.status).toBe(200);
    expect(Date.now() - started).toBeGreaterThanOrEqual(290);
  });

  it('[LTI-012] fails line-item reads on request, without touching score posts', async () => {
    const url = freshLineItem();
    bench.canvas.ags.failNextLineItemReads({ status: 500 });
    const statuses = await statusesOf([
      () => bench.postScore(url, scoreBody(), token),
      () => bench.get(url, token),
      () => bench.get(url, token),
    ]);
    expect(statuses).toEqual([200, 500, 200]);
  });
});
