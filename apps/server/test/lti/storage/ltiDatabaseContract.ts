/**
 * ltiDatabaseContract — the behaviour every ltijs 7 `DatabaseManager` must show, as a test suite any storage can
 * run: platforms saved, read, filtered, updated and deleted; access tokens cached per scope set; ID tokens stored
 * under a new ID; nonces consumed once.
 *
 * Why: `LTI-002` asks for ltijs's contract behaviour (save/get/consume) as a shared suite. Written against the
 *      `DatabaseManager` interface only, it states what ltijs relies on (as its Mongo storage does it) apart from
 *      any one storage, and any later storage can prove itself with one call.
 * Spec: LTI-002
 * Invariants:
 *   - Uses only `DatabaseManager` methods and the subject's three hooks; never reads tables directly.
 *   - Every platform URL comes from `uniqueUrl`, so the suite never sees or changes another test's rows.
 *   - The ID-token claims are already minimal, so a storage that minimises claims returns them unchanged.
 * Collaborators: ltijs `DatabaseManager` (database-manager.types.d.ts), ./ltiPlatformFixtures.ts,
 *   ./ltiLaunchClaims.ts.
 * Tests: apps/server/test/lti/storage/PrismaLtiDatabaseManager.int.test.ts (runs it on PostgreSQL)
 */
import { randomUUID } from 'node:crypto';
import { IdTokenValidationMethod } from 'ltijs';
import type { AccessTokenRecord, DatabaseManager, IdTokenClaims, PlatformFilter } from 'ltijs';
import { expect, it } from 'vitest';
import { storedLaunchClaims } from './ltiLaunchClaims.js';
import { platformAttributes } from './ltiPlatformFixtures.js';

/** The storage under test and what the suite needs around it. */
export interface LtiDatabaseContractSubject {
  /** The storage. */
  readonly database: DatabaseManager;
  /** A platform URL no other test uses; the subject removes its rows afterwards. */
  readonly uniqueUrl: () => string;
  /** Lets a deployment launch, for a storage that checks deployments before it stores an ID token (D-051). */
  readonly allowDeployment: (platformId: string, deploymentId: string) => Promise<void>;
}

const accessToken = (access_token: string, scope = 'score'): AccessTokenRecord => ({
  access_token,
  token_type: 'bearer',
  expires_in: 3600,
  scope,
  createdAt: Date.now(),
});

/**
 * Registers the contract's tests in the current `describe` block.
 * @param subject - Called inside each test, so it may return values set up in `beforeAll`.
 * @example
 *   describe('my storage', () => { describeLtiDatabaseContract(() => ({ database, uniqueUrl, allowDeployment })); });
 */
export function describeLtiDatabaseContract(subject: () => LtiDatabaseContractSubject): void {
  it('[LTI-002] contract: saves a platform and reads it back by ID and by URL and client ID', async () => {
    // Arrange
    const { database, uniqueUrl } = subject();
    const url = uniqueUrl();
    const saved = platformAttributes(url, { authorizationServer: `${url}/as` });
    // Act
    const id = await database.savePlatform(saved);
    // Assert
    expect(await database.getPlatformById(id)).toEqual({ ...saved, id });
    expect(await database.getPlatformByUrlAndClientId(url, 'client-a')).toEqual({ ...saved, id });
    expect(await database.getPlatformByUrlAndClientId(url, 'client-b')).toBeUndefined();
    expect(await database.getPlatformById(randomUUID())).toBeUndefined();
    await expect(Promise.all([database.listen(), database.close()])).resolves.toEqual([undefined, undefined]);
  });

  it('[LTI-002] contract: filters platforms by URL, name, one client ID or a list of client IDs', async () => {
    // Arrange
    const { database, uniqueUrl } = subject();
    const url = uniqueUrl();
    const save = (clientId: string, name = 'Test Canvas') =>
      database.savePlatform(platformAttributes(url, { clientId, name }));
    const [a, b, c] = [await save('client-a'), await save('client-b'), await save('client-c', 'Other')];
    const ids = async (filter: PlatformFilter) =>
      (await database.getPlatforms(filter)).map((p) => p.id).sort();
    // Act and assert
    expect(await ids({ url })).toEqual([a, b, c].sort());
    expect(await ids({ url, clientId: 'client-b' })).toEqual([b]);
    expect(await ids({ url, clientId: ['client-a', 'client-c', 'client-x'] })).toEqual([a, c].sort());
    expect(await ids({ url, clientId: [] })).toEqual([]);
    expect(await ids({ url, name: 'Other' })).toEqual([c]);
    expect(await ids({ url: uniqueUrl() })).toEqual([]);
  });

  it('[LTI-002] contract: updates only the fields it is given, then deletes the platform', async () => {
    // Arrange
    const { database, uniqueUrl } = subject();
    const url = uniqueUrl();
    const id = await database.savePlatform(platformAttributes(url));
    const changed = {
      idTokenValidation: { method: IdTokenValidationMethod.RsaKey, key: 'platform-public-key' },
      keys: { public: 'rotated-public', private: 'rotated-private' },
    };
    // Act
    await database.updatePlatformById(id, { name: 'Renamed', active: false });
    await database.updatePlatformById(id, changed);
    const updated = await database.getPlatformById(id);
    await database.deletePlatformById(id);
    // Assert
    expect(updated).toEqual({ ...platformAttributes(url), ...changed, id, name: 'Renamed', active: false });
    expect(await database.getPlatformById(id)).toBeUndefined();
    expect(await database.getPlatformByUrlAndClientId(url, 'client-a')).toBeUndefined();
  });

  it('[LTI-002] contract: caches one access token per platform, client and scope set, replaced on save', async () => {
    // Arrange
    const { database, uniqueUrl } = subject();
    const url = uniqueUrl();
    const latest = accessToken('second');
    // Act
    const firstId = await database.saveAccessToken(url, 'client-a', 'score', accessToken('first'));
    await database.saveAccessToken(url, 'client-a', 'lineitem', accessToken('other-scope', 'lineitem'));
    const secondId = await database.saveAccessToken(url, 'client-a', 'score', latest);
    // Assert
    expect([typeof firstId, typeof secondId]).toEqual(['string', 'string']);
    expect(await database.getAccessToken(url, 'client-a', 'score')).toEqual(latest);
    expect(await database.getAccessToken(url, 'client-a', 'lineitem')).toMatchObject({
      access_token: 'other-scope',
    });
    expect(await database.getAccessToken(url, 'client-b', 'score')).toBeUndefined();
    expect(await database.getAccessToken(uniqueUrl(), 'client-a', 'score')).toBeUndefined();
  });

  it('[LTI-002] contract: stores each ID token under a new ID and returns it unchanged', async () => {
    // Arrange
    const { database, uniqueUrl, allowDeployment } = subject();
    const iss = uniqueUrl();
    const platformId = await database.savePlatform(platformAttributes(iss));
    await allowDeployment(platformId, 'deployment-1');
    const claims: IdTokenClaims = storedLaunchClaims({
      iss,
      clientId: 'client-a',
      platformId,
      deploymentId: 'deployment-1',
    });
    const original = structuredClone(claims);
    // Act
    const [first, second] = [await database.saveIdToken(claims), await database.saveIdToken(claims)];
    // Assert
    expect(first).not.toBe(second);
    expect(claims).toEqual(original);
    expect(await database.getIdToken(first)).toEqual({ ...original, id: first });
    expect(await database.getIdToken(second)).toEqual({ ...original, id: second });
    expect(await database.getIdToken(randomUUID())).toBeUndefined();
  });

  it('[LTI-002] contract: consumes a saved nonce exactly once and never an unknown one', async () => {
    // Arrange
    const { database } = subject();
    const nonce = randomUUID();
    // Act
    await database.saveNonce(nonce);
    const [first, replay, unknown] = [
      await database.consumeNonce(nonce),
      await database.consumeNonce(nonce),
      await database.consumeNonce(randomUUID()),
    ];
    // Assert
    expect({ first, replay, unknown }).toEqual({ first: true, replay: false, unknown: false });
  });
}
