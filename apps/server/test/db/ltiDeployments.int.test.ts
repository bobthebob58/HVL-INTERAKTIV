/**
 * Integration tests for the Session 3 schema: LTI deployments per platform (D-051) and the key IDs stored next
 * to identity hashes (D-055).
 *
 * Spec: LTI-001, DATA-002
 */
import { afterAll, expect, it } from 'vitest';
import { createPrismaClient } from '../../src/infra/prismaClient.js';
import { describeWithServices, serviceEnv, uniqueName } from '../support/services.js';

describeWithServices('[LTI-001] LTI deployments and identity key IDs in the database', () => {
  const db = createPrismaClient(serviceEnv().DATABASE_URL);
  afterAll(async () => {
    // WHY: fixture platforms have no decryptable key; left behind, they would break `getPlatforms()` elsewhere.
    await db.ltiPlatform.deleteMany({ where: { url: { startsWith: 'https://test-canvas-' } } });
    await db.$disconnect();
  });

  const platform = () =>
    db.ltiPlatform.create({
      data: {
        url: `https://${uniqueName('canvas')}.example`,
        clientId: '1',
        name: 'Test Canvas',
        authenticationEndpoint: 'https://sso.example/auth',
        accessTokenEndpoint: 'https://sso.example/token',
        idTokenValidationMethod: 'JWK_SET',
        idTokenValidationKey: 'https://sso.example/jwks',
        publicKey: 'public',
        privateKeyEncrypted: Buffer.from([1]),
      },
    });

  it('[LTI-001] keeps one row per deployment of a platform, and deletes them with the platform', async () => {
    // Arrange
    const { id } = await platform();
    await db.ltiDeployment.create({ data: { platformId: id, deploymentId: '1:abc' } });
    // Act and assert: the same deployment twice is refused; another platform may reuse the ID.
    await expect(
      db.ltiDeployment.create({ data: { platformId: id, deploymentId: '1:abc' } }),
    ).rejects.toThrow();
    const other = await platform();
    await db.ltiDeployment.create({ data: { platformId: other.id, deploymentId: '1:abc' } });
    // Act and assert: deleting a platform removes its deployments.
    await db.ltiPlatform.delete({ where: { id } });
    expect(await db.ltiDeployment.count({ where: { platformId: id } })).toBe(0);
    await db.ltiPlatform.delete({ where: { id: other.id } });
  });

  it('[DATA-002] stores which identity key made a subject hash and an IP hash', async () => {
    // Arrange
    const user = await db.user.create({ data: { kind: 'learner' } });
    // Act
    const identity = await db.identity.create({
      data: { userId: user.id, provider: 'feide', subjectHash: uniqueName('hash'), subjectKeyId: 'k1' },
    });
    const event = await db.authAuditEvent.create({
      data: { event: 'login.feide', reason: null, ipHash: 'h', ipKeyId: 'k1', actorUserId: user.id },
    });
    // Assert
    expect(identity.subjectKeyId).toBe('k1');
    expect(event.ipKeyId).toBe('k1');
    await db.authAuditEvent.delete({ where: { id: event.id } });
    await db.user.delete({ where: { id: user.id } });
    expect(await db.identity.count({ where: { id: identity.id } })).toBe(0);
  });
});
