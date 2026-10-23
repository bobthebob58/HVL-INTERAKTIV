/**
 * linkingFixture — what the database-level AUTH-005 linking tests share: platform rows, Feide accounts made the way
 * a Feide login makes them, launch requests with `custom.feide_login`, and the account an LTI subject ended up in.
 *
 * Why: the guard tests and the race tests call the linker directly against the database with the launch facts
 *      written out; one fixture keeps both files short and their rows cleaned up the same way.
 * Spec: AUTH-005, DATA-002
 * Invariants:
 *   - Every platform and user it creates is removed by `cleanUp` (identities cascade with them).
 *   - Feide IDs are fresh per test (`uniqueName`), so tests never see each other's accounts.
 * Collaborators: ../../src/auth/identity/accountLinking.ts, ./services.ts.
 * Tests: apps/server/test/auth/identity/accountLinkingGuards.int.test.ts,
 *   apps/server/test/auth/identity/accountLinkingRaces.int.test.ts
 */
import { randomUUID } from 'node:crypto';
import { accountLinker, type LinkRequest } from '../../src/auth/identity/accountLinking.js';
import { identitySource } from '../../src/auth/identity/subjectSources.js';
import type { Database } from '../../src/infra/prismaClient.js';
import type { IdentityHasher } from '../../src/security/keys/IdentityHasher.js';
import { uniqueName } from './services.js';

const CUSTOM = 'https://purl.imsglobal.org/spec/lti/claim/custom';
const ISSUER = 'https://canvas.linkguard.example';

/**
 * Builds the fixture.
 * @param db - The test database.
 * @param hasher - The identity hasher of the test environment.
 * @returns Helpers that create rows, build requests and linkers, and clean up.
 */
export function linkingFixture(db: Database, hasher: IdentityHasher) {
  const base = `https://${uniqueName('linkguard')}`;
  const users: string[] = [];
  const platforms: string[] = [];
  return {
    /** A platform row (the linker needs its ID for the rival check). */
    async platform(suffix: string): Promise<string> {
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
    },
    /** The linker, on every platform unless `linksFeide` is false, for `hvl.no` Feide IDs. */
    link: (options: { linksFeide?: boolean; with?: IdentityHasher } = {}) =>
      accountLinker({
        db,
        hasher: options.with ?? hasher,
        linksFeide: () => options.linksFeide ?? true,
        allowedOrgs: ['hvl.no'],
      }),
    /** An author's Deep Linking launch naming `feideId`. */
    request: (feideId: string, platformId: string, subject: string = randomUUID()): LinkRequest => ({
      claims: { [CUSTOM]: { feide_login: feideId } },
      roles: ['author'],
      issuer: ISSUER,
      clientId: 'guard',
      subject,
      platformId,
    }),
    /** A Feide account as a Feide login makes it, hashed by `by`. */
    async feideAccount(feideId: string, kind: 'staff' | 'learner' = 'staff', by = hasher): Promise<string> {
      const { hash, keyId } = by.hash('identity-subject', identitySource({ kind: 'feide', feideId }));
      const user = await db.user.create({
        data: {
          kind,
          identities: { create: [{ provider: 'feide', subjectHash: hash, subjectKeyId: keyId }] },
        },
      });
      users.push(user.id);
      return user.id;
    },
    /** The account an LTI subject of the test issuer is in, if any. */
    async ltiAccount(subject: string, by = hasher): Promise<string | undefined> {
      const hashes = by.candidates(
        'identity-subject',
        identitySource({ kind: 'lti', issuer: ISSUER, subject }),
      );
      const row = await db.identity.findFirst({
        where: { provider: 'lti', subjectHash: { in: hashes.map((c) => c.hash) } },
      });
      return row?.userId;
    },
    /** Removes every platform and user the fixture created. */
    async cleanUp(): Promise<void> {
      await db.ltiPlatform.deleteMany({ where: { url: { in: platforms } } });
      await db.user.deleteMany({ where: { id: { in: users } } });
    },
  };
}
