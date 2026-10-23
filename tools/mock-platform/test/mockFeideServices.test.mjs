/**
 * Tests for the mock Feide's userinfo, Groups API and end session, and for the users a test adds.
 *
 * Spec: AUTH-001, AUTH-002, AUTH-003
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as client from 'openid-client';
import { FEIDE_ID_CLAIM, USERID_SEC_CLAIM, startMockFeide } from '../mockPlatform.mjs';
import { feideRelyingParty } from './feideLoginSteps.mjs';

let feide;
let config;
let login;

beforeAll(async () => {
  feide = await startMockFeide();
  ({ config, login } = await feideRelyingParty(feide));
});
afterAll(() => feide.close());
afterEach(() => vi.useRealTimers());

const bearer = (accessToken) => ({ headers: { Authorization: `Bearer ${accessToken}` } });
const groupsOf = (accessToken) => fetch(`${feide.groupsApiUrl}/groups/me/groups`, bearer(accessToken));
const userinfoOf = (accessToken) => fetch(config.serverMetadata().userinfo_endpoint, bearer(accessToken));

describe('[AUTH-001] mock Feide userinfo', () => {
  it("[AUTH-001] returns the token user's claims, narrowed by the token's scopes, and 401 without a token", async () => {
    // Arrange
    feide.nextLogin('student');
    const tokens = await login('openid userid-feide');
    // Act
    const claims = await client.fetchUserInfo(config, tokens.access_token, tokens.claims().sub);
    const missing = await fetch(config.serverMetadata().userinfo_endpoint);
    // Assert
    expect(claims).toEqual({
      sub: feide.users.get('student').sub,
      [FEIDE_ID_CLAIM]: 'student@hvl.no',
      [USERID_SEC_CLAIM]: ['feide:student@hvl.no'],
    });
    expect(missing.status).toBe(401);
  });

  it('[AUTH-002] refuses an access token once it has expired, at userinfo and at the Groups API', async () => {
    // Arrange
    const tokens = await login();
    vi.useFakeTimers({ toFake: ['Date'] });
    // Act
    vi.setSystemTime(Date.now() + 3_601_000);
    const statuses = [await userinfoOf(tokens.access_token), await groupsOf(tokens.access_token)];
    // Assert
    expect(statuses.map((response) => response.status)).toEqual([401, 401]);
  });
});

describe('[AUTH-002] mock Feide Groups API', () => {
  it("[AUTH-002] returns the token user's fc:org group with affiliations, and FS course groups", async () => {
    // Arrange
    feide.nextLogin('ppu-student');
    const tokens = await login();
    // Act
    const response = await groupsOf(tokens.access_token);
    // Assert
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      expect.objectContaining({
        id: 'fc:org:hvl.no',
        type: 'fc:org',
        membership: { basic: 'member', affiliation: ['member', 'student'], primaryAffiliation: 'student' },
      }),
      expect.objectContaining({
        id: 'fc:fs:fs:emne:hvl.no:PPU101:1',
        type: 'fc:fs:emne',
        parent: 'fc:org:hvl.no',
      }),
    ]);
  });

  it('[AUTH-002] leaves out groups whose scope was not granted', async () => {
    const tokens = await login('openid userid-feide groups-org');
    expect((await (await groupsOf(tokens.access_token)).json()).map((group) => group.type)).toEqual([
      'fc:org',
    ]);
  });

  it('[AUTH-002] answers 401 without a valid token, and 503 while the Groups API is set to fail', async () => {
    // Arrange
    const tokens = await login();
    // Act
    const missing = await fetch(`${feide.groupsApiUrl}/groups/me/groups`);
    const forged = await groupsOf('not-a-token');
    feide.setGroupsFailure(true);
    const failing = await groupsOf(tokens.access_token);
    feide.setGroupsFailure(false);
    const restored = await groupsOf(tokens.access_token);
    // Assert
    expect([missing.status, forged.status, failing.status, restored.status]).toEqual([401, 401, 503, 200]);
    expect(missing.headers.get('www-authenticate')).toBe('Bearer');
  });

  it('[AUTH-002] checks the affiliations and FS group IDs of added users', () => {
    expect(() => feide.addUser({ key: 'x', affiliations: ['teacher'] })).toThrow(/unknown Feide affiliation/);
    expect(() => feide.addUser({ key: 'x', groups: ['PPU101'] })).toThrow(/not an FS group ID/);
    expect(feide.addUser({ key: 'tutor', realm: 'hvl.no', affiliations: ['member', 'staff'] }).feideId).toBe(
      'tutor@hvl.no',
    );
  });
});

describe('[AUTH-003] mock Feide end session', () => {
  it('[AUTH-003] redirects to post_logout_redirect_uri for an ID token it issued and refuses anything else', async () => {
    // Arrange
    const tokens = await login();
    const target = 'http://localhost:3999/';
    const end = (hint, uri = target, state) => {
      const params = { id_token_hint: hint, post_logout_redirect_uri: uri, ...(state && { state }) };
      return fetch(client.buildEndSessionUrl(config, params), { redirect: 'manual' });
    };
    // Act
    const ok = await end(tokens.id_token, target, 's-1');
    const refused = [await end('forged'), await end(tokens.id_token, 'javascript:alert(1)')];
    // Assert
    expect([ok.status, ok.headers.get('location')]).toEqual([302, `${target}?state=s-1`]);
    expect(refused.map((response) => response.status)).toEqual([400, 400]);
    expect(feide.logouts).toEqual([
      { idTokenHint: tokens.id_token, postLogoutRedirectUri: target, state: 's-1' },
    ]);
  });
});
