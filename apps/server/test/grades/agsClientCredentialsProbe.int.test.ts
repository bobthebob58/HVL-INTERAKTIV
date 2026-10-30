/**
 * Probe P2 of Session 6, kept as a test: D-104's own AGS client end to end against the mock Canvas, before step 3
 * builds it. The tool's private key is read the way D-104 says (ltijs's `platformManager.getPlatformById` and
 * `getPrivateKey`, decrypted by our `PrismaLtiDatabaseManager` with `DATA_ENCRYPTION_KEYS`); a client assertion
 * signed with `node:crypto` alone gets a token from the mock's token endpoint; a score posted to a line item arrives
 * in the mock's record; a deleted line item is confirmed with the same token. No launch and no ltik are involved.
 *
 * Spec: LTI-012
 */
import { createPrivateKey, createPublicKey, randomUUID, sign } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { CANVAS_USERS, LTI_MEDIA_TYPE, LTI_SCOPE } from '../../../../tools/mock-platform/mockPlatform.mjs';
import { openAppTestbed, type AppTestbed } from '../support/appTestbed.js';
import { describeWithServices } from '../support/services.js';

const ASSERTION_TYPE = 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer';
const GRADE_SCOPES = `${LTI_SCOPE.score} ${LTI_SCOPE.lineItemReadonly}`;
const base64url = (value: object): string => Buffer.from(JSON.stringify(value)).toString('base64url');

/** An RS256 JWT signed with `node:crypto` alone: D-104's client needs no new runtime dependency to sign. */
function signRs256(header: object, claims: object, privateKeyPem: string): string {
  const input = `${base64url(header)}.${base64url(claims)}`;
  return `${input}.${sign('sha256', Buffer.from(input), createPrivateKey(privateKeyPem)).toString('base64url')}`;
}

describeWithServices('[LTI-012] probe P2: D-104 client credentials against the mock Canvas', () => {
  let bed: AppTestbed;
  beforeAll(async () => {
    bed = await openAppTestbed();
  }, 60_000);
  afterAll(() => bed.close());

  /** D-104's way to the key: ltijs's platform manager over our storage, then the assertion ltijs itself signs. */
  async function clientAssertion() {
    const platforms = bed.lti.provider.platformManager;
    const platform = await platforms.getPlatformById(bed.platformId);
    if (!platform) throw new Error('the mock Canvas platform is not registered');
    const pem = await platforms.getPrivateKey(platform);
    const now = Math.floor(Date.now() / 1000);
    const claims = { iss: platform.clientId, sub: platform.clientId, aud: platform.authorizationServer };
    const assertion = signRs256(
      { alg: 'RS256', typ: 'JWT', kid: platform.id },
      { ...claims, iat: now, exp: now + 60, jti: randomUUID() },
      pem,
    );
    return { platform, pem, assertion };
  }

  /** The client-credentials token request D-104's client sends. */
  const requestToken = (tokenEndpoint: string, assertion: string) =>
    fetch(tokenEndpoint, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_assertion_type: ASSERTION_TYPE,
        client_assertion: assertion,
        scope: GRADE_SCOPES,
      }),
    });

  it('[LTI-012] signs with the stored tool key, gets a token, and posts a score that the mock records', async () => {
    // Arrange
    const { platform, pem, assertion } = await clientAssertion();
    const row = await bed.db.ltiPlatform.findUniqueOrThrow({ where: { id: platform.id } });
    const keys = (await (await fetch(`${bed.toolUrl}/lti/keys`)).json()) as { keys: JsonWebKey[] };
    const published = keys.keys.find((key) => (key as { kid?: string }).kid === platform.id);
    const lineItem = bed.mock.canvas.ags.addLineItem({
      courseId: 'p2-course',
      label: 'P2 (formativ)',
      scoreMaximum: 100,
    });
    const score = {
      userId: CANVAS_USERS.student.sub,
      scoreGiven: 80,
      scoreMaximum: 100,
      activityProgress: 'Completed',
      gradingProgress: 'FullyGraded',
      timestamp: new Date().toISOString(),
    };
    // Act
    const tokenResponse = await requestToken(platform.accessTokenEndpoint, assertion);
    const token = (await tokenResponse.json()) as { access_token: string; token_type: string };
    const posted = await fetch(`${lineItem.id}/scores`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': LTI_MEDIA_TYPE.score },
      body: JSON.stringify(score),
    });
    // Assert: the key is the decrypted PKCS#1 key whose public half /lti/keys publishes under the platform ID
    expect(Buffer.from(row.privateKeyEncrypted).includes('PRIVATE KEY')).toBe(false);
    expect(pem).toMatch(/^-----BEGIN RSA PRIVATE KEY-----\n/);
    expect(createPublicKey(pem).export({ format: 'jwk' })).toMatchObject({
      n: published?.n,
      e: published?.e,
    });
    expect(platform.authorizationServer).toBe(bed.mock.canvas.tokenEndpoint);
    // Assert: the mock granted the token and recorded exactly the score sent
    expect(tokenResponse.status).toBe(200);
    expect(token).toMatchObject({ token_type: 'Bearer', expires_in: 3600, scope: GRADE_SCOPES });
    expect(posted.status).toBe(200);
    expect(bed.mock.canvas.ags.scores.at(-1)).toEqual({
      lineItemUrl: lineItem.id,
      courseId: 'p2-course',
      score,
      receivedAt: expect.any(String),
    });
  });

  it('[LTI-012] confirms a deleted line item with a lineitem.readonly read of the same token', async () => {
    // Arrange
    const { platform, assertion } = await clientAssertion();
    const token = (
      (await (await requestToken(platform.accessTokenEndpoint, assertion)).json()) as { access_token: string }
    ).access_token;
    const lineItem = bed.mock.canvas.ags.addLineItem({
      courseId: 'p2-course',
      label: 'P2 gone',
      scoreMaximum: 100,
    });
    const read = () => fetch(lineItem.id, { headers: { Authorization: `Bearer ${token}` } });
    // Act
    const before = (await read()).status;
    bed.mock.canvas.ags.deleteLineItem(lineItem.id);
    const after = (await read()).status;
    // Assert
    expect([before, after]).toEqual([200, 404]);
  });
});
