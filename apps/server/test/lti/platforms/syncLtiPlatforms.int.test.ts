/**
 * Integration tests for syncing `LTI_PLATFORMS` at start-up: register, update, deactivate, replace deployments,
 * and a platform another server registered a moment earlier.
 *
 * Spec: LTI-001, LTI-002
 */
import type { Platform, PlatformRegistrationInput, PlatformUpdateInput, Provider } from 'ltijs';
import { afterAll, expect, it } from 'vitest';
import type { LtiPlatformConfig } from '../../../src/config/envParsers.js';
import { createPrismaClient } from '../../../src/infra/prismaClient.js';
import { syncLtiPlatforms } from '../../../src/lti/platforms/syncLtiPlatforms.js';
import { describeWithServices, serviceEnv, uniqueName } from '../../support/services.js';

type PlatformManager = Provider['platformManager'];

describeWithServices('[LTI-001] LTI platform sync', () => {
  const db = createPrismaClient(serviceEnv().DATABASE_URL);
  afterAll(async () => {
    // WHY: fixture platforms have no decryptable key; left behind, they would break `getPlatforms()` elsewhere.
    await db.ltiPlatform.deleteMany({ where: { url: { startsWith: 'https://test-sync-' } } });
    await db.$disconnect();
  });

  /** A platform manager on real LtiPlatform rows (keys are placeholders; ltijs generates real ones). */
  const manager = (scope: string, onRegister?: () => Promise<void>) => {
    const toPlatform = (row: { id: string; url: string; clientId: string; active: boolean }) =>
      ({ id: row.id, url: row.url, clientId: row.clientId, active: row.active }) as Platform;
    const fake = {
      getPlatformByUrlAndClientId: async (url: string, clientId: string) => {
        const row = await db.ltiPlatform.findUnique({ where: { url_clientId: { url, clientId } } });
        return row ? toPlatform(row) : undefined;
      },
      registerPlatform: async (input: PlatformRegistrationInput) => {
        await onRegister?.();
        const row = await db.ltiPlatform.create({
          data: {
            url: input.url,
            clientId: input.clientId,
            name: input.name,
            authenticationEndpoint: input.authenticationEndpoint,
            accessTokenEndpoint: input.accessTokenEndpoint,
            idTokenValidationMethod: input.idTokenValidation.method,
            idTokenValidationKey: input.idTokenValidation.key,
            publicKey: 'p',
            privateKeyEncrypted: Buffer.from([1]),
          },
        });
        return toPlatform(row);
      },
      updatePlatform: async (platform: Platform, update: PlatformUpdateInput) => {
        const row = await db.ltiPlatform.update({
          where: { id: platform.id },
          data: {
            name: update.name,
            authenticationEndpoint: update.authenticationEndpoint,
            active: update.active,
            idTokenValidationKey: update.idTokenValidation?.key,
          },
        });
        return toPlatform(row);
      },
      getPlatforms: async () =>
        (await db.ltiPlatform.findMany({ where: { url: { contains: scope } } })).map(toPlatform),
      deactivatePlatform: async (platform: Platform) =>
        toPlatform(await db.ltiPlatform.update({ where: { id: platform.id }, data: { active: false } })),
    };
    return fake as unknown as PlatformManager;
  };
  const config = (scope: string, clientId: string, deployments: string[]): LtiPlatformConfig => ({
    name: `Canvas ${clientId}`,
    issuer: `https://${scope}.example`,
    clientId,
    authEndpoint: `https://${scope}.example/auth`,
    tokenEndpoint: `https://${scope}.example/token`,
    jwksUrl: `https://${scope}.example/jwks`,
    deployments,
    feideLinking: false,
  });
  const deploymentsOf = async (url: string, clientId: string) => {
    const platform = await db.ltiPlatform.findUniqueOrThrow({
      where: { url_clientId: { url, clientId } },
      include: { deployments: true },
    });
    return { active: platform.active, deployments: platform.deployments.map((d) => d.deploymentId).sort() };
  };

  it('[LTI-001] registers new platforms, then updates them and replaces their deployments', async () => {
    // Arrange
    const scope = uniqueName('sync');
    const platforms = manager(scope);
    // Act
    const first = await syncLtiPlatforms([config(scope, 'a', ['1:x', '1:y'])], { platforms, db });
    const second = await syncLtiPlatforms([config(scope, 'a', ['1:y', '1:z'])], { platforms, db });
    // Assert
    expect(first).toEqual({ registered: 1, updated: 0, deactivated: 0 });
    expect(second).toEqual({ registered: 0, updated: 1, deactivated: 0 });
    expect(await deploymentsOf(`https://${scope}.example`, 'a')).toEqual({
      active: true,
      deployments: ['1:y', '1:z'],
    });
  });

  it('[LTI-001] deactivates a platform that is no longer configured and removes its deployments', async () => {
    // Arrange
    const scope = uniqueName('sync');
    const platforms = manager(scope);
    await syncLtiPlatforms([config(scope, 'a', ['1:x']), config(scope, 'b', ['2:x'])], { platforms, db });
    // Act
    const summary = await syncLtiPlatforms([config(scope, 'a', ['1:x'])], { platforms, db });
    // Assert
    expect(summary.deactivated).toBe(1);
    expect(await deploymentsOf(`https://${scope}.example`, 'b')).toEqual({ active: false, deployments: [] });
    expect((await syncLtiPlatforms([config(scope, 'b', ['2:x'])], { platforms, db })).registered).toBe(0);
    expect(await deploymentsOf(`https://${scope}.example`, 'b')).toEqual({
      active: true,
      deployments: ['2:x'],
    });
  });

  it('[LTI-002] uses the platform another server registered between the lookup and the insert', async () => {
    // Arrange: the "other server" inserts the row just before our register call.
    const scope = uniqueName('sync');
    const other = manager(scope);
    const platforms = manager(scope, async () => {
      await other.registerPlatform({
        url: `https://${scope}.example`,
        clientId: 'a',
        name: 'x',
        authenticationEndpoint: 'https://a',
        accessTokenEndpoint: 'https://t',
        idTokenValidation: { method: 'JWK_SET' as never, key: 'https://k' },
      });
    });
    // Act
    await syncLtiPlatforms([config(scope, 'a', ['1:x'])], { platforms, db });
    // Assert
    expect(await db.ltiPlatform.count({ where: { url: `https://${scope}.example` } })).toBe(1);
    expect(await deploymentsOf(`https://${scope}.example`, 'a')).toEqual({
      active: true,
      deployments: ['1:x'],
    });
  });
});
