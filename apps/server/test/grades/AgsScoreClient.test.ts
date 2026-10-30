/**
 * Unit tests for the grade worker's AGS score client (D-104): the scores URL and body, one new token after a 401 and
 * a failure after a second, a 404 confirmed by a line-item read, and no redirect followed with the bearer token.
 *
 * Spec: LTI-012
 */
import { describe, expect, it } from 'vitest';
import { AgsAccessTokens } from '../../src/grades/AgsAccessTokens.js';
import { AgsScoreClient, scoresUrlOf } from '../../src/grades/AgsScoreClient.js';
import {
  fakeDirectory,
  fakePlatform,
  scriptedFetch,
  tokenAnswer,
  type FakeAnswer,
} from './support/fakeAgsFetch.js';

const LINE_ITEM = 'https://canvas.example/api/lti/courses/7/line_items/42';
const request = {
  platformId: fakePlatform().id,
  lineItemUrl: LINE_ITEM,
  userId: 'canvas-user-sub',
  scoreGiven: 75,
  timestamp: new Date('2026-10-30T10:00:00.000Z'),
};

/** A client whose token and service requests share one script. */
function clientWith(answers: FakeAnswer[]) {
  const { fetch, requests } = scriptedFetch(answers);
  const client = new AgsScoreClient(new AgsAccessTokens({ platforms: fakeDirectory(), fetch }), { fetch });
  return { client, requests };
}

describe('[LTI-012] AGS score client', () => {
  it.each([
    [LINE_ITEM, `${LINE_ITEM}/scores`],
    [`${LINE_ITEM}/`, `${LINE_ITEM}/scores`],
    [`${LINE_ITEM}?type_id=3`, `${LINE_ITEM}/scores?type_id=3`],
  ])('[LTI-012] posts the scores of %s to %s', (lineItem, scores) => {
    expect(scoresUrlOf(lineItem)).toBe(scores);
  });

  it('[LTI-012] posts LTI-012 score body with the media type and the bearer token', async () => {
    // Arrange
    const { client, requests } = clientWith([tokenAnswer('t1'), { status: 200 }]);
    // Act
    const outcome = await client.postScore(request);
    // Assert
    expect(outcome).toEqual({ kind: 'sent' });
    const post = requests[1];
    expect(post).toMatchObject({ url: `${LINE_ITEM}/scores`, method: 'POST', redirect: 'manual' });
    expect(post?.headers).toMatchObject({
      authorization: 'Bearer t1',
      'content-type': 'application/vnd.ims.lis.v1.score+json',
    });
    expect(JSON.parse(post?.body ?? '')).toEqual({
      userId: 'canvas-user-sub',
      scoreGiven: 75,
      scoreMaximum: 100,
      activityProgress: 'Completed',
      gradingProgress: 'FullyGraded',
      timestamp: '2026-10-30T10:00:00.000Z',
    });
  });

  it('[LTI-012] fetches one new token after a 401 and sends again', async () => {
    // Arrange
    const { client, requests } = clientWith([
      tokenAnswer('old'),
      { status: 401 },
      tokenAnswer('new'),
      { status: 200 },
    ]);
    // Act
    const outcome = await client.postScore(request);
    // Assert
    expect(outcome).toEqual({ kind: 'sent' });
    expect(requests.map((r) => r.headers.authorization ?? 'token')).toEqual([
      'token',
      'Bearer old',
      'token',
      'Bearer new',
    ]);
  });

  it('[LTI-012] fails after a second 401, without a third token', async () => {
    // Arrange
    const { client, requests } = clientWith([
      tokenAnswer('a'),
      { status: 401 },
      tokenAnswer('b'),
      { status: 401 },
    ]);
    // Act
    const outcome = await client.postScore(request);
    // Assert
    expect(outcome).toEqual({ kind: 'failed', reason: 'http-401' });
    expect(requests).toHaveLength(4);
  });

  it.each<[string, FakeAnswer, object]>([
    ['a 404 read', { status: 404 }, { kind: 'orphaned' }],
    ['a 410 read', { status: 410 }, { kind: 'orphaned' }],
    ['a 200 read', { status: 200, json: { id: LINE_ITEM } }, { kind: 'failed', reason: 'http-404' }],
    ['a 503 read', { status: 503 }, { kind: 'retry', reason: 'lineitem-http-503' }],
    ['no read answer', 'network', { kind: 'retry', reason: 'network' }],
  ])('[LTI-012] confirms a score 404 with a line-item read: %s', async (_name, read, expected) => {
    // Arrange
    const { client, requests } = clientWith([tokenAnswer('t'), { status: 404 }, read]);
    // Act
    const outcome = await client.postScore(request);
    // Assert
    expect(outcome).toEqual(expected);
    expect(requests[2]).toMatchObject({ url: LINE_ITEM, method: 'GET', redirect: 'manual' });
    expect(requests[2]?.headers.accept).toBe('application/vnd.ims.lis.v2.lineitem+json');
  });

  it.each<[string, FakeAnswer, object]>([
    [
      'a 429 with Retry-After',
      { status: 429, headers: { 'retry-after': '30' } },
      { kind: 'retry', reason: 'http-429', retryAfterMs: 30_000 },
    ],
    ['a 502', { status: 502 }, { kind: 'retry', reason: 'http-502' }],
    ['a 422 (not a learner)', { status: 422 }, { kind: 'failed', reason: 'http-422' }],
    [
      'a redirect',
      { status: 307, headers: { location: 'https://elsewhere.example/' } },
      { kind: 'failed', reason: 'http-307' },
    ],
    ['no answer', 'network', { kind: 'retry', reason: 'network' }],
  ])('[LTI-012] turns %s to a score post into its outcome', async (_name, answer, expected) => {
    const { client } = clientWith([tokenAnswer('t'), answer]);
    expect(await client.postScore(request)).toEqual(expected);
  });

  it('[LTI-012] stops before posting when there is no token', async () => {
    const { client, requests } = clientWith([{ status: 503 }]);
    expect(await client.postScore(request)).toEqual({ kind: 'retry', reason: 'token-http-503' });
    expect(requests).toHaveLength(1);
  });
});
