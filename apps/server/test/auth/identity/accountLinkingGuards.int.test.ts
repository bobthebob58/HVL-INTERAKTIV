/**
 * Integration tests for the guards of AUTH-005 linking (D-063): which platforms and Feide IDs may link at all, the
 * cases in which a Canvas claim must not reach someone's Feide account, and which account a link reaches while key
 * rings are mixed. The linker runs against the database directly, with the launch facts written out.
 *
 * Spec: AUTH-005, DATA-002
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { identitySource } from '../../../src/auth/identity/subjectSources.js';
import { createPrismaClient } from '../../../src/infra/prismaClient.js';
import { IdentityHasher } from '../../../src/security/keys/IdentityHasher.js';
import { parseKeyring } from '../../../src/security/keys/keyring.js';
import { randomKey } from '../../support/authEnv.js';
import { linkingFixture } from '../../support/linkingFixture.js';
import { describeWithServices, serviceEnv, uniqueName } from '../../support/services.js';

describeWithServices('[AUTH-005] linking guards', () => {
  const db = createPrismaClient(serviceEnv().DATABASE_URL);
  const hasher = new IdentityHasher(serviceEnv().IDENTITY_HASH_KEYS);
  const fx = linkingFixture(db, hasher);
  let platformId: string;
  beforeAll(async () => {
    platformId = await fx.platform('a');
  });
  afterAll(async () => {
    await fx.cleanUp();
    await db.$disconnect();
  });
  const request = (feideId: string) => fx.request(feideId, platformId);

  it('[AUTH-005] links nothing from a platform not confirmed to send the Feide ID (`feideLinking` off)', async () => {
    const feideId = `${uniqueName('a')}@hvl.no`;
    await fx.feideAccount(feideId);
    const launch = request(feideId);
    expect(await fx.link({ linksFeide: false })(launch)).toBeUndefined();
    expect(await fx.ltiAccount(launch.subject)).toBeUndefined();
  });

  it('[AUTH-005] links nothing for a Feide ID outside ALLOWED_FEIDE_ORGS', async () => {
    const feideId = `${uniqueName('b')}@uib.no`;
    await fx.feideAccount(feideId);
    const launch = request(feideId);
    expect(await fx.link()(launch)).toBeUndefined();
    expect(await fx.ltiAccount(launch.subject)).toBeUndefined();
  });

  it('[AUTH-005] never creates or claims a Feide identity that no Feide login made (pre-claim, student TAs)', async () => {
    // Arrange: nobody has logged in with this Feide ID yet
    const feideId = `${uniqueName('c')}@hvl.no`;
    const launch = request(feideId);
    // Act
    const result = await fx.link()(launch);
    // Assert
    const hashes = hasher.candidates('identity-subject', identitySource({ kind: 'feide', feideId }));
    const feide = await db.identity.findFirst({ where: { subjectHash: { in: hashes.map((c) => c.hash) } } });
    expect(result).toBeUndefined();
    expect(feide).toBeNull();
    expect(await fx.ltiAccount(launch.subject)).toBeUndefined();
  });

  it('[AUTH-005] a learner’s Feide account is never joined, and the refusal is reported', async () => {
    const feideId = `${uniqueName('d')}@hvl.no`;
    await fx.feideAccount(feideId, 'learner');
    const launch = request(feideId);
    expect(await fx.link()(launch)).toEqual({ event: 'link.conflict', reason: 'learner-account' });
    expect(await fx.ltiAccount(launch.subject)).toBeUndefined();
  });

  it('[AUTH-005] a second Canvas user of the same platform naming the same Feide ID is refused', async () => {
    // Arrange: the first Canvas user is already linked to the Feide account
    const feideId = `${uniqueName('e')}@hvl.no`;
    const account = await fx.feideAccount(feideId);
    expect(await fx.link()(request(feideId))).toEqual({ event: 'link.feide-lti', reason: 'link-joined' });
    const second = request(feideId);
    // Act
    const result = await fx.link()(second);
    // Assert
    expect(result).toEqual({ event: 'link.conflict', reason: 'platform-identity-exists' });
    expect(await fx.ltiAccount(second.subject)).toBeUndefined();
    expect(await db.identity.count({ where: { userId: account, provider: 'lti' } })).toBe(1);
  });

  it('[AUTH-005] a linked teacher launching again reports nothing, and an identity from another platform is no rival', async () => {
    // Arrange
    const feideId = `${uniqueName('f')}@hvl.no`;
    const account = await fx.feideAccount(feideId);
    const first = request(feideId);
    await fx.link()(first);
    const otherPlatform = fx.request(feideId, await fx.platform('b'));
    // Act
    const again = await fx.link()(first);
    const fromOther = await fx.link()(otherPlatform);
    // Assert
    expect(again).toBeUndefined();
    expect(fromOther).toEqual({ event: 'link.feide-lti', reason: 'link-joined' });
    expect(await fx.ltiAccount(otherPlatform.subject)).toBe(account);
  });

  /** Whether the database sorts `a` before `b` (its own collation decides the index order). */
  const sortsFirst = async (a: string, b: string) =>
    (await db.$queryRaw<{ first: boolean }[]>`SELECT ${a}::text < ${b}::text AS first`)[0]?.first === true;

  it('[AUTH-005] with mixed key rings the link reaches the account a Feide login uses (the current-key row)', async () => {
    // Arrange: a node with only the old ring made a second account for the same Feide ID. The old row is the
    // older one and also comes first in the hash index, so a lookup that ignored the key ID would pick it.
    const feideId = `${uniqueName('g')}@hvl.no`;
    const source = identitySource({ kind: 'feide', feideId });
    const oldKey = randomKey(31);
    const OLD = new IdentityHasher(parseKeyring(`old=${oldKey}`));
    const hashOf = (ring: IdentityHasher) => ring.hash('identity-subject', source).hash;
    const rotatedWith = (seed: number) =>
      new IdentityHasher(parseKeyring(`new=${randomKey(seed)},old=${oldKey}`));
    let seed = 32;
    while (!(await sortsFirst(hashOf(OLD), hashOf(rotatedWith(seed))))) seed += 1;
    const rotated = rotatedWith(seed);
    await fx.feideAccount(feideId, 'staff', OLD);
    const loginAccount = await fx.feideAccount(feideId, 'staff', rotated);
    const launch = request(feideId);
    // Act
    await fx.link({ with: rotated })(launch);
    // Assert
    expect(await fx.ltiAccount(launch.subject, rotated)).toBe(loginAccount);
  });
});
