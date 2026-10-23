/**
 * Integration tests for the guards of AUTH-005 linking (D-063): which platforms and Feide IDs may link at all, and
 * the cases in which a Canvas claim must not reach someone's Feide account. The linker runs against the database
 * directly, with the launch facts written out.
 *
 * Spec: AUTH-005, DATA-002
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { AuthAuditRecorder } from '../../../src/auth/audit/AuthAuditRecorder.js';
import { accountLinker, type LinkRequest } from '../../../src/auth/identity/accountLinking.js';
import { identitySource } from '../../../src/auth/identity/subjectSources.js';
import { createPrismaClient } from '../../../src/infra/prismaClient.js';
import { createLogger } from '../../../src/logging/logger.js';
import { IdentityHasher } from '../../../src/security/keys/IdentityHasher.js';
import { describeWithServices, serviceEnv, uniqueName } from '../../support/services.js';

const CUSTOM = 'https://purl.imsglobal.org/spec/lti/claim/custom';
const ISSUER = 'https://canvas.linkguard.example';

describeWithServices('[AUTH-005] linking guards', () => {
  const env = serviceEnv();
  const db = createPrismaClient(env.DATABASE_URL);
  const hasher = new IdentityHasher(env.IDENTITY_HASH_KEYS);
  const audit = new AuthAuditRecorder({ db, hasher, logger: createLogger({ level: 'silent' }) });
  const url = `https://${uniqueName('linkguard')}.example`;
  const users: string[] = [];
  let platformId: string;
  beforeAll(async () => {
    platformId = (
      await db.ltiPlatform.create({
        data: {
          url,
          clientId: 'guard',
          name: 'Guard',
          authenticationEndpoint: `${url}/auth`,
          accessTokenEndpoint: `${url}/token`,
          idTokenValidationMethod: 'JWK_SET',
          idTokenValidationKey: `${url}/jwks`,
          publicKey: 'p',
          privateKeyEncrypted: Buffer.from([1]),
        },
      })
    ).id;
  });
  afterAll(async () => {
    await db.ltiPlatform.deleteMany({ where: { url } });
    await db.authAuditEvent.deleteMany({ where: { actorUserId: { in: users } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  });

  const link = (options: { linksFeide?: boolean } = {}) =>
    accountLinker({
      db,
      hasher,
      audit,
      linksFeide: () => options.linksFeide ?? true,
      allowedOrgs: ['hvl.no'],
    });
  const request = (feideId: string, subject = randomUUID()): LinkRequest => ({
    claims: { [CUSTOM]: { feide_login: feideId } },
    roles: ['author'],
    issuer: ISSUER,
    clientId: 'guard',
    subject,
    platformId,
  });
  const hashOf = (source: string) => hasher.candidates('identity-subject', source).map((c) => c.hash);
  const feideAccount = async (feideId: string, kind: 'staff' | 'learner' = 'staff') => {
    const { hash, keyId } = hasher.hash('identity-subject', identitySource({ kind: 'feide', feideId }));
    const user = await db.user.create({
      data: { kind, identities: { create: [{ provider: 'feide', subjectHash: hash, subjectKeyId: keyId }] } },
    });
    users.push(user.id);
    return user.id;
  };
  const ltiIdentity = (subject: string) =>
    db.identity.findFirst({
      where: {
        provider: 'lti',
        subjectHash: { in: hashOf(identitySource({ kind: 'lti', issuer: ISSUER, subject })) },
      },
    });
  const audited = (reason: string, userId: string) =>
    db.authAuditEvent.count({ where: { event: 'link.conflict', reason, actorUserId: userId } });

  it('[AUTH-005] links nothing from a platform not confirmed to send the Feide ID (`feideLinking` off)', async () => {
    const feideId = `${uniqueName('a')}@hvl.no`;
    await feideAccount(feideId);
    const launch = request(feideId);
    await link({ linksFeide: false })(launch);
    expect(await ltiIdentity(launch.subject)).toBeNull();
  });

  it('[AUTH-005] links nothing for a Feide ID outside ALLOWED_FEIDE_ORGS', async () => {
    const feideId = `${uniqueName('b')}@uib.no`;
    await feideAccount(feideId);
    const launch = request(feideId);
    await link()(launch);
    expect(await ltiIdentity(launch.subject)).toBeNull();
  });

  it('[AUTH-005] never creates or claims a Feide identity that no Feide login made (pre-claim, student TAs)', async () => {
    // Arrange: nobody has logged in with this Feide ID yet
    const feideId = `${uniqueName('c')}@hvl.no`;
    const launch = request(feideId);
    // Act
    await link()(launch);
    // Assert
    const feide = await db.identity.findFirst({
      where: { provider: 'feide', subjectHash: { in: hashOf(identitySource({ kind: 'feide', feideId })) } },
    });
    expect(feide).toBeNull();
    expect(await ltiIdentity(launch.subject)).toBeNull();
  });

  it('[AUTH-005] a learner’s Feide account is never joined; the refusal is audited', async () => {
    const feideId = `${uniqueName('d')}@hvl.no`;
    await feideAccount(feideId, 'learner');
    const launch = request(feideId);
    const started = new Date(Date.now() - 1000);
    await link()(launch);
    expect(await ltiIdentity(launch.subject)).toBeNull();
    const refusals = await db.authAuditEvent.count({
      where: { event: 'link.conflict', reason: 'learner-account', at: { gte: started } },
    });
    expect(refusals).toBe(1);
  });

  it('[AUTH-005] a second Canvas user of the same platform naming the same Feide ID is refused and audited', async () => {
    // Arrange: the first Canvas user is already linked to the Feide account
    const feideId = `${uniqueName('e')}@hvl.no`;
    const account = await feideAccount(feideId);
    await link()(request(feideId));
    const second = request(feideId);
    // Act
    await link()(second);
    // Assert
    expect(await ltiIdentity(second.subject)).toBeNull();
    expect(await audited('platform-identity-exists', account)).toBe(1);
    expect(await db.identity.count({ where: { userId: account, provider: 'lti' } })).toBe(1);
  });
});
