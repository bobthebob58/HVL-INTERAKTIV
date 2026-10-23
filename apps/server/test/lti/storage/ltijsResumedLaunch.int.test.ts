/**
 * Integration tests for a resumed launch (`getLaunchContext(ltik)`) on our storage: ltijs rebuilds it from the
 * allowlisted claims alone, and it can still sign Deep Linking responses and post AGS scores with a cached token.
 *
 * Spec: LTI-002, DATA-002
 */
import { importSPKI, jwtVerify } from 'jose';
import { expect, it } from 'vitest';
import { describeWithServices } from '../../support/services.js';
import { useLtijsOnPrisma } from './ltijsStorageHarness.js';
import { LAUNCH_CONTENT_ID } from './ltiLaunchClaims.js';

const LTI = 'https://purl.imsglobal.org/spec/lti/claim/';
const DL = 'https://purl.imsglobal.org/spec/lti-dl/claim/';
const LINE_ITEM = 'https://canvas.example.test/api/lti/courses/1/line_items/7';

describeWithServices('[LTI-002] ltijs 7.0.7 resumed launches on PrismaLtiDatabaseManager', () => {
  const harness = useLtijsOnPrisma();

  it('[LTI-002] getLaunchContext(ltik) rebuilds what later requests read from the stored claims', async () => {
    // Arrange
    const { platform, input, context } = await harness.launchFromNewPlatform();
    // Act
    const resumed = await harness.driver().provider.getLaunchContext(context.ltik);
    // Assert: launch, user and platform, without personal data
    const { launch, user, platform: from, services } = resumed.idToken;
    expect(resumed.contextId).toBe(context.contextId);
    expect(launch.custom).toEqual({ contentId: LAUNCH_CONTENT_ID, hvl_placement: 'assignment_selection' });
    expect(launch).toMatchObject({ type: 'LtiDeepLinkingRequest', context: { id: 'course-1' } });
    expect(launch.presentation).toMatchObject({ locale: 'nn', documentTarget: 'iframe' });
    expect(user).toEqual(expect.objectContaining({ id: input.sub, name: undefined, email: undefined }));
    expect(from).toMatchObject({ id: platform.id, deploymentId: 'deployment-1', name: 'Canvas' });
    expect(from.contactEmail).toBeUndefined();
    expect(resumed.rawIdToken['https://www.instructure.com/placement']).toBe('assignment_selection');
    // Assert: the services are still available
    expect(services).toMatchObject({
      namesAndRoles: { available: true },
      assignmentAndGrades: { available: true, lineItemId: LINE_ITEM },
      deepLinking: { available: true, acceptMultiple: false, data: 'opaque-platform-data' },
    });
  });

  it('[LTI-002] a resumed launch signs a valid Deep Linking response from the stored settings', async () => {
    // Arrange
    const { platform, context } = await harness.launchFromNewPlatform();
    const resumed = await harness.driver().provider.getLaunchContext(context.ltik);
    const item = { type: 'ltiResourceLink', title: 'Quiz', custom: { contentId: LAUNCH_CONTENT_ID } };
    // Act
    const message = await resumed.deepLinking.createDeepLinkingMessage([item]);
    const verified = await jwtVerify(message, await importSPKI(platform.keys.public, 'RS256'), {
      issuer: platform.clientId,
      audience: platform.url,
    });
    // Assert
    expect(verified.protectedHeader.kid).toBe(platform.id);
    expect(verified.payload).toMatchObject({
      [`${LTI}deployment_id`]: 'deployment-1',
      [`${LTI}version`]: '1.3.0',
      [`${LTI}message_type`]: 'LtiDeepLinkingResponse',
      [`${DL}data`]: 'opaque-platform-data',
      [`${DL}content_items`]: [item],
    });
  });

  it('[LTI-002] a resumed launch posts a score for the stored sub and reuses the access token it cached', async () => {
    // Arrange
    const driver = harness.driver();
    const { platform, input, context } = await harness.launchFromNewPlatform();
    const resumed = await driver.provider.getLaunchContext(context.ltik);
    const score = {
      scoreGiven: 1,
      scoreMaximum: 1,
      activityProgress: 'Completed',
      gradingProgress: 'FullyGraded',
    };
    const before = driver.platformCalls.length;
    // Act
    await resumed.grading.submitScore(LINE_ITEM, score);
    await resumed.grading.submitScore(LINE_ITEM, score);
    // Assert
    const calls = driver.platformCalls.slice(before).map(({ url }) => url);
    expect(calls).toEqual([platform.accessTokenEndpoint, `${LINE_ITEM}/scores`, `${LINE_ITEM}/scores`]);
    expect(driver.platformCalls.at(-1)?.body).toMatchObject({ ...score, userId: input.sub });
    const where = { platformUrl: platform.url };
    expect(await harness.bed.db.ltiAccessToken.count({ where })).toBe(1);
  });
});
