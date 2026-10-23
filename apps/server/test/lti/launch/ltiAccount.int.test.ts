/**
 * Integration tests for LTI accounts: created at the launch, found by later requests, with the yearly pseudonym.
 *
 * Spec: LTI-001, DATA-002
 */
import { afterAll, expect, it } from 'vitest';
import { AccountResolver } from '../../../src/auth/identity/AccountResolver.js';
import { createPrismaClient } from '../../../src/infra/prismaClient.js';
import { LtiAccounts } from '../../../src/lti/launch/ltiAccount.js';
import { deriveLearnerKey } from '../../../src/privacy/deriveLearnerKey.js';
import { IdentityHasher } from '../../../src/security/keys/IdentityHasher.js';
import { describeWithServices, serviceEnv, uniqueName } from '../../support/services.js';

describeWithServices('[LTI-001] LTI accounts', () => {
  const env = serviceEnv();
  const db = createPrismaClient(env.DATABASE_URL);
  const accounts = new AccountResolver({ db, hasher: new IdentityHasher(env.IDENTITY_HASH_KEYS) });
  const autumn = () => new Date('2026-10-23T10:00:00Z');
  const lti = new LtiAccounts({ accounts, secrets: env.PSEUDONYM_SECRETS, now: autumn });
  afterAll(async () => {
    // WHY: fixture platforms have no decryptable key; left behind, they would break `getPlatforms()` elsewhere.
    await db.ltiPlatform.deleteMany({ where: { url: { startsWith: 'https://test-c-' } } });
    await db.$disconnect();
  });
  /** A platform row of this file's own, so every test also runs on its own (`-t`). */
  const fixturePlatform = () =>
    db.ltiPlatform.create({
      data: {
        url: `https://${uniqueName('c')}.example`,
        clientId: '1',
        name: 'C',
        authenticationEndpoint: 'https://a',
        accessTokenEndpoint: 'https://t',
        idTokenValidationMethod: 'JWK_SET',
        idTokenValidationKey: 'https://k',
        publicKey: 'p',
        privateKeyEncrypted: Buffer.from([1]),
      },
    });

  it('[LTI-001] creates the account at the launch and finds the same one for a resumed request', async () => {
    // Arrange
    const identity = {
      issuer: 'https://canvas.example',
      subject: uniqueName('sub'),
      platformId: crypto.randomUUID(),
      roles: ['learner'] as const,
    };
    const platform = await fixturePlatform();
    const launch = { ...identity, platformId: platform.id };
    // Act
    const atLaunch = await lti.atLaunch(launch);
    const resumed = await lti.forRequest(launch);
    // Assert
    expect(resumed).toEqual(atLaunch);
    const expectedKey = deriveLearnerKey(
      { kind: 'lti', issuer: identity.issuer, subject: identity.subject },
      env.PSEUDONYM_SECRETS,
      autumn(),
    );
    expect(atLaunch.learnerKey).toBe(expectedKey);
    const user = await db.user.findUniqueOrThrow({
      where: { id: atLaunch.userId },
      include: { identities: true },
    });
    expect(user).toMatchObject({ kind: 'learner', displayName: null, email: null });
    expect(user.identities[0]).toMatchObject({ provider: 'lti', platformId: platform.id });
    expect(JSON.stringify(user)).not.toContain(identity.subject);
  });

  it('[DATA-002] a resumed request for an unknown person finds nothing and creates nothing', async () => {
    const identity = {
      issuer: 'https://canvas.example',
      subject: uniqueName('sub'),
      platformId: crypto.randomUUID(),
      roles: ['learner'] as const,
    };
    const before = await db.identity.count();
    expect(await lti.forRequest(identity)).toBeUndefined();
    expect(await db.identity.count()).toBe(before);
  });

  it('[LTI-004] an author launch makes a staff account, never with a profile', async () => {
    // Arrange
    const identity = {
      issuer: 'https://canvas.example',
      subject: uniqueName('sub'),
      platformId: crypto.randomUUID(),
      roles: ['author'] as const,
    };
    const platform = await fixturePlatform();
    // Act
    const { userId } = await lti.atLaunch({ ...identity, platformId: platform.id });
    // Assert
    expect(await db.user.findUniqueOrThrow({ where: { id: userId } })).toMatchObject({
      kind: 'staff',
      displayName: null,
    });
  });
});
