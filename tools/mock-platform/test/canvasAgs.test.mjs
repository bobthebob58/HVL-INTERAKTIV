/**
 * Tests for the mock Canvas's AGS services: line items from launches and from the service, the score service's
 * record, and deleted line items. Injected faults are in ./canvasScoreFaults.test.mjs.
 *
 * Spec: LTI-012
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { CANVAS_USERS, LTI_CLAIM, LTI_MEDIA_TYPE, LTI_SCOPE } from '../mockPlatform.mjs';
import { linkOf, scoreBody, startServiceBench } from './serviceBench.mjs';

let bench;
let token;

beforeAll(async () => {
  bench = await startServiceBench();
  token = await bench.token();
});
afterAll(() => bench.close());
afterEach(() => bench.canvas.clearFaults());

/** A fresh line item in its own course, so tests never share results. */
const freshLineItem = (overrides = {}) =>
  bench.canvas.ags.addLineItem({
    courseId: `course-${crypto.randomUUID()}`,
    label: 'Quiz',
    scoreMaximum: 100,
    ...overrides,
  }).id;

describe('[LTI-012] mock Canvas line items', () => {
  it("[LTI-012] gives a graded launch's line item a URL that reads 200 as lineitem+json", async () => {
    // Arrange
    const spec = {
      user: CANVAS_USERS.student,
      course: { id: 'course-ags' },
      resourceLinkId: 'rl-1',
      lineItem: '42',
    };
    // Act
    const claims = await bench.launch(spec);
    const url = claims[LTI_CLAIM.agsEndpoint].lineitem;
    const response = await bench.get(url, token);
    // Assert
    expect(url).toBe(`${bench.canvas.origin}/api/lti/courses/course-ags/line_items/42`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe(LTI_MEDIA_TYPE.lineItem);
    expect(await response.json()).toEqual({
      id: url,
      label: 'Mock activity',
      scoreMaximum: 100,
      resourceLinkId: 'rl-1',
    });
  });

  it("[LTI-012] lists a course's line items with filters, and pages with Canvas's Link header", async () => {
    // Arrange
    const courseId = 'course-list';
    for (const tag of ['a', 'b', 'c']) {
      bench.canvas.ags.addLineItem({
        courseId,
        label: `Item ${tag}`,
        scoreMaximum: 10,
        tag,
        resourceLinkId: `rl-${tag}`,
      });
    }
    const list = `${bench.canvas.origin}/api/lti/courses/${courseId}/line_items`;
    // Act
    const first = await bench.get(`${list}?limit=2`, token);
    const second = await bench.get(linkOf(first), token);
    const filtered = await (await bench.get(`${list}?resource_link_id=rl-b`, token)).json();
    // Assert
    expect(first.headers.get('content-type')).toBe(LTI_MEDIA_TYPE.lineItemContainer);
    const firstLinks = [
      ['current', 1],
      ['next', 2],
      ['first', 1],
      ['last', 2],
    ];
    expect(first.headers.get('link')).toBe(
      firstLinks.map(([rel, page]) => `<${list}?limit=2&page=${page}&per_page=2>; rel="${rel}"`).join(','),
    );
    expect((await first.json()).map((item) => item.tag)).toEqual(['a', 'b']);
    expect([(await second.json()).map((item) => item.tag), linkOf(second), linkOf(second, 'prev')]).toEqual([
      ['c'],
      undefined,
      `${list}?limit=2&page=1&per_page=2`,
    ]);
    expect(filtered.map((item) => item.label)).toEqual(['Item b']);
  });

  it('[LTI-012] creates a line item only with the lineitem scope, answering 201, and refuses an invalid one', async () => {
    // Arrange
    const wide = await startServiceBench({ scopes: [LTI_SCOPE.lineItem, LTI_SCOPE.lineItemReadonly] });
    const list = `${wide.canvas.origin}/api/lti/courses/c-1/line_items`;
    const post = (accessToken, body) =>
      fetch(list, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': LTI_MEDIA_TYPE.lineItem },
        body: JSON.stringify(body),
      });
    try {
      // Act
      const writer = await wide.token(LTI_SCOPE.lineItem);
      const created = await post(writer, { label: 'Kapittel 1', scoreMaximum: 50, resourceId: 'r-1' });
      const invalid = await post(writer, { label: '', scoreMaximum: 0 });
      const readOnly = await post(await wide.token(LTI_SCOPE.lineItemReadonly), {
        label: 'X',
        scoreMaximum: 1,
      });
      // Assert
      expect(created.status).toBe(201);
      expect(await created.json()).toEqual({
        id: `${list}/1`,
        label: 'Kapittel 1',
        scoreMaximum: 50,
        resourceId: 'r-1',
      });
      expect([invalid.status, readOnly.status]).toEqual([400, 401]);
    } finally {
      await wide.close();
    }
  });

  it('[LTI-012] answers 404 for a deleted line item at reads and score posts, and a relaunch does not revive it', async () => {
    // Arrange
    const spec = { course: { id: 'course-deleted' }, lineItem: '7' };
    const url = (await bench.launch(spec))[LTI_CLAIM.agsEndpoint].lineitem;
    // Act
    const deleted = bench.canvas.ags.deleteLineItem(url);
    await bench.launch(spec);
    const answers = [];
    for (const response of [await bench.get(url, token), await bench.postScore(url, scoreBody(), token)]) {
      answers.push([response.status, await response.json()]);
    }
    // Assert
    expect([deleted, bench.canvas.ags.deleteLineItem(url)]).toEqual([true, false]);
    const notFound = { errors: [{ message: 'The specified resource does not exist.' }] };
    expect(answers).toEqual([
      [404, notFound],
      [404, notFound],
    ]);
    expect(bench.canvas.ags.scorePosts.at(-1)).toMatchObject({
      ok: false,
      problems: ['unknown-line-item'],
      lineItemUrl: undefined,
    });
    expect(bench.canvas.ags.lineItems('course-deleted')).toEqual([]);
  });
});

describe('[LTI-012] mock Canvas score service', () => {
  it('[LTI-012] records an accepted score and answers 200 with a resultUrl', async () => {
    // Arrange
    const url = freshLineItem();
    const body = scoreBody({ scoreGiven: 75 });
    // Act
    const response = await bench.postScore(url, body, token);
    // Assert
    expect(response.status).toBe(200);
    expect((await response.json()).resultUrl).toMatch(new RegExp(`^${url}/results/\\d+$`));
    expect(bench.canvas.ags.scores.at(-1)).toEqual({
      lineItemUrl: url,
      courseId: expect.stringMatching(/^course-/),
      score: body,
      receivedAt: expect.any(String),
    });
    expect(bench.canvas.ags.scorePosts.at(-1)).toMatchObject({
      ok: true,
      status: 200,
      fault: false,
      lineItemUrl: url,
    });
  });
});
