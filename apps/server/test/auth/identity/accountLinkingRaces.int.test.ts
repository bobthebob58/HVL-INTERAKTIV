/**
 * Integration tests for AUTH-005 linking under concurrency (D-063): two Canvas users claiming one Feide account at
 * the same moment, and one teacher whose launch arrives twice at once (a double click). The linker runs against
 * the database directly, with the launch facts written out.
 *
 * Spec: AUTH-005, DATA-002
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createPrismaClient } from '../../../src/infra/prismaClient.js';
import { IdentityHasher } from '../../../src/security/keys/IdentityHasher.js';
import { linkingFixture } from '../../support/linkingFixture.js';
import { describeWithServices, serviceEnv, uniqueName } from '../../support/services.js';

describeWithServices('[AUTH-005] linking races', () => {
  const db = createPrismaClient(serviceEnv().DATABASE_URL);
  const fx = linkingFixture(db, new IdentityHasher(serviceEnv().IDENTITY_HASH_KEYS));
  let platformId: string;
  beforeAll(async () => {
    platformId = await fx.platform('race');
  });
  afterAll(async () => {
    await fx.cleanUp();
    await db.$disconnect();
  });

  it('[AUTH-005] two Canvas users claiming one Feide account at once: one is linked, the other refused', async () => {
    // Arrange
    const feideId = `${uniqueName('race-a')}@hvl.no`;
    const account = await fx.feideAccount(feideId);
    const [first, second] = [fx.request(feideId, platformId), fx.request(feideId, platformId)];
    // Act
    const outcomes = await Promise.all([fx.link()(first), fx.link()(second)]);
    // Assert
    expect(outcomes.map((o) => o?.reason).sort()).toEqual(['link-joined', 'platform-identity-exists']);
    expect(await db.identity.count({ where: { userId: account, provider: 'lti' } })).toBe(1);
  });

  it('[AUTH-005] the same teacher launching twice at once is linked once and never reported as a conflict', async () => {
    // Arrange
    const feideId = `${uniqueName('race-b')}@hvl.no`;
    const account = await fx.feideAccount(feideId);
    const launch = fx.request(feideId, platformId);
    // Act
    const outcomes = await Promise.all([fx.link()(launch), fx.link()(launch)]);
    // Assert
    expect(outcomes.filter((o) => o !== undefined)).toEqual([
      { event: 'link.feide-lti', reason: 'link-joined' },
    ]);
    expect(await fx.ltiAccount(launch.subject)).toBe(account);
    expect(await db.identity.count({ where: { userId: account, provider: 'lti' } })).toBe(1);
  });
});
