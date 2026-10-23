/**
 * Integration tests for the guards of AUTH-005 linking (D-063): which platforms and Feide IDs may link at all, the
 * cases in which a Canvas claim must not reach someone's Feide account, and which account a link reaches while key
 * rings are mixed. The linker runs against the database directly, with the launch facts written out.
 *
 * Spec: AUTH-005, DATA-002
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { accountLinker, type LinkRequest } from '../../../src/auth/identity/accountLinking.js';
import { identitySource } from '../../../src/auth/identity/subjectSources.js';
import { createPrismaClient } from '../../../src/infra/prismaClient.js';
import { IdentityHasher } from '../../../src/security/keys/IdentityHasher.js';
import { parseKeyring } from '../../../src/security/keys/keyring.js';
import { randomKey } from '../../support/authEnv.js';
import { describeWithServices, serviceEnv, uniqueName } from '../../support/services.js';

const CUSTOM = 'https://purl.imsglobal.org/spec/lti/claim/custom';
const ISSUER = 'https://canvas.linkguard.example';

describeWithServices('[AUTH-005] linking guards', () => {
  const env = serviceEnv();
  const db = createPrismaClient(env.DATABASE_URL);
  const hasher = new IdentityHasher(env.IDENTITY_HASH_KEYS);
  const base = `https://${uniqueName('linkguard')}`;
  const users: string[] = [];
  const platforms: string[] = [];
  const platform = async (suffix: string) => {
    const url = `${base}-${suffix}.example`;
    const row = await db.ltiPlatform.create({
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
    });
    platforms.push(row.url);
    return row.id;
  };
  let platformId: string;
  beforeAll(async () => {
    platformId = await platform('a');
  });
  afterAll(async () => {
    await db.ltiPlatform.deleteMany({ where: { url: { in: platforms } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  });

  const link = (options: { linksFeide?: boolean; with?: IdentityHasher } = {}) =>
    accountLinker({
      db,
      hasher: options.with ?? hasher,
      linksFeide: () => options.linksFeide ?? true,
      allowedOrgs: ['hvl.no'],
    });
  const request = (feideId: string, subject = randomUUID(), onPlatform = platformId): LinkRequest => ({
    claims: { [CUSTOM]: { feide_login: feideId } },
    roles: ['author'],
    issuer: ISSUER,
    clientId: 'guard',
    subject,
    platformId: onPlatform,
  });
  const feideAccount = async (feideId: string, kind: 'staff' | 'learner' = 'staff', by = hasher) => {
    const { hash, keyId } = by.hash('identity-subject', identitySource({ kind: 'feide', feideId }));
    const user = await db.user.create({
      data: { kind, identities: { create: [{ provider: 'feide', subjectHash: hash, subjectKeyId: keyId }] } },
    });
    users.push(user.id);
    return user.id;
  };
  const ltiAccount = async (subject: string, by = hasher) => {
    const hashes = by.candidates(
      'identity-subject',
      identitySource({ kind: 'lti', issuer: ISSUER, subject }),
    );
    const row = await db.identity.findFirst({
      where: { provider: 'lti', subjectHash: { in: hashes.map((c) => c.hash) } },
    });
    return row?.userId;
  };

  it('[AUTH-005] links nothing from a platform not confirmed to send the Feide ID (`feideLinking` off)', async () => {
    const feideId = `${uniqueName('a')}@hvl.no`;
    await feideAccount(feideId);
    const launch = request(feideId);
    expect(await link({ linksFeide: false })(launch)).toBeUndefined();
    expect(await ltiAccount(launch.subject)).toBeUndefined();
  });

  it('[AUTH-005] links nothing for a Feide ID outside ALLOWED_FEIDE_ORGS', async () => {
    const feideId = `${uniqueName('b')}@uib.no`;
    await feideAccount(feideId);
    const launch = request(feideId);
    expect(await link()(launch)).toBeUndefined();
    expect(await ltiAccount(launch.subject)).toBeUndefined();
  });

  it('[AUTH-005] never creates or claims a Feide identity that no Feide login made (pre-claim, student TAs)', async () => {
    // Arrange: nobody has logged in with this Feide ID yet
    const feideId = `${uniqueName('c')}@hvl.no`;
    const launch = request(feideId);
    // Act
    const result = await link()(launch);
    // Assert
    const hashes = hasher.candidates('identity-subject', identitySource({ kind: 'feide', feideId }));
    const feide = await db.identity.findFirst({ where: { subjectHash: { in: hashes.map((c) => c.hash) } } });
    expect(result).toBeUndefined();
    expect(feide).toBeNull();
    expect(await ltiAccount(launch.subject)).toBeUndefined();
  });

  it('[AUTH-005] a learner’s Feide account is never joined, and the refusal is reported', async () => {
    const feideId = `${uniqueName('d')}@hvl.no`;
    await feideAccount(feideId, 'learner');
    const launch = request(feideId);
    expect(await link()(launch)).toEqual({ event: 'link.conflict', reason: 'learner-account' });
    expect(await ltiAccount(launch.subject)).toBeUndefined();
  });

  it('[AUTH-005] a second Canvas user of the same platform naming the same Feide ID is refused', async () => {
    // Arrange: the first Canvas user is already linked to the Feide account
    const feideId = `${uniqueName('e')}@hvl.no`;
    const account = await feideAccount(feideId);
    expect(await link()(request(feideId))).toEqual({ event: 'link.feide-lti', reason: 'link-joined' });
    const second = request(feideId);
    // Act
    const result = await link()(second);
    // Assert
    expect(result).toEqual({ event: 'link.conflict', reason: 'platform-identity-exists' });
    expect(await ltiAccount(second.subject)).toBeUndefined();
    expect(await db.identity.count({ where: { userId: account, provider: 'lti' } })).toBe(1);
  });

  it('[AUTH-005] a linked teacher launching again reports nothing, and an identity from another platform is no rival', async () => {
    // Arrange
    const feideId = `${uniqueName('f')}@hvl.no`;
    const account = await feideAccount(feideId);
    const first = request(feideId);
    await link()(first);
    const otherPlatform = request(feideId, randomUUID(), await platform('b'));
    // Act
    const again = await link()(first);
    const fromOther = await link()(otherPlatform);
    // Assert
    expect(again).toBeUndefined();
    expect(fromOther).toEqual({ event: 'link.feide-lti', reason: 'link-joined' });
    expect(await ltiAccount(otherPlatform.subject)).toBe(account);
  });

  it('[AUTH-005] with mixed key rings the link reaches the account a Feide login uses (the current-key row)', async () => {
    // Arrange: a node with only the old ring made a second account for the same Feide ID
    const oldKey = randomKey(31);
    const OLD = new IdentityHasher(parseKeyring(`old=${oldKey}`));
    const rotated = new IdentityHasher(parseKeyring(`new=${randomKey(32)},old=${oldKey}`));
    const feideId = `${uniqueName('g')}@hvl.no`;
    await feideAccount(feideId, 'staff', OLD);
    const loginAccount = await feideAccount(feideId, 'staff', rotated);
    const launch = request(feideId);
    // Act
    await link({ with: rotated })(launch);
    // Assert
    expect(await ltiAccount(launch.subject, rotated)).toBe(loginAccount);
  });
});
