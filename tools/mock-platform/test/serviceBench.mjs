/**
 * serviceBench — the tool side of the mock Canvas's LTI Advantage services, for their tests: a tiny tool that
 * publishes its key set at /lti/keys, client assertions signed with its key, token requests, service calls and a
 * launch through the mock's authentication endpoint.
 *
 * Why: the token endpoint, AGS and NRPS tests (LTI-008, LTI-012) all need a tool whose key the mock can fetch, as
 *      D-104's grade worker and ltijs present one; one bench keeps the assertion claims and requests alike.
 * Spec: LTI-008, LTI-012
 * Invariants: assertions carry the claims ltijs 7.0.7 signs (`iss` = `sub` = client ID, `aud` = token endpoint,
 *   fresh `jti`, 60 s lifetime); the tool's key set can be switched off to test an unreachable `/lti/keys`.
 * Collaborators: ./canvasTokenEndpoint.test.mjs, ./canvasTokenRules.test.mjs, ./canvasAgs.test.mjs,
 *   ./canvasScoreRules.test.mjs, ./canvasScoreFaults.test.mjs, ./canvasNrps.test.mjs,
 *   ./canvasServiceControls.test.mjs, jose.
 * Tests: tools/mock-platform/test/canvasTokenEndpoint.test.mjs
 */
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';
import { CANVAS_USERS, LTI_MEDIA_TYPE, LTI_SCOPE, startMockCanvas } from '../mockPlatform.mjs';

/** The `kid` of the tool's key. */
export const TOOL_KID = 'tool-key-1';
/** The scopes D-104's grade worker asks for. */
export const GRADE_SCOPES = `${LTI_SCOPE.score} ${LTI_SCOPE.lineItemReadonly}`;
const ASSERTION_TYPE = 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer';

/**
 * A well-formed score body for the demo student.
 * @param {Record<string, unknown>} [overrides] - Fields to change or add.
 * @returns {Record<string, unknown>} The body.
 */
export const scoreBody = (overrides = {}) => ({
  userId: CANVAS_USERS.student.sub,
  scoreGiven: 80,
  scoreMaximum: 100,
  activityProgress: 'Completed',
  gradingProgress: 'FullyGraded',
  timestamp: new Date().toISOString(),
  ...overrides,
});

/**
 * The URL of one relation in a response's `Link` header, as Canvas writes it (several links joined by `,`).
 * @param {Response} response - A service answer.
 * @param {string} [rel] - The relation, default `next`.
 * @returns {string | undefined} The URL, or undefined when the header has no such link.
 */
export const linkOf = (response, rel = 'next') =>
  (response.headers.get('link') ?? '')
    .split(',')
    .map((part) => /^\s*<([^>]+)>;\s*rel="([^"]+)"\s*$/.exec(part))
    .find((match) => match?.[2] === rel)?.[1];

/**
 * Starts a tool key set and a mock Canvas pointed at it.
 * @param {object} [canvasOptions] - Extra `startMockCanvas` options, e.g. `scopes`.
 * @returns {Promise<object>} `canvas`, `otherKey`, `claims`, `sign`, `requestToken`, `token`, `postScore`,
 *   `get`, `launch`, `setKeysAvailable` and `close`.
 */
export async function startServiceBench(canvasOptions = {}) {
  const [toolKey, otherKey] = await Promise.all([generateKeyPair('RS256'), generateKeyPair('RS256')]);
  const jwk = { ...(await exportJWK(toolKey.publicKey)), kid: TOOL_KID, alg: 'RS256', use: 'sig' };
  let keysAvailable = true;
  const tool = createServer((req, res) => {
    const served = req.url === '/lti/keys' && keysAvailable;
    res.writeHead(served ? 200 : 503, { 'Content-Type': 'application/json' });
    res.end(served ? JSON.stringify({ keys: [jwk] }) : '{}');
  });
  await new Promise((resolve) => tool.listen(0, '127.0.0.1', resolve));
  const canvas = await startMockCanvas({
    toolUrl: `http://localhost:${tool.address().port}`,
    ...canvasOptions,
  });
  const now = () => Math.floor(Date.now() / 1000);
  const claims = (overrides = {}) => ({
    iss: canvas.clientId,
    sub: canvas.clientId,
    aud: canvas.tokenEndpoint,
    iat: now(),
    exp: now() + 60,
    jti: randomUUID(),
    ...overrides,
  });
  const sign = (payload = claims(), { key = toolKey.privateKey, kid = TOOL_KID, alg = 'RS256' } = {}) =>
    new SignJWT(payload).setProtectedHeader({ alg, kid, typ: 'JWT' }).sign(key);
  const requestToken = async (fields = {}) =>
    fetch(canvas.tokenEndpoint, {
      method: 'POST',
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_assertion_type: ASSERTION_TYPE,
        client_assertion: fields.client_assertion ?? (await sign()),
        scope: GRADE_SCOPES,
        ...fields,
      }),
    });
  const token = async (scope = GRADE_SCOPES) => (await (await requestToken({ scope })).json()).access_token;
  const bearer = (accessToken) => ({ Authorization: `Bearer ${accessToken}` });
  return {
    canvas,
    otherKey,
    claims,
    sign,
    requestToken,
    token,
    postScore: (lineItemUrl, body, accessToken, type = LTI_MEDIA_TYPE.score) =>
      fetch(`${lineItemUrl}/scores`, {
        method: 'POST',
        headers: { ...bearer(accessToken), 'Content-Type': type },
        body: typeof body === 'string' ? body : JSON.stringify(body),
      }),
    get: (url, accessToken) => fetch(url, { headers: bearer(accessToken) }),
    /** Launches through the mock's authentication endpoint, as ltijs 7.0.7 asks; returns the ID-token claims. */
    async launch(spec) {
      const login = canvas.loginInitiation(spec);
      const result = await canvas.authorize({
        ...{ response_type: 'id_token', response_mode: 'form_post', id_token_signed_response_alg: 'RS256' },
        ...{ scope: 'openid', prompt: 'none', nonce: randomUUID(), state: 'state-1' },
        client_id: login.client_id,
        redirect_uri: login.target_link_uri,
        login_hint: login.login_hint,
        lti_message_hint: login.lti_message_hint,
        lti_deployment_id: login.lti_deployment_id,
      });
      if (!result.idToken) throw new Error(`launch refused: ${result.error}`);
      return JSON.parse(Buffer.from(result.idToken.split('.')[1], 'base64url').toString('utf8'));
    },
    setKeysAvailable: (available) => void (keysAvailable = available),
    async close() {
      await canvas.close();
      tool.closeAllConnections();
      await new Promise((resolve) => tool.close(resolve));
    },
  };
}
