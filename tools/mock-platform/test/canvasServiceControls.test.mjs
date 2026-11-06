/**
 * Tests for the mock Canvas's `/__mock/` service controls, which a developer uses against the CLI's mock: faults,
 * deleting a line item, revoking tokens, and the record of line items, scores and token requests.
 *
 * Spec: LTI-012, LTI-008
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { scoreBody, startServiceBench } from './serviceBench.mjs';

let bench;
let origin;

beforeAll(async () => {
  bench = await startServiceBench();
  origin = bench.canvas.origin;
});
afterAll(() => bench.close());

const control = (path, form) =>
  fetch(`${origin}/__mock/${path}`, { method: 'POST', ...(form && { body: new URLSearchParams(form) }) });

describe('[LTI-012] mock Canvas /__mock/ service controls', () => {
  it('[LTI-012] queues a fault from the query string, which the next score posts answer', async () => {
    // Arrange
    const url = bench.canvas.ags.addLineItem({
      courseId: 'course-controls',
      label: 'Quiz',
      scoreMaximum: 100,
    }).id;
    const token = await bench.token();
    // Act
    const queued = await control('faults?target=scores&status=503&count=2&retryAfter=4');
    const statuses = [];
    for (let i = 0; i < 3; i += 1) statuses.push((await bench.postScore(url, scoreBody(), token)).status);
    // Assert
    expect(await queued.json()).toEqual({
      target: 'scores',
      fault: { count: 2, status: 503, retryAfter: 4, delayMs: 0 },
      pending: 2,
    });
    expect(statuses).toEqual([503, 503, 200]);
  });

  it('[LTI-008] refuses an unknown target or a bad value with 400, without echoing it', async () => {
    // Act
    const target = await control('faults', { target: '<script>', status: '503' });
    const status = await control('faults', { target: 'memberships', status: '200' });
    // Assert
    expect([target.status, status.status]).toEqual([400, 400]);
    expect(JSON.stringify([await target.json(), await status.json()])).not.toContain('<script>');
  });

  it('[LTI-012] deletes a line item by URL from a form, and revokes every token', async () => {
    // Arrange
    const url = bench.canvas.ags.addLineItem({
      courseId: 'course-controls',
      label: 'Old',
      scoreMaximum: 10,
    }).id;
    const token = await bench.token();
    // Act
    const deleted = await (await control('line-items/delete', { url })).json();
    const before = (await bench.get(`${origin}/api/lti/courses/course-controls/line_items`, token)).status;
    await control('tokens/revoke');
    const after = (await bench.get(`${origin}/api/lti/courses/course-controls/line_items`, token)).status;
    // Assert
    expect(deleted).toEqual({ deleted: true });
    expect(bench.canvas.ags.lineItems('course-controls').map((item) => item.id)).not.toContain(url);
    expect([before, after]).toEqual([200, 401]);
  });

  it('[LTI-012] lets a form field win over the same query field', async () => {
    // Act
    const queued = await control('faults?target=scores&status=503', { status: '429', retryAfter: '2' });
    // Assert
    expect((await queued.json()).fault).toMatchObject({ status: 429, retryAfter: 2 });
    bench.canvas.clearFaults();
  });

  it('[LTI-012] shows line items, accepted scores, score posts and token requests, but no token', async () => {
    // Arrange
    const token = await bench.token();
    // Act
    const shown = await (await fetch(`${origin}/__mock/services`)).json();
    // Assert
    expect(Object.keys(shown)).toEqual(['lineItems', 'scores', 'scorePosts', 'tokenRequests']);
    expect(shown.scores.length).toBe(bench.canvas.ags.scores.length);
    expect(shown.tokenRequests.length).toBe(bench.canvas.tokens.requests.length);
    expect(JSON.stringify(shown)).not.toContain(token);
  });
});
