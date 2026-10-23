/**
 * Integration tests for ltijs 7 itself on our storage: platform registration with usable keys, a full launch that
 * stores only allowlisted claims, and refusals for a foreign deployment and a replayed nonce.
 *
 * Spec: LTI-002, LTI-001, DATA-002
 */
import { sign, verify } from 'node:crypto';
import { expect, it } from 'vitest';
import { isAuthError } from '../../../src/http/authErrors.js';
import { describeWithServices } from '../../support/services.js';
import { useLtijsOnPrisma } from './ltijsStorageHarness.js';
import { canvasLaunchClaims, PERSONAL_VALUES, storedLaunchClaims } from './ltiLaunchClaims.js';

const PROBE = Buffer.from('signed by the tool key that ltijs generated');

describeWithServices('[LTI-002] ltijs 7.0.7 launches on PrismaLtiDatabaseManager', () => {
  const harness = useLtijsOnPrisma();
  const { bed } = harness;

  it('[LTI-002] a platform registered through ltijs comes back with a key pair that signs and verifies', async () => {
    // Arrange
    const { provider } = harness.driver();
    const registered = await harness.driver().registerPlatform(bed.uniqueUrl());
    // Act
    const read = await provider.platformManager.getPlatformByUrlAndClientId(registered.url, 'client-a');
    const byId = await provider.platformManager.getPlatformById(registered.id);
    const signature = sign('sha256', PROBE, read!.keys.private);
    // Assert
    expect(read?.keys).toEqual(registered.keys);
    expect(byId).toEqual(read);
    expect(verify('sha256', PROBE, read!.keys.public, signature)).toBe(true);
    const row = await bed.db.ltiPlatform.findUniqueOrThrow({ where: { id: registered.id } });
    expect(Buffer.from(row.privateKeyEncrypted).includes('PRIVATE KEY')).toBe(false);
  });

  it('[DATA-002] a launch hands the handler every claim but stores only the allowlisted ones', async () => {
    // Act
    const { input, launch, context } = await harness.launchFromNewPlatform();
    const row = await bed.db.ltiIdToken.findUniqueOrThrow({ where: { id: context.contextId } });
    // Assert
    expect(launch.redirect).toBe(`/lti/deeplink?ltik=${context.ltik}`);
    expect(context.idToken.user).toMatchObject({
      id: input.sub,
      name: 'Kari Nordmann',
      email: 'kari@example.test',
    });
    expect(row.claims).toEqual({
      ...storedLaunchClaims(input),
      iat: expect.any(Number),
      exp: expect.any(Number),
    });
    expect(PERSONAL_VALUES.filter((value) => JSON.stringify(row.claims).includes(value))).toEqual([]);
  });

  it('[LTI-001] a launch from a deployment that is not configured gets no ltik, no handler and no record', async () => {
    // Arrange
    const driver = harness.driver();
    const platform = await harness.platformWithDeployment();
    const input = {
      iss: platform.url,
      clientId: platform.clientId,
      platformId: platform.id,
      deploymentId: 'other',
    };
    const handledBefore = driver.handled.length;
    // Act
    const refusal = await driver.launch(canvasLaunchClaims(input)).catch((error: unknown) => error);
    // Assert
    expect(isAuthError(refusal, 'hvl:deployment-not-allowed')).toBe(true);
    expect(driver.handled).toHaveLength(handledBefore);
    const fromPlatform = { claims: { path: ['iss'], equals: platform.url } };
    expect(await bed.db.ltiIdToken.count({ where: fromPlatform })).toBe(0);
  });

  it('[LTI-001] a replayed launch is refused because its nonce was consumed', async () => {
    // Arrange
    const { launch } = await harness.launchFromNewPlatform();
    const handledBefore = harness.driver().handled.length;
    // Act
    const refusal = await launch.replay().catch((error: unknown) => error);
    // Assert
    expect(refusal).toMatchObject({ name: 'InvalidNonceError', message: 'INVALID_NONCE_RECEIVED' });
    expect(harness.driver().handled).toHaveLength(handledBefore);
  });
});
