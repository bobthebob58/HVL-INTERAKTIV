/**
 * Integration tests for recording Canvas placements: create, update, per-course rows and concurrent launches, and the
 * line item URL kept only when its origin is Canvas's or the platform's own (D-104's amendment of 2026-11-04).
 *
 * Spec: LTI-006, LTI-007, LTI-012
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createPrismaClient } from '../../../src/infra/prismaClient.js';
import { LtiPlacementRecorder } from '../../../src/lti/placements/LtiPlacementRecorder.js';
import { capturedLogger } from '../../support/capturedLogger.js';
import { describeWithServices, serviceEnv, uniqueName } from '../../support/services.js';

/** `CANVAS_ORIGINS` of these tests: the institution's Canvas, which serves AGS. */
const CANVAS = 'https://hvl.canvas.example';

describeWithServices('[LTI-006] Canvas placements', () => {
  const db = createPrismaClient(serviceEnv().DATABASE_URL);
  const { logger, lines } = capturedLogger('debug');
  const recorder = new LtiPlacementRecorder(db, { origins: [CANVAS], requireHttps: true, logger });
  let platformId: string;
  let contentIds: string[];

  beforeAll(async () => {
    const owner = await db.user.create({ data: { kind: 'staff' } });
    const content = (title: string) =>
      db.h5PContent.create({
        data: {
          mainLibrary: 'H5P.MultiChoice',
          title,
          params: {},
          metadata: {},
          ownerUserId: owner.id,
          status: 'published',
        },
      });
    contentIds = [(await content('A')).id, (await content('B')).id];
    platformId = (
      await db.ltiPlatform.create({
        data: {
          url: `https://${uniqueName('canvas')}.example`,
          clientId: '1',
          name: 'Canvas',
          authenticationEndpoint: 'https://sso.example/auth',
          accessTokenEndpoint: 'https://sso.example/token',
          idTokenValidationMethod: 'JWK_SET',
          idTokenValidationKey: 'https://sso.example/jwks',
          publicKey: 'p',
          privateKeyEncrypted: Buffer.from([1]),
        },
      })
    ).id;
  });
  afterAll(async () => {
    // WHY: fixture platforms have no decryptable key; left behind, they would break `getPlatforms()` elsewhere.
    await db.ltiPlatform.deleteMany({ where: { url: { startsWith: 'https://test-canvas-' } } });
    await db.$disconnect();
  });

  it('[LTI-006] records a placement and updates it at the next launch of the same link', async () => {
    // Arrange
    const link = { platformId, contextId: 'course-1', resourceLinkId: uniqueName('link') };
    // Act
    const first = await recorder.record({ ...link, contentId: contentIds[0] ?? '' });
    const second = await recorder.record({
      ...link,
      contentId: contentIds[1] ?? '',
      lineItemUrl: `${CANVAS}/api/lti/courses/1/line_items/1`,
    });
    // Assert
    expect(second).toBe(first);
    const row = await db.ltiPlacement.findUniqueOrThrow({ where: { id: first } });
    expect(row).toMatchObject({
      contentId: contentIds[1],
      lineItemUrl: `${CANVAS}/api/lti/courses/1/line_items/1`,
    });
  });

  it.each([
    ['another host', 'https://internal.example/api/lti/courses/1/line_items/1', 'origin'],
    ['a cloud metadata address', 'http://169.254.169.254/latest/meta-data/', 'scheme'],
    ['a user name before the host', `https://canvas@internal.example/li/1`, 'credentials'],
    ['plain http to Canvas in production', `http://hvl.canvas.example/li/1`, 'scheme'],
    ['no URL at all', 'line item 1', 'invalid'],
  ])(
    '[LTI-012] stores no line item for %s, and logs the reason and origin only',
    async (_name, url, reason) => {
      // Arrange: the link was graded before, with an allowed line item
      const link = { platformId, contextId: 'course-3', resourceLinkId: uniqueName('link') };
      const contentId = contentIds[0] ?? '';
      await recorder.record({ ...link, contentId, lineItemUrl: `${CANVAS}/li/2` });
      const logged = lines.length;
      // Act
      const id = await recorder.record({ ...link, contentId, lineItemUrl: url });
      // Assert: SECURITY: the worker can never be pointed at it; the link is no longer graded
      expect((await db.ltiPlacement.findUniqueOrThrow({ where: { id } })).lineItemUrl).toBeNull();
      const record = lines.slice(logged).join('\n');
      expect(record).toContain('lti.placement.line-item-refused');
      expect(record).toContain(`"reason":"${reason}"`);
      expect(record).not.toContain('/li/1');
      expect(record).not.toContain('meta-data');
    },
  );

  it('[LTI-012] keeps a line item on one of the platform’s own origins, with no CANVAS_ORIGINS given', async () => {
    // Arrange: a self-hosted Canvas serves AGS on its issuer's host
    const issuer = (await db.ltiPlatform.findUniqueOrThrow({ where: { id: platformId } })).url;
    const bare = new LtiPlacementRecorder(db);
    const link = { platformId, contextId: 'course-4', resourceLinkId: uniqueName('link') };
    // Act
    const own = await bare.record({ ...link, contentId: contentIds[0] ?? '', lineItemUrl: `${issuer}/li/9` });
    const other = await bare.record({
      ...link,
      resourceLinkId: uniqueName('link'),
      contentId: contentIds[0] ?? '',
      lineItemUrl: `${CANVAS}/li/9`,
    });
    // Assert
    expect((await db.ltiPlacement.findUniqueOrThrow({ where: { id: own } })).lineItemUrl).toBe(
      `${issuer}/li/9`,
    );
    expect((await db.ltiPlacement.findUniqueOrThrow({ where: { id: other } })).lineItemUrl).toBeNull();
  });

  it('[LTI-007] keeps a separate placement per course for the same activity (course copy)', async () => {
    // Arrange
    const resourceLinkId = uniqueName('link');
    // Act
    const a = await recorder.record({
      platformId,
      contextId: 'course-a',
      resourceLinkId,
      contentId: contentIds[0] ?? '',
    });
    const b = await recorder.record({
      platformId,
      contextId: 'course-b',
      resourceLinkId,
      contentId: contentIds[0] ?? '',
    });
    // Assert
    expect(a).not.toBe(b);
  });

  it('[LTI-006] creates one placement when the first launches of a link arrive together', async () => {
    const link = {
      platformId,
      contextId: 'course-2',
      resourceLinkId: uniqueName('link'),
      contentId: contentIds[0] ?? '',
    };
    const ids = await Promise.all(Array.from({ length: 6 }, () => recorder.record(link)));
    expect(new Set(ids).size).toBe(1);
  });
});
