/**
 * Pins the ltijs 7.0.7 Provider behaviour that our LTI design builds on (D-050, D-051, D-052).
 *
 * Spec: LTI-001
 */
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { SignJWT, decodeJwt, exportSPKI, generateKeyPair, importSPKI, jwtVerify } from 'jose';
import { HttpMethod, IdTokenValidationMethod, Provider } from 'ltijs';
import type { DatabaseManager, HttpHandler, HttpResponse, IdTokenClaims, IdTokenRecord } from 'ltijs';
import type { LaunchContext, PlatformFilter, PlatformRecord } from 'ltijs';
import { beforeAll, describe, expect, it } from 'vitest';

const SERVER_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const SPAWN = { cwd: SERVER_ROOT, encoding: 'utf8', timeout: 60_000 } as const;
const IMPORT_SCRIPT = `import { Provider, LtijsError, HttpMethod } from 'ltijs';
import * as oidc from 'openid-client';
if (![Provider, LtijsError, HttpMethod.Post, oidc.discovery].every(Boolean)) process.exit(2);`;
const ISS = 'https://canvas.example.test';
const CLIENT_ID = 'client-1';
const ENDPOINTS = { authenticationEndpoint: `${ISS}/auth`, accessTokenEndpoint: `${ISS}/token` };
const TARGET = 'https://tool.example.test/lti/launch';
const LTI = 'https://purl.imsglobal.org/spec/lti/claim/';
const CLAIMS = {
  iss: ISS,
  aud: CLIENT_ID,
  sub: 'learner-sub',
  name: 'Kari Nordmann',
  email: 'kari@example.test',
  [`${LTI}deployment_id`]: 'any-deployment',
  [`${LTI}version`]: '1.3.0',
  [`${LTI}message_type`]: 'LtiResourceLinkRequest',
  [`${LTI}roles`]: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Learner'],
  [`${LTI}target_link_uri`]: TARGET,
  [`${LTI}resource_link`]: { id: 'resource-1' },
  [`${LTI}context`]: { id: 'course-1' },
};
const SILENT_LOGGER = { debug() {}, warn() {}, error() {} };
const REQUEST = { method: 'POST', query: {}, headers: {} };
const post = (path: string, body: Record<string, unknown>) => ({ ...REQUEST, path, body });

/** An in-memory DatabaseManager (all 14 methods) that stores copies, as a database would. */
function memoryDatabase(started: string[]) {
  const platforms = new Map<string, PlatformRecord>();
  const idTokens = new Map<string, IdTokenRecord>();
  const nonces = new Set<string>();
  const saves: { token: IdTokenClaims; id: string }[] = [];
  const put = <T extends object>(map: Map<string, T & { id: string }>, value: T, id = randomUUID()) =>
    map.set(id, { ...structuredClone(value), id }) && id;
  const matches = (p: PlatformRecord, { url = p.url, clientId = p.clientId }: PlatformFilter = {}) =>
    url === p.url && [clientId].flat().includes(p.clientId);
  const database: DatabaseManager = {
    listen: async () => void started.push('database.listen'),
    close: async () => {},
    getPlatforms: async (f) => structuredClone([...platforms.values()].filter((p) => matches(p, f))),
    getPlatformById: async (id) => structuredClone(platforms.get(id)),
    getPlatformByUrlAndClientId: async (url, clientId) => (await database.getPlatforms({ url, clientId }))[0],
    savePlatform: async (attributes) => put(platforms, attributes),
    updatePlatformById: async (id, fields) => void platforms.set(id, { ...platforms.get(id)!, ...fields }),
    deletePlatformById: async (id) => void platforms.delete(id),
    getAccessToken: async () => undefined,
    saveAccessToken: async () => randomUUID(),
    getIdToken: async (id) => structuredClone(idTokens.get(id)),
    saveIdToken: async (token) => saves[saves.push({ token, id: put(idTokens, token) }) - 1]!.id,
    saveNonce: async (nonce) => nonces.add(nonce) && nonce,
    consumeNonce: async (nonce) => nonces.delete(nonce),
  };
  return { database, saves };
}

function recordResponse() {
  const sent: { html?: string; redirect?: string } = {};
  const response: HttpResponse = {
    status: () => response,
    redirect: (redirect) => Object.assign(sent, { redirect }),
    html: (html) => Object.assign(sent, { html }),
    json: () => {},
  };
  return { response, sent };
}

/** Reads the JSON that ltijs embeds in its login and launch pages. */
const embedded = (html: string | undefined, id: string): Record<string, string> =>
  JSON.parse(new RegExp(`id="${id}">(.*?)</script>`, 's').exec(html ?? '')?.[1] ?? 'null');

/** Builds a Provider on stubs and runs one resource-link launch through its own route handlers. */
async function launchOnce() {
  const started: string[] = [];
  const routes: Parameters<HttpHandler['registerRoute']>[] = [];
  const httpHandler: HttpHandler = {
    registerRoute: (...route) => void routes.push(route),
    listen: async () => void started.push('httpHandler.listen'),
    close: async () => {},
  };
  const { database, saves } = memoryDatabase(started);
  const sigint = process.listenerCount('SIGINT');
  const provider = new Provider({ databaseManager: database, httpHandler, logger: SILENT_LOGGER });
  const route = (path: string) => routes.find(([registered]) => registered === path)![2];
  const handled: LaunchContext[] = [];
  provider.onResourceLink(async (context, _request, response) => {
    handled.push(context);
    context.redirect(response, '/lti/play');
  });
  const [login, keys] = [recordResponse(), await generateKeyPair('RS256')];
  const idTokenValidation = { method: IdTokenValidationMethod.RsaKey, key: await exportSPKI(keys.publicKey) };
  const input = { url: ISS, clientId: CLIENT_ID, name: 'Mock', ...ENDPOINTS, idTokenValidation };
  const platform = await provider.platformManager.registerPlatform(input);
  const loginBody = { iss: ISS, client_id: CLIENT_ID, login_hint: 'hint', target_link_uri: TARGET };
  await route('/lti/login')(post('/lti/login', loginBody), login.response);
  const loginData = embedded(login.sent.html, 'ltijs-login-data');
  const [nonce, now] = [
    new URL(loginData.targetUrl!).searchParams.get('nonce'),
    Math.floor(Date.now() / 1000),
  ];
  const payload = { ...CLAIMS, nonce, iat: now, exp: now + 60 };
  const idToken = await new SignJWT(payload).setProtectedHeader({ alg: 'RS256' }).sign(keys.privateKey);
  // WHY: step 1 is the platform's form_post; step 2 is ltijs's own page posting the recovered state back.
  const [step1, step2] = [recordResponse(), recordResponse()];
  const callback = { id_token: idToken, state: loginData.state };
  await route('/lti/launch')(post('/lti/launch', callback), step1.response);
  const afterStep1 = { handled: handled.length, saves: saves.length };
  const recovered = { ...callback, ltijs_recovered_state: loginData.recoveryToken };
  await route('/lti/launch')(post('/lti/launch', recovered), step2.response);
  return { provider, routes, started, sigint, platform, saves, handled, idToken, step1, afterStep1, step2 };
}

describe('[LTI-001] upstream: ltijs 7.0.7 Provider', () => {
  it('[LTI-001] ltijs and openid-client load under plain Node and tsx', () => {
    for (const loader of [[], ['--import', 'tsx']]) {
      const args = [...loader, '--input-type=module', '-e', IMPORT_SCRIPT];
      const { status, stderr } = spawnSync(process.execPath, args, SPAWN);
      expect({ loader, stderr, status }).toEqual({ loader, stderr: '', status: 0 });
    }
  }, 130_000);

  describe('on stub collaborators, after one launch through its own routes', () => {
    let run: Awaited<ReturnType<typeof launchOnce>>;
    beforeAll(async () => {
      run = await launchOnce();
    });

    it('upstream pin: the constructor registers login, launch and keyset routes and starts nothing', () => {
      expect(run.routes.map(([path, methods]) => [path, methods])).toEqual([
        ['/lti/login', [HttpMethod.Get, HttpMethod.Post]],
        ['/lti/launch', [HttpMethod.Post]],
        ['/lti/keys', [HttpMethod.Get]],
      ]);
      expect(run.started).toEqual([]);
      expect(process.listenerCount('SIGINT')).toBe(run.sigint);
    });

    it('upstream pin: accepts any deployment_id; step 1 returns a form, step 2 calls onResourceLink', () => {
      // Assert: step 1 only echoes id_token and state into a self-posting page; nothing is saved or handled
      expect(embedded(run.step1.sent.html, 'ltijs-launch-data')).toMatchObject({ idToken: run.idToken });
      expect(run.step1.sent.html).toContain('name="ltijs_recovered_state"');
      expect(run.afterStep1).toEqual({ handled: 0, saves: 0 });
      // Assert: step 2 validates, saves the ID token and hands the launch to onResourceLink
      expect(run.handled).toHaveLength(1);
      expect(run.handled[0]!.idToken.platform.deploymentId).toBe('any-deployment');
      expect(run.step2.sent.redirect).toMatch(/^\/lti\/play\?ltik=[\w-]+\.[\w-]+\.[\w-]+$/);
    });

    it('upstream pin: an ltik holds only tid, iat and exp, signed with the platform tool key', async () => {
      // Arrange
      const ltik = run.handled[0]!.ltik;
      // Act
      const { payload } = await jwtVerify(ltik, await importSPKI(run.platform.keys.public, 'RS256'));
      // Assert
      expect(run.step2.sent.redirect).toBe(`/lti/play?ltik=${ltik}`);
      expect(Object.keys(decodeJwt(ltik)).sort()).toEqual(['exp', 'iat', 'tid']);
      expect(payload.tid).toBe(run.saves[0]!.id);
      expect(payload.exp! - payload.iat!).toBe(24 * 3600);
    });

    it('upstream pin: context.contextId is the ID-token record ID, not the course context ID', () => {
      expect(run.handled[0]!.contextId).toBe(run.saves[0]!.id);
      expect(run.handled[0]!.idToken.launch.context?.id).toBe('course-1');
    });

    it('upstream pin: saveIdToken gets all claims, client_id and platform_id; handlers see a copy', () => {
      const { token, id } = run.saves[0]!;
      expect(token).toMatchObject({ ...CLAIMS, client_id: CLIENT_ID, platform_id: run.platform.id });
      expect(token).not.toHaveProperty('id');
      expect(run.handled[0]!.rawIdToken).not.toBe(token);
      expect(run.handled[0]!.rawIdToken).toEqual({ ...token, id });
    });

    it('upstream pin: getLaunchContext resolves an ltik after its platform is deactivated', async () => {
      // Arrange
      await run.provider.platformManager.deactivatePlatform(run.platform);
      // Act
      const resumed = await run.provider.getLaunchContext(run.handled[0]!.ltik);
      // Assert
      expect(resumed.platform.active).toBe(false);
      expect(resumed.contextId).toBe(run.saves[0]!.id);
    });
  });
});
