/**
 * deepLinkReturn — verifies the Deep Linking response JWT a tool posts back to the mock Canvas and records what it
 * held and every problem Canvas would refuse it for.
 *
 * Why: LTI-005's acceptance is a signed JWT at `deep_link_return_url` that the platform accepts. The mock checks
 *      what a platform checks: the signature against the tool's JWKS (`<toolUrl>/lti/keys`), iss, aud, deployment,
 *      nonce, message type, version, `data`, the token's times and the items against the request's settings.
 * Spec: LTI-005
 * Invariants:
 *   - Every check runs even after another fails, so `problems` lists all of them; an empty list means accepted.
 *     Only a token that cannot be decoded at all stops at `invalid-jwt`.
 *   - The tool's JWKS is fetched for every response, so a tool that restarts with new keys is never judged by
 *     stale keys.
 *   - Only RS256 is accepted; a `kid` that is absent or not in the tool's JWKS is `unknown-kid`.
 *   - A nonce is accepted once, and only a response whose signature verified uses it up, so a forged copy cannot
 *     make the genuine response look replayed; `data` must equal the `data` of a request this platform issued.
 *   - Resource links must point to the tool's origin (Canvas domain-matches returned links).
 * Collaborators: ./mockCanvas.mjs (finds the request by `data`), ./ltiVocabulary.mjs, ./httpRouter.mjs, jose.
 * Tests: tools/mock-platform/test/deepLinkReturn.test.mjs
 */
import { compactVerify, createRemoteJWKSet, decodeJwt, decodeProtectedHeader } from 'jose';
import { LTI_CLAIM, acceptedItemTypes } from './ltiVocabulary.mjs';
import { escapeHtml, htmlDocument, readForm, sendHtml } from './httpRouter.mjs';

const SIGNATURE_PROBLEM = {
  ERR_JWKS_NO_MATCHING_KEY: 'unknown-kid',
  ERR_JWS_SIGNATURE_VERIFICATION_FAILED: 'bad-signature',
  ERR_JOSE_ALG_NOT_ALLOWED: 'wrong-alg',
};
const CLOCK_SKEW_SECONDS = 60;

/**
 * Creates the verifier of one mock Canvas.
 * @param {{issuer: string, clientId: string, deploymentId: string, toolUrl: string}} platform - The mock Canvas.
 * @param {(data: unknown) => object | undefined} findRequest - The normalised Deep Linking launch with this `data`.
 * @returns {{responses: object[], verify: (jwt: string) => Promise<object>}} `verify` records and returns one
 *   response (see `DeepLinkResponseRecord` in ./mockPlatform.d.mts).
 */
export function createDeepLinkVerifier(platform, findRequest) {
  // WHY: a test may restart the tool with new keys; jose's cache would hide them for its 30-second cooldown.
  const jwks = createRemoteJWKSet(new URL(`${platform.toolUrl}/lti/keys`), {
    cacheMaxAge: 0,
    cooldownDuration: 0,
  });
  const toolOrigin = new URL(platform.toolUrl).origin;
  const nonces = new Set();
  const responses = [];

  async function verify(jwt) {
    const problems = [];
    let header = {};
    let claims = {};
    try {
      header = decodeProtectedHeader(jwt);
      claims = decodeJwt(jwt);
    } catch {
      problems.push('invalid-jwt');
    }
    const request = problems.length === 0 ? findRequest(claims[LTI_CLAIM.data]) : undefined;
    const items = claims[LTI_CLAIM.contentItems] ?? [];
    if (problems.length === 0) {
      const verified = await checkSignature(jwt, header, problems);
      checkClaims(claims, request, problems, verified);
      checkItems(items, request, problems);
    }
    const record = {
      ok: problems.length === 0,
      problems,
      jwt,
      header,
      claims,
      items: Array.isArray(items) ? items : [],
      lifetime:
        typeof claims.exp === 'number' && typeof claims.iat === 'number'
          ? claims.exp - claims.iat
          : undefined,
      request: request && {
        placement: request.placement,
        acceptMultiple: request.acceptMultiple,
        data: request.deepLinkData,
      },
      receivedAt: new Date().toISOString(),
    };
    responses.push(record);
    return record;
  }

  /** Pushes the signature problem, if any; true when the signature verified against the tool's JWKS. */
  async function checkSignature(jwt, header, problems) {
    let problem;
    if (header.alg !== 'RS256') problem = 'wrong-alg';
    else if (typeof header.kid !== 'string' || header.kid === '') problem = 'unknown-kid';
    else {
      try {
        await compactVerify(jwt, jwks, { algorithms: ['RS256'] });
      } catch (error) {
        problem = SIGNATURE_PROBLEM[error?.code] ?? 'jwks-unavailable';
      }
    }
    if (problem !== undefined) problems.push(problem);
    return problem === undefined;
  }

  function checkClaims(claims, request, problems, verified) {
    const now = Math.floor(Date.now() / 1000);
    const check = (ok, code) => void (ok || problems.push(code));
    const aud = [claims.aud].flat();
    check(claims.iss === platform.clientId, 'wrong-iss');
    check(aud.includes(platform.issuer) && aud.length === 1, 'wrong-aud');
    check(
      claims[LTI_CLAIM.deploymentId] === (request?.deploymentId ?? platform.deploymentId),
      'wrong-deployment',
    );
    check(typeof claims.nonce === 'string' && claims.nonce !== '', 'missing-nonce');
    if (typeof claims.nonce === 'string' && claims.nonce !== '') {
      check(!nonces.has(claims.nonce), 'reused-nonce');
      if (verified) nonces.add(claims.nonce);
    }
    check(claims[LTI_CLAIM.messageType] === 'LtiDeepLinkingResponse', 'wrong-message-type');
    check(claims[LTI_CLAIM.version] === '1.3.0', 'wrong-version');
    check(request !== undefined, 'data-mismatch');
    check(typeof claims.iat === 'number' && claims.iat <= now + CLOCK_SKEW_SECONDS, 'bad-iat');
    check(typeof claims.exp === 'number' && claims.exp > now && claims.exp > (claims.iat ?? 0), 'expired');
  }

  function checkItems(items, request, problems) {
    if (!Array.isArray(items) || items.some((item) => typeof item !== 'object' || item === null)) {
      return void problems.push('bad-content-items');
    }
    const acceptTypes = acceptedItemTypes(request?.placement);
    if (request && !request.acceptMultiple && items.length > 1) problems.push('too-many-items');
    if (items.some((item) => !acceptTypes.includes(item.type))) problems.push('unaccepted-type');
    const foreign = (item) =>
      item.type === 'ltiResourceLink' &&
      item.url !== undefined &&
      !(URL.canParse(item.url) && new URL(item.url).origin === toolOrigin);
    if (items.some(foreign)) problems.push('foreign-url');
  }

  return { responses, verify };
}

/**
 * Serves `POST /deep_linking_response`: verifies the form field `JWT` and shows what Canvas would do with it.
 * @param {{add: Function}} router - The mock Canvas router.
 * @param {(jwt: string) => Promise<object>} verify - From `createDeepLinkVerifier`.
 */
export function registerDeepLinkReturn(router, verify) {
  router.add('POST', '/deep_linking_response', async (req, res) => {
    const record = await verify((await readForm(req)).get('JWT') ?? '');
    sendHtml(res, record.ok ? 200 : 400, deepLinkResultPage(record));
  });
}

const itemLine = (item) =>
  `<li data-type="${escapeHtml(item.type)}">${escapeHtml(item.title ?? '(untitled)')} · ` +
  `<code>${escapeHtml(item.url ?? '')}</code> · contentId <code>${escapeHtml(item.custom?.contentId ?? '')}</code>` +
  `${item.lineItem ? ' · graded' : ''}</li>`;

/**
 * The page Canvas's frame shows after a Deep Linking response.
 * @param {object} record - From `verify`.
 * @returns {string} The HTML document; ids `deep-link-items` and `deep-link-problems` are stable for e2e tests.
 */
export const deepLinkResultPage = (record) =>
  htmlDocument(
    'Mock Canvas · Deep Linking',
    `<header>Mock Canvas</header><main><h1>${record.ok ? 'Content added' : 'Deep Linking response refused'}</h1>` +
      `<ul id="deep-link-items">${record.items.map(itemLine).join('')}</ul>` +
      `<ul id="deep-link-problems">${record.problems.map((p) => `<li>${escapeHtml(p)}</li>`).join('')}</ul></main>`,
  );
