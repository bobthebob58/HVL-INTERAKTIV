/**
 * mockFeide — a mock Feide OpenID Connect provider with Feide's Groups API and end session, on oauth2-mock-server.
 *
 * Why: the tool's Feide login (AUTH-001…AUTH-004) must run end to end without auth.dataporten.no, which the build
 *      environment cannot reach (D-049). oauth2-mock-server brings discovery, JWKS, code + PKCE and signed tokens;
 *      this module adds Feide's users and claims, the Groups API, a checked end session and test controls.
 * Spec: AUTH-001, AUTH-002, AUTH-003, AUTH-004
 * Invariants:
 *   - Paths are Feide's (`/oauth/authorization`, `/oauth/token`, `/openid/userinfo`, `/openid/jwks`,
 *     `/openid/endsession`); the issuer is `http://localhost:<port>`, as oauth2-mock-server names it.
 *   - The user is bound to the authorisation code when /authorize runs, so concurrent logins never swap users;
 *     each code is redeemed once, and a code issued for a PKCE challenge only with its verifier. As at Feide, a
 *     PKCE challenge must use S256 (`plain` and a missing method are refused with `invalid_request`).
 *   - userinfo and the Groups API accept only unexpired access tokens this mock issued (401 otherwise).
 *   - Every oauth2-mock-server event handler here is synchronous: the library ignores asynchronous ones.
 *   - The client ID is checked at /authorize; the client secret and the redirect URIs are not checked.
 * Collaborators: ./feideDiscovery.mjs, ./feideUsers.mjs, ./httpRouter.mjs, ./mockPlatform.mjs, oauth2-mock-server 9.2.0.
 * Tests: tools/mock-platform/test/mockFeide.test.mjs
 */
import { generateKeyPairSync, sign } from 'node:crypto';
import { Events, OAuth2Issuer, OAuth2Service } from 'oauth2-mock-server';
import { FEIDE_ENDPOINTS, discoveryDocument } from './feideDiscovery.mjs';
import { FEIDE_DEMO_USERS, feideClaims, feideGroups, normaliseFeideUser } from './feideUsers.mjs';
import { createRouter, readForm, redirect, sendJson, sendText, startServer } from './httpRouter.mjs';

/** The user who logs in when no other user was chosen with `nextLogin`. */
export const DEFAULT_FEIDE_LOGIN = 'author';
const TOKEN_LIFETIME_MS = 3600 * 1000;
let foreignKey;

/**
 * Starts a mock Feide.
 * @param {{port?: number, host?: string, clientId?: string, clientSecret?: string}} [options] - Port 0 (default)
 *   picks a free port; the server listens on 127.0.0.1 by default.
 * @returns {Promise<object>} The running mock; see `MockFeide` in ./mockPlatform.d.mts.
 */
export async function startMockFeide(options = {}) {
  const { port = 0, host = '127.0.0.1', clientId = 'hvl-interaktiv-mock' } = options;
  const issuer = new OAuth2Issuer();
  await issuer.keys.generate('RS256');
  const service = new OAuth2Service(issuer, FEIDE_ENDPOINTS);
  const users = new Map(FEIDE_DEMO_USERS.map((spec) => [spec.key, normaliseFeideUser(spec)]));
  const state = { queue: [], codes: new Map(), tokens: new Map(), idTokens: new Set(), edits: [] };
  Object.assign(state, { forge: false, groupsFailing: false });
  const logouts = [];
  bindTokenEvents(service, { clientId, users, state });
  const router = createRouter(service.requestHandler);
  const http = await startServer(router.listener, { port, host });
  // WHY: oauth2-mock-server names a loopback issuer `localhost`; the same name keeps the tool and Feide one site.
  issuer.url = `http://localhost:${http.port}`;
  const feide = {
    issuer: issuer.url,
    groupsApiUrl: issuer.url,
    endSessionUrl: `${issuer.url}${FEIDE_ENDPOINTS.endSession}`,
    clientId,
    clientSecret: options.clientSecret ?? 'mock-secret-not-checked',
    users,
    logouts,
    addUser(spec) {
      const user = normaliseFeideUser(spec);
      users.set(user.key, user);
      return user;
    },
    nextLogin(key) {
      if (!users.has(key)) throw new RangeError(`unknown mock Feide user: ${key}`);
      state.queue.push(key);
    },
    setGroupsFailure: (failing) => void (state.groupsFailing = failing === true),
    tamperNextIdToken: (edit) => void state.edits.push(edit),
    forgeNextIdTokenSignature: () => void (state.forge = true),
    close: http.close,
  };
  registerFeideRoutes(router, feide, state);
  return feide;
}

/** Binds users to codes and fills tokens with Feide claims; all handlers are synchronous (see header). */
function bindTokenEvents(service, { clientId, users, state }) {
  service.on(Events.BeforeAuthorizeRedirect, ({ url }, req) => {
    const code = url.searchParams.get('code');
    if (code === null) return;
    const refuse = (error) => {
      url.searchParams.delete('code');
      url.searchParams.set('error', error);
    };
    if (req.query.client_id !== clientId) return refuse('unauthorized_client');
    const pkce = typeof req.query.code_challenge === 'string';
    // WHY: Feide offers PKCE S256 only; oauth2-mock-server also takes `plain`, RFC 7636's default method.
    if (pkce && req.query.code_challenge_method !== 'S256') return refuse('invalid_request');
    const user = users.get(state.queue.shift() ?? DEFAULT_FEIDE_LOGIN);
    state.codes.set(code, { user, scope: String(req.query.scope ?? ''), pkce });
  });
  service.on(Events.BeforeTokenSigning, (token, req) => {
    const grant = state.codes.get(req.body?.code);
    if (!grant) return;
    // WHY: the access token is signed first and is the only one with a `scope` claim.
    if ('scope' in token.payload)
      return void Object.assign(token.payload, { sub: grant.user.sub, scope: grant.scope });
    Object.assign(token.payload, feideClaims(grant.user, grant.scope), { auth_time: token.payload.iat });
    state.edits.shift()?.(token.payload, token.header);
  });
  service.on(Events.BeforeResponse, (response, req) => {
    if (req.body?.grant_type !== 'authorization_code') return;
    const grant = state.codes.get(req.body.code);
    state.codes.delete(req.body.code);
    // WHY: RFC 7636 §4.6: a code issued for a challenge needs its verifier; oauth2-mock-server skips that check.
    if (!grant || response.body === '' || (grant.pkce && !req.body.code_verifier)) {
      response.statusCode = 400;
      response.body = { error: 'invalid_grant', error_description: 'unknown or already redeemed code' };
      return;
    }
    response.body.scope = grant.scope;
    if (state.forge) response.body.id_token = signWithForeignKey(String(response.body.id_token));
    state.forge = false;
    state.tokens.set(response.body.access_token, { ...grant, expiresAt: Date.now() + TOKEN_LIFETIME_MS });
    state.idTokens.add(response.body.id_token);
  });
  service.on(Events.BeforeUserinfo, (response, req) => {
    const grant = bearerGrant(req, state.tokens);
    response.statusCode = grant ? 200 : 401;
    response.body = grant ? feideClaims(grant.user, grant.scope) : { error: 'invalid_token' };
  });
}

/** Re-signs a JWT with a key outside the JWKS under the original header, so only the signature is wrong. */
function signWithForeignKey(jwt) {
  foreignKey ??= generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
  const input = jwt.split('.').slice(0, 2).join('.');
  return `${input}.${sign('sha256', Buffer.from(input), foreignKey).toString('base64url')}`;
}

/** The grant behind an `Authorization: Bearer` access token, when this mock issued it and it has not expired. */
function bearerGrant(req, tokens) {
  const token = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization ?? '')?.[1];
  const grant = token === undefined ? undefined : tokens.get(token);
  return grant && grant.expiresAt > Date.now() ? grant : undefined;
}

function registerFeideRoutes(router, feide, state) {
  router.add('GET', '/.well-known/openid-configuration', (_req, res) =>
    sendJson(res, 200, discoveryDocument(feide.issuer)),
  );
  router.add('GET', '/groups/me/groups', (req, res) => {
    if (state.groupsFailing) return sendJson(res, 503, { message: 'Groups API unavailable (mock)' });
    const grant = bearerGrant(req, state.tokens);
    if (!grant) return sendJson(res, 401, { message: 'Unauthorized' }, { 'WWW-Authenticate': 'Bearer' });
    sendJson(res, 200, feideGroups(grant.user, grant.scope));
  });
  router.add('GET', FEIDE_ENDPOINTS.endSession, (_req, res, { query }) => {
    const target = query.get('post_logout_redirect_uri') ?? '';
    const hint = query.get('id_token_hint') ?? '';
    const url = URL.parse(target);
    // WHY: Feide requires both parameters (feide-values.md, "RP-initiated logout"); redirect to http(s) only.
    if (!/^https?:$/.test(url?.protocol ?? '') || !state.idTokens.has(hint)) {
      return sendText(
        res,
        400,
        'end session needs an http(s) post_logout_redirect_uri and an id_token_hint this mock issued',
      );
    }
    if (query.get('state')) url.searchParams.set('state', query.get('state'));
    feide.logouts.push({
      idTokenHint: hint,
      postLogoutRedirectUri: target,
      state: query.get('state') ?? undefined,
    });
    redirect(res, url.href);
  });
  router.add(['GET', 'POST'], '/__mock/next-login', async (req, res, { query }) => {
    const key = query.get('user') ?? (req.method === 'POST' ? (await readForm(req)).get('user') : null);
    if (!key || !feide.users.has(key)) {
      return sendJson(res, 404, { error: 'unknown user', users: [...feide.users.keys()] });
    }
    feide.nextLogin(key);
    sendJson(res, 200, { nextLogin: key });
  });
}
