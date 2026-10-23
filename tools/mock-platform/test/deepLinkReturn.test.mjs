/**
 * Tests for the mock Canvas's verification of Deep Linking responses, against a tiny local server that publishes the
 * tool's JWKS at /lti/keys.
 *
 * Spec: LTI-005
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer } from 'node:http';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';
import { CANVAS_USERS, LTI_CLAIM, MESSAGE_TYPE, startMockCanvas } from '../mockPlatform.mjs';

const KID = 'tool-key-1';
let tool;
let canvas;
let toolKey;
let otherKey;

beforeAll(async () => {
  [toolKey, otherKey] = await Promise.all([generateKeyPair('RS256'), generateKeyPair('RS256')]);
  const jwk = { ...(await exportJWK(toolKey.publicKey)), kid: KID, alg: 'RS256', use: 'sig' };
  tool = createServer((req, res) => {
    res.writeHead(req.url === '/lti/keys' ? 200 : 404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ keys: [jwk] }));
  });
  await new Promise((resolve) => tool.listen(0, '127.0.0.1', resolve));
  canvas = await startMockCanvas({ toolUrl: `http://localhost:${tool.address().port}` });
});
afterAll(async () => {
  await canvas.close();
  tool.closeAllConnections();
  await new Promise((resolve) => tool.close(resolve));
});

const now = () => Math.floor(Date.now() / 1000);

/** The data of a fresh Deep Linking request for a placement, as the tool received it. */
const requestData = (placement) =>
  canvas.idTokenClaims({ messageType: MESSAGE_TYPE.deepLinking, user: CANVAS_USERS.teacher, placement }, 'n')[
    LTI_CLAIM.deepLinkingSettings
  ].data;

const item = (overrides = {}) => ({
  type: 'ltiResourceLink',
  title: 'Brettspel i matematikk',
  url: `${canvas.toolUrl}/lti/launch`,
  custom: { contentId: 'content-1' },
  ...overrides,
});

/** The claims ltijs 7.0.7 signs for a Deep Linking response, with a 60-second lifetime. */
function responseClaims(placement = 'link_selection', items = [item()]) {
  return {
    iss: canvas.clientId,
    aud: canvas.issuer,
    iat: now(),
    exp: now() + 60,
    nonce: crypto.randomUUID(),
    [LTI_CLAIM.deploymentId]: canvas.deploymentId,
    [LTI_CLAIM.messageType]: 'LtiDeepLinkingResponse',
    [LTI_CLAIM.version]: '1.3.0',
    [LTI_CLAIM.contentItems]: items,
    [LTI_CLAIM.data]: requestData(placement),
  };
}

const sign = (claims, { key = toolKey.privateKey, kid = KID, alg = 'RS256' } = {}) =>
  new SignJWT(claims).setProtectedHeader({ alg, typ: 'JWT', ...(kid && { kid }) }).sign(key);

const edit = (change) => (claims) => Object.assign(claims, change);
const BAD = [
  ['signed with another key under the tool kid', {}, { key: 'other' }, 'bad-signature'],
  ['signed under a kid the tool does not publish', {}, { kid: 'unknown' }, 'unknown-kid'],
  ['signed without a kid', {}, { kid: '' }, 'unknown-kid'],
  ['signed with HS256', {}, { alg: 'HS256' }, 'wrong-alg'],
  ['from another iss', edit({ iss: 'someone' }), {}, 'wrong-iss'],
  ['for another aud', edit({ aud: 'https://canvas.instructure.com' }), {}, 'wrong-aud'],
  ['for another deployment', edit({ [LTI_CLAIM.deploymentId]: '2:x' }), {}, 'wrong-deployment'],
  ['without a nonce', edit({ nonce: undefined }), {}, 'missing-nonce'],
  [
    'of another message type',
    edit({ [LTI_CLAIM.messageType]: 'LtiResourceLinkRequest' }),
    {},
    'wrong-message-type',
  ],
  ['of LTI version 1.1', edit({ [LTI_CLAIM.version]: '1.1' }), {}, 'wrong-version'],
  ['with data no request carried', edit({ [LTI_CLAIM.data]: 'forged' }), {}, 'data-mismatch'],
  ['issued in the future', edit({ iat: now() + 600, exp: now() + 660 }), {}, 'bad-iat'],
  ['that has expired', edit({ iat: now() - 120, exp: now() - 60 }), {}, 'expired'],
  ['with items that are not a list', edit({ [LTI_CLAIM.contentItems]: 'x' }), {}, 'bad-content-items'],
];

describe('[LTI-005] mock Canvas Deep Linking response verification', () => {
  it('[LTI-005] accepts a response signed with the tool key and records its items and lifetime', async () => {
    // Arrange
    const claims = responseClaims('assignment_selection', [item({ lineItem: { scoreMaximum: 100 } })]);
    // Act
    const record = await canvas.verifyDeepLinkResponse(await sign(claims));
    // Assert
    expect(record).toMatchObject({ ok: true, problems: [], lifetime: 60, items: [item({ lineItem: {} })] });
    expect(record.request).toEqual({
      placement: 'assignment_selection',
      acceptMultiple: false,
      data: claims[LTI_CLAIM.data],
    });
    expect(record.header).toMatchObject({ alg: 'RS256', kid: KID });
    expect(canvas.deepLinkResponses.at(-1)).toBe(record);
  });

  it.each(BAD)('[LTI-005] refuses a response %s', async (_label, change, signing, problem) => {
    // Arrange
    const claims = responseClaims();
    if (typeof change === 'function') change(claims);
    const key =
      signing.key === 'other'
        ? otherKey.privateKey
        : signing.alg === 'HS256'
          ? new Uint8Array(32)
          : undefined;
    // Act
    const record = await canvas.verifyDeepLinkResponse(
      await sign(claims, { ...signing, ...(key && { key }) }),
    );
    // Assert
    expect(record.ok).toBe(false);
    expect(record.problems).toEqual([problem]);
  });

  it('[LTI-005] refuses a replayed nonce, which only a response with a valid signature uses up', async () => {
    const claims = responseClaims();
    const tokens = [await sign(claims, { key: otherKey.privateKey }), await sign(claims), await sign(claims)];
    const problems = [];
    for (const jwt of tokens) problems.push((await canvas.verifyDeepLinkResponse(jwt)).problems);
    expect(problems).toEqual([['bad-signature'], [], ['reused-nonce']]);
  });

  it.each([
    [
      'two items where accept_multiple is false',
      'assignment_selection',
      () => [item(), item()],
      'too-many-items',
    ],
    [
      'a link item where only resource links go',
      'link_selection',
      () => [item({ type: 'link' })],
      'unaccepted-type',
    ],
    [
      'a resource link to another origin',
      'link_selection',
      () => [item({ url: 'https://evil.test/x' })],
      'foreign-url',
    ],
  ])('[LTI-005] refuses %s', async (_label, placement, items, problem) => {
    const record = await canvas.verifyDeepLinkResponse(await sign(responseClaims(placement, items())));
    expect(record.problems).toEqual([problem]);
  });

  it('[LTI-005] lists every problem at once and keeps the unverified claims for inspection', async () => {
    // Arrange
    const claims = { ...responseClaims(), iss: 'x', aud: 'y' };
    // Act
    const record = await canvas.verifyDeepLinkResponse(await sign(claims, { key: otherKey.privateKey }));
    // Assert
    expect(record.problems).toEqual(['bad-signature', 'wrong-iss', 'wrong-aud']);
    expect(record.claims.iss).toBe('x');
  });

  it('[LTI-005] refuses something that is not a JWT', async () => {
    const record = await canvas.verifyDeepLinkResponse('not-a-jwt');
    expect([record.ok, record.problems, record.items]).toEqual([false, ['invalid-jwt'], []]);
  });

  it('[LTI-005] reports an unreachable tool JWKS', async () => {
    const offline = await startMockCanvas({ toolUrl: 'http://127.0.0.1:1' });
    const jwt = await sign({ ...responseClaims(), aud: offline.issuer });
    const record = await offline.verifyDeepLinkResponse(jwt);
    await offline.close();
    expect(record.problems).toContain('jwks-unavailable');
  });

  it('[LTI-005] answers POST /deep_linking_response with a page listing the items, or 400 with the problems', async () => {
    // Arrange
    const url = `${canvas.origin}/deep_linking_response`;
    const post = async (claims) =>
      fetch(url, { method: 'POST', body: new URLSearchParams({ JWT: await sign(claims) }) });
    // Act
    const good = await post(responseClaims());
    const bad = await post({ ...responseClaims(), iss: 'x' });
    // Assert
    expect(good.status).toBe(200);
    expect(await good.text()).toMatch(/id="deep-link-items"><li data-type="ltiResourceLink">Brettspel i/);
    expect(bad.status).toBe(400);
    expect(await bad.text()).toContain('<li>wrong-iss</li>');
    expect(canvas.deepLinkResponses.at(-1).problems).toEqual(['wrong-iss']);
  });
});
