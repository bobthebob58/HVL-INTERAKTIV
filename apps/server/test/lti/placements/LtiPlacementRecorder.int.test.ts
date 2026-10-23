/**
 * Integration tests for recording Canvas placements: create, update, per-course rows and concurrent launches.
 *
 * Spec: LTI-006, LTI-007
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createPrismaClient } from '../../../src/infra/prismaClient.js';
import { LtiPlacementRecorder } from '../../../src/lti/placements/LtiPlacementRecorder.js';
import { describeWithServices, serviceEnv, uniqueName } from '../../support/services.js';

describeWithServices('[LTI-006] Canvas placements', () => {
  const db = createPrismaClient(serviceEnv().DATABASE_URL);
  const recorder = new LtiPlacementRecorder(db);
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
      lineItemUrl: 'https://c/li/1',
    });
    // Assert
    expect(second).toBe(first);
    const row = await db.ltiPlacement.findUniqueOrThrow({ where: { id: first } });
    expect(row).toMatchObject({ contentId: contentIds[1], lineItemUrl: 'https://c/li/1' });
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
