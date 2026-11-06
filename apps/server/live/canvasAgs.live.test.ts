/**
 * Live-contract checks of Canvas's Assignment and Grade Services, as the Deep Linking return (LTI-005), the label
 * (LTI-013, D-105) and the grade worker (LTI-012, D-104) rely on them: the line item an `assignment_selection` return
 * created, its label, reads, 404 for a missing line item, 401 without the `score` scope, the answer for a user outside
 * the course, and a score sent by our own `AgsScoreClient`. What the mock assumes is in
 * tools/mock-platform/canvasLineItems.mjs and canvasScores.mjs. Runs only when asked (apps/server/live/README.md).
 *
 * Spec: LTI-005, LTI-012, LTI-013
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LTI_MEDIA_TYPE } from '../../../tools/mock-platform/mockPlatform.mjs';
import { AgsAccessTokens } from '../src/grades/AgsAccessTokens.js';
import { AgsScoreClient, scoresUrlOf } from '../src/grades/AgsScoreClient.js';
import { outcomeOfStatus } from '../src/grades/agsSendOutcome.js';
import { AGS_MEDIA_TYPES, AGS_SCOPES, AGS_TOKEN_SCOPE } from '../src/grades/agsVocabulary.js';
import { LINE_ITEM_TAG } from '../src/lti/deepLinking/deepLinkItems.js';
import { FORMATIVE_SUFFIX } from '../src/lti/deepLinking/formativeLabel.js';
import { openCanvasTarget, type CanvasTarget } from './canvasTarget.js';
import { accessToken, onApiOrigin, serviceRequest } from './canvasRequests.js';
import { livePlanOf, runsCanvas } from './liveConfig.js';

const plan = livePlanOf(process.env);
const hasTestStudent =
  plan.kind === 'mock' || (plan.kind === 'live' && plan.canvas?.studentSub !== undefined);
const LINE_ITEMS = 'the mock assumes this (tools/mock-platform/canvasLineItems.mjs)';
const SCORES = 'the mock assumes this (tools/mock-platform/canvasScores.mjs)';
const NOBODY = 'live-contract-not-enrolled';

/** A line item as AGS lists it. */
interface LineItem {
  readonly id: string;
  readonly label: string;
  readonly scoreMaximum: number;
  readonly resourceId?: string;
  readonly tag?: string;
}

/** LTI-012's score body, as `AgsScoreClient` sends it. */
const scoreBody = (userId: string, scoreGiven: number) => ({
  userId,
  scoreGiven,
  scoreMaximum: 100,
  activityProgress: 'Completed',
  gradingProgress: 'FullyGraded',
  timestamp: new Date().toISOString(),
});

describe.runIf(runsCanvas(plan))('LTI-012 AGS, as the mock Canvas assumes it', () => {
  let target: CanvasTarget;
  let token: string;
  let graded: LineItem[] = [];
  const postScore = (url: string, bearer: string, userId: string) =>
    serviceRequest(target, scoresUrlOf(url), bearer, {
      accept: 'application/json',
      post: { body: scoreBody(userId, 0), mediaType: AGS_MEDIA_TYPES.score },
    });
  const firstGraded = (): LineItem => {
    const [item] = graded;
    if (!item)
      throw new Error('no line item tagged hvl-interaktiv: do step C2 of docs/handoff/canvas-acceptance.md');
    // SECURITY: the id names its own host, and AgsScoreClient sends the tool's token there.
    onApiOrigin(target, item.id);
    return item;
  };

  beforeAll(async () => {
    target = await openCanvasTarget(plan);
    token = await accessToken(target, AGS_TOKEN_SCOPE);
    const listed = await serviceRequest(
      target,
      `${target.lineItemsUrl}?tag=${LINE_ITEM_TAG}&limit=100`,
      token,
      {
        accept: LTI_MEDIA_TYPE.lineItemContainer,
      },
    );
    if (Array.isArray(listed.json)) graded = listed.json as LineItem[];
  }, 120_000);
  afterAll(() => target?.close());

  it('[LTI-005] lists the line item a Deep Linking return made, with our maximum, resource ID and tag', async () => {
    // Act
    const listed = await serviceRequest(target, `${target.lineItemsUrl}?tag=${LINE_ITEM_TAG}`, token, {
      accept: LTI_MEDIA_TYPE.lineItemContainer,
    });
    // Assert: the container's media type, and every tagged item as src/lti/deepLinking/deepLinkItems.ts sent it
    expect(listed.status, LINE_ITEMS).toBe(200);
    expect(listed.mediaType, LINE_ITEMS).toBe(LTI_MEDIA_TYPE.lineItemContainer);
    expect(firstGraded()).toBeDefined();
    for (const item of graded) {
      expect(item, 'Canvas keeps the lineItem fields of an assignment_selection item').toMatchObject({
        scoreMaximum: 100,
        tag: LINE_ITEM_TAG,
        resourceId: expect.stringMatching(/\S/),
      });
    }
  });

  it('[LTI-013] labels the line item as AGS_LABEL_MODE says', () => {
    // Act
    const labels = graded.map((item) => item.label);
    // Assert: suffix mode ends every label with «(formativ)»; preserve mode keeps a plain, non-empty name
    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) {
      if (target.labelMode === 'suffix') expect(label, 'D-105 suffix').toMatch(/ \(formativ\)$/);
      else {
        expect(label.trim(), 'D-105 preserve: a name').not.toBe('');
        expect(label.trim().endsWith(FORMATIVE_SUFFIX), 'D-105 preserve: no suffix').toBe(false);
      }
    }
  });

  it('[LTI-012] reads a line item at its own URL, as the worker’s check of a 404 does', async () => {
    // Act
    const read = await serviceRequest(target, firstGraded().id, token, { accept: AGS_MEDIA_TYPES.lineItem });
    // Assert
    expect(read.status, LINE_ITEMS).toBe(200);
    expect(read.mediaType, LINE_ITEMS).toBe(AGS_MEDIA_TYPES.lineItem);
    expect(read.json, LINE_ITEMS).toMatchObject({ id: firstGraded().id });
  });

  it('[LTI-012] answers 404 for a missing line item, so the worker marks the job orphaned', async () => {
    // Arrange
    const missing = `${target.lineItemsUrl}/987654321`;
    const client = new AgsScoreClient(new AgsAccessTokens({ platforms: target.directory }));
    // Act
    const read = await serviceRequest(target, missing, token, { accept: AGS_MEDIA_TYPES.lineItem });
    const posted = await postScore(missing, token, NOBODY);
    const sent = await client.postScore({
      platformId: target.platform.id,
      lineItemUrl: missing,
      userId: NOBODY,
      scoreGiven: 0,
      timestamp: new Date(),
    });
    // Assert
    expect([read.status, posted.status], LINE_ITEMS).toEqual([404, 404]);
    expect(sent, 'src/grades/AgsScoreClient.ts').toEqual({ kind: 'orphaned' });
  });

  it('[LTI-012] answers 401 to a score without the score scope and to a bad token', async () => {
    // Arrange
    const readOnly = await accessToken(target, AGS_SCOPES.lineItemReadonly);
    // Act
    const withoutScope = await postScore(firstGraded().id, readOnly, NOBODY);
    const badToken = await postScore(firstGraded().id, 'not-a-token', NOBODY);
    // Assert: AgsScoreClient tries one new token after a 401 and then fails the job
    expect([withoutScope.status, badToken.status], SCORES).toEqual([401, 401]);
  });

  it('[LTI-012] refuses a score for a user outside the course with an answer the worker does not retry', async () => {
    // Act
    const answer = await postScore(firstGraded().id, token, NOBODY);
    // Assert
    expect(answer.status, SCORES).toBe(422);
    expect(outcomeOfStatus(answer.status, null, new Date()).kind).toBe('failed');
  });

  it.runIf(hasTestStudent)(
    '[LTI-012] accepts the test student’s score from the grade worker’s own client',
    async () => {
      // Arrange
      const client = new AgsScoreClient(new AgsAccessTokens({ platforms: target.directory }));
      const studentSub = target.studentSub as string;
      // Act
      const raw = await serviceRequest(target, scoresUrlOf(firstGraded().id), token, {
        accept: 'application/json',
        post: { body: scoreBody(studentSub, 50), mediaType: AGS_MEDIA_TYPES.score },
      });
      const sent = await client.postScore({
        platformId: target.platform.id,
        lineItemUrl: firstGraded().id,
        userId: studentSub,
        scoreGiven: 50,
        timestamp: new Date(),
      });
      // Assert: 200 with the result's URL, and D-104's outcome `sent`
      expect(raw.status, SCORES).toBe(200);
      expect(raw.json, SCORES).toMatchObject({ resultUrl: expect.any(String) });
      expect(sent).toEqual({ kind: 'sent' });
    },
  );
});
