/**
 * mockCanvas — a mock Canvas LTI 1.3 platform: its JWKS, the OIDC authentication endpoint with `form_post`, login
 * initiations for Node-driven tests, browser pages, and verification of Deep Linking responses.
 *
 * Why: oauth2-mock-server cannot act as an LTI platform (no `form_post`, no LTI claims) and Canvas is not reachable
 *      from the build environment (D-049). LTI-001, LTI-003 and LTI-005 need a platform that behaves like Canvas
 *      both when a test drives the tool with supertest and when a real browser does.
 * Spec: LTI-001, LTI-003, LTI-005
 * Invariants:
 *   - It listens on 127.0.0.1 and its origin and issuer are `http://127.0.0.1:<port>`: another site than a tool on
 *     `http://localhost:<port>`, so the tool's frame is third-party, as in Canvas.
 *   - One RS256 platform key signs ID tokens (its JWK at /api/lti/security/jwks); a second, "foreign" key is never
 *     published and exists only for negative tests.
 *   - The only accepted redirect URI is `<toolUrl>/lti/launch`; logins are single-use and expire
 *     (./canvasAuthorize.mjs).
 *   - `platformConfig` lists a token endpoint that is not served: AGS arrives in S6.
 * Collaborators: ./canvasAuthorize.mjs, ./canvasIdTokens.mjs, ./canvasPages.mjs, ./deepLinkReturn.mjs,
 *   ./httpRouter.mjs, ./mockPlatform.mjs, jose.
 * Tests: tools/mock-platform/test/mockCanvas.test.mjs, tools/mock-platform/test/canvasAuthorize.test.mjs
 */
import { calculateJwkThumbprint, exportJWK, generateKeyPair } from 'jose';
import { authParams, checkAuthRequest, createPendingLogins } from './canvasAuthorize.mjs';
import { buildIdTokenClaims, normaliseLaunch, signJwt } from './canvasIdTokens.mjs';
import { autoPostPage, createCanvasPages, refusalPage } from './canvasPages.mjs';
import { createDeepLinkVerifier, registerDeepLinkReturn } from './deepLinkReturn.mjs';
import { createRouter, readForm, sendHtml, sendJson, startServer } from './httpRouter.mjs';
import { STORAGE_TARGET } from './platformStorageFrame.mjs';

/** Canvas-like defaults: a developer key's global ID, a deployment ID, and the login time to live. */
export const MOCK_CANVAS_DEFAULTS = Object.freeze({
  clientId: '10000000000001',
  deploymentId: '1:4dde05e8ca1973bcca9bffc13e1548820eee93a3',
  launchTtlSeconds: 300,
});

/**
 * Checks the tool's base URL.
 * @param {unknown} toolUrl - e.g. `http://localhost:3000`.
 * @returns {string} The URL without a trailing slash.
 * @throws {TypeError} When it is not an http(s) URL without query or fragment.
 */
export function toolBaseUrl(toolUrl) {
  const url = typeof toolUrl === 'string' && URL.canParse(toolUrl) ? new URL(toolUrl) : undefined;
  if (!url || !/^https?:$/.test(url.protocol) || url.search !== '' || url.hash !== '') {
    throw new TypeError('toolUrl must be an http(s) URL such as http://localhost:3000');
  }
  return url.href.replace(/\/+$/, '');
}

/**
 * Starts a mock Canvas.
 * @param {{toolUrl: string, port?: number, host?: string, clientId?: string, deploymentId?: string,
 *   launchTtlSeconds?: number}} options - Where the tool runs; port 0 (default) picks a free port.
 * @returns {Promise<object>} The running mock; see `MockCanvas` in ./mockPlatform.d.mts.
 */
export async function startMockCanvas(options) {
  const toolUrl = toolBaseUrl(options?.toolUrl);
  const {
    port = 0,
    host = '127.0.0.1',
    clientId = MOCK_CANVAS_DEFAULTS.clientId,
    deploymentId = MOCK_CANVAS_DEFAULTS.deploymentId,
    launchTtlSeconds = MOCK_CANVAS_DEFAULTS.launchTtlSeconds,
  } = options;
  const [platformKey, foreignKey] = await Promise.all([generateKeyPair('RS256'), generateKeyPair('RS256')]);
  const publicJwk = { ...(await exportJWK(platformKey.publicKey)), alg: 'RS256', use: 'sig' };
  publicJwk.kid = await calculateJwkThumbprint(publicJwk);
  const router = createRouter();
  const http = await startServer(router.listener, { port, host });
  const origin = `http://${host}:${http.port}`;
  const platform = { origin, issuer: origin, clientId, deploymentId, toolUrl };
  const logins = createPendingLogins(launchTtlSeconds);
  const deepLinkRequests = new Map();
  const normalise = (spec) => {
    const launch = normaliseLaunch(spec, platform);
    if (launch.deepLinkData !== undefined) deepLinkRequests.set(launch.deepLinkData, launch);
    return launch;
  };
  const verifier = createDeepLinkVerifier(platform, (data) => deepLinkRequests.get(data));
  const sign = (claims, key, kid) => signJwt(claims, key.privateKey, kid);
  const authEndpoint = `${origin}/api/lti/authorize_redirect`;
  const tokenEndpoint = `${origin}/login/oauth2/token`;
  const jwksUrl = `${origin}/api/lti/security/jwks`;
  const canvas = {
    ...platform,
    authEndpoint,
    tokenEndpoint,
    jwksUrl,
    publicJwk,
    platformConfig: {
      name: 'Mock Canvas',
      issuer: origin,
      clientId,
      authEndpoint,
      tokenEndpoint,
      jwksUrl,
      deployments: [deploymentId],
      // WHY: the mock substitutes `$Canvas.user.loginId` with the demo user's Feide ID, so linking is confirmed.
      feideLinking: true,
    },
    deepLinkResponses: verifier.responses,
    loginInitiation(spec) {
      const launch = normalise(spec);
      const { hint, loginHint } = logins.add(launch);
      return {
        iss: origin,
        login_hint: loginHint,
        target_link_uri: launch.targetLinkUri,
        lti_message_hint: hint,
        client_id: clientId,
        lti_deployment_id: launch.deploymentId,
        ...(launch.platformStorage && { lti_storage_target: STORAGE_TARGET }),
      };
    },
    async authorize(input) {
      const params = authParams(input);
      const refused = checkAuthRequest(params, { clientId, redirectUri: `${toolUrl}/lti/launch` });
      if (refused) return refused;
      const taken = logins.take(params);
      if (!taken.launch) return taken;
      const idToken = await sign(
        buildIdTokenClaims(platform, taken.launch, params.nonce),
        platformKey,
        publicJwk.kid,
      );
      return { action: params.redirect_uri, idToken, state: params.state };
    },
    idTokenClaims: (spec, nonce) => buildIdTokenClaims(platform, normalise(spec), nonce),
    signIdToken: (claims, { key = 'platform', kid = publicJwk.kid } = {}) =>
      sign(claims, key === 'foreign' ? foreignKey : platformKey, kid),
    coursePageUrl: (spec) => pages.urlFor(spec),
    verifyDeepLinkResponse: verifier.verify,
    close: http.close,
  };
  const pages = createCanvasPages(canvas, normalise);
  registerPlatformRoutes(router, canvas);
  registerDeepLinkReturn(router, verifier.verify);
  pages.register(router);
  return canvas;
}

function registerPlatformRoutes(router, canvas) {
  router.add('GET', '/api/lti/security/jwks', (_req, res) =>
    sendJson(res, 200, { keys: [canvas.publicJwk] }),
  );
  router.add(['GET', 'POST'], '/api/lti/authorize_redirect', async (req, res, { query }) => {
    const params = Object.fromEntries(req.method === 'POST' ? await readForm(req) : query);
    const result = await canvas.authorize(params);
    if (result.error) return sendHtml(res, 400, refusalPage(result));
    const fields = { id_token: result.idToken, state: result.state };
    sendHtml(res, 200, autoPostPage('Mock Canvas · launching', result.action, fields));
  });
}
